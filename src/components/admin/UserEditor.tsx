"use client";

import { PSelect } from "@/components/PSelect";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AvatarFrame } from "@/components/profile/AvatarFrame";
import { adminGet, adminPost, ago, fmtDate, fmtNum } from "./api";
import { CATALOG, KIND_LABEL, KIND_ORDER, RARITY_TONE, findCat, type CatKind } from "./catalog";
import { Empty, Initial, Pill, Segmented, useUi } from "./ui";

export interface Detail {
  user: {
    id: number;
    nickname: string;
    displayName: string;
    email: string;
    role: string;
    telegram: string;
    premiumUntil: number;
    premiumTotalDays: number;
    bannedUntil: number;
    createdAt: number;
    lastSeenAt: number;
  };
  balance: { xp: number; level: number; ac: number; trophy: number; streak: number; streakBest: number; freezes: number; battlepassXp: number; synced: boolean };
  look: { frameId: string; titleId: string; backgroundId: string; particleFx: string; decorFx: string; equippedTagId: string; hasAvatar: boolean; bio: string; signature: string };
  owned: { purchased: string[]; claimed: string[]; tags: string[]; achievements: string[] };
  ledger: { id: string; currency: string; amount: number; source: string; createdAt: number; metadata?: { by?: string; note?: string } }[];
  counts: { comments: number; chat: number; sessions: number; reportsAgainst: number; followers: number };
}

type Section = "overview" | "profile" | "balance" | "items" | "access" | "ledger";

export function UserEditor({ id, me, onClose, onChanged }: { id: number; me: string; onClose: () => void; onChanged: () => void }) {
  const ui = useUi();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [now] = useState(() => Date.now());
  const [missing, setMissing] = useState(false);

  const reload = useCallback(async () => {
    const data = await adminGet<Detail>("user", { id });
    if (data) setDetail(data);
    else setMissing(true);
  }, [id]);

  useEffect(() => {
    let alive = true;
    void adminGet<Detail>("user", { id }).then((data) => {
      if (!alive) return;
      if (data) setDetail(data);
      else setMissing(true);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Выполнить действие, показать результат и обновить карточку */
  const run = useCallback(
    async (body: Record<string, unknown>, okText?: string) => {
      const result = await adminPost({ id, ...body });
      if (!result.ok) {
        ui.toast(result.error ?? "Не удалось", "err");
        return result;
      }
      ui.toast(okText ?? "Готово", "ok");
      await reload();
      onChanged();
      return result;
    },
    [id, reload, onChanged, ui],
  );

  const u = detail?.user;
  const banned = !!u && u.bannedUntil > now;
  const premium = !!u && u.premiumUntil > now;

  return (
    <div className="adm-drawer-wrap" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="adm-drawer" role="dialog" aria-label="Редактор игрока">
        <header className="adm-drawer-head">
          {u ? <Initial name={u.nickname} size={56} /> : <span className="adm-skel" style={{ width: 56, height: 56, borderRadius: 18 }} />}
          <div className="adm-drawer-who">
            <h2>{u?.nickname ?? (missing ? "Не найден" : "Загрузка…")}</h2>
            <p>{u ? `${u.email} · id ${u.id}` : ""}</p>
            {u ? (
              <div className="adm-pills">
                {u.role !== "user" ? <Pill tone="violet">{u.role}</Pill> : null}
                {premium ? <Pill tone="gold">PREMIUM</Pill> : null}
                {banned ? <Pill tone="red">БАН</Pill> : null}
                <Pill tone="gray">был {ago(u.lastSeenAt, now)}</Pill>
              </div>
            ) : null}
          </div>
          <button type="button" className="adm-x" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        {detail && u ? (
          <>
            <Segmented
              label="Раздел"
              value={section}
              onChange={setSection}
              options={[
                { id: "overview", label: "Обзор" },
                { id: "profile", label: "Профиль" },
                { id: "balance", label: "Баланс" },
                { id: "items", label: "Предметы" },
                { id: "access", label: "Доступ" },
                { id: "ledger", label: "Журнал" },
              ]}
            />
            <div className="adm-drawer-body" key={section}>
              {section === "overview" ? <Overview d={detail} now={now} run={run} /> : null}
              {section === "profile" ? <ProfileForm d={detail} run={run} /> : null}
              {section === "balance" ? <BalanceForm d={detail} run={run} /> : null}
              {section === "items" ? <Items d={detail} run={run} /> : null}
              {section === "access" ? <Access d={detail} now={now} me={me} run={run} onClose={onClose} /> : null}
              {section === "ledger" ? <Ledger d={detail} /> : null}
            </div>
          </>
        ) : missing ? (
          <Empty>Игрок не найден — возможно, аккаунт уже удалён.</Empty>
        ) : (
          <div className="adm-drawer-body">
            <span className="adm-skel" style={{ height: 90 }} />
            <span className="adm-skel" style={{ height: 160 }} />
          </div>
        )}
      </aside>
    </div>
  );
}

type Run = (body: Record<string, unknown>, okText?: string) => Promise<{ ok: boolean; error?: string; [k: string]: unknown }>;

/* ------------------------------- Обзор --------------------------------- */

function Overview({ d, now, run }: { d: Detail; now: number; run: Run }) {
  const b = d.balance;
  const tiles: [string, string][] = [
    ["Уровень", String(b.level)],
    ["Опыт", `${fmtNum(b.xp)} XP`],
    ["Баланс", `${fmtNum(b.ac)} AC`],
    ["Очки славы", fmtNum(b.trophy)],
    ["Серия", `${b.streak} дн.`],
    ["Заморозки", String(b.freezes)],
  ];
  return (
    <div className="adm-stack">
      {!b.synced ? <p className="adm-note">Игрок ещё не синхронизировал прогресс: при первой выдаче документ будет создан с нуля.</p> : null}
      <div className="adm-mini-grid">
        {tiles.map(([k, v]) => (
          <div key={k} className="adm-mini">
            <span>{k}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>
      <div className="adm-kv">
        <span>Регистрация</span>
        <b>{fmtDate(d.user.createdAt)}</b>
        <span>Последний вход</span>
        <b>{ago(d.user.lastSeenAt, now)}</b>
        <span>Premium</span>
        <b>{d.user.premiumUntil > now ? `до ${new Date(d.user.premiumUntil).toLocaleDateString("ru-RU")}` : "нет"} · всего {d.user.premiumTotalDays} дн.</b>
        <span>Комментарии / чат</span>
        <b>
          {d.counts.comments} / {d.counts.chat}
        </b>
        <span>Подписчики</span>
        <b>{d.counts.followers}</b>
        <span>Жалобы на игрока</span>
        <b>{d.counts.reportsAgainst}</b>
        <span>Активные сессии</span>
        <b>{d.counts.sessions}</b>
        <span>Предметов / тегов / достижений</span>
        <b>
          {d.owned.purchased.length} / {d.owned.tags.length} / {d.owned.achievements.length}
        </b>
      </div>
      <div className="adm-row">
        <Link className="adm-btn" href={`/u/${encodeURIComponent(d.user.nickname)}`} target="_blank">
          Открыть профиль ↗
        </Link>
        <button type="button" className="adm-btn adm-btn-primary" onClick={() => void run({ action: "premium", days: 30 }, "+30 дней Premium")}>
          +30 дн. Premium
        </button>
        <button type="button" className="adm-btn adm-btn-gold" onClick={() => void run({ action: "balance", ac: 1000, note: "подарок" }, "+1000 AC")}>
          +1000 AC
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- Профиль ------------------------------- */

function ProfileForm({ d, run }: { d: Detail; run: Run }) {
  const ui = useUi();
  const [f, setF] = useState({ nickname: d.user.nickname, displayName: d.user.displayName, email: d.user.email, signature: d.look.signature, bio: d.look.bio });
  const [resetAvatar, setResetAvatar] = useState(false);
  const [clearBg, setClearBg] = useState(false);
  const [text, setText] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = async () => {
    const body: Record<string, unknown> = { action: "account" };
    if (f.nickname !== d.user.nickname) body.nickname = f.nickname;
    if (f.displayName !== d.user.displayName) body.displayName = f.displayName;
    if (f.email !== d.user.email) body.email = f.email;
    if (f.signature !== d.look.signature) body.signature = f.signature;
    if (f.bio !== d.look.bio) body.bio = f.bio;
    if (resetAvatar) body.resetAvatar = true;
    if (clearBg) body.clearBackground = true;
    if (Object.keys(body).length === 1) return ui.toast("Ничего не изменено", "info");
    const r = await run(body, "Профиль сохранён");
    if (r.ok) {
      setResetAvatar(false);
      setClearBg(false);
    }
  };

  return (
    <div className="adm-stack">
      <div className="adm-form-grid">
        <label>
          Ник
          <input value={f.nickname} onChange={set("nickname")} maxLength={24} />
        </label>
        <label>
          Отображаемое имя
          <input value={f.displayName} onChange={set("displayName")} maxLength={40} />
        </label>
        <label className="wide">
          Почта
          <input value={f.email} onChange={set("email")} type="email" />
        </label>
        <label className="wide">
          Подпись под ником
          <input value={f.signature} onChange={set("signature")} maxLength={80} />
        </label>
        <label className="wide">
          О себе
          <textarea value={f.bio} onChange={set("bio")} maxLength={500} rows={4} />
        </label>
      </div>
      <div className="adm-checks">
        <label>
          <input type="checkbox" checked={resetAvatar} onChange={(e) => setResetAvatar(e.target.checked)} disabled={!d.look.hasAvatar} />
          Сбросить аватар{d.look.hasAvatar ? "" : " (не загружен)"}
        </label>
        <label>
          <input type="checkbox" checked={clearBg} onChange={(e) => setClearBg(e.target.checked)} />
          Убрать свой фон
        </label>
      </div>
      <button type="button" className="adm-btn adm-btn-primary" onClick={() => void save()}>
        Сохранить профиль
      </button>

      <h4 className="adm-h4">Личное сообщение</h4>
      <textarea className="adm-ta" value={text} onChange={(e) => setText(e.target.value)} placeholder="Появится в колокольчике игрока" maxLength={300} rows={3} />
      <button
        type="button"
        className="adm-btn"
        disabled={text.trim().length < 2}
        onClick={async () => {
          const r = await run({ action: "notify", text }, "Сообщение отправлено");
          if (r.ok) setText("");
        }}
      >
        Отправить
      </button>
    </div>
  );
}

/* ------------------------------- Баланс -------------------------------- */

interface Currency {
  key: string;
  label: string;
  hint: string;
  current: string;
  add?: string;
  set?: string;
  unit: string;
}

function BalanceForm({ d, run }: { d: Detail; run: Run }) {
  const b = d.balance;
  const [vals, setVals] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);

  const list: Currency[] = [
    { key: "ac", label: "AniCoin", hint: "Валюта магазина", current: fmtNum(b.ac), add: "ac", set: "setAc", unit: "AC" },
    { key: "xp", label: "Опыт", hint: "Уровень пересчитается сам", current: `${fmtNum(b.xp)} · ур. ${b.level}`, add: "xp", set: "setXp", unit: "XP" },
    { key: "level", label: "Уровень", hint: "Установить точный уровень", current: String(b.level), set: "setLevel", unit: "ур." },
    { key: "trophy", label: "Очки славы", hint: "Очки славы за достижения", current: fmtNum(b.trophy), add: "trophy", set: "setTrophy", unit: "оч." },
    { key: "streak", label: "Серия дней", hint: `Рекорд ${b.streakBest}`, current: `${b.streak} дн.`, set: "setStreak", unit: "дн." },
    { key: "freezes", label: "Заморозки серии", hint: "Спасают серию при пропуске", current: String(b.freezes), add: "freezes", set: "setFreezes", unit: "шт." },
    { key: "bp", label: "Боевой пропуск", hint: "Опыт текущего сезона", current: fmtNum(b.battlepassXp), add: "battlepassXp", unit: "XP" },
  ];

  const apply = async (c: Currency, mode: "add" | "sub" | "set") => {
    const raw = Number(vals[c.key]);
    if (!Number.isFinite(raw) || vals[c.key] === undefined || vals[c.key] === "") return;
    const field = mode === "set" ? c.set : c.add;
    if (!field) return;
    const amount = mode === "sub" ? -Math.abs(raw) : raw;
    const r = await run({ action: "balance", [field]: amount, note, notify }, `${c.label}: готово`);
    if (r.ok) setVals((s) => ({ ...s, [c.key]: "" }));
  };

  return (
    <div className="adm-stack">
      {list.map((c) => (
        <div key={c.key} className="adm-cur">
          <div className="adm-cur-head">
            <div>
              <b>{c.label}</b>
              <small>{c.hint}</small>
            </div>
            <span className="adm-cur-val">{c.current}</span>
          </div>
          <div className="adm-cur-act">
            <input
              type="number"
              inputMode="numeric"
              placeholder={c.unit}
              value={vals[c.key] ?? ""}
              onChange={(e) => setVals((s) => ({ ...s, [c.key]: e.target.value }))}
              aria-label={`${c.label}: значение`}
            />
            {c.add ? (
              <>
                <button type="button" className="adm-btn adm-btn-primary" onClick={() => void apply(c, "add")}>
                  Выдать
                </button>
                <button type="button" className="adm-btn" onClick={() => void apply(c, "sub")}>
                  Списать
                </button>
              </>
            ) : null}
            {c.set ? (
              <button type="button" className="adm-btn" onClick={() => void apply(c, "set")}>
                Установить
              </button>
            ) : null}
          </div>
        </div>
      ))}
      <label className="adm-field">
        Комментарий в журнал
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="например: компенсация за сбой" />
      </label>
      <label className="adm-checks">
        <span>
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Уведомить игрока в колокольчике
        </span>
      </label>
    </div>
  );
}

/* ------------------------------- Предметы ------------------------------ */

function ownedOf(d: Detail, kind: CatKind): Set<string> {
  if (kind === "tag") return new Set(d.owned.tags);
  if (kind === "achievement") return new Set(d.owned.achievements);
  if (kind === "claimed") return new Set(d.owned.claimed);
  return new Set(d.owned.purchased);
}

function equippedId(d: Detail, kind: CatKind): string {
  const l = d.look;
  return ({ frame: l.frameId, title: l.titleId, background: l.backgroundId, tag: l.equippedTagId, effect: l.particleFx, decor: l.decorFx } as Record<string, string>)[kind] ?? "";
}

function Items({ d, run }: { d: Detail; run: Run }) {
  const [kind, setKind] = useState<CatKind>("frame");
  const [q, setQ] = useState("");
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [equip, setEquip] = useState(true);
  const [notify, setNotify] = useState(true);
  const [customId, setCustomId] = useState("");

  const owned = useMemo(() => ownedOf(d, kind), [d, kind]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CATALOG[kind].filter((i) => (!onlyOwned || owned.has(i.id)) && (!needle || i.name.toLowerCase().includes(needle) || i.id.toLowerCase().includes(needle)));
  }, [kind, q, onlyOwned, owned]);
  const current = equippedId(d, kind);
  const wearable = ["frame", "title", "background", "tag", "effect", "decor"].includes(kind);

  const toggle = (id: string, name: string, grant: boolean, progress?: number) =>
    run({ action: "item", kind, itemId: id, grant, equip: grant && equip && wearable, notify, label: name, progress }, grant ? `Выдано: ${name}` : `Отозвано: ${name}`);

  return (
    <div className="adm-stack">
      <div className="adm-kinds">
        {KIND_ORDER.map((k) => (
          <button key={k} type="button" className={k === kind ? "on" : ""} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
            <em>{ownedOf(d, k).size || ""}</em>
          </button>
        ))}
      </div>
      <div className="adm-row">
        <input className="adm-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Поиск: ${KIND_LABEL[kind].toLowerCase()}`} />
        <label className="adm-check">
          <input type="checkbox" checked={onlyOwned} onChange={(e) => setOnlyOwned(e.target.checked)} /> только выданные
        </label>
      </div>
      <div className="adm-checks">
        {wearable ? (
          <label>
            <input type="checkbox" checked={equip} onChange={(e) => setEquip(e.target.checked)} /> Сразу надеть
          </label>
        ) : null}
        <label>
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Уведомить игрока
        </label>
      </div>
      <ul className="adm-items">
        {list.map((item) => {
          const has = owned.has(item.id);
          const on = current === item.id;
          return (
            <li key={item.id} className={`${has ? "has" : ""} ${on ? "on" : ""}`}>
              <span className={`adm-item-ico adm-tone-${RARITY_TONE[item.rarity] ?? "gray"}`}>
                {item.frame ? <AvatarFrame nickname={d.user.nickname} frame={item.frame} size="xs" /> : <i />}
              </span>
              <div className="adm-item-txt">
                <b>{item.name}</b>
                <small>
                  {item.note || item.id}
                  {item.reward ? ` · ${item.reward}` : ""}
                </small>
              </div>
              <div className="adm-item-act">
                {on ? <Pill tone="green">надето</Pill> : has ? <Pill tone="blue">выдано</Pill> : null}
                {has && wearable && !on ? (
                  <button type="button" className="adm-btn adm-btn-sm" onClick={() => void run({ action: "equip", kind, itemId: item.id }, "Надето")}>
                    Надеть
                  </button>
                ) : null}
                {has ? (
                  <button type="button" className="adm-btn adm-btn-sm adm-btn-ghost" onClick={() => void toggle(item.id, item.name, false)}>
                    Отозвать
                  </button>
                ) : (
                  <button type="button" className="adm-btn adm-btn-sm adm-btn-primary" onClick={() => void toggle(item.id, item.name, true, item.threshold)}>
                    Выдать
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {!list.length ? <Empty>Ничего не найдено</Empty> : null}
      </ul>
      <details className="adm-details">
        <summary>Выдать по id вручную</summary>
        <div className="adm-row">
          <input className="adm-search" value={customId} onChange={(e) => setCustomId(e.target.value)} placeholder="id предмета, например frame-…" />
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            disabled={!customId.trim()}
            onClick={async () => {
              const known = findCat(kind, customId.trim());
              const r = await toggle(customId.trim(), known?.name ?? customId.trim(), true);
              if (r.ok) setCustomId("");
            }}
          >
            Выдать
          </button>
        </div>
      </details>
    </div>
  );
}

/* -------------------------------- Доступ ------------------------------- */

function Access({ d, now, me, run, onClose }: { d: Detail; now: number; me: string; run: Run; onClose: () => void }) {
  const ui = useUi();
  const u = d.user;
  const [days, setDays] = useState("30");
  const [banDays, setBanDays] = useState("7");
  const [reason, setReason] = useState("");
  const [newPass, setNewPass] = useState("");
  const [shown, setShown] = useState("");
  const isAdmin = u.role === "admin";
  const self = u.nickname.toLowerCase() === me.toLowerCase();
  const banned = u.bannedUntil > now;
  const premium = u.premiumUntil > now;

  return (
    <div className="adm-stack">
      <section className="adm-block">
        <h4 className="adm-h4">Premium {premium ? `· до ${new Date(u.premiumUntil).toLocaleDateString("ru-RU")}` : ""}</h4>
        <div className="adm-row">
          <input type="number" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Дней" />
          <button type="button" className="adm-btn adm-btn-gold" onClick={() => void run({ action: "premium", days: Number(days) || 0 }, `Premium +${days} дн.`)}>
            Выдать дней
          </button>
          {premium ? (
            <button type="button" className="adm-btn" onClick={() => void run({ action: "premium", days: 0 }, "Premium снят")}>
              Снять
            </button>
          ) : null}
        </div>
      </section>

      {!isAdmin ? (
        <section className="adm-block">
          <h4 className="adm-h4">Блокировка {banned ? `· до ${new Date(u.bannedUntil).toLocaleDateString("ru-RU")}` : ""}</h4>
          {banned ? (
            <button type="button" className="adm-btn adm-btn-primary" onClick={() => void run({ action: "ban", days: 0 }, "Бан снят")}>
              Разблокировать
            </button>
          ) : (
            <>
              <div className="adm-row">
                <PSelect value={banDays} onChange={(e) => setBanDays(e.target.value)} aria-label="Срок">
                  <option value="1">1 день</option>
                  <option value="7">7 дней</option>
                  <option value="30">30 дней</option>
                  <option value="365">1 год</option>
                  <option value="3650">Навсегда</option>
                </PSelect>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Причина (в журнал)" maxLength={120} />
              </div>
              <button
                type="button"
                className="adm-btn adm-btn-danger"
                onClick={async () => {
                  if (await ui.confirm(`Заблокировать ${u.nickname}?`, { text: "Все сессии игрока будут закрыты.", danger: true, confirmLabel: "Заблокировать" }))
                    void run({ action: "ban", days: Number(banDays), reason }, "Игрок заблокирован");
                }}
              >
                Заблокировать
              </button>
            </>
          )}
        </section>
      ) : null}

      {!self ? (
        <section className="adm-block">
          <h4 className="adm-h4">Роль</h4>
          <Segmented
            label="Роль"
            value={u.role === "admin" || u.role === "moderator" ? u.role : "user"}
            onChange={(role) => {
              if (role === "admin" && !window.confirm(`Назначить ${u.nickname ?? "пользователя"} администратором? Администратор получает полный доступ к админ-панели.`)) return;
              void run(
                { action: "role", role },
                role === "admin" ? "Назначен администратором" : role === "moderator" ? "Назначен модератором" : "Роль снята",
              );
            }}
            options={[
              { id: "user", label: "Игрок" },
              { id: "moderator", label: "Модератор" },
              { id: "admin", label: "Администратор" },
            ]}
          />
        </section>
      ) : null}

      {!isAdmin || self ? (
        <section className="adm-block">
          <h4 className="adm-h4">Пароль и сессии</h4>
          <div className="adm-row">
            <input value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Новый пароль (пусто — случайный)" maxLength={72} />
            <button
              type="button"
              className="adm-btn"
              onClick={async () => {
                if (!(await ui.confirm(`Сбросить пароль ${u.nickname}?`, { text: "Игрок будет разлогинен на всех устройствах.", confirmLabel: "Сбросить" }))) return;
                const r = await run({ action: "password", password: newPass || undefined }, "Пароль изменён");
                if (r.ok && typeof r.password === "string") {
                  setShown(r.password);
                  setNewPass("");
                }
              }}
            >
              Сбросить пароль
            </button>
          </div>
          {shown ? (
            <p className="adm-secret">
              Новый пароль: <code>{shown}</code>
              <button type="button" className="adm-btn adm-btn-sm" onClick={() => void navigator.clipboard?.writeText(shown).then(() => ui.toast("Скопировано", "info"))}>
                Копировать
              </button>
              <small>Показывается один раз — передайте игроку.</small>
            </p>
          ) : null}
          <button type="button" className="adm-btn" onClick={() => void run({ action: "sessions" }, "Все сессии закрыты")}>
            Выйти на всех устройствах ({d.counts.sessions})
          </button>
        </section>
      ) : null}

      {!isAdmin ? (
        <section className="adm-block adm-danger-zone">
          <h4 className="adm-h4">Опасная зона</h4>
          <button
            type="button"
            className="adm-btn adm-btn-danger"
            onClick={async () => {
              if (!(await ui.confirm(`Удалить аккаунт ${u.nickname}?`, { text: "Профиль, прогресс, комментарии и друзья будут стёрты без возможности восстановления.", danger: true, confirmLabel: "Удалить навсегда" }))) return;
              const r = await adminPost({ action: "deleteUser", id: u.id });
              if (r.ok) {
                ui.toast("Аккаунт удалён");
                onClose();
              } else ui.toast(r.error ?? "Не удалось", "err");
            }}
          >
            Удалить аккаунт
          </button>
        </section>
      ) : null}
    </div>
  );
}

/* -------------------------------- Журнал ------------------------------- */

function Ledger({ d }: { d: Detail }) {
  if (!d.ledger.length) return <Empty>В журнале наград пока пусто</Empty>;
  return (
    <ul className="adm-ledger">
      {d.ledger.map((e) => (
        <li key={e.id}>
          <b className={e.amount >= 0 ? "plus" : "minus"}>
            {e.amount > 0 ? "+" : ""}
            {fmtNum(e.amount)} {e.currency}
          </b>
          <span>
            {e.source === "ADMIN" ? `Админ ${e.metadata?.by ?? ""}${e.metadata?.note ? ` · ${e.metadata.note}` : ""}` : e.source}
          </span>
          <time>{fmtDate(e.createdAt)}</time>
        </li>
      ))}
    </ul>
  );
}
