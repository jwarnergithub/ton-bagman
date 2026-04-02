import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { recoverManagedBagSourceToUploads } from "@/src/server/files/managedBagSources";
import { parseBagId } from "@/src/server/ton-storage/validators";

type RouteContext = {
  params: Promise<{
    bagId: string;
  }>;
};

type RecoverBody = {
  confirmation?: string;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { bagId } = await context.params;
    const body = (await request.json()) as RecoverBody;
    const result = await recoverManagedBagSourceToUploads(
      parseBagId(bagId),
      body.confirmation,
    );

    return jsonOk(result);
  } catch (error) {
    return jsonError(error, {
      code: "MANAGED_BAG_SOURCE_FAILED",
      message: "Managed source recovery failed.",
      statusCode: 400,
    });
  }
}
