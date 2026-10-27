// Cloudflare Worker: прокси к api.telegram.org для серверов, откуда Telegram недоступен.
// Секрет PROXY_KEY (Settings → Variables → Secret) защищает прокси от чужих.
// В .env.production: TELEGRAM_API_BASE=https://<имя>.<аккаунт>.workers.dev/<PROXY_KEY>
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const [, key, ...rest] = url.pathname.split("/");
    if (!env.PROXY_KEY || key !== env.PROXY_KEY) return new Response("Not found", { status: 404 });
    const target = new URL("https://api.telegram.org/" + rest.join("/") + url.search);
    return fetch(new Request(target, request));
  },
};
