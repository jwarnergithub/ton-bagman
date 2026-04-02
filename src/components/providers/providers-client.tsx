"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProviderCard } from "@/src/components/providers/provider-card";
import { ActionNotice } from "@/src/components/shared/action-notice";
import { DataPill } from "@/src/components/shared/data-pill";
import { EmptyState } from "@/src/components/shared/empty-state";
import type { ApiSuccessResponse } from "@/src/server/api/responses";
import type { StorageProviderSummary } from "@/src/server/tonapi/types";
import type { BagListResult } from "@/src/server/ton-storage/types";

type ProvidersClientProps = {
  providers: StorageProviderSummary[];
  fetchedAt: string;
};

type SortMode = "price-asc" | "price-desc" | "activity-desc" | "activity-asc";

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString();
}

function sortProviders(providers: StorageProviderSummary[], sortMode: SortMode) {
  return [...providers].sort((left, right) => {
    if (sortMode === "price-asc") {
      return left.ratePerMbDayTonValue - right.ratePerMbDayTonValue;
    }

    if (sortMode === "price-desc") {
      return right.ratePerMbDayTonValue - left.ratePerMbDayTonValue;
    }

    const leftActivity = left.lastActivityUnix;
    const rightActivity = right.lastActivityUnix;

    if (leftActivity === null && rightActivity === null) {
      return left.ratePerMbDayTonValue - right.ratePerMbDayTonValue;
    }

    if (leftActivity === null) {
      return 1;
    }

    if (rightActivity === null) {
      return -1;
    }

    return sortMode === "activity-desc"
      ? rightActivity - leftActivity
      : leftActivity - rightActivity;
  });
}

async function readJson<T>(response: Response) {
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
      ok: false as const,
      errorMessage:
        "error" in payload ? payload.error?.message ?? "Request failed." : "Request failed.",
    };
  }

  return {
    ok: true as const,
    data: payload.data,
  };
}

export function ProvidersClient({ providers, fetchedAt }: ProvidersClientProps) {
  const [acceptingOnly, setAcceptingOnly] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("activity-desc");
  const [minRate, setMinRate] = useState("");
  const [maxRate, setMaxRate] = useState("");
  const [offeringProviderAddress, setOfferingProviderAddress] = useState<string | null>(null);
  const [bagsResult, setBagsResult] = useState<{
    ok: boolean;
    data?: BagListResult;
    errorMessage?: string;
  } | null>(null);
  const [isLoadingBags, setIsLoadingBags] = useState(false);

  const filteredProviders = useMemo(() => {
    const minValue = minRate.trim() === "" ? null : Number(minRate);
    const maxValue = maxRate.trim() === "" ? null : Number(maxRate);

    const filtered = providers
      .filter((provider) => !acceptingOnly || provider.acceptNewContracts)
      .filter((provider) => minValue === null || provider.ratePerMbDayTonValue >= minValue)
      .filter((provider) => maxValue === null || provider.ratePerMbDayTonValue <= maxValue);

    return sortProviders(filtered, sortMode);
  }, [acceptingOnly, maxRate, minRate, providers, sortMode]);

  async function startOfferFlow(providerAddress: string) {
    setOfferingProviderAddress(providerAddress);

    if (bagsResult?.ok && bagsResult.data) {
      return;
    }

    setIsLoadingBags(true);

    try {
      const response = await fetch("/api/bags?hashes=1");
      setBagsResult(await readJson<BagListResult>(response));
    } finally {
      setIsLoadingBags(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <DataPill label="Providers" value={String(filteredProviders.length)} />
        <DataPill label="Fetched" value={formatTime(fetchedAt)} />
      </div>

      <div className="grid gap-3 rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 lg:grid-cols-[1fr_0.7fr_0.7fr_0.7fr]">
        <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
          <input
            type="checkbox"
            checked={acceptingOnly}
            onChange={(event) => setAcceptingOnly(event.target.checked)}
          />
          <span>Only show providers accepting new contracts</span>
        </label>

        <label className="block space-y-2 text-sm">
          <span className="font-medium">Sort providers</span>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm text-[var(--color-ink)]"
          >
            <option value="price-asc">Lowest price to highest</option>
            <option value="price-desc">Highest price to lowest</option>
            <option value="activity-desc">Most recent activity first</option>
            <option value="activity-asc">Oldest activity first</option>
          </select>
        </label>

        <label className="block space-y-2 text-sm">
          <span className="font-medium">Min TON / MB / day</span>
          <input
            value={minRate}
            onChange={(event) => setMinRate(event.target.value)}
            inputMode="decimal"
            placeholder="0.000001"
            className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
          />
        </label>

        <label className="block space-y-2 text-sm">
          <span className="font-medium">Max TON / MB / day</span>
          <input
            value={maxRate}
            onChange={(event) => setMaxRate(event.target.value)}
            inputMode="decimal"
            placeholder="0.1"
            className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
          />
        </label>
      </div>

      {filteredProviders.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredProviders.map((provider) => (
            <ProviderCard
              key={provider.address}
              provider={provider}
              footer={
                <>
                  <button
                    type="button"
                    onClick={() => void startOfferFlow(provider.address)}
                    className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
                  >
                    Offer storage contract
                  </button>

                  {offeringProviderAddress === provider.address ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm leading-6 text-[var(--color-ink-muted)]">
                        Choose one of your bags to jump into its detail page with this provider
                        address already populated in the start-contract form.
                      </p>

                      {isLoadingBags ? (
                        <div className="text-sm text-[var(--color-ink-muted)]">
                          Loading your bags...
                        </div>
                      ) : null}

                      {bagsResult?.ok && bagsResult.data ? (
                        bagsResult.data.items.length > 0 ? (
                          <div className="space-y-2">
                            {bagsResult.data.items.map((bag) => (
                              <Link
                                key={bag.id}
                                href={`/bags/${encodeURIComponent(
                                  bag.id,
                                )}?providerAddress=${encodeURIComponent(provider.address)}#storage-contracts`}
                                className="block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm transition hover:border-[var(--color-accent)]"
                              >
                                <p className="font-medium text-[var(--color-ink)]">
                                  {bag.description?.trim() || `Bag ${bag.id.slice(0, 18)}...`}
                                </p>
                                <p className="mt-1 text-xs break-all text-[var(--color-ink-muted)]">
                                  {bag.id}
                                </p>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <EmptyState
                            title="No bags available"
                            description="Create or import a bag first, then come back here to offer a storage contract through this provider."
                          />
                        )
                      ) : null}

                      {bagsResult && !bagsResult.ok ? (
                        <ActionNotice
                          tone="error"
                          title="Bag lookup failed"
                          description={
                            bagsResult.errorMessage ??
                            "The app could not load your bags for provider handoff."
                          }
                        />
                      ) : null}
                    </div>
                  ) : null}
                </>
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No providers match these filters"
          description="Try widening the rate range or showing providers that are not currently accepting new contracts."
        />
      )}
    </div>
  );
}
