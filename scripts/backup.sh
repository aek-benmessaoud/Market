#!/bin/bash
set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_NAME="${DB_NAME:-mini_market}"
DB_USER="${DB_USER:-postgres}"
DB_CONTAINER="${DB_CONTAINER:-mini-market-db-1}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Backing up database: ${DB_NAME}"
docker compose exec -T "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "Backup saved: ${BACKUP_FILE} ($(du -h "$BACKUP_FILE" | cut -f1))"

# Clean old backups
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "Removed backups older than ${RETENTION_DAYS} days."