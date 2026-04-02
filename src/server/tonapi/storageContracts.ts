import "server-only";
import { createAppError } from "@/src/server/errors/appError";
import { tonApiFetch } from "@/src/server/tonapi/client";
import { formatTonFromNanoTonString } from "@/src/server/storage-contracts/links";
import type {
  StorageContractDiscoveryResult,
  StorageContractSummary,
} from "@/src/server/storage-contracts/types";
import {
  normalizeTonAddress,
  toFriendlyTonAddress,
} from "@/src/server/storage-contracts/validators";

type TraceListResponse = {
  traces: Array<{
    id: string;
    utime: number;
  }>;
};

type TraceNode = {
  transaction?: {
    account?: {
      address: string;
    };
    interfaces?: string[];
  };
  children?: TraceNode[];
};

type MethodStackItem = {
  type: string;
  num?: string;
};

type GetStorageContractDataResponse = {
  success: boolean;
  decoded?: {
    active?: boolean;
    balance?: number | string;
    provider?: string;
    client?: string;
    file_size?: number;
    next_proof?: number;
    rate_per_mb_day?: number;
    max_span?: number;
    last_proof_time?: number;
    torrent_hash?: string;
  };
  stack?: MethodStackItem[];
};

type BlockchainAccountResponse = {
  address: string;
  balance: number | string;
  status: string;
};

const BYTES_PER_MEBIBYTE = BigInt(1024 * 1024);
const SECONDS_PER_DAY = BigInt(60 * 60 * 24);

function estimateContractLifetime(input: {
  balanceNanoTon: string;
  ratePerMbDayNanoTon: number;
  fileSize: number;
}) {
  if (input.ratePerMbDayNanoTon <= 0 || input.fileSize <= 0) {
    return {
      estimatedDailyCostNanoTon: null,
      estimatedDailyCostTon: null,
      estimatedSecondsRemaining: null,
      estimatedExpiresAt: null,
    };
  }

  const dailyCost =
    (BigInt(input.ratePerMbDayNanoTon) * BigInt(input.fileSize) +
      BYTES_PER_MEBIBYTE -
      BigInt(1)) /
    BYTES_PER_MEBIBYTE;

  if (dailyCost <= 0) {
    return {
      estimatedDailyCostNanoTon: null,
      estimatedDailyCostTon: null,
      estimatedSecondsRemaining: null,
      estimatedExpiresAt: null,
    };
  }

  const secondsRemainingBigInt =
    (BigInt(input.balanceNanoTon) * SECONDS_PER_DAY) / dailyCost;
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  const secondsRemaining =
    secondsRemainingBigInt > maxSafe ? null : Number(secondsRemainingBigInt);

  return {
    estimatedDailyCostNanoTon: dailyCost.toString(),
    estimatedDailyCostTon: formatTonFromNanoTonString(dailyCost.toString()),
    estimatedSecondsRemaining: secondsRemaining,
    estimatedExpiresAt:
      secondsRemaining === null
        ? null
        : Math.floor(Date.now() / 1000) + secondsRemaining,
  };
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function normalizeBagIdFromStack(stack: MethodStackItem[] | undefined) {
  const numEntry = stack?.findLast((item) => item.type === "num" && item.num?.startsWith("0x"));

  if (!numEntry?.num) {
    return null;
  }

  return numEntry.num.slice(2).toUpperCase().padStart(64, "0");
}

function collectCandidateContractAddresses(node: TraceNode, found: Set<string>) {
  const address = node.transaction?.account?.address;

  if (address) {
    found.add(normalizeTonAddress(address));
  }

  for (const child of node.children ?? []) {
    collectCandidateContractAddresses(child, found);
  }
}

async function fetchStorageContractSummary(
  addressRaw: string,
  traceIds: string[],
): Promise<{ summary: StorageContractSummary; bagId: string | null } | null> {
  let account: BlockchainAccountResponse;
  let method: GetStorageContractDataResponse;

  try {
    [account, method] = await Promise.all([
      tonApiFetch<BlockchainAccountResponse>(
        `/v2/blockchain/accounts/${addressRaw}`,
        { revalidate: false },
      ),
      tonApiFetch<GetStorageContractDataResponse>(
        `/v2/blockchain/accounts/${addressRaw}/methods/get_storage_contract_data`,
        { revalidate: false },
      ),
    ]);
  } catch {
    return null;
  }

  if (!method.success || !method.decoded?.provider || !method.decoded?.client) {
    return null;
  }

  const balanceNanoTon = String(method.decoded.balance ?? account.balance ?? 0);
  const bagId = normalizeBagIdFromStack(method.stack);
  const lifetimeEstimate = estimateContractLifetime({
    balanceNanoTon,
    ratePerMbDayNanoTon: method.decoded.rate_per_mb_day ?? 0,
    fileSize: method.decoded.file_size ?? 0,
  });

  return {
    bagId,
    summary: {
      addressRaw,
      addressFriendly: toFriendlyTonAddress(addressRaw),
      bagId,
      providerAddressRaw: normalizeTonAddress(method.decoded.provider),
      providerAddressFriendly: toFriendlyTonAddress(method.decoded.provider),
      clientAddressRaw: normalizeTonAddress(method.decoded.client),
      clientAddressFriendly: toFriendlyTonAddress(method.decoded.client),
      creationTraceId: traceIds[0] ?? null,
      latestTraceIds: traceIds,
      onChainStatus: account.status,
      active: Boolean(method.decoded.active),
      balanceNanoTon,
      balanceTon: formatTonFromNanoTonString(balanceNanoTon),
      fileSize: method.decoded.file_size ?? 0,
      nextProof: method.decoded.next_proof ?? 0,
      ratePerMbDayNanoTon: method.decoded.rate_per_mb_day ?? 0,
      maxSpanSeconds: method.decoded.max_span ?? 0,
      lastProofTime: method.decoded.last_proof_time ?? 0,
      estimatedDailyCostNanoTon: lifetimeEstimate.estimatedDailyCostNanoTon,
      estimatedDailyCostTon: lifetimeEstimate.estimatedDailyCostTon,
      estimatedSecondsRemaining: lifetimeEstimate.estimatedSecondsRemaining,
      estimatedExpiresAt: lifetimeEstimate.estimatedExpiresAt,
    },
  };
}

export async function listBagStorageContracts(input: {
  bagId: string;
  walletAddress: string;
  traceLimit?: number;
}): Promise<StorageContractDiscoveryResult> {
  const bagId = input.bagId.trim().toUpperCase();
  const walletAddress = normalizeTonAddress(input.walletAddress);
  const traceLimit = input.traceLimit ?? 20;

  const traceList = await tonApiFetch<TraceListResponse>(
    `/v2/accounts/${walletAddress}/traces?limit=${traceLimit}`,
    { revalidate: false },
  );

  const traces = await Promise.all(
    traceList.traces.map(async (traceMeta) => ({
      id: traceMeta.id,
      trace: await tonApiFetch<TraceNode>(`/v2/traces/${traceMeta.id}`, {
        revalidate: false,
      }),
    })),
  );

  const contractTraceMap = new Map<string, string[]>();

  for (const trace of traces) {
    const addresses = new Set<string>();
    collectCandidateContractAddresses(trace.trace, addresses);
    addresses.delete(walletAddress);

    for (const address of addresses) {
      const current = contractTraceMap.get(address) ?? [];
      contractTraceMap.set(address, unique([...current, trace.id]));
    }
  }

  const summaries = await Promise.all(
    Array.from(contractTraceMap.entries()).map(async ([address, traceIds]) => {
      const result = await fetchStorageContractSummary(address, traceIds);

      if (!result) {
        return null;
      }

      return result.bagId === bagId ? result.summary : null;
    }),
  );

  return {
    bagId,
    walletAddress,
    contracts: summaries
      .filter((item): item is StorageContractSummary => item !== null)
      .sort((left, right) => {
        if (left.active !== right.active) {
          return Number(right.active) - Number(left.active);
        }

        return right.lastProofTime - left.lastProofTime;
      }),
  };
}

export async function listStorageContractsForProvider(input: {
  providerAddress: string;
  traceLimit?: number;
}) {
  const providerAddress = normalizeTonAddress(input.providerAddress);
  const traceLimit = input.traceLimit ?? 50;

  const traceList = await tonApiFetch<TraceListResponse>(
    `/v2/accounts/${providerAddress}/traces?limit=${traceLimit}`,
    { revalidate: false },
  );

  const traces = await Promise.all(
    traceList.traces.map(async (traceMeta) => ({
      id: traceMeta.id,
      trace: await tonApiFetch<TraceNode>(`/v2/traces/${traceMeta.id}`, {
        revalidate: false,
      }),
    })),
  );

  const contractTraceMap = new Map<string, string[]>();

  for (const trace of traces) {
    const addresses = new Set<string>();
    collectCandidateContractAddresses(trace.trace, addresses);
    addresses.delete(providerAddress);

    for (const address of addresses) {
      const current = contractTraceMap.get(address) ?? [];
      contractTraceMap.set(address, unique([...current, trace.id]));
    }
  }

  const summaries = await Promise.all(
    Array.from(contractTraceMap.entries()).map(async ([address, traceIds]) => {
      const result = await fetchStorageContractSummary(address, traceIds);

      if (!result) {
        return null;
      }

      return result.summary.providerAddressRaw === providerAddress ? result.summary : null;
    }),
  );

  return summaries
    .filter((item): item is StorageContractSummary => item !== null)
    .sort((left, right) => {
      if (left.active !== right.active) {
        return Number(right.active) - Number(left.active);
      }

      return right.lastProofTime - left.lastProofTime;
    });
}

export async function getBagStorageContractsOrThrow(input: {
  bagId: string;
  walletAddress: string;
  traceLimit?: number;
}) {
  try {
    return await listBagStorageContracts(input);
  } catch (error) {
    if (error instanceof Error) {
      throw createAppError("CONTRACT_LOOKUP_FAILED", error.message, 502);
    }

    throw createAppError(
      "CONTRACT_LOOKUP_FAILED",
      "Storage contract lookup failed.",
      502,
    );
  }
}
