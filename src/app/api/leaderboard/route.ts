import { allTimeBoard, myWeekly, weeklyBoard } from "@/lib/server/leaderboard";
import { json, route } from "@/lib/server/http";

export const runtime = "nodejs";

/** `?period=week|all` — таблица лидеров и моё место */
export const GET = route(({ db, request, user }) => {
  const period = request.nextUrl.searchParams.get("period") === "all" ? "all" : "week";
  const rows = period === "all" ? allTimeBoard(db, 100) : weeklyBoard(db, Date.now(), 100);
  const me = user ? myWeekly(db, user.id) : null;
  return json({
    period,
    rows: rows.map(({ rank, nickname, level, points, premium }) => ({ rank, nickname, level, points, premium })),
    me: me && { ...me, nickname: user!.nickname },
  });
});
