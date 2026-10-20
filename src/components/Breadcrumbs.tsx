import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

/** Хлебные крошки с плавным появлением и разделителями */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Хлебные крошки" className="mb-5 text-xs text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="btn-ghost inline-flex items-center py-2 transition-colors hover:text-white">
            Главная
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <span className="text-white/25" aria-hidden>
              /
            </span>
            {item.href ? (
              <Link href={item.href} className="btn-ghost inline-flex items-center py-2 transition-colors hover:text-white">
                {item.label}
              </Link>
            ) : (
              <span className="max-w-[46vw] truncate text-white/85 sm:max-w-md">{item.label}</span>
            )}
            {i === items.length - 1 && <span className="sr-only"> (текущая страница)</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
