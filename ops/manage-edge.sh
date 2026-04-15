#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CF_ACCOUNT_ID="${CF_ACCOUNT_ID:-5abb6d6f38eb7d3dabf8a5adf095c5f7}"
PUBLIC_SITE_URL="${PUBLIC_SITE_URL:-https://relaynew.ai}"
ADMIN_SITE_URL="${ADMIN_SITE_URL:-https://admin.relaynew.ai}"
PUBLIC_API_BASE_URL="${PUBLIC_API_BASE_URL:-https://api.rebase.network/relaynews}"

usage() {
  cat <<USAGE
Usage: ./ops/manage-edge.sh <command> [target]

Commands:
  help                     Show this help message
  build <web|admin|all>    Build Cloudflare frontend assets
  preview <web|admin|all>  Build and validate Wrangler config with dry-run deploy
  deploy <web|admin|all>   Build and deploy Cloudflare Workers static assets
  whoami                   Show the active Wrangler account

Overrides:
  CF_ACCOUNT_ID           Default: ${CF_ACCOUNT_ID}
  PUBLIC_SITE_URL          Default: ${PUBLIC_SITE_URL}
  ADMIN_SITE_URL           Default: ${ADMIN_SITE_URL}
  PUBLIC_API_BASE_URL      Default: ${PUBLIC_API_BASE_URL}
USAGE
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

run_build() {
  local app="$1"
  local filter

  case "$app" in
    web)
      filter="@relaynews/web"
      ;;
    admin)
      filter="@relaynews/admin"
      ;;
    *)
      echo "Unknown app: $app" >&2
      exit 1
      ;;
  esac

  echo "Building ${app} for Cloudflare..."
  (
    cd "$ROOT_DIR"
    export VITE_API_BASE_URL="${PUBLIC_API_BASE_URL}"
    export VITE_PUBLIC_SITE_URL="${PUBLIC_SITE_URL}"
    export VITE_ADMIN_SITE_URL="${ADMIN_SITE_URL}"
    pnpm --filter "${filter}" run build
  )
}

run_wrangle() {
  local app="$1"
  shift

  (
    cd "$ROOT_DIR"
    export CLOUDFLARE_ACCOUNT_ID="${CF_ACCOUNT_ID}"
    pnpm exec wrangler "$@" --config "apps/${app}/wrangler.jsonc"
  )
}

for_each_target() {
  local target="$1"
  shift

  case "$target" in
    web|admin)
      "$@" "$target"
      ;;
    all)
      "$@" web
      "$@" admin
      ;;
    *)
      echo "Unknown target: ${target}" >&2
      usage
      exit 1
      ;;
  esac
}

build_target() {
  run_build "$1"
}

preview_target() {
  local app="$1"
  run_build "$app"
  echo "Previewing ${app} Wrangler deploy..."
  run_wrangle "$app" deploy --dry-run
}

deploy_target() {
  local app="$1"
  run_build "$app"
  echo "Deploying ${app} to Cloudflare..."
  run_wrangle "$app" deploy
}

main() {
  require_cmd pnpm

  local command="${1:-help}"
  local target="${2:-all}"

  case "$command" in
    help|-h|--help)
      usage
      ;;
    build)
      for_each_target "$target" build_target
      ;;
    preview)
      for_each_target "$target" preview_target
      ;;
    deploy)
      for_each_target "$target" deploy_target
      ;;
    whoami)
      (
        cd "$ROOT_DIR"
        export CLOUDFLARE_ACCOUNT_ID="${CF_ACCOUNT_ID}"
        pnpm exec wrangler whoami
      )
      ;;
    *)
      echo "Unknown command: ${command}" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
