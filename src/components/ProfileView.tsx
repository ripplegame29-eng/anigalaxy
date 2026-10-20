"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { openAuthDialog } from "@/lib/auth-dialog";
import { isPremiumActive, displayNameOf } from "@/lib/auth";
import { useAccount } from "@/lib/use-account";
import { useProfile, unreadCount } from "@/lib/profile";
import { watchStore } from "@/lib/history";
import { BACKGROUNDS, FRAMES, TITLES, titleTag } from "@/lib/cosmetics";
import { COLLECTIONS_KEY, FAVORITES_KEY, type Collection } from "@/lib/collections";
import { parseList, useLocalSnapshot } from "@/lib/use-local-storage";
import { openProfileDialog } from "@/lib/profile-dialog";
import { readyQuestCount, useProgress } from "@/lib/progression/events";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { AgTag } from "@/components/progression/AgTag";
import { AvatarFrame } from "./profile/AvatarFrame";
import { WidgetIcon } from "./profile/WidgetIcon";
import { ProfileNav } from "./profile/ProfileNav";
import { GuestSidebar } from "./profile/GuestSidebar";
import { ProfileFx } from "./profile/ProfileFx";
import { ProfileDebris } from "./profile/ProfileDebris";
import { PremiumChip } from "./profile/PremiumChip";
import { NickName } from "./profile/NickName";
import { StreakCapsule } from "./profile/StreakCapsule";
import {
  EFFECT_LEVEL_VARS,
  PARTICLE_BY_ID,
  STYLE_BY_ID,
} from "@/lib/profile-effects";
import {
  ProfileSection,
  SECTIONS,
  VISIBLE_SECTIONS,
  type SectionId,
  type SectionMeta,
} from "./profile/ProfileSections";

/**
 * Страница профиля: баннер с выбранным фоном, аватар с рамкой косметики,
 * чипы ника/титула/уровня, кнопки действий, боковое меню разделов и
 * содержимое раздела.
 *
 * Раздел выбирается через `?tab=` — так пункты меню в шапке ведут прямо в
 * нужную вкладку, а кнопки «назад» в браузере работают. Набор разделов и
 * маршруты не менялись: менялся только слой представления.
 *
 * `mode="guest"` — тот же профиль глазами чужого человека (`/u/me`):
 * те же реальные данные, но без кнопок владельца и без личных разделов,
 * а состав меню задан настройками приватности. Служит и заготовкой под
 * чужие профили: когда появится сервер, сюда придёт чужой документ.
 */
export function ProfileView({ mode = "owner" }: { mode?: "owner" | "guest" }) {
  const isGuest = mode === "guest";
  const account = useAccount();
  const profile = useProfile();
  const watch = watchStore.useStore();
  const router = useRouter();
  const search = useSearchParams();
  const collectionsRaw = useLocalSnapshot(COLLECTIONS_KEY);
  const favoritesRaw = useLocalSnapshot(FAVORITES_KEY);

  const tab = search.get("tab");
  /** Разделы со ссылкой (магазин) вкладками профиля не являются */
  const section: SectionId = SECTIONS.some((item) => item.id === tab && !item.href)
    ? (tab as SectionId)
    : "main";

  /**
   * Разделы, видимые гостю. Личные (подарки, история, чёрный список) гостю
   * не показываем никогда, остальное — по настройкам приватности владельца.
   */
  const guestSections = useMemo(() => {
    const p = profile.privacy;
    return VISIBLE_SECTIONS.filter((item) => {
      if (item.id === "gifts" || item.id === "blacklist" || item.id === "history") return false;
      if (item.id === "achievements") return p.showAchievements;
      if (item.id === "comments") return p.showComments;
      return true;
    });
  }, [profile.privacy]);

  /**
   * Разрешённые вкладки. `hidden` у пункта означает только «не показывать в
   * меню» — сам раздел живой, и на него ведут прямые ссылки из меню
   * аккаунта, шапки сайта и магазина. Поэтому проверяем по всем `SECTIONS`,
   * а не по `VISIBLE_SECTIONS`: по видимым раздел «Квесты» и «Уведомления»
   * не проходил, и ссылки `/profile?tab=quests` открывали «Основное».
   */
  const allowedSection: SectionId = (isGuest ? guestSections : SECTIONS).some((item) => item.id === section)
    ? section
    : "main";

  const basePath = isGuest ? "/u/me" : "/profile";
  const go = useCallback(
    (id: SectionId) => {
      router.replace(id === "main" ? basePath : `${basePath}?tab=${id}`, { scroll: false });
    },
    [router, basePath],
  );

  /**
   * Рефералка вынесена в отдельную страницу `/referrals`: по макету это
   * самостоятельный раздел, и в колонке профиля он сжимался до ничего.
   * Старый адрес со вкладкой продолжает работать — просто уводит на неё.
   */
  useEffect(() => {
    if (!isGuest && tab === "referrals") router.replace("/referrals");
  }, [tab, router, isGuest]);

  const favorites = useMemo(() => parseList<string>(favoritesRaw, []), [favoritesRaw]);
  const collections = useMemo(() => parseList<Collection>(collectionsRaw, []), [collectionsRaw]);

  const progress = useProgress();

  const bgItem = BACKGROUNDS.find((item) => item.id === profile.backgroundId) ?? BACKGROUNDS[0];
  const background = profile.backgroundCustom
    ? { backgroundImage: `url(${profile.backgroundCustom})`, backgroundSize: "cover", backgroundPosition: "center" }
    : {
        // Градиенты — слои background-image: так многослойные узоры
        // (сетка) получают свой background-size из каталога
        backgroundImage: bgItem.css,
        backgroundSize: bgItem.backgroundSize ?? "auto",
      };

  const frame = FRAMES.find((item) => item.id === profile.frameId);
  const title = TITLES.find((item) => item.id === profile.titleId);

  /** Экипированный тег: виден в шапке, меню и комментариях */
  const equippedTagId = progress.progress.equippedTagId;
  const equippedTag = equippedTagId
    ? PROGRESSION_CONFIG.tags.find((item) => item.id === equippedTagId)
    : undefined;
  /** PREMIUM-тег ставится по факту подписки, а не как награда: сгоревшая
   *  подписка исчезает с профиля сама, без ручного снятия. */
  const premium = isPremiumActive(account);
  /** Мультивыбор: дополнительные теги и титулы (косметический слой профиля) */
  const extraTags = profile.extraTagIds
    .map((id) => PROGRESSION_CONFIG.tags.find((item) => item.id === id))
    .filter((item): item is (typeof PROGRESSION_CONFIG.tags)[number] => Boolean(item));
  const extraTitles = profile.extraTitleIds
    .map((id) => TITLES.find((item) => item.id === id))
    .filter((item): item is (typeof TITLES)[number] => Boolean(item));

  // Hex-подпись («EECA 3964 1B53…») в шапку выводилась раньше. По макету её
  // под ником нет, и читается она как случайный мусор; само поле signature
  // осталось — его видно и правят в настройках профиля.

  /** Сколько квестов можно забрать, и сколько непрочитанных уведомлений */
  const readyQuests = account ? readyQuestCount(progress) : 0;
  const notices = unreadCount(profile);

  /* ------------------------------ Эффекты ------------------------------- */
  /* Стили сочетаются: каждый купленный и надетый класс вешается на корень,
     уровень задаёт --g (амплитуда) и --gd (длительность цикла). Эффект,
     который ещё не куплен, не показывается: витрина и магазин продают,
     а надеть можно только своё. */
  const ownedFx = useMemo(
    () => new Set([...progress.purchases.map((item) => item.itemId), ...profile.purchased]),
    [progress.purchases, profile.purchased],
  );
  const styleClasses = profile.styleFx
    .filter((id) => ownedFx.has(id))
    .map((id) => STYLE_BY_ID.get(id)?.className)
    .filter((name): name is string => Boolean(name))
    .join(" ");
  const particle = profile.particleFx && ownedFx.has(profile.particleFx)
    ? PARTICLE_BY_ID.get(profile.particleFx)
    : undefined;
  const fxLevelVars = EFFECT_LEVEL_VARS[profile.fxLevel];
  const fxVars = {
    "--g": String(fxLevelVars.g),
    "--gd": fxLevelVars.gd,
  } as React.CSSProperties;
  /* Уровень ещё и классом: CSS не умеет брать уровень из --gd, а глитчу
     нужно знать, включать ли жёсткие призраки и разломы карточек. На первом
     уровне профиль только слегка подлаживается, на втором и третьем —
     уже ломается. */
  const levelClass = `fx-lv-${profile.fxLevel}`;

  // Гостю показываем профиль всегда: его смотрят снаружи, и требовать вход,
  // чтобы увидеть собственную страницу, — лишнее. Владельцу без входа
  // показывать нечего, поэтому проверка только у него.
  if (!account && !isGuest) {
    return (
      <div className="ag-root mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pt-10">
        <Breadcrumbs items={[{ label: "Профиль" }]} />
        <div className="mx-auto max-w-md rounded-3xl border border-line bg-card/80 p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-[0_16px_34px_-16px_rgba(31,123,255,1)]">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="3.6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20a7.5 7.5 0 0 1 15 0" />
          </svg>
        </span>
        <h1 className="mt-5 text-xl font-extrabold text-white">Профиль не открыт</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Войдите, чтобы настроить аватар и фон, вести историю просмотра, открывать достижения и уровни.
          Аккаунт хранится только в этом браузере.
        </p>
        <button
          type="button"
          onClick={() => openAuthDialog("login")}
          className="btn-primary mt-5 w-full rounded-xl px-5 py-3 text-sm font-bold text-white"
        >
          Войти
        </button>
        <button
          type="button"
          onClick={() => openAuthDialog("register")}
          className="btn-ghost mt-2 w-full rounded-xl px-5 py-3 text-sm font-semibold text-muted hover:text-white"
        >
          Создать аккаунт
        </button>
        </div>
      </div>
    );
  }

  const actions = isGuest
    ? []
    : [
        { id: "share", label: "Поделиться", icon: "share", run: () => openProfileDialog("share") },
        { id: "preview", label: "Как видят другие", icon: "eye", run: () => openProfileDialog("preview") },
        { id: "appearance", label: "Внешний вид", icon: "pal", run: () => openProfileDialog("appearance") },
        { id: "settings", label: "Настройки", icon: "gear", run: () => openProfileDialog("settings"), primary: true },
      ];

  const badge = (item: SectionMeta) =>
    item.badge === "quests" ? readyQuests : item.badge === "notices" ? notices : 0;

  return (
    <div
      className={`ag-root ${isGuest ? "is-guest" : ""} ${styleClasses} ${levelClass}`}
      style={fxVars}
      data-fx-level={profile.fxLevel}
    >
      {/* ----------------------------- Баннер -----------------------------
          Полная ширина экрана: страница кладёт содержимое в контейнер с
          полями, а баннер в макете идёт от края до края. Полосы в .ag-pf-full
          выносят его за пределы контейнера, поэтому не приходится угадывать
          и дублировать его отступы. */}
      <div className="ag-pf-full">
        <div
          className="ag-pf-ban"
          style={background}
        >
          <div className="ag-pf-ban-glow" aria-hidden />
          <div className="ag-pf-ban-fade" aria-hidden />
          {!isGuest && (
            <button
              type="button"
              onClick={() => openProfileDialog("background")}
              className="btn g"
              style={{ position: "absolute", right: "max(16px, calc(50% - 590px))", top: 16, zIndex: 2 }}
            >
              <WidgetIcon name="plus" />
              Изменить фон
            </button>
          )}
        </div>
      </div>

      <div className="ag-pf-wrap">
        {/* ------------------------------ Герой ------------------------------ */}
        <div className="ag-pf-hero">
          {/* Аватар у гостя не кликабелен: открывать «Внешний вид» ему нельзя */}
          {isGuest ? (
            <div className="ag-pf-av" data-fx style={{ "--i": 2 } as React.CSSProperties}>
              <AvatarFrame
                nickname="Гость"
                avatar={profile.avatar || undefined}
                frame={frame}
                size="md"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openProfileDialog("appearance")}
              aria-label="Изменить аватар"
              className="ag-pf-av"
              data-fx
              style={{ "--i": 2 } as React.CSSProperties}
            >
              <AvatarFrame
                nickname="Гость"
                avatar={profile.avatar || undefined}
                frame={frame}
                size="md"
              />
            </button>
          )}

          <div className="ag-pf-hi">
            {/* Ник ровным белым. Раньше первая буква оставалась белой, а
                остаток красился градиентом в cyan — на своём фоне это
                читалось как опечатка, а не как фирменный стиль. */}
            {/* Как на animeon.cc/user/ayaa: ник отдельной строкой, чипы — строкой
                ниже, служебные подписи — под ними. */}
            {/* data-text читают псевдоэлементы глитча: без него ::before и
                ::after нечего выводить — они берут содержимое отсюда. */}
            <h1 data-text={displayNameOf(account) || "Гость"}>
              <NickName name={displayNameOf(account) || "Гость"} style={profile.nickStyle} />
            </h1>
            {/* Строка чипов всегда есть: капсула серии в ней живёт сама
                и меняется по ходу дня, поэтому «показывать строку, только
                если что-то надето» больше не работает. */}
            <div className="ag-pf-line">
              {/* Серия дней идёт первая: это единственный блок в строке,
                  который меняется сам, а не по выбору игрока. */}
              <StreakCapsule />
              {equippedTag && <AgTag tag={equippedTag} size="md" />}
              {extraTags.map((item) => (
                <AgTag key={item.id} tag={item} size="sm" />
              ))}
              {title && <AgTag tag={titleTag(title)} size="sm" />}
              {extraTitles.map((item) => (
                <AgTag key={item.id} tag={titleTag(item)} size="sm" />
              ))}
              {/* PREMIUM-тег идёт после всех наград: он не earned, а
                  статус подписки, и в ряду наград сбивал бы с толку. */}
              {premium && <PremiumChip />}
            </div>
          </div>
        </div>

        {/* ----------------------------- Действия ---------------------------- */}
        <div className="ag-pf-acts">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={action.run}
              className={action.primary ? "btn" : "btn g"}
            >
              <WidgetIcon name={action.icon} />
              {action.label}
            </button>
          ))}
        </div>

        {/* ----------------------------- Разделы ----------------------------- */}
        <div className="ag-pf-lay">
          <section className="ag-pane ag-pf-main" data-fx style={{ "--i": 4 } as React.CSSProperties}>
            {/* Хлебные крошки переехали в колонку содержимого: над баннером
                они оставляли зазор между шапкой и картинкой, а по макету
                баннер идёт сразу под шапкой. Гостю они не нужны — у него
                перед глазами сразу профиль. */}
            {!isGuest && <Breadcrumbs items={[{ label: "Профиль" }]} />}
            <ProfileSection section={allowedSection} account={account} go={go} mode={mode} />
          </section>

          {/* Правая колонка. Владельцу — навигация по своим разделам и сводка
              с личными числами. Гостю вместо неё кольцо со статусами
              списков: навигации по чужим разделам у него нет, а блок должен
              показывать то, за чем стоят настоящие цифры. */}
          {isGuest ? (
            <GuestSidebar nickname={account?.nickname ?? "Гость"} onShare={() => openProfileDialog("share")} />
          ) : (
            <aside className="ag-pf-side">
              <ProfileNav active={allowedSection} go={go} badge={badge} />

              <div className="ag-card ag-pf-sum">
                <p className="ag-w-sub">
                  Списки, история, достижения и косметика сохраняются в этом браузере.
                  Сервера у проекта нет, поэтому данные не покидают устройство.
                </p>
                <div className="ag-pf-sum-grid">
                  {/* data-text читают псевдоэлементы глитча: у суммы они
                      рисуют цветные копии числа. Само число не меняется. */}
                  <div>
                    <b data-text={favorites.length}>{favorites.length}</b>
                    <span>избранное</span>
                  </div>
                  <div>
                    <b data-text={collections.length}>{collections.length}</b>
                    <span>подборки</span>
                  </div>
                  <div>
                    <b className="is-blue" data-text={progress.progress.acBalance}>
                      {progress.progress.acBalance}
                    </b>
                    <span>AC</span>
                  </div>
                </div>
                <p className="ag-w-sub">Записей в истории: {watch.records.length}</p>
              </div>
            </aside>
          )}
        </div>

        {/* Частицы накрывают всю карточку профиля: канвас позиционируется
            по `.ag-pf-wrap`, поэтому прыгает вместе с ней, а не по экрану. */}
        <ProfileFx mode={particle?.mode ?? null} level={profile.fxLevel} enabled={Boolean(particle)} />
        {styleClasses.includes("fx-glitch") && <ProfileDebris />}
      </div>
    </div>
  );
}