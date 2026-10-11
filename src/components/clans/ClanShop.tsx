"use client";

import { useMemo, useState } from "react";
import { RESOURCE_LABEL, type ClanResource } from "@/lib/clans.game";
import type { Clan } from "@/lib/clans";
import {
  CLAN_DECORATIONS,
  CLAN_EMBLEM_ITEMS,
  CLAN_BACKGROUNDS,
  SHOP_RARITY_LABEL,
  buyClanItem,
  canEquip,
  equipClanItem,
  isEquipped,
  recentLedger,
  shopItem,
  type ClanShopCategory,
  type ClanShopItem,
  type ClanShopRarity,
} from "@/lib/clans.shop";
import type { ClanGameState } from "@/lib/clans.runtime";
import { ClanEmblemView } from "./ClanEmblemView";
import { num } from "./ClanWallet";

/**
 * Магазин гильдии.
 *
 * Три категории в одной сетке: фон, эмблема, декорация. Правило одно и
 * оно же написано в интерфейсе — купил один раз, меняешь сколько угодно и
 * бесплатно. Поэтому карточка показывает четыре разных состояния, а не
 * две: «Купить», «Куплено», «Установить», «Установлено».
 */

type Category = ClanShopCategory | "all";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "all", label: "Всё" },
  { id: "background", label: "Фоны страницы" },
  { id: "emblem", label: "Эмблемы" },
  { id: "decoration", label: "Декор" },
];

const RARITIES: (ClanShopRarity | "any")[] = ["any", "common", "rare", "epic", "legendary"];

type Sort = "default" | "price-asc" | "price-desc" | "rarity";

const SORT_LABEL: Record<Sort, string> = {
  default: "По порядку",
  "price-asc": "Сначала дешёвые",
  "price-desc": "Сначала дорогие",
  rarity: "По редкости",
};

const RARITY_ORDER: Record<ClanShopRarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

export function ClanShop({ clan, game }: { clan: Clan; game: ClanGameState }) {
  const role = "owner";
  const [category, setCategory] = useState<Category>("all");
  const [rarity, setRarity] = useState<ClanShopRarity | "any">("any");
  const [sort, setSort] = useState<Sort>("default");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<ClanShopItem | null>(null);
  const [message, setMessage] = useState("");

  const say = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3200);
  };

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [
      ...CLAN_BACKGROUNDS,
      ...CLAN_EMBLEM_ITEMS,
      ...CLAN_DECORATIONS,
    ].filter(
      (item) =>
        (category === "all" || item.category === category) &&
        (rarity === "any" || item.rarity === rarity) &&
        (!q || item.name.toLowerCase().includes(q)),
    );
    if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
    if (sort === "rarity") list.sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]);
    return list;
  }, [category, rarity, sort, query]);

  const owned = game.unlocks.length;
  const total = CLAN_BACKGROUNDS.length + CLAN_EMBLEM_ITEMS.length + CLAN_DECORATIONS.length;

  const onBuy = (item: ClanShopItem) => {
    const result = buyClanItem(item.id);
    say(result.ok ? `«${item.name}» куплено навсегда` : (result.reason ?? "Покупка не прошла"));
  };

  const onEquip = (item: ClanShopItem) => {
    const result = equipClanItem(item.id, role);
    if (!result.ok) {
      say(result.reason ?? "Не удалось");
      return;
    }
    if (item.category === "decoration") {
      const on = !isEquipped(game, item.id);
      say(on ? `«${item.name}» включено` : `«${item.name}» выключено`);
    } else {
      say(`Активно: «${item.name}»`);
    }
  };

  return (
    <div className="grid gap-4">
      {/* Шапка магазина */}
      <section data-reveal className="cl-reveal cl-panel cl-shop-head p-5 sm:p-6" style={{ ["--c" as string]: clan.color }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="cl-lbl !mb-1">Магазин гильдии</p>
            <h2 className="font-accent text-2xl font-extrabold">{clan.name}</h2>
            <p className="mt-1 text-sm text-muted">
              Купленное остаётся навсегда. Установка и смена — бесплатно.
            </p>
          </div>
          <div className="cl-shop-purse">
            {(Object.keys(RESOURCE_LABEL) as ClanResource[]).map((key) => (
              <span key={key} className="cl-shop-coin" title={RESOURCE_LABEL[key]}>
                <b className="tabular-nums">{num(game.purse[key])}</b>
                <em>{RESOURCE_LABEL[key]}</em>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="cl-pill">
            Коллекция: {owned} из {total}
          </span>
          <span className="cl-pill">Фонов: {ownedCount(game, CLAN_BACKGROUNDS)}</span>
          <span className="cl-pill">Эмблем: {ownedCount(game, CLAN_EMBLEM_ITEMS)}</span>
          <span className="cl-pill">Декор: {ownedCount(game, CLAN_DECORATIONS)}</span>
        </div>
      </section>

      {/* Фильтры */}
      <section data-reveal className="cl-reveal cl-panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="cl-in !w-full sm:!w-64"
            value={query}
            placeholder="Поиск по названию предмета"
            onChange={(e) => setQuery(e.target.value)}
            style={{ ["--c" as string]: clan.color }}
          />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="cl-pick"
                aria-pressed={category === item.id}
                onClick={() => setCategory(item.id)}
                style={{
                  ["--c" as string]: clan.color,
                  ...(category === item.id
                    ? { background: `${clan.color}2e`, boxShadow: `inset 0 0 0 1px ${clan.color}` }
                    : {}),
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted">Редкость</span>
          {RARITIES.map((item) => (
            <button
              key={item}
              type="button"
              className="cl-pick sm"
              aria-pressed={rarity === item}
              onClick={() => setRarity(item)}
            >
              {item === "any" ? "Любая" : SHOP_RARITY_LABEL[item]}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-white/10" />
          <select
            className="cl-pick sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Сортировка"
          >
            {(Object.keys(SORT_LABEL) as Sort[]).map((key) => (
              <option key={key} value={key} className="bg-ink">
                {SORT_LABEL[key]}
              </option>
            ))}
          </select>
        </div>
      </section>

      {message && (
        <p className="cl-toast" role="status">
          {message}
        </p>
      )}

      {/* Сетка предметов */}
      {items.length === 0 ? (
        <p className="cl-empty">Ничего не нашлось. Смягчи фильтры или измени запрос.</p>
      ) : (
        <ul className="cl-shop-grid">
          {items.map((item) => (
            <ShopCard
              key={item.id}
              item={item}
              game={game}
              clan={clan}
              role={role}
              onBuy={onBuy}
              onEquip={onEquip}
              onPreview={setPreview}
            />
          ))}
        </ul>
      )}

      {preview && (
        <ShopPreview
          item={preview}
          game={game}
          onClose={() => setPreview(null)}
          onBuy={onBuy}
          onEquip={onEquip}
        />
      )}

      {/* Журнал операций */}
      <section data-reveal className="cl-reveal cl-panel p-5" style={{ ["--c" as string]: clan.color }}>
        <h3 className="mb-3 font-accent text-sm font-extrabold uppercase tracking-wider text-muted">
          История операций
        </h3>
        {recentLedger(12).length === 0 ? (
          <p className="text-sm text-muted">
            Пусто. Здесь появятся все покупки, установки и открытия сокровищницы
            с указанием, кто потратил и что получил.
          </p>
        ) : (
          <ul className="cl-log">
            {recentLedger(12).map((entry) => (
              <li key={entry.id}>
                <span className="cl-log-when">{new Date(entry.at).toLocaleString("ru-RU")}</span>
                <span className="cl-log-text">
                  {entry.subject}
                  {entry.cost
                    ? ` — ${num(entry.cost.amount)} ${RESOURCE_LABEL[entry.cost.resource].toLowerCase()}`
                    : " — без списания"}
                </span>
                <span className="cl-log-who">{entry.reward ?? entry.actor}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ownedCount(game: ClanGameState, list: ClanShopItem[]): number {
  return list.filter((item) => game.unlocks.includes(item.id)).length;
}

/* ------------------------------------------------------------------ */
/* Карточка предмета                                                    */
/* ------------------------------------------------------------------ */

function ShopCard({
  item,
  game,
  clan,
  role,
  onBuy,
  onEquip,
  onPreview,
}: {
  item: ClanShopItem;
  game: ClanGameState;
  clan: Clan;
  role: string;
  onBuy: (item: ClanShopItem) => void;
  onEquip: (item: ClanShopItem) => void;
  onPreview: (item: ClanShopItem) => void;
}) {
  const owned = game.unlocks.includes(item.id);
  const equipped = isEquipped(game, item.id);
  const free = item.price <= 0;
  const afford = game.purse[item.currency] >= item.price;
  const mayEquip = canEquip(item.category, role);

  // Не купленный предмет нельзя установить, поэтому второй кнопки у него
  // просто нет. Раньше «Установить» стояла первой и перехватывала клик:
  // карточка предлагала действие, которого нет.
  const action = !owned
    ? null
    : equipped
      ? item.category === "decoration"
        ? "Выключить"
        : "Установлено"
      : "Установить";

  return (
    <li className={`cl-shop-card rar-${item.rarity}`} data-cat={item.category}>
      <button
        type="button"
        className="cl-shop-art"
        style={item.css ? { background: item.css, backgroundSize: item.backgroundSize } : {}}
        onClick={() => onPreview(item)}
        aria-label={`Предпросмотр: ${item.name}`}
      >
        {item.veil && <span className="cl-shop-veil" style={{ background: item.veil }} />}
        {item.emblem ? (
          <ClanEmblemView emblem={item.emblem} size={196} />
        ) : item.category === "decoration" ? (
          <DecoPreview deco={item.deco ?? ""} color={clan.color} />
        ) : null}
        {!item.emblem && item.category !== "decoration" && (
          <span className="cl-shop-art-label">{item.name}</span>
        )}
        {owned && <span className="cl-shop-flag">Разблокирован</span>}
      </button>

      <div className="cl-shop-body">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-bold text-white">{item.name}</span>
          <span className={`cl-rarity rar-${item.rarity}`}>{SHOP_RARITY_LABEL[item.rarity]}</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted">{item.description}</p>
        {/* Цена не переносится: у длинных названий строка с ресурсом
            съезжала под кнопку и читалась через половину символа */}
        <p className="mt-1.5 text-xs whitespace-nowrap">
          {free ? (
            <span className="text-mint">Доступно бесплатно</span>
          ) : (
            <>
              <b className="tabular-nums" style={{ color: afford ? "#fff" : "#ff8f9c" }}>
                {num(item.price)}
              </b>{" "}
              <span className="text-muted">{RESOURCE_LABEL[item.currency].toLowerCase()}</span>
            </>
          )}
        </p>

        <div className="mt-2.5 flex items-center gap-1.5">
          {action && (
            <button
              type="button"
              className={`cl-pick sm ${equipped && item.category !== "decoration" ? "is-on" : ""}`}
              onClick={() => onEquip(item)}
              title={mayEquip ? undefined : "Недостаточно прав"}
            >
              {action}
            </button>
          )}
          {!owned && !free && (
            <button
              type="button"
              className="cl-pick sm"
              disabled={!afford}
              onClick={() => onBuy(item)}
            >
              {afford ? "Купить" : "Не хватает"}
            </button>
          )}
          {free && !owned && <span className="text-xs text-muted">Стандартное оформление</span>}
        </div>
      </div>
    </li>
  );
}

/** Превью декораций: мини-сцена того, что предмет делает */
function DecoPreview({ deco, color }: { deco: string; color: string }) {
  return (
    <span className="cl-deco-preview" style={{ ["--c" as string]: color }}>
      <span className={`deco-${deco}`} aria-hidden />
      <em>декор</em>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Предпросмотр                                                         */
/* ------------------------------------------------------------------ */

function ShopPreview({
  item,
  game,
  onClose,
  onBuy,
  onEquip,
}: {
  item: ClanShopItem;
  game: ClanGameState;
  onClose: () => void;
  onBuy: (item: ClanShopItem) => void;
  onEquip: (item: ClanShopItem) => void;
}) {
  const owned = game.unlocks.includes(item.id);
  const equipped = isEquipped(game, item.id);

  return (
    <div className="cl-ov" role="dialog" aria-modal="true" aria-label={item.name} onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="cl-panel cl-mdl cl-shop-preview" style={{ ["--c" as string]: "#b06bff" }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-accent text-xl font-extrabold">{item.name}</h2>
            <span className={`cl-rarity mt-1 rar-${item.rarity}`}>{SHOP_RARITY_LABEL[item.rarity]}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="cl-pick sm">
            ✕
          </button>
        </div>

        <div
          className="cl-shop-art !h-56"
          style={item.css ? { background: item.css, backgroundSize: item.backgroundSize } : {}}
        >
          {item.veil && <span className="cl-shop-veil" style={{ background: item.veil }} />}
          {item.emblem && <ClanEmblemView emblem={item.emblem} size={220} />}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-bright/85">{item.description}</p>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="cl-fact">
            <dt>Цена</dt>
            <dd>{item.price > 0 ? `${num(item.price)} ${RESOURCE_LABEL[item.currency].toLowerCase()}` : "бесплатно"}</dd>
          </div>
          <div className="cl-fact">
            <dt>Владение</dt>
            <dd>{owned ? "навсегда" : "после покупки"}</dd>
          </div>
          <div className="cl-fact">
            <dt>Повторная покупка</dt>
            <dd>невозможна</dd>
          </div>
          <div className="cl-fact">
            <dt>Смена оформления</dt>
            <dd>бесплатно</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {item.price > 0 && !owned && (
            <button
              type="button"
              className="cl-pick"
              disabled={game.purse[item.currency] < item.price}
              onClick={() => onBuy(item)}
            >
              {game.purse[item.currency] >= item.price ? "Купить" : "Не хватает средств"}
            </button>
          )}
          <button type="button" className={`cl-pick ${equipped ? "is-on" : ""}`} onClick={() => onEquip(item)}>
            {equipped && item.category !== "decoration" ? "Установлено" : "Установить"}
          </button>
        </div>
      </div>
    </div>
  );
}

export { shopItem };