#!/usr/bin/env bash
set -euo pipefail

docker rm -f relaynews-postgres-e2e >/dev/null 2>&1 || true
