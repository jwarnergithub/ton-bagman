import { jsonError, jsonOk } from "@/src/server/api/responses";
import { listStorageProviders } from "@/src/server/tonapi/storageProviders";

export async function GET() {
  try {
    const result = await listStorageProviders();

    return jsonOk(result);
  } catch (error) {
    return jsonError(error, {
      code: "PROVIDER_LOOKUP_FAILED",
      message: "Storage provider lookup failed.",
      statusCode: 500,
    });
  }
}
