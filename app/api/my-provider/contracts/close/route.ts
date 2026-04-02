import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { closeAcceptedProviderContract } from "@/src/server/provider-management/service";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      contractAddress?: string;
      confirmation?: string;
    };

    return jsonOk(
      await closeAcceptedProviderContract({
        contractAddress: body.contractAddress ?? "",
        confirmation: body.confirmation,
      }),
    );
  } catch (error) {
    return jsonError(error, {
      code: "TON_COMMAND_FAILED",
      message: "Accepted contract close failed.",
      statusCode: 400,
    });
  }
}
