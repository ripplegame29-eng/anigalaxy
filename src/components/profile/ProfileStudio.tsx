"use client";

import "@/app/cards-card.css";
import "@/app/profile-studio.css";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  closeAllProfileDialogs,
  getProfileDialogState,
  getServerProfileDialogState,
  openFromStudio,
  setStudioTab,
  subscribeProfileDialog,
  type StudioTab,
} from "@/lib/profile-dialog";
import { customBannerStyle, updateProfile, useProfile } from "@/lib/profile";
import {
  BACKGROUNDS,
  FRAMES,
  TITLES,
  isUnlocked,
  titleTag,
  unlockHint,
  type UnlockContext,
} from "@/lib/cosmetics";
import { useAccount } from "@/lib/use-account";
import { displayNameOf, isPremiumActive } from "@/lib/auth";
import { useMyReferrals } from "@/lib/referrals";
import { progressEmit, useLevelInfo, useProgress } from "@/lib/progression/events";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { useTagSelection, useTitleSelection } from "@/lib/selection";
import { AgTag } from "@/components/progression/AgTag";
import { useModalBehaviour } from "@/lib/use-local-storage";
import { useHydrated } from "@/lib/use-hydrated";
import { THEME_PRESETS, BG_PRESETS, activePresetId, applyBgPreset, applyThemePreset } from "@/lib/theme-presets";
import { resetTheme, useProfileTheme } from "@/lib/ptheme";
import { useArtwork } from "@/lib/artwork";
import {
  EFFECT_LEVELS,
  EFFECT_LEVEL_LABEL,
  PARTICLE_EFFECTS,
  STYLE_EFFECTS,
} from "@/lib/profile-effects";
import {
  MAX_WIDGETS,
  WIDGETS,
  WIDGET_BY_ID,
  WIDGET_CATS,
  isWidgetUnlocked,
  readWidgetLayout,
  saveWidgetLayout,
  type WidgetId,
  type WidgetSlot,
} from "@/lib/widgets";
import { MAX_FAVCARDS, favKey, moveFavCard, saveFavCards, toggleFavCard, useFavCards } from "@/lib/favcards";
import { ensureLoaded, useCards, type InvCard } from "@/lib/cards/client";
import { cardDef } from "@/lib/cards/catalog";
import { RANKS } from "@/lib/cards/config";
import { GameCard } from "@/components/cards/GameCard";
import { AvatarFrame } from "./AvatarFrame";
import { NickName } from "./NickName";
import { WidgetIcon } from "./WidgetIcon";
import { NickColorDialog } from "./NickServicesDialogs";

/**
 * Студия профиля — одно окно для всего оформления.
 *
 * Раньше настройка была раскидана по шести окнам (аватар, баннер, теги и
 * титулы, «Внешний вид», «Косметика», «Тема») и разделу «Виджеты». Студия
 * собирает частое в одном месте: слева разделы, в центре выбор, справа
 * живой предпросмотр. Всё применяется сразу — кнопки «Сохранить» нет.
 * Тонкие настройки (обрезка своего баннера, слайдеры темы, оформление-декор)
 * открываются подробными окнами поверх Студии и возвращают обратно в неё.
 */

const TABS: { id: StudioTab; label: string; hint: string; icon: string }[] = [
  { id: "look", label: "Готовые образы", hint: "Арт, акцент и живой фон в один клик", icon: "pal" },
  { id: "avatar", label: "Аватар и рамка", hint: "Фото профиля и рамка вокруг него", icon: "user" },
  { id: "banner", label: "Баннер", hint: "Картинка в шапке профиля", icon: "grid" },
  { id: "badges", label: "Ник и значки", hint: "Цвет ника, теги и титулы", icon: "crown" },
  { id: "fx", label: "Эффекты", hint: "Частицы, стили и их сила", icon: "bolt" },
  { id: "cards", label: "Любимые карты", hint: "Витрина лучших карт коллекции", icon: "star" },
  { id: "blocks", label: "Блоки профиля", hint: "Что видят гости и в каком порядке", icon: "widgets" },
];

const FX_RARITY: Record<string, string> = {
  COMMON: "#9aa7bd",
  UNCOMMON: "#4ade80",
  RARE: "#3fa3ff",
  EPIC: "#b46bff",
  LEGENDARY: "#ffb020",
  MYTHIC: "#ff4d6d",
  SECRET: "#e5e7eb",
};

function useStudioState() {
  return useSyncExternalStore(subscribeProfileDialog, getProfileDialogState, getServerProfileDialogState);
}

function useUnlockCtx(): UnlockContext {
  const profile = useProfile();
  const account = useAccount();
  const referrals = useMyReferrals();
  return {
    level: useLevelInfo().level,
    premium: isPremiumActive(account),
    claimed: profile.claimed,
    purchased: profile.purchased,
    referrals: referrals.filter((item) => item.qualified).length,
  };
}

/** Раскладка блоков с подпиской: панель виджетов и витрина слушают storage */
function useWidgetLayout(): [WidgetSlot[], (next: WidgetSlot[]) => void] {
  const [layout, setLayout] = useState<WidgetSlot[]>([]);
  useEffect(() => {
    const sync = () => setLayout(readWidgetLayout());
    sync();
    addEventListener("storage", sync);
    return () => removeEventListener("storage", sync);
  }, []);
  const save = (next: WidgetSlot[]) => {
    const clean = next.slice(0, MAX_WIDGETS);
    saveWidgetLayout(clean);
    setLayout(clean);
    dispatchEvent(new Event("storage"));
  };
  return [layout, save];
}

function Group({ title, note, action, children }: { title: string; note?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="pst-grp">
      <header>
        <div>
          <h3>{title}</h3>
          {note && <p>{note}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

const Check = () => (
  <i className="pst-ck" aria-hidden>
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5L19 7" />
    </svg>
  </i>
);

/* ------------------------------- Предпросмотр ------------------------------ */

function Preview() {
  const profile = useProfile();
  const account = useAccount();
  const fav = useFavCards();
  const theme = useProfileTheme();
  const tagSel = useTagSelection();
  const titleSel = useTitleSelection();
  const [layout] = useWidgetLayout();
  const mounted = useHydrated();

  const frame = FRAMES.find((item) => item.id === profile.frameId);
  const bgItem = BACKGROUNDS.find((item) => item.id === profile.backgroundId) ?? BACKGROUNDS[0];
  const banner = profile.backgroundCustom
    ? customBannerStyle(profile)
    : { backgroundImage: bgItem.css, backgroundSize: bgItem.backgroundSize ?? "auto" };
  const tags = [tagSel.primary, ...tagSel.extras]
    .map((id) => PROGRESSION_CONFIG.tags.find((item) => item.id === id))
    .filter((item): item is (typeof PROGRESSION_CONFIG.tags)[number] => Boolean(item));
  const titles = [titleSel.primary, ...titleSel.extras]
    .map((id) => TITLES.find((item) => item.id === id))
    .filter((item): item is (typeof TITLES)[number] => Boolean(item));
  const particle = PARTICLE_EFFECTS.find((item) => item.id === profile.particleFx);
  const styles = STYLE_EFFECTS.filter((item) => profile.styleFx.includes(item.id));
  const name = displayNameOf(account) || "Гость";

  return (
    <aside className="pst-prev" style={theme.on && theme.accent ? ({ "--pst-ac": theme.accent } as React.CSSProperties) : undefined}>
      <p className="pst-prev-lbl">
        <i /> Живой предпросмотр
      </p>
      <div className="pst-prev-card">
        <div className="pst-prev-ban" style={banner} />
        <div className="pst-prev-hero">
          <AvatarFrame nickname={name} avatar={profile.avatar || undefined} frame={frame} size="md" />
          <div className="pst-prev-nick">
            <NickName name={name} style={profile.nickStyle} />
          </div>
          {mounted && (tags.length > 0 || titles.length > 0) && (
            <div className="pst-prev-tags">
              {tags.map((tag) => (
                <AgTag key={tag.id} tag={tag} size="sm" />
              ))}
              {titles.map((item) => (
                <AgTag key={item.id} tag={titleTag(item)} size="sm" />
              ))}
            </div>
          )}
        </div>
        {mounted && (
          <div className="pst-prev-fx">
            <span className={particle ? "on" : ""}>✦ {particle ? particle.name : "Без частиц"}</span>
            <span className={styles.length ? "on" : ""}>◈ Стили: {styles.length}/4</span>
            <span className={theme.on ? "on" : ""}>◐ {theme.on ? "Своя тема" : "Стандартная тема"}</span>
          </div>
        )}
        {mounted && fav.length > 0 && (
          <div className="pst-prev-cards">
            {fav.map((c) => (
              <GameCard key={favKey(c)} cardId={c.cardId} foil={c.foil} level={c.level} evo={c.evo} stats={false} sizes="60px" />
            ))}
          </div>
        )}
        {mounted && layout.length > 0 && (
          <div className="pst-prev-blocks">
            {layout.map((slot, i) => (
              <span key={slot.id} className={slot.w === "l" ? "w" : ""}>
                <em>{i + 1}</em>
                {WIDGET_BY_ID[slot.id]?.title}
              </span>
            ))}
          </div>
        )}
      </div>
      <button type="button" className="pst-btn ghost wide" onClick={() => openFromStudio("preview")}>
        <WidgetIcon name="eye" /> Как видят другие
      </button>
    </aside>
  );
}

/* --------------------------------- Образы --------------------------------- */

function LookTab() {
  const art = useArtwork();
  const theme = useProfileTheme();
  const active = activePresetId(art.slots[0]?.media);
  return (
    <>
      <Group title="Сборки с артом" note="Анимированный арт на странице профиля и цвет акцента. Нажмите — и готово.">
        <div className="pst-looks">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pst-look ${active === p.id ? "is-on" : ""}`}
              style={{ "--c": p.accent } as React.CSSProperties}
              onClick={() => applyThemePreset(p)}
            >
              <img src={p.poster} alt="" loading="lazy" />
              <span>
                <b>{p.name}</b>
                <small>{p.tag}</small>
              </span>
              {active === p.id && <Check />}
            </button>
          ))}
        </div>
      </Group>
      <Group title="Живой фон страницы" note="Анимированный фон за всем профилем. Сочетается с любой сборкой.">
        <div className="pst-bgs">
          {BG_PRESETS.map((p) => {
            const on = theme.on && theme.bg.media === p.file;
            return (
              <button key={p.id} type="button" className={`pst-bgp ${on ? "is-on" : ""}`} style={{ "--c": p.accent } as React.CSSProperties} onClick={() => applyBgPreset(p)}>
                <img src={p.poster} alt="" loading="lazy" />
                <b>{p.name}</b>
                {on && <Check />}
              </button>
            );
          })}
        </div>
      </Group>
      <div className="pst-row-btns">
        <button type="button" className="pst-btn" onClick={() => openFromStudio("theme")}>
          <WidgetIcon name="gear" /> Тонкая настройка темы
        </button>
        {theme.on && (
          <button type="button" className="pst-btn ghost" onClick={() => resetTheme()}>
            <WidgetIcon name="undo" /> Вернуть стандартную
          </button>
        )}
      </div>
    </>
  );
}

/* ------------------------------ Аватар и рамка ------------------------------ */

function AvatarTab() {
  const profile = useProfile();
  const account = useAccount();
  const ctx = useUnlockCtx();
  const name = displayNameOf(account) || "Гость";
  const real = FRAMES.filter((item) => item.id !== "f-none");
  const owned = real.filter((item) => isUnlocked(item.unlock, ctx));
  const locked = real.length - owned.length;
  const none = !profile.frameId || profile.frameId === "f-none";
  const current = FRAMES.find((item) => item.id === profile.frameId);
  return (
    <>
      <Group title="Фото профиля" note="PNG, JPG, WEBP или GIF — гифки остаются анимированными.">
        <div className="pst-av">
          <div className="pst-av-big">
            <AvatarFrame nickname={name} avatar={profile.avatar || undefined} frame={current} size="lg" />
          </div>
          <div className="pst-av-side">
            <button type="button" className="pst-btn" onClick={() => openFromStudio("avatar")}>
              <WidgetIcon name="plus" /> Загрузить новое фото
            </button>
            {profile.avatarHistory.length > 0 && (
              <>
                <p className="pst-mini">Прежние фото — нажмите, чтобы вернуть</p>
                <div className="pst-hist">
                  {profile.avatarHistory.slice(0, 8).map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      className={profile.avatar === src ? "is-on" : ""}
                      onClick={() => updateProfile({ avatar: src })}
                      aria-label="Вернуть это фото"
                    >
                      <img src={src} alt="" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </Group>
      <Group
        title="Рамка"
        note={`Открыто ${owned.length} из ${real.length}${locked ? " — остальные за уровень, пропуск и в магазине" : ""}`}
        action={
          <Link href="/cosmetics" className="pst-link" onClick={closeAllProfileDialogs}>
            Магазин рамок →
          </Link>
        }
      >
        <div className="pst-frames">
          <button type="button" className={`pst-frame ${none ? "is-on" : ""}`} onClick={() => updateProfile({ frameId: "" })}>
            <span className="pst-frame-av">
              <AvatarFrame nickname={name} avatar={profile.avatar || undefined} size="sm" />
            </span>
            <b>Без рамки</b>
            {none && <Check />}
          </button>
          {owned.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`pst-frame ${profile.frameId === item.id ? "is-on" : ""}`}
              onClick={() => updateProfile({ frameId: item.id })}
            >
              <span className="pst-frame-av">
                <AvatarFrame nickname={name} avatar={profile.avatar || undefined} frame={item} size="sm" />
              </span>
              <b>{item.name}</b>
              {profile.frameId === item.id && <Check />}
            </button>
          ))}
        </div>
      </Group>
    </>
  );
}

/* ---------------------------------- Баннер --------------------------------- */

function BannerTab() {
  const profile = useProfile();
  const ctx = useUnlockCtx();
  const custom = profile.backgroundId === "custom" && Boolean(profile.backgroundCustom);
  const list = [...BACKGROUNDS].sort((a, b) => Number(isUnlocked(b.unlock, ctx)) - Number(isUnlocked(a.unlock, ctx)));
  return (
    <>
      <Group title="Свой баннер" note="Загрузите картинку или гифку, затем подвиньте и приблизьте её.">
        <div className="pst-own">
          {custom ? <div className="pst-own-pv" style={customBannerStyle(profile)} /> : <div className="pst-own-pv empty">Своя картинка не выбрана</div>}
          <div className="pst-row-btns">
            <button type="button" className="pst-btn" onClick={() => openFromStudio("background")}>
              <WidgetIcon name="plus" /> {custom ? "Заменить или подвинуть" : "Загрузить свой"}
            </button>
            {custom && (
              <button type="button" className="pst-btn ghost" onClick={() => updateProfile({ backgroundId: "preset-dusk", backgroundCustom: "" })}>
                Снять свой
              </button>
            )}
          </div>
        </div>
      </Group>
      <Group title="Готовые баннеры" note="Открываются по уровню, достижениям и за AC.">
        <div className="pst-bans">
          {list.map((item) => {
            const has = isUnlocked(item.unlock, ctx);
            const on = !custom && profile.backgroundId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!has}
                className={`pst-ban ${on ? "is-on" : ""} ${has ? "" : "is-lock"}`}
                onClick={() => updateProfile({ backgroundId: item.id, backgroundCustom: "" })}
              >
                <span style={{ backgroundImage: item.css, backgroundSize: item.backgroundSize ?? "cover" }} />
                <b>{item.name}</b>
                {!has && <em>🔒 {unlockHint(item.unlock)}</em>}
                {on && <Check />}
              </button>
            );
          })}
        </div>
      </Group>
    </>
  );
}

/* ------------------------------- Ник и значки ------------------------------ */

function BadgesTab() {
  const profile = useProfile();
  const account = useAccount();
  const doc = useProgress();
  const ctx = useUnlockCtx();
  const tagSel = useTagSelection();
  const titleSel = useTitleSelection();
  const [nickOpen, setNickOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const name = displayNameOf(account) || "Гость";
  const ownedTags = PROGRESSION_CONFIG.tags.filter((tag) => Boolean(doc.tags[tag.id]));
  const ownedTitles = TITLES.filter((item) => isUnlocked(item.unlock, ctx));
  const tagCount = (tagSel.primary ? 1 : 0) + tagSel.extras.length;
  const titleCount = (titleSel.primary ? 1 : 0) + titleSel.extras.length;
  return (
    <>
      <Group title="Ник" note="Цвет, градиент, переливание и свечение — услуга «Цвет ника».">
        <div className="pst-nick">
          <div className="pst-nick-pv">
            <NickName name={name} style={profile.nickStyle} />
          </div>
          <button type="button" className="pst-btn" onClick={() => setNickOpen(true)}>
            <WidgetIcon name="pal" /> Цвет и стиль ника
          </button>
        </div>
        {msg && <p className="pst-mini ok">{msg}</p>}
      </Group>
      <Group
        title="Теги"
        note={`Первый выбранный — основной. Открыто ${ownedTags.length} из ${PROGRESSION_CONFIG.tags.length}.`}
        action={
          tagCount > 0 ? (
            <button
              type="button"
              className="pst-link"
              onClick={() => {
                progressEmit({ type: "UNEQUIP_TAG" });
                updateProfile({ extraTagIds: [] });
              }}
            >
              Снять все
            </button>
          ) : undefined
        }
      >
        {ownedTags.length === 0 ? (
          <p className="pst-empty">Тегов пока нет — они выдаются за достижения, уровни и в магазине.</p>
        ) : (
          <div className="pst-chips">
            {ownedTags.map((tag) => {
              const main = tagSel.primary === tag.id;
              const on = main || tagSel.extras.includes(tag.id);
              return (
                <button key={tag.id} type="button" aria-pressed={on} className={`pst-chip ${main ? "is-main" : on ? "is-on" : ""}`} onClick={() => tagSel.toggle(tag)}>
                  <AgTag tag={tag} size="sm" />
                  {main && <small>основной</small>}
                </button>
              );
            })}
          </div>
        )}
      </Group>
      <Group
        title="Титулы"
        note={`Открыто ${ownedTitles.length} из ${TITLES.length}. Можно носить несколько.`}
        action={
          titleCount > 0 ? (
            <button type="button" className="pst-link" onClick={() => updateProfile({ titleId: "", extraTitleIds: [] })}>
              Снять все
            </button>
          ) : undefined
        }
      >
        {ownedTitles.length === 0 ? (
          <p className="pst-empty">Титулы открываются за уровень, достижения и сезонный пропуск.</p>
        ) : (
          <div className="pst-chips">
            {ownedTitles.map((item) => {
              const main = titleSel.primary === item.id;
              const on = main || titleSel.extras.includes(item.id);
              return (
                <button key={item.id} type="button" aria-pressed={on} className={`pst-chip ${main ? "is-main" : on ? "is-on" : ""}`} onClick={() => titleSel.toggle(item, true)}>
                  <AgTag tag={titleTag(item)} size="sm" />
                  {main && <small>основной</small>}
                </button>
              );
            })}
          </div>
        )}
      </Group>
      <NickColorDialog open={nickOpen} onClose={() => setNickOpen(false)} onMessage={setMsg} />
    </>
  );
}

/* --------------------------------- Эффекты --------------------------------- */

function FxTab() {
  const profile = useProfile();
  const doc = useProgress();
  const owned = new Set([...doc.purchases.map((item) => item.itemId), ...profile.purchased]);
  const toggleStyle = (id: string) => {
    const on = profile.styleFx.includes(id);
    updateProfile({ styleFx: on ? profile.styleFx.filter((x) => x !== id) : [...profile.styleFx, id].slice(0, 4) });
  };
  return (
    <>
      <Group title="Частицы" note="Одни на профиль: летят поверх карточки.">
        <div className="pst-fx">
          <button type="button" className={`pst-fxc ${profile.particleFx === "" ? "is-on" : ""}`} onClick={() => updateProfile({ particleFx: "" })}>
            <b>Без частиц</b>
            <small>Чистый профиль</small>
            {profile.particleFx === "" && <Check />}
          </button>
          {PARTICLE_EFFECTS.map((item) => {
            const has = owned.has(item.id);
            const on = profile.particleFx === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!has}
                className={`pst-fxc ${on ? "is-on" : ""} ${has ? "" : "is-lock"}`}
                style={{ "--c": FX_RARITY[item.rarity] ?? "#9aa7bd" } as React.CSSProperties}
                onClick={() => updateProfile({ particleFx: item.id })}
              >
                <b>{item.name}</b>
                <small>{item.description}</small>
                {!has && <em>🔒 {item.price} AC</em>}
                {on && <Check />}
              </button>
            );
          })}
        </div>
      </Group>
      <Group title="Стили" note={`Сочетаются между собой — до 4 сразу. Включено: ${profile.styleFx.length}/4.`}>
        <div className="pst-fx">
          {STYLE_EFFECTS.map((item) => {
            const has = owned.has(item.id);
            const on = profile.styleFx.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                disabled={!has || (!on && profile.styleFx.length >= 4)}
                className={`pst-fxc ${on ? "is-on" : ""} ${has ? "" : "is-lock"}`}
                style={{ "--c": FX_RARITY[item.rarity] ?? "#9aa7bd" } as React.CSSProperties}
                onClick={() => toggleStyle(item.id)}
              >
                <b>{item.name}</b>
                <small>{item.description}</small>
                {!has && <em>🔒 {item.price} AC</em>}
                {on && <Check />}
              </button>
            );
          })}
        </div>
      </Group>
      <Group title="Сила эффектов" note="Сколько частиц и насколько сильно работают стили.">
        <div className="pst-seg">
          {EFFECT_LEVELS.map((lv) => (
            <button key={lv} type="button" aria-pressed={profile.fxLevel === lv} className={profile.fxLevel === lv ? "is-on" : ""} onClick={() => updateProfile({ fxLevel: lv })}>
              {EFFECT_LEVEL_LABEL[lv]}
            </button>
          ))}
        </div>
      </Group>
      <div className="pst-row-btns">
        <button type="button" className="pst-btn" onClick={() => openFromStudio("effects")}>
          <WidgetIcon name="star" /> Оформление и вся косметика
        </button>
        <Link href="/cosmetics" className="pst-btn ghost" onClick={closeAllProfileDialogs}>
          <WidgetIcon name="cart" /> Магазин эффектов
        </Link>
      </div>
    </>
  );
}

/* ------------------------------ Любимые карты ------------------------------ */

const RANK_FILTERS: { id: number | "all"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: 4, label: "SS" },
  { id: 3, label: "S" },
  { id: 2, label: "A" },
  { id: 1, label: "B" },
  { id: 0, label: "C" },
];

function CardsTab() {
  const fav = useFavCards();
  const snap = useCards();
  const [layout, saveLayout] = useWidgetLayout();
  const [rank, setRank] = useState<number | "all">("all");
  const [foilOnly, setFoilOnly] = useState(false);
  useEffect(() => ensureLoaded(), []);

  const inv = useMemo(() => {
    const list = (snap.state?.inventory ?? []).filter((c) => cardDef(c.cardId));
    return list
      .filter((c) => (rank === "all" || cardDef(c.cardId)?.rank === rank) && (!foilOnly || c.foil))
      .sort(
        (a, b) =>
          (cardDef(b.cardId)?.rank ?? 0) - (cardDef(a.cardId)?.rank ?? 0) ||
          Number(b.foil) - Number(a.foil) ||
          (b.evo ?? 0) - (a.evo ?? 0) ||
          b.level - a.level,
      )
      .slice(0, 180);
  }, [snap.state, rank, foilOnly]);

  const shown = layout.some((s) => s.id === "cards");
  const setShown = (on: boolean) =>
    saveLayout(on ? [{ id: "cards", w: "l" }, ...layout.filter((s) => s.id !== "cards")] : layout.filter((s) => s.id !== "cards"));

  const pick = (c: InvCard) => {
    toggleFavCard({ inv: c.id, cardId: c.cardId, foil: c.foil, level: c.level, evo: c.evo ?? 0 });
    if (!shown && fav.length === 0) setShown(true);
  };
  const order = new Map(fav.map((c, i) => [favKey(c), i + 1]));

  return (
    <>
      <Group
        title={`Витрина · ${fav.length}/${MAX_FAVCARDS}`}
        note="Порядок — как на профиле. Стрелками меняйте местами."
        action={
          <label className="pst-sw">
            <input type="checkbox" checked={shown} onChange={(e) => setShown(e.target.checked)} />
            <i />
            Показывать на профиле
          </label>
        }
      >
        <div className="pst-slots">
          {Array.from({ length: MAX_FAVCARDS }, (_, i) => {
            const c = fav[i];
            if (!c) return <div key={i} className="pst-slot empty">{i + 1}</div>;
            return (
              <div key={favKey(c)} className="pst-slot">
                <GameCard cardId={c.cardId} foil={c.foil} level={c.level} evo={c.evo} stats={false} live sizes="110px" />
                <div className="pst-slot-ctl">
                  <button type="button" aria-label="Левее" disabled={i === 0} onClick={() => moveFavCard(i, -1)}>‹</button>
                  <button type="button" aria-label="Убрать" className="x" onClick={() => saveFavCards(fav.filter((_, k) => k !== i))}>×</button>
                  <button type="button" aria-label="Правее" disabled={i === fav.length - 1} onClick={() => moveFavCard(i, 1)}>›</button>
                </div>
              </div>
            );
          })}
        </div>
      </Group>
      <Group
        title="Коллекция"
        note={snap.state ? `Карт в коллекции: ${snap.state.inventory.length}. Нажмите карту, чтобы добавить или убрать.` : undefined}
      >
        <div className="pst-filter">
          {RANK_FILTERS.map((f) => (
            <button
              key={String(f.id)}
              type="button"
              aria-pressed={rank === f.id}
              style={f.id !== "all" ? ({ "--c": RANKS[f.id].color } as React.CSSProperties) : undefined}
              onClick={() => setRank(f.id)}
            >
              {f.label}
            </button>
          ))}
          <button type="button" aria-pressed={foilOnly} onClick={() => setFoilOnly((v) => !v)}>
            ✦ Фольга
          </button>
        </div>
        {!snap.state ? (
          <p className="pst-empty">{snap.loading ? "Загружаем коллекцию…" : snap.error || "Коллекция пока не загружена."}</p>
        ) : inv.length === 0 ? (
          <div className="pst-empty">
            {snap.state.inventory.length === 0 ? "Карт пока нет — откройте первый пак." : "Под фильтр ничего не подошло."}
            {snap.state.inventory.length === 0 && (
              <Link href="/cards" className="pst-btn" onClick={closeAllProfileDialogs}>
                Открыть паки
              </Link>
            )}
          </div>
        ) : (
          <div className="pst-inv">
            {inv.map((c) => {
              const n = order.get(favKey({ inv: c.id, cardId: c.cardId }));
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`pst-invc ${n ? "is-on" : ""}`}
                  disabled={!n && fav.length >= MAX_FAVCARDS}
                  onClick={() => pick(c)}
                >
                  <GameCard cardId={c.cardId} foil={c.foil} level={c.level} evo={c.evo} stats={false} sizes="96px" />
                  {n && <em>{n}</em>}
                </button>
              );
            })}
          </div>
        )}
      </Group>
    </>
  );
}

/* ------------------------------ Блоки профиля ------------------------------ */

function BlocksTab() {
  const [layout, save] = useWidgetLayout();
  const doc = useProgress();
  const has = new Set(layout.map((s) => s.id));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...layout];
    const to = i + dir;
    if (to < 0 || to >= next.length) return;
    [next[i], next[to]] = [next[to], next[i]];
    save(next);
  };
  const add = (id: WidgetId) => save([...layout, { id, w: WIDGET_BY_ID[id].size }]);
  return (
    <>
      <Group
        title={`На профиле · ${layout.length}/${MAX_WIDGETS}`}
        note="Сверху вниз — как увидят гости. Широкий блок занимает всю строку."
      >
        {layout.length === 0 ? (
          <p className="pst-empty">Блоков нет — добавьте их ниже.</p>
        ) : (
          <ol className="pst-blocks">
            {layout.map((slot, i) => {
              const def = WIDGET_BY_ID[slot.id];
              if (!def) return null;
              return (
                <li key={slot.id}>
                  <span className="pst-bi"><WidgetIcon name={def.icon} /></span>
                  <b>{def.title}</b>
                  <div className="pst-seg sm">
                    <button type="button" className={slot.w === "s" ? "is-on" : ""} onClick={() => save(layout.map((s, k) => (k === i ? { ...s, w: "s" } : s)))}>
                      Узкий
                    </button>
                    <button type="button" className={slot.w === "l" ? "is-on" : ""} onClick={() => save(layout.map((s, k) => (k === i ? { ...s, w: "l" } : s)))}>
                      Широкий
                    </button>
                  </div>
                  <div className="pst-ord">
                    <button type="button" aria-label="Выше" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button type="button" aria-label="Ниже" disabled={i === layout.length - 1} onClick={() => move(i, 1)}>↓</button>
                    <button type="button" aria-label="Убрать" className="x" onClick={() => save(layout.filter((_, k) => k !== i))}>×</button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Group>
      {WIDGET_CATS.map((cat) => {
        const free = cat.ids.filter((id) => !has.has(id) && WIDGETS.some((w) => w.id === id));
        if (free.length === 0) return null;
        return (
          <Group key={cat.id} title={`Добавить: ${cat.label.toLowerCase()}`}>
            <div className="pst-addw">
              {free.map((id) => {
                const def = WIDGET_BY_ID[id];
                const open = isWidgetUnlocked(def, doc.purchases);
                return open ? (
                  <button key={id} type="button" disabled={layout.length >= MAX_WIDGETS} onClick={() => add(id)}>
                    <WidgetIcon name={def.icon} />
                    {def.title}
                    <i>+</i>
                  </button>
                ) : (
                  <Link key={id} href="/store" className="is-lock" onClick={closeAllProfileDialogs}>
                    <WidgetIcon name="lock" />
                    {def.title}
                    <i>в магазине</i>
                  </Link>
                );
              })}
            </div>
          </Group>
        );
      })}
      <p className="pst-mini">Содержимое блоков (тексты, арты, тир-лист) настраивается прямо на странице профиля в разделе «Виджеты».</p>
    </>
  );
}

/* ---------------------------------- Окно ---------------------------------- */

export function ProfileStudio() {
  const state = useStudioState();
  const tab: StudioTab = state.tab ?? "look";
  const panelRef = useModalBehaviour(true, closeAllProfileDialogs);
  const meta = TABS.find((t) => t.id === tab) ?? TABS[0];
  // На телефоне разделы — лента чипов: активный держим в поле зрения
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".pst-nav");
    const on = nav?.querySelector<HTMLElement>(".is-on");
    if (nav && on && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: on.offsetLeft - 12, behavior: "smooth" });
  }, [tab]);

  return (
    <div className="pst-ov" onMouseDown={(e) => e.target === e.currentTarget && closeAllProfileDialogs()}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Студия профиля" tabIndex={-1} className="pst">
        <header className="pst-head">
          <div className="pst-title">
            <span className="pst-logo"><WidgetIcon name="pal" /></span>
            <div>
              <h2>Студия профиля</h2>
              <p>Всё применяется сразу — сохранять не нужно</p>
            </div>
          </div>
          <button type="button" className="pst-done" onClick={closeAllProfileDialogs}>
            Готово
          </button>
          <button type="button" className="pst-x" aria-label="Закрыть" onClick={closeAllProfileDialogs}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4"><path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>
        <div className="pst-body">
          <nav className="pst-nav" aria-label="Разделы студии">
            {TABS.map((t) => (
              <button key={t.id} type="button" aria-current={t.id === tab ? "page" : undefined} className={t.id === tab ? "is-on" : ""} onClick={() => setStudioTab(t.id)}>
                <span className="pst-ni"><WidgetIcon name={t.icon} /></span>
                <span className="pst-nt">
                  <b>{t.label}</b>
                  <small>{t.hint}</small>
                </span>
              </button>
            ))}
          </nav>
          <main className="pst-main" key={tab}>
            <h2 className="pst-h">{meta.label}</h2>
            {tab === "look" && <LookTab />}
            {tab === "avatar" && <AvatarTab />}
            {tab === "banner" && <BannerTab />}
            {tab === "badges" && <BadgesTab />}
            {tab === "fx" && <FxTab />}
            {tab === "cards" && <CardsTab />}
            {tab === "blocks" && <BlocksTab />}
          </main>
          <Preview />
        </div>
      </div>
    </div>
  );
}
