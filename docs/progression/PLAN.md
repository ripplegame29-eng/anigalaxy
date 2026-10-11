# План — единая RPG-система прогрессии AniGalaxy

Этап 1 (разведка → план → данные) ✅. Этап 2 (движок/хранилище/миграция + тесты) ✅ —
58/58 юнит-тестов, `tsc` 0, eslint без новых ошибок, `npm run build` 0, регрессия 284 проверки / 0 провалов.
Этап 3A (эмиттеры событий) ✅ — функциональный чек `prog_stage3.mjs` 16/16 (вход, heartbeat, избранное,
комментарий, чистая консоль, идемпотентность), регрессия 284/0.
Этап 4 (экономика) ✅ — уровни/эры/AC/mагазин/квесты/статусы/оценки из конфига и движка:
`prog_stage4.mjs` 35/35 (миграция с baseline, карточка уровня, статусы, идемпотентность оценки,
покупки за AC, отказ без средств, чистая консоль), регрессия **338 проверок / 0 провалов**,
58/58 юнит-тестов, `tsc` 0, eslint — только 5 предсуществующих, `npm run build` 0.
Попутно исправлен pre-existing баг `cosmetics.isOwned`: предметы `unlock.price` считались
«купленными» и не могли продаться; миграция получила high-water baseline `meta.legacy`
(приросты легаси переносятся каждый визит, потраченные AC не «воскресают»).
Этап 5 (достижения и теги) ✅ — 71 достижение (семейства, ступени I–X, редкость, трофейный счёт,
тайные «???», авто-выдача в журнал), 29 капсул-тегов (вкладки Теги/Рамки/Фоны, покупка/экипировка),
hex-медали и капсулы на собственном SVG (≤16 частиц, `prefers-reduced-motion`, «экономия»):
`prog_stage5.mjs` 43/43, регрессия **392 проверки / 0 провалов** (включая новые чеки
«монеты подарка сразу в балансе AC» и «AC не задваивается после перезагрузки»),
77/77 юнит-тестов, `tsc` 0,
eslint — только 5 предсуществующих, `npm run build` 0.
Попутно починен «мостик» после этапа 4: XP/AC ушли в документ, а UI и легаси-части профиля
читали замороженные `profile.xp/coins`. Показ переведён на документ (`xpTotal`/`acBalance`/
счётчик полученных достижений), `service.applySideEffects` снова пишет раздел «Уведомления»
и выдаёт «Подарок за новый уровень» на `LEVEL_UP` / `ACHIEVEMENT_UNLOCKED` / `TAG_UNLOCKED`,
а `syncLegacyDelta()` переносит монеты забранного подарка в баланс AC без перезагрузки.
Этап 6 (UI/визуал §12) ✅ — тосты наград (`toastsForEffect` + стор `lib/toasts` + `<ToastHost/>`
в `layout.tsx`, хост смонтирован **до** `ProgressionBoot`, чтобы не пропустить `SESSION_START`:
XP с суммой и мягким капом «×0,25 до завтра», `LEVEL_UP`, `ACHIEVEMENT_UNLOCKED`,
`TAG_UNLOCKED`, запись дублируется в «Уведомления»; у `AC_GAINED`/`QUEST_DONE` тостов нет —
лишний шум, AC виден в балансе и журнале); журнал «История XP и AC» (модалка
`ProfileDialogKind = "rewards"` из карточки уровня — итоги «получено XP / получено AC /
потрачено AC» + записи `USER_REWARDS_LOG` с источником, суммой и временем);
видимость экипированного тега (чипы шапки профиля, выпадающее меню аккаунта,
рядом с именем в комментариях, «Как видят другие»); XP-бар с блёском `.ah-shine`
(гаснет по `prefers-reduced-motion`). `prog_stage6.mjs` 23/23, регрессия **415 проверок /
0 провалов** (12 скриптов), 77/77 юнит-тестов, `tsc` 0, eslint — только 5 предсуществующих,
`npm run build` 0, консоль чистая.
Этап 7 (админка/dev-панель §14) ✅ — `ServerStore`-адаптер-заглушка с тем же интерфейсом
(`store.ts`, режим выбирается флагом `storageMode`), dev-панель `src/components/progression/DevPanel.tsx`:
рендерится **только** в dev-сборке и **только** с `?dev=1` (в `next build` условие вырезается —
в prod `aside` не появляется даже с параметром). Операции те же, что в `/admin/progression`:
«+N к счётчику» (`DEV_ADJUST` — после записи движок пересчитывает достижения, панель
показывает «новых достижений: N»), выдача/изъятие XP и AC с причиной `dev-panel`
(`ADMIN_GRANT` → запись `USER_REWARDS_LOG` с источником ADMIN), ручная выдача тега
(новое событие `DEV_TAG_GRANTED` → та же `grantTag`, эффект `TAG_UNLOCKED`), просмотр
журнала и ближайших достижений, сворачивание, сброс документа. `prog_stage7.mjs` 22/22
(panель нет ни в prod с `?dev=1`, ни в dev без параметра; +10 к `EPISODES_COMPLETED`
разблокировал 3 достижения и поднял уровень; выдача XP/тега в журнале и тостах; консоль чистая).
Попутно найден и исправлен dev-only дефект: `getServerToasts()` возвращал новый `[]`
на каждый вызов — React писал в консоль «getServerSnapshot should be cached». Регрессия
после этапа 7: **437 проверок / 0 провалов** (13 скриптов), 83/83 юнит-тестов (6 новых —
`devpanel.test.mjs`), `tsc` 0, eslint — только 5 предсуществующих, `npm run build` 0.

Этап 8 (симулятор баланса и полировка §15.8/§16) ✅ — `tools/balance-sim.mjs`:
читает кривую (`totalXpFor`/`levelFromXp`), пул XP достижений и блок `sim` из конфига,
печатает дни до ур. 5/10/25/50/75/100 для casual/regular/hardcore и **падает с кодом =
числу провалов**, если любой коридор §5 нарушен (допуск ±25%): **22/22, exit 0**
(casual 6.8/35/271/1161/2520/4061, regular 2.8/14/111/475/1031/1661,
hardcore 1.0/5.3/41/174/378/609 суток; сумма XP до ур.100 = 564 613 ≈ 564 600).
Режим «экономия»: стор `src/lib/eco.ts` (`animehub:eco:v1`) + `<EcoBoot/>` в layout,
авто-детект `hardwareConcurrency ≤ 4`, переключатель Авто/Всегда/Выкл во «Внешнем виде»
настроек, `<html data-eco="on">` гасит анимации как `prefers-reduced-motion` —
`prog_stage8.mjs` **14/14** (автоматика, ручной режим важнее ядер, перезагрузка, консоль).
Полировка: контраст AA по реальным элементам (композит alpha-слоёв, парсер
rgb/hsl/oklab/oklch/lab/lch/srgb, для `background-clip:text` — худший стоп градиента),
`a11y` (`lang`, `<main>`, `alt`, `aria-label`, `:focus-visible`), вёрстка 360 px без
горизонтального скролла, производительность (80 карточек, 0 кадров > 250 мс) —
`prog_stage8b.mjs` **19/19**. Найдено и исправлено: белый текст на `bg-accent` (3.94:1)
в активных вкладках/пилюлях → новый токен `--color-accent-deep` (86% акцента + чёрный,
бренд-токены `#1f7bff`/`#00c8ff` не тронуты), `text-muted/70` в футере (3.99) → `/85`.
Итоговый отчёт §16 — `docs/progression/REPORT.md`.
Финальная регрессия: **470 проверок / 0 провалов** (15 скриптов: 14 на prod :3010 +
`prog_stage7` на dev :3000), 22/22 симулятор, 83/83 юнит-тестов, `tsc` 0, eslint —
только 5 предсуществующих, `npm run build` 0.

## 1. Архитектура

```
                UI (React)
                   │  emit(event)                    effects → тосты / записи
                   ▼
  lib/progression/events.ts ──── подписка (хуки useProgress, useEffects)
                   │
                   ▼
  lib/progression/service.ts     валидация · rate-limit · дедуп · снапшот метрик
                   │              (чистый вызов движка + запись через store)
                   ▼
  lib/progression/engine.ts      (doc, event, metrics, ctx) → (doc, effects)
                   │              чистый детерминированный: XP/AC · уровни ·
                   │              эры · достижения · теги · квесты · журнал
                   ▼
  lib/progression/store.ts       ProgressStore (LocalStore / ServerStore-заглушка)
                   │              атомарная запись одного документа + кросс-вкладки
                   ▼
            localStorage: animehub:progress:v1
```

* **Движок чистый и тестируемый**: ни `Date.now()`, ни `localStorage`, ни DOM — всё (время, tz, метрики) приходит аргументами.
* **Конфиг — единственный источник данных** (`progression.config.ts`): правило/достижение/тег/квест/сезон добавляются записью данных, движок не трогается.
* **События, а не начисления**: клиент шлёт «серия досмотрена», а не «+10 XP»; сколько платить — решает конфиг.
* **Одна атомарная запись** документа: состояние + журнал + идемпотентность не расходятся.

## 2. Файлы

### Создаются

| Файл | Назначение |
|---|---|
| `src/lib/progression/types.ts` | контракты: события, эффекты, документ, определения конфига |
| `src/lib/progression/progression.config.ts` | единый конфиг (71 достижение, 29 тегов, правила, квесты, магазин, эры, ранги, сезоны) |
| `src/lib/progression/engine.ts` | чистый движок |
| `src/lib/progression/service.ts` | валидация, антиабьюз, снапшот метрик, коммит |
| `src/lib/progression/store.ts` | `ProgressStore`: LocalStore + ServerStore-заглушка |
| `src/lib/progression/migrate.ts` | миграция старых ключей → документ v1 (идемпотентно) |
| `src/lib/progression/events.ts` | `emit`, подписки, React-хуки (`useProgress`, `useLevelInfo`, …) |
| `src/lib/progression/quests.ts` | смена дня/недели, наборы квестов, прогресс, забирание награды |
| `src/lib/progression/ledger.ts` | операции журнала (append, реверсы, pending → confirmed) |
| `src/lib/progression/devtools.ts` | dev-панель `?dev=1` (операции, +N к счётчику, экспорт/сброс) |
| `src/lib/toasts.ts` + `components/Toasts.tsx` | глобальные тосты (эффекты движка → UI) |
| `tools/run-tests.mjs` | юнит-тесты: `tsc` во временную папку → `node:test` |
| `tools/balance-sim.mjs` | балансовый симулятор (кривая уровней, soft-cap, AC, квесты) |
| `src/lib/progression/__tests__/*` | тесты движка/миграции/журнала/секретов |
| `docs/progression/SCHEMA.md` | схема данных + миграции |

### Меняются

`lib/profile.ts` (xp/coins/streak/claimed уходят в прогресс, остаётся мостик),
`lib/levels.ts` (кривая/эры → конфиг), `lib/collections.ts` (+статусы списков),
`lib/achievements.ts` и `lib/quests.ts` (только источник данных → конфиг),
`lib/cosmetics.ts` (цены → конфиг, +рамка `f-keeper`, вкладки Теги/Подписи/Рамки/Фоны),
`WatchBox.tsx` (heartbeat → события), `TitleActions.tsx` (списки/оценки),
страница тайтла (оценка), `ProfileView`/`ProfileSections`/`ProfileDialogs`
(уровни/XP/AC из прогресса, разделы Достижения/Квесты/Магазин/Журнал),
`Header`/`AccountMenu` (бейджи), `layout.tsx` (хост тостов), `globals.css` (эффекты тегов).

## 3. Схема данных (localStorage)

Ключ `animehub:progress:v1` → `ProgressDoc` (одна запись):

| Секция документа | Таблица §2.3 | Содержимое |
|---|---|---|
| `progress` | `user_progress` | xpTotal, level, acBalance, streak*, lastActiveDate, tz, экипировка, trophyPoints, userId |
| `ledger` | `USER_REWARDS_LOG` | append-only (окно 500): id, currency, amount, source, status, `idempotencyKey` UNIQUE, `reversesId` |
| `daily` | `daily_counters` | date, week, xpActivity, xpTotal (для «Перегрузки»), counts, weekCounts |
| `quests` | `quest_instances` | day/week, экземпляры daily/weekly (progress, done, claimed) |
| `sessions` | `watch_sessions` | накопленные секунды по серии, completedAt |
| `achievements` | `achievement_progress` | id → {progress, unlockedAt, migrated?} |
| `tags` | `user_tags` | tagId → {acquiredAt, source} |
| `purchases` | `purchases` | покупки за AC |
| `counters` + `sets` | `counters` | lifetime-метрики + множество жанров |
| `flags`, `rate`, `rejected`, `meta` | — | секреты, rate-limit, антиабьюз-лог, версия конфига |

Остальные ключи не переименовываются: `profile`, `history`, `favorites`, `collections`,
`account`, `titles`, `quality` читаются миграцией и продолжают жить.

**Идемпотентность**: ключ `<ruleId>:<entity>[:<day>]` (например `EP_COMPLETE:serial-29315:5`),
пишется в журнал в той же атомарной записи — награда невозможна дважды.
Реверс (удаление комментария, отмена покупки) — НОВАЯ запись `reversesId`, не удаление.

## 4. Метрики (снапшот передаётся движку)

`service` собирает снимок каждый вызов: из документа (`EPISODES_COMPLETED`,
`TITLES_COMPLETED`, `DISTINCT_DAYS`, `STREAK_BEST`, `RATINGS`, `COMMENTS_VALID`,
`MINUTES_WATCHED`, `NIGHT_EPISODES`, `QUESTS_DONE`, `TAGS_OWNED`, `TAGS_RARITIES`,
`MAX_XP_IN_DAY`, `MAX_TITLES_IN_DAY`, `MAX_TAG_SWAPS_IN_DAY`, `SECRET_*`, `FLAGS_*`,
`*_TODAY`, `*_WEEK`, `LEVEL`) и из сторов (`PROFILE_PERCENT`, `ACCOUNT_CREATED`,
`DISTINCT_TITLES_IN_LISTS`, `COLLECTIONS_TOTAL`, `FAVORITES_TOTAL`). Достижения и
квесты читают метрики по имени — новый источник = новая метрика + запись данных.

## 5. Порядок этапов (§15)

После каждого этапа: `tsc --noEmit` → `eslint` → `npm run build` → перезапуск :3010 →
прогон всех verify-скриптов + `prog_stage3`…`prog_stage8b` (470 проверок) → консоль чистая, данные не потеряны.

1. **Разведка + план + ASSUMPTIONS + схема + конфиг** ✅
2. **Движок и хранилище** ✅: types, engine (XP/AC/soft-cap/уровни/эры/достижения/теги/квесты/журнал/секреты), store, ledger, migrate, `service.ts`/`events.ts` + юнит-тесты (`node:test`, 58 шт.), `tools/run-tests.mjs` + `tsconfig.tools.json`.
3. **Источники событий** ✅ (часть A): heartbeat+открытие серии в `WatchBox` (EPISODE_OPENED/EPISODE_TICK с контекстом серии: длительность/жанры/финал), ежедневный вход (`ProgressionBoot` в layout), комментарии-стена (добавление/удаление, текст валидируется по стору по id), заполнение профиля (био/аватар/витрина + авто-PROFILE_COMPLETED), избранное (`LIST_ADD favorite`).
   Часть B ✅ (в составе этапа 4): сторы `ratings`/`statuses` + пилюли статуса и кнопки оценки
   в `TitleActions` с `emit` (`LIST_ADD planned/watched`, `TITLE_RATED`).
4. **Экономика** ✅: уровни/эры/AC из конфига (`levels.ts` → `curve.ts`, карточка уровня читает
   документ), квесты дня/недели на движке (забирание через `QUEST_CLAIMED`), магазин на движке
   (`SHOP_PURCHASED`: теги/эффекты/сервисы из конфига + косметика `cosmetics.ts`, выдача
   `ITEM_GRANTED` → гардероб), статусы списков и оценки UI, legacy-дельта с baseline `meta.legacy`.
5. **Достижения и теги** ✅: раздел «Достижения» (семейства, ступени, редкость, трофейный счёт,
   «Получено X из N», «самое редкое», скрытые «???», модалка с условием/датой, фильтры+поиск,
   8 секретов), 29 капсул-тегов и вкладки Теги/Рамки/Фоны (Купить/Экипировать/Снять), визуал
   hex-медалей/капсул (`visual.ts` + `effects.css`), мостик уведомлений/подарков из движка.
6. **UI и награды** ✅: шапка профиля (XP-бар с блёском «осталось X XP», эмблема уровня,
   баланс AC, бейджи серии/эры/экипированного тега), тосты на XP/уровень/достижение/тег
   (дублируются в «Уведомления»), «История XP и AC» из `USER_REWARDS_LOG`, тег в шапке/меню/
   комментариях/«Как видят другие», «Внешний вид», настройки, уведомления.
7. **Dev-панель** `?dev=1` ✅: только dev-сборка, «+N к счётчику» (`DEV_ADJUST` →
   разблокировка достижений), выдача/изъятие XP и AC с причиной, выдача тега
   (`DEV_TAG_GRANTED`), журнал и ближайшие достижения; `ServerStore`-заглушка
   с тем же интерфейсом `ProgressStore`.
8. **Баланс и полировка** ✅: `tools/balance-sim.mjs` (коридоры §5, падает при выходе за них),
   режим «экономия» (авто по ядрам + переключатель, `<html data-eco>`), контраст AA
   (538+99+113+196 элементов — 0 нарушений), `a11y`-структура, 360 px без горизонтального
   скролла, плавность 80 карточек, `prefers-reduced-motion`; итоговый отчёт —
   `docs/progression/REPORT.md`.

## 6. Как расширять (проверяется отчётом §15.8)

* **новый XP-источник** → правило в `rules` + `emit` в UI (+ метрика, если нужен лимит/квест);
* **новое достижение** → запись в `achievements` (семейство, метрика, порог, награда);
* **новый тег** → запись в `tags` (источник, редкость, палитра, эффекты);
* **новый квест** → запись в `dailyPool`/`weeklyPool`;
* **новый сезон** → запись в `seasons` (from/to, множитель XP, бонус AC);
* **новый источник AC** → `ac` в правиле/награде — журнал покажет его автоматически.

## 7. Ограничения (честно)

* клиентская накрутка возможна — режим `local` (§1 в ASSUMPTIONS);
* журнал — окно 500 записей, не вся история;
* скорость/позиция iframe-плеера неизвестны — засчёт по присутствию (§7 в ASSUMPTIONS);
* лайки и ответы на чужие комментарии — `enabled: false` до появления бэкенда.
