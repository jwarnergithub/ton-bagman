import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { listBagStorageContractsForWallet } from "@/src/server/storage-contracts/service";
import { parseBagId } from "@/src/server/ton-storage/validators";
import { parseTonAddress } from "@/src/server/storage-contracts/validators";

type RouteContext = {
  params: Promise<{
    bagId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { bagId } = await context.params;
    const validatedBagId = parseBagId(bagId);
    const walletAddress = request.nextUrl.searchParams.get("wallet")?.trim();

    if (!walletAddress) {
      throw new Error("Wallet address is required.");
    }

    const normalizedWalletAddress = parseTonAddress(walletAddress).toRawString();
    const result = await listBagStorageContractsForWallet({
      bagId: validatedBagId,
      walletAddress: normalizedWalletAddress,
    });

    return jsonOk(result);
  } catch (error) {
    return jsonError(error, {
      code: "CONTRACT_LOOKUP_FAILED",
      message: "Storage contract lookup failed.",
      statusCode: 400,
    });
  }
}
