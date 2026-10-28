import { createLocalStore } from "./store";
import { voiceKey } from "./voice-merge";

/**
 * Любимые студии озвучки: звёздочка в списке озвучек.
 * Храним нормализованный ключ студии (одна и та же команда у Kodik и AniLiberty
 * считается одной), поэтому выбор работает для всех тайтлов сразу.
 */
const store = createLocalStore<string[]>("animehub:fav-voices:v1", [], (raw) => {
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, 60) : null;
});

export function useFavVoices(): string[] {
  return store.useStore();
}

export function isFavVoice(list: string[], title: string): boolean {
  const key = voiceKey(title);
  return Boolean(key) && list.includes(key);
}

export function toggleFavVoice(title: string): boolean {
  const key = voiceKey(title);
  if (!key) return false;
  const has = store.get().includes(key);
  store.set(has ? store.get().filter((k) => k !== key) : [key, ...store.get()].slice(0, 60));
  return !has;
}
