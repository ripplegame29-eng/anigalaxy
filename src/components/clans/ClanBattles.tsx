"use client";

import { useEffect, useMemo, useState } from "react";
import { BOSS } from "@/lib/clans.game";
import { clanTier, type Clan } from "@/lib/clans";
import {
  RAID_PHASE,
  WAR_TARGET,
  claimPhase,
  phaseReward,
  raidView,
  settleWar,
  startWar,
  warCandidates,
  warView,
  type Matchup,
  type WarCandidate,
} from "@/lib/clans.events";
import { PREMIUM_CLAN_MULT } from "@/lib/premium-perks";
import { num } from "./ClanWallet";

/**
 * Война и рейд.
 *
 * Обе механики живут на одном экране не случайно: обе бьют по одной шкале
 * «сколько ты сделал на сайте за период». Разводить их по разным вкладкам
 * значило бы заставить игрока держать в голове, что сегодня считается дважды.
 */

/** Глифы задач матча — те же знаки, что и в описаниях, чтобы не искать */
const TASK_GLYPH: Record<string, string> = {
  "war-manga": "📖",
  "war-episodes": "🎬",
  "war-quests": "✅",
};

/** Подпись разницы соперника: близко ли он по силе */
const MATCHUP_LABEL: Record<Matchup, string> = {
  even: "ровня",
  easier: "слабее нас",
  harder: "сильнее нас",
};

/** Сколько часов в строке читать как «осталось» */
function hoursLabel(hours: number): string {
  if (hours <= 0) return "матч завершён";
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  if (d > 0) return `${d} дн. ${h} ч.`;
  return `${h} ч.`;
}

/** «3 мин. назад» для ленты матча */
function ago(at: number, now: number): string {
  const m = Math.max(0, Math.round((now - at) / 60_000));
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин. назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч. назад`;
  return `${Math.round(h / 24)} дн. назад`;
}

export function ClanBattles({ clan }: { clan: Clan }) {
  // Матч и рейд считаются по времени: срез нужен на каждой секунде, а не только
  // при смене состояния, иначе обратный отсчёт «замирал» бы
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="grid gap-4">
      <WarPanel clan={clan} now={now} />
      <RaidPanel now={now} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Война                                                                */
/* ------------------------------------------------------------------ */

function WarPanel({ clan, now }: { clan: Clan; now: number }) {
  const view = warView(now, clan.points);
  // Ошибки и подтверждения живут здесь, а не в warView: то, что матч
  // объявлен вручную или выбран соперник, — состояние интерфейса.
  const [message, setMessage] = useState("");
  const [picker, setPicker] = useState(false);

  const say = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3000);
  };

  const declare = (opponentId?: string) => {
    const result = startWar(clan, now, opponentId);
    if (result.ok) {
      setPicker(false);
      say("Война объявлена");
    } else {
      say(result.reason ?? "Не удалось");
    }
  };

  if (!view) {
    return (
      <section
        data-reveal
        className="cl-reveal cl-panel cl-war p-5 sm:p-6"
        style={{ ["--c" as string]: clan.color }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="cl-lbl !mb-1">Режим боя</p>
            <h2 className="font-accent text-xl font-extrabold">Война кланов</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
              Матч длится 48 часов. Оба клана получают одинаковый набор заданий из
              реальной активности на сайте: главы, серии и закрытые задания. Побеждает
              тот, кто первым взял рубеж — в этом порядке, без ничьих по лимиту
              времени.
            </p>
          </div>
          <div className="text-right">
            <p className="cl-lbl !mb-1">Рубеж</p>
            <p className="font-accent text-2xl font-extrabold tabular-nums">{num(WAR_TARGET)}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="cl-btn"
            style={{ ["--c" as string]: clan.color }}
            onClick={() => declare()}
          >
            Объявить войну · автоподбор
          </button>
          <button
            type="button"
            className="cl-btn ghost"
            aria-expanded={picker}
            onClick={() => setPicker((v) => !v)}
          >
            {picker ? "Свернуть поиск" : "Выбрать соперника"}
          </button>
        </div>

        {picker && (
          <div className="cl-war-pick">
            <WarPicker clan={clan} onPick={declare} />
          </div>
        )}

        {message && (
          <p className="cl-toast mt-3" role="status">
            {message}
          </p>
        )}
      </section>
    );
  }

  const pct = Math.min(100, Math.round((view.mine / view.war.target) * 100));
  const rivalPct = Math.min(100, Math.round((view.theirs / view.war.target) * 100));
  const lead = view.lead;
  const totalHours = Math.round((view.war.endsAt - view.war.startedAt) / 3_600_000);

  return (
    <section
      data-reveal
      className={`cl-reveal cl-panel cl-war p-5 sm:p-6 ${view.winner ?? ""}`}
      style={{ ["--c" as string]: clan.color, ["--c2" as string]: view.rival?.color ?? "#ff4d6d" }}
    >
      {/* Статус и шкала времени: сколько матча уже прошло */}
      <div className="cl-war-head flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="cl-lbl !mb-1">
            Режим боя · {view.winner ? "матч завершён" : "идёт матч"} · матч №{view.war.index}
          </p>
          <h2 className="font-accent text-xl font-extrabold">Дуэль кланов</h2>
          <p className="mt-1 text-sm text-muted">
            соперник {view.pickedBy === "Ты" ? "выбран вручную" : "подобран автоматически"} ·
            рубеж {num(view.war.target)} очков
          </p>
        </div>
        <div className="text-right">
          <p className="cl-lbl !mb-1">{view.live ? "До конца" : "Длительность"}</p>
          <p className="font-accent text-2xl font-extrabold tabular-nums">
            {hoursLabel(view.hoursLeft)}
          </p>
        </div>
      </div>

      <div className="cl-war-clock" style={{ ["--p" as string]: Math.round(view.elapsed * 100) }}>
        <i />
        <span className="start">{hoursLabel(totalHours)}</span>
        <span className="end">{view.live ? hoursLabel(view.hoursLeft) : "итог"}</span>
      </div>

      {/* Две стороны друг напротив друга: без них «кто ведёт» не читается */}
      <DuelSide clan={clan} score={view.mine} pct={pct} side="mine" lead={lead === "mine"} />

      <div className="cl-war-clash" aria-hidden>
        <i />
        <b>⚔</b>
        <i />
      </div>

      <DuelSide
        clan={view.rival}
        fallback="Соперник неизвестен"
        score={view.theirs}
        pct={rivalPct}
        side="theirs"
        lead={lead === "theirs"}
      />

      {view.winner && (
        <p className="cl-war-result" role="status">
          {view.winner === "mine"
            ? `Победа. Касса пополнена: +${num(view.stakes.influence)} влияния и +${num(view.stakes.prestige)} престижа.`
            : view.winner === "draw"
              ? "Ничья — награда уменьшенная, но не обнулилась."
              : "Поражение. За участие начислен только престиж."}
        </p>
      )}

      {/* Ставки: сколько получает каждая сторона — видно до расчёта */}
      <div className="cl-war-stakes">
        <div>
          <span className="cl-lbl !mb-1">Ставка за победу</span>
          <p className="text-sm text-white">
            +{num(view.stakes.influence)} влияния · +{num(view.stakes.prestige)} престижа
          </p>
        </div>
        <div>
          <span className="cl-lbl !mb-1">Отставание</span>
          <p className="text-sm text-white tabular-nums">
            {num(Math.max(0, view.theirs - view.mine))} очков
          </p>
        </div>
        {view.premiumBoost && (
          <div>
            <span className="cl-lbl !mb-1">Ставка заданий</span>
            <p className="text-sm font-semibold text-gold">×{PREMIUM_CLAN_MULT} за единицу</p>
          </div>
        )}
      </div>

      {/* Задачи — это и есть «бой»: они объясняют, откуда берутся очки */}
      <h3 className="cl-lbl mt-6">Задачи матча</h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {view.war.tasks.map((task) => {
          const done = task.progress >= task.goal;
          const share = view.war.target > 0 ? Math.round((task.progress * task.rate * 100) / view.war.target) : 0;
          return (
            <li key={task.id} className={`cl-war-task${done ? " done" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="cl-war-task-glyph" aria-hidden>
                  {TASK_GLYPH[task.id] ?? "◈"}
                </span>
                <span className="text-sm font-semibold text-white">{task.name}</span>
              </div>
              <p className="mt-1.5 text-xs tabular-nums text-muted">
                {num(task.progress)} / {num(task.goal)} {task.unit} · +{task.rate} за единицу
              </p>
              <div
                className="cl-bar mt-2"
                style={{ ["--p" as string]: Math.min(100, Math.round((task.progress / task.goal) * 100)) }}
              >
                <i />
              </div>
              <p className="mt-1.5 text-[11px] text-muted">
                {done ? "задача закрыта" : `до закрытия ${num(task.goal - task.progress)} ${task.unit}`} ·{" "}
                {share}% рубежа
              </p>
            </li>
          );
        })}
      </ul>

      {/* Лента матча */}
      {view.feed.length > 0 && (
        <>
          <h3 className="cl-lbl mt-6">Ход матча</h3>
          <ul className="cl-war-feed mt-2">
            {view.feed
              .slice()
              .reverse()
              .map((entry, i) => (
                <li key={`${entry.at}-${i}`}>
                  <span className="cl-log-when">{ago(entry.at, now)}</span>
                  <span className="cl-log-text">{entry.text}</span>
                </li>
              ))}
          </ul>
        </>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {view.live && (
          <button
            type="button"
            className="cl-btn sm ghost"
            onClick={() => {
              const result = settleWar();
              say(result.ok ? "Итог подсчитан" : "Матч ещё не завершён");
            }}
          >
            Подсчитать итог
          </button>
        )}
        {!view.winner && (
          <button
            type="button"
            className="cl-btn sm ghost"
            aria-expanded={picker}
            onClick={() => setPicker((v) => !v)}
          >
            {picker ? "Свернуть поиск" : "Выбрать другого соперника"}
          </button>
        )}
        {!view.winner && (
          <button
            type="button"
            className="cl-btn sm"
            style={{ ["--c" as string]: clan.color }}
            onClick={() => declare()}
          >
            Новый матч · автоподбор
          </button>
        )}
      </div>

      {picker && (
        <div className="cl-war-pick">
          <WarPicker clan={clan} onPick={declare} />
        </div>
      )}

      {message && (
        <p className="cl-toast mt-3" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

/** Сторона дуэли: эмблема, кто это, счёт и доля рубежа */
function DuelSide({
  clan,
  fallback,
  score,
  pct,
  side,
  lead,
}: {
  clan: Clan | null;
  fallback?: string;
  score: number;
  pct: number;
  side: "mine" | "theirs";
  lead: boolean;
}) {
  const tier = clan ? clanTier(clan.points) : null;
  return (
    <div className={`cl-duel-side ${side}${lead ? " lead" : ""}`}>
      <span className="cl-emblem" style={{ width: 52, height: 52, fontSize: 24, ["--c" as string]: clan?.color ?? "#8b93a7" }} aria-hidden>
        <i className="rim" />
        {clan?.emblem ?? "?"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-accent text-lg font-extrabold text-white">
          {clan?.name ?? fallback}
          {clan?.tag ? <span className="ml-1.5 text-xs font-bold text-muted">[{clan.tag}]</span> : null}
        </p>
        <p className="truncate text-xs text-muted">
          {tier ? `${tier.name} · ` : ""}
          {num(clan?.points ?? 0)} очков · {clan?.memberCount ?? 0} уч.
        </p>
        <div className="cl-bar mt-2" style={{ ["--p" as string]: pct }}>
          <i />
        </div>
        <p className="mt-1 text-xs tabular-nums text-muted">
          {num(score)} очков · {pct}% рубежа
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Поиск соперника                                                      */
/* ------------------------------------------------------------------ */

/**
 * Поиск клана для войны.
 *
 * Раньше соперника подбирала система, и выбрать конкретного было нельзя:
 * ни посмотреть, кто вообще может стать противником, ни решить, что нужен
 * принципиально равный по очкам сосед из топа, а не тот, кто случайно
 * оказался ближе. Список показывает разницу в силе и ставку за победу —
 * выбор становится осмысленным, а не лотереей.
 */
function WarPicker({ clan, onPick }: { clan: Clan; onPick: (opponentId: string) => void }) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => warCandidates(clan, query), [clan, query]);

  return (
    <div>
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск клана: название или метка…"
          aria-label="Поиск клана для войны"
          className="w-full rounded-xl bg-white/6 py-2.5 pl-9 pr-3 text-sm font-semibold text-white ring-1 ring-white/10 transition placeholder:text-muted/70 focus:outline-none focus:ring-accent/60"
        />
      </div>

      {list.length === 0 ? (
        <p className="mt-3 text-xs text-muted">Никого не нашлось — попробуй часть названия или метки.</p>
      ) : (
        <ul className="cl-war-cands mt-3">
          {list.map((item) => (
            <CandidateRow key={item.clan.id} item={item} onPick={onPick} />
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Один матч в сутки. Рубеж {num(WAR_TARGET)} очков, 48 часов. За победу — влияние
        и престиж, за поражение остаётся только престиж за участие.
      </p>
    </div>
  );
}

function CandidateRow({ item, onPick }: { item: WarCandidate; onPick: (opponentId: string) => void }) {
  const tier = clanTier(item.clan.points);
  return (
    <li className={`cl-war-cand ${item.matchup}`} style={{ ["--c" as string]: item.clan.color }}>
      <span className="cl-emblem" style={{ width: 38, height: 38, fontSize: 18, ["--c" as string]: item.clan.color }} aria-hidden>
        <i className="rim" />
        {item.clan.emblem}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">
          {item.clan.name} <span className="text-[11px] font-semibold text-muted">[{item.clan.tag}]</span>
        </p>
        <p className="truncate text-[11px] text-muted">
          {tier.name} · {num(item.clan.points)} очков · {item.clan.memberCount} уч.
        </p>
      </div>
      <div className="shrink-0 text-right">
        <span className={`cl-war-gap ${item.matchup}`} title={MATCHUP_LABEL[item.matchup]}>
          {item.label}
        </span>
        <p className="mt-0.5 text-[10px] text-muted">
          +{num(item.stakes.influence)} влияния
        </p>
      </div>
      <button
        type="button"
        className="cl-btn sm"
        style={{ ["--c" as string]: item.clan.color }}
        onClick={() => onPick(item.clan.id)}
        aria-label={`Объявить войну клану ${item.clan.name}`}
      >
        Объявить
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Рейд на босса                                                        */
/* ------------------------------------------------------------------ */

function RaidPanel({ now }: { now: number }) {
  const view = raidView(now);
  const [message, setMessage] = useState("");
  const pct = Math.min(100, Math.round((view.damage / (RAID_PHASE * BOSS.phases)) * 100));

  return (
    <section data-reveal className="cl-reveal cl-panel p-5 sm:p-6" style={{ ["--c" as string]: "#ff4d6d" }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="cl-lbl !mb-1">
            Недельный рейд{view.open ? " · рейд открыт" : ""}
          </p>
          <h2 className="flex items-center gap-2 font-accent text-xl font-extrabold">
            <span aria-hidden>{BOSS.glyph}</span> {BOSS.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Общая шкала урона на весь сайт. Твой вклад за неделю: {num(view.mine)}.
          </p>
        </div>
        <div className="text-right">
          <p className="cl-lbl !mb-1">Фаза</p>
          <p className="font-accent text-2xl font-extrabold tabular-nums">
            {view.current}/{BOSS.phases}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex justify-between text-xs text-muted">
          <span>{num(view.damage)} урона</span>
          <span>{pct}%</span>
        </div>
        <div className="cl-bar" style={{ ["--p" as string]: pct }}>
          <i />
        </div>
        <p className="mt-2 text-xs text-muted">
          До следующей фазы: <b className="tabular-nums text-bright">{num(view.toPhase)}</b> урона
        </p>
      </div>

      <ul className="mt-5 grid gap-2 sm:grid-cols-3">
        {Array.from({ length: BOSS.phases }, (_, i) => i + 1).map((phase) => {
          const broken = view.phases >= phase;
          const claimed = view.claimed.includes(phase);
          const reward = phaseReward(phase);
          return (
            <li key={phase} className={`cl-phase ${broken ? (claimed ? "done" : "ready") : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <b className="text-sm text-white">Фаза {phase}</b>
                {claimed ? (
                  <span className="cl-quest-badge done">Забрано</span>
                ) : broken ? (
                  <button
                    type="button"
                    className="cl-btn sm"
                    style={{ ["--c" as string]: "#ff4d6d" }}
                    onClick={() => {
                      const got = claimPhase(phase);
                      setMessage(got ? "Награда за фазу получена" : "Фаза ещё не пробита");
                      window.setTimeout(() => setMessage(""), 2600);
                    }}
                  >
                    Забрать
                  </button>
                ) : (
                  <span className="cl-quest-badge">закрыт</span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {num(reward.influence)} влияния · {num(reward.materials)} материалов ·{" "}
                {num(reward.prestige)} престижа
              </p>
            </li>
          );
        })}
      </ul>

      {message && (
        <p className="cl-toast mt-3" role="status">
          {message}
        </p>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Урон считается из просмотренных серий и разных видов активности за день,
        с потолком на неделю: одна длинная сессия босса не убьёт. {BOSS.reward}.
      </p>
    </section>
  );
}