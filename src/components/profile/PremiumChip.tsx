"use client";

/**
 * PREMIUM-тег для шапки профиля.
 *
 * Взят из макета «AniGalaxy — PREMIUM тег» без изменений: та же разметка,
 * те же em-отступы, тот же градиент рамки. Размер задаётся только через
 * `font-size` — масштабируется весь тег целиком, потому что все отступы,
 * радиусы и размер иконки завязаны на em.
 *
 * Показывается только при действующей подписке (`isPremiumActive`), а не как
 * украшение: у профиля нет «серого» варианта тега.
 */
export function PremiumChip() {
  return (
    <span className="ag-premium">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3.5 18h17M3.5 18 2.5 8.7 8 12.4 12 5.6l4 6.8 5.5-3.7-1 9.3z" />
      </svg>
      PREMIUM
    </span>
  );
}