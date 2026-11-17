import { CATALOG, cardDef } from "@/lib/cards/catalog";
import { CLASSES, ELEMENTS } from "@/lib/cards/config";
import { ELEMENT_ICON, Ico } from "./icons";

/* максимумы по каталогу: полоски показывают место карты среди всех героев */
const MAX = CATALOG.reduce(
  (m, c) => ({ atk: Math.max(m.atk, c.atk), def: Math.max(m.def, c.def), hp: Math.max(m.hp, c.hp), spd: Math.max(m.spd, c.spd) }),
  { atk: 1, def: 1, hp: 1, spd: 1 },
);
const STATS = [
  ["atk", "Атака"],
  ["def", "Защита"],
  ["hp", "Здоровье"],
  ["spd", "Скорость"],
] as const;

/** Боевая справка по герою: стихия, класс, кого бьёт, четыре характеристики и цитата */
export function CardFacts({ cardId, quote = false }: { cardId: string; quote?: boolean }) {
  const d = cardDef(cardId);
  if (!d) return null;
  const el = ELEMENTS[d.element];
  return (
    <div className="cg2-facts">
      <div className="fch">
        <span title={`Стихия: ${el.name}`}>
          <Ico name={ELEMENT_ICON[d.element]} size={14} /> {el.name}
        </span>
        <span title={CLASSES[d.cls].hint}>{CLASSES[d.cls].name}</span>
        <span title="Стихия, которую эта карта бьёт сильнее">бьёт: {ELEMENTS[el.beats].name}</span>
      </div>
      {quote && d.blurb && <p className="fq">{d.blurb}</p>}
      <div className="fst">
        {STATS.map(([k, label]) => (
          <div key={k}>
            <span>
              {label}
              <b>{d[k]}</b>
            </span>
            <i>
              <u style={{ width: `${Math.max(6, (d[k] / MAX[k]) * 100)}%` }} />
            </i>
          </div>
        ))}
      </div>
    </div>
  );
}
