"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionNotice } from "@/src/components/shared/action-notice";
import { JsonResult } from "@/src/components/shared/json-result";

type ManagedSourceInfo = {
  workflow: "uploads-directory" | "remote-item";
  preparedPath: string;
  originalPath: string;
  movedItems: string[];
};

type BagActionsProps = {
  bagId: string;
  managedSource: ManagedSourceInfo | null;
};

type RecoveryResultState = {
  tone: "success" | "error" | "info";
  title: string;
  description: string;
  details?: string[];
};

export function BagActions({ bagId, managedSource }: BagActionsProps) {
  const router = useRouter();
  const [metaOutputPath, setMetaOutputPath] = useState("");
  const [pauseResult, setPauseResult] = useState<{ ok: boolean; payload: string } | null>(null);
  const [resumeResult, setResumeResult] = useState<{ ok: boolean; payload: string } | null>(null);
  const [pauseUploadResult, setPauseUploadResult] = useState<{ ok: boolean; payload: string } | null>(null);
  const [resumeUploadResult, setResumeUploadResult] = useState<{ ok: boolean; payload: string } | null>(null);
  const [metaResult, setMetaResult] = useState<{ ok: boolean; payload: string } | null>(null);
  const [recoverConfirmation, setRecoverConfirmation] = useState("");
  const [recoveryResult, setRecoveryResult] = useState<RecoveryResultState | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [removeBagConfirmation, setRemoveBagConfirmation] = useState("");
  const [removeBagWithFilesConfirmation, setRemoveBagWithFilesConfirmation] = useState("");
  const [bagRemovalResult, setBagRemovalResult] = useState<RecoveryResultState | null>(null);
  const [isRemovingBag, setIsRemovingBag] = useState(false);
  const [isRemovingBagWithFiles, setIsRemovingBagWithFiles] = useState(false);

  async function submitJson(url: string, body?: object) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json();

    return {
      ok: response.ok,
      payload: JSON.stringify(payload, null, 2),
    };
  }

  async function submitRecoveryAction(
    url: string,
    confirmation: string,
    options: {
      successTitle: string;
      successDescription: string;
    },
  ) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ confirmation }),
    });
    const payload = await response.json();

    if (response.ok) {
      setRecoveryResult({
        tone: "success",
        title: options.successTitle,
        description: options.successDescription,
        details: payload.data?.destinationPaths?.length
          ? payload.data.destinationPaths.map((entry: string) => `Destination: ${entry}`)
          : payload.data?.preparedPath
            ? [`Prepared path: ${payload.data.preparedPath}`]
            : [],
      });
      router.refresh();
      return;
    }

    setRecoveryResult({
      tone: "error",
      title: "Managed source action failed",
      description: payload.error?.message ?? "The managed source action failed.",
      details: payload.error?.code ? [`Error code: ${payload.error.code}`] : [],
    });
  }

  async function submitBagRemoval(
    body: {
      removeFiles?: boolean;
      confirmation: string;
    },
    options: {
      successTitle: string;
      successDescription: string;
    },
  ) {
    const response = await fetch(`/api/bags/${bagId}/remove`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();

    if (response.ok) {
      const recoveredPaths = Array.isArray(payload.data?.recoveredDestinationPaths)
        ? payload.data.recoveredDestinationPaths
        : [];
      const details = [`Bag ID: ${payload.data?.bag?.bagId ?? bagId}`];

      if (payload.data?.managedSourcePreparedPath) {
        details.push(`Managed source path: ${payload.data.managedSourcePreparedPath}`);
      } else {
        details.push("Managed source tracking cleared from the app");
      }

      if (recoveredPaths.length > 0) {
        details.push(...recoveredPaths.map((entry: string) => `Returned to uploads: ${entry}`));
      }

      if (payload.data?.recoveryWarning) {
        details.push(payload.data.recoveryWarning);
      }

      setBagRemovalResult({
        tone: payload.data?.recoveryWarning ? "info" : "success",
        title: options.successTitle,
        description:
          payload.data?.recoveredToUploads && payload.data?.recoveryMessage
            ? payload.data.recoveryMessage
            : options.successDescription,
        details,
      });
      router.push("/bags");
      router.refresh();
      return;
    }

    setBagRemovalResult({
      tone: "error",
      title: "Bag removal failed",
      description: payload.error?.message ?? "The bag removal request failed.",
      details: payload.error?.code ? [`Error code: ${payload.error.code}`] : [],
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={async () =>
            setPauseResult(await submitJson(`/api/bags/${bagId}/download-pause`))
          }
          className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
        >
          Pause Download
        </button>
        <button
          type="button"
          onClick={async () =>
            setResumeResult(await submitJson(`/api/bags/${bagId}/download-resume`))
          }
          className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
        >
          Resume Download
        </button>
        <button
          type="button"
          onClick={async () =>
            setPauseUploadResult(await submitJson(`/api/bags/${bagId}/upload-pause`))
          }
          className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
        >
          Pause Seeding
        </button>
        <button
          type="button"
          onClick={async () =>
            setResumeUploadResult(await submitJson(`/api/bags/${bagId}/upload-resume`))
          }
          className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
        >
          Resume Seeding
        </button>
      </div>

      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setMetaResult(
            await submitJson(`/api/bags/${bagId}/meta`, {
              outputPath: metaOutputPath,
            }),
          );
        }}
        className="space-y-3"
      >
        <label className="block space-y-2 text-sm">
          <span className="font-medium">Export metadata to remote file</span>
          <input
            value={metaOutputPath}
            onChange={(event) => setMetaOutputPath(event.target.value)}
            placeholder="/var/lib/ton-storage/exported.meta"
            className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Export Metadata
        </button>
      </form>

      {pauseResult ? <JsonResult ok={pauseResult.ok} payload={pauseResult.payload} /> : null}
      {resumeResult ? (
        <JsonResult ok={resumeResult.ok} payload={resumeResult.payload} />
      ) : null}
      {pauseUploadResult ? (
        <JsonResult ok={pauseUploadResult.ok} payload={pauseUploadResult.payload} />
      ) : null}
      {resumeUploadResult ? (
        <JsonResult ok={resumeUploadResult.ok} payload={resumeUploadResult.payload} />
      ) : null}
      {metaResult ? <JsonResult ok={metaResult.ok} payload={metaResult.payload} /> : null}

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="text-sm font-semibold">TON Bag Removal</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
          These actions call the verified TON daemon command `remove &lt;bag&gt;
          [--remove-files]`.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setIsRemovingBag(true);
              setBagRemovalResult(null);

              try {
                await submitBagRemoval(
                  {
                    confirmation: removeBagConfirmation,
                  },
                  {
                    successTitle: "Bag removed",
                    successDescription:
                      "The TON bag was removed. Files were left on disk, and app tracking for this bag was cleared.",
                  },
                );
              } finally {
                setIsRemovingBag(false);
              }
            }}
            className="space-y-3 rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-4"
          >
            <p className="text-xs leading-5 text-[var(--color-ink-muted)]">
              Type `REMOVE BAG` to remove the bag from TON Storage without asking TON to delete its
              files.
            </p>
            <input
              value={removeBagConfirmation}
              onChange={(event) => setRemoveBagConfirmation(event.target.value)}
              placeholder="REMOVE BAG"
              className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
            />
            <button
              type="submit"
              disabled={isRemovingBag}
              className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRemovingBag ? "Removing bag..." : "Remove bag only"}
            </button>
          </form>

          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setIsRemovingBagWithFiles(true);
              setBagRemovalResult(null);

              try {
                await submitBagRemoval(
                  {
                    removeFiles: true,
                    confirmation: removeBagWithFilesConfirmation,
                  },
                  {
                    successTitle: "Bag and files removed",
                    successDescription:
                      "The TON bag was removed with `--remove-files`. Any tracked managed-source record was cleared.",
                  },
                );
              } finally {
                setIsRemovingBagWithFiles(false);
              }
            }}
            className="space-y-3 rounded-2xl border border-dashed border-rose-200 px-4 py-4"
          >
            <p className="text-xs leading-5 text-[var(--color-ink-muted)]">
              Type `REMOVE BAG AND FILES` to call the daemon remove command with
              `--remove-files`.
            </p>
            <input
              value={removeBagWithFilesConfirmation}
              onChange={(event) => setRemoveBagWithFilesConfirmation(event.target.value)}
              placeholder="REMOVE BAG AND FILES"
              className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
            />
            <button
              type="submit"
              disabled={isRemovingBagWithFiles}
              className="rounded-full bg-rose-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRemovingBagWithFiles ? "Removing bag and files..." : "Remove bag and files"}
            </button>
          </form>
        </div>

        {bagRemovalResult ? (
          <div className="mt-4">
            <ActionNotice
              tone={bagRemovalResult.tone}
              title={bagRemovalResult.title}
              description={bagRemovalResult.description}
              details={bagRemovalResult.details}
            />
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="text-sm font-semibold">Managed Source Recovery</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
          These controls only manage the app-prepared source contents used to create this bag.
          Use them when you want to copy the original contents back into `uploads/` as the base
          for a new bag, without breaking the current bag source.
        </p>

        {managedSource ? (
          <div className="mt-4 space-y-4">
            <div className="space-y-1 text-sm text-[var(--color-ink-muted)]">
              <p>
                <span className="font-medium text-[var(--color-ink)]">Workflow:</span>{" "}
                {managedSource.workflow === "uploads-directory"
                  ? "Uploads workspace"
                  : "Single remote item"}
              </p>
              <p className="[overflow-wrap:anywhere]">
                <span className="font-medium text-[var(--color-ink)]">Prepared path:</span>{" "}
                {managedSource.preparedPath}
              </p>
              <p className="[overflow-wrap:anywhere]">
                <span className="font-medium text-[var(--color-ink)]">Original source:</span>{" "}
                {managedSource.originalPath}
              </p>
            </div>

            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setIsRecovering(true);
                setRecoveryResult(null);

                try {
                  await submitRecoveryAction(
                    `/api/bags/${bagId}/recover-to-uploads`,
                    recoverConfirmation,
                    {
                      successTitle: "Copied to uploads",
                      successDescription:
                        "The managed source contents were copied into the uploads directory so you can build a new bag without altering the original bag source.",
                    },
                  );
                } finally {
                  setIsRecovering(false);
                }
              }}
              className="space-y-3 rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-4"
            >
              <p className="text-xs leading-5 text-[var(--color-ink-muted)]">
                Type `COPY BACK` to copy the prepared contents into the uploads directory. The
                original managed source stays in place so the current bag still points to valid
                data.
              </p>
              <input
                value={recoverConfirmation}
                onChange={(event) => setRecoverConfirmation(event.target.value)}
                placeholder="COPY BACK"
                className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
              />
              <button
                type="submit"
                disabled={isRecovering}
                className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRecovering ? "Copying back..." : "Copy contents to uploads"}
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-4">
            <ActionNotice
              tone="info"
              title="No managed source record"
              description="This bag was not created through a tracked app-managed source flow, so there are no recovery actions available here."
            />
          </div>
        )}

        {recoveryResult ? (
          <div className="mt-4">
            <ActionNotice
              tone={recoveryResult.tone}
              title={recoveryResult.title}
              description={recoveryResult.description}
              details={recoveryResult.details}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
