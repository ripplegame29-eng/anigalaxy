#!/usr/bin/env bash
# Обновление сайта до свежей версии из GitHub: sudo bash /opt/anigalaxy/deploy/update.sh
set -euo pipefail
APP_DIR=/opt/anigalaxy; APP_USER=anigalaxy
[ "$(id -u)" = 0 ] || { echo "Запустите от root"; exit 1; }
/usr/local/bin/anigalaxy-backup || echo "Копия не сделана, продолжаем"
sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm ci --no-audit --no-fund && NODE_OPTIONS=--max-old-space-size=3072 npm run build"
systemctl restart anigalaxy
sleep 3
curl -fsS -o /dev/null -w 'Сайт отвечает: HTTP %{http_code}\n' http://127.0.0.1:3000/
