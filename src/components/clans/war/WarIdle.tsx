"use client";

import { useState } from "react";
import { CW, type CwState } from "@/lib/cards/clanwar";
import { warAct } from "@/lib/clans/client";
import { Ico } from "@/components/cards/icons";
import { TrophyIcon } from "../ClanArt";
import { clock, useNowTick } from "./shared";

type Kind = "search" | "vs_bot" | "cancel";

/** Нет войны: герой-экран, выбор размера, запуск и очередь поиска */
export function WarIdle({ st, toast }: { st: CwState; toast: (t: string, err?: boolean) => void }) {
  const first = (CW.sizes as readonly number[]).find((s) => s <= st.eligible) ?? CW.sizes[0];
  const [size, setSize] = useState<number>(first);
  const [busy, setBusy] = useState<Kind | "">("");
  const [err, setErr] = useState("");
  const now = useNowTick(1000);

  async function go(kind: Kind) {
    if (busy) return;
    setBusy(kind);
    setErr("");
    const r = await warAct<{ started?: boolean }>(kind, { size });
    setBusy("");
    if (!r.ok) return setErr(r.error);
    if (kind === "search") toast(r.result?.started ? "Соперник найден — началась подготовка" : "Клан встал в очередь поиска");
    else if (kind === "vs_bot") toast("Война началась — собирайте отряды");
    else toast("Поиск отменён");
  }

  const q = st.search;
  const sizes = st.sizes.length ? st.sizes : [...CW.sizes];
  const enough = st.eligible >= size;

  if (q) {
    return (
      <section className="cw-hero queue" aria-live="polite">
        <div className="cw-radar" aria-hidden>
          <i />
          <i />
          <i />
          <Ico name="swords" size={34} />
        </div>
        <p className="cw-eyebrow">Поиск соперника</p>
        <h2 className="cw-hero-title">
          Война {q.size}×{q.size}
        </h2>
        <p className="cw-hero-text">
          Ищем клан похожего размера и числа кубков. Как только соперник встанет в очередь, начнётся подготовка.
        </p>
        <div className="cw-elapsed" role="timer">
          <Ico name="clock" size={18} />
          {clock(now - q.since)}
        </div>
        {st.canManage ? (
          <div className="cw-actions">
            <button type="button" className="cw-btn ghost" disabled={!!busy} onClick={() => go("cancel")}>
              {busy === "cancel" ? "Отменяем…" : "Отменить поиск"}
            </button>
            <button type="button" className="cw-btn primary" disabled={!!busy} onClick={() => go("vs_bot")}>
              {busy === "vs_bot" ? "Собираем…" : "Не ждать — сразиться с отрядом"}
            </button>
          </div>
        ) : (
          <p className="cw-note center">Поиск ведут глава и офицеры.</p>
        )}
        {err ? (
          <p className="cw-err" role="alert">
            {err}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <>
      <section className="cw-hero">
        <div className="cw-hero-art" aria-hidden>
          <Ico name="swords" size={92} />
        </div>
        <p className="cw-eyebrow">Клановая война карт</p>
        <h2 className="cw-hero-title">Соберите отряд — захватите звёзды</h2>
        <p className="cw-hero-text">
          Каждый боец выставляет свою колоду как «базу». У каждого по {CW.attacksEach} атаки: побеждайте чужие отряды и забирайте до {CW.maxStars} звёзд за базу.
        </p>
        <div className="cw-chips">
          <span className="cw-chip">
            <TrophyIcon size={16} />
            {st.trophies} кубков клана
          </span>
          <span className="cw-chip">
            <Ico name="user" size={15} />
            Готовы к бою: {st.eligible}
          </span>
        </div>

        {st.canManage ? (
          <>
            <div className="cw-sizes" role="radiogroup" aria-label="Размер войны">
              {sizes.map((s) => {
                const ok = st.eligible >= s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={size === s}
                    aria-disabled={!ok}
                    className={`cw-size ${size === s ? "on" : ""} ${ok ? "" : "off"}`}
                    onClick={() => ok && setSize(s)}
                    title={ok ? undefined : `Нужно ${s} бойцов с собранной колодой, сейчас ${st.eligible}`}
                  >
                    <b>
                      {s}
                      <i>×</i>
                      {s}
                    </b>
                    <small>{ok ? "готово" : `нужно ${s}, есть ${st.eligible}`}</small>
                  </button>
                );
              })}
            </div>
            <div className="cw-actions">
              <button type="button" className="cw-btn primary lg" disabled={!!busy || !enough} onClick={() => go("search")}>
                <Ico name="target" size={18} />
                {busy === "search" ? "Ищем…" : "Найти соперника"}
              </button>
              <button type="button" className="cw-btn ghost lg" disabled={!!busy || !enough} onClick={() => go("vs_bot")}>
                <Ico name="skull" size={18} />
                {busy === "vs_bot" ? "Собираем…" : "Сразиться с отрядом"}
              </button>
            </div>
            {!enough ? (
              <p className="cw-note center warn">
                Для {size}×{size} нужно {size} бойцов с колодой из 4 карт — сейчас {st.eligible}. Попросите соклановцев собрать отряд на странице карт.
              </p>
            ) : (
              <p className="cw-note center">Поиск ждёт соперника в очереди; бой с отрядом сервера начинается сразу.</p>
            )}
          </>
        ) : (
          <div className="cw-wait">
            <Ico name="clock" size={20} />
            <p>
              Войну начинают глава и офицеры. Пока ждёте — соберите колоду из 4 карт: в отряд берут сильнейших бойцов клана.
            </p>
          </div>
        )}
        {err ? (
          <p className="cw-err" role="alert">
            {err}
          </p>
        ) : null}
      </section>

      <section className="cw-rules" aria-label="Как проходит война">
        <div className="cw-rule">
          <span className="cw-rule-ico">
            <Ico name="flag" size={20} />
          </span>
          <b>Подготовка · {CW.prepMs / 3_600_000} ч</b>
          <p>Базы собраны из колод участников. Колоду можно улучшить — в начале боя защита обновится.</p>
        </div>
        <div className="cw-rule">
          <span className="cw-rule-ico">
            <Ico name="swords" size={20} />
          </span>
          <b>Бой · {CW.battleMs / 3_600_000} ч</b>
          <p>
            {CW.attacksEach} атаки на бойца, по одной на базу. Звёзды: победа, быстрее 8 раундов, без потерь. Проигранная атака — очко защитнику.
          </p>
        </div>
        <div className="cw-rule">
          <span className="cw-rule-ico">
            <Ico name="crown" size={20} />
          </span>
          <b>Награды</b>
          <p>
            Победа: +{CW.trophies.win} кубков, +{CW.clanXp.win} опыта, алмазы и пак бойцам. За звезду — {CW.perStar.dust} пыли и {CW.perStar.diamonds} алмазов. Лучшему бойцу — свиток.
          </p>
        </div>
      </section>
    </>
  );
}
