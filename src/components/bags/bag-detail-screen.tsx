import Link from "next/link";
import { BagActions } from "@/src/components/bags/bag-actions";
import { BagContractPanelShell } from "@/src/components/bags/bag-contract-panel-shell";
import { PageShell } from "@/src/components/shared/page-shell";
import { DataPill } from "@/src/components/shared/data-pill";
import { EmptyState } from "@/src/components/shared/empty-state";
import { KeyValueList } from "@/src/components/shared/key-value-list";
import { Panel } from "@/src/components/shared/panel";
import { getManagedBagSourceRecord } from "@/src/server/files/managedBagSources";
import type { BagDetailResult } from "@/src/server/ton-storage/types";
import { parseBagId } from "@/src/server/ton-storage/validators";
import { withTonStorageService } from "@/src/server/ton-storage/runtime";

type BagDetailScreenProps = {
  bagId: string;
  initialProviderAddress?: string | null;
};

async function getBagDetailData(bagId: string) {
  try {
    const validatedBagId = parseBagId(bagId);

    const [detail, peers] = await Promise.all([
      withTonStorageService((service) => service.getBagById(validatedBagId)),
      withTonStorageService((service) => service.getBagPeers(validatedBagId)),
    ]);
    const managedSource = await getManagedBagSourceRecord(validatedBagId);

    return {
      detail,
      peers,
      managedSource,
      error: null,
    };
  } catch (error) {
    return {
      detail: null,
      peers: null,
      managedSource: null,
      error: error instanceof Error ? error.message : "Bag detail unavailable.",
    };
  }
}

function getBagPageTitle(detail: BagDetailResult) {
  const description = detail.item.description?.trim();

  if (description && description !== detail.item.id) {
    return description;
  }

  return `Bag ${detail.item.id.slice(0, 18)}...`;
}

export async function BagDetailScreen({
  bagId,
  initialProviderAddress = null,
}: BagDetailScreenProps) {
  const { detail, peers, managedSource, error } = await getBagDetailData(bagId);

  return (
    <PageShell
      eyebrow="Bag Detail"
      title={detail ? getBagPageTitle(detail) : "Bag Details"}
      description="Inspect a bag, the files the parser found, and any live network peers reported by the daemon."
    >
      <div className="flex">
        <Link href="/" className="text-sm font-medium text-[var(--color-accent-strong)]">
          Back to bag list
        </Link>
      </div>

      {error || !detail ? (
        <Panel title="Bag detail unavailable">
          <EmptyState
            title="This bag could not be loaded"
            description={error ?? "The server could not retrieve bag data."}
          />
        </Panel>
      ) : (
        <>
          <Panel title="Overview" description="Parsed top-level values from the TON bag detail output.">
            <div className="mb-4 flex flex-wrap gap-3">
              <DataPill label="Bag ID" value={detail.item.id.slice(0, 16) + "..."} />
              <DataPill
                label="Downloaded"
                value={
                  detail.item.downloaded
                    ? `${detail.item.downloaded.completed}/${detail.item.downloaded.total}`
                    : "Unknown"
                }
              />
              <DataPill label="Total" value={detail.item.total ?? "Unknown"} />
            </div>
            <KeyValueList
              items={Object.entries(detail.item.rawDetails).map(([label, value]) => ({
                label,
                value,
              }))}
            />
          </Panel>

          <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <Panel title="Files" description="File rows parsed from the bag detail output.">
              {detail.item.files.length > 0 ? (
                <div className="space-y-3">
                  {detail.item.files.map((file) => (
                    <div
                      key={`${file.index}-${file.name}`}
                      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-medium">{file.name}</p>
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                          Priority {file.priority ?? "n/a"}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                        Downloaded:{" "}
                        {file.downloaded
                          ? `${file.downloaded.completed}/${file.downloaded.total}`
                          : "Unknown"}
                        {" • "}Total: {file.total ?? "Unknown"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No files parsed"
                  description="The bag detail route returned no file rows the parser could use."
                />
              )}
            </Panel>

            <Panel
              title="Peers"
              description="Peers are live TON Storage nodes your daemon can currently see for this bag. This is separate from whether any paid storage contract is active."
            >
              {peers && peers.items.length > 0 ? (
                <div className="space-y-3">
                  {peers.items.map((peer) => (
                    <div
                      key={`${peer.address}-${peer.adnl ?? "unknown"}`}
                      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm"
                    >
                      <p className="font-medium">{peer.address}</p>
                      <p className="mt-2 text-[var(--color-ink-muted)]">
                        ADNL: {peer.adnl ?? "Unknown"}
                      </p>
                      <p className="text-[var(--color-ink-muted)]">
                        Up: {peer.uploadRate ?? "Unknown"} {" • "}Down:{" "}
                        {peer.downloadRate ?? "Unknown"}
                      </p>
                      <p className="text-[var(--color-ink-muted)]">
                        Ready parts: {peer.readyParts ?? "Unknown"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No peers returned"
                  description="Peer inspection is connected, but the daemon did not return any peer rows."
                />
              )}
            </Panel>
          </section>

          <Panel
            title="Bag Actions"
            description="Pause or resume download, export metadata, and manage app-tracked source recovery paths."
          >
            <BagActions
              bagId={detail.item.id}
              managedSource={
                managedSource
                  ? {
                      workflow: managedSource.workflow,
                      preparedPath: managedSource.preparedPath,
                      originalPath: managedSource.originalPath,
                      movedItems: managedSource.movedItems,
                    }
                  : null
              }
            />
          </Panel>

          <div id="storage-contracts">
            <Panel
              title="Storage Contracts"
              description="Generate Tonkeeper links to start or cancel storage contracts, and inspect discovered contracts for this bag by wallet address."
            >
              <BagContractPanelShell
                bagId={detail.item.id}
                initialProviderAddress={initialProviderAddress}
              />
            </Panel>
          </div>
        </>
      )}
    </PageShell>
  );
}
