"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionNotice } from "@/src/components/shared/action-notice";
import { EmptyState } from "@/src/components/shared/empty-state";
import { PageShell } from "@/src/components/shared/page-shell";
import { Panel } from "@/src/components/shared/panel";
import { QrCodeCard } from "@/src/components/shared/qr-code-card";
import {
  type BinarySizeUnit,
  type ProofIntervalUnit,
  joinUnitToBytes,
  joinUnitToSeconds,
  nanoTonToTon,
  splitBytesToUnit,
  splitSecondsToUnit,
  tonToNanoTon,
} from "@/src/components/providers/provider-form-units";
import type { ApiSuccessResponse } from "@/src/server/api/responses";
import type {
  MyProviderMutationResponse,
  MyProviderOverview,
} from "@/src/server/provider-management/types";

type MyProviderScreenProps = {
  initialOverview: MyProviderOverview | null;
  initialError: string | null;
};

type RequestState<T> = {
  ok: boolean;
  data?: T;
  errorMessage?: string;
};

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

function SizeInput({
  label,
  amount,
  unit,
  onAmountChange,
  onUnitChange,
  helper,
}: {
  label: string;
  amount: string;
  unit: BinarySizeUnit;
  onAmountChange: (value: string) => void;
  onUnitChange: (value: BinarySizeUnit) => void;
  helper: string;
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
        <input
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          inputMode="numeric"
          className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3"
        />
        <select
          value={unit}
          onChange={(event) => onUnitChange(event.target.value as BinarySizeUnit)}
          className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3"
        >
          <option value="B">Bytes</option>
          <option value="KB">Kilobytes</option>
          <option value="MB">Megabytes</option>
          <option value="GB">Gigabytes</option>
        </select>
      </div>
      <p className="text-xs leading-5 text-[var(--color-ink-muted)]">{helper}</p>
    </label>
  );
}

function ProviderContractCard({
  contract,
  onClose,
  isClosing,
}: {
  contract: MyProviderOverview["contracts"][number];
  onClose: (contractAddress: string, confirmation: string) => Promise<void>;
  isClosing: boolean;
}) {
  const [confirmation, setConfirmation] = useState("");

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium">{contract.bagDescription ?? contract.bagId ?? "Unknown bag"}</p>
          <p className="text-xs break-all text-[var(--color-ink-muted)]">
            Contract: {contract.addressFriendly}
          </p>
          {contract.bagId ? (
            <p className="text-xs break-all text-[var(--color-ink-muted)]">Bag ID: {contract.bagId}</p>
          ) : null}
        </div>
        <p className="text-sm font-medium text-[var(--color-ink-muted)]">
          {contract.active ? "Active" : "Pending"}
        </p>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-[var(--color-ink-muted)] lg:grid-cols-2">
        <p>Bag present locally: {contract.bagPresentLocally ? "Yes" : "No"}</p>
        <p>Client: {contract.clientAddressFriendly}</p>
        <p>Balance: {contract.balanceTon} TON</p>
        <p>File size: {contract.fileSizeLabel}</p>
        <p>Max span: {contract.maxSpanLabel}</p>
        <p>Last proof: {contract.lastProofTimeLabel}</p>
        <p>Estimated expiry: {contract.expiresAtLabel}</p>
        <p>Time left: {contract.timeLeftLabel}</p>
        <p>Status: {contract.onChainStatus}</p>
      </div>

      <form
        className="mt-4 space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-panel)] p-3"
        onSubmit={async (event) => {
          event.preventDefault();
          await onClose(contract.addressRaw, confirmation);
          setConfirmation("");
        }}
      >
        <label className="block space-y-2 text-sm">
          <span className="font-medium">Confirmation</span>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="CLOSE PROVIDER CONTRACT"
            className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={isClosing}
          className="rounded-full border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-60"
        >
          {isClosing ? "Closing Contract..." : "Close Accepted Contract"}
        </button>
      </form>
    </div>
  );
}

export function MyProviderScreen({
  initialOverview,
  initialError,
}: MyProviderScreenProps) {
  const [overview, setOverview] = useState<MyProviderOverview | null>(initialOverview);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [notice, setNotice] = useState<{
    tone: "success" | "error" | "info";
    title: string;
    description: string;
    details?: string[];
  } | null>(null);
  const [importKeyPath, setImportKeyPath] = useState("/opt/ton-storage/provider.pk");
  const [initProviderAddress, setInitProviderAddress] = useState("");
  const [acceptNewContracts, setAcceptNewContracts] = useState(
    initialOverview?.params?.acceptNewContracts ?? true,
  );
  const [ratePerMbDayTon, setRatePerMbDayTon] = useState(
    initialOverview?.params?.ratePerMbDayTon ??
      nanoTonToTon(initialOverview?.params?.ratePerMbDayNanoTon ?? 1000000),
  );
  const initialMaxSpan = splitSecondsToUnit(initialOverview?.params?.maxSpanSeconds ?? 86400);
  const [timeBetweenProofAmount, setTimeBetweenProofAmount] = useState(initialMaxSpan.amount);
  const [timeBetweenProofUnit, setTimeBetweenProofUnit] = useState<ProofIntervalUnit>(
    initialMaxSpan.unit,
  );
  const initialMinFileSize = splitBytesToUnit(
    initialOverview?.params?.minimalFileSizeBytes ?? 1048576,
  );
  const [minimalFileSizeAmount, setMinimalFileSizeAmount] = useState(initialMinFileSize.amount);
  const [minimalFileSizeUnit, setMinimalFileSizeUnit] = useState<BinarySizeUnit>(
    initialMinFileSize.unit,
  );
  const initialMaxFileSize = splitBytesToUnit(
    initialOverview?.params?.maximalFileSizeBytes ?? 1073741824,
  );
  const [maximalFileSizeAmount, setMaximalFileSizeAmount] = useState(initialMaxFileSize.amount);
  const [maximalFileSizeUnit, setMaximalFileSizeUnit] = useState<BinarySizeUnit>(
    initialMaxFileSize.unit,
  );
  const [maxContracts, setMaxContracts] = useState(
    String(initialOverview?.config?.maxContracts ?? 1000),
  );
  const initialMaxTotalSize = splitBytesToUnit(
    initialOverview?.config?.maxTotalSizeBytes ?? 137438953472,
  );
  const [maxTotalSizeAmount, setMaxTotalSizeAmount] = useState(initialMaxTotalSize.amount);
  const [maxTotalSizeUnit, setMaxTotalSizeUnit] = useState<BinarySizeUnit>(
    initialMaxTotalSize.unit,
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  async function runMutation(
    actionName: string,
    path: string,
    body?: Record<string, unknown>,
  ) {
    setBusyAction(actionName);
    setNotice(null);

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await readJson<MyProviderMutationResponse>(response);

      if (!result.ok || !result.data) {
        setNotice({
          tone: "error",
          title: "Provider action failed",
          description: result.errorMessage ?? "The provider action failed.",
        });
        return;
      }

      setOverview(result.data.overview);
      setErrorMessage(null);
      if (result.data.result.providerAddress) {
        setInitProviderAddress(result.data.result.providerAddress);
      }
      setNotice({
        tone: "success",
        title: "Provider action completed",
        description: result.data.result.rawOutput || "The provider action completed successfully.",
        details: [
          `Action: ${result.data.result.action}`,
          ...(result.data.result.providerAddress
            ? [`Provider: ${result.data.result.providerAddress}`]
            : []),
          ...(result.data.result.contractAddress
            ? [`Contract: ${result.data.result.contractAddress}`]
            : []),
        ],
      });

      if (result.data.result.action === "deploy-provider" && result.data.result.providerAddress) {
        setInitProviderAddress(result.data.result.providerAddress);
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function refreshOverview(options?: { silent?: boolean }) {
    setBusyAction("refresh-overview");

    if (!options?.silent) {
      setNotice(null);
    }

    try {
      const response = await fetch("/api/my-provider");
      const result = await readJson<MyProviderOverview>(response);

      if (!result.ok || !result.data) {
        if (!options?.silent) {
          setNotice({
            tone: "error",
            title: "Provider refresh failed",
            description: result.errorMessage ?? "The provider overview could not be refreshed.",
          });
        }
        return;
      }

      setOverview(result.data);
      setErrorMessage(null);
      setLastRefreshAt(new Date().toISOString());
      if (!options?.silent) {
        setNotice({
          tone: "info",
          title: "Provider status refreshed",
          description: result.data.configured
            ? "The daemon is connected to a provider."
            : "The daemon is still waiting to finish provider initialization.",
        });
      }
    } finally {
      setBusyAction(null);
    }
  }

  function showValidationNotice(message: string) {
    setNotice({
      tone: "error",
      title: "Provider form needs attention",
      description: message,
    });
  }

  const providerStats = useMemo(() => {
    if (!overview?.configured) {
      return [];
    }

    return [
      {
        label: "Daemon Connection",
        value: "Connected",
        subvalue: "This daemon is initialized against the provider shown below.",
      },
      {
        label: "Provider Contract Address",
        value: overview.providerAddressRaw ?? "Unknown",
        subvalue: overview.providerAddressFriendly
          ? `Friendly form for gas top-ups if needed: ${overview.providerAddressFriendly}`
          : null,
      },
      {
        label: "On-chain Balance",
        value: overview.onChainBalanceTon ? `${overview.onChainBalanceTon} TON` : "Unknown",
        subvalue: overview.onChainBalanceNanoTon
          ? `${overview.onChainBalanceNanoTon} nanoTON`
          : null,
      },
      {
        label: "Accepting New Contracts",
        value: overview.params?.acceptNewContracts ? "Yes" : "No",
        subvalue: null,
      },
      {
        label: "Last Activity",
        value: overview.lastActivityLabel ?? "Unknown",
        subvalue: null,
      },
    ];
  }, [overview]);

  const pendingDeployment = overview?.pendingDeployment ?? null;

  useEffect(() => {
    if (!pendingDeployment || overview?.configured) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshOverview({ silent: true });
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [pendingDeployment, overview?.configured]);

  useEffect(() => {
    if (!overview?.params) {
      return;
    }

    setAcceptNewContracts(overview.params.acceptNewContracts);
    setRatePerMbDayTon(overview.params.ratePerMbDayTon);

    const span = splitSecondsToUnit(overview.params.maxSpanSeconds);
    setTimeBetweenProofAmount(span.amount);
    setTimeBetweenProofUnit(span.unit);

    const minSize = splitBytesToUnit(overview.params.minimalFileSizeBytes);
    setMinimalFileSizeAmount(minSize.amount);
    setMinimalFileSizeUnit(minSize.unit);

    const maxSize = splitBytesToUnit(overview.params.maximalFileSizeBytes);
    setMaximalFileSizeAmount(maxSize.amount);
    setMaximalFileSizeUnit(maxSize.unit);
  }, [overview?.params]);

  useEffect(() => {
    if (!overview?.config) {
      return;
    }

    setMaxContracts(String(overview.config.maxContracts ?? 1000));

    const totalSize = splitBytesToUnit(overview.config.maxTotalSizeBytes ?? 137438953472);
    setMaxTotalSizeAmount(totalSize.amount);
    setMaxTotalSizeUnit(totalSize.unit);
  }, [overview?.config]);

  return (
    <PageShell
      eyebrow="Provider"
      title="My Provider"
      description="Manage your own TON Storage provider: initialize the daemon, update offer parameters, and inspect accepted storage contracts."
    >
      {notice ? (
        <ActionNotice
          tone={notice.tone}
          title={notice.title}
          description={notice.description}
          details={notice.details}
        />
      ) : null}

      {errorMessage ? <EmptyState title="Provider view unavailable" description={errorMessage} /> : null}

      {!overview?.configured && !pendingDeployment ? (
        <Panel
          title="Set Up Your Provider"
          description={
            overview?.setupHint ??
            "Pick one setup path below. Existing providers still need a daemon connection step. Newly deployed providers should initialize automatically after funding."
          }
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="space-y-2">
                <h3 className="font-medium">Path A: use an existing provider</h3>
                <p className="text-sm leading-6 text-[var(--color-ink-muted)]">
                  Choose this when you already have a provider private key and provider address
                  from another VPS or an earlier setup.
                </p>
              </div>

              <form
                className="space-y-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await runMutation("import-key", "/api/my-provider/import-key", {
                    filePath: importKeyPath,
                  });
                }}
              >
                <p className="text-sm leading-6 text-[var(--color-ink-muted)]">
                  Import the existing provider key from a file already on this VPS.
                </p>
                <p className="text-sm leading-6 text-[var(--color-ink-muted)]">
                  Reuse this key only for migration or failover. Do not run the same provider
                  key from another VPS or daemon at the same time.
                </p>
                <input
                  value={importKeyPath}
                  onChange={(event) => setImportKeyPath(event.target.value)}
                  className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={busyAction === "import-key"}
                  className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {busyAction === "import-key"
                    ? "Importing Key..."
                    : "Import Existing Provider Key"}
                </button>
              </form>
            </div>

            <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="space-y-2">
                <h3 className="font-medium">Path B: create a new provider</h3>
                <p className="text-sm leading-6 text-[var(--color-ink-muted)]">
                  Choose this when you want this VPS to create and manage a brand-new provider
                  contract.
                </p>
              </div>

              <form
                className="space-y-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await runMutation("deploy", "/api/my-provider/deploy");
                }}
              >
                <p className="text-sm leading-6 text-[var(--color-ink-muted)]">
                  Deploy a new provider contract. If the daemon returns a provider address, you
                  can fund it with 1 TON and the daemon should initialize automatically afterward.
                </p>
                <button
                  type="submit"
                  disabled={busyAction === "deploy"}
                  className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {busyAction === "deploy" ? "Deploying..." : "Deploy New Provider"}
                </button>
              </form>
            </div>
          </div>

          <form
            className="mt-5 space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              await runMutation("init", "/api/my-provider/init", {
                providerAddress: initProviderAddress,
              });
            }}
          >
            <h3 className="font-medium">Final step: connect daemon to provider</h3>
            <p className="text-sm leading-6 text-[var(--color-ink-muted)]">
              This step is always required. Deploying a provider does not automatically connect
              the daemon to it. Paste the provider address you want this VPS to manage, whether
              it came from the deploy step above or already existed before this server was set up.
            </p>
            <input
              value={initProviderAddress}
              onChange={(event) => setInitProviderAddress(event.target.value)}
              placeholder="0:..."
              className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
            />
            <button
              type="submit"
              disabled={busyAction === "init"}
              className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {busyAction === "init" ? "Initializing..." : "Connect Daemon to Provider"}
            </button>
          </form>
        </Panel>
      ) : null}

      {pendingDeployment ? (
        <Panel
          title="Pending Provider Deployment"
          description="A provider has been deployed and funded, but this daemon has not confirmed initialization against it yet. This state is persisted until the daemon is confirmed connected to the same provider address."
        >
          <div className="space-y-4">
            <ActionNotice
              tone="info"
              title="Daemon connection: Initializing"
              description="After funding the provider with 1 TON, the daemon should initialize it automatically. You do not need to click a manual connect action for this newly deployed provider."
              details={[
                `Provider: ${pendingDeployment.providerAddressRaw}`,
                `Non-bounceable address: ${pendingDeployment.tonkeeperAddressFriendly}`,
                `Amount: ${pendingDeployment.amountTon} TON`,
                `Created: ${new Date(pendingDeployment.createdAt).toLocaleString()}`,
                ...(lastRefreshAt
                  ? [`Last checked: ${new Date(lastRefreshAt).toLocaleString()}`]
                  : []),
              ]}
            />
            <QrCodeCard
              value={pendingDeployment.tonkeeperLink}
              title="Tonkeeper Provider Funding QR"
              description="Scan this QR code in Tonkeeper to send the required deployment payment to the new provider address."
            />
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-ink-muted)]">
              <p className="font-medium text-[var(--color-ink)]">Provider address</p>
              <p className="mt-2 break-all">{pendingDeployment.providerAddressFriendly}</p>
              <p className="mt-1 break-all text-xs">{pendingDeployment.providerAddressRaw}</p>
            </div>
            <a
              href={pendingDeployment.tonkeeperLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Open Tonkeeper Funding Link
            </a>
            <button
              type="button"
              onClick={() => void refreshOverview()}
              disabled={busyAction === "refresh-overview"}
              className="inline-flex rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {busyAction === "refresh-overview"
                ? "Refreshing Provider Status..."
                : "Refresh Provider Status"}
            </button>
          </div>
        </Panel>
      ) : null}

      {overview?.configured ? (
        <>
          <Panel
            title="Provider Status"
            description="Current provider contract state, enriched with on-chain balance and last-activity data."
          >
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              {providerStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-ink-muted)]">
                    {item.label}
                  </p>
                  <p className="mt-2 text-base font-medium break-all">{item.value}</p>
                  {item.subvalue ? (
                    <p className="mt-1 text-xs break-all text-[var(--color-ink-muted)]">
                      {item.subvalue}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Offer Parameters"
            description="These are the on-chain provider terms clients will see when they prepare a storage request."
          >
            <form
              className="grid gap-4 lg:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                try {
                  const minimalFileSizeBytes = joinUnitToBytes(
                    minimalFileSizeAmount,
                    minimalFileSizeUnit,
                  );
                  const maximalFileSizeBytes = joinUnitToBytes(
                    maximalFileSizeAmount,
                    maximalFileSizeUnit,
                  );

                  if (maximalFileSizeBytes < minimalFileSizeBytes) {
                    showValidationNotice(
                      "Maximum file size must be greater than or equal to the minimum file size.",
                    );
                    return;
                  }

                  await runMutation("params", "/api/my-provider/params", {
                    acceptNewContracts,
                    ratePerMbDayNanoTon: tonToNanoTon(ratePerMbDayTon),
                    maxSpanSeconds: joinUnitToSeconds(
                      timeBetweenProofAmount,
                      timeBetweenProofUnit,
                    ),
                    minimalFileSizeBytes,
                    maximalFileSizeBytes,
                  });
                } catch (error) {
                  showValidationNotice(
                    error instanceof Error
                      ? error.message
                      : "The provider parameters could not be validated.",
                  );
                }
              }}
            >
              <label className="space-y-2 text-sm">
                <span className="font-medium">Accept new contracts</span>
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
                  <input
                    type="checkbox"
                    checked={acceptNewContracts}
                    onChange={(event) => setAcceptNewContracts(event.target.checked)}
                  />
                  <span>{acceptNewContracts ? "Enabled" : "Disabled"}</span>
                </div>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Rate per MB/day (TON)</span>
                <input
                  value={ratePerMbDayTon}
                  onChange={(event) => setRatePerMbDayTon(event.target.value)}
                  inputMode="decimal"
                  className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3"
                />
                <p className="text-xs leading-5 text-[var(--color-ink-muted)]">
                  Enter the client price in TON per MB per day. The daemon stores this internally
                  in nanoTON with up to 9 decimal places.
                </p>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Time between storage proofs</span>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
                  <input
                    value={timeBetweenProofAmount}
                    onChange={(event) => setTimeBetweenProofAmount(event.target.value)}
                    inputMode="numeric"
                    className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3"
                  />
                  <select
                    value={timeBetweenProofUnit}
                    onChange={(event) =>
                      setTimeBetweenProofUnit(event.target.value as ProofIntervalUnit)
                    }
                    className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3"
                  >
                    <option value="seconds">Seconds</option>
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
                <p className="text-xs leading-5 text-[var(--color-ink-muted)]">
                  This matches the provider&apos;s proof interval and is stored internally as
                  whole seconds. I did not find a stricter TON-documented min/max beyond valid
                  positive whole-second values.
                </p>
              </label>
              <SizeInput
                label="Minimum file size"
                amount={minimalFileSizeAmount}
                unit={minimalFileSizeUnit}
                onAmountChange={setMinimalFileSizeAmount}
                onUnitChange={setMinimalFileSizeUnit}
                helper="Stored internally as whole bytes. No stricter TON-documented minimum or maximum was found beyond valid non-negative byte values."
              />
              <SizeInput
                label="Maximum file size"
                amount={maximalFileSizeAmount}
                unit={maximalFileSizeUnit}
                onAmountChange={setMaximalFileSizeAmount}
                onUnitChange={setMaximalFileSizeUnit}
                helper="Stored internally as whole bytes. Make sure this remains greater than or equal to the minimum file size."
              />
              <div className="lg:col-span-2">
                <button
                  type="submit"
                  disabled={busyAction === "params"}
                  className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {busyAction === "params" ? "Updating Parameters..." : "Save Provider Parameters"}
                </button>
              </div>
            </form>
          </Panel>

          <Panel
            title="Capacity Configuration"
            description="Local daemon limits that control how many contracts and how much total data this provider will accept."
          >
            <form
              className="grid gap-4 lg:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                try {
                  await runMutation("config", "/api/my-provider/config", {
                    maxContracts: Number(maxContracts),
                    maxTotalSizeBytes: joinUnitToBytes(maxTotalSizeAmount, maxTotalSizeUnit),
                  });
                } catch (error) {
                  showValidationNotice(
                    error instanceof Error
                      ? error.message
                      : "The capacity limits could not be validated.",
                  );
                }
              }}
            >
              <label className="space-y-2 text-sm">
                <span className="font-medium">Max contracts</span>
                <input
                  value={maxContracts}
                  onChange={(event) => setMaxContracts(event.target.value)}
                  inputMode="numeric"
                  className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3"
                />
              </label>
              <SizeInput
                label="Max total size"
                amount={maxTotalSizeAmount}
                unit={maxTotalSizeUnit}
                onAmountChange={setMaxTotalSizeAmount}
                onUnitChange={setMaxTotalSizeUnit}
                helper="This is a daemon-side capacity limit stored internally as whole bytes. I did not find stricter TON-documented bounds beyond safe non-negative values."
              />
              <div className="lg:col-span-2 grid gap-3 text-sm text-[var(--color-ink-muted)] md:grid-cols-2">
                <p>
                  Current contracts: {overview.config?.currentContracts ?? "Unknown"}
                </p>
                <p>Max total size: {overview.config?.maxTotalSizeLabel ?? "Unknown"}</p>
              </div>
              <div className="lg:col-span-2">
                <button
                  type="submit"
                  disabled={busyAction === "config"}
                  className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {busyAction === "config" ? "Updating Capacity..." : "Save Capacity Limits"}
                </button>
              </div>
            </form>
          </Panel>

          <Panel
            title="Accepted Contracts"
            description="Contracts this provider address appears to have accepted recently. Duration and expiry are estimated from each contract’s current balance and rate."
          >
            {overview.contracts.length > 0 ? (
              <div className="space-y-4">
                {overview.contracts.map((contract) => (
                  <ProviderContractCard
                    key={contract.addressRaw}
                    contract={contract}
                    isClosing={busyAction === `close:${contract.addressRaw}`}
                    onClose={(contractAddress, confirmation) =>
                      runMutation(
                        `close:${contractAddress}`,
                        "/api/my-provider/contracts/close",
                        {
                          contractAddress,
                          confirmation,
                        },
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No accepted contracts found"
                description="Once this provider address accepts contracts, they will show up here with bag IDs, durations, and close controls."
              />
            )}
          </Panel>

          {overview.rawInfo ? (
            <Panel
              title="Raw Provider Info"
              description="Direct JSON from get-provider-info --contracts --balances --json for troubleshooting and validation."
            >
              <pre className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs leading-6 text-[var(--color-ink-muted)]">
                {JSON.stringify(overview.rawInfo, null, 2)}
              </pre>
            </Panel>
          ) : null}
        </>
      ) : null}
    </PageShell>
  );
}
