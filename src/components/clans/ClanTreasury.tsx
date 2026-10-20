"use client";

import { useState } from "react";
import { RESOURCE_LABEL, type ClanResource } from "@/lib/clans.game";
import { clanMembers, type Clan } from "@/lib/clans";
import {
  CHESTS,
  canOpen,
  chestAvailable,
  openChest,
  treasuryTier,
  type ChestTier,
  type OpenResult,
} from "@/lib/clans.treasury";
import { recentLedger } from "@/lib/clans.shop";
import { VAULT_CHESTS, type VaultChestArt } from "@/lib/vault.data";
import type { ClanGameState } from "@/lib/clans.runtime";
import { num } from "./ClanWallet";

/**
 * Сокровищница клана.
 *
 * Тратится общая казна, поэтому открывать имеет право не каждый: рядовой
 * участник распустил бы клан сундуками. Шансы показаны до открытия — иначе
 * случайный предмет выглядел бы как гарантированный.
 */

const RARITY_LABEL: Record<string, string> = {
  common: "обычный",
  rare: "редкий",
  epic: "эпический",
  legendary: "легендарный",
};

/**
 * Сцена с сундуком.
 *
 * Картинка из макета плюс его же анимация: аура, лучи, искры и блик.
 * Параметры (`aura`, `ray`, `sparks`, `flash`) приходят из выгрузки —
 * вид сундука задаёт его уровень, а не код.
 */
function VaultStage({
  art,
  opened,
}: {
  art: VaultChestArt;
  opened: boolean;
}) {
  // Искры раскладываются по окружности детерминированно: без random
  // иначе они прыгали бы при каждом рендере
  const sparks = Array.from({ length: art.sparks }, (_, i) => {
    const a = (i / Math.max(1, art.sparks)) * Math.PI * 2;
    const rr = 34 + ((i * 37) % 12);
    return {
      x: 50 + Math.cos(a) * rr,
      y: 50 + Math.sin(a) * rr,
      s: 1.4 + (i % 3) * 0.7,
      delay: ((i * 0.21) % 3).toFixed(2),
    };
  });

  return (
    <div
      className="cl-vault-stage"
      style={{
        ["--c" as string]: art.color,
        ["--aura" as string]: String(art.aura),
        ["--ray" as string]: String(art.ray),
      }}
    >
      <span className="cl-vault-aura" aria-hidden />
      <span className="cl-vault-rays" aria-hidden />
      {sparks.map((s, i) => (
        <span
          key={i}
          className="cl-vault-spark"
          style={{
            left: s.x + "%",
            top: s.y + "%",
            width: s.s,
            height: s.s,
            animationDelay: s.delay + "s",
          }}
          aria-hidden
        />
      ))}

      <span className="cl-vault-chest" data-open={opened ? "yes" : "no"}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ассет из public, размер фиксирован */}
        <img
          className="cl-vault-pic"
          src={"/vault/" + art.file}
          alt={art.ru}
          width={230}
          height={230}
          draggable={false}
        />
        {/*
          Блик должен идти по контуру сундука, поэтому маской вырезан по
          самой картинке. Переменная --vault-img обязана быть задана: без неё
          маска невалидна, весь элемент красится целиком — и рядом с сундуком
          появляется белый прямоугольник.
        */}
        <span
          className="cl-vault-glint"
          style={{
            ["--vault-img" as string]: 'url("/vault/' + art.file + '")',
            animationDelay: art.fd + "ms",
          }}
          aria-hidden
        />
      </span>
    </div>
  );
}

export function ClanTreasury({ clan, game }: { clan: Clan; game: ClanGameState }) {
  const me = clanMembers(clan).find((m) => m.isPlayer);
  const role = me?.role ?? "member";
  const allowed = canOpen(role);
  const tier = treasuryTier(clan.points);
  const art = VAULT_CHESTS[tier];

  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<OpenResult | null>(null);
  const [message, setMessage] = useState("");

  const openedTotal = Object.values(game.treasury.opened).reduce((a, b) => a + b, 0);

  const onOpen = (next: ChestTier) => {
    if (opening) return;
    setOpening(true);
    setResult(null);
    try {
      const res = openChest(next, role, clan.points);
      if (!res.ok) {
        setMessage(res.reason ?? "Не удалось открыть");
        window.setTimeout(() => setMessage(""), 3000);
        return;
      }
      setResult(res);
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="grid gap-4">
      {/* Сундук */}
      <section
        data-reveal
        className="cl-reveal cl-panel cl-vault p-6 sm:p-8"
        style={{ ["--c" as string]: art?.color ?? "#ffb020" }}
      >
        <VaultStage art={art} opened={Boolean(result?.ok)} />

        <div className="mt-4 text-center">
          <p className="cl-lbl !mb-1">Уровень {tier}</p>
          <h2 className="font-accent text-2xl font-extrabold">{art?.ru ?? "Сундук"}</h2>
          <p className="mt-1 text-sm text-muted">
            {art?.en} · открыто сундуков: {num(openedTotal)}
          </p>
          {!allowed && (
            <p className="mt-2 text-xs text-red-300">
              Открывать может только глава, заместитель или модератор: тратится общая казна.
            </p>
          )}
        </div>

        {/* Выпавшая награда */}
        {result?.ok && result.loot && (
          <div className="cl-vault-drop" role="status">
            <span className="cl-vault-drop-glyph" aria-hidden>
              ✦
            </span>
            <b>{result.loot.entry.label}</b>
            {result.loot.duplicate && <em>уже было в коллекции — выдана компенсация</em>}
            {result.selfAc ? <em>{num(result.selfAc)} AC в личную копилку</em> : null}
          </div>
        )}
        {message && (
          <p className="cl-toast mt-3 text-center" role="status">
            {message}
          </p>
        )}
      </section>

      {/* Уровни сундуков */}
      <section data-reveal className="cl-reveal cl-panel p-5 sm:p-6" style={{ ["--c" as string]: clan.color }}>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-accent text-lg font-extrabold">Уровни сундуков</h3>
          <span className="text-xs text-muted">открыто: {num(openedTotal)}</span>
        </div>
        <p className="mb-4 text-xs text-muted">
          Уровень открывается ростом клана. Шансы указаны до открытия — они
          считаются из таблицы, а не подбираются под удачный исход.
        </p>

        <ul className="grid gap-3 sm:grid-cols-2">
          {CHESTS.map((chest) => {
            const artItem = VAULT_CHESTS[chest.tier];
            const open = chestAvailable(chest, clan.points);
            const afford = game.purse[chest.currency] >= chest.price;
            const opened = game.treasury.opened[String(chest.tier)] ?? 0;
            const active = chest.tier === tier;

            return (
              <li
                key={chest.tier}
                className={`cl-chest rar-${chest.rarity} ${active ? "now" : ""} ${open ? "" : "locked"}`}
                style={{ ["--c" as string]: artItem?.color ?? chest.color }}
              >
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- ассет из public, размер фиксирован */}
                  <img
                    className="cl-chest-pic"
                    src={"/vault/" + (artItem?.file ?? "chest-0.webp")}
                    alt=""
                    width={52}
                    height={52}
                    draggable={false}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <b className="truncate text-sm text-white">{artItem?.ru ?? chest.name}</b>
                      <span className={`cl-rarity rar-${chest.rarity}`}>
                        {RARITY_LABEL[chest.rarity] ?? chest.rarity}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {num(chest.price)} {RESOURCE_LABEL[chest.currency].toLowerCase()} · открыто {opened}
                    </p>
                  </div>
                </div>

                {!open && <p className="mt-2 text-xs text-amber-300">Закрыто: {chest.unlockNote}</p>}

                <ul className="mt-2.5 grid gap-1">
                  {chest.loot.map((entry) => (
                    <li key={entry.id} className="cl-loot-row">
                      <span className="truncate">{entry.label}</span>
                      <b className="tabular-nums">{entry.chance}%</b>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="cl-pick mt-3"
                  disabled={!open || !allowed || !afford || opening}
                  onClick={() => onOpen(chest.tier)}
                >
                  {!open
                    ? "Закрыт"
                    : !allowed
                      ? "Нет прав"
                      : !afford
                        ? "Не хватает средств"
                        : opening
                          ? "Открываем…"
                          : "Открыть за " + num(chest.price)}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Журнал сокровищницы */}
      <section data-reveal className="cl-reveal cl-panel p-5" style={{ ["--c" as string]: clan.color }}>
        <h3 className="mb-3 font-accent text-sm font-extrabold uppercase tracking-wider text-muted">
          Журнал сокровищницы
        </h3>
        {recentLedger(14).filter((entry) => entry.kind === "treasury").length === 0 ? (
          <p className="text-sm text-muted">
            Здесь появятся все открытия: кто открыл, какой сундук, сколько потрачено
            и что выпало. Записи не удаляются.
          </p>
        ) : (
          <ul className="cl-log">
            {recentLedger(14)
              .filter((entry) => entry.kind === "treasury")
              .map((entry) => (
                <li key={entry.id}>
                  <span className="cl-log-when">{new Date(entry.at).toLocaleString("ru-RU")}</span>
                  <span className="cl-log-text">
                    {entry.subject}
                    {entry.cost
                      ? " — " + num(entry.cost.amount) + " " + RESOURCE_LABEL[entry.cost.resource].toLowerCase()
                      : ""}
                  </span>
                  <span className="cl-log-who">{entry.reward ?? "—"}</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <p className="text-xs leading-relaxed text-muted">
        Награды из сундука попадают в общую казну клана, кроме AC: они уходят в
        личную копилку открывшего, потому что выдать личные AC от имени гильдии —
        значит обложить чужие деньги. Повторно выпавший уже купленный предмет
        заменяется компенсацией в 40% его цены.
      </p>
    </div>
  );
}

export type { ClanGameState, ClanResource };