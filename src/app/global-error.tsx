"use client";

/** Последняя линия обороны: ошибка в самом корневом шаблоне. Своя разметка и стили, без зависимостей */
export default function GlobalError({ retry, reset }: { error: Error & { digest?: string }; retry?: () => void; reset?: () => void }) {
  const again = retry ?? reset;
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "radial-gradient(60% 50% at 50% 0%, #14224a, #07070c 70%)",
          color: "#f4f4f8",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 56 }}>✦</div>
          <h1 style={{ fontSize: 26, margin: "12px 0 8px" }}>Сайт ненадолго прилёг</h1>
          <p style={{ color: "#9a9ab0", lineHeight: 1.6, margin: "0 0 22px" }}>
            Произошла неожиданная ошибка. Обновите страницу — обычно этого достаточно.
          </p>
          <button
            type="button"
            onClick={() => (again ? again() : window.location.reload())}
            style={{ padding: "12px 26px", borderRadius: 14, border: 0, color: "#fff", fontWeight: 700, background: "linear-gradient(120deg,#1f7bff,#00c8ff)", cursor: "pointer" }}
          >
            Обновить
          </button>
        </div>
      </body>
    </html>
  );
}
