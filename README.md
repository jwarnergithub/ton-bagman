# TON Storage Manager

Web-based TON Storage manager, built with Next.js App Router and TypeScript.

## Current status

This repo now includes a working first-pass vertical slice:

- validated runtime config for one VPS
- TonAPI-backed read-only storage provider discovery page
- "My Provider" management page for initializing and operating the local provider daemon
- server-only SSH command execution and SFTP uploads
- TON Storage command builder, parser, and service layer
- API routes for health, connection test, bag reads, uploads, transfer, and key bag mutations
- filesystem-backed local upload staging
- server-rendered management screens for dashboard, bags, bag details, uploads, and settings
- bag-detail storage contract panel that can:
  - discover recent bag-specific storage contracts by wallet address through TonAPI
  - generate Tonkeeper start links from `new-contract-message`
  - generate Tonkeeper cancel links for discovered storage contracts
- provider-management page that can:
  - import a provider private key from a remote file path
  - deploy and initialize a provider contract through verified daemon commands
  - display current provider params, capacity limits, on-chain balance, and last activity
  - toggle whether the provider accepts new contracts
  - inspect accepted contracts with bag IDs and estimated time left
  - close accepted contracts through the provider daemon with explicit confirmation
- guarded remote deletion with allowlisted path checks and audit logging
- verified TON bag removal through the daemon `remove <bag> [--remove-files]` command

## Architecture

- `app/`: server-first pages plus route handlers
- `src/components/`: small UI components and client-only form widgets where needed
- `src/server/config/`: env parsing and runtime config
- `src/server/ssh/`: SSH/SFTP transport and runtime wrapper
- `src/server/ton-storage/`: TON command building, parsing, validation, and service orchestration
- `src/server/files/`: local staging, remote transfer, and guarded deletion flows
- `src/server/audit/`: audit logging for dangerous actions
- `src/server/errors/`: shared typed error handling
- `tests/`: SSH, TON, API, and file-service coverage

## Main flows

1. Upload local files into the app server staging directory through `/api/uploads`
2. Transfer staged files to the VPS through `/api/uploads/transfer`
3. Confirm transferred files in the dashboard remote upload directory panel
4. Create a bag directly from a remote uploaded file or folder; the app moves it into the managed bag-source directory first
5. Run TON bag commands through the service-backed bag routes
6. Inspect bag details and peers in the UI
7. Remove a TON bag from the daemon, with or without `--remove-files`, from the bag detail page
8. Copy app-managed bag source contents back into uploads from the bag detail page when you want to rebuild from the same material
9. Use guarded remote deletion only for allowlisted paths with explicit confirmation
10. Browse TON storage providers on `/providers` through TonAPI
11. Prepare Tonkeeper start/cancel links for storage contracts from the bag detail page
12. Initialize and manage the local provider daemon from `/my-provider`

## Development

```bash
npm install
npm test
npm run lint
npm run build
```

To use the app locally, start the dev server in a terminal:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Then open a browser and go to:

```text
http://127.0.0.1:3000
```

The server stays attached to that terminal while it is running, so keep that terminal window open during local testing.

## Environment setup

Start from [.env.example](/Users/jameswarner/code/ton-bagman/.env.example) and copy it into `.env.local`.

Required base settings:

- `TON_SSH_HOST`
- `TON_SSH_PORT`
- `TON_SSH_USER`
- `TON_REMOTE_BASE_DIR`
- `TON_REMOTE_BAG_SOURCE_DIR`
- `TON_LOCAL_STAGING_DIR`

Optional TonAPI settings:

- `TONAPI_API_KEY`
- `TONAPI_BASE_URL`

SSH auth modes:

- `TON_SSH_AUTH_MODE=agent`
  Requires `SSH_AUTH_SOCK`
- `TON_SSH_AUTH_MODE=key_path`
  Requires `TON_SSH_PRIVATE_KEY_PATH`
- `TON_SSH_AUTH_MODE=inline_key`
  Requires `TON_SSH_PRIVATE_KEY`

Passphrase rules:

- `TON_SSH_PASSPHRASE` is optional
- it should only be set for `key_path` or `inline_key`
- it should not be set for `agent`

Host verification:

- host verification is mandatory
- set `TON_SSH_HOST_FINGERPRINT`, `TON_SSH_KNOWN_HOSTS_PATH`, or both
- in `production`, missing host verification config will fail startup

Guarded remote deletion:

- `TON_REMOTE_DELETE_ALLOWED_DIRS` is a comma-separated allowlist
- if omitted, it falls back to `TON_REMOTE_BASE_DIR`

Managed bag sources:

- `TON_REMOTE_BAG_SOURCE_DIR` is where remote files or folders are moved before bag creation
- this keeps `TON_REMOTE_BASE_DIR` usable as a staging/upload area instead of a long-term bag source dump
- if omitted, it defaults to a sibling `bag-sources` directory next to `TON_REMOTE_BASE_DIR`
- the `Store with your local bags` option in `Add By Hash` and `Add By Meta` creates a fresh managed folder there automatically instead of asking you to type a destination path

Local staging:

- `TON_LOCAL_STAGING_DIR` is a relative subdirectory inside `.ton-storage/`
- `staging` is the recommended value
- the older `.ton-storage/staging` value is still normalized for backward compatibility

## Live VPS verification

A live parser-verification harness is included in
[tests/integration/ton-parser-live.test.ts](/Users/jameswarner/code/ton-bagman/tests/integration/ton-parser-live.test.ts).

It stays skipped until these env vars are present:

- `TON_SSH_HOST`
- `TON_SSH_USER`
- valid auth-mode-specific SSH settings
- host verification settings

Optional:

- `TON_LIVE_META_OUTPUT_PATH` to verify `get-meta` against a real remote output path

Once those are set, run:

```bash
npm test -- tests/integration/ton-parser-live.test.ts
```

## Local testing

Run the app from a terminal:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Then open a browser and visit:

```text
http://127.0.0.1:3000
```

Keep that terminal open while you test. Stopping the command also stops the app.

## Notes

- TON parser coverage is based on documented syntax and fixture-backed output shapes. Real daemon output from your VPS may still require parser tightening.
- Remote deletion is real now, but only within configured allowlisted directories via `TON_REMOTE_DELETE_ALLOWED_DIRS`.
- TON bag removal is wired to the verified daemon syntax `remove <bag> [--remove-files]`.
- In the app, managed-source recovery copies tracked source contents back into `uploads/` so you can build a new bag without deleting or invalidating the original bag source.

## Provider contract findings

These findings were verified live against the current VPS, TonAPI, and a real Tonkeeper transaction on mainnet.

- The VPS daemon is running on mainnet.
- The reliable request-generation flow is the provider-address form:
  - `new-contract-message <BagID> <output-file> --query-id 0 --provider <provider-address>`
- The manual fallback form appears broken in the current CLI build:
  - `new-contract-message <BagID> <output-file> --rate <rate> --max-span <max-span>`
  - On the current VPS binary, plain numeric `--max-span` values such as `3000` and `86400` fail with `Invalid max span`.
- For provider `0:eab486e7a61723c77d74cc7ae7ee8f45c03f93a164dbd69b081f9203a3211a75`, the working flow generated a request file at:
  - `/opt/ton-storage/test-output/provider-request-eab486.boc`
- That BOC payload was successfully sent from Tonkeeper to the provider contract on mainnet.
- The resulting wallet transaction trace proved that a storage contract was created at:
  - `0:3e74c58e06e31b88282dd392877f3be1981dddd98150dcbe65469f86f579630e`

What this means for future implementation:

- Contract discovery can be done without a database, at least for the tested flow.
- Starting from only the connected wallet address, TonAPI account traces were enough to rediscover the storage-contract creation trace.
- TonAPI account state and `get_storage_contract_data` were enough to read:
  - provider address
  - client wallet
  - torrent hash
  - file size
  - rate
  - max span
  - contract balance
  - current active flag
- That is a strong foundation for a no-DB provider-contract management feature.

Important UI/UX note for the future feature:

- A provider storage contract is not the same thing as a live peer visible to your daemon.
- In the verified test flow, the storage contract existed on-chain while:
  - the contract getter still reported `active: false`
  - your daemon still reported `Peers: 0` for the bag
- Future UI should show these as separate concepts:
  - `Provider contracts`
  - `Network peers`
- The `/providers` page should also be enriched with provider account metadata from TonAPI so it can show `Last activity` as a screening hint when choosing a provider.
- `Last activity` should be treated as a heuristic, not a guarantee of successful activation, because a provider can show recent account activity and still fail to activate a new per-bag contract.

Provider activation model:

- The per-bag storage contract starts inactive when it is deployed by the provider’s main contract.
- It only becomes active after the provider daemon has fully downloaded the bag and sends the activation message on-chain.
- Until that activation step happens:
  - the contract can exist on-chain
- the contract getter can still report `active: false`
- your local daemon can still report `Peers: 0`
- Future UI should treat this as a real lifecycle stage such as `Created` or `Pending activation`, not as a failed contract by default.

Verified close/refund result:

- The client-side close flow was verified on mainnet by sending the documented close opcode from Tonkeeper.
- The storage contract:
  - `0:3e74c58e06e31b88282dd392877f3be1981dddd98150dcbe65469f86f579630e`
  was successfully closed and destroyed.
- TonAPI trace data showed:
  - the wallet sent `close_storage_contract`
  - the storage contract ended with `destroyed: true`
  - a termination message returned remaining value to the client wallet
- This means the full tested lifecycle now includes:
  - request generation
  - wallet send
  - contract creation
  - wallet-address-only rediscovery
  - contract-state reads
  - client-side close
  - on-chain refund/termination
