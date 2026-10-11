import { readHealth } from "@/lib/admin/health";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-admin";

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
  const [flags, settings, health] = await Promise.all([
    db.featureFlag.findMany({ orderBy: { key: "asc" } }),
    db.setting.findMany({ orderBy: { key: "asc" } }),
    readHealth(),
  ]);
  return { flags, settings, health };
}

export default async function AdminSettingsPage() {
  await requirePermission("settings", "/admin/settings");
  const { flags, settings, health } = await loadSettings();

  const offline = health.filter((h) => !h.ok);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Настройки</h1>
        <p className="mt-1 text-sm text-white/50">
          Тумблеры, строки конфигурации и состояние внешних источников.
        </p>
      </div>

      {/* ----------------------- Здоровье источников ---------------------- */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Внешние источники</h2>
          <HealthCheckButton />
        </div>

        <ul className="space-y-2">
          {health.map((item) => (
            <li
              key={item.service}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={[
                    "h-2 w-2 shrink-0 rounded-full",
                    item.ok ? "bg-emerald-400" : "bg-red-400",
                  ].join(" ")}
                />
                <span className="font-medium">{SERVICE_LABELS[item.service] ?? item.service}</span>

                {item.ok ? (
                  <span className="text-xs text-white/40">{item.latencyMs} мс</span>
                ) : (
                  <span className="text-xs text-red-300">{item.error}</span>
                )}
              </div>

              {!item.ok ? (
                <p className="mt-2 text-xs text-white/40">
                  Что произойдёт: {item.fallback}
                </p>
              ) : null}
            </li>
          ))}
        </ul>

        {offline.length > 0 ? (
          <p className="mt-3 text-xs text-white/35">
            Недоступных источников: {offline.length}. Проверка идёт раз вручную —
            автоматического крона пока нет.
          </p>
        ) : null}
      </section>

      {/* ----------------------------- Флаги ------------------------------ */}
      <section>
        <h2 className="mb-1 text-lg font-medium">Флаги функций</h2>
        <p className="mb-3 text-sm text-white/50">
          Позволяют выключить сломанную механику без правки кода и деплоя.
          Флаг читается на сервере — сработает на всех посетителях сразу.
        </p>

        <ul className="space-y-3">
          {flags.map((flag) => (
            <li
              key={flag.key}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-white/60">{flag.key}</p>
                  <p className="mt-0.5 text-sm">
                    {flag.description ?? <span className="text-white/35">без описания</span>}
                  </p>
                </div>
                <FlagToggle flagKey={flag.key} enabled={flag.enabled} />
              </div>
              <div className="mt-2">
                <FlagDescriptionEditor
                  flagKey={flag.key}
                  description={flag.description ?? ""}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* --------------------------- Настройки ---------------------------- */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Строки конфигурации</h2>
        {settings.length === 0 ? (
          <p className="text-sm text-white/40">
            Пока пусто. Добавляются через prisma/seed.ts.
          </p>
        ) : (
          <div className="space-y-3">
            {settings.map((setting) => (
              <SettingEditor
                key={setting.key}
                settingKey={setting.key}
                value={setting.value}
                description={setting.description}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}