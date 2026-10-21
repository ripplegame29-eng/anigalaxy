"use client";

import { useRef, useState } from "react";
import { deleteMedia, putMedia, useMedia } from "@/lib/media-store";

/** Картинка, гифка или видео из хранилища; видео — без звука, по кругу */
export function MediaView({ id, fit = "cover", className }: { id: string; fit?: "cover" | "contain"; className?: string }) {
  const m = useMedia(id);
  if (!m) return <span className={`pc-media-wait ${className ?? ""}`} aria-hidden />;
  const style = { objectFit: fit } as const;
  return m.video ? (
    <video className={className} src={m.url} style={style} autoPlay loop muted playsInline />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src={m.url} style={style} alt="" draggable={false} />
  );
}

/** Кнопка загрузки файла: старый файл удаляется, новый id уходит в onChange */
export function MediaPicker({
  current,
  label,
  onChange,
  compact = false,
}: {
  current: string;
  label: string;
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setErr("");
    const res = await putMedia(file);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    if (current) void deleteMedia(current);
    onChange(res.id);
  };

  return (
    <div className={`pc-pick ${compact ? "is-compact" : ""}`}>
      <input ref={input} type="file" accept="image/*,video/mp4,video/webm" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      <button type="button" className="pc-btn" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Сохраняю…" : current ? "Заменить" : label}
      </button>
      {current && (
        <button type="button" className="pc-btn is-ghost" onClick={() => { void deleteMedia(current); onChange(""); }}>
          Убрать
        </button>
      )}
      {err && <small className="pc-err">{err}</small>}
    </div>
  );
}
