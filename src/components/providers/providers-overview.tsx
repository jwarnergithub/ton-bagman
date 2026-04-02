import { PageShell } from "@/src/components/shared/page-shell";
import { EmptyState } from "@/src/components/shared/empty-state";
import { Panel } from "@/src/components/shared/panel";
import { ProvidersClientShell } from "@/src/components/providers/providers-client-shell";
import { listStorageProviders } from "@/src/server/tonapi/storageProviders";

async function getProvidersData() {
  try {
    return {
      result: await listStorageProviders(),
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error.message : "Provider lookup unavailable.",
    };
  }
}

export async function ProvidersOverview() {
  const { result, error } = await getProvidersData();

  return (
    <PageShell
      eyebrow="Providers"
      title="Storage Providers"
      description="Read-only discovery view for TON Storage providers surfaced through TonAPI."
    >
      <Panel
        title="Available Providers"
        description="This list shows providers currently returned by TonAPI. Rates are displayed in regular TON per MB per day for readability, and last activity is enriched from each provider account."
      >
        {error ? (
          <EmptyState title="Providers unavailable" description={error} />
        ) : result ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 text-sm leading-6 text-[var(--color-ink-muted)]">
              <p className="font-medium text-[var(--color-ink)]">About storage proofs</p>
              <p className="mt-2">
                Time between storage proofs tells you how often a provider is expected to prove
                that they are still storing your data.
              </p>
              <p>Smaller times mean proofs happen more often.</p>
              <p>Larger times mean proofs can be less frequent.</p>
            </div>

            {result.providers.length > 0 ? (
              <ProvidersClientShell providers={result.providers} fetchedAt={result.fetchedAt} />
            ) : (
              <EmptyState
                title="No providers returned"
                description="TonAPI responded successfully, but the provider list was empty."
              />
            )}
          </div>
        ) : null}
      </Panel>
    </PageShell>
  );
}
