#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
TELEGRAM_API_BASE="${TELEGRAM_API_BASE:-https://api.telegram.org}"

usage() {
  cat <<USAGE
Usage: ./ops/send-telegram.sh [message...]

Send a Telegram bot message using TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_CHAT_ID.

Message input:
  - pass the message as CLI arguments, or
  - pipe the message through stdin

Environment:
  TELEGRAM_BOT_TOKEN      Bot token, usually loaded from .env
  TELEGRAM_BOT_CHAT_ID    Target chat id, usually loaded from .env
  ENV_FILE                Optional override for the env file path
  TELEGRAM_API_BASE       Optional Telegram API base URL override

Examples:
  ./ops/send-telegram.sh "Relay 测试已完成"
  printf '%s\n' "Relay 排行榜刷新完成" | ./ops/send-telegram.sh
USAGE
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

load_env_file() {
  if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
  fi
}

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

read_message() {
  if [ "$#" -gt 0 ]; then
    MESSAGE="$*"
    return
  fi

  if [ ! -t 0 ]; then
    MESSAGE="$(cat)"
    return
  fi

  echo "Missing message body." >&2
  usage >&2
  exit 1
}

send_message() {
  curl --silent --show-error --fail \
    --request POST \
    "${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_BOT_CHAT_ID}" \
    --data-urlencode "text=${MESSAGE}" \
    >/dev/null
}

main() {
  if [ "${1:-}" = "help" ] || [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    usage
    exit 0
  fi

  require_cmd curl
  load_env_file
  require_env TELEGRAM_BOT_TOKEN
  require_env TELEGRAM_BOT_CHAT_ID
  read_message "$@"

  if [ -z "$MESSAGE" ]; then
    echo "Message body cannot be empty." >&2
    exit 1
  fi

  send_message
  echo "Telegram message sent."
}

main "$@"
