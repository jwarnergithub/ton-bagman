import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import posixPath from "node:path/posix";
import { logDangerousAction } from "@/src/server/audit/logger";
import { getRuntimeConfig } from "@/src/server/config/env";
import { createAppError } from "@/src/server/errors/appError";
import type { SshClient } from "@/src/server/ssh/client";
import { withSshClient } from "@/src/server/ssh/runtime";

const MANAGED_BAG_ROOT_DIR = ".ton-storage/managed-bags";

export type ManagedBagSourceRecord = {
  bagId: string;
  createdAt: string;
  workflow: "uploads-directory" | "remote-item";
  preparedPath: string;
  originalPath: string;
  itemKind: "file" | "directory" | "symlink" | "workspace";
  movedItems: string[];
};

export type ManagedBagSourceRecoveryResult = {
  status: "copied-to-uploads" | "deleted";
  bagId: string;
  preparedPath: string;
  destinationPaths: string[];
  message: string;
};

function sanitizeBagIdForFilename(bagId: string) {
  return bagId.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getManagedBagRoot() {
  return path.join(process.cwd(), MANAGED_BAG_ROOT_DIR);
}

function getManifestPath(bagId: string) {
  return path.join(getManagedBagRoot(), `${sanitizeBagIdForFilename(bagId)}.json`);
}

async function ensureManagedBagRoot() {
  const root = getManagedBagRoot();
  await mkdir(root, { recursive: true });
  return root;
}

function normalizeBagId(bagId: string) {
  const normalizedBagId = bagId.trim();

  if (!normalizedBagId) {
    throw createAppError("VALIDATION_ERROR", "Bag ID is required.", 400);
  }

  return normalizedBagId;
}

function assertManagedPreparedPath(record: ManagedBagSourceRecord) {
  const config = getRuntimeConfig();
  const relative = posixPath.relative(
    posixPath.normalize(config.remoteBagSourceDir),
    posixPath.normalize(record.preparedPath),
  );

  if (
    relative === "" ||
    relative.startsWith("..") ||
    posixPath.isAbsolute(relative)
  ) {
    throw createAppError(
      "MANAGED_BAG_SOURCE_FAILED",
      "The managed source path is outside the configured bag-source directory.",
      400,
    );
  }
}

async function readManagedBagSourceRecordOrThrow(bagId: string) {
  const normalizedBagId = normalizeBagId(bagId);

  try {
    const payload = await readFile(getManifestPath(normalizedBagId), "utf8");
    const record = JSON.parse(payload) as ManagedBagSourceRecord;
    assertManagedPreparedPath(record);
    return record;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw createAppError(
        "MANAGED_BAG_SOURCE_NOT_FOUND",
        "No app-managed source record was found for this bag.",
        404,
      );
    }

    throw error;
  }
}

async function ensureRemoteDirectory(client: SshClient, remoteDirectory: string) {
  const result = await client.execute({
    command: "mkdir",
    args: ["-p", "--", remoteDirectory],
  });

  if (!result.ok) {
    throw createAppError(
      "MANAGED_BAG_SOURCE_FAILED",
      result.stderr || `Could not create remote directory "${remoteDirectory}".`,
      502,
    );
  }
}

async function pathExists(client: SshClient, remotePath: string) {
  const result = await client.execute({
    command: "find",
    args: [remotePath, "-maxdepth", "0", "-print"],
  });

  return result.ok && result.stdout.trim().length > 0;
}

async function copyRemotePath(client: SshClient, sourcePath: string, targetPath: string) {
  const result = await client.execute({
    command: "cp",
    args: ["-a", "--", sourcePath, targetPath],
  });

  if (!result.ok) {
    throw createAppError(
      "MANAGED_BAG_SOURCE_FAILED",
      result.stderr || `Could not copy "${sourcePath}" to "${targetPath}".`,
      502,
    );
  }
}

async function removeRemotePath(client: SshClient, remotePath: string) {
  const result = await client.execute({
    command: "rm",
    args: ["-rf", "--", remotePath],
  });

  if (!result.ok) {
    throw createAppError(
      "MANAGED_BAG_SOURCE_FAILED",
      result.stderr || `Could not remove "${remotePath}".`,
      502,
    );
  }
}

function buildRecoveryName(name: string) {
  return `recovered-${new Date().toISOString().replace(/[:.]/g, "-")}-${name}`;
}

async function chooseRecoveryTargetName(
  client: SshClient,
  remoteBaseDir: string,
  preferredName: string,
) {
  const preferredPath = posixPath.join(remoteBaseDir, preferredName);

  if (!(await pathExists(client, preferredPath))) {
    return preferredPath;
  }

  return posixPath.join(remoteBaseDir, buildRecoveryName(preferredName));
}

export async function saveManagedBagSourceRecord(record: ManagedBagSourceRecord) {
  const normalizedBagId = normalizeBagId(record.bagId);
  await ensureManagedBagRoot();
  await writeFile(
    getManifestPath(normalizedBagId),
    JSON.stringify(
      {
        ...record,
        bagId: normalizedBagId,
      },
      null,
      2,
    ),
    "utf8",
  );
}

export async function getManagedBagSourceRecord(
  bagId: string,
): Promise<ManagedBagSourceRecord | null> {
  const normalizedBagId = normalizeBagId(bagId);

  try {
    const payload = await readFile(getManifestPath(normalizedBagId), "utf8");
    const record = JSON.parse(payload) as ManagedBagSourceRecord;
    assertManagedPreparedPath(record);
    return record;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function removeManagedBagSourceRecord(bagId: string) {
  const normalizedBagId = normalizeBagId(bagId);
  await rm(getManifestPath(normalizedBagId), { force: true });
}

export async function recoverManagedBagSourceToUploads(
  bagId: string,
  confirmation?: string,
): Promise<ManagedBagSourceRecoveryResult> {
  const record = await readManagedBagSourceRecordOrThrow(bagId);
  const config = getRuntimeConfig();

  if (confirmation?.trim() !== "COPY BACK") {
    throw createAppError(
      "VALIDATION_ERROR",
      'confirmation must equal "COPY BACK".',
      400,
    );
  }

  await logDangerousAction({
    action: "managed-bag-source-recover-requested",
    target: `${record.bagId}:${record.preparedPath}`,
  });

  const destinationPaths = await withSshClient(async (client) => {
    await ensureRemoteDirectory(client, config.remoteBaseDir);
    const copiedPaths: string[] = [];

    if (record.workflow === "uploads-directory") {
      for (const itemName of record.movedItems) {
        const sourcePath = posixPath.join(record.preparedPath, itemName);
        const targetPath = await chooseRecoveryTargetName(
          client,
          config.remoteBaseDir,
          itemName,
        );
        await copyRemotePath(client, sourcePath, targetPath);
        copiedPaths.push(targetPath);
      }
    } else {
      const preferredName = posixPath.basename(record.originalPath);
      const targetPath = await chooseRecoveryTargetName(
        client,
        config.remoteBaseDir,
        preferredName,
      );
      await copyRemotePath(client, record.preparedPath, targetPath);
      copiedPaths.push(targetPath);
    }

    return copiedPaths;
  });

  await logDangerousAction({
    action: "managed-bag-source-recover-completed",
    target: `${record.bagId}:${record.preparedPath}`,
  });

  return {
    status: "copied-to-uploads",
    bagId: record.bagId,
    preparedPath: record.preparedPath,
    destinationPaths,
    message:
      "Managed source contents were copied into the uploads directory. The original bag source was left in place.",
  };
}

export async function deleteManagedBagSource(
  bagId: string,
  confirmation?: string,
): Promise<ManagedBagSourceRecoveryResult> {
  const record = await readManagedBagSourceRecordOrThrow(bagId);

  if (confirmation?.trim() !== "DELETE CONTENTS") {
    throw createAppError(
      "VALIDATION_ERROR",
      'confirmation must equal "DELETE CONTENTS".',
      400,
    );
  }

  await logDangerousAction({
    action: "managed-bag-source-delete-requested",
    target: `${record.bagId}:${record.preparedPath}`,
  });
  await withSshClient((client) => removeRemotePath(client, record.preparedPath));
  await removeManagedBagSourceRecord(record.bagId);
  await logDangerousAction({
    action: "managed-bag-source-delete-completed",
    target: `${record.bagId}:${record.preparedPath}`,
  });

  return {
    status: "deleted",
    bagId: record.bagId,
    preparedPath: record.preparedPath,
    destinationPaths: [],
    message: "Managed source contents deleted.",
  };
}
