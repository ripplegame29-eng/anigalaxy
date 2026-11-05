"use client";

import { useState, useSyncExternalStore } from "react";
import { ARENA_MODS, BOOSTERS, RARITY, RELICS, RELIC_MAX, RELIC_SLOTS, arenaDef, boosterDef, relicDef, relicUpCost, resonanceOf, type OwnedRelic } from "@/lib/cards/gear";
import { act, type CardsState } from "@/lib/cards/client";
import { Panel, fmt, fmtLeft, toast, useBusy, useNow } from "./common";
import { Cur, Ico } from "./icons";

/* ----------------------- выбранный бустер (общий для режимов) ---------------------- */

let pick: string | null = null;
const subs = new Set<() => void>();
export const getPick = (): string | null => pick;
export function setPick(id: string | null): void {
  pick = id;
  subs.forEach((f) => f());
}
export function usePick(): string | null {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => pick,
    () => null,
  );
}

/* --------------------------------- реликвии --------------------------------- */

export function RelicTile({
  id,
  lv = 1,
  size = "md",
  locked,
  active,
  onClick,
  label = true,
}: {
  id: string;
  lv?: number;
  size?: "sm" | "md" | "lg";
  locked?: boolean;
  active?: boolean;
  onClick?: () => void;
  label?: boolean;
}) {
  const def = relicDef(id);
  if (!def) return null;
  const r = RARITY[def.rarity];
  const body = (
    <>
      <span className="gx-rel-ring">
        <i className="gx-rel-glow" aria-hidden />
        <Ico name={locked ? "lock" : def.ico} size={size === "lg" ? 38 : size === "md" ? 28 : 20} />
      </span>
      {label && size !== "sm" && <b>{locked ? "???" : def.name}</b>}
      {!locked && size !== "sm" && (
        <span className="gx-pips" aria-label={`Уровень ${lv} из ${RELIC_MAX}`}>
          {Array.from({ length: RELIC_MAX }).map((_, i) => (
            <i key={i} className={i < lv ? "on" : ""} />
          ))}
        </span>
      )}
    </>
  );
  const cls = `gx-rel s-${size} rar-${def.rarity} ${locked ? "lock" : ""} ${active ? "on" : ""}`;
  const style = { ["--rc" as string]: r.color };
  return onClick ? (
    <button type="button" className={cls} style={style} onClick={onClick} title={locked ? "Ещё не найдена" : `${def.name} · ${r.name}`}>
      {body}
    </button>
  ) : (
    <div className={cls} style={style} title={locked ? "Ещё не найдена" : `${def.name} · ${r.name}`}>
      {body}
    </div>
  );
}

/** Пустой слот реликвии */
function EmptySlot({ n, onClick }: { n: number; onClick?: () => void }) {
  return (
    <button type="button" className="gx-rel s-md empty" onClick={onClick}>
      <span className="gx-rel-ring">
        <Ico name="plus" size={24} />
      </span>
      <b>Слот {n}</b>
    </button>
  );
}

/* ------------------------------- правило арены ------------------------------- */

export function ArenaRule({ id, until, compact }: { id: string; until?: number; compact?: boolean }) {
  const now = useNow(30_000);
  const m = arenaDef(id);
  if (!m) return null;
  return (
    <div className={`gx-arena t-${m.tone} ${compact ? "compact" : ""}`}>
      <span className="gx-arena-ico">
        <Ico name={m.ico} size={compact ? 22 : 30} />
      </span>
      <span className="gx-arena-txt">
        <small>Правило арены{until && !compact ? ` · ещё ${fmtLeft(until - now)}` : ""}</small>
        <b>{m.name}</b>
        {!compact && <em>{m.desc}</em>}
      </span>
      {compact && <em className="gx-arena-sm">{m.desc}</em>}
    </div>
  );
}

/* --------------------------- полоска «перед боем» --------------------------- */

export function PreFight({ s, arena, onArsenal }: { s: CardsState; arena?: boolean; onArsenal?: () => void }) {
  const sel = usePick();
  const g = s.gear;
  const stock = BOOSTERS.filter((b) => (g.boosters[b.id] ?? 0) > 0);
  const eq = g.slots.map((id) => g.relics.find((r) => r.id === id)).filter((r): r is OwnedRelic => !!r);
  const res = resonanceOf(eq);
  const chosen = sel && (g.boosters[sel] ?? 0) > 0 ? sel : null;
  return (
    <div className="gx-pre">
      {arena && <ArenaRule id={s.arena.id} until={s.arena.until} />}
      <div className="gx-pre-row">
        <div className="gx-pre-col">
          <h4>
            <Ico name="crown" size={15} /> Реликвии
            {res && <em title={res.desc}>{res.name}</em>}
          </h4>
          <div className="gx-pre-rel">
            {Array.from({ length: RELIC_SLOTS }).map((_, i) =>
              eq[i] ? <RelicTile key={eq[i].id} id={eq[i].id} lv={eq[i].lv} size="sm" onClick={onArsenal} /> : <EmptySlot key={i} n={i + 1} onClick={onArsenal} />,
            )}
            {onArsenal && (
              <button type="button" className="cg-btn sm" onClick={onArsenal}>
                Арсенал
              </button>
            )}
          </div>
        </div>
        <div className="gx-pre-col">
          <h4>
            <Ico name="bolt" size={15} /> Бустер на бой
            <em>{chosen ? "выбран" : "не выбран"}</em>
          </h4>
          {stock.length ? (
            <div className="gx-pre-bst">
              {stock.map((b) => (
                <button key={b.id} type="button" className={`gx-bst ${chosen === b.id ? "on" : ""}`} aria-pressed={chosen === b.id} onClick={() => setPick(chosen === b.id ? null : b.id)} title={b.desc}>
                  <Ico name={b.ico} size={16} />
                  <span>{b.name}</span>
                  <i>×{g.boosters[b.id]}</i>
                </button>
              ))}
            </div>
          ) : (
            <p className="cg-hint">
              Запас пуст.{" "}
              {onArsenal && (
                <button type="button" className="gx-link" onClick={onArsenal}>
                  {g.freeReady ? "Заберите бесплатный бустер дня" : "Купите бустеры в Арсенале"}
                </button>
              )}
            </p>
          )}
          {chosen && <p className="gx-pre-note">{boosterDef(chosen)?.desc} Тратится при рейтинговом бое.</p>}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------- Арсенал ---------------------------------- */

export function Arsenal({ s }: { s: CardsState }) {
  const [busy, run] = useBusy();
  const g = s.gear;
  const [sel, setSel] = useState<string>(() => g.slots[0] ?? g.relics[0]?.id ?? RELICS[0].id);
  const owned = new Map(g.relics.map((r) => [r.id, r.lv]));
  const eq = g.slots.map((id) => g.relics.find((r) => r.id === id)).filter((r): r is OwnedRelic => !!r);
  const res = resonanceOf(eq);
  const def = relicDef(sel);
  const lv = owned.get(sel) ?? 0;
  const dust = s.wallet.dust;
  const cost = def && lv > 0 && lv < RELIC_MAX ? relicUpCost(def.rarity, lv) : 0;

  const equip = (id: string) => {
    if (!owned.has(id)) return;
    let ids = g.slots.includes(id) ? g.slots.filter((x) => x !== id) : [...g.slots, id];
    if (ids.length > RELIC_SLOTS) return toast("Все слоты заняты — сначала снимите другую реликвию", true);
    ids = ids.slice(0, RELIC_SLOTS);
    void run(async () => {
      const r = await act("gear-equip", { ids });
      if (!r.ok) toast(r.error, true);
    });
  };
  const upgrade = (id: string) =>
    run(async () => {
      const r = await act<{ id: string; lv: number }>("relic-up", { id });
      toast(r.ok ? `Реликвия улучшена до уровня ${r.result.lv}` : r.error, !r.ok);
    });
  const buy = (id: string) =>
    run(async () => {
      const r = await act("booster-buy", { id, n: 1 });
      toast(r.ok ? "Бустер куплен" : r.error, !r.ok);
    });
  const free = () =>
    run(async () => {
      const r = await act<{ id: string }>("booster-free");
      toast(r.ok ? `Получен бустер: ${boosterDef(r.result.id)?.name ?? ""}` : r.error, !r.ok);
    });

  return (
    <div className="gx-ars">
      <section className="gx-hero" aria-label="Арсенал">
        <i className="gx-hero-glow" aria-hidden />
        <div className="gx-hero-main">
          <span className="cg-eyebrow">Арсенал</span>
          <h3>Реликвии и бустеры</h3>
          <p>Три реликвии усиливают отряд в каждом бою. Выпадают за победы в рейтинге, дуэлях, рейде и боссах кампании, а за пыль улучшаются до пятого уровня.</p>
        </div>
        <ArenaRule id={s.arena.id} until={s.arena.until} />
      </section>

      <div className="cg-grid2 gx-grid">
        <Panel title="Экипировано" right={<span className="bt-pow">Слотов: <b>{eq.length}/{RELIC_SLOTS}</b></span>}>
          <div className="gx-slots">
            {Array.from({ length: RELIC_SLOTS }).map((_, i) => (eq[i] ? <RelicTile key={eq[i].id} id={eq[i].id} lv={eq[i].lv} size="lg" active={sel === eq[i].id} onClick={() => setSel(eq[i].id)} /> : <EmptySlot key={i} n={i + 1} />))}
          </div>
          <div className={`gx-reso ${res ? "on" : ""}`}>
            <Ico name="star" size={18} />
            <span>
              <b>{res ? res.name : "Резонанс не активен"}</b>
              <small>{res ? res.desc : "Три реликвии одной редкости или по одной каждой редкости дают дополнительный бонус."}</small>
            </span>
          </div>
        </Panel>

        <Panel title={def && lv > 0 ? def.name : "Реликвия"} hint={def && lv === 0 ? "Эта реликвия ещё не найдена. Она может выпасть за победу в бою." : undefined}>
          {def && lv > 0 ? (
            <div className="gx-detail">
              <RelicTile id={def.id} lv={lv} size="lg" label={false} />
              <div className="gx-detail-txt">
                <span className={`gx-rar rar-${def.rarity}`}>{RARITY[def.rarity].name}</span>
                <p>{def.desc(lv)}</p>
                {lv < RELIC_MAX ? <p className="gx-next">Следующий уровень: {def.desc(lv + 1)}</p> : <p className="gx-next max">Максимальный уровень</p>}
                <div className="gx-detail-act">
                  <button type="button" className="cg-btn pri" disabled={busy} onClick={() => equip(def.id)}>
                    {g.slots.includes(def.id) ? "Снять" : "Экипировать"}
                  </button>
                  {lv < RELIC_MAX && (
                    <button type="button" className="cg-btn" disabled={busy || dust < cost} onClick={() => void upgrade(def.id)}>
                      Улучшить за {fmt(cost)} <Cur k="dust" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="gx-detail locked">
              <Ico name="lock" size={34} />
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Коллекция реликвий" right={<span className="bt-pow">Найдено <b>{owned.size}/{RELICS.length}</b></span>}>
        <div className="gx-coll">
          {RELICS.map((r) => (
            <RelicTile key={r.id} id={r.id} lv={owned.get(r.id) ?? 1} locked={!owned.has(r.id)} active={sel === r.id} onClick={() => setSel(r.id)} />
          ))}
        </div>
      </Panel>

      <Panel
        title="Бустеры"
        hint="Одноразовые усиления на один бой. Выбираются перед схваткой; в тренировке можно пробовать любой бесплатно."
        right={
          <button type="button" className="cg-btn pri sm" disabled={busy || !g.freeReady} onClick={() => void free()}>
            <Ico name="gift" size={15} /> {g.freeReady ? "Бесплатный бустер дня" : "Завтра будет новый"}
          </button>
        }
      >
        <div className="gx-bsts">
          {BOOSTERS.map((b) => (
            <article key={b.id} className="gx-bcard">
              <span className="gx-bico">
                <Ico name={b.ico} size={24} />
              </span>
              <div>
                <b>{b.name}</b>
                <small>{b.desc}</small>
              </div>
              <em>В запасе: {g.boosters[b.id] ?? 0}</em>
              <button type="button" className="cg-btn sm" disabled={busy || dust < b.cost} onClick={() => void buy(b.id)}>
                {b.cost} <Cur k="dust" />
              </button>
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="Правила арены" hint="Каждый день действует одно из правил: оно влияет на всех бойцов в рейтинге и дуэлях.">
        <ul className="gx-rules">
          {ARENA_MODS.map((m) => (
            <li key={m.id} className={m.id === s.arena.id ? "now" : ""}>
              <Ico name={m.ico} size={16} />
              <span>
                <b>{m.name}</b>
                <small>{m.desc}</small>
              </span>
              {m.id === s.arena.id && <em>сегодня</em>}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
