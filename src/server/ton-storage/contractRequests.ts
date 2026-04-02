import { createAppError } from "@/src/server/errors/appError";
import { buildNewContractMessageCommand } from "@/src/server/ton-storage/commandBuilder";
import type { TonStorageExecutor } from "@/src/server/ton-storage/service";
import { parseBagReference } from "@/src/server/ton-storage/validators";
import {
  buildTonkeeperTransferLink,
} from "@/src/server/storage-contracts/links";
import type {
  PrepareStartContractInput,
  PreparedStartContractLink,
} from "@/src/server/storage-contracts/types";
import {
  parseQueryId,
  validatePrepareStartContractInput,
} from "@/src/server/storage-contracts/validators";

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

function getGenerationFailureMessage(stdout: string, stderr: string) {
  return (
    cleanTonOutput(stderr) ||
    cleanTonOutput(stdout) ||
    "Failed to generate a storage contract request."
  );
}

function isRetryableGenerationFailure(message: string) {
  return (
    message.includes("LITE_SERVER_NETWORK") ||
    message.includes("timeout for adnl query query") ||
    message.includes("during last block synchronization")
  );
}

function quoteForShell(value: string) {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

export async function prepareStartStorageContractLink(
  executor: TonStorageExecutor,
  input: PrepareStartContractInput,
): Promise<PreparedStartContractLink> {
  const validated = validatePrepareStartContractInput(input);
  const bagId = parseBagReference(validated.bagId);
  const remotePath = `/tmp/ton-bagman-contracts/request-${bagId.slice(0, 12)}-${Date.now()}.boc`;

  const command = buildNewContractMessageCommand(executor.config, {
    bagId,
    outputPath: remotePath,
    providerAddress: validated.providerAddress,
    queryId: parseQueryId(validated.queryId).toString(),
  });

  await executor.execute({
    command: "/bin/sh",
    args: ["-lc", "mkdir -p /tmp/ton-bagman-contracts"],
  });

  let generationResult:
    | Awaited<ReturnType<TonStorageExecutor["execute"]>>
    | null = null;
  let payloadBase64 = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    generationResult = await executor.execute({
      command: command.command,
      args: command.args,
    });

    const payloadResult = await executor.execute({
      command: "/bin/sh",
      args: [
        "-lc",
        [
          "set -e",
          "mkdir -p /tmp/ton-bagman-contracts",
          `if [ -f ${quoteForShell(remotePath)} ]; then base64 ${quoteForShell(remotePath)} | tr -d '\\n'; fi`,
          `rm -f ${quoteForShell(remotePath)}`,
        ].join("; "),
      ],
    });

    payloadBase64 = payloadResult.stdout.trim();

    if (!payloadResult.ok) {
      throw createAppError(
        "CONTRACT_PREPARE_FAILED",
        payloadResult.stderr.trim() ||
          "The contract request payload could not be read back from the VPS.",
        502,
      );
    }

    if (payloadBase64) {
      break;
    }

    if (generationResult.ok) {
      break;
    }

    const failureMessage = getGenerationFailureMessage(
      generationResult.stdout,
      generationResult.stderr,
    );

    if (!isRetryableGenerationFailure(failureMessage) || attempt === 2) {
      throw createAppError("CONTRACT_PREPARE_FAILED", failureMessage, 502);
    }
  }

  if (!payloadBase64) {
    throw createAppError(
      "CONTRACT_PREPARE_FAILED",
      "The contract request payload could not be read back from the VPS.",
      502,
    );
  }

  const link = buildTonkeeperTransferLink({
    address: validated.providerAddress,
    amountTon: validated.amountTon,
    payloadBase64,
  });

  return {
    bagId,
    providerAddressRaw: validated.providerAddress,
    providerAddressFriendly: link.addressFriendly,
    amountTon: validated.amountTon,
    amountNanoTon: link.amountNanoTon,
    payloadBase64,
    tonkeeperLink: link.tonkeeperLink,
    commandOutput: cleanTonOutput(generationResult?.stdout ?? ""),
  };
}
