import { jsonError, jsonOk } from "@/src/server/api/responses";
import { getRuntimeConfig } from "@/src/server/config/env";
import { testSshConnection } from "@/src/server/ssh/client";

export async function POST() {
  try {
    const config = getRuntimeConfig();
    const result = await testSshConnection(config);

    return jsonOk(result);
  } catch (error) {
    return jsonError(error, {
      code: "SSH_TEST_UNAVAILABLE",
      message: "Connection test unavailable.",
      statusCode: 501,
    });
  }
}
