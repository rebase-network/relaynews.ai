#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CF_ACCOUNT_ID="${CF_ACCOUNT_ID:-5abb6d6f38eb7d3dabf8a5adf095c5f7}"
PUBLIC_SITE_URL="${PUBLIC_SITE_URL:-https://relaynew.ai}"
ADMIN_SITE_URL="${ADMIN_SITE_URL:-https://admin.relaynew.ai}"
API_SITE_URL="${API_SITE_URL:-https://api.relaynew.ai}"
PUBLIC_API_BASE_URL="${PUBLIC_API_BASE_URL:-${API_SITE_URL}}"

usage() {
  cat <<USAGE
Usage: ./ops/manage-api-edge.sh <command> [target]

Commands:
  help                     Show this help message
  build <web|admin|api|all>    Build Cloudflare edge apps
  preview <web|admin|api|all>  Build and validate Wrangler config with dry-run deploy
  deploy [api]                  Build and deploy the API edge app only
  whoami                   Show the active Wrangler account

Overrides:
  CF_ACCOUNT_ID           Default: ${CF_ACCOUNT_ID}
  PUBLIC_SITE_URL          Default: ${PUBLIC_SITE_URL}
  ADMIN_SITE_URL           Default: ${ADMIN_SITE_URL}
  API_SITE_URL             Default: ${API_SITE_URL}
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
    api)
      filter="@relaynews/api-edge"
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

app_dir() {
  case "$1" in
    api)
      echo "api-edge"
      ;;
    *)
      echo "$1"
      ;;
  esac
}

run_wrangle() {
  local app="$1"
  shift
  local dir
  dir="$(app_dir "$app")"

  (
    cd "$ROOT_DIR"
    export CLOUDFLARE_ACCOUNT_ID="${CF_ACCOUNT_ID}"
    pnpm exec wrangler "$@" --config "apps/${dir}/wrangler.jsonc"
  )
}

for_each_target() {
  local target="$1"
  shift

  case "$target" in
    web|admin|api)
      "$@" "$target"
      ;;
    all)
      "$@" web
      "$@" admin
      "$@" api
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

reject_frontend_deploy() {
  cat >&2 <<EOF
Direct Cloudflare deploys for web/admin are disabled.
Commit and push to GitHub so Workers Builds deploy relaynews-web and relaynews-admin.
Use ./ops/manage-api-edge.sh deploy api only for the API edge Worker.
EOF
  exit 1
}

main() {
  require_cmd pnpm

  local command="${1:-help}"
  local target="${2:-}"

  case "$command" in
    help|-h|--help)
      usage
      ;;
    build)
      target="${target:-all}"
      for_each_target "$target" build_target
      ;;
    preview)
      target="${target:-all}"
      for_each_target "$target" preview_target
      ;;
    deploy)
      target="${target:-api}"
      case "$target" in
        api)
          deploy_target "api"
          ;;
        web|admin|all)
          reject_frontend_deploy
          ;;
        *)
          echo "Unknown target: ${target}" >&2
          usage
          exit 1
          ;;
      esac
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
