"use client";

/**
 * Хранилище прогрессии: `ProgressStore` поверх фабрики проекта
 * (`lib/store.ts`) — тот же контракт SSR/гидратации и кросс-вкладочной
 * синхронизации, что у остальных ключей `animehub:*`.
 *
 * Интерфейс асинхронный (`load/save` возвращают промисы): локальный адаптер
 * резолвит их синхронно, серверный (`ServerStore`) сможет быть настоящим
 * async без правок движка и сервиса (§2.2).
 *
 * Один документ на ключ — одна атомарная запись: состояние, журнал и
 * идемпотентные ключи не могут разойтись из-за частичной записи.
 */

import { createLocalStore, type LocalStore } from "../store";
import { PROGRESSION_CONFIG } from "./progression.config";
import { EMPTY_DOC, parseDoc, PROGRESS_KEY } from "./doc";
import type { ProgressDoc, ProgressionConfig } from "./types";

export { EMPTY_DOC, parseDoc, PROGRESS_KEY, PROGRESS_SCHEMA } from "./doc";

export interface ProgressStore {
  readonly key: string;
  /** Первоначальная загрузка (в локальном режиме — синхронный кэш) */
  load(): Promise<ProgressDoc | null>;
  save(doc: ProgressDoc): Promise<void>;
  subscribe(fn: () => void): () => void;
  /** Текущий снимок (на сервере всегда EMPTY_DOC) */
  get(): ProgressDoc;
  getServer(): ProgressDoc;
  set(doc: ProgressDoc): void;
  update(fn: (doc: ProgressDoc) => ProgressDoc): void;
  /** Хук для компонента: подписан на изменения */
  useStore(): ProgressDoc;
}

function wrapLocal(local: LocalStore<ProgressDoc>): ProgressStore {
  return {
    key: local.key,
    load: async () => local.get(),
    save: async (doc) => {
      local.set(doc);
    },
    subscribe: (fn) => local.subscribe(fn),
    get: () => local.get(),
    getServer: () => local.getServer(),
    set: (doc) => local.set(doc),
    update: (fn) => local.update(fn),
    useStore: () => local.useStore(),
  };
}

/** Адаптер серверного режима: логика не меняется, состояние — на сервере */
export function createServerProgressStore(key = PROGRESS_KEY): ProgressStore {
  const listeners = new Set<() => void>();
  return {
    key,
    load: async () => null,
    save: async () => undefined,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    get: () => EMPTY_DOC,
    getServer: () => EMPTY_DOC,
    set: () => undefined,
    update: () => undefined,
    useStore: () => EMPTY_DOC,
  };
}

const localStores = new Map<string, ProgressStore>();

/** Локальный адаптер (кэшируется по ключу — одна подписка на документ) */
export function createLocalProgressStore(key = PROGRESS_KEY): ProgressStore {
  const cached = localStores.get(key);
  if (cached) return cached;
  const store = wrapLocal(createLocalStore<ProgressDoc>(key, EMPTY_DOC, parseDoc));
  localStores.set(key, store);
  return store;
}

let singleton: ProgressStore | null = null;

/** Единая точка доступа: режим выбирается флагом конфига (§2.2) */
export function getProgressStore(cfg: ProgressionConfig = PROGRESSION_CONFIG): ProgressStore {
  if (singleton) return singleton;
  singleton =
    cfg.storageMode === "server" ? createServerProgressStore() : createLocalProgressStore();
  return singleton;
}

/** Для тестов: сброс синглтона */
export function resetProgressStore(): void {
  singleton = null;
}
