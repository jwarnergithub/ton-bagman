import { jsonError, jsonOk } from "@/src/server/api/responses";
import { clearPendingProviderDeployment } from "@/src/server/provider-management/service";

export async function POST() {
  try {
    return jsonOk(await clearPendingProviderDeployment());
  } catch (error) {
    return jsonError(error, {
      code: "PROVIDER_LOOKUP_FAILED",
      message: "Pending provider deployment clear failed.",
      statusCode: 400,
    });
  }
}
