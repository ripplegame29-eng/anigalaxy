"use client";

/** Обзор клана («цитадель»): герой-баннер, живая война, донат, недельные цели, лента. */

import { CLAN_ITEMS, GOAL_TIERS, MIN_MEMBER_GAIN, clanItem, clanXpForLevel, leagueOf } from "@/lib/clan-rules";
import { warPhaseText } from "@/lib/cards/clanwar";
import { clanAct, clanMediaUrl, prepareClanImage, useClanDonate, useClanWar } from "@/lib/clans/client";
import { useRef, useState } from "react";
import { CrystalIcon, ItemArt, LeagueBadge, TrophyIcon } from "./ClanArt";
import { CrestStage } from "./ClanCosmetics";
import { Btn, Ico, Panel, RoleBadge, Skeleton, ago, countdown, fmt, useClan, useNow } from "./common";

/* -------------------------------- Герой --------------------------------- */

export function ClanHero({ compact = false }: { compact?: boolean }) {
  const { me, clan, role } = useClan();
  const lg = leagueOf(clan.league);
  const rank = me.table?.find((r) => r.clanId === clan.id)?.rank;
  const lo = clanXpForLevel(clan.level);
  const hi = clanXpForLevel(clan.level + 1);
  const pct = clan.level >= 50 ? 100 : Math.max(0, Math.min(100, ((clan.xp - lo) / Math.max(1, hi - lo)) * 100));
  const eq = me.data?.equipped ?? {};
  const banner = undefined as ReturnType<typeof clanItem>;
  const aura = eq.aura ? clanItem(eq.aura) : undefined;
  const frame = eq.frame ? clanItem(eq.frame) : undefined;
  const canEdit = !compact && (role === "leader" || role === "officer");
  const avatarV = clan.avatarV ?? 0;
  const bannerV = clan.bannerV ?? 0;
  const fileRef = useRef<HTMLInputElement>(null);
  const kindRef = useRef<"avatar" | "banner">("avatar");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const pick = (k: "avatar" | "banner") => { kindRef.current = k; setErr(""); fileRef.current?.click(); };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const k = kindRef.current;
    setBusy(k);
    try {
      const image = await prepareClanImage(f, k);
      const r = await clanAct("media", { kind: k, image });
      if (!r.ok) setErr(r.error);
    } catch (e) {
      setErr(e instanceof Error && e.message !== "read" ? e.message : "Не удалось прочитать картинку");
    }
    setBusy("");
    if (fileRef.current) fileRef.current.value = "";
  };
  const drop = async (k: "avatar" | "banner") => { setBusy(k); const r = await clanAct("media", { kind: k, image: null }); if (!r.ok) setErr(r.error); setBusy(""); };

  return (
    <header
      className={`ca-hero${compact ? " is-compact" : ""}${bannerV && !compact ? " has-cover" : ""}`}
      style={{ ["--lc" as string]: lg.color, ["--lc2" as string]: lg.deep, ["--au" as string]: aura?.a ?? lg.color, ["--au2" as string]: aura?.b ?? lg.deep }}
    >
      {bannerV > 0 && !compact && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ca-hero-cover" src={clanMediaUrl(clan.id, "banner", bannerV)} alt="" aria-hidden />
      )}
      <i className="ca-hero-sheen" aria-hidden />
      <i className="ca-hero-grid" aria-hidden />
      {aura && <i className="ca-hero-aura" aria-hidden />}
      {banner && !compact && (
        <span className="ca-hero-banner" aria-hidden title={banner.name}>
          <ItemArt item={banner} size={150} />
        </span>
      )}

      <div className={`ca-hero-crest${frame ? " has-frame" : ""}`} style={frame ? { ["--fa" as string]: frame.a, ["--fb" as string]: frame.b } : undefined}>
        <CrestStage clanId={clan.id} emblemId={clan.emblem} avatarV={avatarV} size={compact ? 84 : 168} aura={aura} frame={frame} interactive={!compact} />
        {canEdit && (
          <button type="button" className="ca-media-btn ca-media-av" onClick={() => pick("avatar")} disabled={!!busy} title="Загрузить аватар клана">
            <Ico n="edit" size={14} /> {busy === "avatar" ? "Загрузка…" : avatarV ? "Сменить" : "Свой аватар"}
          </button>
        )}
      </div>
      {canEdit && (
        <div className="ca-media-bar">
          <button type="button" className="ca-media-btn" onClick={() => pick("banner")} disabled={!!busy}>
            <Ico n="image" size={14} /> {busy === "banner" ? "Загрузка…" : bannerV ? "Сменить обложку" : "Обложка"}
          </button>
          {bannerV > 0 && <button type="button" className="ca-media-btn" onClick={() => drop("banner")} disabled={!!busy}>Убрать обложку</button>}
          {avatarV > 0 && <button type="button" className="ca-media-btn" onClick={() => drop("avatar")} disabled={!!busy}>Вернуть герб</button>}
          {err && <span className="ca-media-err">{err}</span>}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      )}

      <div className="ca-hero-main">
        <span className="ca-eyebrow">
          <Ico n="shield" size={13} /> {lg.name} · уровень {clan.level}
        </span>
        <h1 className="ca-hero-name">
          {clan.name} <span className="ca-tag">[{clan.tag}]</span>
        </h1>
        {!compact && clan.description && <p className="ca-hero-desc">{clan.description}</p>}
        <div className="ca-hero-chips">
          <span className="ca-chip" title="Кубки клана">
            <TrophyIcon size={16} /> <b>{fmt(clan.trophies)}</b>
          </span>
          <span className="ca-chip" title="Игроков в клане">
            <Ico n="roster" size={16} /> <b>{clan.members}</b>/{clan.cap}
          </span>
          {!compact && (
            <>
              <span className="ca-chip" title="Казна">
                <Ico n="coin" size={16} /> <b>{fmt(clan.treasury)}</b> AC
              </span>
              <span className="ca-chip" title="Кристаллы">
                <CrystalIcon size={14} /> <b>{fmt(clan.crystals)}</b>
              </span>
              <RoleBadge role={role} />
            </>
          )}
        </div>
        {!compact && (
          <div className="ca-lvl" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Опыт клана">
            <div className="ca-lvl-top">
              <b>Ур. {clan.level}</b>
              <span>{clan.level >= 50 ? "максимум" : `${fmt(clan.xp - lo)} / ${fmt(hi - lo)} XP до ур. ${clan.level + 1}`}</span>
            </div>
            <div className="ca-bar">
              <i style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="ca-hero-league">
        <span className="ca-hero-lgname" style={{ ["--c" as string]: lg.color }}>
          <small>Лига</small>
          <b>{lg.name}</b>
          <i aria-hidden />
        </span>
        <div className="ca-hero-badge">
          <LeagueBadge league={clan.league} size={compact ? 52 : 104} />
        </div>
        {!compact && (
          <div className="ca-hero-pts">
            <b>{fmt(me.points ?? 0)}</b>
            <span>очков недели{rank ? ` · ${rank} место` : ""}</span>
          </div>
        )}
      </div>
    </header>
  );
}

/* ------------------------------ Война (live) ----------------------------- */

function WarCard() {
  const { go } = useClan();
  const { war, ready } = useClanWar();
  const now = useNow();
  const w = war?.war ?? null;

  if (!ready) return <Skeleton h={200} />;

  let body;
  if (w) {
    const until = w.phase === "prep" ? w.prepUntil : w.phase === "battle" ? w.endsAt : 0;
    const left = until && now ? until - now : 0;
    const mineLead = w.mine.score > w.foe.score;
    const foeLead = w.foe.score > w.mine.score;
    const res = w.result;
    body = (
      <>
        <div className="ca-war-top">
          <span className={`ca-phase ca-phase-${w.phase}`}>
            <i /> {warPhaseText[w.phase]}
            {w.bot && " · отряд-соперник"}
          </span>
          {w.phase !== "done" && (
            <span className="ca-war-timer">
              <Ico n="clock" size={15} /> {w.phase === "prep" ? "до боя" : "до конца"} <b>{now ? countdown(left) : "…"}</b>
            </span>
          )}
          {res && <span className={`ca-res ca-res-${res}`}>{res === "win" ? "Победа" : res === "lose" ? "Поражение" : "Ничья"}</span>}
        </div>
        <div className="ca-vs">
          <div className={`ca-vs-side${mineLead ? " lead" : ""}`}>
            <small>{w.mine.name}</small>
            <b>{fmt(w.mine.score)}</b>
            <span>
              <Ico n="star" size={13} /> {w.mine.stars}
            </span>
          </div>
          <div className="ca-vs-mid">
            <span>{w.size}×{w.size}</span>
            <em>VS</em>
          </div>
          <div className={`ca-vs-side foe${foeLead ? " lead" : ""}`}>
            <small>{w.foe.name}</small>
            <b>{fmt(w.foe.score)}</b>
            <span>
              <Ico n="star" size={13} /> {w.foe.stars}
            </span>
          </div>
        </div>
        <div className="ca-war-foot">
          {w.me ? (
            <span className="ca-dim">
              {w.phase === "battle" ? (w.me.attacksLeft > 0 ? `У вас осталось атак: ${w.me.attacksLeft}` : "Ваши атаки использованы") : w.phase === "prep" ? "Вы в составе — соберите отряд" : "Война завершена"}
            </span>
          ) : (
            <span className="ca-dim">Вы не в составе этой войны</span>
          )}
          <Btn kind={w.phase === "battle" && (w.me?.attacksLeft ?? 0) > 0 ? "primary" : "ghost"} onClick={() => go("war")}>
            <Ico n="war" size={17} /> {w.phase === "battle" && (w.me?.attacksLeft ?? 0) > 0 ? "В бой" : "Открыть войну"}
          </Btn>
        </div>
      </>
    );
  } else if (war?.search) {
    body = (
      <div className="ca-war-idle">
        <span className="ca-radar" aria-hidden />
        <div>
          <b>Ищем соперника {war.search.size}×{war.search.size}</b>
          <p className="ca-dim">Войну подбирает сервер. Можно сразиться с отрядом-соперником, не дожидаясь.</p>
        </div>
        <Btn kind="primary" onClick={() => go("war")}>Открыть</Btn>
      </div>
    );
  } else {
    body = (
      <div className="ca-war-idle">
        <span className="ca-idle-ico" aria-hidden>
          <Ico n="war" size={30} />
        </span>
        <div>
          <b>Война не идёт</b>
          <p className="ca-dim">{war?.canManage ? "Вы можете запустить поиск соперника для клана." : "Глава или офицер запускает войну — вы выберете отряд."}</p>
        </div>
        <Btn kind={war?.canManage ? "primary" : "ghost"} onClick={() => go("war")}>
          {war?.canManage ? "Начать войну" : "Открыть"}
        </Btn>
      </div>
    );
  }
  return (
    <Panel title="Клановая война" icon="war" className="ca-warcard">
      {body}
    </Panel>
  );
}

/* --------------------------------- Донат -------------------------------- */

function DonateCard() {
  const { go } = useClan();
  const { donate, ready } = useClanDonate();
  if (!ready) return <Skeleton h={150} />;
  const reqs = donate?.requests ?? [];
  const help = reqs.filter((r) => !r.mine && r.canGive > 0 && r.got < r.want).length;
  const mine = reqs.find((r) => r.mine);
  return (
    <Panel title="Донат карт" icon="donate" className="ca-donatecard">
      <div className="ca-don-nums">
        <div>
          <b>{reqs.length}</b>
          <span>запросов</span>
        </div>
        <div className={help ? "hot" : ""}>
          <b>{help}</b>
          <span>можете помочь</span>
        </div>
        <div>
          <b>{donate ? `${donate.givenToday}/${donate.dailyLimit}` : "—"}</b>
          <span>отдано сегодня</span>
        </div>
      </div>
      {mine && (
        <p className="ca-dim">
          Ваш запрос: {mine.got}/{mine.want} получено
        </p>
      )}
      <Btn kind={help ? "primary" : "ghost"} onClick={() => go("donate")}>
        <Ico n="donate" size={17} /> {help ? "Помочь соклановцам" : "Открыть донат"}
      </Btn>
    </Panel>
  );
}

/* ------------------------------ Цели недели ------------------------------ */

function SeasonCard() {
  const { me, act } = useClan();
  const now = useNow();
  const g = me.goals;
  const points = me.points ?? 0;
  const top = g ? g.targets[g.targets.length - 1] : 1;
  const left = me.season && now ? me.season.endsAt - now : 0;
  return (
    <Panel
      title="Цели недели"
      icon="star"
      className="ca-season"
      aside={
        <span className="ca-dim">
          <Ico n="clock" size={14} /> {me.season ? (now ? `до итогов ${countdown(left)}` : "…") : ""}
        </span>
      }
    >
      <div className="ca-points">
        <b>{fmt(points)}</b>
        <span>очков клана за неделю</span>
      </div>
      <div className="ca-goalbar">
        <div className="ca-bar ca-bar-lg">
          <i style={{ width: `${Math.min(100, (points / top) * 100)}%` }} />
        </div>
        {g?.targets.map((t, i) => (
          <u key={t} className={points >= t ? "hit" : ""} style={{ left: `${(t / top) * 100}%` }} data-i={i + 1} />
        ))}
      </div>
      <div className="ca-chests">
        {GOAL_TIERS.map((t, i) => {
          const reached = !!g?.reached.includes(t.id);
          const claimed = !!g?.claimed.includes(t.id);
          const ready = reached && !claimed && !!g?.eligible;
          return (
            <div key={t.id} className={`ca-chest${ready ? " ready" : ""}${claimed ? " done" : ""}`} style={{ ["--cc" as string]: t.color }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ca-chest-img" src={`/clans/chests/${Math.min(i, 2)}.webp`} alt="" />
              <b>{t.name.replace(" сундук", "")}</b>
              <small>
                {fmt(g?.targets[i] ?? 0)} очк. · +{t.ac} AC
              </small>
              <Btn kind={ready ? "gold" : "ghost"} size="sm" disabled={!ready} onClick={() => void act("claim_goal", { tier: t.id }, `Сундук открыт: +${t.ac} AC`)}>
                {claimed ? "Забрано" : ready ? "Забрать" : reached ? "Нет допуска" : "Закрыто"}
              </Btn>
            </div>
          );
        })}
      </div>
      {g && !g.eligible && (
        <p className="ca-note">
          <Ico n="alert" size={16} /> Чтобы забирать сундуки, принесите клану от {MIN_MEMBER_GAIN} очков за неделю: смотрите аниме, проходите уровни и квесты.
        </p>
      )}
    </Panel>
  );
}

/* --------------------------------- Лента -------------------------------- */

function eventText(e: { kind: string; amount: number; data?: Record<string, unknown> }): string {
  const a = fmt(e.amount);
  switch (e.kind) {
    case "created": return "основал клан";
    case "joined": return "вступил в клан";
    case "left": return "покинул клан";
    case "kicked": return "исключён из клана";
    case "leader_changed": return "теперь глава клана";
    case "emblem": return "сменил эмблему клана";
    case "contributed": return `принёс клану ${a} опыта`;
    case "donated": return `внёс в казну ${a} AC`;
    case "bought": return "купил оформление клана";
    case "slots": return `открыл ${a} мест в составе`;
    case "crystals": return `пополнил кристаллы клана: +${a}`;
    case "season": return `итоги недели: ${a} место`;
    case "war_points": return `принёс очки войны: +${a}`;
    case "war_lost": return `проиграл войну: −${fmt(Math.abs(e.amount))} кубков`;
    case "war_won": return `победил в войне: +${fmt(Math.abs(e.amount))} кубков`;
    case "war_draw": return "сыграл войну вничью";
    case "war_found": return e.data?.bot ? `нашёл соперника для войны ${a}×${a} — тренировочный бой` : `нашёл соперника для войны ${a}×${a}`;
    case "war_hit": return `атаковал в войне: ${"★".repeat(Math.max(1, Math.min(3, e.amount)))}`;
    case "war_miss": return "атаковал в войне, но не прорвал защиту";
    case "donate_request": return `просит карту для коллекции (${a} шт.)`;
    case "donate_card": return "подарил карту соклановцу";
    case "win": return "выиграл бой";
    case "lose": return "проиграл бой";
    default: return "событие клана";
  }
}
const EVENT_ICON: Record<string, string> = { joined: "plus", created: "shield", left: "logout", kicked: "x", donated: "coin", bought: "shop", slots: "roster", crystals: "bolt", season: "league", contributed: "up", donate_card: "donate", donate_request: "donate" };

function Feed() {
  const { me } = useClan();
  const now = useNow();
  const ev = (me.events ?? []).slice(0, 12);
  return (
    <Panel title="Лента клана" icon="clock" className="ca-feed">
      {ev.length === 0 ? (
        <p className="ca-empty-row">Пока тихо — события клана появятся здесь.</p>
      ) : (
        <ul className="ca-events">
          {ev.map((e) => (
            <li key={e.id}>
              <span className="ca-ev-ico">
                <Ico n={EVENT_ICON[e.kind] ?? (e.kind.startsWith("war") ? "war" : "star")} size={15} />
              </span>
              <span className="ca-ev-t">
                <b>{e.nickname || "Клан"}</b> {eventText(e)}
              </span>
              <time className="ca-dim">{ago(e.createdAt, now)}</time>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ---------------------------- Витрина оформления -------------------------- */

function Cosmetics() {
  const { me, go } = useClan();
  const eq = me.data?.equipped ?? {};
  const total = CLAN_ITEMS.filter((i) => i.slot !== "banner").length;
  const owned = (me.owned ?? []).filter((id) => clanItem(id)?.slot !== "banner").length;
  return (
    <Panel title="Оформление" icon="shop" className="ca-cosm" aside={<span className="ca-dim">{owned}/{total}</span>}>
      <div className="ca-cosm-row">
        {(["aura", "frame"] as const).map((s) => {
          const it = eq[s] ? clanItem(eq[s]) : undefined;
          return (
            <div key={s} className={`ca-slot${it ? ` r-${it.rarity}` : ""}`}>
              {it ? <ItemArt item={it} size={56} /> : <span className="ca-slot-empty"><Ico n="plus" size={18} /></span>}
              <small>{s === "aura" ? "Аура" : "Рамка"}</small>
            </div>
          );
        })}
      </div>
      <Btn kind="ghost" onClick={() => go("shop")}>Ауры и рамки</Btn>
    </Panel>
  );
}

export function OverviewTab() {
  return (
    <div className="ca-over">
      <WarCard />
      <DonateCard />
      <SeasonCard />
      <Cosmetics />
      <Feed />
    </div>
  );
}
