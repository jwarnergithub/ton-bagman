import "server-only";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getRuntimeConfig } from "@/src/server/config/env";
import { createAppError } from "@/src/server/errors/appError";

const LOCAL_STAGING_ROOT_DIR = ".ton-storage";

type StagedFileMeta = {
  id: string;
  filename: string;
  relativePath: string;
  mimeType: string | null;
  sizeBytes: number;
  storedAt: string;
  storagePath: string;
};

export type StagedFile = {
  id: string;
  filename: string;
  relativePath: string;
  mimeType: string | null;
  sizeBytes: number;
  storedAt: string;
  localPath: string;
  status: "staged";
};

export type StagedFileListResult = {
  items: StagedFile[];
  source: "filesystem";
  totalFiles: number;
  totalBytes: number;
};

export type UploadStagingResult = {
  items: StagedFile[];
  source: "filesystem";
  totalFiles: number;
  totalBytes: number;
  message: string;
};

type BrowserFileLike = {
  name: string;
  type: string;
  relativePath?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function sanitizePathSegment(segment: string) {
  return segment.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function normalizeRelativePath(relativePath: string, fallbackName: string) {
  const candidate = (relativePath || fallbackName || "upload.bin")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map(sanitizePathSegment);

  if (
    candidate.length === 0 ||
    candidate.some((segment) => segment === "." || segment === "..")
  ) {
    throw createAppError("VALIDATION_ERROR", "Each upload must have a safe relative path.", 400);
  }

  return candidate.join("/");
}

function getStagingRoot() {
  const config = getRuntimeConfig();
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    LOCAL_STAGING_ROOT_DIR,
    config.localStagingDir,
  );
}

function getMetaPath(stagingRoot: string, id: string) {
  return path.join(stagingRoot, id, "meta.json");
}

async function ensureStagingRoot() {
  const stagingRoot = getStagingRoot();
  await mkdir(stagingRoot, { recursive: true });
  return stagingRoot;
}

async function readStagedFileMeta(directoryPath: string) {
  const metadata = await readFile(path.join(directoryPath, "meta.json"), "utf8");
  return JSON.parse(metadata) as StagedFileMeta;
}

function toStagedFile(meta: StagedFileMeta): StagedFile {
  return {
    id: meta.id,
    filename: meta.filename,
    relativePath: meta.relativePath,
    mimeType: meta.mimeType,
    sizeBytes: meta.sizeBytes,
    storedAt: meta.storedAt,
    localPath: meta.storagePath,
    status: "staged",
  };
}

function toStagedResult(items: StagedFile[]): StagedFileListResult {
  return {
    items: items.sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    source: "filesystem",
    totalFiles: items.length,
    totalBytes: items.reduce((total, item) => total + item.sizeBytes, 0),
  };
}

export async function listStagedFiles(): Promise<StagedFileListResult> {
  const stagingRoot = await ensureStagingRoot();
  const entries = await readdir(stagingRoot, { withFileTypes: true });
  const items = await Promise.all(
    entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
      const directoryPath = path.join(stagingRoot, entry.name);
      const meta = await readStagedFileMeta(directoryPath);
      return toStagedFile(meta);
    }),
  );

  return toStagedResult(items);
}

export async function stageBrowserFiles(
  files: BrowserFileLike[],
): Promise<UploadStagingResult> {
  if (files.length === 0) {
    throw createAppError("VALIDATION_ERROR", "At least one file is required.", 400);
  }

  const stagingRoot = await ensureStagingRoot();
  const stagedItems = await Promise.all(
    files.map(async (file) => {
      const id = randomUUID();
      const itemDirectory = path.join(stagingRoot, id);
      const relativePath = normalizeRelativePath(file.relativePath ?? file.name, file.name);
      const filename = path.basename(relativePath);
      const storagePath = path.join(itemDirectory, relativePath);

      await mkdir(path.dirname(storagePath), { recursive: true });

      const buffer = Buffer.from(await file.arrayBuffer());
      const meta: StagedFileMeta = {
        id,
        filename,
        relativePath,
        mimeType: file.type || null,
        sizeBytes: buffer.byteLength,
        storedAt: new Date().toISOString(),
        storagePath,
      };

      await writeFile(storagePath, buffer);
      await writeFile(getMetaPath(stagingRoot, id), JSON.stringify(meta, null, 2));

      return toStagedFile(meta);
    }),
  );
  const result = toStagedResult(stagedItems);

  return {
    ...result,
    message: `Staged ${result.totalFiles} file(s).`,
  };
}

export async function getStagedFileById(id: string): Promise<StagedFile> {
  const stagingRoot = await ensureStagingRoot();
  const normalizedId = id.trim();

  if (!normalizedId) {
    throw createAppError("VALIDATION_ERROR", "staged file ID is required.", 400);
  }

  const meta = await readStagedFileMeta(path.join(stagingRoot, normalizedId));
  const fileInfo = await stat(meta.storagePath);

  return toStagedFile({
    ...meta,
    sizeBytes: fileInfo.size,
  });
}

export async function removeStagedFile(id: string) {
  const stagingRoot = await ensureStagingRoot();
  const normalizedId = id.trim();

  if (!normalizedId) {
    throw createAppError("VALIDATION_ERROR", "staged file ID is required.", 400);
  }

  await rm(path.join(stagingRoot, normalizedId), {
    recursive: true,
    force: true,
  });
}
