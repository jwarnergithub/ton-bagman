import "server-only";
import { withSshClient } from "@/src/server/ssh/runtime";
import { getBagStorageContractsOrThrow } from "@/src/server/tonapi/storageContracts";
import { prepareStartStorageContractLink as prepareStartStorageContractLinkRemote } from "@/src/server/ton-storage/contractRequests";
import {
  buildTonkeeperTransferLink,
  encodeCloseStorageContractPayload,
} from "@/src/server/storage-contracts/links";
import type {
  PrepareCancelContractInput,
  PrepareStartContractInput,
} from "@/src/server/storage-contracts/types";
import {
  normalizeTonAddress,
  validatePrepareCancelContractInput,
} from "@/src/server/storage-contracts/validators";

export async function listBagStorageContractsForWallet(input: {
  bagId: string;
  walletAddress: string;
  traceLimit?: number;
}) {
  return getBagStorageContractsOrThrow(input);
}

export async function prepareStartStorageContractLink(
  input: PrepareStartContractInput,
) {
  return withSshClient(async (sshClient, config) =>
    prepareStartStorageContractLinkRemote(
      {
        config: {
          tonDaemonControlAddress: config.tonDaemonControlAddress,
          tonDaemonCliKeyPath: config.tonDaemonCliKeyPath,
          tonDaemonServerPubPath: config.tonDaemonServerPubPath,
        },
        execute: (request) => sshClient.execute(request),
      },
      input,
    ),
  );
}

export async function prepareCancelStorageContractLink(
  input: PrepareCancelContractInput,
) {
  const validated = validatePrepareCancelContractInput(input);
  const contractAddressRaw = normalizeTonAddress(validated.contractAddress);
  const payloadBase64 = encodeCloseStorageContractPayload(validated.queryId);
  const link = buildTonkeeperTransferLink({
    address: contractAddressRaw,
    amountTon: validated.amountTon,
    payloadBase64,
  });

  return {
    contractAddressRaw,
    contractAddressFriendly: link.addressFriendly,
    amountTon: validated.amountTon,
    amountNanoTon: link.amountNanoTon,
    payloadBase64,
    tonkeeperLink: link.tonkeeperLink,
  };
}
