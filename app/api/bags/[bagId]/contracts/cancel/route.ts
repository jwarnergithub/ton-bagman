import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { prepareCancelStorageContractLink } from "@/src/server/storage-contracts/service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      contractAddress?: string;
      amountTon?: string;
      queryId?: string;
    };

    const result = await prepareCancelStorageContractLink({
      contractAddress: body.contractAddress ?? "",
      amountTon: body.amountTon ?? "",
      queryId: body.queryId,
    });

    return jsonOk(result);
  } catch (error) {
    return jsonError(error, {
      code: "CONTRACT_PREPARE_FAILED",
      message: "Storage contract cancel link generation failed.",
      statusCode: 400,
    });
  }
}
