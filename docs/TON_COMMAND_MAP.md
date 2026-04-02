# TON Command Map

## Verified command syntax

The command names and argument order below are verified against official TON Storage daemon documentation:

- `create <path>`
- `create <path> -d "Bag of Files description"`
- `add-by-hash <hash> -d directory`
- `add-by-meta <meta-file> -d directory`
- `list`
- `list --hashes`
- `get <BagID>`
- `get-peers <BagID>`
- `get-meta <BagID> <meta-file>`
- `download-pause <BagID>`
- `download-resume <BagID>`
- `remove <BagID>`
- `import-pk <file>`
- `deploy-provider`
- `init-provider <smc-addr>`
- `get-provider-params [address] [--json]`
- `get-provider-info [--balances] [--contracts] [--json]`
- `set-provider-params [--accept x] [--rate x] [--max-span x] [--min-file-size x] [--max-file-size x]`
- `set-provider-config [--max-contracts x] [--max-total-size x]`
- `close-contract <address>`
- `priority-name <BagID> <name> <priority>`

Additional documented flags:

- `create --copy`
- `create --no-upload`
- `add-by-hash --partial file1 file2`
- `add-by-meta --partial file1 file2`
- `remove --remove-files`

## Supported adapter scope

The adapter layer in this repo supports:

| Command | Adapter status | Notes |
| --- | --- | --- |
| `list` | supported | Includes optional `--hashes`. |
| `get` | supported | Accepts a bag reference. |
| `get-peers` | supported | Accepts a bag reference. |
| `create` | supported | Supports `-d`, `--copy`, and `--no-upload`. |
| `add-by-hash` | supported | Supports optional `-d` and `--partial`. |
| `add-by-meta` | supported | Supports optional `-d` and `--partial`. |
| `get-meta` | supported | Exports bag metadata to a file path. |
| `download-pause` | supported | Accepts a bag reference. |
| `download-resume` | supported | Accepts a bag reference. |
| `remove` | supported | Verified live as `remove <bag> [--remove-files]`. |
| `import-pk` | supported | Used by the My Provider setup flow. |
| `deploy-provider` | supported | Used by the My Provider setup flow. |
| `init-provider` | supported | Used by the My Provider setup flow. |
| `get-provider-params` | supported | Uses `--json` for structured provider params. |
| `get-provider-info` | supported | Uses `--balances --contracts --json` for structured provider info. |
| `set-provider-params` | supported | Supports `--accept`, `--rate`, `--max-span`, `--min-file-size`, and `--max-file-size`. |
| `set-provider-config` | supported | Supports `--max-contracts` and `--max-total-size`. |
| `close-contract` | supported | Used by the My Provider page for accepted-contract closure. |
| `priority-name` | unsupported in service | Documented, but not part of the current implementation request. |

## Implementation rules

- Only build commands that are documented or verified in this repo.
- Do not guess aliases or flags.
- Unsupported documented commands should be surfaced explicitly in code.

## Parser contracts in this repo

- `list` parser handles the tabular bag output shown in TON docs and issue examples.
- `get` parser handles labeled bag detail fields and a files table.
- `get-peers` parser handles peer lists as tabular text.
- mutation parsers extract structured acknowledgement data from stdout without assuming undocumented fields.
- unsupported or unparseable output should fail clearly rather than silently succeed.

## Explicitly unsupported

- undocumented helper aliases
- undocumented output fields presented as guaranteed data

## Deletion note

- TON Storage documentation describes `remove <BagID>` and a `--remove-files` variant.
- Live daemon help on the target VPS verified the exact syntax as `remove <bag> [--remove-files]`.

## Provider contract note

Provider-contract request generation was verified live on the target VPS with:

- `new-contract-message <BagID> <output-file> --query-id 0 --provider <provider-address>`

The provider-address form successfully wrote a request `.boc` file that was later signed and sent from Tonkeeper.

On the same VPS build, the manual form:

- `new-contract-message <BagID> <output-file> --rate <rate> --max-span <max-span>`

appeared unreliable, with plain numeric `--max-span` values such as `3000` and `86400` failing with `Invalid max span`.

For future implementation work, prefer the provider-address flow over the manual rate/span flow unless the TON binary behavior is revalidated on the target environment.
