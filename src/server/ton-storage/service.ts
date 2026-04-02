import type { RuntimeConfig } from "@/src/server/config/env";
import { createAppError } from "@/src/server/errors/appError";
import type { RemoteExecResult } from "@/src/server/ssh/exec";
import {
  buildAddByHashCommand,
  buildAddByMetaCommand,
  buildCloseProviderContractCommand,
  buildCreateCommand,
  buildDeployProviderCommand,
  buildDownloadPauseCommand,
  buildDownloadResumeCommand,
  buildGetCommand,
  buildGetMetaCommand,
  buildGetPeersCommand,
  buildGetProviderInfoCommand,
  buildGetProviderParamsCommand,
  buildImportProviderPrivateKeyCommand,
  buildInitProviderCommand,
  buildListCommand,
  buildRemoveCommand,
  buildSetProviderConfigCommand,
  buildSetProviderParamsCommand,
  buildUploadPauseCommand,
  buildUploadResumeCommand,
  buildUnsupportedPriorityNameCommand,
} from "@/src/server/ton-storage/commandBuilder";
import {
  parseAddByHashOutput,
  parseAddByMetaOutput,
  parseBagDetail,
  parseBagList,
  parseBagPeers,
  parseCreateOutput,
  parseDownloadPauseOutput,
  parseDownloadResumeOutput,
  parseGetMetaOutput,
  parseRemoveOutput,
  parseUploadPauseOutput,
  parseUploadResumeOutput,
} from "@/src/server/ton-storage/parser";
import type {
  AddByHashInput,
  AddByMetaInput,
  BagDetailResult,
  BagId,
  BagListResult,
  BagMetaExport,
  BagPeersResult,
  CloseProviderContractInput,
  CreateBagInput,
  DownloadControlInput,
  GetProviderInfoInput,
  GetProviderParamsInput,
  GetMetaInput,
  ImportProviderPrivateKeyInput,
  InitProviderInput,
  ProviderMutationResult,
  RemoveBagInput,
  SetProviderConfigInput,
  SetProviderParamsInput,
  TonMutationResult,
} from "@/src/server/ton-storage/types";
import {
  parseBagReference,
  validateAddByHashInput,
  validateAddByMetaInput,
  validateCloseProviderContractInput,
  validateCreateBagInput,
  validateDownloadControlInput,
  validateGetProviderInfoInput,
  validateGetProviderParamsInput,
  validateGetMetaInput,
  validateImportProviderPrivateKeyInput,
  validateInitProviderInput,
  validateRemoveBagInput,
  validateSetProviderConfigInput,
  validateSetProviderParamsInput,
} from "@/src/server/ton-storage/validators";

export type TonStorageExecutor = {
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >;
  execute(command: {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
  }): Promise<RemoteExecResult>;
};

export type TonStorageService = {
  listBags(options?: { includeHashes?: boolean }): Promise<BagListResult>;
  getBagById(bagId: BagId): Promise<BagDetailResult>;
  getBagPeers(bagId: BagId): Promise<BagPeersResult>;
  importProviderPrivateKey(input: ImportProviderPrivateKeyInput): Promise<ProviderMutationResult>;
  deployProvider(): Promise<ProviderMutationResult>;
  initProvider(input: InitProviderInput): Promise<ProviderMutationResult>;
  getProviderParams(
    input?: GetProviderParamsInput,
  ): Promise<Record<string, unknown>>;
  getProviderInfo(input?: GetProviderInfoInput): Promise<Record<string, unknown>>;
  setProviderParams(input: SetProviderParamsInput): Promise<ProviderMutationResult>;
  setProviderConfig(input: SetProviderConfigInput): Promise<ProviderMutationResult>;
  closeProviderContract(
    input: CloseProviderContractInput,
  ): Promise<ProviderMutationResult>;
  createBag(input: CreateBagInput): Promise<TonMutationResult>;
  addByHash(input: AddByHashInput): Promise<TonMutationResult>;
  addByMeta(input: AddByMetaInput): Promise<TonMutationResult>;
  getMeta(input: GetMetaInput): Promise<BagMetaExport>;
  pauseDownload(input: DownloadControlInput): Promise<TonMutationResult>;
  resumeDownload(input: DownloadControlInput): Promise<TonMutationResult>;
  pauseUpload(input: DownloadControlInput): Promise<TonMutationResult>;
  resumeUpload(input: DownloadControlInput): Promise<TonMutationResult>;
  removeBag(input: RemoveBagInput): Promise<TonMutationResult>;
  getPriorityNameSupport(): {
    supported: false;
    note: string;
  };
};

async function runTonCommand(
  executor: TonStorageExecutor,
  command: { command: string; args?: string[]; supported: boolean; note?: string },
) {
  if (!command.supported) {
    throw createAppError(
      "TON_UNSUPPORTED_ACTION",
      command.note ?? "Unsupported TON action.",
      501,
    );
  }

  const result = await executor.execute({
    command: command.command,
    args: command.args,
  });

  if (!result.ok) {
    const failureMessage = extractTonFailureMessage(result.stdout, result.stderr);
    throw createAppError(
      "TON_COMMAND_FAILED",
      failureMessage || "TON storage command failed.",
      502,
    );
  }

  return result.stdout;
}

function stripAnsi(value: string) {
  return value.replace(/\u001B\[[0-9;]*m/g, "");
}

function cleanTonOutput(value: string) {
  return stripAnsi(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.includes("storage-daemon-cli.cpp") &&
        line !== "Connected",
    )
    .join("\n");
}

function extractTonFailureMessage(stdout: string, stderr: string) {
  const cleanedStderr = cleanTonOutput(stderr);

  if (cleanedStderr) {
    return cleanedStderr;
  }

  const cleanedStdout = cleanTonOutput(stdout);

  if (cleanedStdout) {
    return cleanedStdout;
  }

  return "";
}

function parseJsonFromTonOutput(value: string) {
  const cleaned = cleanTonOutput(value);

  if (!cleaned) {
    throw createAppError("TON_COMMAND_FAILED", "TON command returned no JSON output.", 502);
  }

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw createAppError("TON_COMMAND_FAILED", "TON command returned invalid JSON.", 502);
  }
}

function findAddressInText(value: string) {
  return value.match(/0:[0-9A-Fa-f]{64}/)?.[0] ?? null;
}

function createProviderMutationResult(
  action: ProviderMutationResult["action"],
  rawOutput: string,
  options?: {
    providerAddress?: string | null;
    contractAddress?: string | null;
  },
): ProviderMutationResult {
  return {
    action,
    status: "completed",
    rawOutput,
    providerAddress: options?.providerAddress ?? undefined,
    contractAddress: options?.contractAddress ?? undefined,
  };
}

export function createTonStorageService(
  executor: TonStorageExecutor,
): TonStorageService {
  return {
    async listBags(options) {
      const stdout = await runTonCommand(
        executor,
        buildListCommand(executor.config, options),
      );
      return parseBagList(stdout);
    },
    async getBagById(bagId) {
      const normalizedBagId = parseBagReference(bagId);
      const stdout = await runTonCommand(
        executor,
        buildGetCommand(executor.config, normalizedBagId),
      );
      return parseBagDetail(normalizedBagId, stdout);
    },
    async getBagPeers(bagId) {
      const normalizedBagId = parseBagReference(bagId);
      const stdout = await runTonCommand(
        executor,
        buildGetPeersCommand(executor.config, normalizedBagId),
      );
      return parseBagPeers(normalizedBagId, stdout);
    },
    async importProviderPrivateKey(input) {
      const validatedInput = validateImportProviderPrivateKeyInput(input);
      const stdout = await runTonCommand(
        executor,
        buildImportProviderPrivateKeyCommand(executor.config, validatedInput),
      );
      return createProviderMutationResult("import-pk", stdout);
    },
    async deployProvider() {
      const stdout = await runTonCommand(
        executor,
        buildDeployProviderCommand(executor.config),
      );
      return createProviderMutationResult("deploy-provider", stdout, {
        providerAddress: findAddressInText(stdout),
      });
    },
    async initProvider(input) {
      const validatedInput = validateInitProviderInput(input);
      const stdout = await runTonCommand(
        executor,
        buildInitProviderCommand(executor.config, validatedInput),
      );
      return createProviderMutationResult("init-provider", stdout, {
        providerAddress: validatedInput.providerAddress,
      });
    },
    async getProviderParams(input) {
      const validatedInput = validateGetProviderParamsInput(input ?? {});
      const stdout = await runTonCommand(
        executor,
        buildGetProviderParamsCommand(executor.config, validatedInput),
      );
      return parseJsonFromTonOutput(stdout);
    },
    async getProviderInfo(input) {
      const validatedInput = validateGetProviderInfoInput(input ?? {});
      const stdout = await runTonCommand(
        executor,
        buildGetProviderInfoCommand(executor.config, validatedInput),
      );
      return parseJsonFromTonOutput(stdout);
    },
    async setProviderParams(input) {
      const validatedInput = validateSetProviderParamsInput(input);
      const stdout = await runTonCommand(
        executor,
        buildSetProviderParamsCommand(executor.config, validatedInput),
      );
      return createProviderMutationResult("set-provider-params", stdout);
    },
    async setProviderConfig(input) {
      const validatedInput = validateSetProviderConfigInput(input);
      const stdout = await runTonCommand(
        executor,
        buildSetProviderConfigCommand(executor.config, validatedInput),
      );
      return createProviderMutationResult("set-provider-config", stdout);
    },
    async closeProviderContract(input) {
      const validatedInput = validateCloseProviderContractInput(input);
      const stdout = await runTonCommand(
        executor,
        buildCloseProviderContractCommand(executor.config, validatedInput),
      );
      return createProviderMutationResult("close-contract", stdout, {
        contractAddress: validatedInput.contractAddress,
      });
    },
    async createBag(input) {
      const validatedInput = validateCreateBagInput(input);
      const stdout = await runTonCommand(
        executor,
        buildCreateCommand(executor.config, validatedInput),
      );
      return parseCreateOutput(stdout);
    },
    async addByHash(input) {
      const validatedInput = validateAddByHashInput(input);
      const stdout = await runTonCommand(
        executor,
        buildAddByHashCommand(executor.config, validatedInput),
      );
      return parseAddByHashOutput(stdout);
    },
    async addByMeta(input) {
      const validatedInput = validateAddByMetaInput(input);
      const stdout = await runTonCommand(
        executor,
        buildAddByMetaCommand(executor.config, validatedInput),
      );
      return parseAddByMetaOutput(stdout);
    },
    async getMeta(input) {
      const validatedInput = validateGetMetaInput(input);
      const stdout = await runTonCommand(
        executor,
        buildGetMetaCommand(executor.config, validatedInput),
      );
      return parseGetMetaOutput(
        validatedInput.bagId,
        validatedInput.outputPath,
        stdout,
      );
    },
    async pauseDownload(input) {
      const validatedInput = validateDownloadControlInput(input);
      const stdout = await runTonCommand(
        executor,
        buildDownloadPauseCommand(executor.config, validatedInput),
      );
      return parseDownloadPauseOutput(stdout);
    },
    async resumeDownload(input) {
      const validatedInput = validateDownloadControlInput(input);
      const stdout = await runTonCommand(
        executor,
        buildDownloadResumeCommand(executor.config, validatedInput),
      );
      return parseDownloadResumeOutput(stdout);
    },
    async pauseUpload(input) {
      const validatedInput = validateDownloadControlInput(input);
      const stdout = await runTonCommand(
        executor,
        buildUploadPauseCommand(executor.config, validatedInput),
      );
      return parseUploadPauseOutput(stdout);
    },
    async resumeUpload(input) {
      const validatedInput = validateDownloadControlInput(input);
      const stdout = await runTonCommand(
        executor,
        buildUploadResumeCommand(executor.config, validatedInput),
      );
      return parseUploadResumeOutput(stdout);
    },
    async removeBag(input) {
      const validatedInput = validateRemoveBagInput(input);
      const stdout = await runTonCommand(
        executor,
        buildRemoveCommand(executor.config, validatedInput),
      );
      return parseRemoveOutput(validatedInput.bagId, stdout);
    },
    getPriorityNameSupport() {
      const unsupportedCommand = buildUnsupportedPriorityNameCommand();
      return {
        supported: false as const,
        note: unsupportedCommand.note ?? "Unsupported command.",
      };
    },
  };
}

function createMissingExecutor(): TonStorageExecutor {
  return {
    config: {
      tonDaemonControlAddress: "127.0.0.1:5555",
      tonDaemonCliKeyPath: "/opt/ton-storage/db/cli-keys/client",
      tonDaemonServerPubPath: "/opt/ton-storage/db/cli-keys/server.pub",
    },
    async execute() {
      throw createAppError(
        "TON_UNSUPPORTED_ACTION",
        "TON storage executor is not configured.",
        501,
      );
    },
  };
}

export async function listBags(
  options?: { includeHashes?: boolean },
  executor: TonStorageExecutor = createMissingExecutor(),
): Promise<BagListResult> {
  return createTonStorageService(executor).listBags(options);
}

export async function getBagById(
  bagId: BagId,
  executor: TonStorageExecutor = createMissingExecutor(),
): Promise<BagDetailResult> {
  return createTonStorageService(executor).getBagById(bagId);
}

export async function getBagPeers(
  bagId: BagId,
  executor: TonStorageExecutor = createMissingExecutor(),
): Promise<BagPeersResult> {
  return createTonStorageService(executor).getBagPeers(bagId);
}
