"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RemoveStagedItemButtonProps = {
  stagedFileId: string;
};

export function RemoveStagedItemButton({
  stagedFileId,
}: RemoveStagedItemButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <button
      type="button"
      disabled={isSubmitting}
      onClick={async () => {
        setIsSubmitting(true);

        try {
          const response = await fetch(`/api/uploads/staged/${stagedFileId}`, {
            method: "DELETE",
          });

          if (response.ok) {
            router.refresh();
          }
        } finally {
          setIsSubmitting(false);
        }
      }}
      className="rounded-full border border-rose-200 px-2.5 py-1 text-xs text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSubmitting ? "Removing..." : "Remove"}
    </button>
  );
}
