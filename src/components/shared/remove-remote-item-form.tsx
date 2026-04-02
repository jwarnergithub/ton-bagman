"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionNotice } from "@/src/components/shared/action-notice";

type RemoveRemoteItemFormProps = {
  remotePath: string;
  targetName: string;
};

type ResultState = {
  tone: "success" | "error";
  title: string;
  description: string;
  details?: string[];
};

export function RemoveRemoteItemForm({
  remotePath,
  targetName,
}: RemoveRemoteItemFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [typedName, setTypedName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-rose-200 px-2.5 py-1 text-xs text-rose-700"
      >
        Remove from VPS
      </button>
    );
  }

  return (
    <form
      onSubmit={async (event) => {
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
              targetName: typedName,
            }),
          });
          const payload = await response.json();

          if (response.ok) {
            setResult({
              tone: "success",
              title: "Removed from VPS",
              description: `${targetName} was removed from the uploads directory.`,
            });
            router.refresh();
          } else {
            setResult({
              tone: "error",
              title: "Remote delete failed",
              description: payload.error?.message ?? "Remote delete failed.",
              details: payload.error?.code ? [`Error code: ${payload.error.code}`] : [],
            });
          }
        } finally {
          setIsSubmitting(false);
        }
      }}
      className="mt-2 space-y-2 rounded-2xl border border-dashed border-rose-200 px-3 py-3"
    >
      <p className="text-xs leading-5 text-[var(--color-ink-muted)]">
        Type `DELETE` and the exact item name to remove it from the VPS before bag creation.
      </p>
      <input
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        placeholder="DELETE"
        className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm"
      />
      <input
        value={typedName}
        onChange={(event) => setTypedName(event.target.value)}
        placeholder={targetName}
        className="block w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-rose-700 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Removing..." : "Confirm remove"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setConfirmation("");
            setTypedName("");
            setResult(null);
          }}
          className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs"
        >
          Cancel
        </button>
      </div>
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
