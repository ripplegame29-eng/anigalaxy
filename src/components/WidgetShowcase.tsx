"use client";

/**
 * Витрина виджетов на «Основном» странице профиля.
 *
 * Это тот же список, что и в разделе «Виджеты», и тот же `WidgetBody`.
 * Своего состояния и своего ключа в localStorage здесь нет намеренно: с двумя
 * независимыми списками один и тот же блок можно было бы оставить в витрине,
 * сняв его с раздела «Виджеты» — и тогда снять его было бы уже нечем. Один
 * список — одно место, где состав меняется.
 *
 * Рендерится после монтирования: раскладка лежит в браузере, и отдать её с
 * первого кадра означало бы разойтись с сервером на гидрации.
 *
 * `readOnly` — показ чужого профиля: блоки те же, но редактируемые (тир-лист)
 * показываются только для чтения.
 */

import { useEffect, useState } from "react";
import {
  MAX_WIDGETS,
  WIDGET_BY_ID,
  readWidgetLayout,
  type WidgetSlot,
} from "@/lib/widgets";
import { WidgetBody } from "@/components/profile/Widgets";

export function WidgetShowcase({ readOnly = false }: { readOnly?: boolean }) {
  const [slots, setSlots] = useState<WidgetSlot[]>([]);

  useEffect(() => {
    const sync = () => setSlots(readWidgetLayout());
    sync();
    addEventListener("storage", sync);
    return () => removeEventListener("storage", sync);
  }, []);

  if (slots.length === 0) return null;

  return (
    /* `ag-root` обязателен: оформление виджетов в ag-theme.css привязано к
       нему, и без него блоки выходят голыми — без рамок, отступов и сетки. */
    <section aria-label="Витрина виджетов" className="ag-wv">
      <div className="ag-wv-grid">
        {slots.map((slot) => {
          const def = WIDGET_BY_ID[slot.id];
          if (!def) return null;
          return (
            <article
              key={slot.id}
              className={`ag-wv-card ${slot.w === "l" ? "ag-wv-wide" : ""}`}
            >
              <header className="ag-wv-card-head">
                <span>{def.title}</span>
              </header>
              <WidgetBody id={slot.id} readOnly={readOnly} />
            </article>
          );
        })}
      </div>

      {slots.length >= MAX_WIDGETS && (
        <p className="ag-wv-note">
          Показаны первые {MAX_WIDGETS} блоков — состав и порядок меняются в
          разделе «Виджеты».
        </p>
      )}
    </section>
  );
}