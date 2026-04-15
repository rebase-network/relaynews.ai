#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CF_TUNNEL_ACCOUNT_ID="${CF_TUNNEL_ACCOUNT_ID:-7e327cb72b95b88c927c7122db11baa6}"
CF_TUNNEL_ID="${CF_TUNNEL_ID:-339357f8-3d31-437e-a7a0-77fd311a4c4e}"
CF_TUNNEL_HOSTNAME="${CF_TUNNEL_HOSTNAME:-api.rebase.network}"
CF_TUNNEL_PATH_REGEX="${CF_TUNNEL_PATH_REGEX:-/relaynews(?:/.*)?$}"
CF_TUNNEL_SERVICE="${CF_TUNNEL_SERVICE:-http://relaynews-origin:8787}"

usage() {
  cat <<USAGE
Usage: ./ops/manage-tunnel.sh <command>

Commands:
  help        Show this help message
  status      Print the current tunnel configuration
  apply       Upsert the relaynews ingress rule into the tunnel config

Overrides:
  CF_TUNNEL_ACCOUNT_ID  Default: ${CF_TUNNEL_ACCOUNT_ID}
  CF_TUNNEL_ID          Default: ${CF_TUNNEL_ID}
  CF_TUNNEL_HOSTNAME    Default: ${CF_TUNNEL_HOSTNAME}
  CF_TUNNEL_PATH_REGEX  Default: ${CF_TUNNEL_PATH_REGEX}
  CF_TUNNEL_SERVICE     Default: ${CF_TUNNEL_SERVICE}
USAGE
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

get_api_token() {
  (
    cd "$ROOT_DIR"
    pnpm exec wrangler auth token | tail -n 1
  )
}

api_url() {
  printf "https://api.cloudflare.com/client/v4/accounts/%s/cfd_tunnel/%s/configurations" \
    "$CF_TUNNEL_ACCOUNT_ID" \
    "$CF_TUNNEL_ID"
}

fetch_config() {
  local token
  token="$(get_api_token)"
  curl -fsS \
    -H "Authorization: Bearer ${token}" \
    "$(api_url)"
}

show_status() {
  fetch_config | python3 -m json.tool
}

apply_config() {
  require_cmd python3
  require_cmd curl
  require_cmd pnpm

  export CF_TUNNEL_HOSTNAME
  export CF_TUNNEL_PATH_REGEX
  export CF_TUNNEL_SERVICE

  local token current payload
  token="$(get_api_token)"
  current="$(mktemp)"
  payload="$(mktemp)"
  trap 'rm -f "${current:-}" "${payload:-}"' EXIT

  curl -fsS \
    -H "Authorization: Bearer ${token}" \
    "$(api_url)" \
    >"$current"

  python3 - "$current" "$payload" <<'PY'
import json
import os
import sys

current_path, output_path = sys.argv[1:3]
hostname = os.environ["CF_TUNNEL_HOSTNAME"]
path_regex = os.environ["CF_TUNNEL_PATH_REGEX"]
service = os.environ["CF_TUNNEL_SERVICE"]

with open(current_path, "r", encoding="utf-8") as handle:
    data = json.load(handle)

config = data["result"]["config"]
ingress = config.get("ingress", [])

new_rule = {
    "hostname": hostname,
    "path": path_regex,
    "service": service,
    "originRequest": {},
}

filtered = [
    rule
    for rule in ingress
    if not (rule.get("hostname") == hostname and rule.get("path") == path_regex)
]

updated = []
inserted = False
for rule in filtered:
    if not inserted and (
        rule.get("service", "").startswith("http_status:")
        or (rule.get("hostname") == hostname and "path" not in rule)
    ):
        updated.append(new_rule)
        inserted = True
    updated.append(rule)

if not inserted:
    updated.append(new_rule)

config["ingress"] = updated

with open(output_path, "w", encoding="utf-8") as handle:
    json.dump({"config": config}, handle)
PY

  curl -fsS \
    -X PUT \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    "$(api_url)" \
    --data "@${payload}" \
    >/dev/null

  echo "Updated tunnel ingress for ${CF_TUNNEL_HOSTNAME}${CF_TUNNEL_PATH_REGEX}"
  show_status
}

main() {
  local command="${1:-help}"

  case "$command" in
    help|-h|--help)
      usage
      ;;
    status)
      show_status
      ;;
    apply)
      apply_config
      ;;
    *)
      echo "Unknown command: ${command}" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
