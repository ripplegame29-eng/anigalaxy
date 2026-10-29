"use client";

/** Донат карт: просьбы соклановцев, свои запросы, лимит и лучшие дарители недели. */

import { useState } from "react";
import { cardDef } from "@/lib/cards/catalog";
import { DONATE, type DonateRequestView } from "@/lib/cards/clanwar";
import { RANKS } from "@/lib/cards/config";
import { donateAct, useClanDonate } from "@/lib/clans/client";
import { GameCard } from "@/components/cards/GameCard";
import { Cur, Ico } from "@/components/cards/icons";
import { DonatePicker } from "./war/DonatePicker";
import { LoadError, Skeleton, plural, shortLeft, useCardArt, useNowTick, useToast } from "./war/shared";

export function ClanDonateTab() {
  const { donate: d, ready, reload } = useClanDonate();
  const now = useNowTick(1000);
  const [toastNode, toast] = useToast();
  const [picking, setPicking] = useState(false);
  const [giving, setGiving] = useState(0);
  const [errs, setErrs] = useState<Record<number, string>>({});
  const [cancelBusy, setCancelBusy] = useState(false);
  useCardArt();

  if (!ready) return <Skeleton rows={2} />;
  if (!d) return <LoadError text="Не удалось загрузить запросы карт. Вы состоите в клане?" onRetry={() => void reload()} />;

  const mine = d.requests.find((r) => r.mine);
  const others = d.requests
    .filter((r) => !r.mine)
    .sort((a, b) => Number(b.canGive > 0) - Number(a.canGive > 0) || a.expiresAt - b.expiresAt);
  const limitHit = d.givenToday >= d.dailyLimit;
  const cooldown = !mine && d.nextRequestAt > now ? d.nextRequestAt - now : 0;

  async function give(r: DonateRequestView) {
    if (giving) return;
    setGiving(r.id);
    setErrs((e) => ({ ...e, [r.id]: "" }));
    const res = await donateAct<{ dust: number; cardId: string }>("give", { id: r.id });
    setGiving(0);
    if (!res.ok) return setErrs((e) => ({ ...e, [r.id]: res.error }));
    const name = cardDef(res.result?.cardId ?? r.cardId)?.name ?? "карту";
    toast(`+${res.result?.dust ?? 0} пыли · ${r.nick} получил(а) «${name}»`);
  }

  async function cancel() {
    if (cancelBusy) return;
    setCancelBusy(true);
    const res = await donateAct("cancel");
    setCancelBusy(false);
    toast(res.ok ? "Запрос отменён" : res.error, !res.ok);
  }

  async function request(cardId: string, want: number): Promise<string | null> {
    const res = await donateAct("request", { cardId, want });
    if (!res.ok) return res.error;
    setPicking(false);
    toast("Запрос отправлен — клан увидит его сразу");
    return null;
  }

  return (
    <div className="cg cw dn">
      <section className="cw-hero dn-hero">
        <div className="dn-hero-main">
          <p className="cw-eyebrow">Донат карт</p>
          <h2 className="cw-hero-title">Делитесь дубликатами — растите вместе</h2>
          <p className="cw-hero-text">
            Просите C, B или A героев у клана и отдавайте свои свободные копии. Донору — пыль и опыт клана, получателю — карта прямо в коллекцию.
          </p>
        </div>
        <div className={`dn-meter ${limitHit ? "full" : ""}`}>
          <div className="dn-meter-top">
            <span>Отдано сегодня</span>
            <b>
              {d.givenToday}
              <i>/</i>
              {d.dailyLimit}
            </b>
          </div>
          <div className="dn-meter-bar" role="progressbar" aria-valuenow={d.givenToday} aria-valuemin={0} aria-valuemax={d.dailyLimit} aria-label="Лимит доната за сутки">
            {Array.from({ length: d.dailyLimit }, (_, i) => (
              <i key={i} className={i < d.givenToday ? "on" : ""} />
            ))}
          </div>
          <small>{limitHit ? "Лимит исчерпан — он обновится через сутки" : `Ещё можно отдать: ${d.dailyLimit - d.givenToday}`}</small>
        </div>
      </section>

      {!d.eligible ? (
        <div className="cw-hint warn">
          <Ico name="lock" size={18} />
          <p>Просить и отдавать карты можно через сутки после вступления в клан. Пока вы можете следить за запросами соклановцев.</p>
        </div>
      ) : null}

      <section className="cw-card dn-mine" aria-label="Мой запрос">
        <div className="cw-card-head">
          <h3 className="cw-h3">Мой запрос</h3>
          {mine ? <span className="cw-chip warm">{shortLeft(mine.expiresAt - now)} осталось</span> : null}
        </div>
        {mine ? (
          <MineRequest r={mine} now={now} busy={cancelBusy} onCancel={() => void cancel()} />
        ) : (
          <div className="dn-new">
            <div className="dn-new-ico" aria-hidden>
              <Ico name="plus" size={26} />
            </div>
            <div>
              <b>Нужен герой?</b>
              <p>Запрос увидят все соклановцы. Он живёт {DONATE.requestMs / 3_600_000} часов, одновременно — один.</p>
            </div>
            <button type="button" className="cw-btn primary lg" disabled={!d.eligible || cooldown > 0} onClick={() => setPicking(true)}>
              <Ico name="pack" size={18} />
              Запросить карты
            </button>
            {cooldown > 0 ? (
              <p className="cw-note">Новый запрос можно создать через {shortLeft(cooldown)}.</p>
            ) : !d.eligible ? (
              <p className="cw-note">Доступно через сутки после вступления.</p>
            ) : null}
          </div>
        )}
      </section>

      <section className="dn-section" aria-label="Запросы клана">
        <div className="cw-card-head flat">
          <h3 className="cw-h3">Запросы клана</h3>
          <span className="cw-note">{others.length ? `${others.length} открыто` : ""}</span>
        </div>
        {others.length ? (
          <div className="dn-list">
            {others.map((r) => (
              <RequestCard
                key={r.id}
                r={r}
                now={now}
                busy={giving === r.id}
                anyBusy={giving !== 0}
                eligible={d.eligible}
                limitHit={limitHit}
                err={errs[r.id] ?? ""}
                onGive={() => void give(r)}
              />
            ))}
          </div>
        ) : (
          <div className="cw-empty">
            <Ico name="pack" size={30} />
            <p>Сейчас никто ничего не просит. Загляните позже — запросы появляются здесь сразу.</p>
          </div>
        )}
      </section>

      <div className="dn-bottom">
        <section className="cw-card" aria-label="Лучшие дарители недели">
          <div className="cw-card-head">
            <h3 className="cw-h3">Дарители недели</h3>
            <Ico name="crown" size={18} />
          </div>
          {d.top.length ? (
            <ol className="dn-top">
              {d.top.map((t, i) => (
                <li key={t.nick} className={`p${i + 1}`}>
                  <span className="dn-place">{i + 1}</span>
                  <b>{t.nick}</b>
                  <span className="dn-top-n">{t.count} {plural(t.count, ["карта", "карты", "карт"])}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="cw-note pad">Пока никто не отдавал карты на этой неделе. Станьте первым!</p>
          )}
        </section>
        <section className="cw-card dn-rules" aria-label="Что можно отдать">
          <div className="cw-card-head">
            <h3 className="cw-h3">Что можно отдать</h3>
          </div>
          <ul>
            <li>Только свободные копии: без замка, не в колоде, не на аукционе.</li>
            <li>Анимированные и пробуждённые карты не передаются.</li>
            <li>Герои S и SS не запрашиваются и не отдаются.</li>
            <li>
              Награда: <Cur k="dust" size={14} /> {DONATE.dustPerRank.join(" / ")} пыли за C / B / A и +{DONATE.clanXp} опыта клана.
            </li>
          </ul>
        </section>
      </div>

      {picking ? <DonatePicker onClose={() => setPicking(false)} onSubmit={request} /> : null}
      {toastNode}
    </div>
  );
}

function Segs({ got, want }: { got: number; want: number }) {
  return (
    <span className="dn-segs" role="img" aria-label={`Получено ${got} из ${want}`}>
      {Array.from({ length: want }, (_, i) => (
        <i key={i} className={i < got ? "on" : ""} />
      ))}
      <em>
        {got}/{want}
      </em>
    </span>
  );
}

function MineRequest({ r, now, busy, onCancel }: { r: DonateRequestView; now: number; busy: boolean; onCancel: () => void }) {
  const def = cardDef(r.cardId);
  const left = r.expiresAt - now;
  return (
    <div className="dn-req mine">
      <div className="dn-req-art">
        <GameCard cardId={r.cardId} stats={false} />
      </div>
      <div className="dn-req-body">
        <b className="dn-req-name">{def?.name ?? "Герой"}</b>
        <small className="dn-req-sub">
          {def ? `${RANKS[def.rank].name} · ${def.series}` : ""}
        </small>
        <Segs got={r.got} want={r.want} />
        <p className="cw-note">{r.got >= r.want ? "Все карты получены!" : "Соклановцы отдают копии из коллекции — карта сразу попадёт к вам."}</p>
        <div className="dn-req-foot">
          <span className="cw-chip">
            <Ico name="clock" size={14} />
            {left > 0 ? shortLeft(left) : "истёк"}
          </span>
          <button type="button" className="cw-btn ghost" disabled={busy} onClick={onCancel}>
            {busy ? "Отменяем…" : "Отменить запрос"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RequestCard({
  r,
  now,
  busy,
  anyBusy,
  eligible,
  limitHit,
  err,
  onGive,
}: {
  r: DonateRequestView;
  now: number;
  busy: boolean;
  anyBusy: boolean;
  eligible: boolean;
  limitHit: boolean;
  err: string;
  onGive: () => void;
}) {
  const def = cardDef(r.cardId);
  const rank = def?.rank ?? 0;
  const dust = DONATE.dustPerRank[Math.min(2, rank)];
  const left = r.expiresAt - now;
  const reason = !eligible ? "Доступно через сутки" : limitHit ? "Лимит на сегодня исчерпан" : r.canGive <= 0 ? "Нет свободной копии" : left <= 0 ? "Запрос истёк" : "";
  return (
    <article className={`dn-req ${r.canGive > 0 ? "can" : ""}`}>
      <div className="dn-req-art">
        <GameCard cardId={r.cardId} stats={false} />
      </div>
      <div className="dn-req-body">
        <div className="dn-req-who">
          <span className="dn-ava" aria-hidden>
            {r.nick.slice(0, 1).toUpperCase()}
          </span>
          <span className="dn-who-txt">
            <b>{r.nick}</b> просит ×{r.want - r.got}
          </span>
          <span className={`cw-chip small ${left < 3_600_000 ? "hot" : ""}`}>
            <Ico name="clock" size={12} />
            {shortLeft(left)}
          </span>
        </div>
        <b className="dn-req-name">{def?.name ?? "Герой"}</b>
        <small className="dn-req-sub">{def ? `${RANKS[rank].name} · ${def.series}` : ""}</small>
        <Segs got={r.got} want={r.want} />
        <div className="dn-req-rew">
          <span>
            <Cur k="dust" size={14} />+{dust} пыли
          </span>
          <span>
            <Ico name="bolt" size={14} />+{DONATE.clanXp} опыта клана
          </span>
        </div>
        <button type="button" className="cw-btn give lg" disabled={!!reason || anyBusy} onClick={onGive}>
          <Ico name="gift" size={18} />
          {busy ? "Отдаём…" : reason || `Отдать · у вас ${r.canGive}`}
        </button>
        {err ? (
          <p className="cw-err" role="alert">
            {err}
          </p>
        ) : null}
      </div>
    </article>
  );
}
