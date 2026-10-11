# RECON — состояние anime-hub перед RPG-прогрессией (читан код, 03.10.2026)

## 1. Стек и маршрутизация
- `package.json:12-25` → next 16.3.8, react 19.2.8, tailwind ^4, eslint ^9, TS ^5; зависимостей кроме `server-only` нет.
- `src/app/layout.tsx:9-13` → единственный шрифт Manrope (`--font-manrope`), `:42` `<html lang="ru">`.
- `layout.tsx:50-54` → `<Header/>`, `<main id="main">`, `<Footer/>`; `:61` `<AuthDialog/>` (хост модалки входа), `:71-86` SVG-фильтр `#ah-sharpen`.
- `src/components/Header.tsx:159` → `<ProfileDialogHost/>` (хост всех модалок профиля, portal в `document.body` — `ProfileDialogs.tsx:995`).
- Страницы (все server-компоненты, `"use client"` только у вложенных): `app/page.tsx`, `app/catalog/page.tsx`, `app/title/[id]/page.tsx`, `app/premium/page.tsx`, `app/profile/page.tsx:21-23` (Suspense вокруг `ProfileView` из-за `useSearchParams`), `app/not-found.tsx`.
- API (сервер, только Kodik): `app/api/kodik/{search,list,title,translations}/route.ts`.
- Клиентские модалки: `TitleActions.tsx:131-256`, `QualitySelect.tsx:163+`, `ScreenshotsGallery.tsx:170` — свой portal.

## 2. Хранилище
- Фабрика стора: `src/lib/store.ts:29` `createLocalStore<T>(key, fallback, parse)` — `useSyncExternalStore`, кэш в замыкании, синхронизация вкладок через `storage` (`:67-73`); `store.ts:99` `dayKey()` = `YYYY-MM-DD`; `store.ts:104` `localId(prefix)`.
- Все ключи `animehub:*`:
  - `animehub:profile:v1` (`lib/profile.ts:139`) → `ProfileState`.
  - `animehub:history:v1` (`lib/history.ts:65`) → `WatchState {records, seconds, day, daySeconds, dayEpisodes}` (`:25-35`).
  - `animehub:titles:v1` (`lib/titles.ts:40`) → `Record<id, {id,title,poster?}>`; при >400 записей сброс в `{}` (`:51`).
  - `animehub:collections:v1` (`lib/collections.ts:17`) → `Collection[] {id,name,animeIds,createdAt}`.
  - `animehub:favorites:v1` (`lib/collections.ts:18`) → `string[]` id Kodik.
  - `animehub:account:v1` (`lib/auth.ts:22`) → `Account`.
  - `animehub:account-changed` (`lib/auth.ts:25`) → имя события (не данные).
  - `animehub:quality:v1` (`lib/quality.ts:21`) → `"original"|"hd"|"4k"`.
- Миграций/версионирования НЕТ: только суффикс `:v1`; grep `migrat|:v2` — 0 совпадений.
- Сторы без фабрики (прямой `localStorage`): `collections.ts:30/42`, `auth.ts:80/89/99`, `quality.ts:110/146`, `use-local-storage.ts:29`.

## 3. Профиль / уровни / косметика / достижения / квесты
- `profile.ts:45-78` `ProfileState`: avatar, backgroundId, backgroundCustom, titleId, frameId, bio, signature, showcase[≤6], **xp, coins**, claimed[], questDay, quests[], streak, streakDay, gifts[], comments[], blacklist[], notices[], purchased[], privacy{profilePublic,showStats,showAchievements,showHistory}.
  Уровня как поля нет — считается из xp.
- Мутации: `addXp:160` (возвращает leveledUp, кидает notice «Новый уровень N»), `addCoins:181`, `spendCoins:187`, `purchaseItem:195`, `pushGift:206`, `claimGift:213`, `markClaimed:226`, `rollQuests:237`, `claimQuest:244`, `isQuestClaimed:266`, `addComment:272`, `addBlocked:290`, `markNoticesRead:309`, `unreadCount:317`, `toggleShowcase:323`, `signatureFor:341`.
- `levels.ts:11-17` → `LEVEL_STARTS` до 60 уровня: need(1)=28, need(n)=17+5*(n-2); `:25-32` `ERAS` (Новичок 1, Зритель 5, Знаток 10, Ветеран 20, Мастер 35, Легенда 50); `:51` `levelInfo(xp)`.
- `cosmetics.ts` — валюта покупок **монеты** (`unlock.price`): `BACKGROUNDS:65` (8 шт., 150/180), `TITLES:126` (11 шт.), `FRAMES:142` (6 шт., 120); `isUnlocked:160`, `isOwned:168`, `unlockHint:187`.
- `achievements.ts:69-415` → **28 достижений**, категории watch(10)/collection(6)/profile(5)/social(3)/premium(4); поля `{id,name,description,category,rarity,threshold,unit,rewardXp,rewardCoins,progress(stats)}`; награды `R:60-65`. Прогресс: `collectStats:428`, `achievementViews:455`.
- `quests.ts:33-84` → 5 квестов дня (q-minutes, q-episodes, q-favorite, q-collection, q-profile); `questStats:86`, `questViews:113`; сброс дня — `rollQuests()` + `rollover` в history.

## 4. История просмотра
- `history.ts:86` `recordWatch({id,title,season,episode,poster?})` → лимит 120 записей (`:102`), `dayEpisodes+1`.
- `history.ts:109` `tickWatch(seconds)` → `seconds`/`daySeconds`; шаг 15 с.
- `history.ts:149` `watchStats` → minutes, minutesToday, titles, episodes, episodesToday. Стриков в history нет — streak в profile.
- `WatchBox.tsx:113-123` → `rememberTitle` + `recordWatch` на каждый сезон/эпизод; `WatchBox.tsx:130-135` → `setInterval(15_000)` → `tickWatch(15)` при `visibilityState==="visible"`.
- `titles.ts:46` `rememberTitle`, `:61` `useTitles`.

## 5. Списки тайтлов
- Только избранное (`favorites:v1`) + подборки (`collections:v1`). Статусов «Буду смотреть/Просмотрено» **нет** (grep — 0).
- Точки изменения: `TitleActions.tsx:57-61` toggleFavorite, `:63-70` toggleInCollection, `:72-82` createCollection; `ProfileSections.tsx:624` toggleFavorite, `:671` deleteCollection.
- id — Kodik `serial-29315`; `Collection.animeIds: string[]`.

## 6. Оценки
- Пользовательских оценок 1-10 **нет**. `rating` — только внешний (Shikimori→Кинопоиск→IMDb): `lib/anime.ts:20-28,50-52,157`, UI `AnimeCard.tsx:50-86`, `title/[id]/page.tsx:236-243` (read-only). Хранения пользовательской оценки нет.

## 7. Комментарии и лайки
- **Лайков нет вообще.**
- Комментарии — только локальная стена в профиле: `profile.ts:14-19` `ProfileComment{id,author,text,at}`, `addComment:272` (300 символов, лимит 60), `removeComment:281`; UI `ProfileSections.tsx:1079-1151`. Комментариев к тайтлам нет.

## 8. Аккаунт/авторизация
- `auth.ts:10-20` `Account{nickname,email,passHash,createdAt,premiumUntil?}`; `hashPassword:42` = base64 (демо); `loginAccount:133`, `registerAccount:150` (перезаписывает единственный локальный аккаунт); `activatePremium:188`, `isPremiumActive:197`.
- **Один аккаунт на браузер**, мультипользовательности нет; отдельного session-ключа нет.
- `use-account.ts:35` `useAccount()` слушает `ACCOUNT_EVENT` + `storage`.

## 9. UI профиля
- `ProfileView.tsx:37-38` секция из `?tab=`; `:121-126` кнопки шапки (Поделиться / Как видят другие / Внешний вид / Настройки); `:137-146` «Изменить фон»; `:188-209` чипы (титул, XP, эра, дата рег., «Квесты дня»); сайдбар `:283-303`.
- `ProfileSections.tsx:68-82` `SECTIONS` (13): main, showcase, favorites, collections, achievements, gifts, history, comments, blacklist, quests, shop, referrals, notices. Роутер `:1333-1362`.
- Диалоги (`profile-dialog.ts:9-15`): background, title, appearance, settings, share, preview → `ProfileDialogs.tsx:155/241/335/608/837/881`, хост `:966`; вкладки гардероба `:320-325` (Фоны/Титулы/Рамки/Аватар), настроек `:568-573`.
- Награды: «Забрать награду» — кнопка в карточке достижения `:839-841` (claim `:731-739`), квест `:488-501` (claim `:447-453`), подарки `:977-984`.
- Пустые состояния: Витрина `:547`, Любимое `:613`, Подборки `:654`, История `:1038`, Подарки `:958`, Чёрный список `:1189`, Уведомления `:1308`.

## 10. Premium
- `PremiumPlans.tsx:22-52` тарифы 149/349/1290 ₽ = 30/90/365 дней; `:54-64` FEATURES (в основном декларатив); `:93-104` `activatePremium(days)`.
- Хранение: `account.premiumUntil`. Даёт: косметику `t-premium`/`f-gold`, чип Premium `ProfileView.tsx:174`, карточку `PremiumCard:230`, достижение `premium`.

## 11. Тосты/уведомления
- Глобальной системы тостов **нет**. Локальные `message` state (ShopSection, ProfileDialogs, PremiumPlans `:309-314`), flash-плашка качества `QualitySelect.tsx:24-68`, «уведомления профиля» `profile.notices` (колокольчик `AccountMenu.tsx:233-239`, `NoticesSection:1290`).

## 12. Стили/шрифты
- `globals.css:6-29` `@theme`: `--color-ink/ink-soft/ink-hero/surface/card/elevated/line/line-strong/muted/bright/accent(#1f7bff)/accent-2(#00c8ff)/gold(#ffb020)/mint(#3ddc97)`, `--font-sans`.
- Классы: `.glass:108`, `.text-gradient:115`, `.btn-ghost:130`, `.btn-primary:142`, `.btn-premium:164`, `.btn-login:208`, `.glow-ring:278`, `.hero-scrim:297`, `.rail:305`, `.reveal:318`, `.skeleton:332`, `.no-scrollbar:417`.
- keyframes `:349-397`: shimmer, fadeUp, fadeIn, kenBurns, progressRun, spinSlow + утилиты `:399-414`.
- `@property` — **нет**. `prefers-reduced-motion` — **есть** (`:89-100`). `:focus-visible:83`.

## 13. Тесты/тулинг
- Тестов нет. `package.json:5-10` скрипты: dev/build/start/lint.
- `eslint.config.mjs:5-16` → eslint-config-next/core-web-vitals + typescript; проект запрещает `set-state-in-effect`.
- `tsconfig.json:21-23` → alias `@/* → ./src/*`; strict, `moduleResolution: bundler`.
- Документация: `AGENTS.md`/`CLAUDE.md` (nextjs-agent-rules), `README.md` (структура `:110-157` устарела).

## 14. docs/
- Только `docs/sources-1080.md`.

## Пробелы
- Нет бэкенда/БД/мультипользовательности; нет пользовательских оценок; нет статусов «Буду смотреть/Просмотрено»; нет лайков; комментарии — только стена профиля; нет системы тостов; нет миграций ключей; нет тестов; валюта — `coins` (AC нет); XP за просмотр не начисляется (только достижения/квесты); premium-фичи декларативны.

## Риски для миграции
1. Ключи `*:v1` переименовывать нельзя без чтения-переноса; миграционного слоя нет — его надо писать.
2. `profile.ts:109-132` `parse()` → `{...EMPTY, ...parsed}`: новые поля безопасны, переименование/вложенность теряются молча.
3. Лимиты обрезают данные: history 120, titles >400 → сброс, notices 40, gifts 40, comments 60, collections 100.
4. `registerAccount` (`auth.ts:150`) перезаписывает аккаунт — привязка прогресса к nickname/email невозможна.
5. Сторы рассчитывают на `emit()` — новые ключи через `createLocalStore`/`useLocalSnapshot`, иначе UI не обновится (в линтере запрет `set-state-in-effect`).
6. `account-changed` и `storage` — единственные каналы синхронизации вкладок.
7. `profile.claimed` / `profile.purchased` — id из каталогов; удаление id из каталога = «призрак» в данных.
8. Уровневая кривая `LEVEL_STARTS` (60 уровней) зашита в UI-подписи (`ProfileView:198`, `AccountMenu:321`) — правка формулы меняет отображение.
