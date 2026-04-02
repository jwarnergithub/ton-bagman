import { jsonError, jsonOk } from "@/src/server/api/responses";
import { deployMyProvider } from "@/src/server/provider-management/service";

export async function POST() {
  try {
    return jsonOk(await deployMyProvider());
  } catch (error) {
    return jsonError(error, {
      code: "TON_COMMAND_FAILED",
      message: "Provider deployment failed.",
      statusCode: 400,
    });
  }
}
