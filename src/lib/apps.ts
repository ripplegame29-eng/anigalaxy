/**
 * Приложения AniGalaxy.
 *
 * Установка «как приложение» уже работает через браузер (PWA). Нативные
 * сборки появятся позже: ссылку на каждую задаёт переменная окружения,
 * пока она пустая — на странице стоит «Скоро», а не мёртвая кнопка.
 */

export type AppPlatformId = "windows" | "macos" | "linux" | "android" | "ios";

export interface AppPlatform {
  id: AppPlatformId;
  name: string;
  device: "desktop" | "phone";
  /** Для кого: короткая подпись под названием */
  hint: string;
  /** Ссылка на сборку; пустая — сборки ещё нет */
  url: string;
  /** Что именно скачивается */
  file: string;
}

export const APP_PLATFORMS: readonly AppPlatform[] = [
  { id: "windows", name: "Windows", device: "desktop", hint: "Windows 10 и 11", url: process.env.NEXT_PUBLIC_APP_URL_WINDOWS ?? "", file: "установщик .exe" },
  { id: "macos", name: "macOS", device: "desktop", hint: "Mac на Apple Silicon и Intel", url: process.env.NEXT_PUBLIC_APP_URL_MACOS ?? "", file: "образ .dmg" },
  { id: "linux", name: "Linux", device: "desktop", hint: "Ubuntu, Fedora, Arch", url: process.env.NEXT_PUBLIC_APP_URL_LINUX ?? "", file: "пакет AppImage" },
  { id: "android", name: "Android", device: "phone", hint: "Android 8 и новее", url: process.env.NEXT_PUBLIC_APP_URL_ANDROID ?? "", file: "установщик .apk" },
  { id: "ios", name: "iPhone и iPad", device: "phone", hint: "iOS 16 и новее", url: process.env.NEXT_PUBLIC_APP_URL_IOS ?? "", file: "App Store" },
];

export const APP_FEATURES = [
  { title: "Запуск в один клик", text: "Своя иконка на рабочем столе или экране «Домой» — без поиска нужной вкладки." },
  { title: "Полный экран без рамок", text: "Окно без адресной строки и вкладок: плеер получает всё место." },
  { title: "Прогресс везде одинаковый", text: "Уровень, монеты, серия и список просмотренного синхронизируются с аккаунтом." },
  { title: "Быстрый старт", text: "Оболочка сайта хранится на устройстве, поэтому приложение открывается заметно быстрее вкладки." },
] as const;

export const INSTALL_GUIDES = [
  {
    id: "desktop",
    title: "Компьютер",
    browsers: "Chrome, Edge, Opera",
    steps: ["Откройте AniGalaxy в браузере", "Нажмите «Установить» на этой странице или значок установки справа в адресной строке", "Подтвердите — приложение появится в меню «Пуск» и на рабочем столе"],
  },
  {
    id: "android",
    title: "Android",
    browsers: "Chrome, Samsung Internet",
    steps: ["Откройте сайт в Chrome", "Нажмите «Установить» на этой странице или меню ⋮ → «Установить приложение»", "Иконка AniGalaxy появится среди приложений"],
  },
  {
    id: "ios",
    title: "iPhone и iPad",
    browsers: "Safari",
    steps: ["Откройте сайт в Safari", "Нажмите «Поделиться» внизу экрана", "Выберите «На экран «Домой»» и подтвердите"],
  },
] as const;

export const APP_FAQ = [
  { q: "Это отдельная программа или сайт?", a: "Сейчас приложение — это сам AniGalaxy, установленный на устройство. Он открывается в своём окне и работает с тем же аккаунтом. Нативные сборки для Windows, macOS, Linux и Android появятся отдельно." },
  { q: "Нужно ли платить?", a: "Нет. Установка бесплатна, Premium остаётся тем же, что и на сайте." },
  { q: "Как удалить?", a: "Как любое приложение: на компьютере — через меню приложения или «Установка и удаление программ», на телефоне — долгим нажатием на иконку." },
  { q: "Мой прогресс сохранится?", a: "Да. Войдите в тот же аккаунт — уровень, монеты, список и настройки подтянутся с сервера." },
] as const;
