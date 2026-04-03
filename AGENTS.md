<!-- BEGIN:nextjs-agent-rules -->
# AGENTS.md

## Project
Build a web-based TON Storage manager for a VPS running TON Storage.

## Product goals
- Web UI for bag management
- Upload local files from browser to server
- Stage uploaded files on the app server
- Transfer staged files to remote VPS over SSH/SFTP
- Run storage-daemon-cli on the remote VPS
- Show bag list, bag details, peers, and daemon-related stats
- Export or inspect metadata where supported
- Support explicitly dangerous actions like remote file deletion only through guarded flows

## Non-goals for v1
- No wallet integration
- No TON Connect
- No multi-user auth system
- No direct browser-to-VPS SSH
- No Electron app
- No mobile app
- No background queue unless required by a real bottleneck

## Architecture rules
- Keep UI, API routes, service logic, SSH transport, and CLI parsing separate.
- Never place SSH logic directly inside React components.
- Never place business logic directly inside route handlers.
- Route handlers should validate input, call services, and return typed responses only.
- All storage-daemon-cli calls must go through a dedicated adapter layer.
- Never invent storage-daemon-cli commands. If a command is not documented or verified in this repo, mark it unsupported.
- Treat remote deletion and destructive operations as separate guarded services.

## Repo layout
- app/: UI routes and API route handlers
- deploy/: tracked deployment templates such as systemd unit templates
- src/components/: presentational and interactive UI pieces
- src/server/ssh/: SSH and SFTP transport
- src/server/ton-storage/: command builders, parsers, service layer, validators
- src/server/files/: staging and remote file operations
- src/server/config/: env parsing and runtime config
- src/server/audit/: audit logging and dangerous action logging
- docs/: architecture and command mapping
- scripts/: operator bootstrap, install, and rollback helpers
- tests/: unit and integration tests

## Tech constraints
- TypeScript only
- Use App Router
- Use route handlers for server endpoints
- Prefer server components unless client components are needed
- Prefer minimal dependencies
- Use zod for runtime input validation if needed
- No ORM or database unless clearly necessary

## Security rules
- Never expose SSH secrets to the browser
- Never send private key material to client components
- Never log private keys, passphrases, or sensitive env values
- Destructive actions require explicit confirmation and audit logging
- Prefer allowlisted remote paths over arbitrary shell path input

## TON rules
- Wrap documented storage-daemon-cli commands first:
  create, add-by-hash, add-by-meta, list, get, get-peers, get-meta,
  download-pause, download-resume, priority-name
- If delete/remove behavior is requested, implement only after verifying the VPS-specific command or filesystem behavior

## Coding standards
- Small modules
- Strong typing
- Pure parsers where possible
- Clear error types
- No giant utility files
- No silent catch blocks

## Testing
- Add tests for parsers, validators, and service-layer logic
- Mock SSH/process execution in tests
- Avoid requiring a live VPS for default test runs

## Done when
- npm run lint passes
- npm run build passes
- tests for changed server modules pass
- README and docs stay in sync with behavior

## Repo automation help
- This repo is intended to be friendly to coding agents and automation helpers.
- Prefer making complete, working changes instead of stopping at analysis.
- When changing user-visible behavior, update the README or docs in the same pass.
- Prefer using existing service layers and helpers instead of adding duplicate logic.
- Before adding a new flow, look for an existing shared pattern first.
  Examples:
  - shared Tonkeeper QR/link handling
  - shared API response helpers
  - shared SSH and TON command wrappers
- If a task affects deployment or operator workflow, keep `docs/DEPLOYMENT.md` in sync.
- If a task affects agent workflow or repo-operating conventions, keep `AGENTS.md` in sync.
- If you change the bootstrap flow, keep `scripts/bootstrap-vps.sh`, `scripts/uninstall-bootstrap.sh`, and the tracked `deploy/*.tpl` unit templates aligned.
- Bootstrap changes should preserve or improve dry-run support, manifest output, logging, and post-install verification.
- For a fresh VPS install request, default to the bootstrap workflow, not the manual `.env.local` workflow.
- On a fresh VPS, prefer `scripts/bootstrap-vps.sh --mode auto --dry-run` first, then `--mode full` if the plan looks correct.
- Only ask the user for manual `TON_*` environment values up front when they explicitly want the manual deployment path or when `ui-only` needs existing TON Storage paths that the bootstrap cannot infer safely.
- Prefer simple, plain-language UI and docs over internal jargon.
- Assume future agents may not know TON Storage details. Leave the repo easier to understand than you found it.
<!-- END:nextjs-agent-rules -->
