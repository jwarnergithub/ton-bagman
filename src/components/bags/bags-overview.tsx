import Link from "next/link";
import { PageShell } from "@/src/components/shared/page-shell";
import { DataPill } from "@/src/components/shared/data-pill";
import { EmptyState } from "@/src/components/shared/empty-state";
import { Panel } from "@/src/components/shared/panel";
import { withTonStorageService } from "@/src/server/ton-storage/runtime";
import type { BagSummary } from "@/src/server/ton-storage/types";

type ManagedBagRow = {
  bag: BagSummary;
  peersCount: number | null;
  isSeedingNow: boolean | null;
};

function isUploadActive(uploadRate: string | null) {
  if (!uploadRate) {
    return null;
  }

  const normalized = uploadRate.trim().toUpperCase();

  if (!normalized || normalized === "UNKNOWN" || normalized === "COMPLETED") {
    return null;
  }

  if (/^0(?:\.0+)?\s*[KMGT]?B\/S$/.test(normalized)) {
    return false;
  }

  return true;
}

async function getBagList() {
  try {
    const result = await withTonStorageService(async (service) => {
      const bagList = await service.listBags();
      const rows = await Promise.all(
        bagList.items.map(async (bag) => {
          try {
            const peers = await service.getBagPeers(bag.id);

            return {
              bag,
              peersCount: peers.items.length,
              isSeedingNow: isUploadActive(bag.uploadRate),
            } satisfies ManagedBagRow;
          } catch {
            return {
              bag,
              peersCount: null,
              isSeedingNow: isUploadActive(bag.uploadRate),
            } satisfies ManagedBagRow;
          }
        }),
      );

      return {
        bagList,
        rows,
      };
    });

    return {
      result,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error.message : "Bag list unavailable.",
    };
  }
}

function BagRow({ row }: { row: ManagedBagRow }) {
  const { bag, peersCount, isSeedingNow } = row;

  return (
    <Link
      href={`/bags/${bag.id}`}
      className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 transition hover:border-[var(--color-accent)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)]"
    >
      <div className="space-y-2">
        <p className="font-medium">{bag.description ?? "Untitled bag"}</p>
        <p className="text-xs break-all text-[var(--color-ink-muted)]">{bag.id}</p>
      </div>
      <div className="text-sm text-[var(--color-ink-muted)]">
        <p>Downloaded: {bag.downloaded ? `${bag.downloaded.completed}/${bag.downloaded.total}` : "Unknown"}</p>
        <p>Total: {bag.total ?? "Unknown"}</p>
      </div>
      <div className="text-sm text-[var(--color-ink-muted)]">
        <p>Download: {bag.downloadRate ?? "Unknown"}</p>
        <p>Upload: {bag.uploadRate ?? "Unknown"}</p>
      </div>
      <div className="text-sm text-[var(--color-ink-muted)]">
        <p>
          Seeding now:{" "}
          {isSeedingNow === null ? "Unknown" : isSeedingNow ? "Yes" : "No"}
        </p>
        <p>Peers: {peersCount ?? "Unknown"}</p>
      </div>
    </Link>
  );
}

export async function BagsOverview() {
  const { result, error } = await getBagList();

  return (
    <PageShell
      eyebrow="TON Storage Manager"
      title="Bag Management"
      description="Browse bags, see whether they are currently seeding, and inspect live network peer counts before opening the full detail view."
    >
      <Panel
        title="Current Bag List"
        description="Peer counts reflect live daemon visibility on the TON Storage network. They do not prove that an active paid storage contract exists for that bag."
      >
        {error ? (
          <EmptyState title="Bag list unavailable" description={error} />
        ) : result ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <DataPill
                label="Bags"
                value={result.bagList.totalBags !== null ? String(result.bagList.totalBags) : String(result.bagList.items.length)}
              />
            </div>
            {result.rows.length > 0 ? (
              <div className="space-y-3">
                {result.rows.map((row) => (
                  <BagRow key={row.bag.id} row={row} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No bag rows returned"
                description="The route is wired and ready; it just needs daemon output to populate this table."
              />
            )}
          </div>
        ) : null}
      </Panel>
    </PageShell>
  );
}
