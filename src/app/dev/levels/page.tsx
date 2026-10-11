import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { LevelEmblem } from "@/components/LevelEmblem";
import { ERAS, eraOf } from "@/lib/levelEmblem";

export const metadata: Metadata = {
  title: "Dev: эмблемы уровней",
  robots: { index: false, follow: false },
};

const GALLERY = [1, 3, 4, 5, 9, 14, 15, 22, 29, 30, 41, 49, 50, 64, 74, 75, 88, 99, 100];
const LOCKED = [40, 75, 100];

export default function DevLevelsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-black text-white">Эмблемы уровней</h1>
      <p className="mt-1 text-sm text-muted">
        Идентично level-emblem.html: эры, цвета, свечение, вращение, частицы, locked, пауза вне экрана.
      </p>

      <h2 className="mt-8 text-sm font-black uppercase tracking-wider text-white">Галерея · 88px</h2>
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {GALLERY.map((L) => {
          const E = ERAS[eraOf(L)];
          return (
            <div
              key={L}
              className="rounded-2xl border border-[#1b2033] bg-[#0b0d15] px-2 pb-3 pt-5 text-center transition hover:-translate-y-0.5"
              style={{ "--c": E.c } as CSSProperties}
            >
              <div className="flex justify-center">
                <LevelEmblem level={L} percent={(L * 37) % 100} size={88} />
              </div>
              <span className="mt-4 block text-xs font-bold text-muted">
                Уровень <i className="not-italic" style={{ color: E.c }}>{L}</i>
              </span>
              <span className="block text-xs font-bold text-muted">{E.n}</span>
            </div>
          );
        })}
      </div>

      <h2 className="mt-10 text-sm font-black uppercase tracking-wider text-white">Закрытые уровни</h2>
      <div className="mt-4 flex flex-wrap gap-4">
        {LOCKED.map((L) => (
          <div key={L} className="text-center">
            <LevelEmblem level={L} size={72} locked />
            <span className="mt-2 block text-xs font-bold text-muted">Уровень {L} · закрыт</span>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-sm font-black uppercase tracking-wider text-white">Размеры</h2>
      <div className="mt-4 flex flex-wrap items-end gap-6">
        {[40, 48, 56, 72, 88, 120].map((size) => (
          <div key={size} className="text-center">
            <LevelEmblem level={30} percent={64} size={size} />
            <span className="mt-2 block text-xs font-bold text-muted">{size}px</span>
          </div>
        ))}
      </div>
    </div>
  );
}
