import { jsonError, jsonOk } from "@/src/server/api/responses";
import { listRemoteDirectories } from "@/src/server/files/remoteFiles";

export async function GET() {
  try {
    const result = await listRemoteDirectories();

    return jsonOk(result);
  } catch (error) {
    return jsonError(error, {
      code: "REMOTE_FILE_LIST_FAILED",
      message: "Remote directory listing failed.",
      statusCode: 500,
    });
  }
}
