import { describe, expect, it, vi } from "vitest";
import { createTonStorageService } from "../../src/server/ton-storage/service";

const daemonConfig = {
  tonDaemonControlAddress: "127.0.0.1:5555",
  tonDaemonCliKeyPath: "/opt/ton-storage/db/cli-keys/client",
  tonDaemonServerPubPath: "/opt/ton-storage/db/cli-keys/server.pub",
};

describe("TON storage service", () => {
  it("runs list through the executor and parser", async () => {
    const execute = vi.fn().mockResolvedValue({
      stdout: `
1 bags
#####        BagID  Description  Downloaded  Total   Download  Upload
    0  951F17615255BE82E12C770143F80856091AA3A80B6E102CEA27616D0EF4FEB1  Test file       66B/66B    66B  COMPLETED    0B/s
`,
      stderr: "",
      exitCode: 0,
      signal: null,
      commandLine: "",
      durationMs: 1,
      ok: true,
    });
    const service = createTonStorageService({ config: daemonConfig, execute });

    const result = await service.listBags();

    expect(execute).toHaveBeenCalledWith({
      command: "storage-daemon-cli",
      args: [
        "-I",
        "127.0.0.1:5555",
        "-k",
        "/opt/ton-storage/db/cli-keys/client",
        "-p",
        "/opt/ton-storage/db/cli-keys/server.pub",
        "-c",
        "list --hashes",
      ],
    });
    expect(result.totalBags).toBe(1);
    expect(result.items[0]?.description).toBe("Test file");
  });

  it("builds create with the documented args and returns a typed mutation result", async () => {
    const execute = vi.fn().mockResolvedValue({
      stdout:
        "Created 951F17615255BE82E12C770143F80856091AA3A80B6E102CEA27616D0EF4FEB1",
      stderr: "",
      exitCode: 0,
      signal: null,
      commandLine: "",
      durationMs: 1,
      ok: true,
    });
    const service = createTonStorageService({ config: daemonConfig, execute });

    const result = await service.createBag({
      path: "/bags/site",
      description: "Site",
      copy: true,
    });

    expect(execute).toHaveBeenCalledWith({
      command: "storage-daemon-cli",
      args: [
        "-I",
        "127.0.0.1:5555",
        "-k",
        "/opt/ton-storage/db/cli-keys/client",
        "-p",
        "/opt/ton-storage/db/cli-keys/server.pub",
        "-c",
        "create /bags/site -d Site --copy",
      ],
    });
    expect(result.action).toBe("create");
    expect(result.bagId).toBe(
      "951F17615255BE82E12C770143F80856091AA3A80B6E102CEA27616D0EF4FEB1",
    );
  });

  it("surfaces cleaned stdout failures when stderr only contains the daemon connection banner", async () => {
    const execute = vi.fn().mockResolvedValue({
      stdout: 'invalid option near "Bag"',
      stderr:
        "\u001b[1;36m[ 3][t 0][2026-03-29 14:11:32.521363888][storage-daemon-cli.cpp:229][!extclient]\tConnected\u001b[0m",
      exitCode: 1,
      signal: null,
      commandLine: "",
      durationMs: 1,
      ok: false,
    });
    const service = createTonStorageService({ config: daemonConfig, execute });

    await expect(
      service.createBag({
        path: "/bags/site",
        description: "Test Bag",
      }),
    ).rejects.toMatchObject({
      code: "TON_COMMAND_FAILED",
      message: 'invalid option near "Bag"',
    });
  });

  it("surfaces unsupported documented actions explicitly", () => {
    const service = createTonStorageService({
      config: daemonConfig,
      execute: vi.fn(),
    });

    expect(service.getPriorityNameSupport()).toEqual({
      supported: false,
      note: "priority-name is documented but not implemented in the current service layer.",
    });
  });

  it("builds remove with the documented args and returns a typed mutation result", async () => {
    const execute = vi.fn().mockResolvedValue({
      stdout: "Removed",
      stderr: "",
      exitCode: 0,
      signal: null,
      commandLine: "",
      durationMs: 1,
      ok: true,
    });
    const service = createTonStorageService({ config: daemonConfig, execute });

    const result = await service.removeBag({
      bagId: "951F17615255BE82E12C770143F80856091AA3A80B6E102CEA27616D0EF4FEB1",
      removeFiles: true,
    });

    expect(execute).toHaveBeenCalledWith({
      command: "storage-daemon-cli",
      args: [
        "-I",
        "127.0.0.1:5555",
        "-k",
        "/opt/ton-storage/db/cli-keys/client",
        "-p",
        "/opt/ton-storage/db/cli-keys/server.pub",
        "-c",
        "remove 951F17615255BE82E12C770143F80856091AA3A80B6E102CEA27616D0EF4FEB1 --remove-files",
      ],
    });
    expect(result).toEqual({
      action: "remove",
      status: "completed",
      bagId: "951F17615255BE82E12C770143F80856091AA3A80B6E102CEA27616D0EF4FEB1",
      rawOutput: "Removed",
    });
  });

  it("builds upload pause and resume with the documented args", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        stdout: "Upload paused",
        stderr: "",
        exitCode: 0,
        signal: null,
        commandLine: "",
        durationMs: 1,
        ok: true,
      })
      .mockResolvedValueOnce({
        stdout: "Upload resumed",
        stderr: "",
        exitCode: 0,
        signal: null,
        commandLine: "",
        durationMs: 1,
        ok: true,
      });
    const service = createTonStorageService({ config: daemonConfig, execute });

    const pauseResult = await service.pauseUpload({
      bagId: "951F17615255BE82E12C770143F80856091AA3A80B6E102CEA27616D0EF4FEB1",
    });
    const resumeResult = await service.resumeUpload({
      bagId: "951F17615255BE82E12C770143F80856091AA3A80B6E102CEA27616D0EF4FEB1",
    });

    expect(execute).toHaveBeenNthCalledWith(1, {
      command: "storage-daemon-cli",
      args: [
        "-I",
        "127.0.0.1:5555",
        "-k",
        "/opt/ton-storage/db/cli-keys/client",
        "-p",
        "/opt/ton-storage/db/cli-keys/server.pub",
        "-c",
        "upload-pause 951F17615255BE82E12C770143F80856091AA3A80B6E102CEA27616D0EF4FEB1",
      ],
    });
    expect(execute).toHaveBeenNthCalledWith(2, {
      command: "storage-daemon-cli",
      args: [
        "-I",
        "127.0.0.1:5555",
        "-k",
        "/opt/ton-storage/db/cli-keys/client",
        "-p",
        "/opt/ton-storage/db/cli-keys/server.pub",
        "-c",
        "upload-resume 951F17615255BE82E12C770143F80856091AA3A80B6E102CEA27616D0EF4FEB1",
      ],
    });
    expect(pauseResult).toEqual({
      action: "upload-pause",
      status: "accepted",
      bagId: null,
      rawOutput: "Upload paused",
    });
    expect(resumeResult).toEqual({
      action: "upload-resume",
      status: "accepted",
      bagId: null,
      rawOutput: "Upload resumed",
    });
  });

  it("builds get-provider-params with --json and parses the JSON payload", async () => {
    const execute = vi.fn().mockResolvedValue({
      stdout: `
\u001b[1;36m[ 3][t 0][2026-04-02 00:00:00.000000000][storage-daemon-cli.cpp:229][!extclient]\tConnected\u001b[0m
{
  "accept_new_contracts": true,
  "rate_per_mb_day": "1000000",
  "max_span": 86400,
  "minimal_file_size": "1048576",
  "maximal_file_size": "1073741824"
}
`,
      stderr: "",
      exitCode: 0,
      signal: null,
      commandLine: "",
      durationMs: 1,
      ok: true,
    });
    const service = createTonStorageService({ config: daemonConfig, execute });

    const result = await service.getProviderParams({
      providerAddress:
        "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
    });

    expect(execute).toHaveBeenCalledWith({
      command: "storage-daemon-cli",
      args: [
        "-I",
        "127.0.0.1:5555",
        "-k",
        "/opt/ton-storage/db/cli-keys/client",
        "-p",
        "/opt/ton-storage/db/cli-keys/server.pub",
        "-c",
        "get-provider-params 0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787 --json",
      ],
    });
    expect(result).toEqual({
      accept_new_contracts: true,
      rate_per_mb_day: "1000000",
      max_span: 86400,
      minimal_file_size: "1048576",
      maximal_file_size: "1073741824",
    });
  });

  it("builds set-provider-params with verified CLI flags", async () => {
    const execute = vi.fn().mockResolvedValue({
      stdout: "Provider params updated",
      stderr: "",
      exitCode: 0,
      signal: null,
      commandLine: "",
      durationMs: 1,
      ok: true,
    });
    const service = createTonStorageService({ config: daemonConfig, execute });

    const result = await service.setProviderParams({
      acceptNewContracts: false,
      ratePerMbDayNanoTon: 1000000,
      maxSpanSeconds: 86400,
      minimalFileSizeBytes: 1048576,
      maximalFileSizeBytes: 1073741824,
    });

    expect(execute).toHaveBeenCalledWith({
      command: "storage-daemon-cli",
      args: [
        "-I",
        "127.0.0.1:5555",
        "-k",
        "/opt/ton-storage/db/cli-keys/client",
        "-p",
        "/opt/ton-storage/db/cli-keys/server.pub",
        "-c",
        "set-provider-params --accept 0 --rate 1000000 --max-span 86400 --min-file-size 1048576 --max-file-size 1073741824",
      ],
    });
    expect(result).toEqual({
      action: "set-provider-params",
      status: "completed",
      rawOutput: "Provider params updated",
    });
  });
});
