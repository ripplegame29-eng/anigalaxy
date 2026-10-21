"use client";

import type { CSSProperties } from "react";
import { useProfileTheme } from "@/lib/ptheme";
import { MediaView } from "./MediaBits";

/** CSS-переменные темы: вешаются на корень профиля */
export function themeVars(t: ReturnType<typeof useProfileTheme>): CSSProperties | undefined {
  if (!t.on) return undefined;
  const v: Record<string, string> = {
    "--pt-glass": String(t.glass.opacity / 100),
    "--pt-blur": `${t.glass.blur}px`,
    "--pt-radius": `${t.radius}px`,
  };
  if (t.accent) {
    v["--blue"] = t.accent;
    v["--cyan"] = t.accent;
    v["--ring"] = t.accent;
    v["--color-accent"] = t.accent;
    v["--color-accent-2"] = t.accent;
  }
  return v as CSSProperties;
}

/** Слои за содержимым: фон страницы и боковые арты */
export function ProfileThemeLayers() {
  const t = useProfileTheme();
  if (!t.on) return null;
  return (
    <div className="pt-layers" aria-hidden>
      {t.bg.media && (
        <div className="pt-bg" style={{ filter: t.bg.blur ? `blur(${t.bg.blur}px)` : undefined }}>
          <MediaView id={t.bg.media} fit={t.bg.fit} />
        </div>
      )}
      <i className="pt-dim" style={{ opacity: t.bg.dim / 100 }} />
      {(["left", "right"] as const).map(
        (side) =>
          t[side].media && (
            <div key={side} className={`pt-side is-${side} ${t.float ? "is-float" : ""}`} style={{ width: `${t[side].width}vw`, opacity: t[side].opacity / 100 }}>
              <MediaView id={t[side].media} fit="contain" />
            </div>
          ),
      )}
    </div>
  );
}
