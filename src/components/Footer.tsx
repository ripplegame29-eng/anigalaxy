import Link from "next/link";
import { Logo } from "./Logo";
import { LEGAL } from "@/lib/legal";
import { SupportButton } from "./support/SupportDesk";
import "./footer.css";

const GENRES = ["Фэнтези", "Экшен", "Романтика", "Комедия", "Драма", "Приключения", "Фантастика", "Детектив"];

const WATCH = [
  { href: "/", label: "Главная" },
  { href: "/catalog", label: "Каталог аниме" },
  { href: "/catalog?status=ongoing", label: "Онгоинги" },
  { href: "/schedule", label: "Расписание выхода" },
  { href: "/catalog?sort=rating", label: "Топ рейтинга" },
  { href: "/catalog?type=movie", label: "Аниме-фильмы" },
  { href: "/collections", label: "Подборки" },
  { href: "/manga", label: "Каталог манги" },
];

const COMMUNITY = [
  { href: "/clans", label: "Кланы" },
  { href: "/events", label: "Ивенты" },
  { href: "/quests", label: "Квесты дня" },
  { href: "/leaderboard", label: "Рейтинг игроков" },
  { href: "/map", label: "Карта аниме" },
  { href: "/gifts", label: "Подарки" },
  { href: "/updates", label: "Обновления сайта" },
  { href: "/premium", label: "Premium-подписка" },
];

const LEGAL_LINKS = [
  { href: "/offer", label: "Публичная оферта" },
  { href: "/privacy", label: "Политика конфиденциальности" },
  { href: "/terms", label: "Пользовательское соглашение" },
];

/* Иконки заголовков: двухцветные, градиентный штрих */
const SVG = {
  viewBox: "0 0 24 24",
  fill: "none",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function IcCompass() {
  return (
    <svg {...SVG}>
      <circle cx="12" cy="12" r="8.5" fill="currentColor" fillOpacity=".14" stroke="currentColor" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" stroke="currentColor" />
    </svg>
  );
}
function IcUsers() {
  return (
    <svg {...SVG}>
      <circle cx="9" cy="8.5" r="3.2" fill="currentColor" fillOpacity=".14" stroke="currentColor" />
      <path d="M3.5 19c.5-3.2 2.7-5 5.5-5s5 1.8 5.5 5M16 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.3c1.7.5 2.8 2 3 4.7" stroke="currentColor" />
    </svg>
  );
}
function IcTag() {
  return (
    <svg {...SVG}>
      <path d="M3.5 12.5V5.5a2 2 0 0 1 2-2h7l8 8a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0z" fill="currentColor" fillOpacity=".14" stroke="currentColor" />
      <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IcHeadset() {
  return (
    <svg {...SVG}>
      <path d="M4.5 13v-1.5a7.5 7.5 0 0 1 15 0V13" stroke="currentColor" />
      <rect x="3" y="12.5" width="4" height="6" rx="1.8" fill="currentColor" fillOpacity=".18" stroke="currentColor" />
      <rect x="17" y="12.5" width="4" height="6" rx="1.8" fill="currentColor" fillOpacity=".18" stroke="currentColor" />
      <path d="M19 18.5c0 1.5-1.5 2.5-4 2.5h-2" stroke="currentColor" />
    </svg>
  );
}
function IcPlane() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.7 4.2 3.4 10.9c-.9.4-.9 1.1-.2 1.3l4.4 1.4 1.7 5.2c.2.6.4.7.9.7.4 0 .6-.2.9-.5l2.1-2 4.4 3.3c.8.4 1.4.2 1.6-.8l2.9-13.7c.3-1.2-.4-1.7-1.4-1.2zM8.3 13l9.2-5.8c.4-.3.8-.1.5.2l-7.6 6.9-.3 3.2z" />
    </svg>
  );
}
function IcMail() {
  return (
    <svg {...SVG}>
      <rect x="3" y="5.5" width="18" height="13" rx="3" fill="currentColor" fillOpacity=".14" stroke="currentColor" />
      <path d="m4 8 8 5.5L20 8" stroke="currentColor" />
    </svg>
  );
}
function IcArrowUp() {
  return (
    <svg {...SVG} strokeWidth={2.2}>
      <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" />
    </svg>
  );
}
function IcOut() {
  return (
    <svg {...SVG} strokeWidth={2}>
      <path d="M8 16 16 8M9.5 8H16v6.5" stroke="currentColor" />
    </svg>
  );
}

function Col({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <nav className="ft-col" aria-label={title}>
      <h3>
        <span className="ft-hi">{icon}</span>
        {title}
      </h3>
      {children}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="ft">
      <div className="ft-in">
        <div className="ft-grid">
          {/* Бренд */}
          <div className="ft-brand">
            <Logo />
            <p>
              Твой проводник в мире аниме: свежие релизы, онгоинги и классика. Удобный выбор серий и озвучек, быстрый
              поиск и фильтры — на любом устройстве.
            </p>
            <div className="ft-chips">
              <span className="ft-on">
                <i />
                Онлайн
              </span>
              <Link href="/anime-4k">4K-качество</Link>
              <span>Озвучки и субтитры</span>
            </div>

            <a className="ft-card" href={LEGAL.telegram} target="_blank" rel="noopener noreferrer">
              <span className="ft-ci ft-tg">
                <IcPlane />
              </span>
              <span className="ft-ct">
                <b>Telegram</b>
                <small>@{LEGAL.telegramHandle}</small>
              </span>
              <span className="ft-go">
                <IcOut />
              </span>
            </a>
            {LEGAL.email ? (
              <a className="ft-card" href={`mailto:${LEGAL.email}`}>
                <span className="ft-ci ft-ml">
                  <IcMail />
                </span>
                <span className="ft-ct">
                  <b>Почта</b>
                  <small>{LEGAL.email}</small>
                </span>
                <span className="ft-go">
                  <IcOut />
                </span>
              </a>
            ) : null}
          </div>

          <Col icon={<IcCompass />} title="Смотреть">
            <ul>
              {WATCH.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </Col>

          <Col icon={<IcUsers />} title="Сообщество">
            <ul>
              {COMMUNITY.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </Col>

          <div className="ft-col">
            <h3>
              <span className="ft-hi">
                <IcTag />
              </span>
              Популярные жанры
            </h3>
            <div className="ft-genres">
              {GENRES.map((g) => (
                <Link key={g} href={`/catalog?genre=${encodeURIComponent(g)}`}>
                  {g}
                </Link>
              ))}
            </div>

            <h3 className="ft-h2">
              <span className="ft-hi">
                <IcHeadset />
              </span>
              Поддержка
            </h3>
            <p className="ft-sup">
              Вопросы по аккаунту, оплате и работе сайта — создайте обращение, отвечаем в течение дня.
            </p>
            <SupportButton className="ft-ticket">
              <IcHeadset />
              Создать обращение
            </SupportButton>
          </div>
        </div>

        <div className="ft-bot">
          <p>© {new Date().getFullYear()} AniGalaxy. Все права на контент принадлежат правообладателям.</p>
          <ul>
            {LEGAL_LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
          <a className="ft-top" href="#top" aria-label="Наверх">
            <IcArrowUp />
          </a>
        </div>
      </div>
    </footer>
  );
}
