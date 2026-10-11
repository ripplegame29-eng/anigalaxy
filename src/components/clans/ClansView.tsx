"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CLAN_COLORS,
  EMBLEMS,
  clanLevel,
  clanLevelProgress,
  clanTier,
  createClan,
  disbandClan,
  allClans,
  levelProgress,
  ownRank,
  searchClans,
  useClans,
  validateClan,
  type Clan,
  type ClansState,
  type CreateClanInput,
} from "@/lib/clans";
import { ClanHall } from "@/components/clans/ClanHall";
import { LevelRing } from "@/components/clans/LevelRing";
import { ClanRoster } from "@/components/clans/ClanRoster";
import { ClanQuests } from "@/components/clans/ClanQuests";
import { ClanBase } from "@/components/clans/ClanBase";
import { ClanSeason } from "@/components/clans/ClanSeason";
import { ClanBattles } from "@/components/clans/ClanBattles";
import { ClanExpeditionView } from "@/components/clans/ClanExpeditionView";
import { ClanRecruit } from "@/components/clans/ClanRecruit";
import { ClanGlory } from "@/components/clans/ClanGlory";
import { ClanShop } from "@/components/clans/ClanShop";
import { ClanTreasury } from "@/components/clans/ClanTreasury";
import { activeBackground } from "@/lib/clans.shop";
import { ClanWallet } from "@/components/clans/ClanWallet";
import { FACTIONS, SPECIALIZATIONS, leagueOf, type ClanFaction } from "@/lib/clans.game";
import {
  SEASON,
  canSwitchSpec,
  recomputeQuests,
  seasonDaysLeft,
  setFaction,
  setSpecialization,
  specOfMember,
  useClanGame,
  type ClanActivity,
  type ClanGameState,
} from "@/lib/clans.runtime";
import { settleWar, syncExpedition, syncRaid, syncWar } from "@/lib/clans.events";
import { applyTerritoryRotation } from "@/lib/clans.social";
import { useProgress } from "@/lib/progression/events";
import { dayIndex, weekIndexOf } from "@/lib/progression/time";

type Tab =
  | "own"
  | "roster"
  | "quests"
  | "battle"
  | "expedition"
  | "shop"
  | "vault"
  | "base"
  | "glory"
  | "clans";

/**
 * Модалка монтируется порталом в `document.body`.
 *
 * Разметка раздела живёт внутри контейнера с OwnLayout, и поверх неё есть
 * футер и липкая шапка: даже при `position: fixed` прокрутка страницы уводила
 * содержимое модалки под них. Портал снимает вопрос целиком — оверлей
 * всегда последний слой, а прокрутка работает внутри карточки.
 */
function Modal({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Оверлей открывается только по клику, то есть на сервере его не бывает —
  // отдельный флаг монтирования не нужен
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="cl-ov"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Секции появляются по мере прокрутки — тот же приём, что в боевом пропуске */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -4% 0px" },
    );
    nodes.forEach((node) => io.observe(node));
    return () => io.disconnect();
  });
  return ref;
}

/** Точка-разделитель тысяч */
function num(value: number): string {
  return value.toLocaleString("ru-RU");
}

/**
 * Активность сайта для клановых заданий.
 *
 * Источник — документ прогрессии, а не отдельный клан��вый счётчик: серии,
 * достижения и оценки уже считаются движком сайта. Собственный счётчик
 * здесь означал бы, что одно и то же действие учитывается дважды.
 *
 * Синхронизация идёт в эффекте по документу прогрессии: то есть ровно
 * после реального действия на сайте, а не по таймеру.
 */
function useClanActivity(): void {
  const doc = useProgress();
  const tz = doc.progress.tz;

  useEffect(() => {
    const today = dayIndex(Date.now(), tz);
    // Дневные счётчики документа относятся к тому дню, когда он последний
    // раз обновлялся движком: без этой проверки вчерашние серии засчитались бы
    // как сегодняшние и задание закрывалось бы само
    const fresh = doc.daily.date === today;
    const freshWeek = fresh && doc.daily.week === weekIndexOf(today);
    const counts = fresh ? doc.daily.counts : {};
    const weekCounts = freshWeek ? doc.daily.weekCounts : {};

    const activity: ClanActivity = {
      episodesDay: counts.EP_COMPLETE ?? 0,
      episodesWeek: weekCounts.EP_COMPLETE ?? 0,
      achievements: Object.keys(doc.achievements).length,
      distinctToday: Object.values(counts).filter((n) => n > 0).length,
    };

    recomputeQuests(activity);
    // Война, рейд и поход считаются из того же снимка активности: свой
    // счётчик у каждой механики означал бы три способа накрутить вместо
    // одного общего, за которым стоит движок сайта
    syncWar(activity);
    syncRaid(activity);
    syncExpedition(activity);
  }, [doc, tz]);
}

/**
 * Пересчёт войны по тику таймера.
 *
 * Очки соперника растут со временем, а не по действиям игрока: без
 * отдельного тика шкала войны замирала бы на всё время, пока игрок сидит
 * на странице.
 */
/**
 * Еженедельная ротация территорий.
 *
 * Ключ всторо лежит в сторе, поэтому смена недели ноче записатьв об удалённым участником.
 */
function useTerritoryRotation(): void {
  useEffect(() => {
    applyTerritoryRotation();
  }, []);
}

function useWarClock(): void {
  const game = useClanGame();
  useEffect(() => {
    const war = game.war;
    if (!war) return;
    if (!war.winner && Date.now() >= war.endsAt) settleWar();
    const id = window.setInterval(() => settleWar(), 60_000);
    return () => window.clearInterval(id);
  }, [game.war]);
}

/* ------------------------------------------------------------------ */
/* Мелкие части                                                        */
/* ------------------------------------------------------------------ */

/** Эмблема в медальоне цвета клана */
function Emblem({ clan, size = 56 }: { clan: Pick<Clan, "emblem" | "color">; size?: number }) {
  return (
    <span
      className="cl-emblem"
      style={{ width: size, height: size, fontSize: size * 0.46, ["--c" as string]: clan.color }}
      aria-hidden
    >
      {/* Кольцо-обводка: как знак достоинства */}
      <i className="rim" />
      {clan.emblem}
    </span>
  );
}

/** Строка клана в каталоге и топе */
function ClanRow({ clan, rank, onOpen }: { clan: Clan; rank: number; onOpen: (c: Clan) => void }) {
  const tier = clanTier(clan.points);
  const level = clanLevel(clan.points);
  return (
    <li data-reveal className="cl-reveal">
      <button
        type="button"
        onClick={() => onOpen(clan)}
        className={`cl-card ${clan.mine ? "mine" : ""}`}
        style={{ ["--c" as string]: clan.color, ["--c2" as string]: tier.color }}
      >
        <div className="flex items-center gap-3">
          <span className={`cl-rank ${rank <= 3 ? "top" : ""}`}>{rank}</span>
          <Emblem clan={clan} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-white">{clan.name}</span>
              <span className="cl-tag">[{clan.tag}]</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted">
              {tier.name} · ур. {level} · {clan.memberCount} уч.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-accent text-base font-extrabold tabular-nums text-white">
              {num(clan.points)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted">очков</div>
          </div>
        </div>

        <div className="mt-3">
          <div
            className="cl-bar"
            style={{ ["--p" as string]: Math.round(clanLevelProgress(clan.points) * 100) }}
          >
            <i />
          </div>
        </div>
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Модалка создания                                                    */
/* ------------------------------------------------------------------ */

function CreateModal({ state, onClose }: { state: ClansState; onClose: () => void }) {
  const [form, setForm] = useState<CreateClanInput>({
    name: "",
    tag: "",
    emblem: EMBLEMS[0],
    color: CLAN_COLORS[0],
    description: "",
  });
  const [touched, setTouched] = useState(false);
  const [faction, setFactionState] = useState<ClanFaction>("sword");

  const rivalTags = useMemo(() => allClans(state).map((c) => c.tag), [state]);
  const errors = validateClan(form, state, rivalTags);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const submit = () => {
    setTouched(true);
    if (errors.length > 0) return;
    createClan(form);
    // Фракция живёт в игровом слое, а не в записи клана: она меняется
    // в сезоне и не должна быть частью описания самого клана
    setFaction(faction);
    onClose();
  };

  return (
    <Modal label="Создать клан" onClose={onClose}>
      <div className="cl-panel cl-mdl" style={{ ["--c" as string]: form.color }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-accent text-xl font-extrabold">Создать клан</h2>
            <p className="mt-1 text-xs text-muted">
              Название и метка видны всем, цвет и эмблема — только тебе
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="cl-btn ghost sm !px-2.5 !py-1.5">
            ✕
          </button>
        </div>

        <div className="grid gap-4">
          <label className="block">
            <span className="cl-lbl">Название</span>
            <input
              className="cl-in"
              value={form.name}
              maxLength={24}
              placeholder="Ночной дозор"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={() => setTouched(true)}
              style={{ ["--c" as string]: form.color }}
            />
          </label>

          <label className="block">
            <span className="cl-lbl">Метка в скобках</span>
            <input
              className="cl-in"
              value={form.tag}
              maxLength={4}
              placeholder="НДЗ"
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
              onBlur={() => setTouched(true)}
              style={{ ["--c" as string]: form.color }}
            />
          </label>

          <div>
            <span className="cl-lbl">Эмблема</span>
            <div className="flex flex-wrap gap-2">
              {EMBLEMS.map((emblem) => (
                <button
                  key={emblem}
                  type="button"
                  aria-pressed={form.emblem === emblem}
                  aria-label={`Эмблема ${emblem}`}
                  className="cl-chip"
                  onClick={() => setForm({ ...form, emblem })}
                  style={{ ["--c" as string]: form.color }}
                >
                  {emblem}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="cl-lbl">Цвет</span>
            <div className="flex flex-wrap gap-2">
              {CLAN_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-pressed={form.color === color}
                  aria-label={`Цвет ${color}`}
                  className="cl-chip !text-base"
                  style={{
                    ["--c" as string]: color,
                    background: color,
                    boxShadow: form.color === color ? "inset 0 0 0 2px #fff" : undefined,
                  }}
                  onClick={() => setForm({ ...form, color })}
                >
                  {form.color === color ? "✓" : ""}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="cl-lbl">Фракция</span>
            <div className="flex flex-wrap gap-2">
              {FACTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={faction === item.id}
                  title={item.perk}
                  className="cl-pick"
                  onClick={() => setFactionState(item.id)}
                  style={{
                    ["--c" as string]: item.color,
                    ...(faction === item.id
                      ? { background: `${item.color}33`, boxShadow: `inset 0 0 0 1px ${item.color}` }
                      : {}),
                  }}
                >
                  {item.glyph} {item.name}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">{FACTIONS.find((f) => f.id === faction)?.perk}</p>
          </div>

          <label className="block">
            <span className="cl-lbl">Девиз или описание</span>
            <textarea
              className="cl-in min-h-[72px] resize-y"
              value={form.description}
              maxLength={160}
              placeholder="Смотрим до конца, читаем по две главы"
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{ ["--c" as string]: form.color }}
            />
          </label>

          {touched && errors.length > 0 && (
            <ul className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-400/30">
              {errors.map((error) => (
                <li key={error}>• {error}</li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={errors.length > 0}
            className="cl-btn w-full"
            style={{ ["--c" as string]: form.color }}
          >
            Создать клан
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Модалка клана                                                       */
/* ------------------------------------------------------------------ */

function ClanModal({ clan, rank, onClose }: { clan: Clan; rank: number; onClose: () => void }) {
  const tier = clanTier(clan.points);
  const level = clanLevel(clan.points);
  const progress = Math.round(clanLevelProgress(clan.points) * 100);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <Modal label={clan.name} onClose={onClose}>
      <div className="cl-panel cl-mdl" style={{ ["--c" as string]: clan.color, ["--c2" as string]: tier.color }}>
        <div className="flex items-start gap-4">
          <Emblem clan={clan} size={72} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-accent truncate text-xl font-extrabold">{clan.name}</h2>
              <span className="cl-tag">[{clan.tag}]</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {tier.name} · уровень {level} · место #{rank} · {clan.memberCount} уч.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="cl-btn ghost sm !px-2.5 !py-1.5">
            ✕
          </button>
        </div>

        {clan.description && (
          <p className="mt-4 text-sm leading-relaxed text-bright/80">{clan.description}</p>
        )}

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Очки", value: num(clan.points) },
            { label: "Уровень", value: String(level) },
            { label: "Участники", value: String(clan.memberCount) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-white/5 px-2 py-2.5 ring-1 ring-white/10">
              <div className="font-accent text-lg font-extrabold tabular-nums">{item.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs text-muted">
            <span>До уровня {level + 1}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="cl-bar" style={{ ["--p" as string]: progress }}>
            <i />
          </div>
        </div>

        <button type="button" onClick={onClose} className="cl-btn mt-5 w-full">
          Закрыть
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Раздел «Мой клан»                                                   */
/* ------------------------------------------------------------------ */

function OwnTab({
  state,
  game,
  onCreate,
  onDisband,
}: {
  state: ClansState;
  game: ClanGameState;
  onCreate: () => void;
  onDisband: () => void;
}) {
  const progress = useProgress();
  const ac = progress.progress.acBalance;
  const [note, setNote] = useState("");
  const mySpec = specOfMember(game, "self");
  const specOpen = canSwitchSpec(game);

  if (!state.own) {
    return (
      <section data-reveal className="cl-reveal cl-panel p-6 text-center sm:p-10">
        <span className="cl-emblem mx-auto" style={{ width: 76, height: 76, fontSize: 34, ["--c" as string]: "var(--color-accent)" }} aria-hidden>
          🛡
        </span>
        <h2 className="mt-4 font-accent text-xl font-extrabold">Ты пока не в клане</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Оснуй клан, зови друзей и поднимайтесь в общем топе. Очки клана идут
          от вкладов — их вносишь валютой, а она растёт за просмотр серий, квесты
          и боевой пропуск.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="cl-btn mt-5"
          style={{ ["--c" as string]: "var(--color-accent)" }}
        >
          Создать клан
        </button>
      </section>
    );
  }

  const clan = state.own;
  const tier = clanTier(clan.points);
  const level = clan.level;
  const progressPct = Math.round(levelProgress(clan.cells) * 100);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
      <div className="grid gap-4">
      {/* Карточка клана */}
      <section
        data-reveal
        className="cl-reveal cl-panel p-5 sm:p-6"
        style={{ ["--c" as string]: clan.color, ["--c2" as string]: tier.color }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <Emblem clan={clan} size={72} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-accent truncate text-2xl font-extrabold">{clan.name}</h2>
              <span className="cl-tag">[{clan.tag}]</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {tier.name} · уровень {level} · место #{ownRank(state)} · {clan.memberCount} уч.
            </p>
          </div>
          <LevelRing clan={clan} />
        </div>

        {clan.description && (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-bright/80">{clan.description}</p>
        )}

        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs text-muted">
            <span>До уровня {level + 1}</span>
            <span className="tabular-nums">{progressPct}%</span>
          </div>
          <div className="cl-bar" style={{ ["--p" as string]: progressPct }}>
            <i />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Очки", value: num(clan.points) },
            { label: "Внесено", value: num(state.contributed) },
            { label: "Участники", value: String(clan.memberCount) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-white/5 px-2 py-2.5 ring-1 ring-white/10">
              <div className="font-accent text-lg font-extrabold tabular-nums">{item.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted">{item.label}</div>
            </div>
          ))}
        </div>
      </section>


      {/* Ресурсы клана: четыре несмешиваемых показателя */}
      <section data-reveal className="cl-reveal cl-panel p-5" style={{ ["--c" as string]: clan.color }}>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-accent text-sm font-extrabold uppercase tracking-wider text-muted">
            Ресурсы клана
          </h3>
          <span className="text-xs text-muted">наведи, чтобы увидеть, куда они тратятся</span>
        </div>
        <ClanWallet purse={game.purse} />
      </section>

      {/* Специализация игрока */}
      <section data-reveal className="cl-reveal cl-panel p-5" style={{ ["--c" as string]: "#b06bff" }}>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-accent text-sm font-extrabold uppercase tracking-wider text-muted">
            Твоя специализация
          </h3>
          <span className="text-xs text-muted">определяет твой вклад в экспедиции</span>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {SPECIALIZATIONS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={!specOpen}
                aria-pressed={mySpec === item.id}
                title={item.perk}
                className="cl-building w-full text-left"
                style={{
                  ["--c" as string]: "#b06bff",
                  ...(mySpec === item.id ? { boxShadow: "inset 0 0 0 1px #b06bff", background: "#b06bff1a" } : {}),
                }}
                onClick={() => {
                  const result = setSpecialization("self", item.id);
                  setNote(result.ok ? `Специализация: ${item.name}` : (result.reason ?? "Не удалось"));
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="cl-building-glyph" aria-hidden>{item.glyph}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-sm text-white">{item.name}</b>
                    <em className="block text-xs not-italic text-muted">{item.perk}</em>
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
        {!specOpen && (
          <p className="mt-2 text-xs text-muted">Менять специализацию можно раз в сутки.</p>
        )}
        {note && <p className="cl-toast mt-3" role="status">{note}</p>}
      </section>
      </div>

      {/* Зал клана: на широком экране — колонка справа, на узком — под карточкой */}
      <ClanHall clan={clan} ac={ac} />

      <button
        type="button"
        onClick={() => {
          if (window.confirm("Распустить клан? Очки и вклад сгореют.")) onDisband();
        }}
        className="w-full text-center text-[11px] text-muted underline underline-offset-2 transition-colors hover:text-red-300"
      >
        Распустить клан
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Корень раздела                                                      */
/* ------------------------------------------------------------------ */

export function ClansView() {
  const state = useClans();
  const game = useClanGame();
  // Задания клана считаются по документу прогрессии сайта
  useClanActivity();
  // Матч сам заканчивается по часам — без тика он не рассчитается сам
  useWarClock();
  // Каждую неделю часть территорий относит старых кланов
  useTerritoryRotation();
  // По умолчанию — «Мой клан»: там либо карточка клана, либо приглашение
  // создать его. Поиск открывать с пустым состоянием бессмысленно.
  const [tab, setTab] = useState<Tab>("own");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [opened, setOpened] = useState<Clan | null>(null);
  const [confirmDisband, setConfirmDisband] = useState(false);
  const root = useReveal();

  // Клан появился — сразу показываем его, а не пустое состояние.
  // Переключение делаем в обработчике создания, а не в эффекте:
  // setState внутри эффекта линтер проекта считает лишним рендером.
  const onCreated = () => {
    setCreating(false);
    setTab("own");
  };

  const ranked = useMemo(() => allClans(state), [state]);
  const found = useMemo(() => searchClans(state, query), [state, query]);
  const ranks = useMemo(() => {
    const map = new Map<string, number>();
    ranked.forEach((clan, i) => map.set(clan.id, i + 1));
    return map;
  }, [ranked]);

  const TABS: { id: Tab; label: string }[] = [
    { id: "own", label: "Мой клан" },
    { id: "roster", label: "Состав" },
    { id: "quests", label: "Задания" },
    { id: "battle", label: "Война" },
    { id: "expedition", label: "Поход" },
    { id: "shop", label: "Магазин" },
    { id: "vault", label: "Сокровищница" },
    { id: "base", label: "База" },
    { id: "glory", label: "Слава" },
    { id: "clans", label: "Кланы" },
  ];

  const league = leagueOf(state.own?.points ?? 0);
  const daysLeft = seasonDaysLeft();

  /* Полоса из 10 вкладок на телефоне шире экрана примерно втрое, а полосу
     прокрутки мы спрятали: справа было просто обрезанное «Война», и
     выглядело так, будто кнопок нет. Теперь по краям ленты появляется
     затемнение — «здесь ещё есть» — и оно гаснет у конца. */
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [tabsEdge, setTabsEdge] = useState<"none" | "start" | "end" | "both">("none");

  const syncTabsEdge = () => {
    const el = tabsRef.current;
    if (!el) return;
    const slack = el.scrollWidth - el.clientWidth;
    if (slack <= 2) {
      setTabsEdge("none");
      return;
    }
    const atStart = el.scrollLeft <= 2;
    const atEnd = el.scrollLeft >= slack - 2;
    setTabsEdge(atStart ? (atEnd ? "none" : "start") : atEnd ? "end" : "both");
  };

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    syncTabsEdge();
    el.addEventListener("scroll", syncTabsEdge, { passive: true });
    window.addEventListener("resize", syncTabsEdge);
    return () => {
      el.removeEventListener("scroll", syncTabsEdge);
      window.removeEventListener("resize", syncTabsEdge);
    };
  }, []);

  /* Активная вкладка всегда в кадре: переключил — и сразу её видно.
     Скроллим только саму ленту, а не страницу, поэтому scrollIntoView
     не годится — он дёрнул бы и документ. */
  useEffect(() => {
    const el = tabsRef.current;
    const active = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !active) return;
    const box = el.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    if (rect.left >= box.left && rect.right <= box.right) return;
    el.scrollTo({
      left: active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, [tab]);

  return (
    <div
      className="cl-page"
      ref={root}
      style={state.own ? (activeBackground(game).css
        ? { background: activeBackground(game).css, backgroundSize: activeBackground(game).backgroundSize }
        : undefined) : undefined}
    >
      {/* Затемнение под текст: без него яркий фон съедал бы заголовки */}
      {state.own && activeBackground(game).veil && (
        <div className="cl-page-veil" style={{ background: activeBackground(game).veil }} aria-hidden />
      )}
      {/* Фон раздела: зарева цвета клана и гербовник — как на боевом пропуске */}
      <div className="cl-bg" style={{ ["--c" as string]: state.own?.color ?? "var(--color-accent)" }} aria-hidden />
      <div className="cl-grid" aria-hidden />

      {/* Шапка */}
      <header className="cl-panel mb-6 p-5 sm:p-7" style={{ ["--c" as string]: state.own?.color ?? "var(--color-accent)" }}>
        <div className="flex flex-wrap items-center gap-4">
          {state.own ? (
            <Emblem clan={state.own} size={64} />
          ) : (
            <span
              className="cl-emblem"
              style={{ width: 64, height: 64, fontSize: 28, ["--c" as string]: "var(--color-accent)" }}
              aria-hidden
            >
              🛡
            </span>
          )}
          {/* basis-48: без него flex-1 сжимает текст до нуля и кнопка
              «Создать клан» никогда не переносится — на 390px заголовок
              рассыпался в колонку из двух слов */}
          <div className="min-w-0 flex-1 basis-48">
            <p className="cl-lbl !mb-1">Кланы · сезон 01</p>
            <h1 className="font-accent text-2xl font-extrabold tracking-tight sm:text-3xl">
              {state.own ? state.own.name : "Кланы"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {state.own
                ? `${clanTier(state.own.points).name} · ${num(state.own.points)} очков · место #${ownRank(state)}`
                : "Объединяйся с друзьями, копи очки и поднимайся в общем топе"}
            </p>
          </div>
          {!state.own && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="cl-btn w-full sm:w-auto"
              style={{ ["--c" as string]: "var(--color-accent)" }}
            >
              Создать клан
            </button>
          )}
        </div>

        {/* Полоса сезона: лига и остаток — главные числа раздела */}
        {state.own && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="cl-season-chip">
              Сезон {String(SEASON.number).padStart(2, "0")} · {SEASON.name}
            </span>
            <span className="cl-season-chip" style={{ color: league.color }}>
              {league.name}
            </span>
            <span className="cl-season-chip">
              {daysLeft} {daysLeft === 1 ? "день" : daysLeft < 5 ? "дня" : "дней"} до конца сезона
            </span>
          </div>
        )}

        {/* Вкладки */}
        <div className="cl-tabs-wrap" data-edge={tabsEdge}>
          <div className="cl-tabs" role="tablist" ref={tabsRef}>
            {TABS.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`cl-btn sm ${tab === item.id ? "" : "ghost"}`}
                style={tab === item.id ? { ["--c" as string]: state.own?.color ?? "var(--color-accent)" } : undefined}
              >
                {item.label}
                {item.id === "own" && !state.own && (
                  <span className="rounded-md bg-white/10 px-1 text-[10px]">—</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Содержимое вкладки */}
      {tab === "own" && (
        <OwnTab
          state={state}
          game={game}
          onCreate={() => setCreating(true)}
          onDisband={() => setConfirmDisband(true)}
        />
      )}

      {/* Остальные вкладки живут только у своего клана: пустой состав,
          пустая база и нулевые задания читались бы как поломка */}
      {tab !== "own" && !state.own && (
        <section className="cl-reveal cl-panel p-8 text-center" data-reveal>
          <p className="text-sm text-muted">
            Этот раздел появится вместе с кланом. Создай его на вкладке «Мой клан».
          </p>
        </section>
      )}

      {tab === "roster" && state.own && (
        <>
          <ClanRoster clan={state.own} game={game} />
          <div className="mt-4">
            <ClanRecruit clan={state.own} game={game} />
          </div>
        </>
      )}

      {tab === "quests" && state.own && <ClanQuests clan={state.own} game={game} />}

      {tab === "battle" && state.own && <ClanBattles clan={state.own} />}

      {tab === "expedition" && state.own && <ClanExpeditionView clan={state.own} game={game} />}

      {tab === "base" && state.own && (
        <>
          <ClanSeason clan={state.own} game={game} />
          <div className="mt-4">
            <ClanBase clan={state.own} game={game} />
          </div>
        </>
      )}

      {tab === "shop" && state.own && <ClanShop clan={state.own} game={game} />}

      {tab === "vault" && state.own && <ClanTreasury clan={state.own} game={game} />}

      {tab === "glory" && state.own && <ClanGlory clan={state.own} game={game} />}

      {/*
        Поиск и топ — один каталог. Раньше это было двя экрана, и вторая собранение
        была не чисто вокладка: чистый поиск выдаёт пустой экран рейтинга, а топ показывает всегда. Переключается одна шкала: чем
        один элемент водит и понимание оказывается вместо с него.
      */}
      {tab === "clans" && (
        <section>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              className="cl-in !w-full sm:!w-72"
              value={query}
              placeholder="Поиск по названию, метке или описанию"
              onChange={(event) => setQuery(event.target.value)}
              style={{ ["--c" as string]: state.own?.color ?? "var(--color-accent)" }}
            />
            <span className="text-xs text-muted">
              {found.length} из {ranked.length}
            </span>
            <span className="text-xs text-muted">
              {query ? "содержим по очкам" : "по уменьшению очков"}
            </span>
          </div>

          {found.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-white/[0.02] px-5 py-12 text-center text-sm text-muted">
              Ничего не нашлось. Попробуй другую метку — например, первые буквы названия.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {found.map((clan) => (
                <ClanRow key={clan.id} clan={clan} rank={ranks.get(clan.id) ?? 0} onOpen={setOpened} />
              ))}
            </ul>
          )}
        </section>
      )}

      {creating && <CreateModal state={state} onClose={state.own ? () => setCreating(false) : onCreated} />}

      {opened && (
        <ClanModal clan={opened} rank={ranks.get(opened.id) ?? 0} onClose={() => setOpened(null)} />
      )}

      {confirmDisband && (
        <Modal label="Распустить клан" onClose={() => setConfirmDisband(false)}>
          <div className="cl-panel cl-mdl !max-w-sm">
            <h2 className="font-accent text-lg font-extrabold">Распустить клан?</h2>
            <p className="mt-2 text-sm text-muted">
              Клан «{state.own?.name}» перестанет существовать, очки и вклад сгорят. Отменить нельзя.
            </p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setConfirmDisband(false)} className="cl-btn ghost flex-1">
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  disbandClan();
                  setConfirmDisband(false);
                }}
                className="cl-btn flex-1"
                style={{ ["--c" as string]: "#ff4d6d" }}
              >
                Распустить
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}