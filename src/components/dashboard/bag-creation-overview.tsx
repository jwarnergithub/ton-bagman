import { AddByHashForm } from "@/src/components/bags/add-by-hash-form";
import { AddByMetaForm } from "@/src/components/bags/add-by-meta-form";
import { CreateBagForm } from "@/src/components/bags/create-bag-form";
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
import { listRemoteFiles } from "@/src/server/files/remoteFiles";
import { listStagedFiles } from "@/src/server/files/staging";

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

async function getCreationWorkspaceData() {
  const uploads = await listStagedFiles();
  let remoteFiles = null;
  let remoteFileError: string | null = null;

  try {
    remoteFiles = await listRemoteFiles();
  } catch (error) {
    remoteFileError =
      error instanceof Error ? error.message : "Remote file listing is unavailable.";
  }

  return {
    uploads,
    remoteFiles,
    remoteFileError,
  };
}

export async function BagCreationOverview() {
  const data = await getCreationWorkspaceData();

  return (
    <PageShell
      eyebrow="Bag Creation"
      title="Create and Import Bags"
      description="Use this workspace to stage local files, transfer them to the VPS, and build or import bags without cluttering the bag-management home page."
    >
      <TransferSuccessBanner />

      <section className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
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

      <section className="grid gap-5 lg:grid-cols-3">
        <Panel title="Create Bag" description="Calls the documented `create` command through the API layer.">
          <CreateBagForm />
        </Panel>
        <Panel title="Add By Hash" description="Calls `add-by-hash` for a known bag hash.">
          <AddByHashForm />
        </Panel>
        <Panel title="Add By Meta" description="Calls `add-by-meta` for an existing meta file.">
          <AddByMetaForm />
        </Panel>
      </section>
    </PageShell>
  );
}
