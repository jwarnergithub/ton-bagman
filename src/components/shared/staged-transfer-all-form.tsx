"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionNotice } from "@/src/components/shared/action-notice";

type ResultState = {
  tone: "success" | "error";
  title: string;
  description: string;
  details?: string[];
};

const LAST_TRANSFER_STORAGE_KEY = "ton-bagman:last-transfer";

export function StagedTransferAllForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);

  async function handleTransfer() {
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/uploads/transfer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mode: "all",
        }),
      });
      const payload = await response.json();

      if (response.ok) {
        window.sessionStorage.setItem(
          LAST_TRANSFER_STORAGE_KEY,
          JSON.stringify({
            remotePath: payload.data?.remoteBaseDir ?? "",
            bytesTransferred: payload.data?.bytesTransferred ?? 0,
            transferredAt: new Date().toISOString(),
          }),
        );
        window.dispatchEvent(new Event("ton-bagman-transfer-changed"));
        setResult({
          tone: "success",
          title: "Workspace transferred to the VPS",
          description: `Uploaded ${payload.data?.transferredFiles ?? 0} file(s) into ${payload.data?.remoteBaseDir ?? "the remote uploads directory"}.`,
          details: [
            `Transferred ${formatBytes(payload.data?.bytesTransferred ?? 0)}`,
            "The local staged workspace has been cleared.",
          ],
        });
        router.refresh();
      } else {
        setResult({
          tone: "error",
          title: "Batch transfer failed",
          description:
            payload.error?.message ?? "The staged workspace could not be copied to the VPS.",
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
    <div className="space-y-3">
      <p className="text-xs leading-5 text-[var(--color-ink-muted)]">
        This uploads the entire staged workspace to the configured VPS uploads directory in one
        batch, preserving folder structure.
      </p>
      <button
        type="button"
        onClick={handleTransfer}
        disabled={isSubmitting}
        className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Uploading workspace..." : "Upload all staged items to VPS"}
      </button>
      {result ? (
        <ActionNotice
          tone={result.tone}
          title={result.title}
          description={result.description}
          details={result.details}
        />
      ) : null}
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
