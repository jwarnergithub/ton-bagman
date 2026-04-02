import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { prepareStartStorageContractLink } from "@/src/server/storage-contracts/service";
import { parseBagId } from "@/src/server/ton-storage/validators";

type RouteContext = {
  params: Promise<{
    bagId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { bagId } = await context.params;
    const validatedBagId = parseBagId(bagId);
    const body = (await request.json()) as {
      providerAddress?: string;
      amountTon?: string;
      queryId?: string;
    };

    const result = await prepareStartStorageContractLink({
      bagId: validatedBagId,
      providerAddress: body.providerAddress ?? "",
      amountTon: body.amountTon ?? "",
      queryId: body.queryId,
    });

    return jsonOk(result);
  } catch (error) {
    return jsonError(error, {
      code: "CONTRACT_PREPARE_FAILED",
      message: "Storage contract start link generation failed.",
      statusCode: 400,
    });
  }
}
