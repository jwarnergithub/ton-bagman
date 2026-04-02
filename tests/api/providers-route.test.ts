import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppError } from "../../src/server/errors/appError";

vi.mock("../../src/server/tonapi/storageProviders", () => ({
  listStorageProviders: vi.fn(),
}));

import { GET } from "../../app/api/providers/route";
import { listStorageProviders } from "../../src/server/tonapi/storageProviders";

describe("GET /api/providers", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the storage provider list", async () => {
    vi.mocked(listStorageProviders).mockResolvedValue({
      providers: [
        {
          address: "0:provider-1",
          acceptNewContracts: true,
          ratePerMbDayNanoTon: 2000,
          ratePerMbDayTonValue: 0.000002,
          ratePerMbDayTon: "0.000002",
          maxSpan: 3000,
          maxSpanLabel: "0d:0h:50m",
          minimalFileSize: 1,
          minimalFileSizeLabel: "1 B",
          maximalFileSize: 10000000126,
          maximalFileSizeLabel: "9.3 GB",
          lastActivityUnix: 1774991609,
          lastActivityIso: "2026-03-31T22:06:49.000Z",
          lastActivityLabel: "Mar 31, 2026, 10:06 PM",
        },
      ],
      fetchedAt: "2026-03-29T12:00:00.000Z",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        providers: [
          {
            address: "0:provider-1",
            acceptNewContracts: true,
            ratePerMbDayNanoTon: 2000,
            ratePerMbDayTonValue: 0.000002,
            ratePerMbDayTon: "0.000002",
            maxSpan: 3000,
            maxSpanLabel: "0d:0h:50m",
            minimalFileSize: 1,
            minimalFileSizeLabel: "1 B",
            maximalFileSize: 10000000126,
            maximalFileSizeLabel: "9.3 GB",
            lastActivityUnix: 1774991609,
            lastActivityIso: "2026-03-31T22:06:49.000Z",
            lastActivityLabel: "Mar 31, 2026, 10:06 PM",
          },
        ],
        fetchedAt: "2026-03-29T12:00:00.000Z",
      },
    });
  });

  it("returns typed errors when provider lookup fails", async () => {
    vi.mocked(listStorageProviders).mockRejectedValue(
      createAppError("PROVIDER_LOOKUP_FAILED", "TonAPI unavailable.", 503),
    );

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "PROVIDER_LOOKUP_FAILED",
        message: "TonAPI unavailable.",
      },
    });
  });
});
