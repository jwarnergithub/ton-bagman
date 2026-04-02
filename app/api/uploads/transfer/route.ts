import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import {
  transferAllStagedFiles,
  transferAndRemoveStagedFile,
} from "@/src/server/files/remoteFiles";

type TransferRequestBody = {
  stagedFileId?: string;
  remotePath?: string;
  mode?: "single" | "all";
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TransferRequestBody;
    const result =
      body.mode === "all" || !body.stagedFileId
        ? await transferAllStagedFiles()
        : await transferAndRemoveStagedFile(body);

    return jsonOk(result, 201);
  } catch (error) {
    return jsonError(error, {
      code: "REMOTE_TRANSFER_FAILED",
      message: "Remote transfer failed.",
      statusCode: 500,
    });
  }
}
