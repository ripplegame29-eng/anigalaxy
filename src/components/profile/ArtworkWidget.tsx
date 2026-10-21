"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ART_LAYOUTS, patchArtwork, useArtwork, type ArtLayout } from "@/lib/artwork";
import { MediaPicker, MediaView } from "./MediaBits";

const slotsFor = (layout: ArtLayout) => ART_LAYOUTS.find((l) => l.id === layout)?.slots ?? 1;

/** Арт-витрина как в Steam: анимированные арты в выбранной раскладке */
export function ArtworkWidget({ readOnly = false }: { readOnly?: boolean }) {
  const a = useArtwork();
  const [open, setOpen] = useState(false);
  const count = slotsFor(a.layout);
  const filled = a.slots.slice(0, count).filter((s) => s.media);

  return (
    <div className="pc-art">
      {filled.length === 0 ? (
        <div className="pc-art-empty">
          <b>Арт-витрина пуста</b>
          <span>Добавьте гифки и арты: широкий и боковой, триптих, сетка или баннер.</span>
        </div>
      ) : (
        <div className={`pc-art-grid is-${a.layout}`} style={{ ["--h" as string]: `${a.height}px`, ["--ar" as string]: a.aspect || undefined, ["--n" as string]: count }}>
          {Array.from({ length: count }, (_, i) => {
            const s = a.slots[i];
            return (
              <figure key={i} className={`pc-art-it i${i}`}>
                {s?.media ? <MediaView id={s.media} fit={s.fit} /> : <span className="pc-art-hole" />}
                {s?.caption && <figcaption>{s.caption}</figcaption>}
              </figure>
            );
          })}
        </div>
      )}
      {!readOnly && (
        <button type="button" className="pc-edit" onClick={() => setOpen(true)}>
          Настроить арты
        </button>
      )}
      {open && <ArtworkEditor onClose={() => setOpen(false)} />}
    </div>
  );
}

function ArtworkEditor({ onClose }: { onClose: () => void }) {
  const a = useArtwork();
  const count = slotsFor(a.layout);

  const setSlot = (i: number, patch: Partial<{ media: string; caption: string; fit: "cover" | "contain" }>) =>
    patchArtwork((s) => {
      const slots = [...s.slots];
      while (slots.length <= i) slots.push({ media: "", caption: "", fit: "cover" });
      slots[i] = { ...slots[i], ...patch };
      return { ...s, slots };
    });

  return createPortal(
    <div className="pc-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pc-dlg" role="dialog" aria-modal="true" aria-label="Арт-витрина">
        <header>
          <div>
            <h3>Арт-витрина</h3>
            <p>Гифки и картинки до 20 МБ, анимация сохраняется</p>
          </div>
          <button type="button" className="pc-x" onClick={onClose} aria-label="Закрыть">×</button>
        </header>

        <p className="pc-lab">Раскладка</p>
        <div className="pc-layouts">
          {ART_LAYOUTS.map((l) => (
            <button key={l.id} type="button" className={a.layout === l.id ? "on" : ""} onClick={() => patchArtwork((s) => ({ ...s, layout: l.id, aspect: 0 }))}>
              <i className={`pc-mini is-${l.id}`}><s /><s /><s /><s /></i>
              <b>{l.name}</b>
              <small>{l.hint}</small>
            </button>
          ))}
        </div>

        <p className="pc-lab">Высота · {a.height}px</p>
        <input type="range" min={160} max={640} step={10} value={a.height} onChange={(e) => patchArtwork((s) => ({ ...s, height: Number(e.target.value) }))} className="pc-range" />

        <p className="pc-lab">Слоты</p>
        <div className="pc-slots">
          {Array.from({ length: count }, (_, i) => {
            const s = a.slots[i] ?? { media: "", caption: "", fit: "cover" as const };
            return (
              <div key={i} className="pc-slot">
                <div className="pc-slot-pv">{s.media ? <MediaView id={s.media} fit={s.fit} /> : <span>Слот {i + 1}</span>}</div>
                <div className="pc-slot-ct">
                  <MediaPicker current={s.media} label="Загрузить" onChange={(id) => setSlot(i, { media: id })} compact />
                  <input className="pc-in" placeholder="Подпись" value={s.caption} maxLength={60} onChange={(e) => setSlot(i, { caption: e.target.value })} />
                  <div className="pc-seg">
                    <button type="button" className={s.fit === "cover" ? "on" : ""} onClick={() => setSlot(i, { fit: "cover" })}>Заполнить</button>
                    <button type="button" className={s.fit === "contain" ? "on" : ""} onClick={() => setSlot(i, { fit: "contain" })}>Вписать</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <footer><button type="button" className="pc-btn" onClick={onClose}>Готово</button></footer>
      </div>
    </div>,
    document.body,
  );
}
