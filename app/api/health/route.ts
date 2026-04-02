import { jsonError, jsonOk } from "@/src/server/api/responses";
import { getRuntimeConfig } from "@/src/server/config/env";
import { getSshConnectionSummary } from "@/src/server/ssh/client";

export async function GET() {
  try {
    const config = getRuntimeConfig();
    const summary = getSshConnectionSummary(config);

    return jsonOk(summary);
  } catch (error) {
    return jsonError(error, {
      code: "VALIDATION_ERROR",
      message: "Runtime configuration is invalid.",
      statusCode: 500,
    });
  }
}
