"use client";

/** Экран без клана: лендинг «Клановые войны», поиск кланов, создание своего. */

import { useEffect, useState } from "react";
import { openAuthDialog } from "@/lib/auth-dialog";
import { MIN_RANKED_MEMBERS, leagueOf, LEAGUES } from "@/lib/clan-rules";
import { clanAct, clanCreate, clanSearch, type ClanListRow } from "@/lib/clans/client";
import { LeagueBadge, TrophyIcon } from "./ClanArt";
import { Btn, Crest, Ico, Panel, fmt } from "./common";

const STEPS = [
  { n: 1, icon: "shield", title: "Собери отряд", text: "Прокачай героев в карточной игре: сила отряда решает исход боя." },
  { n: 2, icon: "war", title: "Война 5×5", text: "Клан выходит на войну: у каждого по 2 атаки, защита собирается из ваших отрядов." },
  { n: 3, icon: "donate", title: "Донат карт", text: "Просите и отдавайте карты соклановцам — за помощь клану платят пылью и опытом." },
];

export function Landing({ guest, onDone }: { guest: boolean; onDone: () => void }) {
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
    setCreating(false);
    if (!r.ok) setFormErr(r.error);
    else onDone();
  };
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
                <Btn kind="ghost" size="lg" onClick={() => scroll("ca-create")}>
                  <Ico n="plus" size={18} /> Создать свой
                </Btn>
              </>
            )}
          </div>
        </div>
        <div className="ca-lhero-art" aria-hidden>
          <div className="ca-ladder">
            {LEAGUES.map((l, i) => (
              <span key={l.id} className="ca-ladder-b" style={{ ["--i" as string]: i, ["--lc" as string]: l.color }}>
                <LeagueBadge league={l.id} size={i === 5 ? 92 : 60} />
              </span>
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

      <div className="ca-landing-grid">
        <Panel id="ca-find" title="Найти клан" icon="search" aside={<span className="ca-dim">{loading ? "…" : `${rows.length}`}</span>}>
          <label className="ca-field ca-field-search">
            <Ico n="search" size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название или тег" aria-label="Поиск клана" maxLength={32} />
          </label>
          {err && (
            <p className="ca-err" role="alert">
              {err}
            </p>
          )}
          <ul className={`ca-find${loading ? " is-loading" : ""}`}>
            {rows.map((c) => {
              const l = leagueOf(c.league);
              const full = c.members >= c.cap;
              return (
                <li key={c.id} style={{ ["--lc" as string]: l.color }}>
                  <Crest clanId={c.id} size={52} />
                  <div className="ca-find-main">
                    <b>
                      {c.name} <span className="ca-tag">[{c.tag}]</span>
                    </b>
                    <span className="ca-dim">
                      {l.name} · ур. {c.level} · {c.members}/{c.cap}
                      <span className="ca-inline-tr">
                        <TrophyIcon size={13} /> {fmt(c.trophies)}
                      </span>
                    </span>
                    {c.description && <span className="ca-find-desc">{c.description}</span>}
                  </div>
                  <Btn kind="primary" size="sm" disabled={full || busy === c.id} onClick={() => void join(c)}>
                    {full ? "Полон" : busy === c.id ? "…" : "Вступить"}
                  </Btn>
                </li>
              );
            })}
            {!loading && rows.length === 0 && (
              <li className="ca-empty-row">
                <Ico n="search" size={22} /> {q ? "Ничего не нашли — попробуйте другой тег или создайте клан." : "Кланов пока нет — создайте первый."}
              </li>
            )}
          </ul>
        </Panel>

        <Panel id="ca-create" title="Создать клан" icon="plus">
          <div className="ca-form">
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
  );
}
