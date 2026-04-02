"use client";

import { useState } from "react";
import { JsonResult } from "@/src/components/shared/json-result";

type ConnectionState = {
  ok: boolean;
  payload: string;
};

export function ConnectionTestForm() {
  const [result, setResult] = useState<ConnectionState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/connection/test", {
        method: "POST",
      });
      const payload = await response.json();

      setResult({
        ok: response.ok,
        payload: JSON.stringify(payload, null, 2),
      });
    } catch (error) {
      setResult({
        ok: false,
        payload:
          error instanceof Error ? error.message : "Connection test request failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Testing..." : "Run Connection Test"}
      </button>
      {result ? <JsonResult ok={result.ok} payload={result.payload} /> : null}
    </div>
  );
}
