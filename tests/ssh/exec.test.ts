import { describe, expect, it, vi } from "vitest";
import {
  buildRemoteCommandLine,
  execRemoteCommand,
} from "../../src/server/ssh/exec";

describe("buildRemoteCommandLine", () => {
  it("quotes command parts and prefixes cwd and env", () => {
    const commandLine = buildRemoteCommandLine({
      command: "storage-daemon-cli",
      args: ["list", "bag's id"],
      cwd: "/var/lib/ton storage",
      env: {
        TON_ENV: "prod mode",
      },
    });

    expect(commandLine).toBe(
      "cd '/var/lib/ton storage' && env TON_ENV='prod mode' && 'storage-daemon-cli' 'list' 'bag'\"'\"'s id'",
    );
  });
});

describe("execRemoteCommand", () => {
  it("returns a typed exec result from a mocked executor", async () => {
    const executor = {
      exec: vi.fn().mockResolvedValue({
        stdout: "bags",
        stderr: "",
        exitCode: 0,
        signal: null,
      }),
    };

    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(135);
    const result = await execRemoteCommand(
      executor,
      {
        command: "storage-daemon-cli",
        args: ["list"],
      },
      { now },
    );

    expect(executor.exec).toHaveBeenCalledWith("'storage-daemon-cli' 'list'");
    expect(result).toEqual({
      commandLine: "'storage-daemon-cli' 'list'",
      durationMs: 35,
      exitCode: 0,
      ok: true,
      signal: null,
      stderr: "",
      stdout: "bags",
    });
  });
});
