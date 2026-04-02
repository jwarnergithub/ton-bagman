import Link from "next/link";
import { CreateBagFromUploadsForm } from "@/src/components/dashboard/create-bag-from-uploads-form";
import { RemoteUploadsTree } from "@/src/components/dashboard/remote-uploads-tree";
import { StagedWorkspaceTree } from "@/src/components/dashboard/staged-workspace-tree";
import { PageShell } from "@/src/components/shared/page-shell";
import { DataPill } from "@/src/components/shared/data-pill";
import { EmptyState } from "@/src/components/shared/empty-state";
import { Panel } from "@/src/components/shared/panel";
import { StagedTransferAllForm } from "@/src/components/shared/staged-transfer-all-form";
import { TransferSuccessBanner } from "@/src/components/shared/transfer-success-banner";
import { UploadForm } from "@/src/components/shared/upload-form";
import { getRuntimeConfig } from "@/src/server/config/env";
import { listRemoteFiles } from "@/src/server/files/remoteFiles";
import { listStagedFiles } from "@/src/server/files/staging";
import { getSshConnectionSummary } from "@/src/server/ssh/client";
import { withTonStorageService } from "@/src/server/ton-storage/runtime";
import type { BagListResult } from "@/src/server/ton-storage/types";

async function getDashboardData() {
  const uploads = await listStagedFiles();
  let remoteFiles = null;
  let remoteFileError: string | null = null;

  try {
    remoteFiles = await listRemoteFiles();
  } catch (error) {
    remoteFileError =
      error instanceof Error ? error.message : "Remote file listing is unavailable.";
  }

  try {
    const config = getRuntimeConfig();
    const health = getSshConnectionSummary(config);
    const bags = await withTonStorageService((service) => service.listBags());

    return {
      health,
      bags,
      uploads,
      remoteFiles,
      remoteFileError,
      tonError: null,
    };
  } catch (error) {
    return {
      health: null,
      bags: null,
      uploads,
      remoteFiles,
      remoteFileError,
      tonError: error instanceof Error ? error.message : "TON data is unavailable.",
    };
  }
}

function BagSnapshot({ bags }: { bags: BagListResult | null }) {
  if (!bags || bags.items.length === 0) {
    return (
      <EmptyState
        title="No bags available"
        description="Once the daemon returns bag data, this panel will show the current bag list and link into the detail screen."
      />
    );
  }

  return (
    <div className="space-y-3">
      {bags.items.slice(0, 5).map((bag) => (
        <Link
          key={bag.id}
          href={`/bags/${bag.id}`}
          className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 transition hover:border-[var(--color-accent)]"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium">{bag.description ?? bag.id}</p>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
              {bag.downloadRate ?? "Unknown"}
            </p>
          </div>
          <p className="text-xs break-all text-[var(--color-ink-muted)]">{bag.id}</p>
        </Link>
      ))}
    </div>
  );
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${sizeBytes} B`;
}

export async function DashboardOverview() {
  const data = await getDashboardData();

  return (
    <PageShell
      eyebrow="TON Storage Manager"
      title="Dashboard"
      description="A first-pass control surface for connection health, bag visibility, uploads, and guarded operations."
    >
      <TransferSuccessBanner />

      <section className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <Panel
          title="Connection Health"
          description="Current runtime summary from the server-side SSH configuration."
          actions={
            <Link
              href="/settings"
              className="text-sm font-medium text-[var(--color-accent-strong)]"
            >
              Open settings
            </Link>
          }
        >
          {data.health ? (
            <div className="flex flex-wrap gap-3">
              <DataPill label="Host" value={data.health.host} />
              <DataPill label="Port" value={String(data.health.port)} />
              <DataPill label="User" value={data.health.user} />
              <DataPill label="Auth" value={data.health.authMode} />
            </div>
          ) : (
            <EmptyState
              title="Connection not ready"
              description={data.tonError ?? "The runtime configuration is incomplete."}
            />
          )}
        </Panel>

        <Panel
          title="Uploads"
          description="Build one staged workspace from local files and folders, then upload the whole workspace to the VPS in a single batch."
        >
          <div className="mb-4 flex flex-wrap gap-3">
            <DataPill label="Staged files" value={String(data.uploads.totalFiles)} />
            <DataPill label="Total size" value={formatBytes(data.uploads.totalBytes)} />
            <DataPill label="Mode" value={data.uploads.source} />
          </div>
          <UploadForm />
          <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
            {data.uploads.items.length > 0 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="font-medium">Current staged workspace</p>
                  <p className="text-xs leading-5 text-[var(--color-ink-muted)]">
                    Every file and folder listed here will be uploaded together to the remote
                    uploads directory, preserving relative paths.
                  </p>
                </div>
                <div className="max-h-80 overflow-y-auto rounded-2xl border border-dashed border-[var(--color-border)] px-3 py-3">
                  <StagedWorkspaceTree items={data.uploads.items} />
                </div>
                <StagedTransferAllForm />
              </div>
            ) : (
              <EmptyState
                title="No staged workspace yet"
                description="Add files or folders above and they will appear here as one workspace."
              />
            )}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title="Bag Snapshot"
          description="Recent bags surfaced through the TON service layer. Use the bag list page for a broader view."
          actions={
            <Link
              href="/bags"
              className="text-sm font-medium text-[var(--color-accent-strong)]"
            >
              View all bags
            </Link>
          }
        >
          {data.tonError ? (
            <EmptyState title="Bag data unavailable" description={data.tonError} />
          ) : (
            <BagSnapshot bags={data.bags} />
          )}
        </Panel>

        <Panel
          title="Remote Upload Directory"
          description="Everything currently in the VPS uploads directory. Use one action to turn the whole uploads workspace into a single bag."
        >
          {data.remoteFileError ? (
            <EmptyState title="Remote files unavailable" description={data.remoteFileError} />
          ) : data.remoteFiles && data.remoteFiles.items.length > 0 ? (
            <div className="space-y-3">
              <CreateBagFromUploadsForm />
              <p className="text-xs leading-5 text-[var(--color-ink-muted)] break-all">
                {data.remoteFiles.directory}
              </p>
              <div className="max-h-96 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
                <RemoteUploadsTree
                  directory={data.remoteFiles.directory}
                  items={data.remoteFiles.items}
                />
              </div>
              <div className="text-sm leading-6 text-[var(--color-ink-muted)]">
                The button above moves everything currently in `uploads/` into the managed
                bag-source directory and creates one bag from that prepared folder.
              </div>
            </div>
          ) : (
            <EmptyState
              title="No remote files found"
              description="Transferred files and folders under the configured upload directory will appear here after refresh."
            />
          )}
        </Panel>
      </section>
    </PageShell>
  );
}
