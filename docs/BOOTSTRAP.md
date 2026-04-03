# Bootstrap Guide

This is the narrow guide for the script-driven install and rollback workflow.

If you want the broader deployment picture, manual setup, or environment guidance, use [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md).

This guide is for the repo bootstrap flow in:

- `scripts/bootstrap-vps.sh`
- `scripts/uninstall-bootstrap.sh`

Everything here is experimental, should be used at your own risk, and has only been tested on Ubuntu so far.

## What the bootstrap does

The bootstrap is meant to help with same-host deployments where TON Bagman and TON Storage live on the same VPS.

Depending on mode, it can:

- install the TON Bagman UI
- install pinned TON Storage from official TON release binaries at `v2026.03`
- fall back to an official source build if no supported release binary fits the host
- generate `.env.local`
- create localhost SSH access for the app user
- write `systemd` units from tracked templates in `deploy/`
- run post-install health checks
- write an install manifest and install log

## Modes

### `auto`

Use this when you want the script to decide.

- if TON Storage is already detected, it switches to `ui-only`
- if TON Storage is not detected, it switches to `full`

### `full`

Use this on a fresh host.

It installs:

- TON Storage `v2026.03`
- TON Bagman
- `ton-storage.service`
- `ton-bagman.service`

This mode refuses to continue if it detects an existing TON Storage install.

### `ui-only`

Use this when TON Storage is already installed and you only want the web UI.

It expects:

- `storage-daemon` to already exist
- `storage-daemon-cli` to already exist
- existing CLI key paths
- existing upload and bag-source directories

## Safe first step

Start with a dry run:

```bash
sudo ./scripts/bootstrap-vps.sh --mode auto --dry-run --tonapi-api-key your-tonapi-key
```

That shows the intended path without changing the host.

For agent-driven installs on a fresh VPS, this should usually be the default first step instead of asking for a full manual `.env.local` configuration.

## Common examples

Fresh host:

```bash
sudo ./scripts/bootstrap-vps.sh --mode full --tonapi-api-key your-tonapi-key
```

Existing TON Storage host:

```bash
sudo ./scripts/bootstrap-vps.sh --mode ui-only \
  --daemon-cli-key-path /opt/ton-storage/db/cli-keys/client \
  --daemon-server-pub /opt/ton-storage/db/cli-keys/server.pub \
  --remote-base-dir /opt/ton-storage/uploads \
  --remote-bag-source-dir /opt/ton-storage/bag-sources \
  --tonapi-api-key your-tonapi-key
```

Auto-detect:

```bash
sudo ./scripts/bootstrap-vps.sh --mode auto --tonapi-api-key your-tonapi-key
```

## Files it writes

The bootstrap may create or update:

- `.env.local` in the app checkout
- `/etc/systemd/system/ton-storage.service`
- `/etc/systemd/system/ton-bagman.service`
- `/opt/ton-storage/ton-bagman-bootstrap.json`
- a timestamped install log under `/tmp/`

Tracked templates live in:

- `deploy/ton-storage.service.tpl`
- `deploy/ton-bagman.service.tpl`

## Health checks

When not using `--dry-run`, the bootstrap tries to verify:

- `ton-storage.service` is active in `full` mode
- `ton-bagman.service` is active
- localhost SSH works for the app user
- `http://127.0.0.1:<port>/api/health` responds
- `POST /api/connection/test` responds

## Rollback

Basic rollback:

```bash
sudo ./scripts/uninstall-bootstrap.sh --manifest /opt/ton-storage/ton-bagman-bootstrap.json
```

More destructive cleanup:

```bash
sudo ./scripts/uninstall-bootstrap.sh \
  --manifest /opt/ton-storage/ton-bagman-bootstrap.json \
  --purge-app-env \
  --purge-ton-data
```

Be careful with `--purge-ton-data`. It removes the TON root recorded in the manifest.

## Agent notes

If an agent is asked to install this repo:

- prefer `--mode auto --dry-run` first
- inspect the rendered plan, manifest path, and expected service changes
- do not use `full` mode on a host that already has TON Storage unless the user explicitly wants replacement behavior
- prefer `ui-only` when TON Storage already exists and should be preserved
- if bootstrap behavior changes, keep the scripts, `deploy/*.tpl`, `docs/DEPLOYMENT.md`, and `AGENTS.md` in sync
