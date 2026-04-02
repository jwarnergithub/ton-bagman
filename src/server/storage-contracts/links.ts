import { beginCell } from "ton-core";
import { createAppError } from "@/src/server/errors/appError";
import {
  parseQueryId,
  parseTonAmount,
  toFriendlyTonAddressWithOptions,
} from "@/src/server/storage-contracts/validators";

const CLOSE_STORAGE_CONTRACT_OPCODE = 0x79f937ea;
const ZERO = BigInt(0);
const NANO_PER_TON = BigInt(1_000_000_000);

export function encodeCloseStorageContractPayload(queryId: string | undefined) {
  const cell = beginCell()
    .storeUint(CLOSE_STORAGE_CONTRACT_OPCODE, 32)
    .storeUint(parseQueryId(queryId), 64)
    .endCell();

  return cell.toBoc({ idx: false }).toString("base64");
}

export function buildTonkeeperTransferLink(input: {
  address: string;
  amountTon: string;
  payloadBase64?: string;
  bounceable?: boolean;
}) {
  const addressFriendly = toFriendlyTonAddressWithOptions(input.address, {
    bounceable: input.bounceable ?? true,
  });
  const amountNanoTon = parseTonAmount(input.amountTon);

  if (amountNanoTon <= ZERO) {
    throw createAppError("VALIDATION_ERROR", "TON amount must be greater than zero.", 400);
  }

  const params = new URLSearchParams({
    amount: amountNanoTon.toString(),
  });

  if (input.payloadBase64) {
    params.set("bin", input.payloadBase64);
  }

  return {
    addressFriendly,
    amountNanoTon: amountNanoTon.toString(),
    tonkeeperLink: `https://app.tonkeeper.com/transfer/${addressFriendly}?${params.toString()}`,
  };
}

export function formatTonFromNanoTonString(value: string) {
  const nano = BigInt(value);
  const whole = nano / NANO_PER_TON;
  const fraction = (nano % NANO_PER_TON).toString().padStart(9, "0").replace(/0+$/, "");

  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}
