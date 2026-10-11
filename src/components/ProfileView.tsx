"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { openAuthDialog } from "@/lib/auth-dialog";
import { isPremiumActive } from "@/lib/auth";
import { useAccount } from "@/lib/use-account";
import { useProfile, groupSignature, signatureFor, unreadCount } from "@/lib/profile";
import { watchStore } from "@/lib/history";
import { BACKGROUNDS, FRAMES, TITLES, titleTag } from "@/lib/cosmetics";
import { COLLECTIONS_KEY, FAVORITES_KEY, type Collection } from "@/lib/collections";
import { parseList, useLocalSnapshot } from "@/lib/use-local-storage";
import { openProfileDialog } from "@/lib/profile-dialog";
import { readyQuestCount, useLevelInfo, useProgress } from "@/lib/progression/events";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { AgTag } from "@/components/progression/AgTag";
import { AvatarView } from "./profile/AvatarView";
import { ProfileSection, SECTIONS, type SectionId } from "./profile/ProfileSections";

/**
 * Страница профиля: баннер с выбранным фоном, аватар с загрузкой (в том
 * числе GIF), чипы ника/титула/уровня, кнопки действий, боковое меню
 * разделов и контент раздела.
 *
 * Раздел выбирается через `?tab=` — так пункты дропдауна в шапке ведут
 * прямо в нужную вкладку, а кнопки «назад» в браузере работают.
 */
export function ProfileView() {
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

  const go = useCallback(
    (id: SectionId) => {
      router.replace(id === "main" ? "/profile" : `/profile?tab=${id}`, { scroll: false });
    },
    [router],
  );

  const favorites = useMemo(() => parseList<string>(favoritesRaw, []), [favoritesRaw]);
  const collections = useMemo(() => parseList<Collection>(collectionsRaw, []), [collectionsRaw]);

  const info = useLevelInfo();
  const progress = useProgress();
  const premium = isPremiumActive(account);

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

  /** Экипированный тег (§12.4): виден в шапке, меню и комментариях */
  const equippedTagId = progress.progress.equippedTagId;
  const equippedTag = equippedTagId
    ? PROGRESSION_CONFIG.tags.find((item) => item.id === equippedTagId)
    : undefined;
  /** Мультивыбор: дополнительные теги и титулы (косметический слой профиля) */
  const extraTags = profile.extraTagIds
    .map((id) => PROGRESSION_CONFIG.tags.find((item) => item.id === id))
    .filter((item): item is (typeof PROGRESSION_CONFIG.tags)[number] => Boolean(item));
  const extraTitles = profile.extraTitleIds
    .map((id) => TITLES.find((item) => item.id === id))
    .filter((item): item is (typeof TITLES)[number] => Boolean(item));

  const registered = account
    ? new Date(account.createdAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const signature = account
    ? groupSignature(signatureFor(profile, account.nickname, account.createdAt))
    : [];

  /** Сколько квестов можно забрать — подсветка пункта меню */
  const readyQuests = account ? readyQuestCount(progress) : 0;

  const notices = unreadCount(profile);

  if (!account) {
    return (
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
    );
  }

  const actions = [
    { label: "Поделиться", onClick: () => openProfileDialog("share") },
    { label: "Как видят другие", onClick: () => openProfileDialog("preview") },
    { label: "Внешний вид", onClick: () => openProfileDialog("appearance") },
    { label: "Настройки", onClick: () => openProfileDialog("settings") },
  ];

  const chip =
    "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wide ring-1";

  return (
    <div className="space-y-5">
      {/* ----------------------------- Баннер ----------------------------- */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-card/60">
        <div className="relative h-40 w-full sm:h-48" style={background}>
          <div className="absolute inset-0 bg-gradient-to-t from-card/95 via-card/35 to-transparent" />
          <button
            type="button"
            onClick={() => openProfileDialog("background")}
            className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-xl bg-black/55 px-3 py-2 text-xs font-bold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-black/75 hover:ring-white/60"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-2.5M12 4v10m0 0-3.5-3.5M12 14l3.5-3.5" />
            </svg>
            Изменить фон
          </button>
        </div>

        <div className="px-4 pb-5 sm:px-6">
          <div className="-mt-12 flex flex-wrap items-end gap-4">
            <button
              type="button"
              onClick={() => openProfileDialog("appearance")}
              aria-label="Изменить аватар"
              className="group relative"
            >
              <AvatarView
                nickname={account.nickname}
                avatar={profile.avatar || undefined}
                frameCss={frame?.css}
                frameImg={frame?.img}
                className="h-24 w-24 ring-4 ring-card/90 sm:h-28 sm:w-28"
                textClass="text-3xl"
              />
              <span className="absolute inset-x-0 bottom-1 mx-auto w-max rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 ring-1 ring-white/25 transition group-hover:opacity-100">
                Загрузить фото
              </span>
            </button>

            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="truncate text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {account.nickname}
                </h1>
                {premium && (
                  <span className={`${chip} border-gold/40 bg-gold/15 text-gold`}>Premium</span>
                )}
              </div>
              <p className="mt-0.5 truncate text-sm text-muted">@{account.nickname.toLowerCase()}</p>
            </div>
          </div>

          {/* Выбранные теги и титулы: основной тег крупный (md),
              дополнительные и титулы — капсулы sm рядом.
              Служебные чипы идут отдельной строкой ниже и меньше их. */}
          {(equippedTag || extraTags.length > 0 || title || extraTitles.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {equippedTag && <AgTag tag={equippedTag} size="md" />}
              {extraTags.map((item) => (
                <AgTag key={item.id} tag={item} size="sm" />
              ))}
              {title && <AgTag tag={titleTag(title)} size="sm" />}
              {extraTitles.map((item) => (
                <AgTag key={item.id} tag={titleTag(item)} size="sm" />
              ))}
            </div>
          )}

          {/* Чипы */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <span className={`${chip} bg-accent-2/12 text-accent-2 ring-accent-2/35`}>
              {info.into} / {info.need} XP
            </span>
            <span className={`${chip} bg-white/8 text-muted ring-white/15`}>{info.era}</span>
            <span className={`${chip} bg-white/8 text-muted ring-white/15`}>
              Серия {progress.progress.streakCurrent} дн.
            </span>
            <span className={`${chip} bg-gold/12 text-gold ring-gold/35`}>{progress.progress.acBalance} AC</span>
            <span className={`${chip} bg-white/8 text-muted ring-white/15`}>С {registered}</span>
            <button
              type="button"
              onClick={() => go("quests")}
              className={`${chip} bg-mint/12 text-mint ring-mint/35 transition hover:bg-mint/20`}
            >
              Квесты дня
            </button>
          </div>

          {/* Подпись */}
          <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[11px] tracking-[0.2em] text-muted">
            {signature.map((group) => (
              <span key={group}>{group}</span>
            ))}
          </div>

          {/* Действия */}
          <div className="mt-4 flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="rounded-xl bg-white/8 px-3.5 py-2.5 text-xs font-bold text-white ring-1 ring-white/12 transition hover:bg-white/14 hover:ring-white/30"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- Разделы ------------------------------ */}
      <div className="grid gap-5 lg:grid-cols-[1fr_270px]">
        <div className="min-w-0 order-2 lg:order-1">
          <ProfileSection section={section} account={account} go={go} />
        </div>

        {/* Меню разделов: слева сверху на мобильных, колонкой справа на десктопе.
            min-w-0 обязателен: без него горизонтальный список пилюль растягивает
            колонку грида и страница скроллится вбок на узких экранах */}
        <nav
          className="order-1 min-w-0 max-w-full lg:order-2 lg:sticky lg:top-24 lg:self-start"
          aria-label="Разделы профиля"
        >
          <div className="rounded-2xl border border-line bg-card/70 p-2">
            <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SECTIONS.map((item) => {
                const active = item.id === section;
                const badge =
                  item.badge === "quests" ? readyQuests : item.badge === "notices" ? notices : 0;

                /** Класс общий для кнопки и ссылки: пункт со ссылкой уводит
                    на отдельную страницу (магазин), остальные — вкладки */
                const cls = `flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
                  active
                    ? "bg-accent-deep text-white shadow-[0_14px_30px_-18px_rgba(31,123,255,1)]"
                    : "text-muted hover:bg-white/6 hover:text-white"
                }`;
                const label = <span className="flex-1 text-left">{item.label}</span>;
                const counter = badge > 0 && (
                  <span
                    className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-black ${
                      active ? "bg-white text-accent-deep" : "bg-accent-deep text-white"
                    }`}
                  >
                    {badge}
                  </span>
                );

                return (
                  <li key={item.id} className="shrink-0">
                    {item.href ? (
                      <Link href={item.href} className={cls}>
                        {label}
                        {counter}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => go(item.id)} aria-current={active ? "true" : undefined} className={cls}>
                        {label}
                        {counter}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-3 rounded-2xl border border-line bg-card/70 p-4">
            <p className="text-[11px] leading-relaxed text-muted">
              Списки, история, достижения и косметика сохраняются в этом браузере. Сервера у проекта нет,
              поэтому данные не покидают устройство.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[11px]">
              <div className="rounded-lg bg-white/6 px-1 py-1.5 ring-1 ring-white/8">
                <p className="font-black text-white">{favorites.length}</p>
                <p className="text-muted">избранное</p>
              </div>
              <div className="rounded-lg bg-white/6 px-1 py-1.5 ring-1 ring-white/8">
                <p className="font-black text-white">{collections.length}</p>
                <p className="text-muted">подборки</p>
              </div>
              <div className="rounded-lg bg-white/6 px-1 py-1.5 ring-1 ring-white/8">
                <p className="font-black text-gold">{progress.progress.acBalance}</p>
                <p className="text-muted">монеты</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-muted">Записей в истории: {watch.records.length}</p>
          </div>
        </nav>
      </div>
    </div>
  );
}
