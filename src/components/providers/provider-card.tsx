import type { ReactNode } from "react";
import { USD_RATE_DISCLAIMER } from "@/src/components/providers/rate-display";
import { DataPill } from "@/src/components/shared/data-pill";
import type { StorageProviderSummary } from "@/src/server/tonapi/types";

type ProviderCardProps = {
  provider: StorageProviderSummary;
  footer?: ReactNode;
};

export function ProviderCard({ provider, footer = null }: ProviderCardProps) {
  return (
    <article className="space-y-4 rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[var(--color-ink)]">Provider</p>
        <p className="text-xs leading-6 text-[var(--color-ink-muted)] [overflow-wrap:anywhere]">
          {provider.address}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <DataPill
          label="Accepting"
          value={provider.acceptNewContracts ? "Yes" : "No"}
        />
        <DataPill label="Last Activity" value={provider.lastActivityLabel} />
        <DataPill label="Time Between Storage Proofs" value={provider.maxSpanLabel} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-panel)] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
            Rate
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--color-ink)]">
            {provider.ratePerMbDayTon} TON / MB / day
            {provider.ratePerMbDayUsd ? ` (${provider.ratePerMbDayUsd})` : ""}
          </p>
          {provider.ratePerMbDayUsd ? (
            <p className="mt-2 text-xs leading-5 text-[var(--color-ink-muted)]">
              {USD_RATE_DISCLAIMER}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-panel)] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
            Min file size
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--color-ink)]">
            {provider.minimalFileSizeLabel}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-panel)] px-4 py-3 sm:col-span-2">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
            Max file size
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--color-ink)]">
            {provider.maximalFileSizeLabel}
          </p>
        </div>
      </div>

      {footer ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-panel)] px-4 py-4">
          {footer}
        </div>
      ) : null}
    </article>
  );
}
