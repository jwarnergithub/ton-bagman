import { jsonError, jsonOk } from "@/src/server/api/responses";
import { getMyProviderOverview } from "@/src/server/provider-management/service";

export async function GET() {
  try {
    return jsonOk(await getMyProviderOverview());
  } catch (error) {
    return jsonError(error, {
      code: "PROVIDER_LOOKUP_FAILED",
      message: "My provider lookup failed.",
      statusCode: 400,
    });
  }
}
