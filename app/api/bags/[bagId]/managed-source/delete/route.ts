import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { deleteManagedBagSource } from "@/src/server/files/managedBagSources";
import { parseBagId } from "@/src/server/ton-storage/validators";

type RouteContext = {
  params: Promise<{
    bagId: string;
  }>;
};

type DeleteBody = {
  confirmation?: string;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { bagId } = await context.params;
    const body = (await request.json()) as DeleteBody;
    const result = await deleteManagedBagSource(
      parseBagId(bagId),
      body.confirmation,
    );

    return jsonOk(result);
  } catch (error) {
    return jsonError(error, {
      code: "MANAGED_BAG_SOURCE_FAILED",
      message: "Managed source deletion failed.",
      statusCode: 400,
    });
  }
}
