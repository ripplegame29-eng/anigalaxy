#!/usr/bin/env bash
# Первичная установка AniGalaxy на чистый Ubuntu 24.04. Запускать от root:
#   sudo DOMAIN=anigalaxy.ru REPO=https://github.com/ripplegame29-eng/anigalaxy.git bash setup.sh
# Скрипт можно запускать повторно: уже сделанное он пропускает.
set -euo pipefail

DOMAIN="${DOMAIN:-}"
REPO="${REPO:-https://github.com/ripplegame29-eng/anigalaxy.git}"
BRANCH="${BRANCH:-main}"
APP_DIR=/opt/anigalaxy
APP_USER=anigalaxy
DATA_DIR=/var/lib/anigalaxy
BACKUP_DIR=/var/backups/anigalaxy
ENV_FILE="$APP_DIR/.env.production"

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "Запустите от root (sudo)"; exit 1; }

say "Пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git nginx ufw sqlite3 ca-certificates gnupg certbot python3-certbot-nginx

say "Swap 2 ГБ (сборка Next.js съедает много памяти)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

say "Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node --version

say "Пользователь и папки"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR" "$DATA_DIR" "$BACKUP_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR" "$DATA_DIR" "$BACKUP_DIR"

say "Код"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
else
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
fi

say "Настройки (.env.production)"
if [ ! -f "$ENV_FILE" ]; then
  cp "$APP_DIR/deploy/env.example" "$ENV_FILE"
  sed -i "s|^DATABASE_PATH=.*|DATABASE_PATH=$DATA_DIR/anigalaxy.db|" "$ENV_FILE"
  [ -n "$DOMAIN" ] && sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=https://$DOMAIN|" "$ENV_FILE"
  sed -i "s|^TELEGRAM_WEBHOOK_SECRET=.*|TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 24)|" "$ENV_FILE"
  chown "$APP_USER":"$APP_USER" "$ENV_FILE"; chmod 600 "$ENV_FILE"
  echo
  echo "Создан $ENV_FILE. Впишите в него ключи (KODIK_*, TELEGRAM_*) и запустите скрипт ещё раз."
  exit 2
fi
if ! grep -qE '^TELEGRAM_BOT_TOKEN=.+' "$ENV_FILE"; then
  echo "В $ENV_FILE не заполнен TELEGRAM_BOT_TOKEN. Заполните и запустите снова."; exit 2
fi

say "Сборка"
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm ci --no-audit --no-fund && NODE_OPTIONS=--max-old-space-size=3072 npm run build"

say "Служба systemd"
install -m 644 "$APP_DIR/deploy/anigalaxy.service" /etc/systemd/system/anigalaxy.service
systemctl daemon-reload
systemctl enable anigalaxy
systemctl restart anigalaxy

say "Nginx"
if [ -n "$DOMAIN" ]; then
  sed "s/__DOMAIN__/$DOMAIN/g" "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/anigalaxy
else
  sed "s/__DOMAIN__/_/g" "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/anigalaxy
fi
ln -sf /etc/nginx/sites-available/anigalaxy /etc/nginx/sites-enabled/anigalaxy
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

say "Файрвол"
ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null

say "HTTPS"
if [ -n "$DOMAIN" ]; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || \
    echo "Сертификат не выдан: проверьте, что A-запись $DOMAIN указывает на этот сервер, и запустите: certbot --nginx -d $DOMAIN"
  grep -q '^SITE_HTTPS=1' "$ENV_FILE" || echo 'SITE_HTTPS=1' >> "$ENV_FILE"
  systemctl restart anigalaxy
fi

say "Резервные копии"
install -m 755 "$APP_DIR/deploy/backup.sh" /usr/local/bin/anigalaxy-backup
cat > /etc/cron.d/anigalaxy-backup <<CRON
17 4 * * * root /usr/local/bin/anigalaxy-backup >> /var/log/anigalaxy-backup.log 2>&1
CRON

say "Telegram"
set -a; . "$ENV_FILE"; set +a
if curl -fsS -m 10 "${TELEGRAM_API_BASE:-https://api.telegram.org}/bot$TELEGRAM_BOT_TOKEN/getMe" >/dev/null; then
  echo "Telegram доступен."
  if [ "${TELEGRAM_LOGIN_MODE:-}" = "webhook" ] && [ -n "$DOMAIN" ]; then
    curl -fsS -m 15 "${TELEGRAM_API_BASE:-https://api.telegram.org}/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
      --data-urlencode "url=https://$DOMAIN/api/tglogin/webhook" \
      --data-urlencode "secret_token=$TELEGRAM_WEBHOOK_SECRET" >/dev/null && echo "Вебхук установлен."
  fi
else
  echo "ВНИМАНИЕ: сервер не достучался до Telegram API. Вход через бота не заработает, пока не задан TELEGRAM_API_BASE (прокси)."
fi

say "Проверка"
sleep 3
curl -fsS -o /dev/null -w 'Сайт отвечает: HTTP %{http_code}\n' http://127.0.0.1:3000/ || echo "Сайт не отвечает: journalctl -u anigalaxy -n 50"
echo "Готово."
