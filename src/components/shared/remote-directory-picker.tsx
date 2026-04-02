"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionNotice } from "@/src/components/shared/action-notice";

type RemoteDirectoryPickerProps = {
  value: string;
  onSelect: (directory: string) => void;
  initialDirectories?: string[];
  initialError?: string | null;
};

type RemoteDirectoryListPayload = {
  directory: string;
  directories: string[];
};

export function RemoteDirectoryPicker({
  value,
  onSelect,
  initialDirectories = [],
  initialError = null,
}: RemoteDirectoryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<RemoteDirectoryListPayload | null>(
    initialDirectories.length > 0
      ? {
          directory: initialDirectories[0] ?? "",
          directories: initialDirectories,
        }
      : null,
  );
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    if (!isOpen || data || isLoading || error) {
      return;
    }

    let cancelled = false;

    async function loadDirectories() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/remote-files/directories");
        const payload = await response.json();

        if (cancelled) {
          return;
        }

        if (response.ok) {
          setData(payload.data);
        } else {
          setError(payload.error?.message ?? "Could not load remote directories.");
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load remote directories.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDirectories();

    return () => {
      cancelled = true;
    };
  }, [data, error, isLoading, isOpen]);

  const directories = useMemo(() => data?.directories ?? [], [data]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)]"
        >
          {isOpen ? "Close directory picker" : "Browse VPS directories"}
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => onSelect("")}
            className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)]"
          >
            Clear destination
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-4">
          <p className="text-xs leading-5 text-[var(--color-ink-muted)]">
            This picker shows directories currently visible under the configured remote uploads
            area. If you need a different path, you can still type it manually.
          </p>

          {isLoading ? (
            <p className="text-sm text-[var(--color-ink-muted)]">Loading directories...</p>
          ) : error ? (
            <ActionNotice
              tone="error"
              title="Directory picker unavailable"
              description={error}
            />
          ) : directories.length > 0 ? (
            <div className="max-h-64 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
              <ul className="space-y-2">
                {directories.map((directory) => (
                  <li key={directory}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(directory);
                        setIsOpen(false);
                      }}
                      className="block w-full rounded-2xl border border-transparent px-3 py-2 text-left text-sm transition hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-panel)]"
                    >
                      <span className="block [overflow-wrap:anywhere]">{directory}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">
              No remote directories are available to choose from yet.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
