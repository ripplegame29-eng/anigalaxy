"use client";

/** Экран без клана: лендинг «Клановые войны», поиск кланов, создание своего. */

import { useEffect, useState } from "react";
import { openAuthDialog } from "@/lib/auth-dialog";
import { MIN_RANKED_MEMBERS, leagueOf, LEAGUES } from "@/lib/clan-rules";
import { clanAct, clanCreate, clanSearch, prepareClanImage, type ClanListRow } from "@/lib/clans/client";
import { LeagueBadge, TrophyIcon } from "./ClanArt";
import { Btn, Crest, Ico, Panel, fmt } from "./common";

const STEPS = [
  { n: 1, icon: "shield", title: "Собери отряд", text: "Прокачай героев в карточной игре: сила отряда решает исход боя." },
  { n: 2, icon: "war", title: "Война 5×5", text: "Клан выходит на войну: у каждого по 2 атаки, защита собирается из ваших отрядов." },
  { n: 3, icon: "donate", title: "Донат карт", text: "Просите и отдавайте карты соклановцам — за помощь клану платят пылью и опытом." },
];

export function Landing({ guest, onDone }: { guest: boolean; onDone: () => void }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [media, setMedia] = useState<{ avatar?: string; banner?: string }>({});
  const pickMedia = async (kind: "avatar" | "banner", f?: File) => {
    if (!f) return;
    try { const url = await prepareClanImage(f, kind); setMedia((m) => ({ ...m, [kind]: url })); setFormErr(""); }
    catch (e) { setFormErr(e instanceof Error && e.message !== "read" ? e.message : "Не удалось прочитать картинку"); }
  };
  const [sort, setSort] = useState<"rank" | "members" | "trophies" | "new">("rank");
  const [onlyFree, setOnlyFree] = useState(false);
  const [onlyRanked, setOnlyRanked] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ q: string; rows: ClanListRow[] } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", tag: "", description: "" });
  const [formErr, setFormErr] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let live = true;
    const t = setTimeout(
      () => {
        void clanSearch(q.trim()).then((rows) => {
          if (live) setFound({ q, rows });
        });
      },
      q ? 250 : 0,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);
  const loading = !found || found.q !== q;
  const rows = found?.rows ?? [];
  const shown = rows
    .filter((c) => (!onlyFree || c.members < c.cap) && (!onlyRanked || c.members >= MIN_RANKED_MEMBERS))
    .sort((a, b) =>
      sort === "members" ? b.members - a.members : sort === "trophies" ? b.trophies - a.trophies : sort === "new" ? b.id - a.id : b.league - a.league || b.level - a.level || b.trophies - a.trophies,
    );

  const join = async (c: ClanListRow) => {
    if (guest) return openAuthDialog("login");
    setErr("");
    setBusy(c.id);
    const r = await clanAct("join", { clanId: c.id });
    setBusy(null);
    if (!r.ok) setErr(r.error);
    else onDone();
  };
  const create = async () => {
    if (guest) return openAuthDialog("register");
    setFormErr("");
    setCreating(true);
    const r = await clanCreate(form);
    if (!r.ok) { setCreating(false); setFormErr(r.error); return; }
    for (const k of ["avatar", "banner"] as const) if (media[k]) await clanAct("media", { kind: k, image: media[k] });
    setCreating(false);
    onDone();
  };
  useEffect(() => {
    if (!createOpen) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setCreateOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [createOpen]);
  const scroll = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="ca-landing" style={{ ["--lc" as string]: "#ffc65a" }}>
      <section className="ca-lhero">
        <div className="ca-lhero-glow" aria-hidden />
        <div className="ca-lhero-copy">
          <span className="ca-eyebrow">
            <Ico n="bolt" size={14} /> Кланы AniGalaxy
          </span>
          <h1 className="ca-display">
            Клановые <em>войны</em>
          </h1>
          <p className="ca-lead">
            Объединяйтесь в клан, выходите на войну 5×5 карточными отрядами, делитесь картами и поднимайтесь по лигам от Бронзы до Легенды — награды недели делит весь состав.
          </p>
          <div className="ca-lhero-cta">
            {guest ? (
              <>
                <Btn kind="primary" size="lg" onClick={() => openAuthDialog("login")}>
                  <Ico n="user" size={18} /> Войти
                </Btn>
                <Btn kind="ghost" size="lg" onClick={() => openAuthDialog("register")}>
                  Создать аккаунт
                </Btn>
              </>
            ) : (
              <>
                <Btn kind="primary" size="lg" onClick={() => scroll("ca-find")}>
                  <Ico n="search" size={18} /> Найти клан
                </Btn>
                <Btn kind="ghost" size="lg" onClick={() => (guest ? openAuthDialog("register") : setCreateOpen(true))}>
                  <Ico n="plus" size={18} /> Создать свой
                </Btn>
              </>
            )}
          </div>
        </div>
        <div className="ca-lhero-art" aria-hidden>
          {/* Трон лиг: Легенда наверху в лучах, пять ступеней — по дуге
              у подножия. Позиции на эллипсе считаются от угла. */}
          <div className="ca-throne" style={{ ["--lc" as string]: LEAGUES[5].color }}>
            <i className="ca-throne-rays" />
            <i className="ca-throne-halo" />
            <i className="ca-throne-ring r1" />
            <i className="ca-throne-ring r2" />
            <span className="ca-throne-top">
              <LeagueBadge league={5} size={230} />
            </span>
            <span className="ca-throne-name">
              <b>{LEAGUES[5].name}</b>
              <small>вершина сезона</small>
            </span>
            {LEAGUES.slice(0, 5).map((l, i) => {
              const deg = [168, 132, 90, 48, 12][i];
              const rad = (deg * Math.PI) / 180;
              const x = 50 + Math.cos(rad) * 44;
              const y = 79 + Math.sin(rad) * 13;
              const front = Math.sin(rad);
              return (
                <span
                  key={l.id}
                  className="ca-throne-step"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    zIndex: 3 + Math.round(front * 4),
                    ["--lc" as string]: l.color,
                    ["--s" as string]: (0.78 + front * 0.22).toFixed(3),
                    ["--d" as string]: `${(-i * 0.7).toFixed(1)}s`,
                  }}
                >
                  <LeagueBadge league={l.id} size={74} />
                  <em>{l.name}</em>
                </span>
              );
            })}
            {Array.from({ length: 10 }, (_, k) => (
              <i key={k} className="ca-throne-spark" style={{ ["--k" as string]: k }} />
            ))}
          </div>
        </div>
      </section>

      <ol className="ca-steps">
        {STEPS.map((s) => (
          <li key={s.n} className="ca-step">
            <span className="ca-step-n">{s.n}</span>
            <span className="ca-step-ico">
              <Ico n={s.icon} size={26} />
            </span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <section id="ca-find" className="ca-all">
        <h2 className="ca-all-h">Все кланы</h2>
        <div className="ca-all-tools">
          <label className="ca-all-search">
            <Ico n="search" size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название или тег клана" aria-label="Поиск клана" maxLength={32} />
          </label>
          <label className="ca-all-sort">
            <span>Сортировка:</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Сортировка">
              <option value="rank">По рангу</option>
              <option value="members">По составу</option>
              <option value="trophies">По кубкам</option>
              <option value="new">Новые</option>
            </select>
          </label>
        </div>
        <div className="ca-all-chips">
          <button type="button" className={onlyFree ? "on" : ""} onClick={() => setOnlyFree(!onlyFree)}>Есть места</button>
          <button type="button" className={onlyRanked ? "on" : ""} onClick={() => setOnlyRanked(!onlyRanked)}>В рейтинге</button>
        </div>
        <p className="ca-all-count">{loading ? "Ищем…" : `Найдено: ${shown.length}`}</p>
        {err && <p className="ca-err" role="alert">{err}</p>}
        <ul className={`ca-grid${loading ? " is-loading" : ""}`}>
          {shown.map((c) => {
            const l = leagueOf(c.league);
            const full = c.members >= c.cap;
            const free = c.cap - c.members;
            const pct = Math.min(100, (c.members / Math.max(1, c.cap)) * 100);
            return (
              <li key={c.id} className="ca-gc" style={{ ["--lc" as string]: l.color }}>
                <div className="ca-gc-top">
                  <Crest clanId={c.id} emblemId={c.emblem} avatarV={c.avatarV} size={86} />
                  <div className="ca-gc-id">
                    <div className="ca-gc-badges">
                      <span className="ca-gc-lg"><i>{c.league + 1}</i>{l.name}</span>
                      {c.createdAt && Date.now() - c.createdAt < 14 * 86_400_000 && <span className="ca-gc-new">Новый</span>}
                    </div>
                    <span className="ca-gc-tag">{c.tag}</span>
                    <b className="ca-gc-name">{c.name}</b>
                  </div>
                </div>
                <p className="ca-gc-desc">{c.description || "Без описания"}</p>
                <div className="ca-gc-stats">
                  <span className="ca-gc-mem"><Ico n="roster" size={15} /> <b>{c.members}</b> <em>/{c.cap}</em></span>
                  <span className="ca-gc-on"><i className={c.activeToday ? "" : "off"} /> <b>{c.activeToday ?? 0}</b> сегодня</span>
                </div>
                <div className="ca-gc-bar"><i style={{ width: `${pct}%` }} /></div>
                <span className="ca-gc-free">{full ? "Мест нет" : `${free} ${free % 10 === 1 && free % 100 !== 11 ? "место" : free % 10 >= 2 && free % 10 <= 4 && (free % 100 < 12 || free % 100 > 14) ? "места" : "мест"} свободно`}</span>
                <div className="ca-gc-foot">
                  <div>
                    <b>Вход свободный · любой уровень</b>
                    <small>{full ? "Сейчас в клане нет мест" : `Ур. клана ${c.level} · ${fmt(c.trophies)} кубков`}</small>
                  </div>
                  {!full && (
                    <button type="button" className="ca-gc-join" disabled={busy === c.id} onClick={() => void join(c)}>
                      {busy === c.id ? "…" : "Вступить"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {!loading && shown.length === 0 && (
            <li className="ca-empty-row">
              <Ico n="search" size={22} /> {q ? "Ничего не нашли — попробуйте другой тег или создайте клан." : "Кланов пока нет — создайте первый."}
            </li>
          )}
        </ul>
      </section>

      {createOpen && (
        <div className="ca-modal" role="dialog" aria-modal="true" aria-label="Создать клан" onMouseDown={(e) => { if (e.target === e.currentTarget && !creating) setCreateOpen(false); }}>
          <div className="ca-modal-box">
            <button type="button" className="ca-modal-x" aria-label="Закрыть" onClick={() => setCreateOpen(false)}><Ico n="x" size={18} /></button>
        <Panel id="ca-create" title="Создать клан" icon="plus">
          <div className="ca-form">
            <div className="ca-cm" style={media.banner ? { backgroundImage: `url(${media.banner})` } : undefined}>
              <label className="ca-cm-bg">
                <Ico n="image" size={14} /> {media.banner ? "Сменить фон" : "Фон клана"}
                <input type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => void pickMedia("banner", e.target.files?.[0])} />
              </label>
              <label className="ca-cm-av" title="Аватар клана">
                {media.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media.avatar} alt="" />
                ) : (
                  <span><Ico n="plus" size={22} />Аватар</span>
                )}
                <input type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => void pickMedia("avatar", e.target.files?.[0])} />
              </label>
              {form.tag && <span className="ca-cm-tag">{form.tag}</span>}
              <b className="ca-cm-name">{form.name || "Название клана"}</b>
            </div>
            <small className="ca-dim">PNG, JPEG, WebP или GIF. Можно поменять позже в клане</small>
            <label className="ca-field-l">
              Название
              <input className="ca-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={24} placeholder="Звёздные Ронины" />
            </label>
            <label className="ca-field-l">
              Тег · 2–5 символов
              <input className="ca-input ca-input-tag" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value.toUpperCase() })} maxLength={5} placeholder="SRN" />
            </label>
            <label className="ca-field-l">
              Описание
              <textarea className="ca-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={280} rows={3} placeholder="Кого ждёте и как играете" />
              <small className="ca-dim">{form.description.length}/280</small>
            </label>
            {formErr && (
              <p className="ca-err" role="alert">
                {formErr}
              </p>
            )}
            <Btn kind="gold" size="lg" disabled={creating} onClick={() => void create()}>
              {guest ? "Войти и создать" : creating ? "Создаём…" : "Создать клан"}
            </Btn>
            <p className="ca-dim ca-fine">Клан стартует в Бронзовой лиге. Чтобы попасть в рейтинг, соберите минимум {MIN_RANKED_MEMBERS} игроков.</p>
          </div>
        </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
