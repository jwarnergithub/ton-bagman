"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ActionNotice } from "@/src/components/shared/action-notice";

type UploadResultState = {
  tone: "success" | "error" | "info";
  title: string;
  description: string;
  details?: string[];
};

type BrowserUploadEntry = {
  key: string;
  file: File;
  relativePath: string;
};

export function UploadForm() {
  const router = useRouter();
  const filesInputRef = useRef<HTMLInputElement | null>(null);
  const foldersInputRef = useRef<HTMLInputElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [result, setResult] = useState<UploadResultState | null>(null);
  const [entries, setEntries] = useState<BrowserUploadEntry[]>([]);

  function mergeEntries(nextFiles: FileList | null, mode: "files" | "folders") {
    if (!nextFiles || nextFiles.length === 0) {
      return;
    }

    const mapped = Array.from(nextFiles).map((file) => {
      const relativePath =
        mode === "folders" && file.webkitRelativePath
          ? file.webkitRelativePath
          : file.name;

      return {
        key: `${relativePath}-${file.size}-${file.lastModified}`,
        file,
        relativePath,
      } satisfies BrowserUploadEntry;
    });

    setEntries((current) => {
      const next = new Map(current.map((entry) => [entry.key, entry]));

      for (const entry of mapped) {
        next.set(entry.key, entry);
      }

      return Array.from(next.values()).sort((left, right) =>
        left.relativePath.localeCompare(right.relativePath),
      );
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      if (entries.length === 0) {
        setResult({
          tone: "info",
          title: "Choose files or folders first",
          description:
            "Add one or more files, folders, or both before staging them on the app server.",
        });
        return;
      }

      const formData = new FormData();

      entries.forEach((entry) => {
        formData.append("files", entry.file);
        formData.append("relativePaths", entry.relativePath);
      });

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (response.ok) {
        setResult({
          tone: "success",
          title: "Workspace staged on the app server",
          description:
            payload.data?.message ??
            `Staged ${payload.data?.totalFiles ?? entries.length} file(s).`,
          details: [
            `${payload.data?.totalFiles ?? entries.length} staged item(s)`,
            `Total size: ${formatBytes(payload.data?.totalBytes ?? 0)}`,
          ],
        });
        setEntries([]);
        setIsPickerOpen(false);
        if (filesInputRef.current) {
          filesInputRef.current.value = "";
        }
        if (foldersInputRef.current) {
          foldersInputRef.current.value = "";
        }
        router.refresh();
      } else {
        setResult({
          tone: "error",
          title: "Upload failed",
          description:
            payload.error?.message ?? "The staging endpoint did not accept the selected items.",
          details: payload.error?.code ? [`Error code: ${payload.error.code}`] : [],
        });
      }
    } catch (error) {
      setResult({
        tone: "error",
        title: "Upload request failed",
        description: error instanceof Error ? error.message : "Upload request failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const totalBytes = entries.reduce((total, entry) => total + entry.file.size, 0);

  function setFoldersInputRef(node: HTMLInputElement | null) {
    foldersInputRef.current = node;

    if (node) {
      node.setAttribute("webkitdirectory", "");
      node.setAttribute("directory", "");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        ref={filesInputRef}
        type="file"
        multiple
        onChange={(event) => {
          mergeEntries(event.target.files, "files");
          setIsPickerOpen(false);
        }}
        className="hidden"
      />
      <input
        ref={setFoldersInputRef}
        type="file"
        multiple
        onChange={(event) => {
          mergeEntries(event.target.files, "folders");
          setIsPickerOpen(false);
        }}
        className="hidden"
      />

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--color-ink)]">Add to workspace</p>
            <p className="text-xs leading-5 text-[var(--color-ink-muted)]">
              Your browser cannot open one picker that selects files and folders together in the
              same click. Use the button below, then choose either files or a folder and repeat if
              you want to add both kinds to the same workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPickerOpen((current) => !current)}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-input)] px-4 py-2 text-sm font-medium text-[var(--color-ink)]"
          >
            {isPickerOpen ? "Close picker" : "Add to workspace"}
          </button>
        </div>

        {isPickerOpen ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] px-3 py-3">
            <button
              type="button"
              onClick={() => filesInputRef.current?.click()}
              className="rounded-full border border-[var(--color-border)] bg-[var(--color-input)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)]"
            >
              Choose files
            </button>
            <span className="text-sm text-[var(--color-ink-muted)]">or</span>
            <button
              type="button"
              onClick={() => foldersInputRef.current?.click()}
              className="rounded-full border border-[var(--color-border)] bg-[var(--color-input)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)]"
            >
              Choose folder
            </button>
          </div>
        ) : null}
      </div>
      <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-ink-muted)]">
        {entries.length > 0 ? (
          <div className="space-y-2">
            <p className="font-medium text-[var(--color-ink)]">
              {entries.length} staged candidate{entries.length === 1 ? "" : "s"} selected
            </p>
            <p className="text-xs leading-5">
              Files and folders added here will be staged together and can be uploaded to the
              VPS in one batch.
            </p>
            <ul className="space-y-1 text-xs leading-5">
              {entries.slice(0, 6).map((entry) => (
                <li key={entry.key}>
                  {entry.relativePath} • {formatBytes(entry.file.size)}
                </li>
              ))}
              {entries.length > 6 ? <li>+{entries.length - 6} more item(s)</li> : null}
            </ul>
            <p className="text-xs leading-5">Total size: {formatBytes(totalBytes)}</p>
          </div>
        ) : (
          <p>
            Add any mix of files and folders here. Everything in this selection becomes one
            staging workspace.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Staging workspace..." : "Stage workspace"}
        </button>
        {entries.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setEntries([]);
              if (filesInputRef.current) {
                filesInputRef.current.value = "";
              }
              if (foldersInputRef.current) {
                foldersInputRef.current.value = "";
              }
              setIsPickerOpen(false);
            }}
            className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)]"
          >
            Clear selection
          </button>
        ) : null}
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
