#!/usr/bin/env bash
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -f /peas-db/peas_db.sql

for migration in /peas-db/migrations/*.sql; do
  if [ -s "$migration" ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
      -f "$migration"
  fi
done

if [ -f /peas-db/schema.sql ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -f /peas-db/schema.sql
fi
