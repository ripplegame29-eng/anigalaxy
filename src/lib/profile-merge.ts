/**
 * Слияние двух копий документа профиля при расхождении устройства и сервера.
 *
 * Раньше при конфликте побеждал сервер целиком, и «прочитано»/«очищено» в
 * уведомлениях, сделанное на этом устройстве, пропадало: после входа
 * они снова были непрочитанными. Теперь уведомления сливаются: запись
 * прочитана, если прочитана хоть на одном устройстве; очищенные и удалённые
 * не возвращаются. Остальные поля берутся с сервера, как и раньше.
 */

export const PROFILE_KEY = "animehub:profile:v1";

interface Notice {
  id: string;
  at: number;
  read?: boolean;
  [key: string]: unknown;
}

interface Doc {
  notices?: Notice[];
  noticesClearedAt?: number;
  noticesReadAt?: number;
  removedNotices?: string[];
  [key: string]: unknown;
}

export function mergeProfileDocs(localRaw: string, serverRaw: string): string {
  try {
    const local = JSON.parse(localRaw) as Doc;
    const server = JSON.parse(serverRaw) as Doc;
    if (!local || typeof local !== "object" || !server || typeof server !== "object") return serverRaw;

    const cleared = Math.max(Number(local.noticesClearedAt) || 0, Number(server.noticesClearedAt) || 0);
    const readAt = Math.max(Number(local.noticesReadAt) || 0, Number(server.noticesReadAt) || 0);
    const removed = [...new Set([...(local.removedNotices ?? []), ...(server.removedNotices ?? [])])].slice(-200);
    const gone = new Set(removed);

    const byId = new Map<string, Notice>();
    for (const n of [...(server.notices ?? []), ...(local.notices ?? [])]) {
      if (!n || typeof n.id !== "string" || gone.has(n.id) || !(Number(n.at) > cleared)) continue;
      const prev = byId.get(n.id);
      byId.set(n.id, { ...n, read: Boolean(prev?.read || n.read || Number(n.at) <= readAt) });
    }
    const notices = [...byId.values()].sort((a, b) => b.at - a.at).slice(0, 40);

    return JSON.stringify({ ...server, notices, noticesClearedAt: cleared, noticesReadAt: readAt, removedNotices: removed });
  } catch {
    return serverRaw;
  }
}
