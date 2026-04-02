import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { withTonStorageService } from "@/src/server/ton-storage/runtime";
import { parseBagId } from "@/src/server/ton-storage/validators";

type RouteContext = {
  params: Promise<{
    bagId: string;
  }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { bagId } = await context.params;
    const result = await withTonStorageService((service) =>
      service.pauseDownload({ bagId: parseBagId(bagId) }),
    );

    return jsonOk(result);
  } catch (error) {
    return jsonError(error, {
      code: "TON_COMMAND_FAILED",
      message: "Download pause failed.",
      statusCode: 400,
    });
  }
}
