"use client";

import { useState } from "react";
import { JsonResult } from "@/src/components/shared/json-result";

export function AddByMetaForm() {
  const [metafilePath, setMetafilePath] = useState("");
  const [storeWithLocalBags, setStoreWithLocalBags] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; payload: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/bags/add-by-meta", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          metafilePath,
          storeWithLocalBags,
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
        payload: error instanceof Error ? error.message : "Add-by-meta failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs leading-5 text-[var(--color-ink-muted)]">
        If you leave this unchecked, TON Storage will keep the bag files in the daemon&apos;s
        internal storage directory.
      </p>
      <label className="block space-y-2 text-sm">
        <span className="font-medium">Meta file path</span>
        <input
          value={metafilePath}
          onChange={(event) => setMetafilePath(event.target.value)}
          placeholder="/var/lib/ton-storage/example.bag"
          className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={storeWithLocalBags}
          onChange={(event) => setStoreWithLocalBags(event.target.checked)}
        />
        <span>Store with your local bags</span>
      </label>
      <p className="text-xs leading-5 text-[var(--color-ink-muted)]">
        When checked, the app creates a new managed folder under your bag-source directory and
        tells TON to store the imported bag there.
      </p>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Submitting..." : "Add By Meta"}
      </button>
      {result ? <JsonResult ok={result.ok} payload={result.payload} /> : null}
    </form>
  );
}
