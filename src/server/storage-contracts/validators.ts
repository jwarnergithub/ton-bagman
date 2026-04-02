import { Address, toNano } from "ton-core";
import { z } from "zod";
import { createAppError } from "@/src/server/errors/appError";
import type {
  PrepareCancelContractInput,
  PrepareStartContractInput,
} from "@/src/server/storage-contracts/types";

const nonEmptyString = z.string().trim().min(1);

const startSchema = z.object({
  bagId: nonEmptyString,
  providerAddress: nonEmptyString,
  amountTon: nonEmptyString,
  queryId: z.string().trim().optional(),
});

const cancelSchema = z.object({
  contractAddress: nonEmptyString,
  amountTon: nonEmptyString,
  queryId: z.string().trim().optional(),
});

export function parseTonAddress(value: string) {
  try {
    return Address.parse(value.trim());
  } catch {
    throw createAppError("VALIDATION_ERROR", "A valid TON address is required.", 400);
  }
}

export function normalizeTonAddress(value: string) {
  return parseTonAddress(value).toRawString();
}

export function toFriendlyTonAddress(value: string) {
  return toFriendlyTonAddressWithOptions(value, { bounceable: true });
}

export function toFriendlyTonAddressWithOptions(
  value: string,
  options?: {
    bounceable?: boolean;
  },
) {
  return parseTonAddress(value).toString({
    bounceable: options?.bounceable ?? true,
    testOnly: false,
    urlSafe: true,
  });
}

export function parseQueryId(value: string | undefined) {
  if (!value || value.trim() === "") {
    return BigInt(0);
  }

  try {
    return BigInt(value.trim());
  } catch {
    throw createAppError("VALIDATION_ERROR", "Query ID must be an integer.", 400);
  }
}

export function parseTonAmount(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw createAppError("VALIDATION_ERROR", "TON amount is required.", 400);
  }

  try {
    const nano = toNano(normalized);

    if (nano <= BigInt(0)) {
      throw new Error("non-positive");
    }

    return nano;
  } catch {
    throw createAppError(
      "VALIDATION_ERROR",
      "TON amount must be a positive TON value like 0.05 or 0.2.",
      400,
    );
  }
}

export function validatePrepareStartContractInput(
  input: PrepareStartContractInput,
): PrepareStartContractInput {
  const parsed = startSchema.parse(input);

  return {
    ...parsed,
    providerAddress: normalizeTonAddress(parsed.providerAddress),
    amountTon: parsed.amountTon.trim(),
    queryId: parsed.queryId?.trim(),
  };
}

export function validatePrepareCancelContractInput(
  input: PrepareCancelContractInput,
): PrepareCancelContractInput {
  const parsed = cancelSchema.parse(input);

  return {
    ...parsed,
    contractAddress: normalizeTonAddress(parsed.contractAddress),
    amountTon: parsed.amountTon.trim(),
    queryId: parsed.queryId?.trim(),
  };
}
