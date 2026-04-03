import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppError } from "../../src/server/errors/appError";

vi.mock("../../src/server/provider-management/service", () => ({
  getMyProviderOverview: vi.fn(),
  importMyProviderPrivateKey: vi.fn(),
  deployMyProvider: vi.fn(),
  clearPendingProviderDeployment: vi.fn(),
  initMyProvider: vi.fn(),
  updateMyProviderParams: vi.fn(),
  updateMyProviderConfig: vi.fn(),
  closeAcceptedProviderContract: vi.fn(),
}));

import { GET as getMyProviderRoute } from "../../app/api/my-provider/route";
import { POST as importKeyRoute } from "../../app/api/my-provider/import-key/route";
import { POST as deployRoute } from "../../app/api/my-provider/deploy/route";
import { POST as clearPendingDeploymentRoute } from "../../app/api/my-provider/pending-deployment/clear/route";
import { POST as initRoute } from "../../app/api/my-provider/init/route";
import { POST as paramsRoute } from "../../app/api/my-provider/params/route";
import { POST as configRoute } from "../../app/api/my-provider/config/route";
import { POST as closeContractRoute } from "../../app/api/my-provider/contracts/close/route";
import {
  closeAcceptedProviderContract,
  clearPendingProviderDeployment,
  deployMyProvider,
  getMyProviderOverview,
  importMyProviderPrivateKey,
  initMyProvider,
  updateMyProviderConfig,
  updateMyProviderParams,
} from "../../src/server/provider-management/service";

describe("my provider routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the provider overview", async () => {
    vi.mocked(getMyProviderOverview).mockResolvedValue({
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
      setupHint: "Not configured",
    });

    const response = await getMyProviderRoute();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: expect.objectContaining({
        configured: false,
        setupHint: "Not configured",
      }),
    });
  });

  it("imports a provider key through the route", async () => {
    vi.mocked(importMyProviderPrivateKey).mockResolvedValue({
      result: {
        action: "import-pk",
        status: "completed",
        rawOutput: "Imported",
      },
      overview: {
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
        setupHint: "Not configured",
      },
    });

    const request = new Request("http://localhost/api/my-provider/import-key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filePath: "/opt/ton-storage/provider.pk" }),
    });

    const response = await importKeyRoute(request as never);

    expect(importMyProviderPrivateKey).toHaveBeenCalledWith({
      filePath: "/opt/ton-storage/provider.pk",
    });
    expect(response.status).toBe(200);
  });

  it("passes deploy/init/params/config/close payloads through", async () => {
    vi.mocked(deployMyProvider).mockResolvedValue({
      result: {
        action: "deploy-provider",
        status: "completed",
        rawOutput: "deployed",
      },
      overview: {
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
        setupHint: "Not configured",
      },
    });
    vi.mocked(clearPendingProviderDeployment).mockResolvedValue({
      result: {
        action: "clear-pending-deployment",
        status: "completed",
        rawOutput: "cleared",
      },
      overview: {
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
        setupHint: "Not configured",
      },
    });
    vi.mocked(initMyProvider).mockResolvedValue({
      result: {
        action: "init-provider",
        status: "completed",
        rawOutput: "initialized",
      },
      overview: {
        configured: true,
        providerAddressRaw:
          "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
        providerAddressFriendly: "friendly",
        onChainBalanceTon: null,
        onChainBalanceNanoTon: null,
        lastActivityLabel: null,
        lastActivityUnix: null,
        params: null,
        config: null,
        contracts: [],
        pendingDeployment: null,
        rawInfo: {},
        setupHint: null,
      },
    });
    vi.mocked(updateMyProviderParams).mockResolvedValue({
      result: {
        action: "set-provider-params",
        status: "completed",
        rawOutput: "params updated",
      },
      overview: {
        configured: true,
        providerAddressRaw:
          "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
        providerAddressFriendly: "friendly",
        onChainBalanceTon: null,
        onChainBalanceNanoTon: null,
        lastActivityLabel: null,
        lastActivityUnix: null,
        params: null,
        config: null,
        contracts: [],
        pendingDeployment: null,
        rawInfo: {},
        setupHint: null,
      },
    });
    vi.mocked(updateMyProviderConfig).mockResolvedValue({
      result: {
        action: "set-provider-config",
        status: "completed",
        rawOutput: "config updated",
      },
      overview: {
        configured: true,
        providerAddressRaw:
          "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
        providerAddressFriendly: "friendly",
        onChainBalanceTon: null,
        onChainBalanceNanoTon: null,
        lastActivityLabel: null,
        lastActivityUnix: null,
        params: null,
        config: null,
        contracts: [],
        pendingDeployment: null,
        rawInfo: {},
        setupHint: null,
      },
    });
    vi.mocked(closeAcceptedProviderContract).mockResolvedValue({
      result: {
        action: "close-contract",
        status: "completed",
        rawOutput: "closed",
      },
      overview: {
        configured: true,
        providerAddressRaw:
          "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
        providerAddressFriendly: "friendly",
        onChainBalanceTon: null,
        onChainBalanceNanoTon: null,
        lastActivityLabel: null,
        lastActivityUnix: null,
        params: null,
        config: null,
        contracts: [],
        pendingDeployment: null,
        rawInfo: {},
        setupHint: null,
      },
    });

    await deployRoute();

    const initRequest = new Request("http://localhost/api/my-provider/init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerAddress: "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
      }),
    });
    await initRoute(initRequest as never);

    const paramsRequest = new Request("http://localhost/api/my-provider/params", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ acceptNewContracts: false }),
    });
    await paramsRoute(paramsRequest as never);

    const configRequest = new Request("http://localhost/api/my-provider/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maxContracts: 5 }),
    });
    await configRoute(configRequest as never);

    const closeRequest = new Request("http://localhost/api/my-provider/contracts/close", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contractAddress:
          "0:8e70eccce69f440d6420f232fa37f3f1b50df04fc1ef075f6016586a3858a487",
        confirmation: "CLOSE PROVIDER CONTRACT",
      }),
    });
    await closeContractRoute(closeRequest as never);
    await clearPendingDeploymentRoute();

    expect(deployMyProvider).toHaveBeenCalled();
    expect(clearPendingProviderDeployment).toHaveBeenCalled();
    expect(initMyProvider).toHaveBeenCalledWith({
      providerAddress: "0:1ADFD61B065544148AA1766AA1C13825BE7C993724A7BBBC9787F0F903921787",
    });
    expect(updateMyProviderParams).toHaveBeenCalledWith({ acceptNewContracts: false });
    expect(updateMyProviderConfig).toHaveBeenCalledWith({ maxContracts: 5 });
    expect(closeAcceptedProviderContract).toHaveBeenCalledWith({
      contractAddress:
        "0:8e70eccce69f440d6420f232fa37f3f1b50df04fc1ef075f6016586a3858a487",
      confirmation: "CLOSE PROVIDER CONTRACT",
    });
  });

  it("returns typed provider errors", async () => {
    vi.mocked(getMyProviderOverview).mockRejectedValue(
      createAppError("PROVIDER_LOOKUP_FAILED", "Lookup failed.", 503),
    );

    const response = await getMyProviderRoute();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "PROVIDER_LOOKUP_FAILED",
        message: "Lookup failed.",
      },
    });
  });
});
