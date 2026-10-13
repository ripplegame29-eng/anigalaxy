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
    <div className="ag-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <em>{hint}</em> : null}
    </div>
  );
}

export default async function AdminEconomyPage() {
  await requirePermission("economy", "/admin/economy");
  const { summaries, names, totalDocs, avgLevel, totalAc, topLevel, promos, seasons } =
    await loadEconomy();

  return (
    <div className="ag-section" style={{ gap: 28 }}>
      <div className="ag-head">
        <div>
          <h1 className="ag-h1">Экономика</h1>
          <p className="ag-sub">
            Прогресс игроков зеркалится на сервер из браузера — пока хранилище
            клиентское, это копия для наблюдения и ручных правок.
          </p>
        </div>
      </div>

      <div className="ag-kpis">
        <Card label="Документов" value={String(totalDocs)} />
        <Card label="Средний уровень" value={String(avgLevel)} />
        <Card label="AC на игроков" value={totalAc.toLocaleString("ru-RU")} />
        <Card label="Максимальный уровень" value={String(topLevel)} />
      </div>

      {/* ---------------------------- Промокоды --------------------------- */}
      <section className="ag-section">
        <div>
          <h2 className="ag-h2">Промокоды</h2>
          <p className="ag-sub">
            Коды, созданные здесь. Пока такой код не создан, игроки пользуются
            хардкод-словарём из <span className="ag-code">lib/premium-perks.ts</span> —
            сервер их не проверяет.
          </p>
        </div>

        <CreatePromoForm />

        {promos.length === 0 ? (
          <div className="ag-box">
            <div className="ag-empty">Промокодов пока нет.</div>
          </div>
        ) : (
          <ul className="ag-section" style={{ listStyle: "none", margin: 0, padding: 0, gap: 8 }}>
            {promos.map((promo) => (
              <PromoRow
                key={promo.id}
                id={promo.id}
                code={promo.code}
                kind={promo.kind}
                value={promo.value}
                active={promo.active}
                usedCount={promo._count.redemptions}
                maxUses={promo.maxUses}
                description={promo.description}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------ Сезоны ---------------------------- */}
      <section className="ag-section">
        <div>
          <h2 className="ag-h2">Сезоны</h2>
          <p className="ag-sub">
            Сезоны боевого пропуска и кланов. Статус можно выставить досрочно, не
            сдвигая границы.
          </p>
        </div>

        <CreateSeasonForm />

        {seasons.length === 0 ? (
          <div className="ag-box">
            <div className="ag-empty">Сезонов пока нет.</div>
          </div>
        ) : (
          <ul className="ag-section" style={{ listStyle: "none", margin: 0, padding: 0, gap: 8 }}>
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

      {/* ------------------------- Зеркало прогресса ---------------------- */}
      <section className="ag-section">
        <h2 className="ag-h2">Прогресс игроков</h2>

        {summaries.length === 0 ? (
          <div className="ag-box">
            <div className="ag-empty">
              <p>Пока нет ни одного документа.</p>
              <p style={{ marginTop: 8 }}>
                Зеркало наполняется, когда игрок с серверным аккаунтом играет: вход
                через /login, затем обычные действия на сайте. Документ уезжает на
                сервер один раз в несколько секунд.
              </p>
            </div>
          </div>
        ) : (
          <ul className="ag-section" style={{ listStyle: "none", margin: 0, padding: 0, gap: 12 }}>
            {summaries.map((s) => (
              <li className="ag-box pad" key={s.userId}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 16,
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <p style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <b>{names.get(s.userId) ?? s.userId}</b>
                      <span className="ag-n">ур. {s.level}</span>
                      {s.touchedByAdmin ? (
                        <span className="ag-lvl">правили вручную</span>
                      ) : null}
                    </p>
                    <p className="ag-note" style={{ marginTop: 4 }}>
                      XP {s.xpTotal.toLocaleString("ru-RU")} · AC{" "}
                      {s.ac.toLocaleString("ru-RU")} · серия {s.streak} ·{" "}
                      {s.achievements} достижений · {s.tags} тегов · {s.purchases} покупок
                    </p>
                    <p className="ag-note" style={{ marginTop: 2 }}>
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
      </section>
    </div>
  );
}