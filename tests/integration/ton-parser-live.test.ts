import { describe, expect, it } from "vitest";
import { resetRuntimeConfigCache } from "../../src/server/config/env";
import { withTonStorageService } from "../../src/server/ton-storage/runtime";

function hasLiveTonEnv() {
  const authMode = process.env.TON_SSH_AUTH_MODE ?? "agent";
  const hasAuth =
    (authMode === "agent" && Boolean(process.env.SSH_AUTH_SOCK)) ||
    (authMode === "key_path" && Boolean(process.env.TON_SSH_PRIVATE_KEY_PATH)) ||
    (authMode === "inline_key" && Boolean(process.env.TON_SSH_PRIVATE_KEY));

  return Boolean(
    process.env.TON_SSH_HOST &&
      process.env.TON_SSH_USER &&
      hasAuth,
  );
}

const describeLive = hasLiveTonEnv() ? describe : describe.skip;

describeLive("live TON parser verification", () => {
  it("parses real bag list output from the configured VPS", async () => {
    resetRuntimeConfigCache();

    const result = await withTonStorageService((service) => service.listBags());

    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.rawOutput).toBe("string");
    expect(result.rawOutput.length).toBeGreaterThan(0);
  });

  it("parses real bag detail and peer output when at least one bag exists", async () => {
    resetRuntimeConfigCache();

    const listResult = await withTonStorageService((service) => service.listBags());

    if (listResult.items.length === 0) {
      return;
    }

    const bagId = listResult.items[0]!.id;
    const [detailResult, peersResult] = await Promise.all([
      withTonStorageService((service) => service.getBagById(bagId)),
      withTonStorageService((service) => service.getBagPeers(bagId)),
    ]);

    expect(detailResult.item.id).toBeTruthy();
    expect(typeof detailResult.rawOutput).toBe("string");
    expect(Array.isArray(detailResult.item.files)).toBe(true);
    expect(Array.isArray(peersResult.items)).toBe(true);
    expect(typeof peersResult.rawOutput).toBe("string");
  });

  it("can export metadata when TON_LIVE_META_OUTPUT_PATH is provided", async () => {
    resetRuntimeConfigCache();

    const outputPath = process.env.TON_LIVE_META_OUTPUT_PATH;

    if (!outputPath) {
      return;
    }

    const listResult = await withTonStorageService((service) => service.listBags());

    if (listResult.items.length === 0) {
      return;
    }

    const bagId = listResult.items[0]!.id;
    const metaResult = await withTonStorageService((service) =>
      service.getMeta({
        bagId,
        outputPath,
      }),
    );

    expect(metaResult.bagId).toBe(bagId);
    expect(metaResult.outputPath).toBe(outputPath);
    expect(typeof metaResult.rawOutput).toBe("string");
  });
});
