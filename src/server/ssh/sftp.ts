import "server-only";
import { stat } from "node:fs/promises";

export type SftpUploadRequest = {
  localPath: string;
  remotePath: string;
};

export type SftpUploadResult = {
  localPath: string;
  remotePath: string;
  bytesTransferred: number;
  durationMs: number;
  ok: true;
};

export type SftpTransferClient = {
  fastPut(localPath: string, remotePath: string): Promise<void>;
  close(): Promise<void> | void;
};

type UploadDependencies = {
  now?: () => number;
  statLocalFile?: (path: string) => Promise<{
    size: number;
  }>;
};

export async function uploadFileWithSftp(
  client: SftpTransferClient,
  request: SftpUploadRequest,
  dependencies: UploadDependencies = {},
): Promise<SftpUploadResult> {
  const now = dependencies.now ?? Date.now;
  const statLocalFile = dependencies.statLocalFile ?? stat;
  const startedAt = now();
  const fileStat = await statLocalFile(request.localPath);

  try {
    await client.fastPut(request.localPath, request.remotePath);

    return {
      localPath: request.localPath,
      remotePath: request.remotePath,
      bytesTransferred: fileStat.size,
      durationMs: now() - startedAt,
      ok: true,
    };
  } finally {
    await client.close();
  }
}
