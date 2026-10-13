/**
 * Минимальная замена `window.localStorage` для тестов.
 *
 * Нужна, чтобы тестировать игровую логику, построенную на
 * `createLocalStore` (src/lib/store.ts): без неё в Node нет `window`, и все
 * функции, идущие в localStorage, молча отдают значение по умолчанию —
 * то есть на тестах экономика клана проверялась бы вообще не та.
 *
 * Поддержано ровно то, чем пользуется проект: getItem / setItem /
 * removeItem / clear / key / length. Синхронизацию между «вкладками» не
 * эмулируем — `createLocalStore` вешает её через `window.addEventListener`,
 * который здесь заглушен: в тестах вкладка одна, и проверять нечего.
 *
 * Ставится ДО импорта модулей проекта.
 */

class MemoryStorage {
  #map = new Map();

  get length() {
    return this.#map.size;
  }

  key(index) {
    return [...this.#map.keys()][index] ?? null;
  }

  getItem(key) {
    return this.#map.has(key) ? this.#map.get(key) : null;
  }

  setItem(key, value) {
    this.#map.set(key, String(value));
  }

  removeItem(key) {
    this.#map.delete(key);
  }

  clear() {
    this.#map.clear();
  }

  /** Внутренние ключи в виде массива — для отладки в падении теста. */
  _keys() {
    return [...this.#map.keys()];
  }
}

const storage = new MemoryStorage();

if (typeof globalThis.window === "undefined") {
  globalThis.window = {
    localStorage: storage,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
  };
}

/** Полная очистка между тестами — иначе состояние утекает из одного в другой. */
export function resetStorage() {
  storage.clear();
}

export { storage };