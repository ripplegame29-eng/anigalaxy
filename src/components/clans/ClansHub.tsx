"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CLAN_ITEMS,
  CRYSTAL_PACKS,
  CRYSTAL_PRICE,
  DONATE_MAX,
  DONATE_MIN,
  DONOR_TIERS,
  GOAL_TIERS,
  LEAGUES,
  MIN_MEMBER_GAIN,
  MIN_RANKED_MEMBERS,
  RARITY_NAME,
  ROLE_NAME,
  SEASON_REWARDS,
  SLOT_PACK,
  TREASURY_PRICE,
  donorTier,
  leagueOf,
  type ClanItem,
  type ClanRole,
} from "@/lib/clan-rules";
import { openAuthDialog } from "@/lib/auth-dialog";
import { useAccount } from "@/lib/use-account";
import { ChestIcon, CrownIcon, CrystalIcon, DonorMedal, ItemArt, LeagueBadge, TrophyIcon } from "./ClanArt";
import "./clans-hub.css";

interface Row { rank: number; clanId: number; name: string; tag: string; points: number; members: number; level: number; zone: "up" | "down" | "stay" }
interface Clan { id: number; name: string; tag: string; description: string; leaderId: number; treasury: number; members: number; league: number; trophies: number; crystals: number; extraSlots: number; level: number; cap: number; xp: number }
interface Member { userId: number; nickname: string; role: ClanRole; contributedAc: number; gain: number }
interface Me {
  clan: Clan | null;
  data?: { equipped?: Record<string, string> };
  members?: Member[];
  season?: { key: string; endsAt: number };
  table?: Row[];
  goals?: { targets: number[]; claimed: number[]; reached: number[]; eligible: boolean };
  points?: number;
  results?: { season: string; league: number; rank: number; points: number; trophies: number; move: number }[];
  owned?: string[];
  donorRub?: number;
  events?: { id: number; kind: string; amount: number; nickname?: string; createdAt: number }[];
  uid?: number;
}
type Tab = "season" | "roster" | "treasury" | "shop" | "fame";
const TABS: [Tab, string][] = [["season", "Сезон"], ["roster", "Состав"], ["treasury", "Казна"], ["shop", "Магазин"], ["fame", "Зал славы"]];

const EVENT_TEXT: Record<string, string> = {
  created: "создал клан", joined: "вступил в клан", left: "вышел из клана", kicked: "исключён", donated: "внёс в казну AC",
  bought: "купил оформление", crystals: "кристаллов зачислено", slots: "мест добавлено", season: "место по итогам недели",
};
const fmt = (n: number) => n.toLocaleString("ru-RU");
async function call(url: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "Нет связи с сервером" } };
  }
}

export function ClansHub() {
  const account = useAccount();
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>("season");
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    const r = await call("/api/clans/me");
    setMe(r.ok ? (r.data as unknown as Me) : { clan: null });
  }, []);
  useEffect(() => {
    if (!account) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [account, load]);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = window.setInterval(tick, 30_000);
    return () => window.clearInterval(t);
  }, []);

  const act = useCallback(
    async (body: Record<string, unknown>, ok = "") => {
      const r = await call("/api/clans/action", body);
      setMsg(r.ok ? ok : String(r.data.error ?? "Не получилось"));
      if (r.ok) await load();
      return r.ok;
    },
    [load],
  );

  if (!account) {
    return (
      <section className="ch-empty">
        <LeagueBadge league={2} size={96} />
        <h1>Кланы AniGalaxy</h1>
        <p>Соревнуйтесь с другими кланами за места в лиге и награды недели. Войдите, чтобы вступить или создать свой клан.</p>
        <button type="button" className="ch-btn ch-btn-primary" onClick={() => openAuthDialog("login")}>Войти</button>
      </section>
    );
  }
  if (!me) return <p className="ch-muted">Загрузка…</p>;
  if (!me.clan) return <Browse onDone={load} act={act} msg={msg} />;

  const clan = me.clan;
  const myRole = (me.members?.find((m) => m.userId === (me.uid ?? -1))?.role ?? "member") as ClanRole;
  const manage = myRole === "leader" || myRole === "officer";
  const league = leagueOf(clan.league);
  const left = me.season && now ? Math.max(0, me.season.endsAt - now) : 0;
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  const rank = me.table?.find((r) => r.clanId === clan.id)?.rank;

  return (
    <div className="ch" style={{ ["--lc" as string]: league.color }}>
      <header className="ch-head">
        <LeagueBadge league={clan.league} size={92} />
        <div className="ch-head-main">
          <h1>{clan.name} <span className="ch-tag">[{clan.tag}]</span></h1>
          <p className="ch-muted">{league.name} · уровень {clan.level} · {clan.members}/{clan.cap} игроков</p>
          <div className="ch-stats">
            <span><TrophyIcon size={16} /> {clan.trophies}</span>
            <span><CrystalIcon size={14} /> {fmt(clan.crystals)}</span>
            <span>Казна {fmt(clan.treasury)} AC</span>
          </div>
        </div>
        <div className="ch-season">
          <b>{fmt(me.points ?? 0)}</b>
          <span>очков{rank ? ` · ${rank} место` : ""}</span>
          <small>{now ? `до итогов: ${days} д ${hours} ч` : " "}</small>
        </div>
      </header>

      <nav className="ch-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => { setTab(id); setMsg(""); }}>{label}</button>
        ))}
      </nav>
      {msg && <p className="ch-msg" role="status">{msg}</p>}

      {tab === "season" && <Season me={me} act={act} />}
      {tab === "roster" && <Roster me={me} myRole={myRole} act={act} />}
      {tab === "treasury" && <Treasury me={me} act={act} />}
      {tab === "shop" && <Shop me={me} manage={manage} myRole={myRole} act={act} reload={load} setMsg={setMsg} />}
      {tab === "fame" && <Fame me={me} />}
    </div>
  );
}

type Act = (body: Record<string, unknown>, ok?: string) => Promise<boolean>;

/* ------------------------------- Сезон ---------------------------------- */
function Season({ me, act }: { me: Me; act: Act }) {
  const clan = me.clan!;
  const g = me.goals;
  const points = me.points ?? 0;
  const top = g ? g.targets[g.targets.length - 1] : 1;
  return (
    <div className="ch-grid">
      <section className="ch-card">
        <h2>Цели недели</h2>
        <div className="ch-bar"><i style={{ width: `${Math.min(100, (points / top) * 100)}%` }} />
          {g?.targets.map((t, i) => <u key={t} style={{ left: `${(t / top) * 100}%` }} className={points >= t ? "hit" : ""} title={fmt(t)} data-i={i} />)}
        </div>
        <div className="ch-chests">
          {GOAL_TIERS.map((t, i) => {
            const reached = !!g?.reached.includes(t.id);
            const claimed = !!g?.claimed.includes(t.id);
            return (
              <div key={t.id} className={`ch-chest${reached ? " ready" : ""}`}>
                <ChestIcon color={t.color} open={claimed} />
                <b>{t.name}</b>
                <small>{fmt(g?.targets[i] ?? 0)} очков · +{t.ac} AC</small>
                <button type="button" className="ch-btn" disabled={!reached || claimed || !g?.eligible} onClick={() => void act({ action: "claim_goal", tier: t.id }, `Сундук открыт: +${t.ac} AC`)}>
                  {claimed ? "Забрано" : reached ? "Забрать" : "Закрыто"}
                </button>
              </div>
            );
          })}
        </div>
        {g && !g.eligible && <p className="ch-muted">Чтобы забирать сундуки, принесите клану от {MIN_MEMBER_GAIN} очков за неделю — смотрите аниме, проходите уровни и квесты.</p>}
      </section>

      <section className="ch-card">
        <h2>Лига «{leagueOf(clan.league).name}»</h2>
        <p className="ch-muted">Топ четверти поднимается в лигу выше, нижняя четверть опускается. В таблице кланы от {MIN_RANKED_MEMBERS} игроков.</p>
        <ol className="ch-table">
          {(me.table ?? []).map((r) => (
            <li key={r.clanId} className={`${r.clanId === clan.id ? "me " : ""}${r.zone}`}>
              <span className="n">{r.rank}</span>
              <span className="nm">{r.name} <small>[{r.tag}]</small></span>
              <span className="pt">{fmt(r.points)}</span>
              <span className="zn" aria-label={r.zone === "up" ? "Зона повышения" : r.zone === "down" ? "Зона понижения" : ""}>{r.zone === "up" ? "▲" : r.zone === "down" ? "▼" : ""}</span>
            </li>
          ))}
        </ol>
        <h3>Награды за место</h3>
        <ul className="ch-rewards">
          {SEASON_REWARDS.map((r) => (
            <li key={r.label}><b>{r.label}</b> игроку {r.memberAc} AC · в казну {fmt(r.treasuryAc)} AC{r.trophies ? ` · ${r.trophies} кубк.` : ""}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------- Состав --------------------------------- */
function Roster({ me, myRole, act }: { me: Me; myRole: ClanRole; act: Act }) {
  const members = me.members ?? [];
  const max = Math.max(1, ...members.map((m) => m.gain));
  return (
    <section className="ch-card">
      <h2>Состав и вклад за неделю</h2>
      <ul className="ch-roster">
        {members.map((m) => (
          <li key={m.userId}>
            <span className="nm">{m.role === "leader" && <CrownIcon />} {m.nickname} <small>{ROLE_NAME[m.role] ?? "Боец"}</small></span>
            <span className="bar"><i style={{ width: `${(m.gain / max) * 100}%` }} /></span>
            <span className="pt">{fmt(m.gain)}</span>
            {myRole === "leader" && m.role !== "leader" && (
              <button type="button" className="ch-btn" onClick={() => void act({ action: "role", userId: m.userId, role: m.role === "officer" ? "member" : "officer" })}>{m.role === "officer" ? "Снять" : "В офицеры"}</button>
            )}
            {(myRole === "leader" || (myRole === "officer" && m.role === "member")) && m.role !== "leader" && (
              <button type="button" className="ch-btn ch-btn-danger" onClick={() => void act({ action: "kick", userId: m.userId }, "Игрок исключён")}>Исключить</button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="ch-btn ch-btn-danger" onClick={() => { if (window.confirm("Выйти из клана?")) void act({ action: "leave" }); }}>Выйти из клана</button>
    </section>
  );
}

/* -------------------------------- Казна --------------------------------- */
function Treasury({ me, act }: { me: Me; act: Act }) {
  const [amount, setAmount] = useState(100);
  const clan = me.clan!;
  return (
    <div className="ch-grid">
      <section className="ch-card">
        <h2>Казна: {fmt(clan.treasury)} AC</h2>
        <p className="ch-muted">Монеты из казны тратятся на обычное и редкое оформление клана. Взнос списывается с вашего баланса.</p>
        <div className="ch-row">
          <input type="number" min={DONATE_MIN} max={DONATE_MAX} value={amount} onChange={(e) => setAmount(Number(e.target.value))} aria-label="Сумма взноса" />
          <button type="button" className="ch-btn ch-btn-primary" onClick={() => void act({ action: "donate", ac: amount }, "Взнос внесён")}>Внести</button>
        </div>
      </section>
      <section className="ch-card">
        <h2>Лента клана</h2>
        <ul className="ch-events">
          {(me.events ?? []).map((e) => (
            <li key={e.id}>{e.nickname || "Клан"} · {EVENT_TEXT[e.kind] ?? e.kind}{e.amount ? ` ${fmt(e.amount)}` : ""}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ------------------------------- Магазин -------------------------------- */
function Shop({ me, manage, myRole, act, reload, setMsg }: { me: Me; manage: boolean; myRole: ClanRole; act: Act; reload: () => Promise<void>; setMsg: (s: string) => void }) {
  const clan = me.clan!;
  const owned = useMemo(() => new Set(me.owned ?? []), [me.owned]);
  const equipped = me.data?.equipped ?? {};
  const buyPack = async (pack: string) => {
    const r = await call("/api/clans/shop", { pack });
    if (!r.ok) return setMsg(String(r.data.error ?? "Не получилось"));
    if (typeof r.data.checkoutUrl === "string") { window.location.assign(r.data.checkoutUrl); return; }
    setMsg("Тестовая оплата: кристаллы зачислены");
    await reload();
  };
  const tier = donorTier(me.donorRub ?? 0);
  return (
    <div className="ch-stack">
      <section className="ch-card">
        <h2>Кристаллы клана</h2>
        <p className="ch-muted">Кристаллы покупают только оформление и места в составе. Очки сезона, лигу и награды купить нельзя — клан растёт за счёт активности игроков.</p>
        <div className="ch-packs">
          {CRYSTAL_PACKS.map((p) => (
            <button key={p.id} type="button" className="ch-pack" onClick={() => void buyPack(p.id)}>
              <CrystalIcon size={30} />
              <b>{p.name}</b>
              <span>{fmt(p.crystals)} кристаллов</span>
              {p.note && <em>{p.note}</em>}
              <strong>{p.rub} ₽</strong>
            </button>
          ))}
        </div>
        {tier && <p className="ch-donor"><DonorMedal color={tier.color} size={22} /> Ваш титул: {tier.name}</p>}
        <p className="ch-muted">Спонсорские титулы: {DONOR_TIERS.map((t) => `${t.name} от ${t.from} ₽`).reverse().join(" · ")}.</p>
      </section>

      <section className="ch-card">
        <h2>Оформление клана</h2>
        {!manage && <p className="ch-muted">Покупают и надевают глава и офицеры.</p>}
        <div className="ch-items">
          {CLAN_ITEMS.map((it: ClanItem) => {
            const has = owned.has(it.id);
            const on = equipped[it.slot] === it.id;
            const tr = it.rarity === "common" || it.rarity === "rare" ? TREASURY_PRICE[it.rarity] : 0;
            return (
              <div key={it.id} className={`ch-item r-${it.rarity}`}>
                <ItemArt item={it} size={84} />
                <b>{it.name}</b>
                <small>{RARITY_NAME[it.rarity]}</small>
                {has ? (
                  <button type="button" className="ch-btn" disabled={!manage} onClick={() => void act({ action: "equip", slot: it.slot, itemId: on ? null : it.id })}>{on ? "Снять" : "Надеть"}</button>
                ) : (
                  <div className="ch-buy">
                    {tr > 0 && <button type="button" className="ch-btn" disabled={!manage || clan.treasury < tr} onClick={() => void act({ action: "buy", itemId: it.id, currency: "treasury" }, "Куплено")}>{fmt(tr)} AC</button>}
                    <button type="button" className="ch-btn" disabled={!manage || clan.crystals < CRYSTAL_PRICE[it.rarity]} onClick={() => void act({ action: "buy", itemId: it.id, currency: "crystals" }, "Куплено")}><CrystalIcon size={11} /> {CRYSTAL_PRICE[it.rarity]}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="ch-card">
        <h2>{SLOT_PACK.name}</h2>
        <p className="ch-muted">Сейчас мест: {clan.cap}. Куплено дополнительных: {clan.extraSlots} из {SLOT_PACK.max}.</p>
        <button type="button" className="ch-btn ch-btn-primary" disabled={myRole !== "leader" || clan.crystals < SLOT_PACK.crystals} onClick={() => void act({ action: "slots" }, "Места добавлены")}><CrystalIcon size={12} /> {SLOT_PACK.crystals}</button>
      </section>
    </div>
  );
}

/* ------------------------------ Зал славы ------------------------------- */
function Fame({ me }: { me: Me }) {
  const clan = me.clan!;
  return (
    <section className="ch-card">
      <h2><TrophyIcon size={20} /> Кубки: {clan.trophies}</h2>
      {(me.results ?? []).length === 0 ? <p className="ch-muted">Первые итоги появятся в понедельник.</p> : (
        <ul className="ch-history">
          {me.results!.map((r) => (
            <li key={r.season}>
              <LeagueBadge league={r.league} size={34} />
              <span>Неделя {r.season}</span>
              <b>{r.rank} место</b>
              <span>{fmt(r.points)} очков</span>
              <em>{r.move > 0 ? "▲ повышение" : r.move < 0 ? "▼ понижение" : "остались"}</em>
            </li>
          ))}
        </ul>
      )}
      <p className="ch-muted">Лиги: {LEAGUES.map((l) => l.name).join(" → ")}.</p>
    </section>
  );
}

/* --------------------------- Поиск и создание --------------------------- */
function Browse({ onDone, act, msg }: { onDone: () => Promise<void>; act: Act; msg: string }) {
  const [clans, setClans] = useState<Clan[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", tag: "", description: "" });
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    void call(`/api/clans?q=${encodeURIComponent(q)}`).then((r) => { if (live) setClans(((r.data.clans as Clan[]) ?? [])); });
    return () => { live = false; };
  }, [q]);
  const create = async () => {
    const r = await call("/api/clans", form);
    if (!r.ok) return setErr(String(r.data.error ?? "Не получилось"));
    await onDone();
  };
  return (
    <div className="ch"><div className="ch-grid">
      <section className="ch-card">
        <h2>Найти клан</h2>
        <input className="ch-search" placeholder="Название или тег" value={q} onChange={(e) => setQ(e.target.value)} />
        {msg && <p className="ch-msg">{msg}</p>}
        <ul className="ch-find">
          {clans.map((c) => (
            <li key={c.id}>
              <LeagueBadge league={c.league} size={38} />
              <span className="nm">{c.name} <small>[{c.tag}]</small><br /><small>{c.members}/{c.cap} игроков · {leagueOf(c.league).name}</small></span>
              <button type="button" className="ch-btn" disabled={c.members >= c.cap} onClick={() => void act({ action: "join", clanId: c.id }, "Вы в клане")}>Вступить</button>
            </li>
          ))}
          {clans.length === 0 && <li className="ch-none ch-muted">Кланов пока нет — создайте первый.</li>}
        </ul>
      </section>
      <section className="ch-card">
        <h2>Создать клан</h2>
        <label>Название<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={24} /></label>
        <label>Тег (2–5 символов)<input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value.toUpperCase() })} maxLength={5} /></label>
        <label>Описание<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={280} rows={3} /></label>
        {err && <p className="ch-msg">{err}</p>}
        <button type="button" className="ch-btn ch-btn-primary" onClick={() => void create()}>Создать</button>
        <p className="ch-muted">Клан начинает в Бронзовой лиге. Чтобы попасть в рейтинг, нужно собрать от {MIN_RANKED_MEMBERS} игроков.</p>
      </section>
    </div></div>
  );
}
