import { describe, expect, it } from "vitest";
import {
  buildTonkeeperTransferLink,
  encodeCloseStorageContractPayload,
} from "../../src/server/storage-contracts/links";

describe("storage contract Tonkeeper helpers", () => {
  it("encodes the documented close-storage-contract payload", () => {
    expect(encodeCloseStorageContractPayload("0")).toBe(
      "te6cckEBAQEADgAAGHn5N+oAAAAAAAAAAGcU6HU=",
    );
  });

  it("builds a Tonkeeper transfer link for a prepared payload", () => {
    const result = buildTonkeeperTransferLink({
      address: "0:fb79a346def70bb8814b145c0233e1c40c6d6a56d7034f2f9cfebb48098eb460",
      amountTon: "0.05",
      payloadBase64: "te6cckEBAQEADgAAGHn5N+oAAAAAAAAAAGcU6HU=",
    });

    expect(result.addressFriendly).toBe(
      "EQD7eaNG3vcLuIFLFFwCM-HEDG1qVtcDTy-c_rtICY60YKMf",
    );
    expect(result.amountNanoTon).toBe("50000000");
    expect(result.tonkeeperLink).toContain("amount=50000000");
    expect(result.tonkeeperLink).toContain("bin=te6cckEBAQEADgAAGHn5N%2BoAAAAAAAAAAGcU6HU%3D");
  });

  it("builds a non-bounceable Tonkeeper transfer link without a payload when requested", () => {
    const result = buildTonkeeperTransferLink({
      address: "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
      amountTon: "1",
      bounceable: false,
    });

    expect(result.addressFriendly.startsWith("UQ")).toBe(true);
    expect(result.amountNanoTon).toBe("1000000000");
    expect(result.tonkeeperLink).toContain("amount=1000000000");
    expect(result.tonkeeperLink).not.toContain("bin=");
  });
});
