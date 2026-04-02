import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rm } from "node:fs/promises";

vi.mock("../../src/server/ssh/runtime", () => ({
  withSshClient: vi.fn(),
}));

import {
  deleteManagedBagSource,
  getManagedBagSourceRecord,
  recoverManagedBagSourceToUploads,
  saveManagedBagSourceRecord,
} from "../../src/server/files/managedBagSources";
import { resetRuntimeConfigCache } from "../../src/server/config/env";
import { withSshClient } from "../../src/server/ssh/runtime";

const managedBagRoot = ".ton-storage/managed-bags";

describe("managed bag source service", () => {
  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.TON_SSH_HOST = "vps.example.com";
    process.env.TON_SSH_USER = "root";
    process.env.TON_SSH_AUTH_MODE = "inline_key";
    process.env.TON_SSH_PRIVATE_KEY = "PRIVATE KEY";
    process.env.TON_SSH_HOST_FINGERPRINT = "SHA256:example";
    process.env.TON_REMOTE_BASE_DIR = "/opt/ton-storage/uploads";
    process.env.TON_REMOTE_BAG_SOURCE_DIR = "/opt/ton-storage/bag-sources";
    process.env.TON_REMOTE_DELETE_ALLOWED_DIRS = "/opt/ton-storage/uploads";
    process.env.TON_LOCAL_STAGING_DIR = "staging";
    resetRuntimeConfigCache();
    await rm(managedBagRoot, { recursive: true, force: true });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    resetRuntimeConfigCache();
    await rm(managedBagRoot, { recursive: true, force: true });
  });

  it("stores and retrieves a managed bag record", async () => {
    await saveManagedBagSourceRecord({
      bagId: "bag-123",
      createdAt: "2026-03-29T13:31:00.000Z",
      workflow: "remote-item",
      preparedPath: "/opt/ton-storage/bag-sources/run-image.jpg",
      originalPath: "/opt/ton-storage/uploads/image.jpg",
      itemKind: "file",
      movedItems: ["image.jpg"],
    });

    await expect(getManagedBagSourceRecord("bag-123")).resolves.toEqual({
      bagId: "bag-123",
      createdAt: "2026-03-29T13:31:00.000Z",
      workflow: "remote-item",
      preparedPath: "/opt/ton-storage/bag-sources/run-image.jpg",
      originalPath: "/opt/ton-storage/uploads/image.jpg",
      itemKind: "file",
      movedItems: ["image.jpg"],
    });
  });

  it("copies a managed uploads workspace into uploads and keeps the manifest", async () => {
    await saveManagedBagSourceRecord({
      bagId: "bag-uploads-1",
      createdAt: "2026-03-29T13:31:00.000Z",
      workflow: "uploads-directory",
      preparedPath: "/opt/ton-storage/bag-sources/run-uploads",
      originalPath: "/opt/ton-storage/uploads",
      itemKind: "workspace",
      movedItems: ["folder-a", "image.jpg"],
    });

    const execute = vi.fn(async ({ command, args }: { command: string; args?: string[] }) => {
      if (command === "mkdir") {
        return success("");
      }

      if (command === "find" && args?.[0] === "/opt/ton-storage/uploads/folder-a") {
        return success("");
      }

      if (command === "find" && args?.[0] === "/opt/ton-storage/uploads/image.jpg") {
        return success("");
      }

      if (command === "cp") {
        return success("");
      }

      return success("");
    });

    vi.mocked(withSshClient).mockImplementation(async (callback) =>
      callback({
        execute,
        uploadFile: vi.fn(),
        dispose: vi.fn(),
      } as never),
    );

    const result = await recoverManagedBagSourceToUploads("bag-uploads-1", "COPY BACK");

    expect(result.status).toBe("copied-to-uploads");
    expect(result.destinationPaths).toEqual([
      "/opt/ton-storage/uploads/folder-a",
      "/opt/ton-storage/uploads/image.jpg",
    ]);
    await expect(getManagedBagSourceRecord("bag-uploads-1")).resolves.toEqual({
      bagId: "bag-uploads-1",
      createdAt: "2026-03-29T13:31:00.000Z",
      workflow: "uploads-directory",
      preparedPath: "/opt/ton-storage/bag-sources/run-uploads",
      originalPath: "/opt/ton-storage/uploads",
      itemKind: "workspace",
      movedItems: ["folder-a", "image.jpg"],
    });
  });

  it("deletes a managed source directory and removes the manifest", async () => {
    await saveManagedBagSourceRecord({
      bagId: "bag-delete-1",
      createdAt: "2026-03-29T13:31:00.000Z",
      workflow: "remote-item",
      preparedPath: "/opt/ton-storage/bag-sources/run-image.jpg",
      originalPath: "/opt/ton-storage/uploads/image.jpg",
      itemKind: "file",
      movedItems: ["image.jpg"],
    });

    const execute = vi.fn().mockResolvedValue(success(""));

    vi.mocked(withSshClient).mockImplementation(async (callback) =>
      callback({
        execute,
        uploadFile: vi.fn(),
        dispose: vi.fn(),
      } as never),
    );

    const result = await deleteManagedBagSource("bag-delete-1", "DELETE CONTENTS");

    expect(result).toEqual({
      status: "deleted",
      bagId: "bag-delete-1",
      preparedPath: "/opt/ton-storage/bag-sources/run-image.jpg",
      destinationPaths: [],
      message: "Managed source contents deleted.",
    });
    await expect(getManagedBagSourceRecord("bag-delete-1")).resolves.toBeNull();
  });
});

function success(stdout: string) {
  return {
    stdout,
    stderr: "",
    exitCode: 0,
    signal: null,
    commandLine: "",
    durationMs: 1,
    ok: true,
  };
}
