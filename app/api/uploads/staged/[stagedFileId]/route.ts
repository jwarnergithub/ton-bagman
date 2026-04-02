import { jsonError, jsonOk } from "@/src/server/api/responses";
import { removeStagedFile } from "@/src/server/files/staging";

type RouteContext = {
  params: Promise<{
    stagedFileId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { stagedFileId } = await context.params;
    await removeStagedFile(stagedFileId);

    return jsonOk({
      removed: true,
      stagedFileId,
    });
  } catch (error) {
    return jsonError(error, {
      code: "VALIDATION_ERROR",
      message: "Staged file removal failed.",
      statusCode: 400,
    });
  }
}
