#!/usr/bin/env bash
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -f /peas-db/peas_db.sql

better_auth_audit="/peas-db/migrations/2026-07_better_auth_audit.sql"
if [ -s "$better_auth_audit" ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -f "$better_auth_audit"
fi

for migration in /peas-db/migrations/*.sql; do
  if [ "$migration" = "$better_auth_audit" ]; then
    continue
  fi
  if [ -s "$migration" ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
      -f "$migration"
  fi
done

if [ -f /peas-db/schema.sql ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -f /peas-db/schema.sql
fi
