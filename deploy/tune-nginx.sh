#!/usr/bin/env bash
# Ускорение отдачи: сжатие для всех текстовых типов, Vary, больше буферов к приложению.
# Безопасно: пишет отдельный файл conf.d, проверяет `nginx -t` и откатывает, если конфиг не принят.
# Запуск: sudo bash /opt/anigalaxy/deploy/tune-nginx.sh
set -e
F=/etc/nginx/conf.d/anigalaxy-tuning.conf
BAK=""
[ -f "$F" ] && BAK=$(mktemp) && cp "$F" "$BAK"
cat > "$F" <<'CONF'
gzip_vary on;
gzip_proxied any;
gzip_comp_level 5;
gzip_min_length 512;
gzip_types text/plain text/css text/xml application/javascript application/json application/xml application/rss+xml image/svg+xml font/ttf font/otf application/manifest+json;
proxy_buffers 16 16k;
proxy_buffer_size 16k;
CONF
if nginx -t 2>/tmp/nginx-test.log; then
  systemctl reload nginx
  echo "Готово: сжатие и буферы nginx настроены."
else
  echo "nginx отклонил настройки, откатываю:"; cat /tmp/nginx-test.log
  if [ -n "$BAK" ]; then cp "$BAK" "$F"; else rm -f "$F"; fi
  nginx -t && systemctl reload nginx
  exit 1
fi
