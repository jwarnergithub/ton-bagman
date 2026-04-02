import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/config/env", () => ({
  getRuntimeConfig: vi.fn(),
}));

vi.mock("../../src/server/ssh/client", () => ({
  getSshConnectionSummary: vi.fn(),
}));

import { GET } from "../../app/api/health/route";
import { getRuntimeConfig } from "../../src/server/config/env";
import { getSshConnectionSummary } from "../../src/server/ssh/client";

describe("GET /api/health", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the connection summary as typed JSON", async () => {
    vi.mocked(getRuntimeConfig).mockReturnValue({
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
      sshReadyTimeoutMs: 10000,
      tonDaemonControlAddress: "127.0.0.1:5555",
      tonDaemonCliKeyPath: "/opt/ton-storage/db/cli-keys/client",
      tonDaemonServerPubPath: "/opt/ton-storage/db/cli-keys/server.pub",
      remoteBaseDir: "/var/lib/ton-storage",
      remoteBagSourceDir: "/var/lib/bag-sources",
      remoteDeleteAllowedDirs: ["/var/lib/ton-storage"],
      localStagingDir: "staging",
    });
    vi.mocked(getSshConnectionSummary).mockReturnValue({
      configured: true,
      host: "vps.example.com",
      port: 22,
      user: "root",
      authMode: "inline-private-key",
      readyTimeoutMs: 10000,
      status: "configured",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        configured: true,
        host: "vps.example.com",
        port: 22,
        user: "root",
        authMode: "inline-private-key",
        readyTimeoutMs: 10000,
        status: "configured",
      },
    });
  });
});
