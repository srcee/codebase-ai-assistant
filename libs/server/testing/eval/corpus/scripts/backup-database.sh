#!/usr/bin/env bash
# Dumps the shop database to a compressed file and keeps the most recent copies.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/harbor-shop}"
KEEP_COPIES="${KEEP_COPIES:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

pg_dump --format=custom --file="$BACKUP_DIR/shop-$STAMP.dump" "$SHOP_DATABASE_URL"
gzip -f "$BACKUP_DIR/shop-$STAMP.dump"

# Delete everything but the newest copies.
ls -1t "$BACKUP_DIR"/shop-*.dump.gz | tail -n +"$((KEEP_COPIES + 1))" | xargs -r rm --

echo "Backup finished: shop-$STAMP.dump.gz"
