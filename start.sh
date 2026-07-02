#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
#  PeAS — Paulinian Electronic Archiving System
#  Development Startup Script
# ─────────────────────────────────────────────────────
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
DENO_DIR="$PROJECT_ROOT/Deno"
PORT="${PORT:-8000}"

# ── Helpers ──────────────────────────────────────────

log()   { echo -e "${CYAN}[PeAS]${RESET} $1"; }
ok()    { echo -e "${GREEN}  ✔${RESET} $1"; }
warn()  { echo -e "${YELLOW}  ⚠${RESET} $1"; }
fail()  { echo -e "${RED}  ✖${RESET} $1"; exit 1; }

cleanup() {
  if [[ -n "${DENO_PID:-}" ]]; then
    log "Shutting down server (PID $DENO_PID)…"
    kill "$DENO_PID" 2>/dev/null || true
    wait "$DENO_PID" 2>/dev/null || true
    ok "Server stopped."
  fi
}
trap cleanup EXIT INT TERM

# ── Pre-flight Checks ───────────────────────────────

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   PeAS — Development Server                 ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${RESET}"
echo ""

# 1. Deno
log "Checking prerequisites…"
if command -v deno &>/dev/null; then
  DENO_VER=$(deno --version | head -1)
  ok "Deno found: $DENO_VER"
else
  fail "Deno is not installed. Install it from https://deno.land"
fi

# 2. PostgreSQL
if command -v psql &>/dev/null; then
  ok "PostgreSQL CLI found: $(psql --version)"
else
  fail "psql not found. Install PostgreSQL first."
fi

# 3. Check PostgreSQL is running
if pg_isready -q 2>/dev/null; then
  ok "PostgreSQL is running."
else
  warn "PostgreSQL does not appear to be running."
  log "Attempting to start PostgreSQL via Homebrew…"
  brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || true
  sleep 2
  if pg_isready -q 2>/dev/null; then
    ok "PostgreSQL started successfully."
  else
    fail "Could not start PostgreSQL. Start it manually and try again."
  fi
fi

# 4. Check database exists
if psql -U postgres -d peas_db -c "SELECT 1" &>/dev/null; then
  ok "Database 'peas_db' is accessible."
else
  warn "Database 'peas_db' not found or 'postgres' role missing."
  log "Setting up database…"

  # Create postgres role if missing — password comes from Deno/.env, never hardcoded
  if ! psql -U "$(whoami)" -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='postgres'" | grep -q 1; then
    PGPASS_FROM_ENV="$(grep '^PGPASSWORD=' "$DENO_DIR/.env" | cut -d= -f2-)"
    if [[ -z "$PGPASS_FROM_ENV" ]]; then
      fail "PGPASSWORD is not set in $DENO_DIR/.env — set it before first-time setup."
    fi
    psql -U "$(whoami)" -d postgres -c "CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD '${PGPASS_FROM_ENV}';" 2>/dev/null
    ok "Created 'postgres' role."
  fi

  # Create database if missing
  if ! psql -U postgres -lqt | cut -d '|' -f 1 | grep -qw peas_db; then
    psql -U postgres -c "CREATE DATABASE peas_db OWNER postgres;" 2>/dev/null
    ok "Created 'peas_db' database."

    # Import schema
    if [[ -f "$DENO_DIR/db/peas_db.sql" ]]; then
      log "Importing schema…"
      psql -U postgres -d peas_db -f "$DENO_DIR/db/peas_db.sql" &>/dev/null
      ok "Schema imported."
    else
      warn "Schema file not found at $DENO_DIR/db/peas_db.sql — skipping import."
    fi
  fi
fi

# 5. Check .env
if [[ -f "$DENO_DIR/.env" ]]; then
  ok ".env file found."
else
  warn "No .env file at $DENO_DIR/.env — the server may not connect to the database."
fi

# 6. Kill anything already on the port
if lsof -ti :"$PORT" &>/dev/null; then
  warn "Port $PORT is in use. Killing existing process…"
  lsof -ti :"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
  ok "Port $PORT freed."
fi

# ── Start Server ─────────────────────────────────────

echo ""
log "Starting PeAS server…"
echo -e "${CYAN}────────────────────────────────────────────────${RESET}"
echo ""

cd "$DENO_DIR"
deno run --allow-net --allow-read --allow-write --allow-env server.ts &
DENO_PID=$!

# Wait for server to be ready
for i in {1..15}; do
  if curl -s "http://localhost:$PORT/ping" &>/dev/null; then
    break
  fi
  sleep 1
done

if curl -s "http://localhost:$PORT/ping" &>/dev/null; then
  echo ""
  echo -e "${CYAN}────────────────────────────────────────────────${RESET}"
  echo ""
  echo -e "  ${GREEN}${BOLD}PeAS is running!${RESET}"
  echo ""
  echo -e "  ${BOLD}Frontend${RESET}  →  http://localhost:$PORT"
  echo -e "  ${BOLD}Admin${RESET}     →  http://localhost:$PORT/admin/dashboard.html"
  echo -e "  ${BOLD}API${RESET}       →  http://localhost:$PORT/api/documents"
  echo ""
  echo -e "  Press ${BOLD}Ctrl+C${RESET} to stop."
  echo -e "${CYAN}────────────────────────────────────────────────${RESET}"
  echo ""
else
  warn "Server started but health check failed. Check the logs above."
fi

# Keep script alive, forwarding server output
wait "$DENO_PID"
