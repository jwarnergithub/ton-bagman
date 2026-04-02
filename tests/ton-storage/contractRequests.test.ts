import { describe, expect, it, vi } from "vitest";
import { prepareStartStorageContractLink } from "../../src/server/ton-storage/contractRequests";

const executorConfig = {
  tonDaemonControlAddress: "127.0.0.1:5555",
  tonDaemonCliKeyPath: "/opt/ton-storage/db/cli-keys/client",
  tonDaemonServerPubPath: "/opt/ton-storage/db/cli-keys/server.pub",
};

describe("prepareStartStorageContractLink", () => {
  it("cleans daemon banner noise out of generation failures", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        commandLine: "",
        durationMs: 1,
      })
      .mockResolvedValueOnce({
        ok: false,
        stdout: "",
        stderr:
          "\u001b[1;36m[ 3][t 0][2026-04-01 18:53:57.814090135][storage-daemon-cli.cpp:229][!extclient]\tConnected\u001b[0m",
        exitCode: 1,
        signal: null,
        commandLine: "",
        durationMs: 1,
      })
      .mockResolvedValueOnce({
        ok: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        commandLine: "",
        durationMs: 1,
      });

    await expect(
      prepareStartStorageContractLink(
        { config: executorConfig, execute },
        {
          bagId: "BFD0EE352C1899CD551B07757CE2578F668BE19E53A38ECC3C59BE50FF954CD0",
          providerAddress:
            "0:95EF800CE4EEA840219EFB5BA5B73265C767FAEE1BA8FB8673B12F3861D61F79",
          amountTon: "0.2",
        },
      ),
    ).rejects.toMatchObject({
      code: "CONTRACT_PREPARE_FAILED",
      message: "Failed to generate a storage contract request.",
    });
  });

  it("returns a start link when the request file exists even if the generation command exited nonzero", async () => {
    const payloadBase64 = "dGVzdC1wYXlsb2Fk";
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        commandLine: "",
        durationMs: 1,
      })
      .mockResolvedValueOnce({
        ok: false,
        stdout:
          "\u001b[1;36m[ 3][t 0][2026-04-01 18:53:57.814090135][storage-daemon-cli.cpp:229][!extclient]\tConnected\u001b[0m\nSaved message body to file",
        stderr:
          "\u001b[1;36m[ 3][t 0][2026-04-01 18:53:57.814090135][storage-daemon-cli.cpp:229][!extclient]\tConnected\u001b[0m",
        exitCode: 1,
        signal: null,
        commandLine: "",
        durationMs: 1,
      })
      .mockResolvedValueOnce({
        ok: true,
        stdout: payloadBase64,
        stderr: "",
        exitCode: 0,
        signal: null,
        commandLine: "",
        durationMs: 1,
      });

    const result = await prepareStartStorageContractLink(
      { config: executorConfig, execute },
      {
        bagId: "BFD0EE352C1899CD551B07757CE2578F668BE19E53A38ECC3C59BE50FF954CD0",
        providerAddress:
          "0:95EF800CE4EEA840219EFB5BA5B73265C767FAEE1BA8FB8673B12F3861D61F79",
        amountTon: "0.2",
      },
    );

    expect(result.payloadBase64).toBe(payloadBase64);
    expect(result.commandOutput).toBe("Saved message body to file");
    expect(result.tonkeeperLink).toContain("https://app.tonkeeper.com/transfer/");
  });

  it("retries transient liteserver synchronization failures", async () => {
    const payloadBase64 = "dGVzdC1wYXlsb2Fk";
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        commandLine: "",
        durationMs: 1,
      })
      .mockResolvedValueOnce({
        ok: false,
        stdout: "",
        stderr:
          "Query error: LITE_SERVER_NETWORKtimeout for adnl query query(during last block synchronization)",
        exitCode: 1,
        signal: null,
        commandLine: "",
        durationMs: 1,
      })
      .mockResolvedValueOnce({
        ok: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        commandLine: "",
        durationMs: 1,
      })
      .mockResolvedValueOnce({
        ok: true,
        stdout: "Saved message body to file",
        stderr: "",
        exitCode: 0,
        signal: null,
        commandLine: "",
        durationMs: 1,
      })
      .mockResolvedValueOnce({
        ok: true,
        stdout: payloadBase64,
        stderr: "",
        exitCode: 0,
        signal: null,
        commandLine: "",
        durationMs: 1,
      });

    const result = await prepareStartStorageContractLink(
      { config: executorConfig, execute },
      {
        bagId: "BFD0EE352C1899CD551B07757CE2578F668BE19E53A38ECC3C59BE50FF954CD0",
        providerAddress:
          "0:95EF800CE4EEA840219EFB5BA5B73265C767FAEE1BA8FB8673B12F3861D61F79",
        amountTon: "0.2",
      },
    );

    expect(result.payloadBase64).toBe(payloadBase64);
    expect(execute).toHaveBeenCalledTimes(5);
  });
});
