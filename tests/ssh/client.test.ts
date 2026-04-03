import { describe, expect, it, vi } from "vitest";
import type { RuntimeConfig } from "../../src/server/config/env";
import {
  createSshClient,
  getSshConnectionSummary,
  testSshConnection,
} from "../../src/server/ssh/client";

const runtimeConfig: RuntimeConfig = {
  appEnv: "test",
  sshHost: "vps.example.com",
  sshPort: 22,
  sshUser: "root",
  sshAuthMode: "inline_key",
  sshAgentSocket: null,
  sshPrivateKey: "PRIVATE KEY DATA",
  sshPrivateKeyPath: null,
  sshPassphrase: null,
  sshHostFingerprint: "SHA256:example",
  sshKnownHostsPath: null,
  sshReadyTimeoutMs: 10000,
  remoteBaseDir: "/var/lib/ton-storage",
  remoteBagSourceDir: "/var/lib/bag-sources",
  remoteDeleteAllowedDirs: ["/var/lib/ton-storage"],
  localStagingDir: "staging",
};

describe("getSshConnectionSummary", () => {
  it("returns a secret-safe summary", () => {
    expect(getSshConnectionSummary(runtimeConfig)).toEqual({
      configured: true,
      host: "vps.example.com",
      port: 22,
      user: "root",
      authMode: "inline_key",
      hostVerification: "fingerprint",
      readyTimeoutMs: 10000,
      status: "configured",
    });
  });
});

describe("createSshClient", () => {
  it("executes commands and uploads files through a mocked runner", async () => {
    const exec = vi.fn().mockResolvedValue({
      stdout: "ok",
      stderr: "",
      exitCode: 0,
      signal: null,
    });
    const openSftp = vi.fn().mockResolvedValue({
      fastPut: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    });
    const dispose = vi.fn().mockResolvedValue(undefined);
    const now = vi.fn()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(140)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(245);
    const client = await createSshClient(runtimeConfig, {
      connectRunner: async () => ({
        exec,
        openSftp,
        dispose,
      }),
      now,
      statLocalFile: vi.fn().mockResolvedValue({ size: 512 }),
    });

    const execResult = await client.execute({
      command: "storage-daemon-cli",
      args: ["list"],
    });
    const uploadResult = await client.uploadFile({
      localPath: "/tmp/file.car",
      remotePath: "/srv/ton/file.car",
    });

    expect(exec).toHaveBeenCalledWith("'storage-daemon-cli' 'list'");
    expect(openSftp).toHaveBeenCalledTimes(1);
    expect(execResult.ok).toBe(true);
    expect(uploadResult.bytesTransferred).toBe(512);

    await client.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

describe("testSshConnection", () => {
  it("connects and disposes a mocked runner", async () => {
    const dispose = vi.fn().mockResolvedValue(undefined);
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(118);

    const result = await testSshConnection(runtimeConfig, {
      connectRunner: async () => ({
        exec: vi.fn(),
        openSftp: vi.fn(),
        dispose,
      }),
      now,
    });

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: true,
      status: "connected",
      host: "vps.example.com",
      port: 22,
      user: "root",
      durationMs: 18,
    });
  });

  it("surfaces a deployment-friendly message for agent auth failures", async () => {
    const config: RuntimeConfig = {
      ...runtimeConfig,
      sshAuthMode: "agent",
      sshAgentSocket: "/tmp/ssh-agent.sock",
      sshPrivateKey: null,
    };
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const createConnection = vi.fn(() => ({
      once(event: "ready" | "error", listener: (...args: unknown[]) => void) {
        handlers.set(event, listener);
        return this;
      },
      connect() {
        const errorHandler = handlers.get("error");
        errorHandler?.(new Error("All configured authentication methods failed"));
      },
      exec: vi.fn(),
      sftp: vi.fn(),
      end: vi.fn(),
    }));

    await expect(
      createSshClient(config, {
        createConnection,
      }),
    ).rejects.toThrow(
      /TON_SSH_AUTH_MODE=agent requires the app process to have a working SSH_AUTH_SOCK/,
    );
  });
});
