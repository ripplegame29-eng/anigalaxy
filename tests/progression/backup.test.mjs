/**
 * Локальная «база данных» (`src/lib/backup.ts`): сбор бэкапа, полная
 * валидация файла ДО записи и план восстановления с точным удалением
 * лишних ключей. Плюс демо-вход Telegram (`src/lib/auth.ts`) — аккаунт
 * создаётся той же валидацией, что и обычная регистрация.
 *
 * Импортируется скомпилированный код из `.tsc-tests/` (см. tools/run-tests.mjs).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  PREIMPORT_KEY,
  backupFileName,
  buildBackup,
  parseBackup,
  planRestore,
  validateBackup,
} from "../../.tsc-tests/lib/backup.js";
import {
  TELEGRAM_DEMO_ACCOUNTS,
  loginTelegramDemo,
  validateNickname,
} from "../../.tsc-tests/lib/auth.js";

/* ------------------------------- Бэкап --------------------------------- */

test("buildBackup: только ключи animehub:*, без снимка отката, метки на месте", () => {
  const backup = buildBackup([
    ["animehub:account:v1", '{"nickname":"tester"}'],
    ["theme", "dark"],
    [PREIMPORT_KEY, "{}"],
    ["animehub:profile:v1", "{}"],
  ]);
  assert.equal(backup.format, BACKUP_FORMAT);
  assert.equal(backup.version, BACKUP_VERSION);
  assert.ok(backup.exportedAt > 0, "нет даты экспорта");
  assert.deepEqual(Object.keys(backup.keys).sort(), [
    "animehub:account:v1",
    "animehub:profile:v1",
  ]);
});

test("validateBackup: корректный файл проходит без изменений", () => {
  const backup = buildBackup([["animehub:chat:v1", '{"messages":[]}']]);
  const result = validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.keys, backup.keys);
});

test("validateBackup: отклоняет чужие и повреждённые файлы", () => {
  const bad = [
    null,
    "строка",
    [],
    {},
    { format: "other", version: 1, exportedAt: 1, keys: {} },
    { format: BACKUP_FORMAT, version: BACKUP_VERSION + 1, exportedAt: 1, keys: {} },
    { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: "сегодня", keys: {} },
    { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: 1, keys: [] },
    { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: 1, keys: { evil: "1" } },
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: 1,
      keys: { "animehub:x": 42 },
    },
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: 1,
      keys: { [PREIMPORT_KEY]: "{}" },
    },
  ];
  for (const raw of bad) {
    const result = validateBackup(raw);
    assert.equal(result.ok, false, `должен быть отклонён: ${JSON.stringify(raw)}`);
    assert.ok(result.error.length > 0, "нет текста ошибки");
  }
});

test("parseBackup: не-JSON и валидный файл", () => {
  assert.equal(parseBackup("{так не json").ok, false);
  const backup = buildBackup([["animehub:progress:v1", "{}"]]);
  const result = parseBackup(JSON.stringify(backup));
  assert.equal(result.ok, true);
  assert.equal(result.value.keys["animehub:progress:v1"], "{}");
});

test("planRestore: записать всё из файла, удалить только лишние ключи проекта", () => {
  const backup = buildBackup([
    ["animehub:profile:v1", '{"fresh":true}'],
    ["animehub:new-key:v1", "{}"],
  ]);
  const plan = planRestore(backup, [
    "animehub:old-key:v1",
    "animehub:profile:v1",
    PREIMPORT_KEY,
    "unrelated-key",
  ]);
  assert.equal(plan.set.length, 2);
  // лишний ключ проекта уходит, снимок отката и чужие ключи — остаются
  assert.deepEqual(plan.remove, ["animehub:old-key:v1"]);
});

test("backupFileName: дата в имени файла", () => {
  const name = backupFileName(Date.UTC(2026, 9, 6, 12));
  assert.match(name, /^anigalaxy-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.ok(name.includes("2026-10-06"), name);
});

/* ------------------------- Telegram (демо) ------------------------------ */

test("демо-аккаунты Telegram: имена валидны никнеймом проекта", () => {
  assert.ok(TELEGRAM_DEMO_ACCOUNTS.length >= 2, "нужно минимум два аккаунта");
  for (const acc of TELEGRAM_DEMO_ACCOUNTS) {
    assert.equal(validateNickname(acc.username), null, `ник: ${acc.username}`);
    assert.ok(!acc.username.includes("@"), "username должен быть без @");
    assert.ok(acc.name.length > 0, "пустое отображаемое имя");
  }
  const nicks = new Set(TELEGRAM_DEMO_ACCOUNTS.map((acc) => acc.username));
  assert.equal(nicks.size, TELEGRAM_DEMO_ACCOUNTS.length, "дубль username");
});

test("loginTelegramDemo: без браузера возвращает понятную ошибку", () => {
  // localStorage в тестовом окружении нет — вход не должен падать
  const result = loginTelegramDemo(TELEGRAM_DEMO_ACCOUNTS[0].username);
  assert.equal(result.ok, false);
  assert.ok(result.error.length > 0, "нет текста ошибки");
});
