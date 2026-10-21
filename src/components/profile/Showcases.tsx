"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTitles } from "@/lib/titles";
import { FAVORITES_KEY } from "@/lib/collections";
import { parseList, useLocalSnapshot } from "@/lib/use-local-storage";
import { searchCatalog, type TierItem } from "@/lib/tier-list";
import { MAX_ART, MAX_PICKS, patchShowcases, shrinkImage, useShowcases } from "@/lib/showcases";
import { useProgress } from "@/lib/progression/events";
import { PROGRESSION_CONFIG } from "@/lib/progression/progression.config";
import { collectMetrics } from "@/lib/progression/service";
import { buildAchievements, rarestUnlocked } from "@/lib/progression/achievements-view";
import { emblemMeta } from "@/lib/progression/achievements.config";
import { AchievementEmblem } from "@/components/progression/AchievementEmblem";
import { AchievementCode } from "@/components/progression/AchievementCode";
import { Poster } from "@/components/Poster";
import { WidgetIcon } from "./WidgetIcon";
import "../showcases.css";

/* ------------------------------ Общее окно ------------------------------ */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0);
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => {
      clearTimeout(t);
      removeEventListener("keydown", key);
    };
  }, [onClose]);
  if (!mounted) return null;
  return createPortal(
    <div className="sc-modal" role="presentation" onClick={onClose}>
      <div className="sc-dlg" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header>
          <h4>{title}</h4>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            <WidgetIcon name="x" />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function EditBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="sc-edit" onClick={onClick}>
      <WidgetIcon name="gear" />
      {label}
    </button>
  );
}

/* --------------------------- Избранное аниме ---------------------------- */

export function FeaturedWidget({ readOnly = false }: { readOnly?: boolean }) {
  const s = useShowcases();
  const [open, setOpen] = useState(false);
  const f = s.featured;

  return (
    <div className="sc-feat">
      {f ? (
        <div className="sc-feat-body">
          <div className="sc-feat-bg" aria-hidden>
            <Poster src={f.poster} alt="" title={f.title} className="h-full w-full object-cover" />
          </div>
          <a className="sc-feat-poster" href={`/anime/${encodeURIComponent(f.id)}`}>
            <Poster src={f.poster} alt={f.title} title={f.title} className="h-full w-full object-cover" />
            <i aria-hidden />
          </a>
          <div className="sc-feat-info">
            <span className="sc-eyebrow">ИЗБРАННОЕ АНИМЕ</span>
            <h5>{f.title}</h5>
            {s.featRate > 0 && (
              <span className="sc-rate">
                <b>★ {s.featRate}</b>/10
              </span>
            )}
            {s.featNote && <p>«{s.featNote}»</p>}
          </div>
        </div>
      ) : (
        <div className="sc-empty">
          <WidgetIcon name="heart" />
          <b>Витрина пуста</b>
          <span>Выберите одно аниме, которым хотите гордиться.</span>
        </div>
      )}
      {!readOnly && <EditBtn onClick={() => setOpen(true)} label={f ? "Изменить" : "Выбрать аниме"} />}
      {open && <FeaturedEditor onClose={() => setOpen(false)} />}
    </div>
  );
}

function FeaturedEditor({ onClose }: { onClose: () => void }) {
  const s = useShowcases();
  const titles = useTitles();
  const favRaw = useLocalSnapshot(FAVORITES_KEY);
  const favs = useMemo(() => parseList<string>(favRaw, []).slice(0, 12), [favRaw]);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<TierItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [note, setNote] = useState(s.featNote);
  const [rate, setRate] = useState(s.featRate);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setBusy(true);
      setErr(false);
      searchCatalog(q)
        .then((r) => setFound(r.slice(0, 18)))
        .catch(() => setErr(true))
        .finally(() => setBusy(false));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (item: TierItem) => {
    patchShowcases({ featured: { id: item.id, title: item.title, poster: item.poster } });
  };
  const save = () => {
    patchShowcases({ featNote: note.trim().slice(0, 160), featRate: rate });
    onClose();
  };

  return (
    <Modal title="Избранное аниме" onClose={onClose}>
      {favs.length > 0 && (
        <>
          <p className="sc-lbl">Из вашего избранного</p>
          <div className="sc-chips">
            {favs.map((id) => (
              <button key={id} type="button" onClick={() => pick({ id, title: titles[id]?.title ?? id, poster: titles[id]?.poster })}>
                {titles[id]?.title ?? id}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="sc-lbl">Поиск по каталогу</p>
      <input className="sc-in" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название аниме…" />
      <div className="sc-grid">
        {found.map((it) => (
          <button key={it.id} type="button" className={s.featured?.id === it.id ? "is-on" : ""} onClick={() => pick(it)} title={it.title}>
            <Poster src={it.poster} alt={it.title} title={it.title} className="h-full w-full object-cover" />
          </button>
        ))}
        {busy && <span className="sc-note">Ищем…</span>}
        {err && <span className="sc-note">Каталог недоступен</span>}
      </div>
      <p className="sc-lbl">Оценка: {rate > 0 ? `${rate}/10` : "не показывать"}</p>
      <input type="range" min={0} max={10} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="sc-range" />
      <p className="sc-lbl">Подпись ({note.length}/160)</p>
      <textarea className="sc-in" rows={2} maxLength={160} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Почему это ваше любимое" />
      <footer>
        {s.featured && (
          <button type="button" className="sc-link" onClick={() => patchShowcases({ featured: null, featNote: "", featRate: 0 })}>
            Очистить
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" onClick={save}>Готово</button>
      </footer>
    </Modal>
  );
}

/* ------------------------------ Арт-витрина ------------------------------ */

export function ArtWidget({ readOnly = false }: { readOnly?: boolean }) {
  const s = useShowcases();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<number | null>(null);

  return (
    <div className="sc-art">
      {s.art.length === 0 ? (
        <div className="sc-empty">
          <WidgetIcon name="grid" />
          <b>Арт-витрина пуста</b>
          <span>Добавьте до {MAX_ART} картинок: скриншоты, арты, обои.</span>
        </div>
      ) : (
        <div className={`sc-art-grid n${s.art.length}`}>
          {s.art.map((a, i) => (
            <button key={i} type="button" className="sc-art-it" onClick={() => setView(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.src} alt={a.caption || "Арт"} loading="lazy" />
              {a.caption && <em>{a.caption}</em>}
            </button>
          ))}
        </div>
      )}
      {!readOnly && <EditBtn onClick={() => setOpen(true)} label="Изменить" />}
      {open && <ArtEditor onClose={() => setOpen(false)} />}
      {view !== null && s.art[view] && (
        <Modal title={s.art[view].caption || "Арт"} onClose={() => setView(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="sc-full" src={s.art[view].src} alt={s.art[view].caption || "Арт"} />
        </Modal>
      )}
    </div>
  );
}

function ArtEditor({ onClose }: { onClose: () => void }) {
  const s = useShowcases();
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");

  const add = async (files: FileList | null) => {
    if (!files) return;
    setErr("");
    const room = MAX_ART - s.art.length;
    try {
      const next = [];
      for (const file of Array.from(files).slice(0, room)) {
        if (!file.type.startsWith("image/")) continue;
        next.push({ src: await shrinkImage(file), caption: "" });
      }
      patchShowcases({ art: [...s.art, ...next] });
    } catch {
      setErr("Не удалось прочитать файл или нет места в хранилище браузера");
    }
  };
  const set = (i: number, caption: string) =>
    patchShowcases({ art: s.art.map((a, j) => (j === i ? { ...a, caption: caption.slice(0, 60) } : a)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= s.art.length) return;
    const n = [...s.art];
    [n[i], n[j]] = [n[j], n[i]];
    patchShowcases({ art: n });
  };

  return (
    <Modal title="Арт-витрина" onClose={onClose}>
      <div className="sc-rows">
        {s.art.map((a, i) => (
          <div key={i} className="sc-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.src} alt="" />
            <input className="sc-in" value={a.caption} onChange={(e) => set(i, e.target.value)} placeholder="Подпись" />
            <button type="button" onClick={() => move(i, -1)} aria-label="Выше"><WidgetIcon name="left" /></button>
            <button type="button" onClick={() => move(i, 1)} aria-label="Ниже"><WidgetIcon name="right" /></button>
            <button type="button" onClick={() => patchShowcases({ art: s.art.filter((_, j) => j !== i) })} aria-label="Убрать"><WidgetIcon name="x" /></button>
          </div>
        ))}
      </div>
      {err && <p className="sc-note">{err}</p>}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
      <footer>
        <button type="button" className="btn g" disabled={s.art.length >= MAX_ART} onClick={() => input.current?.click()}>
          <WidgetIcon name="plus" />
          Добавить ({s.art.length}/{MAX_ART})
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" onClick={onClose}>Готово</button>
      </footer>
    </Modal>
  );
}

/* -------------------------- Витрина достижений -------------------------- */

function useViews() {
  const doc = useProgress();
  return useMemo(() => buildAchievements(doc, collectMetrics(), PROGRESSION_CONFIG), [doc]);
}

export function PickWidget({ readOnly = false }: { readOnly?: boolean }) {
  const s = useShowcases();
  const views = useViews();
  const [open, setOpen] = useState(false);

  const shown = useMemo(() => {
    const chosen = s.picks.map((id) => views.find((v) => v.def.id === id && v.status === "unlocked")).filter((v): v is NonNullable<typeof v> => !!v);
    return chosen.length > 0 ? chosen : rarestUnlocked(views, 6);
  }, [s.picks, views]);

  return (
    <div className="sc-pick">
      {shown.length === 0 ? (
        <div className="sc-empty">
          <WidgetIcon name="trophy" />
          <b>Пока нечего показать</b>
          <span>Получите достижения — и выберите любимые.</span>
        </div>
      ) : (
        <div className="sc-pick-grid">
          {shown.map((item) => {
            const meta = emblemMeta(item.def.id);
            return (
              <article key={item.def.id} className="sc-pick-it">
                <AchievementEmblem
                  achievement={{ id: item.def.id, name: item.def.name, glyph: meta.glyph, tier: item.tier, maxTier: meta.maxTier }}
                  rarity={meta.rarity}
                  progress={item.percent}
                  unlocked
                  locked={false}
                  animated
                  size={64}
                />
                <b><AchievementCode id={item.def.id} family={item.family} tier={item.tier} disguised={false} /></b>
                <span>{meta.rarity}</span>
              </article>
            );
          })}
        </div>
      )}
      {!readOnly && <EditBtn onClick={() => setOpen(true)} label="Выбрать" />}
      {open && <PickEditor views={views} onClose={() => setOpen(false)} />}
    </div>
  );
}

function PickEditor({ views, onClose }: { views: ReturnType<typeof useViews>; onClose: () => void }) {
  const s = useShowcases();
  const got = views.filter((v) => v.status === "unlocked");
  const toggle = (id: string) => {
    const has = s.picks.includes(id);
    patchShowcases({ picks: has ? s.picks.filter((x) => x !== id) : [...s.picks, id].slice(0, MAX_PICKS) });
  };
  return (
    <Modal title={`Витрина достижений · ${s.picks.length}/${MAX_PICKS}`} onClose={onClose}>
      {got.length === 0 ? (
        <p className="sc-note">Полученных достижений пока нет.</p>
      ) : (
        <div className="sc-picklist">
          {got.map((item) => {
            const meta = emblemMeta(item.def.id);
            const on = s.picks.includes(item.def.id);
            return (
              <button key={item.def.id} type="button" className={on ? "is-on" : ""} onClick={() => toggle(item.def.id)} aria-pressed={on}>
                <AchievementEmblem
                  achievement={{ id: item.def.id, name: item.def.name, glyph: meta.glyph, tier: item.tier, maxTier: meta.maxTier }}
                  rarity={meta.rarity}
                  progress={item.percent}
                  unlocked
                  locked={false}
                  animated={false}
                  size={44}
                />
                <span><AchievementCode id={item.def.id} family={item.family} tier={item.tier} disguised={false} /></span>
              </button>
            );
          })}
        </div>
      )}
      <footer>
        <button type="button" className="sc-link" onClick={() => patchShowcases({ picks: [] })}>Авто: самые редкие</button>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" onClick={onClose}>Готово</button>
      </footer>
    </Modal>
  );
}
