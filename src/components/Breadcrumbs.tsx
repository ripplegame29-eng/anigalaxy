export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Хлебные крошки отключены по решению владельца сайта: строка с «адресом
 * страницы» ломала премиальный вид. Компонент оставлен пустым, чтобы не
 * править ~20 страниц, где он подключён; вернуть крошки можно, восстановив
 * прежнюю разметку из git (коммит 0dcd49b).
 */
export function Breadcrumbs(props: { items: Crumb[] }) {
  void props;
  return null;
}
