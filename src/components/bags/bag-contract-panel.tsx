"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ActionNotice } from "@/src/components/shared/action-notice";
import { EmptyState } from "@/src/components/shared/empty-state";
import { QrCodeCard } from "@/src/components/shared/qr-code-card";
import type { ApiSuccessResponse } from "@/src/server/api/responses";
import type {
  PreparedCancelContractLink,
  PreparedStartContractLink,
  StorageContractDiscoveryResult,
  StorageContractSummary,
} from "@/src/server/storage-contracts/types";

type BagContractPanelProps = {
  bagId: string;
  initialProviderAddress?: string;
};

type RequestState<T> = {
  ok: boolean;
  data?: T;
  errorMessage?: string;
};

function formatUnixTime(value: number) {
  if (!value) {
    return "Not available";
  }

  return new Date(value * 1000).toLocaleString();
}

function formatRemainingTime(seconds: number | null) {
  if (!seconds || seconds <= 0) {
    return "Not available";
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${days}d ${hours}h ${minutes}m`;
}

function formatSize(value: number) {
  if (value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function readJson<T>(response: Response): Promise<RequestState<T>> {
  const payload = (await response.json()) as
    | ApiSuccessResponse<T>
    | {
        ok: false;
        error?: {
          message?: string;
        };
      };

  if (!response.ok || !payload.ok) {
    return {
      ok: false,
      errorMessage:
        "error" in payload ? payload.error?.message ?? "Request failed." : "Request failed.",
    };
  }

  return {
    ok: true,
    data: payload.data,
  };
}

function ContractCard({
  contract,
  onPrepareCancel,
  cancelResult,
}: {
  contract: StorageContractSummary;
  onPrepareCancel: (address: string, amountTon: string) => Promise<void>;
  cancelResult: RequestState<PreparedCancelContractLink> | null;
}) {
  const [amountTon, setAmountTon] = useState("0.05");

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">{contract.addressFriendly}</p>
          <p className="text-xs break-all text-[var(--color-ink-muted)]">
            {contract.addressRaw}
          </p>
        </div>
        <p className="text-sm font-medium text-[var(--color-ink-muted)]">
          {contract.active ? "Active" : "Pending activation"}
        </p>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-[var(--color-ink-muted)] lg:grid-cols-2">
        <p>Provider: {contract.providerAddressFriendly}</p>
        <p>Balance: {contract.balanceTon} TON</p>
        <p>File size: {formatSize(contract.fileSize)}</p>
        <p>Est. cost / day: {contract.estimatedDailyCostTon ?? "Unknown"} TON</p>
        <p>Next proof: {contract.nextProof || "Not scheduled"}</p>
        <p>Last proof: {formatUnixTime(contract.lastProofTime)}</p>
        <p>Est. expires: {formatUnixTime(contract.estimatedExpiresAt ?? 0)}</p>
        <p>Est. time left: {formatRemainingTime(contract.estimatedSecondsRemaining)}</p>
        <p>Status: {contract.onChainStatus}</p>
      </div>

      <form
        className="mt-4 flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-panel)] p-3"
        onSubmit={async (event) => {
          event.preventDefault();
          await onPrepareCancel(contract.addressRaw, amountTon);
        }}
      >
        <label className="block space-y-2 text-sm">
          <span className="font-medium">TON to attach for the close request</span>
          <input
            value={amountTon}
            onChange={(event) => setAmountTon(event.target.value)}
            inputMode="decimal"
            className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
        >
          Prepare Tonkeeper Cancel Link
        </button>
      </form>

      {cancelResult?.ok && cancelResult.data?.contractAddressRaw === contract.addressRaw ? (
        <div className="mt-3 space-y-3">
          <ActionNotice
            tone="success"
            title="Cancel link ready"
            description="Scan the QR code in Tonkeeper, or open the link directly if this device has Tonkeeper installed."
            details={[
              `Amount: ${cancelResult.data.amountTon} TON`,
              `Contract: ${cancelResult.data.contractAddressFriendly}`,
            ]}
          />
          <QrCodeCard
            value={cancelResult.data.tonkeeperLink}
            title="Tonkeeper Cancel QR"
            description="Open Tonkeeper and scan this QR code to send the close request without copying the link into another browser."
          />
          <a
            href={cancelResult.data.tonkeeperLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Open Tonkeeper Cancel Link
          </a>
        </div>
      ) : null}
      {cancelResult && !cancelResult.ok ? (
        <div className="mt-3">
          <ActionNotice
            tone="error"
            title="Cancel link generation failed"
            description={cancelResult.errorMessage ?? "The cancel link could not be prepared."}
          />
        </div>
      ) : null}
    </div>
  );
}

export function BagContractPanel({
  bagId,
  initialProviderAddress = "",
}: BagContractPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [walletAddress, setWalletAddress] = useState("");
  const [providerAddress, setProviderAddress] = useState(initialProviderAddress);
  const [startAmountTon, setStartAmountTon] = useState("0.2");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isPreparingStart, setIsPreparingStart] = useState(false);
  const [discoveryResult, setDiscoveryResult] =
    useState<RequestState<StorageContractDiscoveryResult> | null>(null);
  const [startResult, setStartResult] =
    useState<RequestState<PreparedStartContractLink> | null>(null);
  const [cancelResults, setCancelResults] = useState<
    Record<string, RequestState<PreparedCancelContractLink>>
  >({});

  useEffect(() => {
    if (!initialProviderAddress) {
      return;
    }

    const currentHash =
      typeof window !== "undefined" && window.location.hash
        ? window.location.hash
        : "#storage-contracts";

    router.replace(`${pathname}${currentHash}`, { scroll: false });
  }, [initialProviderAddress, pathname, router]);

  async function discoverContracts() {
    setIsDiscovering(true);

    try {
      const response = await fetch(
        `/api/bags/${bagId}/contracts?wallet=${encodeURIComponent(walletAddress)}`,
      );
      setDiscoveryResult(await readJson<StorageContractDiscoveryResult>(response));
    } finally {
      setIsDiscovering(false);
    }
  }

  async function prepareStartLink() {
    setIsPreparingStart(true);

    try {
      const response = await fetch(`/api/bags/${bagId}/contracts/start`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          providerAddress,
          amountTon: startAmountTon,
        }),
      });

      setStartResult(await readJson<PreparedStartContractLink>(response));
    } finally {
      setIsPreparingStart(false);
    }
  }

  async function prepareCancelLink(contractAddress: string, amountTon: string) {
    const response = await fetch(`/api/bags/${bagId}/contracts/cancel`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contractAddress,
        amountTon,
      }),
    });

    const result = await readJson<PreparedCancelContractLink>(response);
    setCancelResults((current) => ({
      ...current,
      [contractAddress]: result,
    }));
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="text-sm font-semibold">Discover contracts for this bag</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
          This app does not connect your wallet yet. To rediscover storage contracts for a
          bag, enter the wallet address that created them and the app will inspect recent
          TonAPI traces for matching storage contracts.
        </p>

        <form
          className="mt-4 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            await discoverContracts();
          }}
        >
          <label className="block space-y-2 text-sm">
            <span className="font-medium">Wallet address</span>
            <input
              value={walletAddress}
              onChange={(event) => setWalletAddress(event.target.value)}
              placeholder="EQ..."
              className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={isDiscovering}
            className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium disabled:cursor-wait disabled:opacity-70"
          >
            {isDiscovering ? "Checking Contracts..." : "Discover Bag Contracts"}
          </button>
        </form>
        {isDiscovering ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
            Looking through recent wallet traces for bag-specific storage contracts...
          </div>
        ) : null}
      </div>

      {discoveryResult?.ok && discoveryResult.data ? (
        discoveryResult.data.contracts.length > 0 ? (
          <div className="space-y-3">
            {discoveryResult.data.contracts.map((contract) => (
              <ContractCard
                key={contract.addressRaw}
                contract={contract}
                onPrepareCancel={prepareCancelLink}
                cancelResult={cancelResults[contract.addressRaw] ?? null}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No contracts found for this bag"
            description="The lookup succeeded, but none of the recent wallet traces produced a storage contract whose torrent hash matches this bag."
          />
        )
      ) : null}

      {discoveryResult && !discoveryResult.ok ? (
        <ActionNotice
          tone="error"
          title="Contract lookup failed"
          description={discoveryResult.errorMessage ?? "The contract lookup failed."}
        />
      ) : null}

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="text-sm font-semibold">Start a new storage contract</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
          This generates a provider request BOC on the VPS and turns it into a Tonkeeper
          transfer link. Open the link outside Tonkeeper&apos;s in-app browser.
        </p>
        {initialProviderAddress ? (
          <div className="mt-3">
            <ActionNotice
              tone="info"
              title="Provider preselected"
              description="This provider address was carried over from the providers page so you can start the contract flow without copying it manually."
              details={[`Provider: ${initialProviderAddress}`]}
            />
          </div>
        ) : null}

        <form
          className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px]"
          onSubmit={async (event) => {
            event.preventDefault();
            await prepareStartLink();
          }}
        >
          <label className="block space-y-2 text-sm">
            <span className="font-medium">Provider address</span>
            <input
              value={providerAddress}
              onChange={(event) => setProviderAddress(event.target.value)}
              placeholder="0:..."
              className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span className="font-medium">TON to send</span>
            <input
              value={startAmountTon}
              onChange={(event) => setStartAmountTon(event.target.value)}
              inputMode="decimal"
              className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={isPreparingStart}
            className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-70 lg:col-span-2"
          >
            {isPreparingStart ? "Generating Start Link..." : "Prepare Tonkeeper Start Link"}
          </button>
        </form>
        {isPreparingStart ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
            Generating the provider request on the VPS and retrying through transient liteserver sync errors if needed...
          </div>
        ) : null}
      </div>

      {startResult?.ok && startResult.data ? (
        <div className="space-y-3">
          <ActionNotice
            tone="success"
            title="Start link ready"
            description="The provider request payload was generated successfully on the VPS."
            details={[
              `Provider: ${startResult.data.providerAddressFriendly}`,
              `Amount: ${startResult.data.amountTon} TON`,
            ]}
          />
          <QrCodeCard
            value={startResult.data.tonkeeperLink}
            title="Tonkeeper Start QR"
            description="Open Tonkeeper and scan this QR code to sign the storage contract request directly from the page."
          />
          <a
            href={startResult.data.tonkeeperLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Open Tonkeeper Start Link
          </a>
        </div>
      ) : null}

      {startResult && !startResult.ok ? (
        <ActionNotice
          tone="error"
          title="Start link generation failed"
          description={startResult.errorMessage ?? "The provider request could not be prepared."}
        />
      ) : null}
    </div>
  );
}
