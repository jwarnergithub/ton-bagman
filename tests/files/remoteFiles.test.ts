import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/ssh/runtime", () => ({
  withSshClient: vi.fn(),
}));

vi.mock("../../src/server/files/staging", () => ({
  getStagedFileById: vi.fn(),
  removeStagedFile: vi.fn(),
}));

import { resetRuntimeConfigCache } from "../../src/server/config/env";
import {
  listRemoteFiles,
  prepareRemoteItemForBagCreation,
  requestRemoteDeletion,
  transferAndRemoveStagedFile,
} from "../../src/server/files/remoteFiles";
import { getStagedFileById, removeStagedFile } from "../../src/server/files/staging";
import { withSshClient } from "../../src/server/ssh/runtime";

describe("remote file service", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.TON_SSH_HOST = "vps.example.com";
    process.env.TON_SSH_USER = "root";
    process.env.TON_SSH_AUTH_MODE = "inline_key";
    process.env.TON_SSH_PRIVATE_KEY = "PRIVATE KEY";
    process.env.TON_SSH_HOST_FINGERPRINT = "SHA256:example";
    process.env.TON_REMOTE_BASE_DIR = "/srv/ton";
    process.env.TON_REMOTE_BAG_SOURCE_DIR = "/srv/bag-sources";
    process.env.TON_REMOTE_DELETE_ALLOWED_DIRS = "/srv/ton,/srv/ton/uploads";
    process.env.TON_LOCAL_STAGING_DIR = ".ton-storage/staging";
    resetRuntimeConfigCache();
  });

  afterEach(() => {
    resetRuntimeConfigCache();
    vi.clearAllMocks();
  });

  it("transfers a staged file and removes the local copy", async () => {
    const execute = vi.fn().mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      signal: null,
      commandLine: "",
      durationMs: 1,
      ok: true,
    });
    const uploadFile = vi.fn().mockResolvedValue({
      localPath: "/tmp/hello.txt",
      remotePath: "/srv/ton/hello.txt",
      bytesTransferred: 5,
      durationMs: 1,
      ok: true,
    });

    vi.mocked(getStagedFileById).mockResolvedValue({
      id: "stage-1",
      filename: "hello.txt",
      relativePath: "hello.txt",
      mimeType: "text/plain",
      sizeBytes: 5,
      storedAt: "2026-01-01T00:00:00.000Z",
      localPath: "/tmp/hello.txt",
      status: "staged",
    });
    vi.mocked(withSshClient).mockImplementation(async (callback) =>
      callback(
        {
          execute,
          uploadFile,
          dispose: vi.fn(),
        },
        {
          appEnv: "test",
          sshHost: "vps.example.com",
          sshPort: 22,
          sshUser: "root",
          sshAuthMode: "inline_key",
          sshAgentSocket: null,
          sshPrivateKey: "PRIVATE KEY",
          sshPrivateKeyPath: null,
          sshPassphrase: null,
          sshHostFingerprint: "SHA256:example",
          sshKnownHostsPath: null,
          sshReadyTimeoutMs: 20000,
          tonDaemonControlAddress: "127.0.0.1:5555",
          tonDaemonCliKeyPath: "/opt/ton-storage/db/cli-keys/client",
          tonDaemonServerPubPath: "/opt/ton-storage/db/cli-keys/server.pub",
          remoteBaseDir: "/srv/ton",
          remoteBagSourceDir: "/srv/bag-sources",
          remoteDeleteAllowedDirs: ["/srv/ton", "/srv/ton/uploads"],
          localStagingDir: ".ton-storage/staging",
        },
      ),
    );

    const result = await transferAndRemoveStagedFile({
      stagedFileId: "stage-1",
      remotePath: "/srv/ton/hello.txt",
    });

    expect(result).toEqual({
      status: "transferred",
      stagedFileId: "stage-1",
      remotePath: "/srv/ton/hello.txt",
      bytesTransferred: 5,
    });
    expect(execute).toHaveBeenCalledWith({
      command: "mkdir",
      args: ["-p", "--", "/srv/ton"],
    });
    expect(uploadFile).toHaveBeenCalledWith({
      localPath: "/tmp/hello.txt",
      remotePath: "/srv/ton/hello.txt",
    });
    expect(removeStagedFile).toHaveBeenCalledWith("stage-1");
  });

  it("surfaces transfer failures with a remote-transfer error", async () => {
    vi.mocked(getStagedFileById).mockResolvedValue({
      id: "stage-1",
      filename: "hello.txt",
      relativePath: "hello.txt",
      mimeType: "text/plain",
      sizeBytes: 5,
      storedAt: "2026-01-01T00:00:00.000Z",
      localPath: "/tmp/hello.txt",
      status: "staged",
    });
    vi.mocked(withSshClient).mockImplementation(async (callback) =>
      callback(
        {
          execute: vi.fn().mockResolvedValue({
            stdout: "",
            stderr: "",
            exitCode: 0,
            signal: null,
            commandLine: "",
            durationMs: 1,
            ok: true,
          }),
          uploadFile: vi.fn().mockRejectedValue(new Error("No such file")),
          dispose: vi.fn(),
        },
        {
          appEnv: "test",
          sshHost: "vps.example.com",
          sshPort: 22,
          sshUser: "root",
          sshAuthMode: "inline_key",
          sshAgentSocket: null,
          sshPrivateKey: "PRIVATE KEY",
          sshPrivateKeyPath: null,
          sshPassphrase: null,
          sshHostFingerprint: "SHA256:example",
          sshKnownHostsPath: null,
          sshReadyTimeoutMs: 20000,
          tonDaemonControlAddress: "127.0.0.1:5555",
          tonDaemonCliKeyPath: "/opt/ton-storage/db/cli-keys/client",
          tonDaemonServerPubPath: "/opt/ton-storage/db/cli-keys/server.pub",
          remoteBaseDir: "/srv/ton",
          remoteBagSourceDir: "/srv/bag-sources",
          remoteDeleteAllowedDirs: ["/srv/ton", "/srv/ton/uploads"],
          localStagingDir: "staging",
        },
      ),
    );

    await expect(
      transferAndRemoveStagedFile({
        stagedFileId: "stage-1",
        remotePath: "/srv/ton/hello.txt",
      }),
    ).rejects.toMatchObject({
      code: "REMOTE_TRANSFER_FAILED",
      message: "No such file",
    });
  });

  it("rejects delete requests outside the allowlist", async () => {
    await expect(
      requestRemoteDeletion({
        remotePath: "/etc/passwd",
        confirmation: "DELETE",
        targetName: "passwd",
      }),
    ).rejects.toThrow(/allowlist/);
  });

  it("lists remote files from the configured base directory", async () => {
    vi.mocked(withSshClient).mockImplementation(async (callback) =>
      callback(
        {
          execute: vi.fn().mockResolvedValue({
            stdout: "f\t1024\timage.jpg\nd\t4096\tincoming\nf\t32\tincoming/nested.txt\n",
            stderr: "",
            exitCode: 0,
            signal: null,
            commandLine: "",
            durationMs: 1,
            ok: true,
          }),
          uploadFile: vi.fn(),
          dispose: vi.fn(),
        },
        {
          appEnv: "test",
          sshHost: "vps.example.com",
          sshPort: 22,
          sshUser: "root",
          sshAuthMode: "inline_key",
          sshAgentSocket: null,
          sshPrivateKey: "PRIVATE KEY",
          sshPrivateKeyPath: null,
          sshPassphrase: null,
          sshHostFingerprint: "SHA256:example",
          sshKnownHostsPath: null,
          sshReadyTimeoutMs: 20000,
          tonDaemonControlAddress: "127.0.0.1:5555",
          tonDaemonCliKeyPath: "/opt/ton-storage/db/cli-keys/client",
          tonDaemonServerPubPath: "/opt/ton-storage/db/cli-keys/server.pub",
          remoteBaseDir: "/srv/ton",
          remoteBagSourceDir: "/srv/bag-sources",
          remoteDeleteAllowedDirs: ["/srv/ton", "/srv/ton/uploads"],
          localStagingDir: "staging",
        },
      ),
    );

    const result = await listRemoteFiles();

    expect(result).toEqual({
      directory: "/srv/ton",
      items: [
        {
          kind: "file",
          name: "image.jpg",
          remotePath: "/srv/ton/image.jpg",
          sizeBytes: 1024,
        },
        {
          kind: "directory",
          name: "incoming",
          remotePath: "/srv/ton/incoming",
          sizeBytes: 4096,
        },
        {
          kind: "file",
          name: "incoming/nested.txt",
          remotePath: "/srv/ton/incoming/nested.txt",
          sizeBytes: 32,
        },
      ],
    });
  });

  it("moves a remote upload into the managed bag-source directory before bag creation", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        stdout: "f",
        stderr: "",
        exitCode: 0,
        signal: null,
        commandLine: "",
        durationMs: 1,
        ok: true,
      })
      .mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        commandLine: "",
        durationMs: 1,
        ok: true,
      })
      .mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        commandLine: "",
        durationMs: 1,
        ok: true,
      });

    vi.mocked(withSshClient).mockImplementation(async (callback) =>
      callback(
        {
          execute,
          uploadFile: vi.fn(),
          dispose: vi.fn(),
        },
        {
          appEnv: "test",
          sshHost: "vps.example.com",
          sshPort: 22,
          sshUser: "root",
          sshAuthMode: "inline_key",
          sshAgentSocket: null,
          sshPrivateKey: "PRIVATE KEY",
          sshPrivateKeyPath: null,
          sshPassphrase: null,
          sshHostFingerprint: "SHA256:example",
          sshKnownHostsPath: null,
          sshReadyTimeoutMs: 20000,
          tonDaemonControlAddress: "127.0.0.1:5555",
          tonDaemonCliKeyPath: "/opt/ton-storage/db/cli-keys/client",
          tonDaemonServerPubPath: "/opt/ton-storage/db/cli-keys/server.pub",
          remoteBaseDir: "/srv/ton",
          remoteBagSourceDir: "/srv/bag-sources",
          remoteDeleteAllowedDirs: ["/srv/ton", "/srv/ton/uploads"],
          localStagingDir: "staging",
        },
      ),
    );

    const result = await prepareRemoteItemForBagCreation({
      remotePath: "/srv/ton/image.jpg",
    });

    expect(result.originalPath).toBe("/srv/ton/image.jpg");
    expect(result.kind).toBe("file");
    expect(result.preparedPath).toMatch(/^\/srv\/bag-sources\/.+-image\.jpg$/);
    expect(execute).toHaveBeenNthCalledWith(1, {
      command: "find",
      args: ["/srv/ton/image.jpg", "-maxdepth", "0", "-printf", "%y"],
    });
    expect(execute).toHaveBeenNthCalledWith(2, {
      command: "mkdir",
      args: ["-p", "--", "/srv/bag-sources"],
    });
    expect(execute).toHaveBeenNthCalledWith(3, {
      command: "mv",
      args: ["--", "/srv/ton/image.jpg", expect.stringMatching(/^\/srv\/bag-sources\/.+-image\.jpg$/)],
    });
  });

  it("rejects deletion of an allowlisted root directory", async () => {
    await expect(
      requestRemoteDeletion({
        remotePath: "/srv/ton",
        confirmation: "DELETE",
        targetName: "ton",
      }),
    ).rejects.toThrow(/root directory/);
  });

  it("rejects deletion when targetName does not match the basename", async () => {
    await expect(
      requestRemoteDeletion({
        remotePath: "/srv/ton/file.txt",
        confirmation: "DELETE",
        targetName: "different.txt",
      }),
    ).rejects.toThrow(/targetName/);
  });

  it("deletes only files or symlinks after inspecting the remote path type", async () => {
    vi.mocked(withSshClient).mockImplementation(async (callback) =>
      callback(
        {
          execute: vi
            .fn()
            .mockResolvedValueOnce({
              stdout: "regular file\n",
              stderr: "",
              exitCode: 0,
              signal: null,
              commandLine: "",
              durationMs: 1,
              ok: true,
            })
            .mockResolvedValueOnce({
              stdout: "",
              stderr: "",
              exitCode: 0,
              signal: null,
              commandLine: "",
              durationMs: 1,
              ok: true,
            }),
          uploadFile: vi.fn(),
          dispose: vi.fn(),
        },
        {
          appEnv: "test",
          sshHost: "vps.example.com",
          sshPort: 22,
          sshUser: "root",
          sshAuthMode: "inline_key",
          sshAgentSocket: null,
          sshPrivateKey: "PRIVATE KEY",
          sshPrivateKeyPath: null,
          sshPassphrase: null,
          sshHostFingerprint: "SHA256:example",
          sshKnownHostsPath: null,
          sshReadyTimeoutMs: 20000,
          tonDaemonControlAddress: "127.0.0.1:5555",
          tonDaemonCliKeyPath: "/opt/ton-storage/db/cli-keys/client",
          tonDaemonServerPubPath: "/opt/ton-storage/db/cli-keys/server.pub",
          remoteBaseDir: "/srv/ton",
          remoteBagSourceDir: "/srv/bag-sources",
          remoteDeleteAllowedDirs: ["/srv/ton", "/srv/ton/uploads"],
          localStagingDir: ".ton-storage/staging",
        },
      ),
    );

    const result = await requestRemoteDeletion({
      remotePath: "/srv/ton/file.txt",
      confirmation: "DELETE",
      targetName: "file.txt",
    });

    expect(result).toEqual({
      status: "deleted",
      accepted: true,
      remotePath: "/srv/ton/file.txt",
      message: "Remote path deleted.",
    });
  });

  it("deletes directories inside the allowlist after inspection", async () => {
    vi.mocked(withSshClient).mockImplementation(async (callback) =>
      callback(
        {
          execute: vi
            .fn()
            .mockResolvedValueOnce({
              stdout: "directory\n",
              stderr: "",
              exitCode: 0,
              signal: null,
              commandLine: "",
              durationMs: 1,
              ok: true,
            })
            .mockResolvedValueOnce({
              stdout: "",
              stderr: "",
              exitCode: 0,
              signal: null,
              commandLine: "",
              durationMs: 1,
              ok: true,
            }),
          uploadFile: vi.fn(),
          dispose: vi.fn(),
        },
        {
          appEnv: "test",
          sshHost: "vps.example.com",
          sshPort: 22,
          sshUser: "root",
          sshAuthMode: "inline_key",
          sshAgentSocket: null,
          sshPrivateKey: "PRIVATE KEY",
          sshPrivateKeyPath: null,
          sshPassphrase: null,
          sshHostFingerprint: "SHA256:example",
          sshKnownHostsPath: null,
          sshReadyTimeoutMs: 20000,
          tonDaemonControlAddress: "127.0.0.1:5555",
          tonDaemonCliKeyPath: "/opt/ton-storage/db/cli-keys/client",
          tonDaemonServerPubPath: "/opt/ton-storage/db/cli-keys/server.pub",
          remoteBaseDir: "/srv/ton",
          remoteBagSourceDir: "/srv/bag-sources",
          remoteDeleteAllowedDirs: ["/srv/ton", "/srv/ton/uploads"],
          localStagingDir: ".ton-storage/staging",
        },
      ),
    );

    const result = await requestRemoteDeletion({
      remotePath: "/srv/ton/uploads",
      confirmation: "DELETE",
      targetName: "uploads",
    });

    expect(result).toEqual({
      status: "deleted",
      accepted: true,
      remotePath: "/srv/ton/uploads",
      message: "Remote path deleted.",
    });
  });
});
