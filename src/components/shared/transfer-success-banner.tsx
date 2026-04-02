"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ActionNotice } from "@/src/components/shared/action-notice";

type StoredTransferState = {
  remotePath: string;
  bytesTransferred: number;
  transferredAt: string;
};

const STORAGE_KEY = "ton-bagman:last-transfer";

export function TransferSuccessBanner() {
  const transferSnapshot = useSyncExternalStore(
    subscribeToTransferStore,
    readStoredTransferSnapshot,
    () => null,
  );
  const transfer = useMemo(
    () => parseStoredTransferSnapshot(transferSnapshot),
    [transferSnapshot],
  );

  if (!transfer) {
    return null;
  }

  return (
    <div className="space-y-3">
      <ActionNotice
        tone="success"
        title="Last transfer completed"
        description={`The file was copied to ${transfer.remotePath}. You can now create a bag from that remote file path.`}
        details={[
          `Transferred ${formatBytes(transfer.bytesTransferred)}`,
          `Completed ${new Date(transfer.transferredAt).toLocaleString()}`,
        ]}
      />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href="/bags"
          className="font-medium text-[var(--color-accent-strong)]"
        >
          Open bag actions
        </Link>
        <button
          type="button"
          onClick={() => {
            window.sessionStorage.removeItem(STORAGE_KEY);
            window.dispatchEvent(new Event("ton-bagman-transfer-changed"));
          }}
          className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-ink-muted)]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function readStoredTransferSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(STORAGE_KEY);
}

function parseStoredTransferSnapshot(snapshot: string | null) {
  if (!snapshot) {
    return null;
  }

  try {
    return JSON.parse(snapshot) as StoredTransferState;
  } catch {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
    return null;
  }
}

function subscribeToTransferStore(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => onStoreChange();

  window.addEventListener("storage", handleChange);
  window.addEventListener("ton-bagman-transfer-changed", handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener("ton-bagman-transfer-changed", handleChange);
  };
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
