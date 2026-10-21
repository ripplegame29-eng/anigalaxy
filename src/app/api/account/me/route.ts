import { json, route } from "@/lib/server/http";
import { toPublic } from "@/lib/server/users";

export const runtime = "nodejs";

/** Кто я: аккаунт по cookie сессии (200 с account: null для гостя) */
export const GET = route(({ user }) => json({ account: user ? toPublic(user) : null }));
