import type { RuntimeConfig } from "@/src/server/config/env";
import type { RemoteExecRequest } from "@/src/server/ssh/exec";
import {
  type AddByHashInput,
  type AddByMetaInput,
  type BagReference,
  type CloseProviderContractInput,
  type CreateBagInput,
  type DownloadControlInput,
  type GetProviderInfoInput,
  type GetProviderParamsInput,
  type GetMetaInput,
  type ImportProviderPrivateKeyInput,
  type InitProviderInput,
  type NewContractMessageInput,
  type RemoveBagInput,
  type SetProviderConfigInput,
  type SetProviderParamsInput,
  type TonSupportedCommandName,
  type TonUnsupportedCommandName,
} from "@/src/server/ton-storage/types";

export type BuiltTonCommand = RemoteExecRequest & {
  commandName: TonSupportedCommandName | TonUnsupportedCommandName;
  supported: boolean;
  note?: string;
};

function quoteCliArgument(value: string) {
  if (value.length === 0) {
    return '""';
  }

  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/(["\\])/g, "\\$1")}"`;
}

function createCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  args: string[],
): BuiltTonCommand {
  return {
    command: "storage-daemon-cli",
    args: [
      "-I",
      config.tonDaemonControlAddress,
      "-k",
      config.tonDaemonCliKeyPath,
      "-p",
      config.tonDaemonServerPubPath,
      "-c",
      args.map(quoteCliArgument).join(" "),
    ],
    supported: true,
    commandName: args[0] as TonSupportedCommandName,
  };
}

export function buildListCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  options?: { includeHashes?: boolean },
): BuiltTonCommand {
  return createCommand(
    config,
    options?.includeHashes === false ? ["list"] : ["list", "--hashes"],
  );
}

export function buildGetCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  bagId: BagReference,
): BuiltTonCommand {
  return createCommand(config, ["get", bagId]);
}

export function buildGetPeersCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  bagId: BagReference,
): BuiltTonCommand {
  return createCommand(config, ["get-peers", bagId]);
}

export function buildNewContractMessageCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input: NewContractMessageInput,
): BuiltTonCommand {
  const args = [
    "new-contract-message",
    input.bagId,
    input.outputPath,
    "--query-id",
    input.queryId ?? "0",
    "--provider",
    input.providerAddress,
  ];

  return createCommand(config, args);
}

export function buildImportProviderPrivateKeyCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input: ImportProviderPrivateKeyInput,
): BuiltTonCommand {
  return createCommand(config, ["import-pk", input.filePath]);
}

export function buildDeployProviderCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
): BuiltTonCommand {
  return createCommand(config, ["deploy-provider"]);
}

export function buildInitProviderCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input: InitProviderInput,
): BuiltTonCommand {
  return createCommand(config, ["init-provider", input.providerAddress]);
}

export function buildGetProviderParamsCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input?: GetProviderParamsInput,
): BuiltTonCommand {
  const args = ["get-provider-params"];

  if (input?.providerAddress) {
    args.push(input.providerAddress);
  }

  args.push("--json");

  return createCommand(config, args);
}

export function buildGetProviderInfoCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input?: GetProviderInfoInput,
): BuiltTonCommand {
  const args = ["get-provider-info"];

  if (input?.includeBalances) {
    args.push("--balances");
  }

  if (input?.includeContracts) {
    args.push("--contracts");
  }

  args.push("--json");

  return createCommand(config, args);
}

export function buildSetProviderParamsCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input: SetProviderParamsInput,
): BuiltTonCommand {
  const args = ["set-provider-params"];

  if (typeof input.acceptNewContracts === "boolean") {
    args.push("--accept", input.acceptNewContracts ? "1" : "0");
  }

  if (typeof input.ratePerMbDayNanoTon === "number") {
    args.push("--rate", String(input.ratePerMbDayNanoTon));
  }

  if (typeof input.maxSpanSeconds === "number") {
    args.push("--max-span", String(input.maxSpanSeconds));
  }

  if (typeof input.minimalFileSizeBytes === "number") {
    args.push("--min-file-size", String(input.minimalFileSizeBytes));
  }

  if (typeof input.maximalFileSizeBytes === "number") {
    args.push("--max-file-size", String(input.maximalFileSizeBytes));
  }

  return createCommand(config, args);
}

export function buildSetProviderConfigCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input: SetProviderConfigInput,
): BuiltTonCommand {
  const args = ["set-provider-config"];

  if (typeof input.maxContracts === "number") {
    args.push("--max-contracts", String(input.maxContracts));
  }

  if (typeof input.maxTotalSizeBytes === "number") {
    args.push("--max-total-size", String(input.maxTotalSizeBytes));
  }

  return createCommand(config, args);
}

export function buildCloseProviderContractCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input: CloseProviderContractInput,
): BuiltTonCommand {
  return createCommand(config, ["close-contract", input.contractAddress]);
}

export function buildCreateCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input: CreateBagInput,
): BuiltTonCommand {
  const args = ["create", input.path];

  if (input.description) {
    args.push("-d", input.description);
  }

  if (input.copy) {
    args.push("--copy");
  }

  if (input.noUpload) {
    args.push("--no-upload");
  }

  return createCommand(config, args);
}

export function buildAddByHashCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input: AddByHashInput,
): BuiltTonCommand {
  const args = ["add-by-hash", input.hash];

  if (input.downloadDir) {
    args.push("-d", input.downloadDir);
  }

  if (input.partialFiles?.length) {
    args.push("--partial", ...input.partialFiles);
  }

  return createCommand(config, args);
}

export function buildAddByMetaCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input: AddByMetaInput,
): BuiltTonCommand {
  const args = ["add-by-meta", input.metafilePath];

  if (input.downloadDir) {
    args.push("-d", input.downloadDir);
  }

  if (input.partialFiles?.length) {
    args.push("--partial", ...input.partialFiles);
  }

  return createCommand(config, args);
}

export function buildGetMetaCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input: GetMetaInput,
): BuiltTonCommand {
  return createCommand(config, ["get-meta", input.bagId, input.outputPath]);
}

export function buildDownloadPauseCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input: DownloadControlInput,
): BuiltTonCommand {
  return createCommand(config, ["download-pause", input.bagId]);
}

export function buildDownloadResumeCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input: DownloadControlInput,
): BuiltTonCommand {
  return createCommand(config, ["download-resume", input.bagId]);
}

export function buildUploadPauseCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input: DownloadControlInput,
): BuiltTonCommand {
  return createCommand(config, ["upload-pause", input.bagId]);
}

export function buildUploadResumeCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input: DownloadControlInput,
): BuiltTonCommand {
  return createCommand(config, ["upload-resume", input.bagId]);
}

export function buildRemoveCommand(
  config: Pick<
    RuntimeConfig,
    "tonDaemonControlAddress" | "tonDaemonCliKeyPath" | "tonDaemonServerPubPath"
  >,
  input: RemoveBagInput,
): BuiltTonCommand {
  const args = ["remove", input.bagId];

  if (input.removeFiles) {
    args.push("--remove-files");
  }

  return createCommand(config, args);
}

export function buildUnsupportedPriorityNameCommand(): BuiltTonCommand {
  return {
    command: "storage-daemon-cli",
    args: ["priority-name"],
    commandName: "priority-name",
    supported: false,
    note: "priority-name is documented but not implemented in the current service layer.",
  };
}
