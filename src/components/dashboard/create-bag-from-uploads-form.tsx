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

export function CreateBagFromUploadsForm() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [copy, setCopy] = useState(false);
  const [noUpload, setNoUpload] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/bags/create-from-uploads", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          description,
          copy,
          noUpload,
        }),
      });
      const payload = await response.json();

      if (response.ok) {
        setResult({
          tone: "success",
          title: "Bag created from uploads directory",
          description: `Moved ${payload.data?.movedItems?.length ?? 0} top-level item(s) out of uploads and created a bag.`,
          details: [
            `Prepared path: ${payload.data?.preparedPath ?? "Unknown"}`,
            `Bag ID: ${payload.data?.bag?.bagId ?? "Unknown"}`,
          ],
        });
        router.refresh();
      } else {
        setResult({
          tone: "error",
          title: "Create-from-uploads failed",
          description:
            payload.error?.message ?? "Could not create a bag from the uploads directory.",
          details: payload.error?.code ? [`Error code: ${payload.error.code}`] : [],
        });
      }
    } catch (error) {
      setResult({
        tone: "error",
        title: "Create request failed",
        description: error instanceof Error ? error.message : "Create request failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs leading-5 text-[var(--color-ink-muted)]">
        This takes everything currently inside the remote uploads directory, moves it into the
        managed bag-source directory, and creates one bag from that prepared folder.
      </p>
      <label className="block space-y-2 text-sm">
        <span className="font-medium text-[var(--color-ink)]">Description</span>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Uploads workspace"
          className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-3 text-sm"
        />
      </label>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={copy}
            onChange={(event) => setCopy(event.target.checked)}
          />
          <span>Use `--copy`</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={noUpload}
            onChange={(event) => setNoUpload(event.target.checked)}
          />
          <span>Use `--no-upload`</span>
        </label>
      </div>
      <div className="space-y-1 text-xs leading-5 text-[var(--color-ink-muted)]">
        <p>`--copy` tells TON to make its own internal copy from the prepared source path.</p>
        <p>`--no-upload` creates the bag without seeding it. Seeding can be enabled later.</p>
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Creating bag..." : "Create one bag from uploads directory"}
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
