"use client";

import { useState } from "react";
import { JsonResult } from "@/src/components/shared/json-result";

type DeleteState = {
  ok: boolean;
  payload: string;
};

export function RemoteDeleteForm() {
  const [remotePath, setRemotePath] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [targetName, setTargetName] = useState("");
  const [result, setResult] = useState<DeleteState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/remote-files/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          remotePath,
          confirmation,
          targetName,
        }),
      });
      const payload = await response.json();

      setResult({
        ok: response.ok,
        payload: JSON.stringify(payload, null, 2),
      });
    } catch (error) {
      setResult({
        ok: false,
        payload: error instanceof Error ? error.message : "Delete request failed.",
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
          placeholder="/var/lib/ton-storage/example"
          className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span className="font-medium text-[var(--color-ink)]">
          Type DELETE to confirm
        </span>
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="DELETE"
          className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span className="font-medium text-[var(--color-ink)]">
          Re-type the exact file name
        </span>
        <input
          value={targetName}
          onChange={(event) => setTargetName(event.target.value)}
          placeholder="example.meta"
          className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
        />
      </label>
      <p className="text-xs leading-6 text-[var(--color-ink-muted)]">
        Deletion is limited to allowlisted paths and requires typing `DELETE` plus the exact target name. Files, symlinks, and directories inside the allowlist are supported.
      </p>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-rose-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Submitting..." : "Submit Guarded Delete"}
      </button>
      {result ? <JsonResult ok={result.ok} payload={result.payload} /> : null}
    </form>
  );
}
