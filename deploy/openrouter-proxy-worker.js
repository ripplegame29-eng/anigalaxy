// Cloudflare Worker: прокси к openrouter.ai для серверов, которые OpenRouter не пускает (403).
// Секрет PROXY_KEY (Settings → Variables → Secret) защищает прокси от чужих.
// В .env.production: OPENROUTER_BASE_URL=https://<имя>.<аккаунт>.workers.dev/<PROXY_KEY>/api/v1
// Пересылаем только нужные заголовки: IP исходного сервера (cf-connecting-ip, x-forwarded-for)
// не должен доходить до OpenRouter, иначе он блокирует и прокси.
const PASS = ["authorization", "content-type", "accept", "http-referer", "x-title"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const [, key, ...rest] = url.pathname.split("/");
    if (!env.PROXY_KEY || key !== env.PROXY_KEY) return new Response("Not found", { status: 404 });
    const target = new URL("https://openrouter.ai/" + rest.join("/") + url.search);
    const headers = new Headers();
    for (const name of PASS) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    return fetch(target, { method: request.method, headers, body: hasBody ? request.body : undefined });
  },
};
