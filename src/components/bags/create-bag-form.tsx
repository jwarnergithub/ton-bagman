"use client";

import { useState } from "react";
import { JsonResult } from "@/src/components/shared/json-result";

export function CreateBagForm() {
  const [path, setPath] = useState("");
  const [description, setDescription] = useState("");
  const [copy, setCopy] = useState(false);
  const [noUpload, setNoUpload] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; payload: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/bags/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          path,
          description,
          copy,
          noUpload,
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
        payload: error instanceof Error ? error.message : "Create request failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs leading-5 text-[var(--color-ink-muted)]">
        Use this form when you already know the remote source path. Items created from the
        dashboard remote uploads panel are moved out of `uploads/` first; this manual form
        does not move anything on its own.
      </p>
      <label className="block space-y-2 text-sm">
        <span className="font-medium">Remote path or directory</span>
        <input
          value={path}
          onChange={(event) => setPath(event.target.value)}
          placeholder="/var/lib/ton-storage/site"
          className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span className="font-medium">Description</span>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Site snapshot"
          className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={copy} onChange={(event) => setCopy(event.target.checked)} />
        <span>Use `--copy`</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={noUpload}
          onChange={(event) => setNoUpload(event.target.checked)}
        />
        <span>Use `--no-upload`</span>
      </label>
      <div className="space-y-1 text-xs leading-5 text-[var(--color-ink-muted)]">
        <p>`--copy` tells TON to make its own internal copy from the source path you provide.</p>
        <p>`--no-upload` creates the bag without seeding it. Seeding can be enabled later.</p>
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Submitting..." : "Create Bag"}
      </button>
      {result ? <JsonResult ok={result.ok} payload={result.payload} /> : null}
    </form>
  );
}
