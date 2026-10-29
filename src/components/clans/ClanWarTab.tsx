"use client";

/** Карточная война клана: поиск → подготовка → бой → итоги. Нападение показывается живой ареной. */

import { useState } from "react";
import { useClanWar, warAct } from "@/lib/clans/client";
import { Arena, type BattleReport } from "@/components/cards/Arena";
import { AttackResult } from "./war/AttackResult";
import { BaseSheet } from "./war/BaseSheet";
import { LoadError, Skeleton, useCardArt, useNowTick, useToast } from "./war/shared";
import { WarBattle } from "./war/WarBattle";
import { WarDone, WarHistory } from "./war/WarHistory";
import { WarIdle } from "./war/WarIdle";
import { WarPrep } from "./war/WarPrep";

const SEEN_KEY = "animehub:cw:seen";

function readSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function ClanWarTab() {
  const { war: st, ready, reload } = useClanWar();
  const [toastNode, toast] = useToast();
  const [sheet, setSheet] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [replay, setReplay] = useState<BattleReport | null>(null);
  const [result, setResult] = useState<BattleReport | null>(null);
  const [seen, setSeen] = useState<number>(() => (typeof window === "undefined" ? 0 : readSeen()));
  const now = useNowTick(60_000);
  useCardArt();

  if (!ready) return <Skeleton />;
  if (!st) return <LoadError text="Не удалось загрузить войну. Вы состоите в клане?" onRetry={() => void reload()} />;

  const war = st.war;
  const slot = war && sheet !== null ? war.foe.slots.find((s) => s.pos === sheet) : undefined;
  const last = st.history[0];
  const showDone = !war && !st.search && !!last && last.id > seen && now - last.at < 3 * 24 * 3_600_000;

  async function attack(pos: number) {
    if (busy) return;
    setBusy(true);
    setErr("");
    const r = await warAct<BattleReport>("attack", { pos });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setSheet(null);
    setReplay(r.result);
  }

  function dismissDone(id: number) {
    try {
      localStorage.setItem(SEEN_KEY, String(id));
    } catch {
      /* без хранилища просто покажем снова */
    }
    setSeen(id);
  }

  return (
    <div className="cg cw">
      {war?.phase === "prep" && <WarPrep war={war} />}
      {war?.phase === "battle" && (
        <WarBattle
          war={war}
          onOpen={(pos) => {
            setErr("");
            setSheet(pos);
          }}
        />
      )}
      {!war && (
        <>
          {showDone && last ? <WarDone row={last} onClose={() => dismissDone(last.id)} /> : null}
          <WarIdle st={st} toast={toast} />
        </>
      )}
      <WarHistory rows={st.history} />

      {war && slot && !replay && !result ? (
        <BaseSheet war={war} slot={slot} busy={busy} err={err} onAttack={() => void attack(slot.pos)} onClose={() => setSheet(null)} />
      ) : null}
      {replay ? (
        <Arena
          report={replay}
          onClose={() => {
            setResult(replay);
            setReplay(null);
          }}
        />
      ) : null}
      {result ? (
        <AttackResult
          report={result}
          left={war?.me?.attacksLeft ?? 0}
          onClose={() => setResult(null)}
          onNext={() => setResult(null)}
        />
      ) : null}
      {toastNode}
    </div>
  );
}
