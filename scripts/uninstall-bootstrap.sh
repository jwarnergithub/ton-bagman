#!/usr/bin/env bash

set -euo pipefail

MANIFEST_PATH="${MANIFEST_PATH:-/opt/ton-storage/ton-bagman-bootstrap.json}"
PURGE_TON_DATA=0
PURGE_APP_ENV=0

usage() {
  cat <<'EOF'
Usage: sudo ./scripts/uninstall-bootstrap.sh [options]

This rollback helper is experimental and should be used at your own risk.

Options:
  --manifest PATH     Bootstrap manifest path. Default: /opt/ton-storage/ton-bagman-bootstrap.json
  --purge-ton-data    Remove TON data directories recorded in the manifest
  --purge-app-env     Remove the generated .env.local recorded in the manifest
  --help              Show this message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest)
      MANIFEST_PATH="$2"
      shift 2
      ;;
    --purge-ton-data)
      PURGE_TON_DATA=1
      shift
      ;;
    --purge-app-env)
      PURGE_APP_ENV=1
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root or through sudo." >&2
  exit 1
fi

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "Manifest not found at $MANIFEST_PATH" >&2
  exit 1
fi

read_json_field() {
  local key="$1"
  sed -n "s/^[[:space:]]*\"$key\":[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" "$MANIFEST_PATH" | head -n 1
}

read_json_bool() {
  local key="$1"
  sed -n "s/^[[:space:]]*\"$key\":[[:space:]]*\\(true\\|false\\).*/\\1/p" "$MANIFEST_PATH" | head -n 1
}

APP_ENV_PATH="$(read_json_field app_env_path)"
TON_ROOT="$(read_json_field ton_root)"
TON_SERVICE_INSTALLED="$(read_json_bool ton_service_installed)"
APP_SERVICE_INSTALLED="$(read_json_bool app_service_installed)"
FULL_MODE="$(read_json_bool full_mode)"

if [[ "$APP_SERVICE_INSTALLED" == "true" ]]; then
  systemctl disable --now ton-bagman.service || true
  rm -f /etc/systemd/system/ton-bagman.service
fi

if [[ "$TON_SERVICE_INSTALLED" == "true" ]]; then
  systemctl disable --now ton-storage.service || true
  rm -f /etc/systemd/system/ton-storage.service
fi

systemctl daemon-reload

if [[ "$PURGE_APP_ENV" -eq 1 && -n "$APP_ENV_PATH" && -f "$APP_ENV_PATH" ]]; then
  rm -f "$APP_ENV_PATH"
fi

if [[ "$FULL_MODE" == "true" ]]; then
  rm -f /usr/local/bin/storage-daemon /usr/local/bin/storage-daemon-cli
fi

if [[ "$PURGE_TON_DATA" -eq 1 && -n "$TON_ROOT" && -d "$TON_ROOT" ]]; then
  rm -rf "$TON_ROOT"
fi

echo "Rollback complete."
