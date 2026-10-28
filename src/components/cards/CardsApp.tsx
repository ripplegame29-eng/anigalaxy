"use client";

import { useEffect, useRef, useState } from "react";
import { act, ensureLoaded, refresh, useCards } from "@/lib/cards/client";
import { CATALOG, visibleCatalog } from "@/lib/cards/catalog";
import { EXCHANGE, RANKS } from "@/lib/cards/config";
import { openAuthDialog } from "@/lib/auth-dialog";
import { useAccount } from "@/lib/use-account";
import "../../app/cards.css";
import "../../app/cards-card.css";
import "../../app/cards-stage.css";
import "../../app/cards-tabs.css";
import "../../app/cards-battle.css";
import { AuctionTab } from "./AuctionTab";
import { BattleTab } from "./BattleTab";
import { CollectionTab } from "./CollectionTab";
import { ForgeTab } from "./ForgeTab";
import { PacksTab } from "./PacksTab";
import { SharpenTab } from "./SharpenTab";
import { ToastHost, fmt, fmtLeft, toast, useBusy, useNow } from "./common";
import { CUR, Cur, Ico, type CurKey, type IcoName } from "./icons";
import { TradeTab } from "./TradeTab";

const TABS: readonly (readonly [string, string, IcoName])[] = [
  ["packs", "Паки", "pack"],
  ["forge", "Кузница", "anvil"],
  ["sharpen", "Заточка", "star"],
  ["battle", "Бои", "swords"],
  ["auction", "Аукцион", "tag"],
  ["trade", "Обмен", "swap"],
  ["collection", "Коллекция", "grid"],
] as const;
type TabId = "packs" | "forge" | "sharpen" | "battle" | "auction" | "trade" | "collection";

const EX_STEPS = [1, 5, 10, 25, 50, 100];

function Intro({ children }: { children: React.ReactNode }) {
  return (
    <div className="cg">
      <section className="cg-hero2">
        <div>
          <span className="cg-eyebrow">ANIGALAXY COLLECTION</span>
          <h1>Коллекция</h1>
          {children}
        </div>
      </section>
    </div>
  );
}

function ExchangePopover({ ac, diamonds, onDone }: { ac: number; diamonds: number; onDone: () => void }) {
  const [ex, setEx] = useState(5);
  const [busy, run] = useBusy();
  const cost = ex * EXCHANGE.acPerDiamond;
  const reason = ac < cost ? `Не хватает ${fmt(cost - ac)} AC` : "";
  const submit = () =>
    run(async () => {
      const r = await act<{ diamonds: number }>("exchange", { diamonds: ex });
      if (r.ok) {
        toast(`Обмен выполнен: +${fmt(r.result.diamonds)} алмазов, списано ${fmt(cost)} AC`);
        onDone();
      } else toast(r.error, true);
    });
  return (
    <div className="cg-pop" role="dialog" aria-label="Обмен AC на алмазы">
      <b>Обмен AC на алмазы</b>
      <div className="rate">
        <span>Курс</span>
        <span>
          1 <Cur k="diamonds" /> = {EXCHANGE.acPerDiamond} AC
        </span>
      </div>
      <div className="cg-seg" role="radiogroup" aria-label="Сколько алмазов получить">
        {EX_STEPS.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={ex === n} onClick={() => setEx(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="sum">
        <span>
          Спишется: <b>{fmt(cost)} AC</b> · доступно {fmt(ac)} AC
        </span>
        <span>
          Получите: <b>{fmt(ex)}</b> <Cur k="diamonds" /> (сейчас {fmt(diamonds)})
        </span>
      </div>
      <button type="button" className="cg-btn pri" disabled={busy || !!reason} onClick={() => void submit()}>
        {busy ? <span className="cg-spin" /> : null}
        {reason || `Обменять на ${fmt(ex)} алмазов`}
      </button>
    </div>
  );
}

export function CardsApp() {
  const account = useAccount();
  const { state: s, error, loading } = useCards();
  const [tab, setTab] = useState<TabId>("packs");
  const [busy, run] = useBusy();
  const [exOpen, setExOpen] = useState(false);
  const now = useNow(30_000);
  const tries = useRef(0);

  useEffect(() => {
    if (account) ensureLoaded();
  }, [account]);

  useEffect(() => {
    try {
      const saved = window.location.hash.slice(1);
      if (TABS.some(([id]) => id === saved)) window.setTimeout(() => setTab(saved as TabId), 0);
    } catch {
      /* ignore */
    }
  }, []);

  /* арт подтягивается сервером в фоне — обновляем, пока он не докачался */
  const artCount = s?.art.length ?? 0;
  useEffect(() => {
    if (!s || artCount + (s.hidden?.length ?? 0) >= CATALOG.length) return;
    const id = window.setInterval(() => {
      if (document.hidden || tries.current > 40) return;
      tries.current += 1;
      void refresh();
    }, 25_000);
    return () => window.clearInterval(id);
  }, [s, artCount]);

  useEffect(() => {
    if (!exOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exOpen]);

  const pick = (t: TabId) => {
    setTab(t);
    try {
      window.history.replaceState(null, "", `#${t}`);
    } catch {
      /* ignore */
    }
  };

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const n = (i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
    pick(TABS[n][0] as TabId);
    document.getElementById(`cg-tab-${TABS[n][0]}`)?.focus();
  };

  if (!account) {
    return (
      <Intro>
        <p>Коллекционируйте героев популярных аниме, открывайте паки, улучшайте, сражайтесь отрядом 4×4, торгуйтесь на аукционе и меняйтесь с друзьями.</p>
        <div className="cg-hero-actions" style={{ marginTop: 22 }}>
          <button type="button" className="cg-btn pri lg" onClick={() => openAuthDialog("register")}>
            Создать аккаунт и получить стартовый набор
          </button>
          <button type="button" className="cg-btn lg" onClick={() => openAuthDialog("login")}>
            Войти
          </button>
        </div>
      </Intro>
    );
  }

  if (!s) {
    return (
      <Intro>
        <p>{error && error !== "auth" ? `Не удалось загрузить: ${error}` : loading ? "Загружаем вашу коллекцию…" : "Нужен вход в аккаунт — войдите заново."}</p>
        {error && (
          <div className="cg-hero-actions" style={{ marginTop: 18 }}>
            <button type="button" className="cg-btn pri" onClick={() => void refresh()}>
              Повторить
            </button>
          </div>
        )}
      </Intro>
    );
  }

  const w = s.wallet;
  const energyLeft = w.nextEnergyAt ? w.nextEnergyAt - now : 0;
  const owned = new Set(s.inventory.map((c) => c.cardId));
  const visible = visibleCatalog(owned);
  const perRank = RANKS.map((r) => {
    const all = visible.filter((c) => c.rank === r.id);
    const have = all.filter((c) => owned.has(c.id)).length;
    return { r, have, total: all.length };
  });
  const haveAll = perRank.reduce((a, x) => a + x.have, 0);
  const claim = () =>
    run(async () => {
      const r = await act<{ diamonds: number; dust: number; packs: number }>("daily");
      if (!r.ok) return toast(r.error, true);
      toast(`Подарок дня: +${r.result.diamonds} алмазов, +${r.result.dust} пыли, +${r.result.packs} пак(а)`);
    });

  const tokens: { k: CurKey; value: string; note?: string }[] = [
    { k: "diamonds", value: fmt(w.diamonds) },
    { k: "dust", value: fmt(w.dust) },
    { k: "packs", value: String(w.packs) },
    { k: "energy", value: `${w.energy}/${w.energyMax}`, note: energyLeft > 0 ? `+1 через ${fmtLeft(energyLeft)}` : undefined },
  ];

  return (
    <div className="cg">
      <section className="cg-hero2 cg-enter">
        <div>
          <span className="cg-eyebrow">ANIGALAXY COLLECTION</span>
          <h1>Коллекция</h1>
          <p>Герои топовых аниме: открывайте паки, улучшайте карты, собирайте отряд 4×4 и сражайтесь за место в лиге.</p>
          <div className="cg-collprog">
            <div className="cg-collprog-top">
              <span>Собрано героев</span>
              <span>
                <b>{haveAll}</b> / {visible.length}
              </span>
            </div>
            <div className="cg-segbar" aria-hidden>
              {perRank.map(({ r, have, total }) => (
                <span key={r.id}>
                  <i style={{ ["--c" as string]: r.color, ["--p" as string]: `${total ? (have / total) * 100 : 0}%` }} />
                  {r.short} {have}/{total}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="cg-hero-r">
          <div className="cg-ledger" aria-label="Кошелёк">
            {tokens.map((t) => (
              <div key={t.k} className="cg-tok" style={{ ["--c" as string]: CUR[t.k].color }} title={CUR[t.k].label}>
                <span className="cg-tok-ico">
                  <Ico name={CUR[t.k].ico} size={17} />
                </span>
                <b>{t.value}</b>
                <small>{t.note ?? CUR[t.k].label}</small>
              </div>
            ))}
          </div>
          <div className="cg-hero-actions">
            {s.dailyReady && (
              <button type="button" className="cg-btn gold" disabled={busy} onClick={() => void claim()}>
                <Ico name="gift" size={17} /> Подарок дня
              </button>
            )}
            <span className="cg-league" style={{ color: s.league.color }}>
              <Ico name="trophy" size={17} />
              {s.league.name}
              <small>{fmt(w.rating)}</small>
            </span>
            <div className="cg-popwrap">
              <button type="button" className="cg-btn" aria-expanded={exOpen} onClick={() => setExOpen((v) => !v)}>
                <Ico name="swap" size={16} /> AC → <Cur k="diamonds" />
                <Ico name="down" size={14} />
              </button>
              {exOpen && <ExchangePopover ac={s.ac} diamonds={w.diamonds} onDone={() => setExOpen(false)} />}
            </div>
          </div>
        </div>
      </section>

      <div className="cg-nav" role="tablist" aria-label="Разделы карточек">
        {TABS.map(([id, label, ico], i) => (
          <button key={id} type="button" role="tab" id={`cg-tab-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} className="cg-tab" onClick={() => pick(id as TabId)} onKeyDown={(e) => onTabKey(e, i)}>
            <Ico name={ico} size={17} />
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-labelledby={`cg-tab-${tab}`} key={tab} className="cg-enter">
        {tab === "packs" && <PacksTab s={s} />}
        {tab === "forge" && <ForgeTab s={s} />}
        {tab === "sharpen" && <SharpenTab s={s} />}
        {tab === "battle" && <BattleTab s={s} />}
        {tab === "auction" && <AuctionTab s={s} me={account.nickname} />}
        {tab === "trade" && <TradeTab s={s} />}
        {tab === "collection" && <CollectionTab s={s} />}
      </div>
      <ToastHost />
    </div>
  );
}
