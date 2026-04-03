import "server-only";
import { logDangerousAction } from "@/src/server/audit/logger";
import { createAppError } from "@/src/server/errors/appError";
import {
  getPendingProviderDeploymentRecord,
  removePendingProviderDeploymentRecord,
  savePendingProviderDeploymentRecord,
} from "@/src/server/provider-management/deploymentRecord";
import {
  buildTonkeeperTransferLink,
  formatTonFromNanoTonString,
} from "@/src/server/storage-contracts/links";
import { toFriendlyTonAddress } from "@/src/server/storage-contracts/validators";
import { listStorageContractsForProvider } from "@/src/server/tonapi/storageContracts";
import { tonApiFetch } from "@/src/server/tonapi/client";
import type { TonApiAccountSummary } from "@/src/server/tonapi/types";
import { withTonStorageService } from "@/src/server/ton-storage/runtime";
import type { BagSummary } from "@/src/server/ton-storage/types";
import {
  validateCloseProviderContractInput,
  validateImportProviderPrivateKeyInput,
  validateInitProviderInput,
  validateSetProviderConfigInput,
  validateSetProviderParamsInput,
} from "@/src/server/ton-storage/validators";
import type {
  CloseAcceptedContractRequest,
  ImportProviderPrivateKeyRequest,
  InitMyProviderRequest,
  MyProviderConfig,
  MyProviderContract,
  MyProviderMutationResponse,
  MyProviderOverview,
  MyProviderParams,
  UpdateMyProviderConfigRequest,
  UpdateMyProviderParamsRequest,
} from "@/src/server/provider-management/types";
import type { StorageContractSummary } from "@/src/server/storage-contracts/types";

type ProviderInfoJson = Record<string, unknown>;

function formatBytes(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${sizeBytes} B`;
}

function formatSpanAsDaysHoursMinutes(totalSeconds: number) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(clamped / 86400);
  const hours = Math.floor((clamped % 86400) / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);

  return `${days}d ${hours}h ${minutes}m`;
}

function formatUnixTime(value: number | null) {
  if (!value) {
    return "Not available";
  }

  return new Date(value * 1000).toLocaleString();
}

function formatRemainingTime(seconds: number | null) {
  if (!seconds || seconds <= 0) {
    return "Not available";
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${days}d ${hours}h ${minutes}m`;
}

function readUnknownAtPath(
  value: unknown,
  path: string[],
): unknown {
  let current: unknown = value;

  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function findFirstMatchingValue(
  value: unknown,
  paths: string[][],
): unknown {
  for (const path of paths) {
    const found = readUnknownAtPath(value, path);

    if (typeof found !== "undefined" && found !== null) {
      return found;
    }
  }

  return null;
}

function coerceNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function coerceBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["1", "true", "yes"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function coerceAddress(value: unknown) {
  if (typeof value === "string" && /^0:[A-Fa-f0-9]{64}$/.test(value.trim())) {
    return value.trim();
  }

  return null;
}

function extractProviderAddress(info: ProviderInfoJson) {
  const direct = findFirstMatchingValue(info, [
    ["provider_address"],
    ["providerAddress"],
    ["address"],
    ["provider", "address"],
  ]);

  if (typeof direct === "string") {
    return coerceAddress(direct);
  }

  return null;
}

function extractProviderConfig(info: ProviderInfoJson): MyProviderConfig {
  const contractsValue = findFirstMatchingValue(info, [
    ["contracts"],
    ["storage_contracts"],
  ]);
  const contracts = Array.isArray(contractsValue) ? contractsValue : null;
  const currentContracts =
    coerceNumber(
      findFirstMatchingValue(info, [
        ["current_contracts"],
        ["contracts_count"],
        ["contractsCount"],
      ]),
    ) ?? contracts?.length ?? null;

  const maxContracts =
    coerceNumber(
      findFirstMatchingValue(info, [
        ["max_contracts"],
        ["maxContracts"],
        ["config", "max_contracts"],
        ["config", "maxContracts"],
      ]),
    ) ?? null;

  const maxTotalSizeBytes =
    coerceNumber(
      findFirstMatchingValue(info, [
        ["max_total_size"],
        ["maxTotalSize"],
        ["config", "max_total_size"],
        ["config", "maxTotalSize"],
      ]),
    ) ?? null;

  return {
    maxContracts,
    maxTotalSizeBytes,
    maxTotalSizeLabel:
      typeof maxTotalSizeBytes === "number" ? formatBytes(maxTotalSizeBytes) : null,
    currentContracts,
  };
}

function mapParams(raw: Record<string, unknown>): MyProviderParams {
  const acceptNewContracts = Boolean(
    coerceBoolean(raw.accept_new_contracts ?? raw.acceptNewContracts),
  );
  const ratePerMbDayNanoTon =
    coerceNumber(raw.rate_per_mb_day ?? raw.ratePerMbDayNanoTon) ?? 0;
  const maxSpanSeconds = coerceNumber(raw.max_span ?? raw.maxSpan) ?? 0;
  const minimalFileSizeBytes =
    coerceNumber(raw.minimal_file_size ?? raw.minimalFileSize) ?? 0;
  const maximalFileSizeBytes =
    coerceNumber(raw.maximal_file_size ?? raw.maximalFileSize) ?? 0;

  return {
    acceptNewContracts,
    ratePerMbDayNanoTon,
    ratePerMbDayTon: formatTonFromNanoTonString(String(ratePerMbDayNanoTon)),
    maxSpanSeconds,
    minimalFileSizeBytes,
    minimalFileSizeLabel: formatBytes(minimalFileSizeBytes),
    maximalFileSizeBytes,
    maximalFileSizeLabel: formatBytes(maximalFileSizeBytes),
  };
}

function mapContract(
  contract: StorageContractSummary,
  localBagMap: Map<string, BagSummary>,
): MyProviderContract {
  const localBag = contract.bagId ? localBagMap.get(contract.bagId) ?? null : null;

  return {
    addressRaw: contract.addressRaw,
    addressFriendly: contract.addressFriendly,
    bagId: contract.bagId,
    bagDescription: localBag?.description ?? null,
    bagPresentLocally: Boolean(localBag),
    clientAddressFriendly: contract.clientAddressFriendly,
    balanceTon: contract.balanceTon,
    fileSizeLabel: formatBytes(contract.fileSize),
    active: contract.active,
    onChainStatus: contract.onChainStatus,
    maxSpanLabel: formatSpanAsDaysHoursMinutes(contract.maxSpanSeconds),
    lastProofTimeLabel: formatUnixTime(contract.lastProofTime),
    expiresAtLabel: formatUnixTime(contract.estimatedExpiresAt),
    timeLeftLabel: formatRemainingTime(contract.estimatedSecondsRemaining),
  };
}

async function readProviderAccount(address: string) {
  try {
    return await tonApiFetch<TonApiAccountSummary>(`/v2/accounts/${address}`, {
      revalidate: false,
    });
  } catch {
    return null;
  }
}

async function buildOverview(): Promise<MyProviderOverview> {
  const rawInfo = await withTonStorageService((service) =>
    service.getProviderInfo({
      includeBalances: true,
      includeContracts: true,
    }),
  ).catch((error: unknown) => {
    if (
      error instanceof Error &&
      ("code" in error ? (error as { code?: string }).code === "TON_COMMAND_FAILED" : true) &&
      error.message.includes("No storage provider")
    ) {
      return null;
    }

    throw error;
  });

  if (!rawInfo) {
    const pendingDeployment = await getPendingProviderDeploymentRecord();

    return {
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
      pendingDeployment: pendingDeployment
        ? {
            providerAddressRaw: pendingDeployment.providerAddressRaw,
            providerAddressFriendly: toFriendlyTonAddress(pendingDeployment.providerAddressRaw),
            tonkeeperAddressFriendly: pendingDeployment.tonkeeperAddressFriendly,
            tonkeeperLink: pendingDeployment.tonkeeperLink,
            amountTon: pendingDeployment.amountTon,
            amountNanoTon: pendingDeployment.amountNanoTon,
            createdAt: pendingDeployment.createdAt,
          }
        : null,
      rawInfo: null,
      setupHint:
        "No provider is initialized in the daemon yet. Import a provider key, deploy a provider contract if needed, then initialize the daemon with the provider address.",
    };
  }

  const providerAddressRaw = extractProviderAddress(rawInfo);

  const [paramsRaw, localBags] = await withTonStorageService(async (service) =>
    Promise.all([
      service.getProviderParams({}),
      service.listBags({ includeHashes: true }),
    ]),
  );

  const providerAccount = providerAddressRaw ? await readProviderAccount(providerAddressRaw) : null;
  const contracts = providerAddressRaw
    ? await listStorageContractsForProvider({ providerAddress: providerAddressRaw })
    : [];
  const localBagMap = new Map(localBags.items.map((item) => [item.id, item]));
  const pendingDeployment = await getPendingProviderDeploymentRecord();

  if (
    providerAddressRaw &&
    pendingDeployment?.providerAddressRaw &&
    pendingDeployment.providerAddressRaw === providerAddressRaw
  ) {
    await removePendingProviderDeploymentRecord();
  }

  return {
    configured: true,
    providerAddressRaw,
    providerAddressFriendly: providerAddressRaw
      ? toFriendlyTonAddress(providerAddressRaw)
      : null,
    onChainBalanceTon:
      providerAccount?.balance != null
        ? formatTonFromNanoTonString(String(providerAccount.balance))
        : null,
    onChainBalanceNanoTon:
      providerAccount?.balance != null ? String(providerAccount.balance) : null,
    lastActivityLabel: providerAccount?.last_activity
      ? new Date(providerAccount.last_activity * 1000).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC",
        })
      : null,
    lastActivityUnix: providerAccount?.last_activity ?? null,
    params: mapParams(paramsRaw),
    config: extractProviderConfig(rawInfo),
    contracts: contracts.map((contract) => mapContract(contract, localBagMap)),
    pendingDeployment: null,
    rawInfo,
    setupHint: null,
  };
}

export async function getMyProviderOverview() {
  try {
    return await buildOverview();
  } catch (error) {
    if (error instanceof Error) {
      throw createAppError("PROVIDER_LOOKUP_FAILED", error.message, 502);
    }

    throw createAppError("PROVIDER_LOOKUP_FAILED", "My provider lookup failed.", 502);
  }
}

async function buildMutationResponse(result: MyProviderMutationResponse["result"]) {
  return {
    result,
    overview: await getMyProviderOverview(),
  };
}

export async function importMyProviderPrivateKey(
  request: ImportProviderPrivateKeyRequest,
): Promise<MyProviderMutationResponse> {
  const validated = validateImportProviderPrivateKeyInput(request);
  const result = await withTonStorageService((service) =>
    service.importProviderPrivateKey(validated),
  );

  return buildMutationResponse(result);
}

export async function deployMyProvider(): Promise<MyProviderMutationResponse> {
  const result = await withTonStorageService((service) => service.deployProvider());
  const deployAddress = result.providerAddress ?? null;

  if (deployAddress) {
    const link = buildTonkeeperTransferLink({
      address: deployAddress,
      amountTon: "1",
      bounceable: false,
    });

    result.tonkeeperLink = link.tonkeeperLink;
    result.tonkeeperAddressFriendly = link.addressFriendly;
    result.amountTon = "1";
    result.amountNanoTon = link.amountNanoTon;

    await savePendingProviderDeploymentRecord({
      providerAddressRaw: deployAddress,
      tonkeeperAddressFriendly: link.addressFriendly,
      tonkeeperLink: link.tonkeeperLink,
      amountTon: "1",
      amountNanoTon: link.amountNanoTon,
      createdAt: new Date().toISOString(),
    });
  }

  return buildMutationResponse(result);
}

export async function clearPendingProviderDeployment(): Promise<MyProviderMutationResponse> {
  await removePendingProviderDeploymentRecord();

  return buildMutationResponse({
    action: "clear-pending-deployment",
    status: "completed",
    rawOutput: "Cleared the pending provider deployment record.",
  });
}

export async function initMyProvider(
  request: InitMyProviderRequest,
): Promise<MyProviderMutationResponse> {
  const validated = validateInitProviderInput(request);

  try {
    const result = await withTonStorageService((service) => service.initProvider(validated));
    return buildMutationResponse(result);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Storage provider already exists")) {
      throw error;
    }

    const overview = await getMyProviderOverview();

    if (overview.configured && overview.providerAddressRaw === validated.providerAddress) {
      return {
        result: {
          action: "init-provider",
          status: "completed",
          rawOutput:
            "Storage provider already exists. This daemon is already connected to the requested provider.",
          providerAddress: validated.providerAddress,
        },
        overview,
      };
    }

    if (overview.configured && overview.providerAddressRaw) {
      throw createAppError(
        "VALIDATION_ERROR",
        `This daemon is already initialized with a different provider: ${overview.providerAddressRaw}`,
        409,
      );
    }

    throw error;
  }
}

export async function updateMyProviderParams(
  request: UpdateMyProviderParamsRequest,
): Promise<MyProviderMutationResponse> {
  const validated = validateSetProviderParamsInput(request);
  const result = await withTonStorageService((service) => service.setProviderParams(validated));
  return buildMutationResponse(result);
}

export async function updateMyProviderConfig(
  request: UpdateMyProviderConfigRequest,
): Promise<MyProviderMutationResponse> {
  const validated = validateSetProviderConfigInput(request);
  const result = await withTonStorageService((service) => service.setProviderConfig(validated));
  return buildMutationResponse(result);
}

function assertCloseAcceptedContractConfirmation(confirmation: string | undefined) {
  if (confirmation?.trim() !== "CLOSE PROVIDER CONTRACT") {
    throw createAppError(
      "VALIDATION_ERROR",
      'confirmation must equal "CLOSE PROVIDER CONTRACT".',
      400,
    );
  }
}

export async function closeAcceptedProviderContract(
  request: CloseAcceptedContractRequest,
): Promise<MyProviderMutationResponse> {
  assertCloseAcceptedContractConfirmation(request.confirmation);
  const validated = validateCloseProviderContractInput(request);

  await logDangerousAction({
    action: "provider-contract-close-requested",
    target: validated.contractAddress,
  });

  const result = await withTonStorageService((service) =>
    service.closeProviderContract(validated),
  );

  await logDangerousAction({
    action: "provider-contract-close-completed",
    target: validated.contractAddress,
  });

  return buildMutationResponse(result);
}
