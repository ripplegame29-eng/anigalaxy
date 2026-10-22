import type { ReactNode } from "react";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export interface LegalSection {
  title: string;
  body: ReactNode;
}

/** Страница юридического документа: заголовок, оглавление и нумерованные разделы */
export function LegalDoc({ title, lead, sections }: { title: string; lead: string; sections: LegalSection[] }) {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-16 pt-10">
      <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 text-sm text-muted">Редакция от {LEGAL.updated}</p>
      <p className="mt-5 leading-relaxed text-white/85">{lead}</p>

      <nav aria-label="Содержание" className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="mb-2 text-sm font-bold">Содержание</p>
        <ol className="grid gap-1 text-sm sm:grid-cols-2">
          {sections.map((section, i) => (
            <li key={section.title}>
              <a href={`#s${i + 1}`} className="text-muted hover:text-white">
                {i + 1}. {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-9">
        {sections.map((section, i) => (
          <section key={section.title} id={`s${i + 1}`} className="scroll-mt-24">
            <h2 className="text-xl font-extrabold">
              {i + 1}. {section.title}
            </h2>
            <div className="mt-3 space-y-3 leading-relaxed text-white/80 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
              {section.body}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-6 text-sm text-muted">
        <Link href="/privacy" className="hover:text-white">Политика конфиденциальности</Link>
        <Link href="/terms" className="hover:text-white">Пользовательское соглашение</Link>
        <Link href="/offer" className="hover:text-white">Публичная оферта</Link>
      </footer>
    </article>
  );
}

/** Куда писать: служба поддержки в Telegram и, если указана, почта */
export function Contacts() {
  return (
    <p>
      Служба поддержки в Telegram:{" "}
      <a className="text-accent hover:underline" href={LEGAL.telegram} target="_blank" rel="noopener noreferrer">
        @{LEGAL.telegramHandle}
      </a>
      {LEGAL.email ? (
        <>
          {" · "}почта:{" "}
          <a className="text-accent hover:underline" href={`mailto:${LEGAL.email}`}>
            {LEGAL.email}
          </a>
        </>
      ) : null}
      . Отвечаем в течение {LEGAL.replyDays} дней.
    </p>
  );
}
