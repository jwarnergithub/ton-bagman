import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { importMyProviderPrivateKey } from "@/src/server/provider-management/service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      filePath?: string;
    };

    return jsonOk(
      await importMyProviderPrivateKey({
        filePath: body.filePath ?? "",
      }),
    );
  } catch (error) {
    return jsonError(error, {
      code: "TON_COMMAND_FAILED",
      message: "Provider key import failed.",
      statusCode: 400,
    });
  }
}
