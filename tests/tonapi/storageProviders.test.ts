import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/tonapi/client", () => ({
  tonApiFetch: vi.fn(),
}));

import { tonApiFetch } from "../../src/server/tonapi/client";
import { listStorageProviders } from "../../src/server/tonapi/storageProviders";

describe("listStorageProviders", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("maps TonAPI providers into app-facing display data", async () => {
    const lastActivityUnix = 1774991609;
    const lastActivityIso = new Date(lastActivityUnix * 1000).toISOString();
    const lastActivityLabel = new Date(lastActivityIso).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    });

    vi.mocked(tonApiFetch)
      .mockResolvedValueOnce({
        providers: [
          {
            address: "0:provider-1",
            accept_new_contracts: true,
            rate_per_mb_day: 2000,
            max_span: 3000,
            minimal_file_size: 1,
            maximal_file_size: 10000000126,
          },
        ],
      })
      .mockResolvedValueOnce({
        rates: {
          TON: {
            prices: {
              USD: 5,
            },
          },
        },
      })
      .mockResolvedValueOnce({
        address: "0:provider-1",
        last_activity: lastActivityUnix,
        status: "active",
      });

    const result = await listStorageProviders();

    expect(tonApiFetch).toHaveBeenCalledWith("/v2/storage/providers");
    expect(tonApiFetch).toHaveBeenCalledWith("/v2/rates?tokens=ton&currencies=usd");
    expect(tonApiFetch).toHaveBeenCalledWith("/v2/accounts/0:provider-1");
    expect(result.providers).toEqual([
      {
        address: "0:provider-1",
        acceptNewContracts: true,
        ratePerMbDayNanoTon: 2000,
        ratePerMbDayTonValue: 0.000002,
        ratePerMbDayTon: "0.000002",
        ratePerMbDayUsdValue: 0.00001,
        ratePerMbDayUsd: "$0.00001 USD / MB / day",
        maxSpan: 3000,
        maxSpanLabel: "0d:0h:50m",
        minimalFileSize: 1,
        minimalFileSizeLabel: "1 B",
        maximalFileSize: 10000000126,
        maximalFileSizeLabel: "9.3 GB",
        lastActivityUnix,
        lastActivityIso,
        lastActivityLabel,
      },
    ]);
  });
});
