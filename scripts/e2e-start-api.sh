#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="relaynews-postgres-e2e"
DATABASE_PORT="54330"
DATABASE_URL="postgres://postgres:postgres@127.0.0.1:${DATABASE_PORT}/relaynews"

run_with_retry() {
  local attempts="$1"
  shift

  for _ in $(seq 1 "$attempts"); do
    if "$@"; then
      return 0
    fi
    sleep 1
  done

  "$@"
}

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

# Always start from a fresh database so repeated Playwright runs stay deterministic.
cleanup
docker run --name "$CONTAINER_NAME" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=relaynews -p "${DATABASE_PORT}:5432" -d postgres:17 >/dev/null

for _ in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U postgres -d relaynews >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

run_with_retry 30 env DATABASE_URL="$DATABASE_URL" pnpm --filter @relaynews/api run db:migrate >/dev/null
run_with_retry 30 env DATABASE_URL="$DATABASE_URL" pnpm --filter @relaynews/api run db:seed >/dev/null
env DATABASE_URL="$DATABASE_URL" pnpm --filter @relaynews/api run dev &
child_pid=$!
wait "$child_pid"
