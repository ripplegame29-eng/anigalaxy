/**
 * Внешний вид игрока для списков (чат, рейтинг): адрес аватара и рамка
 * из его профиля. Аватар в профиле — data-URL, поэтому отдаём ссылку на
 * `/api/avatar`, а не саму картинку.
 */

import { num, str, type Database } from "./sqlite";

const PROFILE_KEY = "animehub:profile:v1";

export interface Look {
  avatar: string;
  frameId: string;
  /** id пресетного фона профиля (для своего — "custom") */
  backgroundId?: string;
  /** Адрес своего фона профиля, если он загружен */
  bgImage?: string;
}

export const NO_LOOK: Look = { avatar: "", frameId: "" };

export function looksOf(db: Database, userIds: number[]): Map<number, Look> {
  const ids = [...new Set(userIds)];
  const found = new Map<number, Look>();
  if (!ids.length) return found;
  const docs = db
    .prepare(
      `SELECT user_id, value, updated_at FROM user_docs WHERE doc_key = ? AND user_id IN (${ids.map(() => "?").join(",")})`,
    )
    .all(PROFILE_KEY, ...ids);
  for (const doc of docs) {
    try {
      const profile = JSON.parse(str(doc.value)) as {
        avatar?: unknown;
        frameId?: unknown;
        backgroundId?: unknown;
        backgroundCustom?: unknown;
      };
      const raw = typeof profile.avatar === "string" ? profile.avatar : "";
      const userId = num(doc.user_id);
      const avatar = raw.startsWith("data:image/")
        ? `/api/avatar?u=${userId}&v=${num(doc.updated_at)}`
        : /^https?:\/\//.test(raw) || raw.startsWith("/")
          ? raw
          : "";
      const custom = typeof profile.backgroundCustom === "string" && profile.backgroundCustom.startsWith("data:image/");
      found.set(userId, {
        avatar,
        frameId: typeof profile.frameId === "string" ? profile.frameId : "",
        backgroundId: typeof profile.backgroundId === "string" ? profile.backgroundId : "",
        bgImage: custom ? `/api/avatar?u=${userId}&kind=bg&v=${num(doc.updated_at)}` : "",
      });
    } catch {
      /* битый профиль — остаются инициалы */
    }
  }
  return found;
}
