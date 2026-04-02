import { jsonError, jsonOk } from "@/src/server/api/responses";
import { listRemoteFiles } from "@/src/server/files/remoteFiles";

export async function GET() {
  try {
    const result = await listRemoteFiles();

    return jsonOk(result);
  } catch (error) {
    return jsonError(error, {
      code: "REMOTE_FILE_LIST_FAILED",
      message: "Remote file listing failed.",
      statusCode: 500,
    });
  }
}
