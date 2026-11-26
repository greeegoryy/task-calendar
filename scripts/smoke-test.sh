#!/usr/bin/env bash
set -euo pipefail

base_url=${1%/}
attempts=${2:-5}
response=$(mktemp)
trap 'rm -f "$response"' EXIT

check_response() {
  local path=$1
  local status

  status=$(curl --silent --show-error --connect-timeout 3 --max-time 8 \
    --output "$response" --write-out '%{http_code}' "${base_url}${path}") || return 1

  if [[ "$status" != 200 ]]; then
    echo "${path}: expected HTTP 200, got ${status}" >&2
    return 1
  fi
}

check_application() {
  check_response / || return 1
  if ! grep -Fq '<div id="root">' "$response"; then
    echo '/: React root missing from the response' >&2
    return 1
  fi

  check_response /health || return 1
  if ! python3 -c 'import json, sys; sys.exit(json.load(sys.stdin) != {"status": "ok"})' < "$response"; then
    echo '/health: expected JSON {"status": "ok"}' >&2
    return 1
  fi
}

for ((attempt = 1; attempt <= attempts; attempt++)); do
  echo "Smoke test for ${base_url} (${attempt}/${attempts})"
  if check_application; then
    echo 'PASS: frontend and API health returned the expected responses'
    exit 0
  fi

  if ((attempt < attempts)); then
    sleep 3
  fi
done

echo 'FAIL: application smoke test failed' >&2
exit 1
