import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppError } from "../../src/server/errors/appError";

vi.mock("../../src/server/ton-storage/runtime", () => ({
  withTonStorageService: vi.fn(),
}));

vi.mock("../../src/server/tonapi/client", () => ({
  tonApiFetch: vi.fn(),
}));

vi.mock("../../src/server/tonapi/storageContracts", () => ({
  listStorageContractsForProvider: vi.fn(),
}));

vi.mock("../../src/server/audit/logger", () => ({
  logDangerousAction: vi.fn(),
}));

vi.mock("../../src/server/provider-management/deploymentRecord", () => ({
  getPendingProviderDeploymentRecord: vi.fn(),
  savePendingProviderDeploymentRecord: vi.fn(),
  removePendingProviderDeploymentRecord: vi.fn(),
}));

import {
  clearPendingProviderDeployment,
  closeAcceptedProviderContract,
  deployMyProvider,
  getMyProviderOverview,
  initMyProvider,
} from "../../src/server/provider-management/service";
import { logDangerousAction } from "../../src/server/audit/logger";
import { tonApiFetch } from "../../src/server/tonapi/client";
import { listStorageContractsForProvider } from "../../src/server/tonapi/storageContracts";
import { withTonStorageService } from "../../src/server/ton-storage/runtime";
import {
  getPendingProviderDeploymentRecord,
  removePendingProviderDeploymentRecord,
  savePendingProviderDeploymentRecord,
} from "../../src/server/provider-management/deploymentRecord";

function createServiceMock() {
  return {
    deployProvider: vi.fn(),
    initProvider: vi.fn(),
    getProviderInfo: vi.fn(),
    getProviderParams: vi.fn(),
    listBags: vi.fn(),
    closeProviderContract: vi.fn(),
  };
}

describe("provider management service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a setup-state overview when no provider is configured", async () => {
    const service = createServiceMock();
    service.getProviderInfo.mockRejectedValue(
      createAppError("TON_COMMAND_FAILED", "Query error: No storage provider", 502),
    );
    vi.mocked(getPendingProviderDeploymentRecord).mockResolvedValue(null);

    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback(service as never),
    );

    const result = await getMyProviderOverview();

    expect(result).toEqual({
      configured: false,
      providerAddressRaw: null,
      providerAddressFriendly: null,
      onChainBalanceTon: null,
      onChainBalanceNanoTon: null,
      lastActivityLabel: null,
      lastActivityUnix: null,
      params: null,
      config: null,
      contracts: [],
      pendingDeployment: null,
      rawInfo: null,
      setupHint: expect.stringContaining("No provider is initialized"),
    });
  });

  it("builds a configured overview with params, balance, and accepted contracts", async () => {
    const service = createServiceMock();
    service.getProviderInfo.mockResolvedValue({
      provider_address:
        "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
      max_contracts: 1000,
      max_total_size: 137438953472,
      current_contracts: 1,
    });
    service.getProviderParams.mockResolvedValue({
      accept_new_contracts: true,
      rate_per_mb_day: "1000000",
      max_span: 86400,
      minimal_file_size: "1048576",
      maximal_file_size: "1073741824",
    });
    service.listBags.mockResolvedValue({
      items: [
        {
          index: 0,
          id: "BFD0EE352C1899CD551B07757CE2578F668BE19E53A38ECC3C59BE50FF954CD0",
          description: "Selfie Picture",
          downloaded: null,
          total: null,
          downloadRate: null,
          uploadRate: null,
        },
      ],
      totalBags: 1,
      rawOutput: "",
    });

    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback(service as never),
    );
    vi.mocked(getPendingProviderDeploymentRecord).mockResolvedValue(null);
    vi.mocked(tonApiFetch).mockResolvedValue({
      address: "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
      balance: "989300348",
      last_activity: 1775080000,
      status: "active",
    });
    vi.mocked(listStorageContractsForProvider).mockResolvedValue([
      {
        addressRaw:
          "0:8e70eccce69f440d6420f232fa37f3f1b50df04fc1ef075f6016586a3858a487",
        addressFriendly: "EQCOcOzM5p9EDWQg8jL6N_PxtQ3wT8HvB19gFWhqOFikhw",
        bagId: "BFD0EE352C1899CD551B07757CE2578F668BE19E53A38ECC3C59BE50FF954CD0",
        providerAddressRaw:
          "0:1adfd61b065544148aa1766aa1c13825be7c993724a7bbbc9787f0f903921787",
        providerAddressFriendly: "provider",
        clientAddressRaw:
          "0:3004c6524d1cfa7313cecd2c33f370dde1b65d30a0d9c744d3561c06ce07d291",
        clientAddressFriendly: "client",
        creationTraceId: "trace-1",
        latestTraceIds: ["trace-1"],
        onChainStatus: "active",
        active: true,
        balanceNanoTon: "145103137",
        balanceTon: "0.145103137",
        fileSize: 8143803,
        nextProof: 6573817,
        ratePerMbDayNanoTon: 1000000,
        maxSpanSeconds: 86400,
        lastProofTime: 1774984993,
        estimatedDailyCostNanoTon: "7767",
        estimatedDailyCostTon: "0.000007767",
        estimatedSecondsRemaining: 1000,
        estimatedExpiresAt: 1775089999,
      },
    ]);

    const result = await getMyProviderOverview();

    expect(result.configured).toBe(true);
    expect(result.providerAddressRaw).toBe(
      "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
    );
    expect(result.onChainBalanceTon).toBe("0.989300348");
    expect(result.params?.acceptNewContracts).toBe(true);
    expect(result.config?.maxContracts).toBe(1000);
    expect(result.pendingDeployment).toBeNull();
    expect(result.contracts[0]).toEqual(
      expect.objectContaining({
        bagId: "BFD0EE352C1899CD551B07757CE2578F668BE19E53A38ECC3C59BE50FF954CD0",
        bagDescription: "Selfie Picture",
        bagPresentLocally: true,
      }),
    );
  });

  it("requires explicit confirmation before closing an accepted contract", async () => {
    await expect(
      closeAcceptedProviderContract({
        contractAddress:
          "0:8e70eccce69f440d6420f232fa37f3f1b50df04fc1ef075f6016586a3858a487",
        confirmation: "close it",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("returns a Tonkeeper funding link after provider deployment when an address is available", async () => {
    const service = createServiceMock();
    service.deployProvider = vi.fn().mockResolvedValue({
      action: "deploy-provider",
      status: "completed",
      rawOutput:
        "Provider deployed at 0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
      providerAddress:
        "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
    });
    service.getProviderInfo.mockRejectedValue(
      createAppError("TON_COMMAND_FAILED", "Query error: No storage provider", 502),
    );
    vi.mocked(savePendingProviderDeploymentRecord).mockResolvedValue();
    vi.mocked(getPendingProviderDeploymentRecord).mockResolvedValue({
      providerAddressRaw:
        "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
      tonkeeperAddressFriendly: "UQ-provider",
      tonkeeperLink: "https://app.tonkeeper.com/transfer/UQ-provider?amount=1000000000",
      amountTon: "1",
      amountNanoTon: "1000000000",
      createdAt: "2026-04-02T18:00:00.000Z",
    });

    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback(service as never),
    );

    const result = await deployMyProvider();

    expect(result.result.tonkeeperLink).toContain("https://app.tonkeeper.com/transfer/");
    expect(result.result.amountTon).toBe("1");
    expect(result.result.amountNanoTon).toBe("1000000000");
    expect(result.result.tonkeeperAddressFriendly?.startsWith("UQ")).toBe(true);
    expect(savePendingProviderDeploymentRecord).toHaveBeenCalled();
    expect(result.overview.pendingDeployment).toEqual(
      expect.objectContaining({
        providerAddressRaw:
          "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
      }),
    );
  });

  it("clears a stuck pending provider deployment record", async () => {
    const service = createServiceMock();
    service.getProviderInfo.mockRejectedValue(
      createAppError("TON_COMMAND_FAILED", "Query error: No storage provider", 502),
    );
    vi.mocked(getPendingProviderDeploymentRecord).mockResolvedValue(null);

    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback(service as never),
    );

    const result = await clearPendingProviderDeployment();

    expect(removePendingProviderDeploymentRecord).toHaveBeenCalled();
    expect(result.result).toMatchObject({
      action: "clear-pending-deployment",
      status: "completed",
    });
    expect(result.overview.pendingDeployment).toBeNull();
  });

  it("treats init as already connected when the daemon is already initialized to the same provider", async () => {
    const service = createServiceMock();
    service.initProvider = vi
      .fn()
      .mockRejectedValue(
        createAppError("TON_COMMAND_FAILED", "Query error: Storage provider already exists", 502),
      );
    service.getProviderInfo.mockResolvedValue({
      provider_address:
        "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
      max_contracts: 1000,
      max_total_size: 137438953472,
      contracts_count: 0,
    });
    service.getProviderParams.mockResolvedValue({
      accept_new_contracts: true,
      rate_per_mb_day: "1000000",
      max_span: 86400,
      minimal_file_size: "1048576",
      maximal_file_size: "1073741824",
    });
    service.listBags.mockResolvedValue({
      items: [],
      totalBags: 0,
      rawOutput: "",
    });

    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback(service as never),
    );
    vi.mocked(tonApiFetch).mockResolvedValue({
      address: "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
      balance: "992827199",
      last_activity: 1775080000,
      status: "active",
    });
    vi.mocked(listStorageContractsForProvider).mockResolvedValue([]);
    vi.mocked(getPendingProviderDeploymentRecord).mockResolvedValue({
      providerAddressRaw:
        "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
      tonkeeperAddressFriendly: "UQ-provider",
      tonkeeperLink: "https://app.tonkeeper.com/transfer/UQ-provider?amount=1000000000",
      amountTon: "1",
      amountNanoTon: "1000000000",
      createdAt: "2026-04-02T18:00:00.000Z",
    });

    const result = await initMyProvider({
      providerAddress:
        "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
    });

    expect(result.result.rawOutput).toContain("already connected");
    expect(result.overview.configured).toBe(true);
  });

  it("audits and closes an accepted provider contract", async () => {
    const service = createServiceMock();
    service.closeProviderContract.mockResolvedValue({
      action: "close-contract",
      status: "completed",
      rawOutput: "Closed contract",
      contractAddress:
        "0:8e70eccce69f440d6420f232fa37f3f1b50df04fc1ef075f6016586a3858a487",
    });
    service.getProviderInfo.mockRejectedValue(
      createAppError("TON_COMMAND_FAILED", "Query error: No storage provider", 502),
    );
    vi.mocked(getPendingProviderDeploymentRecord).mockResolvedValue(null);

    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback(service as never),
    );

    const result = await closeAcceptedProviderContract({
      contractAddress:
        "0:8e70eccce69f440d6420f232fa37f3f1b50df04fc1ef075f6016586a3858a487",
      confirmation: "CLOSE PROVIDER CONTRACT",
    });

    expect(logDangerousAction).toHaveBeenNthCalledWith(1, {
      action: "provider-contract-close-requested",
      target:
        "0:8e70eccce69f440d6420f232fa37f3f1b50df04fc1ef075f6016586a3858a487",
    });
    expect(logDangerousAction).toHaveBeenNthCalledWith(2, {
      action: "provider-contract-close-completed",
      target:
        "0:8e70eccce69f440d6420f232fa37f3f1b50df04fc1ef075f6016586a3858a487",
    });
    expect(result.result.action).toBe("close-contract");
  });

  it("clears the pending deployment record once the matching provider is initialized", async () => {
    const service = createServiceMock();
    service.getProviderInfo.mockResolvedValue({
      provider_address:
        "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
    });
    service.getProviderParams.mockResolvedValue({
      accept_new_contracts: true,
      rate_per_mb_day: "1000000",
      max_span: 86400,
      minimal_file_size: "1048576",
      maximal_file_size: "1073741824",
    });
    service.listBags.mockResolvedValue({
      items: [],
      totalBags: 0,
      rawOutput: "",
    });

    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback(service as never),
    );
    vi.mocked(tonApiFetch).mockResolvedValue({
      address: "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
      balance: "989300348",
      last_activity: 1775080000,
      status: "active",
    });
    vi.mocked(listStorageContractsForProvider).mockResolvedValue([]);
    vi.mocked(getPendingProviderDeploymentRecord).mockResolvedValue({
      providerAddressRaw:
        "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
      tonkeeperAddressFriendly: "UQ-provider",
      tonkeeperLink: "https://app.tonkeeper.com/transfer/UQ-provider?amount=1000000000",
      amountTon: "1",
      amountNanoTon: "1000000000",
      createdAt: "2026-04-02T18:00:00.000Z",
    });

    const result = await getMyProviderOverview();

    expect(removePendingProviderDeploymentRecord).toHaveBeenCalled();
    expect(result.pendingDeployment).toBeNull();
  });
});
