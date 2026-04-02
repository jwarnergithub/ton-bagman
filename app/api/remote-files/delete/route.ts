import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { requestRemoteDeletion } from "@/src/server/files/remoteFiles";

type DeleteRequestBody = {
  remotePath?: string;
  confirmation?: string;
  targetName?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DeleteRequestBody;
    const result = await requestRemoteDeletion(body);

    return jsonOk(result);
  } catch (error) {
    return jsonError(error, {
      code: "REMOTE_DELETE_FAILED",
      message: "Remote delete request failed.",
      statusCode: 400,
    });
  }
}
