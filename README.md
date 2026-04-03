# TON Bagman

TON Bagman is a web app for managing TON Storage through a browser.

This project is experimental and should be used at your own risk.

The bootstrap and deployment flow in this repo has only been tested on Ubuntu so far.

It is meant for people who already have a VPS running `storage-daemon` and `storage-daemon-cli` and want an easier way to work with bags, storage contracts, and provider settings without doing everything by hand in the terminal.

## What it helps you do

With TON Bagman, you can:

- see the bags your daemon already knows about
- open a bag and inspect its files, metadata, and peers
- upload files from your browser and turn them into bags
- add existing bags by hash or metadata file
- pause, resume, export, recover, and remove bags
- browse public storage providers with pricing and recent activity
- start and cancel storage contracts through Tonkeeper links and QR codes
- run your own TON Storage provider from the same web interface
- update provider settings, capacity limits, and accepted contracts

## What the app is trying to accomplish

The main goals are:

1. make TON Storage easier to use from a normal web interface
2. make bag and contract actions easier to understand
3. make self-hosted provider management practical without custom scripts

The app keeps sensitive work on the server. The browser shows the interface, but SSH access, TON Storage access, and command execution stay on the server side.

## Main areas of the app

### Bag Management

The bag pages let you:

- browse bags already known to the daemon
- inspect bag IDs, descriptions, file lists, and size
- inspect peers currently visible for a bag
- export metadata
- pause or resume bag upload and download
- remove a bag
- recover tracked bag source files back into uploads

### Bag Creation

The bag creation flow lets you:

- upload files from your browser into a local temporary folder
- transfer those files to the VPS
- create bags from files or folders already on the VPS
- add an existing bag by hash
- add an existing bag by metadata file

### Providers

The providers page shows public providers returned by TonAPI, including:

- provider contract address
- whether the provider accepts new contracts
- price in TON per MB per day, plus an informational USD estimate based on current TON market data
- time between storage proofs
- minimum and maximum file size
- last activity

It also lets you choose a provider, pick one of your bags, and jump directly into the storage-contract flow for that bag.

### My Provider

The `My Provider` page is for creating and running a TON Storage provider on the current VPS.

It can:

- deploy a new TON Storage provider
- import a TON Storage provider key when moving or recovering a TON Storage provider that was already created elsewhere
- show whether the daemon is connected to the TON Storage provider on this VPS
- show provider balance and last activity
- update provider pricing and limits, including an informational USD estimate for the current TON rate
- turn accepting new contracts on or off
- show accepted contracts
- close accepted contracts

### Safety

The safety page gives you:

- SSH connection testing
- a page that shows the settings the app is currently using
- remote deletion tools limited to approved folders

## Storage contract tools

The bag detail page includes storage contract tools for that bag.

You can:

- discover recent contracts for that bag by wallet address
- create a Tonkeeper start link or QR code
- create a Tonkeeper cancel link or QR code
- arrive from the providers page with the provider already filled in

The app keeps two separate ideas visible:

- the on-chain storage contract
- the live peers your daemon currently sees

Those are not always the same thing at the same time.

## Deploying it

If you want to set this up on a server, see:

- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)
- [`docs/BOOTSTRAP.md`](./docs/BOOTSTRAP.md)

Use `docs/DEPLOYMENT.md` for the broader deployment guide, including manual setup and app expectations.

Use `docs/BOOTSTRAP.md` for the narrower automated install and rollback flow built around the repo scripts.

That guide assumes:

- you already have a VPS
- TON Storage is already installed and running there
- you want to connect this app to that VPS over SSH
- you may or may not have created your TON Storage provider yet

The automated bootstrap path is experimental, should be used at your own risk, and has only been tested on Ubuntu.

It supports three install modes:

- `auto`
  Detect an existing TON Storage install and install only the UI if one is found
- `full`
  Install pinned TON Storage `v2026.03` plus the UI on the same host
- `ui-only`
  Install only the UI and point it at an existing TON Storage setup

The bootstrap also includes:

- `--dry-run` to preview changes before touching the host
- binary-first TON installation with source-build fallback
- tracked `systemd` templates under `deploy/`
- a bootstrap manifest and install log for auditability
- post-install health checks for SSH, the app, and the connection-test route
- a rollback helper at `scripts/uninstall-bootstrap.sh`

## Liteserver recommendation

It is highly recommended to run your own liteserver for TON Storage work.

Client and provider contracts can fail or get stuck in ways that are hard to notice when you depend only on public liteservers. A personal liteserver gives you a more stable path for:

- reading provider settings
- creating storage contract requests
- watching provider activation
- seeing contract state changes
- keeping client and provider communication healthy

The app can still work without your own liteserver, but contract creation and provider activity can be much harder to diagnose when public liteserver access is flaky.

## Requirements

You need:

- Node.js 20 or newer
- npm
- a VPS with TON Storage already installed and running
- working `storage-daemon`
- working `storage-daemon-cli`
- SSH access from the app host to the TON VPS

The app does not install TON Storage for you.

## Local development

Install dependencies:

```bash
npm install
```

Run the main checks:

```bash
npm test
npm run lint
npm run build
```

Start the development server:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Then open:

```text
http://127.0.0.1:3000
```

## Environment setup

Start from [`/.env.example`](./.env.example) and copy it to `.env.local`.

Required base settings:

- `TON_SSH_HOST`
- `TON_SSH_PORT`
- `TON_SSH_USER`
- `TON_REMOTE_BASE_DIR`
- `TON_REMOTE_BAG_SOURCE_DIR`
- `TON_LOCAL_STAGING_DIR`

SSH auth modes:

- `TON_SSH_AUTH_MODE=agent`
  Requires `SSH_AUTH_SOCK`
  Best for local development where the app inherits your shell's SSH agent
- `TON_SSH_AUTH_MODE=key_path`
  Requires `TON_SSH_PRIVATE_KEY_PATH`
  Recommended for production deployments and background services
- `TON_SSH_AUTH_MODE=inline_key`
  Requires `TON_SSH_PRIVATE_KEY`

Host verification:

- set `TON_SSH_HOST_FINGERPRINT`, `TON_SSH_KNOWN_HOSTS_PATH`, or both
- in production, host verification is required

Production note:

- if the app is started by `systemd`, `pm2`, Docker, or another background service, do not assume your interactive SSH agent is available to the app process
- if uploads or connection tests fail with `All configured authentication methods failed`, switch from `TON_SSH_AUTH_MODE=agent` to `TON_SSH_AUTH_MODE=key_path` and point `TON_SSH_PRIVATE_KEY_PATH` at a readable deploy key on the app host

TON Storage settings that can be changed:

- `TON_DAEMON_CONTROL_ADDRESS`
- `TON_DAEMON_CLI_KEY_PATH`
- `TON_DAEMON_SERVER_PUB_PATH`

TonAPI settings:

- `TONAPI_API_KEY`
- `TONAPI_BASE_URL`

You need to provide your own TonAPI key for TonAPI-backed features in this app. That can be a free/public TonAPI key or your own paid/personal key.

Remote file handling:

- `TON_REMOTE_BASE_DIR`
  Remote upload and temporary work folder
- `TON_REMOTE_BAG_SOURCE_DIR`
  Remote bag-source area used before bag creation
- `TON_REMOTE_DELETE_ALLOWED_DIRS`
  Comma-separated list of remote folders where deletion is allowed

Local temporary upload folder:

- `TON_LOCAL_STAGING_DIR`
  Must be a relative subdirectory under `.ton-storage/`

Recommended value:

- `staging`

## Testing

Default test runs do not require a live VPS.

There is also a live parser harness in:

- [`tests/integration/ton-parser-live.test.ts`](./tests/integration/ton-parser-live.test.ts)

## Current limitations

This is still an early version, so a few things are intentionally simple:

- wallet work uses Tonkeeper links and QR codes, not TonConnect
- contract discovery is based on wallet address and recent TonAPI trace history
- provider discovery depends on TonAPI
- TON Storage behavior can still vary between different daemon builds
- contract activation still depends on real provider-side download and peer discovery

## More technical docs

For more detail, see:

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- [`docs/SECURITY_MODEL.md`](./docs/SECURITY_MODEL.md)
- [`docs/TON_COMMAND_MAP.md`](./docs/TON_COMMAND_MAP.md)
