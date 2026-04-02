"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionNotice } from "@/src/components/shared/action-notice";

type StagedTransferFormProps = {
  stagedFileId: string;
  defaultRemotePath: string;
};

type TransferResultState = {
  tone: "success" | "error";
  title: string;
  description: string;
  details?: string[];
};

const LAST_TRANSFER_STORAGE_KEY = "ton-bagman:last-transfer";

export function StagedTransferForm({
  stagedFileId,
  defaultRemotePath,
}: StagedTransferFormProps) {
  const router = useRouter();
  const [remotePath, setRemotePath] = useState(defaultRemotePath);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<TransferResultState | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/uploads/transfer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          stagedFileId,
          remotePath,
        }),
      });
      const payload = await response.json();

      if (response.ok) {
        window.sessionStorage.setItem(
          LAST_TRANSFER_STORAGE_KEY,
          JSON.stringify({
            remotePath: payload.data?.remotePath ?? remotePath,
            bytesTransferred: payload.data?.bytesTransferred ?? 0,
            transferredAt: new Date().toISOString(),
          }),
        );
        window.dispatchEvent(new Event("ton-bagman-transfer-changed"));
        setResult({
          tone: "success",
          title: "Transferred to the VPS",
          description: `The staged file was uploaded to ${payload.data?.remotePath ?? remotePath}.`,
          details: [
            `Transferred ${formatBytes(payload.data?.bytesTransferred ?? 0)}`,
            "The staged local copy will disappear from the list after refresh.",
          ],
        });
        router.refresh();
      } else {
        setResult({
          tone: "error",
          title: "Transfer failed",
          description:
            payload.error?.message ?? "The file could not be copied to the remote server.",
          details: payload.error?.code ? [`Error code: ${payload.error.code}`] : [],
        });
      }
    } catch (error) {
      setResult({
        tone: "error",
        title: "Transfer request failed",
        description: error instanceof Error ? error.message : "Transfer failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block space-y-2 text-sm">
        <span className="font-medium text-[var(--color-ink)]">Remote path</span>
        <input
          value={remotePath}
          onChange={(event) => setRemotePath(event.target.value)}
          className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
        />
      </label>
      <p className="text-xs leading-5 text-[var(--color-ink-muted)]">
        Relative paths are resolved under the configured remote base directory.
      </p>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Transferring..." : "Transfer To VPS"}
      </button>
      {result ? (
        <ActionNotice
          tone={result.tone}
          title={result.title}
          description={result.description}
          details={result.details}
        />
      ) : null}
    </form>
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
