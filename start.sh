#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

cd "$PROJECT_ROOT"

if docker compose version >/dev/null 2>&1; then
  exec docker compose up --build
fi

if command -v docker-compose >/dev/null 2>&1; then
  exec docker-compose up --build
fi

echo "Docker Compose is required to run PeAS."
echo "Install Docker Desktop or the Docker Compose plugin, then run ./start.sh again."
exit 1
