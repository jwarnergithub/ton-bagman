# Architecture

## Objective

Provide a single-user web control surface for managing TON Storage on one VPS without mixing UI, route handling, SSH transport, TON command logic, and filesystem operations.

## Layering rules

- React components do not contain SSH or TON orchestration logic.
- Route handlers validate input, call services, and return typed JSON only.
- SSH transport stays isolated in `src/server/ssh/`.
- TON command building and parsing stay isolated in `src/server/ton-storage/`.
- File staging, transfer, and destructive remote file operations stay isolated in `src/server/files/`.
- Dangerous-action logging stays isolated in `src/server/audit/`.

## Current structure

```text
app/
  page.tsx
  bags/
    page.tsx
    [bagId]/page.tsx
  my-provider/page.tsx
  settings/page.tsx
  api/
    health/route.ts
    connection/test/route.ts
    my-provider/route.ts
    my-provider/import-key/route.ts
    my-provider/deploy/route.ts
    my-provider/init/route.ts
    my-provider/params/route.ts
    my-provider/config/route.ts
    my-provider/contracts/close/route.ts
    uploads/route.ts
    uploads/transfer/route.ts
    bags/route.ts
    bags/create/route.ts
    bags/add-by-hash/route.ts
    bags/add-by-meta/route.ts
    bags/[bagId]/route.ts
    bags/[bagId]/contracts/route.ts
    bags/[bagId]/contracts/start/route.ts
    bags/[bagId]/contracts/cancel/route.ts
    bags/[bagId]/peers/route.ts
    bags/[bagId]/meta/route.ts
    bags/[bagId]/download-pause/route.ts
    bags/[bagId]/download-resume/route.ts
    bags/[bagId]/remove/route.ts
    bags/[bagId]/recover-to-uploads/route.ts
    bags/[bagId]/managed-source/delete/route.ts
    remote-files/delete/route.ts

src/
  components/
    dashboard/
    bags/
    providers/
    shared/
  server/
    api/responses.ts
    config/env.ts
    ssh/
      client.ts
      exec.ts
      runtime.ts
      sftp.ts
    ton-storage/
      commandBuilder.ts
      contractRequests.ts
      parser.ts
      runtime.ts
      service.ts
      types.ts
      validators.ts
    storage-contracts/
      links.ts
      service.ts
      types.ts
      validators.ts
    provider-management/
      service.ts
      types.ts
    tonapi/
      storageContracts.ts
    files/
      staging.ts
      remoteFiles.ts
    audit/logger.ts
    errors/appError.ts
```

## Runtime flow

1. The UI is rendered primarily through server components.
2. Read-only screens use server-side service calls and catch errors for display.
3. Interactive mutations use small client components that call API routes.
4. API routes delegate into server services and shared helpers.
5. TON routes create an SSH client, wrap it in the TON service, and dispose it after use.
6. Upload routes persist browser files into a bounded local staging directory under `.ton-storage/` before transfer.

## Important implementation choices

- Pages are marked dynamic so runtime config and live VPS data are resolved at request time, not build time.
- File staging uses the local filesystem with per-upload metadata files rather than a database.
- Remote transfer uses the same SSH/SFTP transport layer as command execution.
- Guarded remote deletion uses an allowlisted remote path policy plus audit logging.
- TON bag removal uses the documented daemon `remove <bag> [--remove-files]` command through the adapter layer.
- Unsupported documented TON actions are surfaced explicitly instead of guessed.

## Provider contract baseline

The repo now includes a first-pass contract-management panel on the bag detail page.

- Contract discovery is wallet-driven and bag-specific:
  - the bag detail page accepts a wallet address
  - the server asks TonAPI for recent wallet traces
  - it walks trace trees to find storage-contract accounts
  - it filters those contracts by comparing the getter-reported torrent hash to the current bag ID
- Start-contract preparation remains server-side:
  - the VPS runs `new-contract-message <BagID> <output-file> --query-id 0 --provider <provider-address>`
  - the app reads the generated `.boc` payload back from the VPS
  - the UI turns that payload into a Tonkeeper deep link
- Cancel-contract preparation is local to the app:
  - the app encodes the documented `close_storage_contract` opcode
  - the UI turns that payload into a Tonkeeper deep link for the selected storage contract

The mainnet feasibility work still defines the constraints for that feature:

- Request generation should use the provider-address form of `new-contract-message`, not the manual `--rate --max-span` form.
- The current VPS build successfully generated a provider request body when called as:
  - `new-contract-message <BagID> <output-file> --query-id 0 --provider <provider-address>`
- The current VPS build did not reliably accept the manual form:
  - `new-contract-message <BagID> <output-file> --rate <rate> --max-span <max-span>`
- A real Tonkeeper-signed transaction created a mainnet storage contract for the selected bag and provider.
- TonAPI traces were sufficient to:
  - rediscover the storage-contract creation trace from only the wallet address
  - recover the created storage-contract address
- TonAPI account state and `get_storage_contract_data` were sufficient to read useful management state without app-side persistence.

This makes a no-database design plausible for a future provider-contract feature, with the connected wallet address acting as the lookup key.

## My Provider page

The repo now also includes a provider-operations page for the local daemon at `/my-provider`.

- Setup state:
  - import a provider private key from a remote file path with `import-pk <file>`
  - deploy a provider contract with `deploy-provider`
  - initialize the daemon against an existing provider contract with `init-provider <smc-addr>`
- Managed state:
  - read current provider params through `get-provider-params --json`
  - read provider info through `get-provider-info --balances --contracts --json`
  - update offer terms with `set-provider-params`
  - update local capacity limits with `set-provider-config`
  - close accepted contracts with `close-contract <address>`

The page intentionally keeps SSH and TON command execution in the server layer:

- route handlers only validate input and return typed JSON
- provider orchestration lives in `src/server/provider-management/service.ts`
- daemon command building still lives in `src/server/ton-storage/commandBuilder.ts`
- accepted-contract discovery is read-only TonAPI enrichment keyed by the provider address

## Provider list enrichment

The `/providers` discovery page should be expanded to enrich TonAPI storage-provider results with TonAPI account metadata.

- Show `Last activity` for each provider as a screening aid.
- Allow future ranking/filtering to consider recency alongside price and `accept_new_contracts`.
- Treat `Last activity` as advisory only.

The verified mainnet test showed why this distinction matters:

- provider `0:eab486e7a61723c77d74cc7ae7ee8f45c03f93a164dbd69b081f9203a3211a75` showed very recent account activity after the test interaction
- the most recent activity before that observed test was `2023-04-24 21:26:04 UTC`
- even with recent activity visible on the account, the provider still did not activate the tested per-bag contract

## Provider contract modeling rules

Future UI should model provider contracts separately from daemon peer visibility.

- `Provider contract exists` means an on-chain storage-contract relationship exists.
- `Network peer visible` means the local storage daemon currently sees a live TON Storage peer for that bag.
- These can diverge.

The verified test flow produced:

- a created on-chain storage contract
- `active: false` from `get_storage_contract_data`
- `Peers: 0` from the local daemon for the same bag

So a future provider feature should not assume that contract creation immediately implies peer discovery.

## Provider contract status model

The future provider-contract UI should explicitly model the inactive-to-active transition of the per-bag storage contract.

- The main provider contract may accept and deploy a per-bag contract immediately.
- The per-bag contract still starts with `active = false`.
- The provider must first download the bag and then send the activation message on-chain.
- Only after that activation step should the contract be treated as fully active storage.

Recommended future statuses:

- `Created`
- `Pending activation`
- `Active`
- `Closed`

The verified mainnet test currently sits in the `Created` or `Pending activation` stage:

- contract exists on-chain
- `get_storage_contract_data` reports `active: false`
- no new activation trace or callback was observed yet
- daemon peer list still reports `Peers: 0`

The close path was also verified later in the same test flow:

- the client wallet sent the documented close opcode to the storage contract
- the storage contract closed successfully
- TonAPI showed the storage-contract account ending in `nonexist`
- remaining value was returned to the client wallet through the termination flow

So future provider-contract work can assume the following lifecycle has been proven on mainnet:

- create request
- wallet send
- contract deployment
- wallet-address-only rediscovery
- on-chain state reads
- client-driven close
- refund/termination

## Remaining gaps

- Some TON parser shapes still need confirmation against real VPS stdout.
- There is no background queue; uploads and remote actions run inline per request.
- There is still no authentication layer because v1 is single-user and non-multi-tenant by design.
