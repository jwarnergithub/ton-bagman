# Deployment

This guide explains how to deploy TON Bagman either onto a fresh host or onto a system where TON Storage is already installed and running.

This is the broad deployment guide.

If you only want the script-driven install and rollback workflow, use [`docs/BOOTSTRAP.md`](./BOOTSTRAP.md).

Everything in this repo is still experimental and should be used at your own risk.

The automated bootstrap flow in this repo has only been tested on Ubuntu.

The manual path below assumes:

- `storage-daemon` is already running
- `storage-daemon-cli` already works
- you already have SSH access to the VPS
- you want TON Bagman to talk to that VPS over SSH

## What the app expects

TON Bagman does not install TON Storage for you.

It expects an existing TON Storage setup with:

- a working control port for `storage-daemon`, usually `127.0.0.1:5555`
- working CLI keys for `storage-daemon-cli`
- remote folders for uploads and bag source files

At minimum, the app needs to be able to:

- SSH into the VPS
- run `storage-daemon-cli`
- read the CLI key files it is configured to use
- read and write the remote folders used for uploads and bag sources

## Recommended remote folders

These are the folders the app works well with:

- `/opt/ton-storage/uploads`
- `/opt/ton-storage/bag-sources`
- `/opt/ton-storage/test-output`

If they do not exist yet, create them on the VPS.

## Strongly recommended: run your own liteserver

It is highly recommended to run your own liteserver for TON Storage work.

Client and provider contracts have several failure points that can be difficult to detect when you rely only on public liteservers. A personal liteserver usually makes it easier to:

- read provider settings reliably
- create storage contract requests
- see when a provider has activated a contract
- notice contract state changes
- keep client and provider communication working consistently

The app can still run without your own liteserver, but storage-contract problems are often harder to understand when public liteserver access is unstable.

## Make sure the app can use the daemon CLI keys

The app user must be able to use:

- the daemon CLI client key
- the daemon server public key

If the default daemon key files are root-only, create app-readable copies in a separate folder such as:

- `/opt/ton-storage/app-cli-keys/client`
- `/opt/ton-storage/app-cli-keys/server.pub`

Then point the app at those copied paths in `.env.local`.

## Automated bootstrap

If you want one command that handles both cases, use:

```bash
sudo ./scripts/bootstrap-vps.sh
```

For a bootstrap-focused operator guide, see:

- [`docs/BOOTSTRAP.md`](./BOOTSTRAP.md)

Important notes:

- this bootstrap flow is experimental and should be used at your own risk
- it pins TON to `v2026.03`
- it has only been tested on Ubuntu so far
- it is intentionally opinionated about paths, systemd, localhost SSH, and a same-host deployment
- it writes tracked `systemd` units from `deploy/`
- it writes a bootstrap manifest to `/opt/ton-storage/ton-bagman-bootstrap.json`
- it writes an install log to a timestamped file under `/tmp/`
- it runs post-install health checks unless you use `--dry-run`

Modes:

- `--mode auto`
  Detects an existing TON Storage install. If found, it installs only the UI. Otherwise it installs both TON Storage and the UI.
- `--mode full`
  Installs the pinned TON backend and the UI together on the same host. This mode refuses to continue if it detects an existing TON Storage install.
- `--mode ui-only`
  Installs only the web UI and points it at an existing TON Storage install.

Examples:

```bash
# Preview the detected mode and planned changes without modifying the host
sudo ./scripts/bootstrap-vps.sh --mode auto --dry-run --tonapi-api-key your-tonapi-key

# Fresh host: install TON Storage v2026.03 plus the UI
sudo ./scripts/bootstrap-vps.sh --mode full --tonapi-api-key your-tonapi-key

# Existing TON Storage host: install only the UI
sudo ./scripts/bootstrap-vps.sh --mode ui-only \
  --daemon-cli-key-path /opt/ton-storage/db/cli-keys/client \
  --daemon-server-pub /opt/ton-storage/db/cli-keys/server.pub \
  --remote-base-dir /opt/ton-storage/uploads \
  --remote-bag-source-dir /opt/ton-storage/bag-sources \
  --tonapi-api-key your-tonapi-key

# Let the script detect which path to use
sudo ./scripts/bootstrap-vps.sh --mode auto --tonapi-api-key your-tonapi-key
```

Rollback:

```bash
sudo ./scripts/uninstall-bootstrap.sh --manifest /opt/ton-storage/ton-bagman-bootstrap.json
```

Optional destructive cleanup:

```bash
sudo ./scripts/uninstall-bootstrap.sh \
  --manifest /opt/ton-storage/ton-bagman-bootstrap.json \
  --purge-app-env \
  --purge-ton-data
```

## Manual deployment

Use the manual steps below if you do not want the opinionated bootstrap flow.

## Step 1: get the code onto the machine

Clone the repo:

```bash
git clone <your-private-repo-url>
cd ton-bagman
```

Install dependencies:

```bash
npm install
```

## Step 2: create the environment file

Start from:

```bash
cp .env.example .env.local
```

Then set the values for your setup.

Important: you need to add your own `TONAPI_API_KEY` for the parts of the app that use TonAPI. That can be a free/public TonAPI key or your own paid/personal key.

For production deployments, prefer `TON_SSH_AUTH_MODE=key_path`.

`TON_SSH_AUTH_MODE=agent` is convenient while developing from an interactive shell, but it often fails once the app is started by `systemd`, `pm2`, Docker, or another background service because the Node process may not inherit a working `SSH_AUTH_SOCK`.

### Example `.env.local`

This example assumes:

- the app runs on the same VPS as TON Storage
- SSH uses a local user on that same machine
- the app talks to TON Storage over SSH even though it is on the same host

```env
NODE_ENV=production

TON_SSH_HOST=127.0.0.1
TON_SSH_PORT=22
TON_SSH_USER=your-ssh-user
TON_SSH_AUTH_MODE=key_path
TON_SSH_PRIVATE_KEY_PATH=/home/your-ssh-user/.ssh/id_ed25519
TON_SSH_KNOWN_HOSTS_PATH=/home/your-ssh-user/.ssh/known_hosts

TON_DAEMON_CONTROL_ADDRESS=127.0.0.1:5555
TON_DAEMON_CLI_KEY_PATH=/opt/ton-storage/app-cli-keys/client
TON_DAEMON_SERVER_PUB_PATH=/opt/ton-storage/app-cli-keys/server.pub

TON_REMOTE_BASE_DIR=/opt/ton-storage/uploads
TON_REMOTE_BAG_SOURCE_DIR=/opt/ton-storage/bag-sources
TON_REMOTE_DELETE_ALLOWED_DIRS=/opt/ton-storage/uploads

TON_LOCAL_STAGING_DIR=staging

TONAPI_BASE_URL=https://tonapi.io
TONAPI_API_KEY=your-tonapi-key
```

If the app runs on a different machine, then:

- `TON_SSH_HOST` should be the VPS hostname or public IP
- `TON_SSH_PRIVATE_KEY_PATH` should point to the app host’s local SSH key
- `TON_SSH_KNOWN_HOSTS_PATH` should point to the app host’s local known-hosts file

## Step 3: confirm SSH works

Before starting the app, make sure the configured SSH user can connect and run the TON CLI command path you expect.

At a minimum, verify:

- SSH login works
- `storage-daemon-cli` works
- the configured CLI key paths are readable

## Step 4: build the app

```bash
npm run build
```

## Step 5: start the app

For a simple first deployment:

```bash
npm run start
```

That starts the production web server for the app.

If you want the app to stay up after logout or reboot, run it under something like:

- `systemd`
- `pm2`
- Docker

## Step 6: verify the app

After the app is running, test these in order:

1. open the app
2. open `/api/health`
3. run the connection test from the Safety page
4. check the bag list
5. open a bag detail page
6. check the Providers page
7. open My Provider

If those work, the app is connected correctly.

## If you have not created your TON Storage provider yet

That is fine.

The app does not require you to create a TON Storage provider before deploying the app.

You can deploy the app first and use:

- bag management
- bag creation
- provider browsing
- creating storage contract payment links and QR codes

Then later use `My Provider` to create and manage your TON Storage provider on that VPS.

## Common problems

### The app cannot connect over SSH

Check:

- `TON_SSH_HOST`
- `TON_SSH_PORT`
- `TON_SSH_USER`
- SSH key path or agent setup
- host verification settings

If the app reports `All configured authentication methods failed` and you are using `TON_SSH_AUTH_MODE=agent`, the most common fix is to switch to:

- `TON_SSH_AUTH_MODE=key_path`
- `TON_SSH_PRIVATE_KEY_PATH=/absolute/path/to/a-readable-private-key`
- `TON_SSH_KNOWN_HOSTS_PATH=/absolute/path/to/known_hosts`

### The app connects, but daemon commands fail

Check:

- `TON_DAEMON_CONTROL_ADDRESS`
- `TON_DAEMON_CLI_KEY_PATH`
- `TON_DAEMON_SERVER_PUB_PATH`
- whether those files are readable by the app user

### The app cannot create or move files remotely

Check:

- `TON_REMOTE_BASE_DIR`
- `TON_REMOTE_BAG_SOURCE_DIR`
- remote directory permissions

### Provider features do not work

Check:

- `TONAPI_API_KEY`
- whether TonAPI is reachable
- whether the daemon can reach a healthy liteserver setup

## Updating the deployment

When you make local changes and push them to GitHub:

```bash
git pull origin main
npm install
npm run build
```

Then restart your app process if needed.
