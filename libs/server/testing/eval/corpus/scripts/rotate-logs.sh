#!/usr/bin/env bash
# Compresses application logs older than a day and removes archives after a month.
set -euo pipefail

LOG_DIR="${LOG_DIR:-/var/log/harbor-shop}"
ARCHIVE_AFTER_DAYS=1
DELETE_AFTER_DAYS=30

find "$LOG_DIR" -name '*.log' -mtime +"$ARCHIVE_AFTER_DAYS" -exec gzip -f {} \;
find "$LOG_DIR" -name '*.log.gz' -mtime +"$DELETE_AFTER_DAYS" -delete

echo "Rotated logs in $LOG_DIR"
