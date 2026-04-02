import { describe, expect, it, vi } from "vitest";
import { uploadFileWithSftp } from "../../src/server/ssh/sftp";

describe("uploadFileWithSftp", () => {
  it("uploads via a mocked SFTP client and returns typed metadata", async () => {
    const client = {
      fastPut: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const now = vi.fn().mockReturnValueOnce(50).mockReturnValueOnce(80);
    const result = await uploadFileWithSftp(
      client,
      {
        localPath: "/tmp/archive.car",
        remotePath: "/srv/ton/archive.car",
      },
      {
        now,
        statLocalFile: vi.fn().mockResolvedValue({ size: 4096 }),
      },
    );

    expect(client.fastPut).toHaveBeenCalledWith(
      "/tmp/archive.car",
      "/srv/ton/archive.car",
    );
    expect(client.close).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      bytesTransferred: 4096,
      durationMs: 30,
      localPath: "/tmp/archive.car",
      ok: true,
      remotePath: "/srv/ton/archive.car",
    });
  });
});
