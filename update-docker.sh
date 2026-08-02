#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-180}"

usage() {
  cat <<'EOF'
Usage: ./update-docker.sh [--no-cache] [--refresh-images]

Update the PeAS Docker Compose deployment without removing persistent volumes.

Options:
  --no-cache  Rebuild the application image without using Docker's build cache.
  --refresh-images
              Pull the latest PostgreSQL and base images before rebuilding.
  -h, --help  Show this help message.

Environment:
  HEALTH_TIMEOUT_SECONDS  Maximum time to wait for healthy services (default: 180).
  PEAS_RELEASE_ID         Stable deployment identifier (defaults to the Git commit).
EOF
}

die() {
  echo "Error: $*" >&2
  exit 1
}

ensure_auth_secret() {
  local env_file="$PROJECT_ROOT/.env"
  local auth_secret

  if [[ -n "${BETTER_AUTH_SECRET:-}" ]]; then
    return
  fi

  if [[ -f "$env_file" ]] &&
    grep -Eq '^[[:space:]]*BETTER_AUTH_SECRET=' "$env_file"; then
    return
  fi

  command -v openssl >/dev/null 2>&1 ||
    die "OpenSSL is required to generate BETTER_AUTH_SECRET"

  auth_secret="$(openssl rand -hex 32)"

  if [[ -f "$env_file" ]]; then
    printf '\nBETTER_AUTH_SECRET=%s\n' "$auth_secret" >>"$env_file"
  else
    (
      umask 077
      printf 'BETTER_AUTH_SECRET=%s\n' "$auth_secret" >"$env_file"
    )
  fi

  unset auth_secret
  echo "Generated BETTER_AUTH_SECRET in .env."
}

NO_CACHE=false
REFRESH_IMAGES=false

while (($# > 0)); do
  case "$1" in
    --no-cache)
      NO_CACHE=true
      ;;
    --refresh-images)
      REFRESH_IMAGES=true
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      die "unknown option: $1"
      ;;
  esac
  shift
done

[[ "$HEALTH_TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]] ||
  die "HEALTH_TIMEOUT_SECONDS must be a positive integer"

command -v docker >/dev/null 2>&1 ||
  die "Docker is not installed or is not available on PATH"

docker info >/dev/null 2>&1 ||
  die "the Docker daemon is not running"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1 &&
  docker-compose version >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  die "Docker Compose is required (Docker Compose plugin or docker-compose)"
fi

cd "$PROJECT_ROOT"

ensure_auth_secret

if [[ -z "${PEAS_RELEASE_ID:-}" ]] && command -v git >/dev/null 2>&1; then
  PEAS_RELEASE_ID="$(git -C "$PROJECT_ROOT" rev-parse --short=12 HEAD 2>/dev/null || true)"
  export PEAS_RELEASE_ID
fi

echo "Validating Docker Compose configuration..."
"${COMPOSE[@]}" config --quiet

if [[ "$REFRESH_IMAGES" == true ]]; then
  echo "Pulling the latest PostgreSQL image..."
  "${COMPOSE[@]}" pull db
fi

echo "Rebuilding the PeAS application image..."
BUILD_ARGS=(build)
if [[ "$REFRESH_IMAGES" == true ]]; then
  BUILD_ARGS+=(--pull)
fi
if [[ "$NO_CACHE" == true ]]; then
  BUILD_ARGS+=(--no-cache)
fi
"${COMPOSE[@]}" "${BUILD_ARGS[@]}" app

echo "Applying the update..."
"${COMPOSE[@]}" up --detach --remove-orphans

wait_for_service() {
  local service="$1"
  local container_id
  local state
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))

  container_id="$("${COMPOSE[@]}" ps -q "$service")"
  [[ -n "$container_id" ]] || die "Compose did not create the '$service' service"

  while ((SECONDS < deadline)); do
    state="$(
      docker inspect \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
        "$container_id" 2>/dev/null || true
    )"

    case "$state" in
      healthy)
        echo "Service '$service' is healthy."
        return 0
        ;;
      running)
        echo "Service '$service' is running (no health check configured)."
        return 0
        ;;
      unhealthy | exited | dead)
        echo "Service '$service' entered state '$state'." >&2
        "${COMPOSE[@]}" logs --tail 100 "$service" >&2
        return 1
        ;;
    esac

    sleep 2
  done

  echo "Timed out waiting for service '$service' to become healthy." >&2
  "${COMPOSE[@]}" logs --tail 100 "$service" >&2
  return 1
}

echo "Waiting for services (timeout: ${HEALTH_TIMEOUT_SECONDS}s each)..."
wait_for_service db
wait_for_service app

echo
echo "PeAS Docker services were updated successfully."
"${COMPOSE[@]}" ps
