# Security Model

## Core principles

- SSH secrets stay server-side only.
- The browser never receives private key material or raw secret values.
- Dangerous actions require explicit confirmation and audit logging.
- Remote file operations are constrained by allowlisted paths.
- Unsupported TON commands remain unavailable rather than guessed.

## Current controls

- Runtime config is validated in `src/server/config/env.ts`.
- UI screens only display secret-safe connection fields.
- SSH private key material is loaded server-side only.
- Uploads are staged on the app server before remote transfer.
- Remote transfer targets are normalized against the configured remote base directory.
- Remote deletion requires the literal confirmation value `DELETE`.
- Remote deletion also requires re-typing the exact target basename.
- Remote deletion only runs when the normalized path is inside `TON_REMOTE_DELETE_ALLOWED_DIRS`.
- Remote deletion refuses to delete an allowlisted root directory directly.
- Remote deletion currently only supports regular files and symlinks, not directories.
- Dangerous remote delete requests are logged through `src/server/audit/logger.ts`.
- TON bag removal requires explicit typed confirmation in the bag detail UI before the daemon `remove` command is called.
- The `--remove-files` bag-removal variant is exposed separately and called only after its own stronger typed confirmation.

## Guarded deletion contract

`POST /api/remote-files/delete`

Required request body:

```json
{
  "remotePath": "/allowed/path/example",
  "confirmation": "DELETE",
  "targetName": "example"
}
```

Current behavior:

- validates the confirmation string
- validates the basename confirmation
- normalizes the remote path
- enforces the allowlist
- rejects allowlisted root directories
- inspects remote path type before deletion
- writes an audit log entry
- executes remote deletion over SSH only if validation succeeds
- only deletes regular files and symlinks

## Upload and transfer model

- Browser uploads terminate at the Next.js server.
- Files are written into a bounded local staging directory under `.ton-storage/`, with `TON_LOCAL_STAGING_DIR` selecting the subdirectory.
- Files are only transferred to the VPS through server-side SFTP.
- Successful transfers remove the local staged copy.

## Residual risks

- TON parser logic still depends on fixture-backed stdout assumptions until validated against your real daemon output.
- Remote deletion is safer now, but the allowlist configuration must still stay tight.
- Audit logging is currently process-local and should be moved to a durable sink if you need stronger operator traceability.
