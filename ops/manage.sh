#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

REMOTE_HOST="${REMOTE_HOST:-rebase@rebase.host}"
REMOTE_BASE_DIR="${REMOTE_BASE_DIR:-/home/rebase/apps/relaynews-api}"
REMOTE_RELEASES_DIR="${REMOTE_RELEASES_DIR:-${REMOTE_BASE_DIR}/releases}"
REMOTE_SHARED_DIR="${REMOTE_SHARED_DIR:-${REMOTE_BASE_DIR}/shared}"
REMOTE_CURRENT_LINK="${REMOTE_CURRENT_LINK:-${REMOTE_BASE_DIR}/current}"
REMOTE_ENV_FILE="${REMOTE_ENV_FILE:-${REMOTE_SHARED_DIR}/api.env}"
REMOTE_COMPOSE_PROJECT="${REMOTE_COMPOSE_PROJECT:-relaynews-api}"
REMOTE_COMPOSE_FILE="${REMOTE_COMPOSE_FILE:-ops/docker-compose.api.yml}"
API_HOST_PORT="${API_HOST_PORT:-8787}"
REMOTE_HEALTHCHECK_URL="${REMOTE_HEALTHCHECK_URL:-http://127.0.0.1:${API_HOST_PORT}/health}"
SSH_OPTS=("-o" "ServerAliveInterval=30" "-o" "StrictHostKeyChecking=accept-new")

usage() {
  cat <<USAGE
Usage: ./ops/manage.sh <command> [args]

Commands:
  help                     Show this help message
  ssh                      Open an interactive SSH session
  remote <cmd...>          Run an arbitrary command on the remote host
  bootstrap                Create remote directories for Docker-based API deploys
  deploy                   Sync repo, build image, migrate DB, and restart the API stack
  releases                 List remote release directories
  rollback [release-id]    Point current to a prior release and restart the API stack
  status                   Show current release and Docker Compose status
  health                   Check the remote API health endpoint
  logs [lines]             Show recent Docker Compose logs (default: 100)
  start                    Start the API stack
  stop                     Stop the API stack
  restart                  Restart the API stack
  env-push [local-file]    Upload a local env file to the remote API env path
  path                     Print the derived remote paths

Overrides:
  REMOTE_HOST              Default: ${REMOTE_HOST}
  REMOTE_BASE_DIR          Default: ${REMOTE_BASE_DIR}
  REMOTE_ENV_FILE          Default: ${REMOTE_ENV_FILE}
  REMOTE_COMPOSE_PROJECT   Default: ${REMOTE_COMPOSE_PROJECT}
  API_HOST_PORT            Default: ${API_HOST_PORT}
USAGE
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

run_ssh() {
  ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" "$@"
}

run_remote_script() {
  local script="$1"
  ssh "${SSH_OPTS[@]}" "$REMOTE_HOST" 'bash -se' <<EOF_REMOTE
set -euo pipefail
$script
EOF_REMOTE
}

compose_env_exports() {
  cat <<EOF_EXPORTS
export API_ENV_FILE='${REMOTE_ENV_FILE}'
export COMPOSE_PROJECT_NAME='${REMOTE_COMPOSE_PROJECT}'
export API_HOST_PORT='${API_HOST_PORT}'
if [ -f "\$API_ENV_FILE" ]; then
  set -a
  . "\$API_ENV_FILE"
  set +a
fi
EOF_EXPORTS
}

build_ref_export() {
  local build_ref="$1"
  cat <<EOF_BUILD_REF
export RELAYNEWS_BUILD_REF='${build_ref}'
EOF_BUILD_REF
}

wait_for_postgres_script() {
  cat <<EOF_WAIT
for _ in \$(seq 1 30); do
  if docker compose -f '${REMOTE_COMPOSE_FILE}' exec -T postgres \
    pg_isready -U "\${POSTGRES_USER:-relaynews}" -d "\${POSTGRES_DB:-relaynews}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker compose -f '${REMOTE_COMPOSE_FILE}' exec -T postgres \
  pg_isready -U "\${POSTGRES_USER:-relaynews}" -d "\${POSTGRES_DB:-relaynews}" >/dev/null 2>&1
EOF_WAIT
}

sync_release() {
  require_cmd rsync
  local release_id
  release_id="$(date +%Y%m%d%H%M%S)"
  local release_dir="${REMOTE_RELEASES_DIR}/${release_id}"

  run_remote_script "mkdir -p '${REMOTE_RELEASES_DIR}' '${REMOTE_SHARED_DIR}' '${release_dir}'"

  rsync -az --delete \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '.env' \
    --exclude '.DS_Store' \
    --exclude 'test-results' \
    --exclude 'playwright-report' \
    --exclude '.wrangler' \
    --exclude '.pnpm-store' \
    --exclude 'coverage' \
    --exclude '.idea' \
    --exclude '.vscode' \
    "$ROOT_DIR/" "${REMOTE_HOST}:${release_dir}/"

  echo "$release_dir"
}

bootstrap_remote() {
  run_remote_script "
mkdir -p '${REMOTE_RELEASES_DIR}' '${REMOTE_SHARED_DIR}'
if [ ! -f '${REMOTE_ENV_FILE}' ]; then
  cat > '${REMOTE_ENV_FILE}' <<'EOF_ENV'
NODE_ENV=production
HOST=0.0.0.0
PORT=8787
POSTGRES_DB=relaynews
POSTGRES_USER=relaynews
POSTGRES_PASSWORD=change-me
DATABASE_URL=postgres://relaynews:change-me@postgres:5432/relaynews
ENABLE_SCHEDULER=true
PUBLIC_PROBE_ALLOW_PRIVATE_HOSTS=false
CLOUDFLARE_TUNNEL_TOKEN=
EOF_ENV
fi
if ! command -v docker >/dev/null 2>&1; then
  echo 'docker is required on the remote host' >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo 'docker compose is required on the remote host' >&2
  exit 1
fi
"

  echo "Bootstrap completed for ${REMOTE_HOST}"
}

deploy_remote() {
  require_cmd ssh
  require_cmd rsync

  local release_dir
  release_dir="$(sync_release)"
  local release_id
  release_id="$(basename "$release_dir")"

  run_remote_script "
$(compose_env_exports)
$(build_ref_export "$release_id")
if [ ! -f '${REMOTE_ENV_FILE}' ]; then
  echo 'Missing remote env file: ${REMOTE_ENV_FILE}' >&2
  exit 1
fi
ln -sfn '${release_dir}' '${REMOTE_CURRENT_LINK}'
cd '${REMOTE_CURRENT_LINK}'
docker compose -f '${REMOTE_COMPOSE_FILE}' up -d postgres
$(wait_for_postgres_script)
docker compose -f '${REMOTE_COMPOSE_FILE}' build api
docker compose -f '${REMOTE_COMPOSE_FILE}' run --rm api tsx apps/api/src/db/migrate.ts
docker compose -f '${REMOTE_COMPOSE_FILE}' up -d --force-recreate api cloudflared
sleep 3
curl --fail --silent --show-error '${REMOTE_HEALTHCHECK_URL}' >/dev/null
docker image prune -f >/dev/null 2>&1 || true
"

  echo "Deploy completed"
  status_remote
}

list_releases_remote() {
  run_remote_script "
if [ -d '${REMOTE_RELEASES_DIR}' ]; then
  find '${REMOTE_RELEASES_DIR}' -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort
fi
"
}

rollback_remote() {
  local requested_release="${1:-previous}"

  run_remote_script "
$(compose_env_exports)
if [ ! -d '${REMOTE_RELEASES_DIR}' ]; then
  echo 'No releases directory found: ${REMOTE_RELEASES_DIR}' >&2
  exit 1
fi

current_release=''
if [ -L '${REMOTE_CURRENT_LINK}' ]; then
  current_release=\$(basename \"\$(readlink '${REMOTE_CURRENT_LINK}')\")
fi

target_release='${requested_release}'
if [ \"\$target_release\" = 'previous' ]; then
  target_release=\$(find '${REMOTE_RELEASES_DIR}' -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort | grep -vx \"\$current_release\" | tail -n 1)
fi

if [ -z \"\$target_release\" ]; then
  echo 'Could not determine a rollback target release' >&2
  exit 1
fi

target_dir='${REMOTE_RELEASES_DIR}/'\$target_release
if [ ! -d \"\$target_dir\" ]; then
  echo \"Release not found: \$target_release\" >&2
  exit 1
fi

ln -sfn \"\$target_dir\" '${REMOTE_CURRENT_LINK}'
export RELAYNEWS_BUILD_REF=\"\$target_release\"
cd '${REMOTE_CURRENT_LINK}'
docker compose -f '${REMOTE_COMPOSE_FILE}' up -d postgres
$(wait_for_postgres_script)
docker compose -f '${REMOTE_COMPOSE_FILE}' build api
docker compose -f '${REMOTE_COMPOSE_FILE}' up -d --force-recreate api cloudflared
sleep 3
curl --fail --silent --show-error '${REMOTE_HEALTHCHECK_URL}' >/dev/null
echo \"Rolled back to \$target_release\"
"

  status_remote
}

status_remote() {
  run_remote_script "
$(compose_env_exports)
echo 'remote_host: ${REMOTE_HOST}'
echo 'compose_project: ${REMOTE_COMPOSE_PROJECT}'
echo 'current_release:'
readlink '${REMOTE_CURRENT_LINK}' || true
echo
if [ -e '${REMOTE_CURRENT_LINK}/${REMOTE_COMPOSE_FILE}' ]; then
  cd '${REMOTE_CURRENT_LINK}'
  docker compose -f '${REMOTE_COMPOSE_FILE}' ps || true
  api_container_id=\$(docker compose -f '${REMOTE_COMPOSE_FILE}' ps -q api)
  if [ -n \"\$api_container_id\" ]; then
    echo
    echo 'api_build_ref:'
    docker inspect --format '{{ index .Config.Labels "ai.relaynews.build_ref" }}' \"\$api_container_id\" || true
  fi
else
  echo 'compose file is not available in current release yet'
fi
"
}

health_remote() {
  run_remote_script "curl --fail --silent --show-error '${REMOTE_HEALTHCHECK_URL}' && echo"
}

logs_remote() {
  local lines="${1:-100}"
  run_remote_script "
$(compose_env_exports)
cd '${REMOTE_CURRENT_LINK}'
docker compose -f '${REMOTE_COMPOSE_FILE}' logs --tail '${lines}' postgres api cloudflared
"
}

push_env() {
  local local_file="${1:-${ROOT_DIR}/ops/api.env.example}"
  if [ ! -f "$local_file" ]; then
    echo "Local env file not found: $local_file" >&2
    exit 1
  fi

  run_remote_script "mkdir -p '${REMOTE_SHARED_DIR}'"
  scp "${SSH_OPTS[@]}" "$local_file" "${REMOTE_HOST}:${REMOTE_ENV_FILE}"
  echo "Uploaded ${local_file} -> ${REMOTE_ENV_FILE}"
}

compose_action() {
  local action="$1"
  run_remote_script "
$(compose_env_exports)
cd '${REMOTE_CURRENT_LINK}'
case '${action}' in
  start)
    docker compose -f '${REMOTE_COMPOSE_FILE}' up -d postgres api cloudflared
    ;;
  stop)
    docker compose -f '${REMOTE_COMPOSE_FILE}' stop cloudflared api postgres
    ;;
  restart)
    docker compose -f '${REMOTE_COMPOSE_FILE}' restart postgres api cloudflared
    ;;
esac
"
}

case "${1:-help}" in
  help|-h|--help)
    usage
    ;;
  ssh)
    exec ssh "${SSH_OPTS[@]}" "$REMOTE_HOST"
    ;;
  remote)
    shift
    if [ "$#" -eq 0 ]; then
      echo "remote requires a command" >&2
      exit 1
    fi
    run_ssh "$@"
    ;;
  bootstrap)
    bootstrap_remote
    ;;
  deploy)
    deploy_remote
    ;;
  releases)
    list_releases_remote
    ;;
  rollback)
    shift || true
    rollback_remote "${1:-previous}"
    ;;
  status)
    status_remote
    ;;
  health)
    health_remote
    ;;
  logs)
    shift || true
    logs_remote "${1:-100}"
    ;;
  start|stop|restart)
    compose_action "$1"
    ;;
  env-push)
    shift || true
    push_env "${1:-${ROOT_DIR}/ops/api.env.example}"
    ;;
  path)
    cat <<EOF_PATH
REMOTE_HOST=${REMOTE_HOST}
REMOTE_BASE_DIR=${REMOTE_BASE_DIR}
REMOTE_RELEASES_DIR=${REMOTE_RELEASES_DIR}
REMOTE_SHARED_DIR=${REMOTE_SHARED_DIR}
REMOTE_CURRENT_LINK=${REMOTE_CURRENT_LINK}
REMOTE_ENV_FILE=${REMOTE_ENV_FILE}
REMOTE_COMPOSE_PROJECT=${REMOTE_COMPOSE_PROJECT}
REMOTE_COMPOSE_FILE=${REMOTE_COMPOSE_FILE}
REMOTE_HEALTHCHECK_URL=${REMOTE_HEALTHCHECK_URL}
API_HOST_PORT=${API_HOST_PORT}
EOF_PATH
    ;;
  *)
    echo "Unknown command: $1" >&2
    usage
    exit 1
    ;;
esac
