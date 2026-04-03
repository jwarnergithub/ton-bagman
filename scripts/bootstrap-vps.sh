#!/usr/bin/env bash

set -euo pipefail

BOOTSTRAP_MODE="${BOOTSTRAP_MODE:-auto}"
TON_VERSION="${TON_VERSION:-v2026.03}"
TON_REPO_URL="${TON_REPO_URL:-https://github.com/ton-blockchain/ton.git}"
TON_GLOBAL_CONFIG_URL="${TON_GLOBAL_CONFIG_URL:-https://raw.githubusercontent.com/ton-blockchain/ton-blockchain.github.io/main/global.config.json}"
TON_ROOT="${TON_ROOT:-/opt/ton-storage}"
APP_PORT="${APP_PORT:-3000}"
TON_CONTROL_PORT="${TON_CONTROL_PORT:-5555}"
TON_ADNL_PORT="${TON_ADNL_PORT:-3333}"
INSTALL_NODE="${INSTALL_NODE:-1}"
TONAPI_API_KEY="${TONAPI_API_KEY:-}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TON_SSH_HOST="${TON_SSH_HOST:-127.0.0.1}"
TON_SSH_PORT="${TON_SSH_PORT:-22}"
TON_DAEMON_CLI_KEY_PATH="${TON_DAEMON_CLI_KEY_PATH:-}"
TON_DAEMON_SERVER_PUB_PATH="${TON_DAEMON_SERVER_PUB_PATH:-}"
TON_REMOTE_BASE_DIR="${TON_REMOTE_BASE_DIR:-}"
TON_REMOTE_BAG_SOURCE_DIR="${TON_REMOTE_BAG_SOURCE_DIR:-}"
TON_REMOTE_DELETE_ALLOWED_DIRS="${TON_REMOTE_DELETE_ALLOWED_DIRS:-}"
DRY_RUN="${DRY_RUN:-0}"
BOOTSTRAP_LOG_PATH="${BOOTSTRAP_LOG_PATH:-}"

usage() {
  cat <<'EOF'
Usage: sudo ./scripts/bootstrap-vps.sh [options]

This bootstrap is experimental, should be used at your own risk,
and has only been tested on Ubuntu so far.

Modes:
  auto     Detect an existing TON Storage install. If found, install only the UI.
           Otherwise install TON Storage v2026.03 and the UI. Default.
  full     Install the pinned TON backend and the UI on the same host.
  ui-only  Install only the UI and connect it to an existing TON Storage setup.

Options:
  --mode MODE                 One of: auto, full, ui-only. Default: auto
  --app-dir PATH              App checkout to build and run. Defaults to the repo root
  --app-user USER             Linux user that will own the app and TON services
  --app-port PORT             Next.js listen port. Default: 3000
  --ton-version TAG           Official TON git tag to build in full mode. Default: v2026.03
  --ton-root PATH             Install root for TON binaries and data in full mode. Default: /opt/ton-storage
  --ton-control-port PORT     storage-daemon control port. Default: 5555
  --ton-adnl-ip IP            Public or bind IP for storage-daemon ADNL in full mode
  --ton-adnl-port PORT        storage-daemon ADNL port in full mode. Default: 3333
  --tonapi-api-key KEY        TonAPI key to write into .env.local
  --ton-ssh-host HOST         SSH host the app should use. Default: 127.0.0.1
  --ton-ssh-port PORT         SSH port the app should use. Default: 22
  --daemon-cli-key-path PATH  Existing TON cli client key for ui-only mode
  --daemon-server-pub PATH    Existing TON cli server pub key for ui-only mode
  --remote-base-dir PATH      Existing uploads dir for ui-only mode
  --remote-bag-source-dir PATH Existing bag source dir for ui-only mode
  --remote-delete-allowed-dirs CSV Existing delete allowlist for ui-only mode
  --dry-run                   Print planned actions without changing the host
  --skip-node-install         Assume Node.js 20+ is already installed
  --help                      Show this message
EOF
}

APP_USER="${APP_USER:-}"
TON_ADNL_IP="${TON_ADNL_IP:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      BOOTSTRAP_MODE="$2"
      shift 2
      ;;
    --app-dir)
      APP_DIR="$2"
      shift 2
      ;;
    --app-user)
      APP_USER="$2"
      shift 2
      ;;
    --app-port)
      APP_PORT="$2"
      shift 2
      ;;
    --ton-version)
      TON_VERSION="$2"
      shift 2
      ;;
    --ton-root)
      TON_ROOT="$2"
      shift 2
      ;;
    --ton-control-port)
      TON_CONTROL_PORT="$2"
      shift 2
      ;;
    --ton-adnl-ip)
      TON_ADNL_IP="$2"
      shift 2
      ;;
    --ton-adnl-port)
      TON_ADNL_PORT="$2"
      shift 2
      ;;
    --tonapi-api-key)
      TONAPI_API_KEY="$2"
      shift 2
      ;;
    --ton-ssh-host)
      TON_SSH_HOST="$2"
      shift 2
      ;;
    --ton-ssh-port)
      TON_SSH_PORT="$2"
      shift 2
      ;;
    --daemon-cli-key-path)
      TON_DAEMON_CLI_KEY_PATH="$2"
      shift 2
      ;;
    --daemon-server-pub)
      TON_DAEMON_SERVER_PUB_PATH="$2"
      shift 2
      ;;
    --remote-base-dir)
      TON_REMOTE_BASE_DIR="$2"
      shift 2
      ;;
    --remote-bag-source-dir)
      TON_REMOTE_BAG_SOURCE_DIR="$2"
      shift 2
      ;;
    --remote-delete-allowed-dirs)
      TON_REMOTE_DELETE_ALLOWED_DIRS="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="1"
      shift
      ;;
    --skip-node-install)
      INSTALL_NODE="0"
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

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This bootstrap is experimental and has only been tested on Ubuntu so far." >&2
  echo "It currently expects an apt-based system and does not support this host." >&2
  exit 1
fi

case "$BOOTSTRAP_MODE" in
  auto|full|ui-only)
    ;;
  *)
    echo "Invalid mode: $BOOTSTRAP_MODE" >&2
    usage
    exit 1
    ;;
esac

APP_DIR="$(cd "$APP_DIR" && pwd)"
if [[ -z "$APP_USER" ]]; then
  if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    APP_USER="$SUDO_USER"
  else
    APP_USER="$(stat -c '%U' "$APP_DIR")"
  fi
fi

APP_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"
if [[ -z "$APP_HOME" ]]; then
  echo "Could not determine the home directory for user $APP_USER." >&2
  exit 1
fi

TON_SOURCE_DIR="${TON_SOURCE_DIR:-$TON_ROOT/src/ton-$TON_VERSION}"
TON_BIN_DIR="$TON_ROOT/bin"
TON_DB_DIR="$TON_ROOT/db"
TON_UPLOADS_DIR_FULL="$TON_ROOT/uploads"
TON_BAG_SOURCES_DIR_FULL="$TON_ROOT/bag-sources"
TON_TEST_OUTPUT_DIR="$TON_ROOT/test-output"
TON_GLOBAL_CONFIG_PATH="$TON_ROOT/global.config.json"
APP_ENV_PATH="$APP_DIR/.env.local"
SSH_KEY_PATH="$APP_HOME/.ssh/ton-bagman-localhost"
SSH_KNOWN_HOSTS_PATH="$APP_HOME/.ssh/known_hosts"
SSH_AUTHORIZED_KEYS_PATH="$APP_HOME/.ssh/authorized_keys"
NODE_MAJOR_REQUIRED=20
FULL_MODE_ACTIVE=0
EXISTING_STORAGE_DETECTED=0
EXISTING_STORAGE_REASONS=()
EXISTING_STORAGE_SERVICE=""
MANIFEST_PATH="$TON_ROOT/ton-bagman-bootstrap.json"
TEMPLATE_DIR="$APP_DIR/deploy"
TON_SERVICE_TEMPLATE="$TEMPLATE_DIR/ton-storage.service.tpl"
APP_SERVICE_TEMPLATE="$TEMPLATE_DIR/ton-bagman.service.tpl"
TON_SERVICE_PATH="/etc/systemd/system/ton-storage.service"
APP_SERVICE_PATH="/etc/systemd/system/ton-bagman.service"
HEALTHCHECKS_COMPLETED=0

mkdir -p "${BOOTSTRAP_LOG_PATH%/*}" 2>/dev/null || true
if [[ -z "$BOOTSTRAP_LOG_PATH" ]]; then
  BOOTSTRAP_LOG_PATH="/tmp/ton-bagman-bootstrap-$(date +%Y%m%d%H%M%S).log"
fi
exec > >(tee -a "$BOOTSTRAP_LOG_PATH") 2>&1

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

run_cmd() {
  if [[ "$DRY_RUN" == "1" ]]; then
    log "[dry-run] $*"
    return 0
  fi
  eval "$*"
}

run_as_app_user() {
  if [[ "$DRY_RUN" == "1" ]]; then
    log "[dry-run as $APP_USER] $*"
    return 0
  fi
  sudo -u "$APP_USER" -H bash -lc "$*"
}

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "Required file is missing: $path" >&2
    exit 1
  fi
}

escape_sed() {
  printf '%s' "$1" | sed 's/[\/&]/\\&/g'
}

render_template() {
  local template_path="$1"
  local output_path="$2"
  shift 2
  local rendered
  rendered="$(cat "$template_path")"

  while [[ $# -gt 1 ]]; do
    local key="$1"
    local value="$2"
    rendered="$(printf '%s' "$rendered" | sed "s/__${key}__/$(escape_sed "$value")/g")"
    shift 2
  done

  if [[ "$DRY_RUN" == "1" ]]; then
    log "[dry-run] render template $template_path -> $output_path"
    return 0
  fi

  printf '%s\n' "$rendered" > "$output_path"
}

ensure_packages() {
  log "Installing system packages"
  run_cmd "apt-get update"
  run_cmd "apt-get install -y build-essential ca-certificates cmake curl git libmicrohttpd-dev libsodium-dev libsecp256k1-dev ninja-build openssh-client openssh-server zlib1g-dev"
}

ensure_node() {
  if [[ "$INSTALL_NODE" != "1" ]]; then
    return
  fi

  local current_major=""
  if command -v node >/dev/null 2>&1; then
    current_major="$(node -p 'process.versions.node.split(".")[0]')"
  fi

  if [[ -n "$current_major" && "$current_major" -ge "$NODE_MAJOR_REQUIRED" ]]; then
    log "Node.js $current_major already satisfies the requirement"
    return
  fi

  log "Installing Node.js ${NODE_MAJOR_REQUIRED}.x"
  run_cmd "curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR_REQUIRED}.x | bash -"
  run_cmd "apt-get install -y nodejs"
}

ensure_llvm() {
  if command -v clang-16 >/dev/null 2>&1; then
    return
  fi

  log "Installing LLVM 16 as required by the official TON Ubuntu build guide"

  if apt-cache show clang-16 >/dev/null 2>&1; then
    log "Using native apt packages for LLVM 16"
    run_cmd "apt-get install -y clang-16 lld-16 llvm-16 llvm-16-dev"
    return
  fi

  log "Native LLVM 16 packages were not available; falling back to apt.llvm.org"
  run_cmd "curl -fsSL https://apt.llvm.org/llvm.sh -o /tmp/llvm.sh"
  run_cmd "chmod +x /tmp/llvm.sh"
  run_cmd "/tmp/llvm.sh 16 all"
}

ensure_sshd() {
  log "Ensuring sshd is enabled"
  if systemctl list-unit-files ssh.service >/dev/null 2>&1; then
    run_cmd "systemctl enable --now ssh"
    return
  fi

  run_cmd "systemctl enable --now sshd"
}

detect_adnl_ip() {
  if [[ -n "$TON_ADNL_IP" ]]; then
    return
  fi

  TON_ADNL_IP="$(hostname -I | awk '{for (i = 1; i <= NF; i++) if ($i != "127.0.0.1") {print $i; exit}}')"
  if [[ -z "$TON_ADNL_IP" ]]; then
    TON_ADNL_IP="127.0.0.1"
  fi
}

add_existing_storage_reason() {
  EXISTING_STORAGE_DETECTED=1
  EXISTING_STORAGE_REASONS+=("$1")
}

detect_existing_storage() {
  EXISTING_STORAGE_DETECTED=0
  EXISTING_STORAGE_REASONS=()
  EXISTING_STORAGE_SERVICE=""

  if command -v storage-daemon >/dev/null 2>&1; then
    add_existing_storage_reason "found storage-daemon at $(command -v storage-daemon)"
  fi

  if command -v storage-daemon-cli >/dev/null 2>&1; then
    add_existing_storage_reason "found storage-daemon-cli at $(command -v storage-daemon-cli)"
  fi

  if systemctl list-unit-files ton-storage.service >/dev/null 2>&1; then
    EXISTING_STORAGE_SERVICE="ton-storage.service"
    add_existing_storage_reason "found existing ton-storage.service"
  elif systemctl list-unit-files storage-daemon.service >/dev/null 2>&1; then
    EXISTING_STORAGE_SERVICE="storage-daemon.service"
    add_existing_storage_reason "found existing storage-daemon.service"
  fi

  if [[ -d "$TON_DB_DIR" ]]; then
    add_existing_storage_reason "found existing TON data dir at $TON_DB_DIR"
  fi
}

resolve_bootstrap_mode() {
  detect_existing_storage

  if [[ "$BOOTSTRAP_MODE" == "auto" ]]; then
    if [[ "$EXISTING_STORAGE_DETECTED" -eq 1 ]]; then
      BOOTSTRAP_MODE="ui-only"
      log "Detected an existing TON Storage install; switching auto mode to ui-only"
    else
      BOOTSTRAP_MODE="full"
      log "No existing TON Storage install detected; switching auto mode to full"
    fi
  fi

  if [[ "$BOOTSTRAP_MODE" == "full" && "$EXISTING_STORAGE_DETECTED" -eq 1 ]]; then
    echo "Refusing to run full mode because an existing TON Storage install was detected:" >&2
    printf ' - %s\n' "${EXISTING_STORAGE_REASONS[@]}" >&2
    echo "Use --mode ui-only if you want to keep that install and only add the UI." >&2
    exit 1
  fi

  if [[ "$BOOTSTRAP_MODE" == "full" ]]; then
    FULL_MODE_ACTIVE=1
  fi
}

prepare_directories() {
  log "Preparing TON Storage directories under $TON_ROOT"
  run_cmd "install -d -m 0755 -o '$APP_USER' -g '$APP_USER' '$TON_ROOT' '$TON_BIN_DIR' '$TON_DB_DIR' '$TON_UPLOADS_DIR_FULL' '$TON_BAG_SOURCES_DIR_FULL' '$TON_TEST_OUTPUT_DIR' '$(dirname "$TON_SOURCE_DIR")'"
}

checkout_ton_source() {
  log "Fetching official TON source at $TON_VERSION"
  if [[ ! -d "$TON_SOURCE_DIR/.git" ]]; then
    run_as_app_user "git clone --branch '$TON_VERSION' --depth 1 --recurse-submodules '$TON_REPO_URL' '$TON_SOURCE_DIR'"
  else
    run_as_app_user "git -C '$TON_SOURCE_DIR' fetch --tags --depth 1 origin '$TON_VERSION'"
    run_as_app_user "git -C '$TON_SOURCE_DIR' checkout '$TON_VERSION'"
    run_as_app_user "git -C '$TON_SOURCE_DIR' submodule update --init --recursive"
  fi
}

build_ton_storage() {
  log "Building storage-daemon and storage-daemon-cli from official TON source"
  run_as_app_user "set -euo pipefail && cd '$TON_SOURCE_DIR' && rm -rf build && cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release && cmake --build build --target storage-daemon storage-daemon-cli"
  run_cmd "install -m 0755 -o root -g root '$TON_SOURCE_DIR/build/storage/storage-daemon/storage-daemon' '$TON_BIN_DIR/storage-daemon'"
  run_cmd "install -m 0755 -o root -g root '$TON_SOURCE_DIR/build/storage/storage-daemon/storage-daemon-cli' '$TON_BIN_DIR/storage-daemon-cli'"
  run_cmd "ln -sf '$TON_BIN_DIR/storage-daemon' /usr/local/bin/storage-daemon"
  run_cmd "ln -sf '$TON_BIN_DIR/storage-daemon-cli' /usr/local/bin/storage-daemon-cli"
}

download_global_config() {
  log "Downloading official TON global config"
  run_cmd "curl -fsSL '$TON_GLOBAL_CONFIG_URL' -o '$TON_GLOBAL_CONFIG_PATH'"
  run_cmd "chown '$APP_USER:$APP_USER' '$TON_GLOBAL_CONFIG_PATH'"
  run_cmd "chmod 0644 '$TON_GLOBAL_CONFIG_PATH'"
}

setup_local_ssh_key() {
  log "Preparing localhost SSH access for the app user"
  run_cmd "install -d -m 0700 -o '$APP_USER' -g '$APP_USER' '$APP_HOME/.ssh'"

  if [[ ! -f "$SSH_KEY_PATH" ]]; then
    run_as_app_user "ssh-keygen -t ed25519 -N '' -f '$SSH_KEY_PATH'"
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    log "[dry-run] would ensure localhost SSH key authorization for $APP_USER"
    return
  fi

  local public_key
  public_key="$(cat "$SSH_KEY_PATH.pub")"
  touch "$SSH_AUTHORIZED_KEYS_PATH"
  chown "$APP_USER:$APP_USER" "$SSH_AUTHORIZED_KEYS_PATH"
  chmod 0600 "$SSH_AUTHORIZED_KEYS_PATH"

  if ! grep -Fqx "$public_key" "$SSH_AUTHORIZED_KEYS_PATH"; then
    printf '%s\n' "$public_key" >> "$SSH_AUTHORIZED_KEYS_PATH"
  fi

  touch "$SSH_KNOWN_HOSTS_PATH"
  chown "$APP_USER:$APP_USER" "$SSH_KNOWN_HOSTS_PATH"
  chmod 0644 "$SSH_KNOWN_HOSTS_PATH"

  local keyscan_output=""
  keyscan_output="$(ssh-keyscan -p "$TON_SSH_PORT" -H "$TON_SSH_HOST" 2>/dev/null || true)"
  if [[ -n "$keyscan_output" ]]; then
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      if ! grep -Fqx "$line" "$SSH_KNOWN_HOSTS_PATH"; then
        printf '%s\n' "$line" >> "$SSH_KNOWN_HOSTS_PATH"
      fi
    done <<<"$keyscan_output"
  fi
}

write_storage_service() {
  log "Writing ton-storage.service from tracked template"
  require_file "$TON_SERVICE_TEMPLATE"
  render_template \
    "$TON_SERVICE_TEMPLATE" \
    "$TON_SERVICE_PATH" \
    APP_USER "$APP_USER" \
    TON_ROOT "$TON_ROOT" \
    TON_BIN_DIR "$TON_BIN_DIR" \
    TON_GLOBAL_CONFIG_PATH "$TON_GLOBAL_CONFIG_PATH" \
    TON_ADNL_IP "$TON_ADNL_IP" \
    TON_ADNL_PORT "$TON_ADNL_PORT" \
    TON_CONTROL_PORT "$TON_CONTROL_PORT" \
    TON_DB_DIR "$TON_DB_DIR"
}

wait_for_cli_keys() {
  log "Waiting for storage-daemon to generate CLI keys"
  local client_key="$TON_DB_DIR/cli-keys/client"
  local server_pub="$TON_DB_DIR/cli-keys/server.pub"
  local attempt

  for attempt in $(seq 1 30); do
    if [[ -f "$client_key" && -f "$server_pub" ]]; then
      run_cmd "chown -R '$APP_USER:$APP_USER' '$TON_DB_DIR'"
      return
    fi
    sleep 1
  done

  echo "storage-daemon did not generate cli keys under $TON_DB_DIR/cli-keys in time." >&2
  exit 1
}

pick_first_existing_path() {
  local candidate
  for candidate in "$@"; do
    if [[ -n "$candidate" && -e "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

detect_existing_runtime_paths() {
  if [[ -z "$TON_DAEMON_CLI_KEY_PATH" ]]; then
    TON_DAEMON_CLI_KEY_PATH="$(
      pick_first_existing_path \
        /opt/ton-storage/db/cli-keys/client \
        /var/ton-work/db/cli-keys/client \
        "$TON_ROOT/db/cli-keys/client" || true
    )"
  fi

  if [[ -z "$TON_DAEMON_SERVER_PUB_PATH" ]]; then
    TON_DAEMON_SERVER_PUB_PATH="$(
      pick_first_existing_path \
        /opt/ton-storage/db/cli-keys/server.pub \
        /var/ton-work/db/cli-keys/server.pub \
        "$TON_ROOT/db/cli-keys/server.pub" || true
    )"
  fi

  if [[ -z "$TON_REMOTE_BASE_DIR" ]]; then
    TON_REMOTE_BASE_DIR="$(
      pick_first_existing_path \
        /opt/ton-storage/uploads \
        /var/lib/ton-storage \
        "$TON_ROOT/uploads" || true
    )"
  fi

  if [[ -z "$TON_REMOTE_BAG_SOURCE_DIR" ]]; then
    TON_REMOTE_BAG_SOURCE_DIR="$(
      pick_first_existing_path \
        /opt/ton-storage/bag-sources \
        /var/lib/bag-sources \
        "$TON_ROOT/bag-sources" || true
    )"
  fi

  if [[ -z "$TON_REMOTE_DELETE_ALLOWED_DIRS" && -n "$TON_REMOTE_BASE_DIR" ]]; then
    TON_REMOTE_DELETE_ALLOWED_DIRS="$TON_REMOTE_BASE_DIR"
  fi
}

validate_ui_only_inputs() {
  detect_existing_runtime_paths

  if ! command -v storage-daemon >/dev/null 2>&1; then
    echo "ui-only mode requires storage-daemon to already be installed and on PATH." >&2
    exit 1
  fi

  if ! command -v storage-daemon-cli >/dev/null 2>&1; then
    echo "ui-only mode requires storage-daemon-cli to already be installed and on PATH." >&2
    exit 1
  fi

  if [[ -z "$TON_DAEMON_CLI_KEY_PATH" || ! -f "$TON_DAEMON_CLI_KEY_PATH" ]]; then
    echo "Could not find an existing TON cli client key. Pass --daemon-cli-key-path." >&2
    exit 1
  fi

  if [[ -z "$TON_DAEMON_SERVER_PUB_PATH" || ! -f "$TON_DAEMON_SERVER_PUB_PATH" ]]; then
    echo "Could not find an existing TON cli server pub key. Pass --daemon-server-pub." >&2
    exit 1
  fi

  if [[ -z "$TON_REMOTE_BASE_DIR" || ! -d "$TON_REMOTE_BASE_DIR" ]]; then
    echo "Could not find an existing TON uploads directory. Pass --remote-base-dir." >&2
    exit 1
  fi

  if [[ -z "$TON_REMOTE_BAG_SOURCE_DIR" || ! -d "$TON_REMOTE_BAG_SOURCE_DIR" ]]; then
    echo "Could not find an existing TON bag source directory. Pass --remote-bag-source-dir." >&2
    exit 1
  fi
}

write_app_env() {
  log "Writing $APP_ENV_PATH"
  if [[ -f "$APP_ENV_PATH" && "$DRY_RUN" != "1" ]]; then
    cp "$APP_ENV_PATH" "$APP_ENV_PATH.backup.$(date +%Y%m%d%H%M%S)"
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    log "[dry-run] would write $APP_ENV_PATH"
    return
  fi

  cat > "$APP_ENV_PATH" <<EOF
NODE_ENV=production

TON_SSH_HOST=$TON_SSH_HOST
TON_SSH_PORT=$TON_SSH_PORT
TON_SSH_USER=$APP_USER
TON_SSH_AUTH_MODE=key_path
TON_SSH_PRIVATE_KEY_PATH=$SSH_KEY_PATH
TON_SSH_KNOWN_HOSTS_PATH=$SSH_KNOWN_HOSTS_PATH

TON_DAEMON_CONTROL_ADDRESS=127.0.0.1:$TON_CONTROL_PORT
TON_DAEMON_CLI_KEY_PATH=$TON_DAEMON_CLI_KEY_PATH
TON_DAEMON_SERVER_PUB_PATH=$TON_DAEMON_SERVER_PUB_PATH

TON_REMOTE_BASE_DIR=$TON_REMOTE_BASE_DIR
TON_REMOTE_BAG_SOURCE_DIR=$TON_REMOTE_BAG_SOURCE_DIR
TON_REMOTE_DELETE_ALLOWED_DIRS=$TON_REMOTE_DELETE_ALLOWED_DIRS
TON_LOCAL_STAGING_DIR=staging

TONAPI_BASE_URL=https://tonapi.io
TONAPI_API_KEY=$TONAPI_API_KEY
EOF

  chown "$APP_USER:$APP_USER" "$APP_ENV_PATH"
  chmod 0600 "$APP_ENV_PATH"
}

install_app_dependencies() {
  log "Installing app dependencies and building the Next.js app"
  if [[ -f "$APP_DIR/package-lock.json" ]]; then
    run_as_app_user "cd '$APP_DIR' && npm ci"
  else
    run_as_app_user "cd '$APP_DIR' && npm install"
  fi

  run_as_app_user "cd '$APP_DIR' && npm run build"
}

write_app_service() {
  log "Writing ton-bagman.service from tracked template"
  require_file "$APP_SERVICE_TEMPLATE"

  local service_after="ssh.service sshd.service"
  local service_requirement=""
  if [[ "$FULL_MODE_ACTIVE" -eq 1 ]]; then
    service_after="ton-storage.service ssh.service sshd.service"
    service_requirement="Requires=ton-storage.service"
  fi

  render_template \
    "$APP_SERVICE_TEMPLATE" \
    "$APP_SERVICE_PATH" \
    APP_USER "$APP_USER" \
    APP_DIR "$APP_DIR" \
    APP_PORT "$APP_PORT" \
    SERVICE_AFTER "$service_after" \
    SERVICE_REQUIREMENT "$service_requirement"
}

start_storage_service_if_needed() {
  if [[ "$FULL_MODE_ACTIVE" -ne 1 ]]; then
    return
  fi

  log "Reloading systemd and starting ton-storage.service"
  run_cmd "systemctl daemon-reload"
  run_cmd "systemctl enable --now ton-storage.service"

  if [[ "$DRY_RUN" != "1" ]]; then
    wait_for_cli_keys
  fi

  TON_DAEMON_CLI_KEY_PATH="$TON_DB_DIR/cli-keys/client"
  TON_DAEMON_SERVER_PUB_PATH="$TON_DB_DIR/cli-keys/server.pub"
  TON_REMOTE_BASE_DIR="$TON_UPLOADS_DIR_FULL"
  TON_REMOTE_BAG_SOURCE_DIR="$TON_BAG_SOURCES_DIR_FULL"
  TON_REMOTE_DELETE_ALLOWED_DIRS="$TON_UPLOADS_DIR_FULL"
}

start_app_service() {
  log "Reloading systemd and starting ton-bagman.service"
  run_cmd "systemctl daemon-reload"
  run_cmd "systemctl enable --now ton-bagman.service"
}

run_post_install_checks() {
  if [[ "$DRY_RUN" == "1" ]]; then
    log "[dry-run] skipping post-install health checks"
    return
  fi

  log "Running post-install health checks"

  if [[ "$FULL_MODE_ACTIVE" -eq 1 ]]; then
    systemctl is-active --quiet ton-storage.service
    command -v storage-daemon >/dev/null 2>&1
    command -v storage-daemon-cli >/dev/null 2>&1
  fi

  systemctl is-active --quiet ton-bagman.service
  run_as_app_user "ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile='$SSH_KNOWN_HOSTS_PATH' -i '$SSH_KEY_PATH' -p '$TON_SSH_PORT' '$APP_USER@$TON_SSH_HOST' 'echo SSH_OK' | grep -q SSH_OK"
  curl -fsS "http://127.0.0.1:$APP_PORT/api/health" >/dev/null
  curl -fsS -X POST "http://127.0.0.1:$APP_PORT/api/connection/test" >/dev/null
  HEALTHCHECKS_COMPLETED=1
}

write_manifest() {
  log "Writing bootstrap manifest to $MANIFEST_PATH"
  if [[ "$DRY_RUN" == "1" ]]; then
    log "[dry-run] would write manifest to $MANIFEST_PATH"
    return
  fi

  run_cmd "install -d -m 0755 -o '$APP_USER' -g '$APP_USER' '$TON_ROOT'"
  cat > "$MANIFEST_PATH" <<EOF
{
  "written_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "bootstrap_mode": "$BOOTSTRAP_MODE",
  "full_mode": $([[ "$FULL_MODE_ACTIVE" -eq 1 ]] && echo true || echo false),
  "dry_run": false,
  "ton_version": "$TON_VERSION",
  "ton_root": "$TON_ROOT",
  "app_dir": "$APP_DIR",
  "app_user": "$APP_USER",
  "app_port": "$APP_PORT",
  "app_env_path": "$APP_ENV_PATH",
  "ssh_key_path": "$SSH_KEY_PATH",
  "ssh_known_hosts_path": "$SSH_KNOWN_HOSTS_PATH",
  "ton_service_installed": $([[ "$FULL_MODE_ACTIVE" -eq 1 ]] && echo true || echo false),
  "app_service_installed": true,
  "ton_service_path": "$TON_SERVICE_PATH",
  "app_service_path": "$APP_SERVICE_PATH",
  "ton_control_port": "$TON_CONTROL_PORT",
  "ton_adnl_port": "$TON_ADNL_PORT",
  "ton_ssh_host": "$TON_SSH_HOST",
  "ton_ssh_port": "$TON_SSH_PORT",
  "ton_daemon_cli_key_path": "$TON_DAEMON_CLI_KEY_PATH",
  "ton_daemon_server_pub_path": "$TON_DAEMON_SERVER_PUB_PATH",
  "ton_remote_base_dir": "$TON_REMOTE_BASE_DIR",
  "ton_remote_bag_source_dir": "$TON_REMOTE_BAG_SOURCE_DIR",
  "ton_remote_delete_allowed_dirs": "$TON_REMOTE_DELETE_ALLOWED_DIRS",
  "healthchecks_completed": $([[ "$HEALTHCHECKS_COMPLETED" -eq 1 ]] && echo true || echo false),
  "bootstrap_log_path": "$BOOTSTRAP_LOG_PATH"
}
EOF
  chown "$APP_USER:$APP_USER" "$MANIFEST_PATH"
  chmod 0644 "$MANIFEST_PATH"
}

print_summary() {
  cat <<EOF

Bootstrap complete.

Warning: this bootstrap is experimental, should be used at your own risk,
and has only been tested on Ubuntu so far.

Resolved mode: $BOOTSTRAP_MODE
Pinned TON version: $TON_VERSION
Dry run: $([[ "$DRY_RUN" == "1" ]] && echo yes || echo no)
App directory: $APP_DIR
App user: $APP_USER
App URL: http://127.0.0.1:$APP_PORT
SSH target: $TON_SSH_HOST:$TON_SSH_PORT
Remote uploads dir: $TON_REMOTE_BASE_DIR
Remote bag source dir: $TON_REMOTE_BAG_SOURCE_DIR
Bootstrap log: $BOOTSTRAP_LOG_PATH
Manifest: $MANIFEST_PATH

Useful commands:
  systemctl status ton-bagman.service
  journalctl -u ton-bagman.service -f
  sudo ./scripts/uninstall-bootstrap.sh --manifest '$MANIFEST_PATH'
EOF

  if [[ "$FULL_MODE_ACTIVE" -eq 1 ]]; then
    cat <<EOF
  systemctl status ton-storage.service
  journalctl -u ton-storage.service -f
EOF
  fi

  if [[ "$EXISTING_STORAGE_DETECTED" -eq 1 ]]; then
    cat <<EOF

Detected existing TON Storage signals:
$(printf '  - %s\n' "${EXISTING_STORAGE_REASONS[@]}")
EOF
  fi
}

ensure_packages
ensure_node
ensure_sshd
resolve_bootstrap_mode
setup_local_ssh_key

if [[ "$FULL_MODE_ACTIVE" -eq 1 ]]; then
  ensure_llvm
  detect_adnl_ip
  prepare_directories
  checkout_ton_source
  build_ton_storage
  download_global_config
  write_storage_service
  start_storage_service_if_needed
else
  validate_ui_only_inputs
fi

write_app_env
install_app_dependencies
write_app_service
start_app_service
run_post_install_checks
write_manifest
print_summary
