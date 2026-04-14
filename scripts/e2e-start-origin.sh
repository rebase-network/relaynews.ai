#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="relaynews-postgres-e2e"
DATABASE_PORT="54330"
DATABASE_URL="postgres://postgres:postgres@127.0.0.1:${DATABASE_PORT}/relaynews"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

if ! docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  docker run --name "$CONTAINER_NAME" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=relaynews -p "${DATABASE_PORT}:5432" -d postgres:17 >/dev/null
else
  docker start "$CONTAINER_NAME" >/dev/null
fi

for _ in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U postgres -d relaynews >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

DATABASE_URL="$DATABASE_URL" pnpm --filter @relaynews/origin run db:migrate >/dev/null
DATABASE_URL="$DATABASE_URL" pnpm --filter @relaynews/origin run db:seed >/dev/null
env DATABASE_URL="$DATABASE_URL" pnpm --filter @relaynews/origin run dev &
child_pid=$!
wait "$child_pid"
