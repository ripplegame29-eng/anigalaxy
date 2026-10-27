import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { TgApp } from "./TgApp";
import "./tg.css";

export const metadata: Metadata = {
  title: "AniGalaxy",
  description: "Мини-приложение AniGalaxy для Telegram",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover", themeColor: "#070b1f" };

export default function TgPage() {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <TgApp />
    </>
  );
}
