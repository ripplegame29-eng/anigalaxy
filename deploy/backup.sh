#!/usr/bin/env bash
# Консистентная копия базы SQLite; хранит последние 14 копий
set -euo pipefail
DB=/var/lib/anigalaxy/anigalaxy.db
OUT=/var/backups/anigalaxy
[ -f "$DB" ] || { echo "Базы пока нет"; exit 0; }
mkdir -p "$OUT"
FILE="$OUT/anigalaxy-$(date +%Y%m%d-%H%M).db"
sqlite3 "$DB" ".backup '$FILE'"
gzip -f "$FILE"
ls -1t "$OUT"/anigalaxy-*.db.gz | tail -n +15 | xargs -r rm --
echo "Копия: $FILE.gz"
