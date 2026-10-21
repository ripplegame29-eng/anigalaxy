"use client";

import { patchPText, usePText } from "@/lib/artwork";

/** Свободный текст: цитата, девиз или заметка о себе */
export function TextWidget({ readOnly = false }: { readOnly?: boolean }) {
  const t = usePText();
  return (
    <div className="pc-text">
      {readOnly ? (
        t.text ? <blockquote className={`is-${t.style} s-${t.size}`} style={{ textAlign: t.align }}>{t.text}</blockquote> : null
      ) : (
        <>
          <textarea
            className={`pc-text-in is-${t.style} s-${t.size}`}
            style={{ textAlign: t.align }}
            value={t.text}
            maxLength={400}
            placeholder="Цитата, девиз или пара слов о себе"
            onChange={(e) => patchPText((s) => ({ ...s, text: e.target.value }))}
          />
          <div className="pc-text-bar">
            <div className="pc-seg">
              {(["s", "m", "l"] as const).map((v) => (
                <button key={v} type="button" className={t.size === v ? "on" : ""} onClick={() => patchPText((s) => ({ ...s, size: v }))}>{v === "s" ? "Мелкий" : v === "m" ? "Средний" : "Крупный"}</button>
              ))}
            </div>
            <div className="pc-seg">
              {(["left", "center", "right"] as const).map((v) => (
                <button key={v} type="button" className={t.align === v ? "on" : ""} onClick={() => patchPText((s) => ({ ...s, align: v }))}>{v === "left" ? "Слева" : v === "center" ? "Центр" : "Справа"}</button>
              ))}
            </div>
            <div className="pc-seg">
              {(["plain", "quote", "glow"] as const).map((v) => (
                <button key={v} type="button" className={t.style === v ? "on" : ""} onClick={() => patchPText((s) => ({ ...s, style: v }))}>{v === "plain" ? "Обычный" : v === "quote" ? "Цитата" : "Свечение"}</button>
              ))}
            </div>
            <small>{t.text.length}/400</small>
          </div>
        </>
      )}
    </div>
  );
}
