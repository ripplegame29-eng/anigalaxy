import { readHealth } from "@/lib/admin/health";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-admin";
import { getSiteConfig } from "@/lib/site-config";

import {
  FlagDescriptionEditor,
  FlagToggle,
  HealthCheckButton,
  SettingEditor,
} from "./settings-controls";

export const metadata = { title: "Настройки — панель AniGalaxy" };

const SERVICE_LABELS: Record<string, string> = {
  kodik: "Kodik",
  shikimori: "Shikimori",
  mangadex: "MangaDex",
  anilibria: "AniLibria",
};

/** Запрос данных вне компонента — см. замечание про react-hooks/purity. */
async function loadSettings() {
  const [flags, settings, health, config] = await Promise.all([
    db.featureFlag.findMany({ orderBy: { key: "asc" } }),
    db.setting.findMany({ orderBy: { key: "asc" } }),
    readHealth(),
    getSiteConfig(),
  ]);
  return { flags, settings, health, config };
}

export default async function AdminSettingsPage() {
  await requirePermission("settings", "/admin/settings");
  const { flags, settings, health, config } = await loadSettings();

  const offline = health.filter((h) => !h.ok);

  // Ключи, которые код действительно читает. По остальным строкам честно
  // сказано «нигде не применяется»: иначе администратор решит, что спас
  // сайт галочкой, а она лежит в базе мёртвым грузом.
  const WIRED = new Set(["site.title", "site.tagline", "moderation.autoHideThreshold"]);

  return (
    <div className="ag-section" style={{ gap: 40 }}>
      <div className="ag-head">
        <div>
          <h1 className="ag-h1">Настройки</h1>
          <p className="ag-sub">
            Тумблеры механик, строки конфигурации и состояние внешних источников.
          </p>
        </div>
      </div>

      {/* ----------------------- Здоровье источников ---------------------- */}
      <section className="ag-section">
        <div className="ag-head">
          <h2 className="ag-h2">Внешние источники</h2>
          <HealthCheckButton />
        </div>

        <div className="ag-box">
          {health.map((item) => (
            <div className="ag-row" key={item.service}>
              <span
                className="ag-dot"
                aria-hidden="true"
                style={{ background: item.ok ? "var(--ag-grn)" : "var(--ag-red)" }}
              />
              <div className="ag-m">
                <b>{SERVICE_LABELS[item.service] ?? item.service}</b>
                {item.ok ? (
                  <small>отвечает</small>
                ) : (
                  <small>Что произойдёт: {item.fallback}</small>
                )}
              </div>
              <span className="ag-n" style={{ color: item.ok ? "var(--ag-grn)" : "var(--ag-red)" }}>
                {item.ok ? `${item.latencyMs} мс` : "недоступен"}
              </span>
            </div>
          ))}
        </div>

        {offline.length > 0 ? (
          <p className="ag-note">
            Недоступных источников: {offline.length}. Проверка идёт раз вручную —
            автоматического крона пока нет.
          </p>
        ) : null}
      </section>

      {/* ----------------------------- Флаги ------------------------------ */}
      <section className="ag-section">
        <div>
          <h2 className="ag-h2">Флаги функций</h2>
          <p className="ag-sub">
            Позволяют выключить сломанную механику без правки кода и деплоя.
            Флаг читается на сервере: ссылка исчезает из меню, а страница по
            прямому адресу отдаёт 404. Выключение затрагивает всех посетителей
            сразу.
          </p>
        </div>

        <div className="ag-box">
          {flags.map((flag) => (
            <div className="ag-row" key={flag.key}>
              <div className="ag-m">
                <b style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }}>
                  {flag.key}
                </b>
                <small>
                  {flag.description ?? "без описания"}
                  {flag.enabled ? "" : " — выключена, страница отдаёт 404"}
                </small>
              </div>
              <FlagToggle flagKey={flag.key} enabled={flag.enabled} />
            </div>
          ))}
        </div>

        <p className="ag-note">
          Описания тоже редактируются — по одному на флаг, список обновляется
          целиком после каждой строки.
        </p>

        <div className="ag-section" style={{ gap: 12 }}>
          {flags.map((flag) => (
            <div key={flag.key}>
              <FlagDescriptionEditor
                flagKey={flag.key}
                description={flag.description ?? ""}
              />
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------- Настройки ---------------------------- */}
      <section className="ag-section">
        <div>
          <h2 className="ag-h2">Строки конфигурации</h2>
          <p className="ag-sub">
            Сейчас применяются: {config.title} — заголовок вкладки и OpenGraph,{" "}
            {config.tagline} — описание страницы, {config.autoHideThreshold}{" "}
            жалоб — порог автоскрытия в модерации.
          </p>
        </div>

        {settings.length === 0 ? (
          <div className="ag-box">
            <div className="ag-empty">Пока пусто. Добавляются через prisma/seed.ts.</div>
          </div>
        ) : (
          <div className="ag-section" style={{ gap: 12 }}>
            {settings.map((setting) => (
              <div key={setting.key} className="ag-section" style={{ gap: 6 }}>
                <SettingEditor
                  settingKey={setting.key}
                  value={setting.value}
                  description={setting.description}
                />
                {WIRED.has(setting.key) ? (
                  <p className="ag-ok">Применяется на сайте.</p>
                ) : (
                  <p className="ag-bad">
                    Нигде не читается. Строка сохранена, но на сайт не влияет —
                    чтобы она заработала, нужен код, который её прочитает.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}