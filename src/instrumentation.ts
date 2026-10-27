export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startEpisodeWatcher } = await import("./lib/server/telegram-bot");
    startEpisodeWatcher();
  }
}
