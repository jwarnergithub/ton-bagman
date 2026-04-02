import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/ton-storage/runtime", () => ({
  withTonStorageService: vi.fn(),
}));

import { GET } from "../../app/api/bags/route";
import { withTonStorageService } from "../../src/server/ton-storage/runtime";

describe("GET /api/bags", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes the hashes query flag into the service layer", async () => {
    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback({
        listBags: vi.fn().mockResolvedValue({
          items: [],
          totalBags: 0,
          rawOutput: "",
        }),
        getBagById: vi.fn(),
        getBagPeers: vi.fn(),
        createBag: vi.fn(),
        addByHash: vi.fn(),
        addByMeta: vi.fn(),
        getMeta: vi.fn(),
        pauseDownload: vi.fn(),
        resumeDownload: vi.fn(),
        getPriorityNameSupport: vi.fn(),
      }),
    );

    const request = new Request("http://localhost/api/bags?hashes=true");
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        items: [],
        totalBags: 0,
        rawOutput: "",
      },
    });
  });
});
