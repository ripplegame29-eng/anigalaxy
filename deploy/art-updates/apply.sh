#!/usr/bin/env bash
# Копирует обновлённые арты карт в рабочую папку данных: sudo bash /opt/anigalaxy/deploy/art-updates/apply.sh
set -euo pipefail
SRC=/opt/anigalaxy/deploy/art-updates; DST=/opt/anigalaxy/data
mkdir -p "$DST/cards-art" "$DST/cards-art-hd"
cp -v "$SRC"/cards-art/*.jpg "$DST/cards-art/"
cp -v "$SRC"/cards-art-hd/*.jpg "$DST/cards-art-hd/"
chown -R anigalaxy:anigalaxy "$DST"
echo "Готово. Обновите страницу сайта (Ctrl+F5)."
