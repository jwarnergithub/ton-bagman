import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getStagedFileById,
  listStagedFiles,
  stageBrowserFiles,
} from "../../src/server/files/staging";
import { resetRuntimeConfigCache } from "../../src/server/config/env";

describe("staging service", () => {
  let tempDir = "";
  const originalCwd = process.cwd();

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "ton-bagman-staging-"));
    process.env.NODE_ENV = "test";
    process.env.TON_SSH_HOST = "vps.example.com";
    process.env.TON_SSH_USER = "root";
    process.env.TON_SSH_AUTH_MODE = "inline_key";
    process.env.TON_SSH_PRIVATE_KEY = "PRIVATE KEY";
    process.env.TON_LOCAL_STAGING_DIR = "tests/staging";
    process.env.TON_REMOTE_BASE_DIR = "/var/lib/ton-storage";
    process.chdir(tempDir);
    resetRuntimeConfigCache();
  });

  afterEach(async () => {
    resetRuntimeConfigCache();
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("stages files on disk and lists them back", async () => {
    const result = await stageBrowserFiles([
      {
        name: "hello.txt",
        type: "text/plain",
        relativePath: "photos/hello.txt",
        async arrayBuffer() {
          return Uint8Array.from([104, 101, 108, 108, 111]).buffer;
        },
      },
    ]);

    expect(result.items).toHaveLength(1);

    const listed = await listStagedFiles();
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.filename).toBe("hello.txt");
    expect(listed.items[0]?.relativePath).toBe("photos/hello.txt");
    expect(listed.totalFiles).toBe(1);
    expect(listed.totalBytes).toBe(5);

    const staged = await getStagedFileById(result.items[0]!.id);
    expect(staged.sizeBytes).toBe(5);
    expect(staged.status).toBe("staged");
    expect(staged.relativePath).toBe("photos/hello.txt");
  });
});
