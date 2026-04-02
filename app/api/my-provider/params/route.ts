import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { updateMyProviderParams } from "@/src/server/provider-management/service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      acceptNewContracts?: boolean;
      ratePerMbDayNanoTon?: number;
      maxSpanSeconds?: number;
      minimalFileSizeBytes?: number;
      maximalFileSizeBytes?: number;
    };

    return jsonOk(await updateMyProviderParams(body));
  } catch (error) {
    return jsonError(error, {
      code: "TON_COMMAND_FAILED",
      message: "Provider parameter update failed.",
      statusCode: 400,
    });
  }
}
