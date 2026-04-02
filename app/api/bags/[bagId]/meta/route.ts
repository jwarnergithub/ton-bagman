import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { withTonStorageService } from "@/src/server/ton-storage/runtime";
import { parseBagId } from "@/src/server/ton-storage/validators";

type RouteContext = {
  params: Promise<{
    bagId: string;
  }>;
};

type MetaExportBody = {
  outputPath?: string;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { bagId } = await context.params;
    const body = (await request.json()) as MetaExportBody;
    const result = await withTonStorageService((service) =>
      service.getMeta({
        bagId: parseBagId(bagId),
        outputPath: body.outputPath ?? "",
      }),
    );

    return jsonOk(result);
  } catch (error) {
    return jsonError(error, {
      code: "TON_COMMAND_FAILED",
      message: "Metadata export failed.",
      statusCode: 400,
    });
  }
}
