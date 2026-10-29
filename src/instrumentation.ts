export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startEpisodeWatcher } = await import("./lib/server/telegram-bot");
    startEpisodeWatcher();
    // Арты карточек докачиваются в фоне, когда у сервера есть интернет
    const { startArtSync } = await import("./lib/server/cards-art");
    setTimeout(startArtSync, 8000);
  }
}
