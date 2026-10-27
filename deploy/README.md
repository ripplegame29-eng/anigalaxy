# Развёртывание AniGalaxy на VPS (Ubuntu 24.04)

Сервер: 2 ядра, 4 ГБ, NVMe. Нужны: IP сервера, SSH-доступ, домен (A-запись на IP) и ключи из локального `.env.local`.

## Первый запуск
1. Подключиться: `ssh root@IP`.
2. Скачать и запустить:
   ```
   curl -fsSLO https://raw.githubusercontent.com/ripplegame29-eng/anigalaxy/main/deploy/setup.sh
   sudo DOMAIN=ваш-домен.ru bash setup.sh
   ```
   Для приватного репозитория используйте `REPO=https://<токен>@github.com/ripplegame29-eng/anigalaxy.git`.
3. Скрипт создаст `/opt/anigalaxy/.env.production` и остановится. Впишите ключи (`nano /opt/anigalaxy/.env.production`) и запустите `setup.sh` ещё раз.
4. Готово: сайт на `https://ваш-домен.ru`. Если после HTTPS что-то не так: `journalctl -u anigalaxy -n 80`.

## Обновление
```
sudo bash /opt/anigalaxy/deploy/update.sh
```

## Что где лежит
- Код: `/opt/anigalaxy`, настройки: `/opt/anigalaxy/.env.production`
- База: `/var/lib/anigalaxy/anigalaxy.db`
- Копии базы: `/var/backups/anigalaxy` (каждую ночь в 04:17, последние 14). Скачивайте их к себе: `scp root@IP:/var/backups/anigalaxy/*.gz .`
- Логи: `journalctl -u anigalaxy -f`

## Перенос текущей базы с вашего ПК
Остановить службу, положить файл и запустить:
```
systemctl stop anigalaxy
scp data/anigalaxy.db root@IP:/var/lib/anigalaxy/anigalaxy.db
chown anigalaxy:anigalaxy /var/lib/anigalaxy/anigalaxy.db
systemctl start anigalaxy
```

## Telegram
Серверу нужен выход на `api.telegram.org`. Скрипт проверит это в конце. Если не отвечает, задайте `TELEGRAM_API_BASE`.
