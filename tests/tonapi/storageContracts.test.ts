import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/tonapi/client", () => ({
  tonApiFetch: vi.fn(),
}));

import { tonApiFetch } from "../../src/server/tonapi/client";
import { listBagStorageContracts } from "../../src/server/tonapi/storageContracts";

describe("listBagStorageContracts", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("finds and filters storage contracts for a specific bag from wallet traces", async () => {
    vi.mocked(tonApiFetch).mockImplementation(async (path: string) => {
      if (path === "/v2/accounts/0:3004c6524d1cfa7313cecd2c33f370dde1b65d30a0d9c744d3561c06ce07d291/traces?limit=20") {
        return {
          traces: [{ id: "trace-1", utime: 1 }],
        };
      }

      if (path === "/v2/traces/trace-1") {
        return {
          transaction: {
            account: {
              address:
                "0:3004c6524d1cfa7313cecd2c33f370dde1b65d30a0d9c744d3561c06ce07d291",
            },
            interfaces: ["wallet_v5r1"],
          },
          children: [
            {
              transaction: {
                account: {
                  address:
                    "0:fb79a346def70bb8814b145c0233e1c40c6d6a56d7034f2f9cfebb48098eb460",
                },
                interfaces: ["storage_contract"],
              },
              children: [],
            },
            {
              transaction: {
                account: {
                  address:
                    "0:3e74c58e06e31b88282dd392877f3be1981dddd98150dcbe65469f86f579630e",
                },
                interfaces: ["storage_contract"],
              },
              children: [],
            },
          ],
        };
      }

      if (
        path ===
        "/v2/blockchain/accounts/0:fb79a346def70bb8814b145c0233e1c40c6d6a56d7034f2f9cfebb48098eb460"
      ) {
        return {
          address:
            "0:fb79a346def70bb8814b145c0233e1c40c6d6a56d7034f2f9cfebb48098eb460",
          balance: 145103137,
          status: "active",
        };
      }

      if (
        path ===
        "/v2/blockchain/accounts/0:fb79a346def70bb8814b145c0233e1c40c6d6a56d7034f2f9cfebb48098eb460/methods/get_storage_contract_data"
      ) {
        return {
          success: true,
          stack: [
            { type: "num", num: "0x1" },
            {
              type: "num",
              num: "0xbfd0ee352c1899cd551b07757ce2578f668be19e53a38ecc3c59be50ff954cd0",
            },
          ],
          decoded: {
            active: true,
            balance: "145103137",
            provider:
              "0:95ef800ce4eea840219efb5ba5b73265c767faee1ba8fb8673b12f3861d61f79",
            client:
              "0:3004c6524d1cfa7313cecd2c33f370dde1b65d30a0d9c744d3561c06ce07d291",
            file_size: 8143803,
            next_proof: 6573817,
            rate_per_mb_day: 1000000,
            max_span: 86400,
            last_proof_time: 1774984993,
          },
        };
      }

      if (
        path ===
        "/v2/blockchain/accounts/0:3e74c58e06e31b88282dd392877f3be1981dddd98150dcbe65469f86f579630e"
      ) {
        return {
          address:
            "0:3e74c58e06e31b88282dd392877f3be1981dddd98150dcbe65469f86f579630e",
          balance: 2740400,
          status: "active",
        };
      }

      if (
        path ===
        "/v2/blockchain/accounts/0:3e74c58e06e31b88282dd392877f3be1981dddd98150dcbe65469f86f579630e/methods/get_storage_contract_data"
      ) {
        return {
          success: true,
          stack: [
            { type: "num", num: "0x1" },
            {
              type: "num",
              num: "0x6a2446d79b9a705cb85cfd64b0c1ac09931c46c5d67c8af5ee54c1e1154abbea",
            },
          ],
          decoded: {
            active: false,
            balance: "2740400",
            provider:
              "0:eab486e7a61723c77d74cc7ae7ee8f45c03f93a164dbd69b081f9203a3211a75",
            client:
              "0:3004c6524d1cfa7313cecd2c33f370dde1b65d30a0d9c744d3561c06ce07d291",
            file_size: 607544,
            next_proof: 0,
            rate_per_mb_day: 1,
            max_span: 86400,
            last_proof_time: 1774824842,
          },
        };
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    const result = await listBagStorageContracts({
      bagId: "BFD0EE352C1899CD551B07757CE2578F668BE19E53A38ECC3C59BE50FF954CD0",
      walletAddress:
        "0:3004c6524d1cfa7313cecd2c33f370dde1b65d30a0d9c744d3561c06ce07d291",
    });

    expect(result.contracts).toEqual([
      expect.objectContaining({
        addressRaw:
          "0:fb79a346def70bb8814b145c0233e1c40c6d6a56d7034f2f9cfebb48098eb460",
        bagId: "BFD0EE352C1899CD551B07757CE2578F668BE19E53A38ECC3C59BE50FF954CD0",
        active: true,
        creationTraceId: "trace-1",
        balanceTon: "0.145103137",
      }),
    ]);
  });
});
