// Cloudflare Worker: прокси к openrouter.ai для серверов, которые OpenRouter не пускает (403).
// Секрет PROXY_KEY (Settings → Variables → Secret) защищает прокси от чужих.
// В .env.production: OPENROUTER_BASE_URL=https://<имя>.<аккаунт>.workers.dev/<PROXY_KEY>/api/v1
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const [, key, ...rest] = url.pathname.split("/");
    if (!env.PROXY_KEY || key !== env.PROXY_KEY) return new Response("Not found", { status: 404 });
    const target = new URL("https://openrouter.ai/" + rest.join("/") + url.search);
    return fetch(new Request(target, request));
  },
};
