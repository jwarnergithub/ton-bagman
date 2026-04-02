import { z } from "zod";
import { createAppError } from "@/src/server/errors/appError";
import type {
  AddByHashInput,
  AddByMetaInput,
  BagId,
  BagReference,
  CloseProviderContractInput,
  CreateBagInput,
  DownloadControlInput,
  GetProviderInfoInput,
  GetProviderParamsInput,
  GetMetaInput,
  ImportProviderPrivateKeyInput,
  InitProviderInput,
  RemoveBagInput,
  SetProviderConfigInput,
  SetProviderParamsInput,
} from "@/src/server/ton-storage/types";

const nonEmptyString = z.string().trim().min(1);
const partialFilesSchema = z.array(nonEmptyString).optional();

const createBagSchema = z.object({
  path: nonEmptyString,
  description: z.string().optional(),
  copy: z.boolean().optional(),
  noUpload: z.boolean().optional(),
});

const addByHashSchema = z.object({
  hash: z
    .string()
    .trim()
    .regex(/^[A-Fa-f0-9]{64}$/, "Hash must be a 64-character hex string."),
  downloadDir: nonEmptyString.optional(),
  storeWithLocalBags: z.boolean().optional(),
  partialFiles: partialFilesSchema,
}).superRefine((value, context) => {
  if (value.downloadDir && value.storeWithLocalBags) {
    context.addIssue({
      code: "custom",
      message: "Choose either downloadDir or storeWithLocalBags, not both.",
      path: ["storeWithLocalBags"],
    });
  }
});

const addByMetaSchema = z.object({
  metafilePath: nonEmptyString,
  downloadDir: nonEmptyString.optional(),
  storeWithLocalBags: z.boolean().optional(),
  partialFiles: partialFilesSchema,
}).superRefine((value, context) => {
  if (value.downloadDir && value.storeWithLocalBags) {
    context.addIssue({
      code: "custom",
      message: "Choose either downloadDir or storeWithLocalBags, not both.",
      path: ["storeWithLocalBags"],
    });
  }
});

const getMetaSchema = z.object({
  bagId: nonEmptyString,
  outputPath: nonEmptyString,
});

const downloadControlSchema = z.object({
  bagId: nonEmptyString,
});

const removeBagSchema = z.object({
  bagId: nonEmptyString,
  removeFiles: z.boolean().optional(),
});

const tonAddressSchema = z
  .string()
  .trim()
  .regex(/^0:[A-Fa-f0-9]{64}$/, "Address must be a raw TON address.");

const importProviderPrivateKeySchema = z.object({
  filePath: nonEmptyString,
});

const initProviderSchema = z.object({
  providerAddress: tonAddressSchema,
});

const getProviderParamsSchema = z.object({
  providerAddress: tonAddressSchema.optional(),
});

const getProviderInfoSchema = z.object({
  includeBalances: z.boolean().optional(),
  includeContracts: z.boolean().optional(),
});

const setProviderParamsSchema = z
  .object({
    acceptNewContracts: z.boolean().optional(),
    ratePerMbDayNanoTon: z.number().int().nonnegative().optional(),
    maxSpanSeconds: z.number().int().positive().optional(),
    minimalFileSizeBytes: z.number().int().nonnegative().optional(),
    maximalFileSizeBytes: z.number().int().positive().optional(),
  })
  .superRefine((value, context) => {
    if (
      typeof value.minimalFileSizeBytes === "number" &&
      typeof value.maximalFileSizeBytes === "number" &&
      value.maximalFileSizeBytes < value.minimalFileSizeBytes
    ) {
      context.addIssue({
        code: "custom",
        message: "Maximum file size must be greater than or equal to the minimum.",
        path: ["maximalFileSizeBytes"],
      });
    }

    if (Object.values(value).every((item) => typeof item === "undefined")) {
      context.addIssue({
        code: "custom",
        message: "At least one provider parameter change is required.",
        path: ["acceptNewContracts"],
      });
    }
  });

const setProviderConfigSchema = z
  .object({
    maxContracts: z.number().int().nonnegative().optional(),
    maxTotalSizeBytes: z.number().int().nonnegative().optional(),
  })
  .superRefine((value, context) => {
    if (Object.values(value).every((item) => typeof item === "undefined")) {
      context.addIssue({
        code: "custom",
        message: "At least one provider config change is required.",
        path: ["maxContracts"],
      });
    }
  });

const closeProviderContractSchema = z.object({
  contractAddress: tonAddressSchema,
});

export function parseBagId(value: string): BagId {
  const normalized = value.trim();

  if (!normalized) {
    throw createAppError("VALIDATION_ERROR", "Bag ID is required.", 400);
  }

  return normalized;
}

export function parseBagReference(value: string): BagReference {
  return parseBagId(value);
}

export function validateCreateBagInput(input: CreateBagInput): CreateBagInput {
  return createBagSchema.parse(input);
}

export function validateAddByHashInput(input: AddByHashInput): AddByHashInput {
  return addByHashSchema.parse(input);
}

export function validateAddByMetaInput(input: AddByMetaInput): AddByMetaInput {
  return addByMetaSchema.parse(input);
}

export function validateGetMetaInput(input: GetMetaInput): GetMetaInput {
  return getMetaSchema.parse(input);
}

export function validateDownloadControlInput(
  input: DownloadControlInput,
): DownloadControlInput {
  return downloadControlSchema.parse(input);
}

export function validateRemoveBagInput(input: RemoveBagInput): RemoveBagInput {
  return removeBagSchema.parse(input);
}

export function validateImportProviderPrivateKeyInput(
  input: ImportProviderPrivateKeyInput,
): ImportProviderPrivateKeyInput {
  return importProviderPrivateKeySchema.parse(input);
}

export function validateInitProviderInput(input: InitProviderInput): InitProviderInput {
  return initProviderSchema.parse(input);
}

export function validateGetProviderParamsInput(
  input: GetProviderParamsInput,
): GetProviderParamsInput {
  return getProviderParamsSchema.parse(input);
}

export function validateGetProviderInfoInput(
  input: GetProviderInfoInput,
): GetProviderInfoInput {
  return getProviderInfoSchema.parse(input);
}

export function validateSetProviderParamsInput(
  input: SetProviderParamsInput,
): SetProviderParamsInput {
  return setProviderParamsSchema.parse(input);
}

export function validateSetProviderConfigInput(
  input: SetProviderConfigInput,
): SetProviderConfigInput {
  return setProviderConfigSchema.parse(input);
}

export function validateCloseProviderContractInput(
  input: CloseProviderContractInput,
): CloseProviderContractInput {
  return closeProviderContractSchema.parse(input);
}
