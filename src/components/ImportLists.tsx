"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  MAX_IMPORT,
  STATUS_LABEL,
  STATUS_ORDER,
  parseImportFile,
  type ImportEntry,
} from "@/lib/import-lists";
import { applyImport, type ApplyOptions, type ApplyResult, type Resolved } from "@/lib/import-apply";
import "./import-lists.css";

type Step = "source" | "resolving" | "review" | "done";
type Tab = "nick" | "file";

const CHUNK = 40;

function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}

export function ImportLists() {
  const [tab, setTab] = useState<Tab>("nick");
  const [step, setStep] = useState<Step>("source");
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");
  const [entries, setEntries] = useState<ImportEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [found, setFound] = useState<Resolved[]>([]);
  const [opts, setOpts] = useState<ApplyOptions>({ lists: true, favorites: true, ratings: true });
  const [result, setResult] = useState<ApplyResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abort = useRef(false);

  async function begin(rows: ImportEntry[], label: string) {
    setSource(label);
    setEntries(rows);
    setProgress(0);
    setStep("resolving");
    abort.current = false;
    const out: Resolved[] = [];
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        if (abort.current) return;
        const part = rows.slice(i, i + CHUNK);
        const res = await fetch("/api/import/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: part.map((e) => ({ sid: e.sid, title: e.title })) }),
        });
        if (!res.ok) throw new Error("Не удалось сопоставить тайтлы");
        const data = (await res.json()) as { ids?: (string | null)[] };
        part.forEach((entry, k) => {
          const id = data.ids?.[k];
          if (id) out.push({ entry, id });
        });
        setProgress(Math.min(rows.length, i + CHUNK));
      }
      setFound(out);
      setOpts({
        lists: true,
        favorites: out.some((r) => r.entry.fav),
        ratings: out.some((r) => r.entry.score),
      });
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка переноса");
      setStep("source");
    }
  }

  async function fromNick() {
    const value = nick.trim();
    if (!value) {
      setError("Введите ник на Shikimori");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/import/shikimori?nick=${encodeURIComponent(value)}`);
      const data = (await res.json()) as { entries?: ImportEntry[]; error?: string };
      if (!res.ok || !data.entries) throw new Error(data.error ?? "Не удалось получить список");
      await begin(data.entries.slice(0, MAX_IMPORT), "Shikimori");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось получить список");
    } finally {
      setBusy(false);
    }
  }

  async function fromFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (file.size > 8 * 1024 * 1024) {
      setError("Файл слишком большой (максимум 8 МБ)");
      return;
    }
    setBusy(true);
    try {
      const rows = parseImportFile(file.name, await file.text());
      await begin(rows, "Файл");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось прочитать файл");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function apply() {
    setResult(applyImport(found, opts, source));
    setStep("done");
  }

  function reset() {
    abort.current = true;
    setStep("source");
    setError("");
    setFound([]);
    setEntries([]);
    setResult(null);
  }

  const total = entries.length;
  const missed = total - found.length;
  const counts = STATUS_ORDER.map((s) => ({ s, n: found.filter((r) => r.entry.status === s).length })).filter((x) => x.n);
  const favs = found.filter((r) => r.entry.fav).length;
  const rated = found.filter((r) => r.entry.score).length;

  return (
    <div className="il">
      <header className="il-head">
        <h1>
          Перенос <em>списков</em>
        </h1>
        <p>Загрузите список из Shikimori, MyAnimeList или другого сайта — смотрю, просмотрено, планы, оценки и избранное окажутся в «Моём списке».</p>
      </header>

      {step === "source" && (
        <section className="il-card">
          <div className="il-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "nick"} onClick={() => setTab("nick")}>
              По нику Shikimori
            </button>
            <button type="button" role="tab" aria-selected={tab === "file"} onClick={() => setTab("file")}>
              Из файла
            </button>
          </div>

          {tab === "nick" ? (
            <form
              className="il-body"
              onSubmit={(e) => {
                e.preventDefault();
                void fromNick();
              }}
            >
              <label htmlFor="il-nick">Ник на Shikimori</label>
              <input
                id="il-nick"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder="например, Nick_name"
                autoComplete="off"
                maxLength={40}
              />
              <p className="il-hint">Список на Shikimori должен быть открыт: Настройки → Приватность → «Список аниме».</p>
              <button type="submit" className="il-btn" disabled={busy}>
                {busy ? "Загружаем…" : "Загрузить список"}
              </button>
            </form>
          ) : (
            <div className="il-body">
              <label htmlFor="il-file">Файл экспорта</label>
              <input
                id="il-file"
                ref={fileRef}
                type="file"
                accept=".xml,.json,.txt,.csv,text/xml,application/json,text/plain"
                onChange={(e) => void fromFile(e.target.files?.[0])}
                disabled={busy}
              />
              <ul className="il-hint il-list">
                <li><b>MyAnimeList и Shikimori:</b> экспорт в формате MAL (.xml) или .json.</li>
                <li><b>AniList, Anixart и другие:</b> текстовый файл, где каждая строка — название аниме. Оценку можно добавить через «;», например «Наруто; 9».</li>
              </ul>
            </div>
          )}

          {error && <p className="il-err" role="alert">{error}</p>}
        </section>
      )}

      {step === "resolving" && (
        <section className="il-card il-body">
          <h2>Ищем тайтлы на сайте…</h2>
          <div className="il-bar" role="progressbar" aria-valuenow={progress} aria-valuemax={total}>
            <i style={{ width: `${total ? (progress / total) * 100 : 0}%` }} />
          </div>
          <p className="il-hint">
            {progress} из {total}. Не закрывайте страницу.
          </p>
          <button type="button" className="il-btn il-ghost" onClick={reset}>Отмена</button>
        </section>
      )}

      {step === "review" && (
        <section className="il-card il-body">
          <h2>
            Нашли {found.length} из {total} {plural(total, "тайтла", "тайтлов", "тайтлов")}
          </h2>
          {missed > 0 && (
            <p className="il-hint">{missed} {plural(missed, "тайтла", "тайтлов", "тайтлов")} пока нет в каталоге, они будут пропущены.</p>
          )}
          <ul className="il-stat">
            {counts.map(({ s, n }) => (
              <li key={s}><b>{n}</b><span>{STATUS_LABEL[s]}</span></li>
            ))}
            {favs > 0 && <li><b>{favs}</b><span>В избранном</span></li>}
            {rated > 0 && <li><b>{rated}</b><span>С оценками</span></li>}
          </ul>

          <div className="il-opts">
            <label>
              <input type="checkbox" checked={opts.lists} onChange={(e) => setOpts({ ...opts, lists: e.target.checked })} />
              Списки — как личные подборки «{STATUS_LABEL.watching} · {source}» и другие
            </label>
            {favs > 0 && (
              <label>
                <input type="checkbox" checked={opts.favorites} onChange={(e) => setOpts({ ...opts, favorites: e.target.checked })} />
                Избранное
              </label>
            )}
            {rated > 0 && (
              <label>
                <input type="checkbox" checked={opts.ratings} onChange={(e) => setOpts({ ...opts, ratings: e.target.checked })} />
                Оценки (уже поставленные не изменятся)
              </label>
            )}
          </div>

          <div className="il-row">
            <button type="button" className="il-btn" onClick={apply} disabled={!found.length || (!opts.lists && !opts.favorites && !opts.ratings)}>
              Перенести
            </button>
            <button type="button" className="il-btn il-ghost" onClick={reset}>Назад</button>
          </div>
        </section>
      )}

      {step === "done" && result && (
        <section className="il-card il-body">
          <h2>Готово</h2>
          <ul className="il-stat">
            {result.collections > 0 && <li><b>{result.collections}</b><span>{plural(result.collections, "подборка", "подборки", "подборок")}</span></li>}
            {result.added > 0 && <li><b>{result.added}</b><span>добавлено в списки</span></li>}
            {result.favorites > 0 && <li><b>{result.favorites}</b><span>в избранное</span></li>}
            {result.ratings > 0 && <li><b>{result.ratings}</b><span>{plural(result.ratings, "оценка", "оценки", "оценок")}</span></li>}
          </ul>
          <div className="il-row">
            <Link href="/list" className="il-btn">Открыть «Мой список»</Link>
            <button type="button" className="il-btn il-ghost" onClick={reset}>Перенести ещё</button>
          </div>
        </section>
      )}
    </div>
  );
}
