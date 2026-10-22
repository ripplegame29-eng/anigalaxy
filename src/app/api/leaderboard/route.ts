import { allTimeBoard, historyBoard, myWeekly, weeklyBoard } from "@/lib/server/leaderboard";
import { looksOf, NO_LOOK } from "@/lib/server/looks";
import { json, route } from "@/lib/server/http";

export const runtime = "nodejs";

/** `?period=week|all&metric=xp|hours|series` — таблица лидеров и моё место */
export const GET = route(({ db, request, user }) => {
  const params = request.nextUrl.searchParams;
  const metric = params.get("metric") === "hours" ? "hours" : params.get("metric") === "series" ? "series" : "xp";
  const period = metric !== "xp" || params.get("period") === "all" ? "all" : "week";
  const rows =
    metric !== "xp"
      ? historyBoard(db, metric, 100)
      : period === "all"
        ? allTimeBoard(db, 100)
        : weeklyBoard(db, Date.now(), 100);
  const looks = looksOf(db, rows.map((row) => row.userId));
  const me = user && metric === "xp" ? myWeekly(db, user.id) : null;
  return json({
    period,
    metric,
    rows: rows.map(({ rank, userId, nickname, level, points, premium }) => ({
      rank,
      nickname,
      level,
      points,
      premium,
      ...(looks.get(userId) ?? NO_LOOK),
    })),
    me: me && { ...me, nickname: user!.nickname },
  });
});
