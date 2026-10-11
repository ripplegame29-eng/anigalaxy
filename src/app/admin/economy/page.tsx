import { db } from "@/lib/db";
import { listProgressSummaries } from "@/lib/admin/progress";
import { requirePermission } from "@/lib/require-admin";

import { ProgressEditor } from "./progress-editor";
import {
  CreatePromoForm,
  CreateSeasonForm,
  PromoRow,
  SeasonRow,
} from "./promo-controls";

export const metadata = { title: "Экономика — панель AniGalaxy" };

async function loadEconomy() {
  const summaries = await listProgressSummaries(50);

  // Промокоды и сезоны — те же таблицы, что в схеме с самого начала: интерфейса
  // к ним просто не было. Считаем активации здесь, а не в списке кодов,
  // чтобы одним запросом на строку.
  const [promos, seasons] = await Promise.all([
    db.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { redemptions: true } } },
    }),
    db.season.findMany({ orderBy: { startsAt: "desc" } }),
  ]);

  // Документ хранит userId, а не имя, поэтому имена добираем отдельно —
  // одним запросом по списку найденных id.
  const ids = [...new Set(summaries.map((s) => s.userId))];
  const users = ids.length
    ? await db.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, nickname: true },
      })
    : [];
  const names = new Map(users.map((u) => [u.id, u.nickname]));

  // Сводные числа: без них раздел отвечал бы на вопрос «что происходит»
  // только списком строк, а не «как обстоят дела».
  const total = summaries.length;
  const avgLevel = total
    ? Math.round((summaries.reduce((sum, s) => sum + s.level, 0) / total) * 10) / 10
    : 0;
  const totalAc = summaries.reduce((sum, s) => sum + s.ac, 0);
  const topLevel = summaries.reduce((max, s) => Math.max(max, s.level), 0);
  const totalDocs = await db.playerProgress.count();

  return { summaries, names, totalDocs, avgLevel, totalAc, topLevel, promos, seasons };
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/35">{hint}</p> : null}
    </div>
  );
}

export default async function AdminEconomyPage() {
  await requirePermission("economy", "/admin/economy");
  const { summaries, names, totalDocs, avgLevel, totalAc, topLevel, promos, seasons } =
    await loadEconomy();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Экономика</h1>
        <p className="mt-1 text-sm text-white/50">
          Прогресс игроков зеркалится на сервер из браузера — пока хранилище
          клиентское, это копия для наблюдения и ручных правок.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Документов" value={String(totalDocs)} />
        <Card label="Средний уровень" value={String(avgLevel)} />
        <Card label="AC на игроков" value={totalAc.toLocaleString("ru-RU")} />
        <Card label="Максимальный уровень" value={String(topLevel)} />
      </div>

      {/* ---------------------------- Промокоды --------------------------- */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Промокоды</h2>
          <p className="text-sm text-white/50">
            Действующие коды. Пока промокод не создан здесь, игроки пользуются
            хардкод-словарём из <code className="text-xs">lib/premium-perks.ts</code>.
          </p>
        </div>

        <CreatePromoForm />

        {promos.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-center text-white/40">
            Промокодов пока нет.
          </p>
        ) : (
          <ul className="space-y-2">
            {promos.map((promo) => (
              <PromoRow
                key={promo.id}
                id={promo.id}
                code={promo.code}
                kind={promo.kind}
                value={promo.value}
                active={promo.active}
                usedCount={promo.usedCount}
                maxUses={promo.maxUses}
                description={promo.description}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------ Сезоны ---------------------------- */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Сезоны</h2>
          <p className="text-sm text-white/50">
            Сезоны боевого пропуска и кланов. Статус можно выставить досрочно, не
            сдвигая границы.
          </p>
        </div>

        <CreateSeasonForm />

        {seasons.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-center text-white/40">
            Сезонов пока нет.
          </p>
        ) : (
          <ul className="space-y-2">
            {seasons.map((season) => (
              <SeasonRow
                key={season.id}
                id={season.id}
                slug={season.slug}
                name={season.name}
                status={season.status}
                startsAt={Number(season.startsAt)}
                endsAt={Number(season.endsAt)}
              />
            ))}
          </ul>
        )}
      </section>

      {summaries.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-10 text-center">
          <p className="text-white/50">Пока нет ни одного документа.</p>
          <p className="mt-2 text-sm text-white/35">
            Зеркало наполняется, когда игрок с серверным аккаунтом играет: вход
            через /login, затем обычные действия на сайте. Документ уезжает на
            сервер один раз в несколько секунд.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {summaries.map((s) => (
            <li
              key={s.userId}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{names.get(s.userId) ?? s.userId}</span>
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
                      ур. {s.level}
                    </span>
                    {s.touchedByAdmin ? (
                      <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                        правили вручную
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    XP {s.xpTotal.toLocaleString("ru-RU")} · AC{" "}
                    {s.ac.toLocaleString("ru-RU")} · серия {s.streak} ·{" "}
                    {s.achievements} достижений · {s.tags} тегов · {s.purchases} покупок
                  </p>
                  <p className="mt-0.5 text-xs text-white/30">
                    обновлено{" "}
                    {new Date(s.updatedAt).toLocaleString("ru-RU")} · правка №
                    {s.revision}
                  </p>
                </div>

                <ProgressEditor
                  userId={s.userId}
                  nickname={names.get(s.userId) ?? s.userId}
                  current={{ level: s.level, xpTotal: s.xpTotal, acBalance: s.ac }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}