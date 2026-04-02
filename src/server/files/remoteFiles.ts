import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path/posix";
import { logDangerousAction } from "@/src/server/audit/logger";
import { getRuntimeConfig, type RuntimeConfig } from "@/src/server/config/env";
import { createAppError } from "@/src/server/errors/appError";
import {
  removeStagedFile,
  getStagedFileById,
  listStagedFiles,
  type StagedFile,
} from "@/src/server/files/staging";
import type { SshClient } from "@/src/server/ssh/client";
import { withSshClient } from "@/src/server/ssh/runtime";

export type RemoteTransferRequest = {
  stagedFileId?: string;
  remotePath?: string;
};

export type RemoteTransferResult = {
  status: "transferred";
  stagedFileId: string;
  remotePath: string;
  bytesTransferred: number;
};

export type RemoteTransferAllResult = {
  status: "transferred";
  remoteBaseDir: string;
  transferredFiles: number;
  bytesTransferred: number;
  items: Array<{
    relativePath: string;
    remotePath: string;
    bytesTransferred: number;
  }>;
};

export type RemoteFileEntry = {
  name: string;
  remotePath: string;
  kind: "file" | "directory" | "symlink" | "other";
  sizeBytes: number | null;
};

export type RemoteFileListResult = {
  directory: string;
  items: RemoteFileEntry[];
};

export type RemoteDirectoryListResult = {
  directory: string;
  directories: string[];
};

export type PrepareRemoteBagSourceRequest = {
  remotePath?: string;
};

export type PreparedRemoteBagSource = {
  originalPath: string;
  preparedPath: string;
  kind: "file" | "directory" | "symlink";
};

export type PreparedRemoteUploadsBagSource = {
  originalDirectory: string;
  preparedPath: string;
  movedItems: string[];
};

export type RemoteDeleteRequest = {
  remotePath?: string;
  confirmation?: string;
  targetName?: string;
};

export type RemoteDeleteResult = {
  status: "deleted";
  accepted: true;
  remotePath: string;
  message: string;
};

function sanitizeRemoteName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function parseRemoteFileKind(marker: string): RemoteFileEntry["kind"] {
  if (marker === "f") {
    return "file";
  }

  if (marker === "d") {
    return "directory";
  }

  if (marker === "l") {
    return "symlink";
  }

  return "other";
}

function parseRemoteFileListOutput(
  directory: string,
  stdout: string,
): RemoteFileListResult {
  const items = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [kindMarker, sizeValue, name] = line.split("\t");

      return {
        name: name ?? "",
        remotePath: path.join(directory, name ?? ""),
        kind: parseRemoteFileKind(kindMarker ?? ""),
        sizeBytes: sizeValue && /^\d+$/.test(sizeValue) ? Number(sizeValue) : null,
      } satisfies RemoteFileEntry;
    })
    .filter((item) => item.name);

  return {
    directory,
    items,
  };
}

async function ensureRemoteParentDirectory(client: SshClient, remotePath: string) {
  const remoteDirectory = path.dirname(path.normalize(remotePath));
  await ensureRemoteDirectory(client, remoteDirectory, "REMOTE_TRANSFER_FAILED");
}

async function ensureRemoteDirectory(
  client: SshClient,
  remoteDirectory: string,
  errorCode: "REMOTE_TRANSFER_FAILED" | "BAG_PREPARE_FAILED",
) {
  const result = await client.execute({
    command: "mkdir",
    args: ["-p", "--", remoteDirectory],
  });

  if (!result.ok) {
    throw createAppError(
      errorCode,
      result.stderr || `Could not create remote directory "${remoteDirectory}".`,
      502,
    );
  }
}

async function moveRemotePath(
  client: SshClient,
  sourcePath: string,
  targetPath: string,
) {
  const result = await client.execute({
    command: "mv",
    args: ["--", sourcePath, targetPath],
  });

  if (!result.ok) {
    throw createAppError(
      "BAG_PREPARE_FAILED",
      result.stderr || `Could not move "${sourcePath}" to "${targetPath}".`,
      502,
    );
  }
}

async function getRemoteEntryKind(
  client: SshClient,
  remotePath: string,
): Promise<PreparedRemoteBagSource["kind"]> {
  const result = await client.execute({
    command: "find",
    args: [remotePath, "-maxdepth", "0", "-printf", "%y"],
  });

  if (!result.ok) {
    throw createAppError(
      "BAG_PREPARE_FAILED",
      result.stderr || `Could not inspect "${remotePath}".`,
      502,
    );
  }

  const marker = result.stdout.trim();
  const kind = parseRemoteFileKind(marker);

  if (kind !== "file" && kind !== "directory" && kind !== "symlink") {
    throw createAppError(
      "BAG_PREPARE_FAILED",
      `"${remotePath}" is not a supported file or directory target.`,
      400,
    );
  }

  return kind;
}

function buildPreparedRemoteBagPath(config: RuntimeConfig, originalPath: string) {
  const basename = path.basename(path.normalize(originalPath));

  return buildManagedRemoteBagDirectoryPath(config, basename);
}

function buildManagedRemoteBagDirectoryPath(config: RuntimeConfig, label: string) {
  const safeLabel = sanitizeRemoteName(label);

  return path.join(
    config.remoteBagSourceDir,
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}-${safeLabel}`,
  );
}

export async function listRemoteFiles(): Promise<RemoteFileListResult> {
  const config = getRuntimeConfig();
  const directory = path.normalize(config.remoteBaseDir);

  return withSshClient(async (client) => {
    const result = await client.execute({
      command: "find",
      args: [
        directory,
        "-mindepth",
        "1",
        "-printf",
        "%y\t%s\t%P\n",
      ],
    });

    if (!result.ok) {
      throw createAppError(
        "REMOTE_FILE_LIST_FAILED",
        result.stderr || "Remote file listing failed.",
        502,
      );
    }

    return parseRemoteFileListOutput(directory, result.stdout);
  });
}

export async function listRemoteDirectories(): Promise<RemoteDirectoryListResult> {
  const config = getRuntimeConfig();
  const directory = path.normalize(config.remoteBaseDir);

  return withSshClient(async (client) => {
    const result = await client.execute({
      command: "find",
      args: [directory, "-type", "d", "-print"],
    });

    if (!result.ok) {
      throw createAppError(
        "REMOTE_FILE_LIST_FAILED",
        result.stderr || "Remote directory listing failed.",
        502,
      );
    }

    const directories = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((entry) => entry.startsWith(directory))
      .sort((left, right) => left.localeCompare(right));

    return {
      directory,
      directories,
    };
  });
}

export async function prepareRemoteItemForBagCreation(
  request: PrepareRemoteBagSourceRequest,
): Promise<PreparedRemoteBagSource> {
  const config = getRuntimeConfig();
  const originalPath = normalizeRemotePath(request.remotePath ?? "", config.remoteBaseDir);
  assertAllowedRemotePath(
    {
      ...config,
      remoteDeleteAllowedDirs: [config.remoteBaseDir],
    },
    originalPath,
  );
  const preparedPath = buildPreparedRemoteBagPath(config, originalPath);

  return withSshClient(async (client) => {
    const kind = await getRemoteEntryKind(client, originalPath);
    await ensureRemoteParentDirectory(client, preparedPath);
    await moveRemotePath(client, originalPath, preparedPath);

    return {
      originalPath,
      preparedPath,
      kind,
    };
  });
}

async function transferSingleStagedFile(
  client: SshClient,
  config: RuntimeConfig,
  stagedFile: StagedFile,
) {
  const remotePath = normalizeRemotePath(stagedFile.relativePath, config.remoteBaseDir);
  await ensureRemoteParentDirectory(client, remotePath);

  const uploadResult = await client.uploadFile({
    localPath: stagedFile.localPath,
    remotePath,
  });

  return {
    relativePath: stagedFile.relativePath,
    remotePath,
    bytesTransferred: uploadResult.bytesTransferred,
  };
}

export async function transferAllStagedFiles(): Promise<RemoteTransferAllResult> {
  const config = getRuntimeConfig();
  const staged = await listStagedFiles();

  if (staged.items.length === 0) {
    throw createAppError("VALIDATION_ERROR", "There are no staged files to transfer.", 400);
  }

  return withSshClient(async (client) => {
    const items = [];

    for (const stagedFile of staged.items) {
      try {
        const transferred = await transferSingleStagedFile(client, config, stagedFile);
        items.push(transferred);
      } catch (error) {
        throw createAppError(
          "REMOTE_TRANSFER_FAILED",
          error instanceof Error ? error.message : "Remote transfer failed.",
          502,
        );
      }
    }

    for (const stagedFile of staged.items) {
      await removeStagedFile(stagedFile.id);
    }

    return {
      status: "transferred",
      remoteBaseDir: config.remoteBaseDir,
      transferredFiles: items.length,
      bytesTransferred: items.reduce((total, item) => total + item.bytesTransferred, 0),
      items,
    };
  });
}

function buildPreparedRemoteUploadsPath(config: RuntimeConfig) {
  return path.join(
    config.remoteBagSourceDir,
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}-uploads`,
  );
}

export async function prepareRemoteUploadsDirectoryForBagCreation(): Promise<PreparedRemoteUploadsBagSource> {
  const config = getRuntimeConfig();
  const uploadDirectory = path.normalize(config.remoteBaseDir);
  const preparedPath = buildPreparedRemoteUploadsPath(config);

  return withSshClient(async (client) => {
    const listing = await client.execute({
      command: "find",
      args: [uploadDirectory, "-maxdepth", "1", "-mindepth", "1", "-printf", "%f\n"],
    });

    if (!listing.ok) {
      throw createAppError(
        "BAG_PREPARE_FAILED",
        listing.stderr || "Could not inspect uploads directory.",
        502,
      );
    }

    const movedItems = listing.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (movedItems.length === 0) {
      throw createAppError(
        "BAG_PREPARE_FAILED",
        "The uploads directory is empty.",
        400,
      );
    }

    await ensureRemoteDirectory(client, preparedPath, "BAG_PREPARE_FAILED");

    for (const itemName of movedItems) {
      await moveRemotePath(
        client,
        path.join(uploadDirectory, itemName),
        path.join(preparedPath, itemName),
      );
    }

    return {
      originalDirectory: uploadDirectory,
      preparedPath,
      movedItems,
    };
  });
}

export async function createManagedRemoteBagDirectory(
  label: string,
): Promise<{ directory: string }> {
  const config = getRuntimeConfig();
  const directory = buildManagedRemoteBagDirectoryPath(config, label);

  return withSshClient(async (client) => {
    await ensureRemoteDirectory(client, directory, "BAG_PREPARE_FAILED");

    return {
      directory,
    };
  });
}

function normalizeRemotePath(remotePath: string, baseDir: string) {
  const trimmed = remotePath.trim();

  if (!trimmed) {
    throw createAppError("VALIDATION_ERROR", "remotePath is required.", 400);
  }

  if (trimmed.startsWith("/")) {
    return path.normalize(trimmed);
  }

  return path.resolve(baseDir, trimmed);
}

function getRemoteBasename(remotePath: string) {
  const normalizedPath = path.normalize(remotePath);
  const basename = path.basename(normalizedPath);

  if (!basename || basename === "." || basename === "/") {
    throw createAppError(
      "VALIDATION_ERROR",
      "remotePath must resolve to a concrete file path.",
      400,
    );
  }

  return basename;
}

function isWithinAllowedDir(targetPath: string, allowedDir: string) {
  const normalizedAllowedDir = path.normalize(allowedDir);
  const relativePath = path.relative(normalizedAllowedDir, targetPath);

  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function assertAllowedRemotePath(config: RuntimeConfig, remotePath: string) {
  const matchingAllowedDir = config.remoteDeleteAllowedDirs.find((allowedDir) =>
    isWithinAllowedDir(remotePath, allowedDir),
  );

  if (!matchingAllowedDir) {
    throw createAppError(
      "VALIDATION_ERROR",
      "remotePath is outside the configured allowlist.",
      400,
    );
  }

  if (path.normalize(remotePath) === path.normalize(matchingAllowedDir)) {
    throw createAppError(
      "VALIDATION_ERROR",
      "Deleting an allowlisted root directory is not permitted.",
      400,
    );
  }
}

function assertDeleteConfirmation(
  remotePath: string,
  confirmation: string | undefined,
  targetName: string | undefined,
) {
  if (confirmation !== "DELETE") {
    throw createAppError(
      "VALIDATION_ERROR",
      'confirmation must equal "DELETE".',
      400,
    );
  }

  const expectedTargetName = getRemoteBasename(remotePath);

  if (targetName?.trim() !== expectedTargetName) {
    throw createAppError(
      "VALIDATION_ERROR",
      `targetName must exactly match "${expectedTargetName}".`,
      400,
    );
  }
}

async function getRemotePathType(client: SshClient, remotePath: string) {
  const result = await client.execute({
    command: "stat",
    args: ["-c", "%F", "--", remotePath],
  });

  if (!result.ok) {
    throw createAppError(
      "REMOTE_DELETE_FAILED",
      result.stderr || "Remote path inspection failed.",
      502,
    );
  }

  return result.stdout.trim();
}

function assertDeletablePathType(remotePath: string, pathType: string) {
  const normalizedType = pathType.toLowerCase();
  const allowedTypes = new Set(["regular file", "symbolic link", "directory"]);

  if (!allowedTypes.has(normalizedType)) {
    throw createAppError(
      "VALIDATION_ERROR",
      `Remote deletion only supports files, symlinks, and directories inside the allowlist. "${remotePath}" is ${pathType || "unknown"}.`,
      400,
    );
  }
}

async function deleteRemotePath(
  client: SshClient,
  remotePath: string,
): Promise<RemoteDeleteResult> {
  const pathType = await getRemotePathType(client, remotePath);
  assertDeletablePathType(remotePath, pathType);
  const normalizedType = pathType.toLowerCase();

  const result = await client.execute({
    command: "rm",
    args:
      normalizedType === "directory"
        ? ["-rf", "--", remotePath]
        : ["-f", "--", remotePath],
  });

  if (!result.ok) {
    throw createAppError(
      "REMOTE_DELETE_FAILED",
      result.stderr || "Remote deletion failed.",
      502,
    );
  }

  return {
    status: "deleted",
    accepted: true,
    remotePath,
    message: "Remote path deleted.",
  };
}

export async function transferStagedFileToRemote(
  request: RemoteTransferRequest,
): Promise<RemoteTransferResult> {
  const config = getRuntimeConfig();

  if (!request.stagedFileId?.trim()) {
    throw createAppError("VALIDATION_ERROR", "stagedFileId is required.", 400);
  }

  const stagedFile = await getStagedFileById(request.stagedFileId);
  const remotePath = normalizeRemotePath(
    request.remotePath ?? stagedFile.filename,
    config.remoteBaseDir,
  );
  assertAllowedRemotePath(
    {
      ...config,
      remoteDeleteAllowedDirs: [config.remoteBaseDir],
    },
    remotePath,
  );

  return withSshClient(async (client) => {
    await ensureRemoteParentDirectory(client, remotePath);

    let uploadResult;

    try {
      uploadResult = await client.uploadFile({
        localPath: stagedFile.localPath,
        remotePath,
      });
    } catch (error) {
      throw createAppError(
        "REMOTE_TRANSFER_FAILED",
        error instanceof Error ? error.message : "Remote transfer failed.",
        502,
      );
    }

    return {
      status: "transferred",
      stagedFileId: stagedFile.id,
      remotePath,
      bytesTransferred: uploadResult.bytesTransferred,
    };
  });
}

export async function requestRemoteDeletion(
  request: RemoteDeleteRequest,
): Promise<RemoteDeleteResult> {
  const config = getRuntimeConfig();
  const remotePath = normalizeRemotePath(request.remotePath ?? "", config.remoteBaseDir);
  assertAllowedRemotePath(config, remotePath);
  assertDeleteConfirmation(remotePath, request.confirmation, request.targetName);

  await logDangerousAction({
    action: "remote-file-delete-requested",
    target: remotePath,
  });

  const result = await withSshClient((client) => deleteRemotePath(client, remotePath));

  await logDangerousAction({
    action: "remote-file-delete-completed",
    target: remotePath,
  });

  return result;
}

export async function transferAndRemoveStagedFile(
  request: RemoteTransferRequest,
): Promise<RemoteTransferResult> {
  const result = await transferStagedFileToRemote(request);
  await removeStagedFile(result.stagedFileId);
  return result;
}
