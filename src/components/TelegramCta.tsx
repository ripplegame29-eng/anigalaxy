import { LEGAL } from "@/lib/legal";
import "./telegram-cta.css";

const ICONS = {
  gift: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="9" width="17" height="11" rx="2.5" />
      <path d="M12 9v11M3.5 13h17M12 9c-1.2-4-5.5-4-5.5-1.5S9.5 9 12 9Zm0 0c1.2-4 5.5-4 5.5-1.5S14.5 9 12 9Z" />
    </svg>
  ),
  vote: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 20V11M12 20V4M19 20v-6" />
      <path d="M3 20h18" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.5 14 10l6.5 2L14 14l-2 6.5L10 14l-6.5-2L10 10l2-6.5Z" />
    </svg>
  ),
};

const RX = {
  fire: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.5c.6 3.2-1.5 4.6-3 6.4-1.4 1.7-2 3.4-1.2 5.4C6.6 13.6 6 12.200 6 11c-1.5 1.8-2 3.500-2 5.200C4 19.700 7.500 22 12 22s8-2.3 8-5.8c0-3.4-2.2-5.3-3.5-7.5-.7 1-1.200 1.500-2 1.800.6-3-.2-6.600-2.500-8Z" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 21s-8-5.200-8-11.200C4 6.500 6.300 4.500 8.800 4.500c1.400 0 2.600.7 3.200 1.800.6-1.100 1.800-1.800 3.200-1.800 2.500 0 4.800 2 4.800 5.300C20 15.800 12 21 12 21Z" />
    </svg>
  ),
};

const PERKS = [
  { icon: ICONS.gift, t: "Розыгрыши Premium" },
  { icon: ICONS.vote, t: "Голосования" },
  { icon: ICONS.spark, t: "Эксклюзивы" },
];

function Plane({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.4 3.3 2.9 10.5c-.9.4-.9 1.2-.2 1.4l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.4l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.7c.3-1.3-.5-1.9-1.4-1.5ZM8.7 13.2l9.6-6c.5-.3.9-.1.5.2l-7.9 7.1-.3 3.2-1.9-4.5Z" />
    </svg>
  );
}

/** Канал в Telegram: плашка с маскотом на светящейся планете. Префикс tgc-. */
export function TelegramCta() {
  return (
    <section className="tgc" aria-labelledby="tgc-title">
      <div className="tgc-in">
        <div className="tgc-scene" aria-hidden="true">
          <div className="tgc-sys">
            <span className="tgc-glow" />
            <span className="tgc-ring r1" />
            <span className="tgc-ring r2" />
            <span className="tgc-ring r3" />
            <span className="tgc-orbit o1"><i /></span>
            <span className="tgc-orbit o2"><Plane /></span>
            <span className="tgc-core"><Plane /></span>
          </div>

          <div className="tgc-posts">
            <article className="tgc-post a">
              <header><span className="tgc-ch"><Plane /></span><b>AniGalaxy</b><small>канал</small></header>
              <p className="tgc-ptitle">{ICONS.gift}Розыгрыш Premium</p>
              <p className="tgc-ptext">Подписка на 30 дней достанется одному из подписчиков.</p>
              <footer><span className="tgc-rx">{RX.fire}</span><span className="tgc-rx">{RX.heart}</span></footer>
            </article>

            <article className="tgc-post b">
              <header><span className="tgc-ch"><Plane /></span><b>AniGalaxy</b><small>опрос</small></header>
              <p className="tgc-ptitle">{ICONS.vote}Что добавим на сайт?</p>
              <div className="tgc-opt"><span>Режим «Кинотеатр»</span><em>62%</em><i style={{ ["--w" as string]: "62%" }} /></div>
              <div className="tgc-opt"><span>Бот с уведомлениями</span><em>38%</em><i style={{ ["--w" as string]: "38%" }} /></div>
            </article>

            <article className="tgc-post c">
              <header><span className="tgc-ch"><Plane /></span><b>AniGalaxy</b><small>новость</small></header>
              <p className="tgc-ptitle">{ICONS.spark}Обновление сайта</p>
              <p className="tgc-ptext">Новая рамка и фон в профиле уже доступны.</p>
            </article>
          </div>
        </div>

        <div className="tgc-body">
          <p className="tgc-live">
            <i /> Официальный канал
          </p>
          <h2 id="tgc-title" className="tgc-title">
            Новости, опросы и подарки — в&nbsp;Telegram
          </h2>
          <p className="tgc-sub">
            Розыгрыши Premium, голосования за новые функции и анонсы сайта выходят в канале первыми.
          </p>
          <ul className="tgc-perks">
            {PERKS.map((p) => (
              <li key={p.t}>
                <span className="tgc-pi">{p.icon}</span>
                {p.t}
              </li>
            ))}
          </ul>
          <div className="tgc-act">
            <a className="tgc-btn" href={LEGAL.telegram} target="_blank" rel="noopener noreferrer">
              <Plane />
              Подписаться на канал
            </a>
            <span className="tgc-handle">@{LEGAL.telegramHandle}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
