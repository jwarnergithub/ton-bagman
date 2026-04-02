import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { initMyProvider } from "@/src/server/provider-management/service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      providerAddress?: string;
    };

    return jsonOk(
      await initMyProvider({
        providerAddress: body.providerAddress ?? "",
      }),
    );
  } catch (error) {
    return jsonError(error, {
      code: "TON_COMMAND_FAILED",
      message: "Provider initialization failed.",
      statusCode: 400,
    });
  }
}
