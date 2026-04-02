"use client";

import dynamic from "next/dynamic";

const BagContractPanel = dynamic(
  () =>
    import("@/src/components/bags/bag-contract-panel").then(
      (mod) => mod.BagContractPanel,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 text-sm text-[var(--color-ink-muted)]">
        Loading contract tools...
      </div>
    ),
  },
);

export function BagContractPanelShell({
  bagId,
  initialProviderAddress,
}: {
  bagId: string;
  initialProviderAddress?: string | null;
}) {
  return (
    <BagContractPanel
      bagId={bagId}
      initialProviderAddress={initialProviderAddress ?? undefined}
    />
  );
}
