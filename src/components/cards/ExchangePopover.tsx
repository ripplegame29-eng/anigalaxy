"use client";

import { useState } from "react";
import { act } from "@/lib/cards/client";
import { EXCHANGE } from "@/lib/cards/config";
import { fmt, toast, useBusy } from "./common";
import { Cur } from "./icons";

const EX_STEPS = [1, 5, 10, 25, 50, 100];

/** Обмен AC на алмазы (всплывающая панель) */
export function ExchangePopover({ ac, diamonds, onDone }: { ac: number; diamonds: number; onDone: () => void }) {
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
