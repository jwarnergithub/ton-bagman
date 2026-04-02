import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { updateMyProviderConfig } from "@/src/server/provider-management/service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      maxContracts?: number;
      maxTotalSizeBytes?: number;
    };

    return jsonOk(await updateMyProviderConfig(body));
  } catch (error) {
    return jsonError(error, {
      code: "TON_COMMAND_FAILED",
      message: "Provider config update failed.",
      statusCode: 400,
    });
  }
}
