"use client";

import dynamic from "next/dynamic";
import type { StorageProviderSummary } from "@/src/server/tonapi/types";

const ProvidersClient = dynamic(
  () =>
    import("@/src/components/providers/providers-client").then(
      (mod) => mod.ProvidersClient,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 text-sm text-[var(--color-ink-muted)]">
        Loading provider filters...
      </div>
    ),
  },
);

export function ProvidersClientShell({
  providers,
  fetchedAt,
}: {
  providers: StorageProviderSummary[];
  fetchedAt: string;
}) {
  return <ProvidersClient providers={providers} fetchedAt={fetchedAt} />;
}
