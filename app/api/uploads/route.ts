import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { listStagedFiles, stageBrowserFiles } from "@/src/server/files/staging";

export async function GET() {
  try {
    const result = await listStagedFiles();

    return jsonOk(result);
  } catch (error) {
    return jsonError(error, {
      code: "UPLOAD_PLACEHOLDER_FAILED",
      message: "Upload listing failed.",
      statusCode: 500,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type");

    if (!contentType?.includes("multipart/form-data")) {
      throw new Error("Uploads must use multipart/form-data.");
    }

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);
    const relativePaths = formData
      .getAll("relativePaths")
      .map((value) => (typeof value === "string" ? value : ""));
    const result = await stageBrowserFiles(
      files.map((file, index) => ({
        name: file.name,
        type: file.type,
        relativePath: relativePaths[index] || file.name,
        arrayBuffer: () => file.arrayBuffer(),
      })),
    );

    return jsonOk(result, 202);
  } catch (error) {
    return jsonError(error, {
      code: "UPLOAD_PLACEHOLDER_FAILED",
      message: "Upload placeholder creation failed.",
      statusCode: 501,
    });
  }
}
