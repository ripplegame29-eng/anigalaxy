"use client";

import { useState } from "react";
import { adminPost } from "./api";
import { useUi } from "./ui";

const AUDIENCES = [
  { id: "all", label: "Все игроки", hint: "каждый, кто не в бане" },
  { id: "online", label: "Сейчас онлайн", hint: "активны последние 5 минут" },
  { id: "active7", label: "Активные", hint: "заходили за неделю" },
  { id: "new7", label: "Новички", hint: "зарегистрировались за неделю" },
  { id: "premium", label: "Premium", hint: "с действующей подпиской" },
  { id: "free", label: "Без Premium", hint: "бесплатные аккаунты" },
] as const;

export function Rewards() {
  const ui = useUi();
  const [aud, setAud] = useState<string>("all");
  const [ac, setAc] = useState("");
  const [xp, setXp] = useState("");
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [text, setText] = useState("");
  const label = AUDIENCES.find((a) => a.id === aud)?.label ?? "";

  const grant = async () => {
    const parts = [ac && `${ac} AC`, xp && `${xp} XP`, days && `${days} дн. Premium`].filter(Boolean).join(", ");
    if (!parts) return ui.toast("Укажите, что выдать", "info");
    if (!(await ui.confirm(`Выдать «${parts}» — ${label.toLowerCase()}?`, { text: "Действие нельзя отменить одной кнопкой.", confirmLabel: "Выдать всем" }))) return;
    const r = await adminPost({ action: "massGrant", audience: aud, ac: ac || undefined, xp: xp || undefined, premiumDays: days || undefined, note, notify });
    if (r.ok) {
      ui.toast(`Выдано: ${String(r.count)} игрокам`);
      setAc("");
      setXp("");
      setDays("");
    } else ui.toast(r.error ?? "Не удалось", "err");
  };

  const send = async () => {
    if (!(await ui.confirm(`Отправить сообщение — ${label.toLowerCase()}?`, { text: text.slice(0, 140), confirmLabel: "Отправить" }))) return;
    const r = await adminPost({ action: "broadcast", audience: aud, text });
    if (r.ok) {
      ui.toast(`Отправлено: ${String(r.count)} игрокам`);
      setText("");
    } else ui.toast(r.error ?? "Не удалось", "err");
  };

  return (
    <div className="adm-stack-lg">
      <section className="adm-card adm-panel">
        <h3>Кому</h3>
        <div className="adm-aud">
          {AUDIENCES.map((a) => (
            <button key={a.id} type="button" className={aud === a.id ? "on" : ""} onClick={() => setAud(a.id)}>
              <b>{a.label}</b>
              <small>{a.hint}</small>
            </button>
          ))}
        </div>
      </section>

      <div className="adm-two adm-two-even">
        <section className="adm-card adm-panel">
          <h3>Массовая выдача</h3>
          <div className="adm-form-grid">
            <label>
              AniCoin
              <input type="number" value={ac} onChange={(e) => setAc(e.target.value)} placeholder="0" />
            </label>
            <label>
              Опыт
              <input type="number" value={xp} onChange={(e) => setXp(e.target.value)} placeholder="0" />
            </label>
            <label className="wide">
              Premium, дней
              <input type="number" value={days} onChange={(e) => setDays(e.target.value)} placeholder="0" />
            </label>
            <label className="wide">
              Комментарий в журнал
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="например: подарок к празднику" />
            </label>
          </div>
          <label className="adm-check">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Уведомить игроков
          </label>
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => void grant()}>
            Выдать — {label.toLowerCase()}
          </button>
        </section>

        <section className="adm-card adm-panel">
          <h3>Рассылка в колокольчик</h3>
          <textarea className="adm-ta" rows={6} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="Например: Сегодня вечером — технические работы, сайт будет недоступен 10 минут" />
          <small className="adm-hint">{text.length}/300</small>
          <button type="button" className="adm-btn adm-btn-primary" disabled={text.trim().length < 2} onClick={() => void send()}>
            Отправить — {label.toLowerCase()}
          </button>
        </section>
      </div>
      <p className="adm-note">Предметы, рамки и теги выдаются конкретному игроку: откройте его карточку на вкладке «Игроки» → «Предметы».</p>
    </div>
  );
}
