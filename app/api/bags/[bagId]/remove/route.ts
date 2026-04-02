import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { removeBag } from "@/src/server/ton-storage/removeBag";
import { parseBagId } from "@/src/server/ton-storage/validators";

type RouteContext = {
  params: Promise<{
    bagId: string;
  }>;
};

type RemoveBagBody = {
  removeFiles?: boolean;
  confirmation?: string;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { bagId } = await context.params;
    const body = (await request.json()) as RemoveBagBody;
    const result = await removeBag({
      bagId: parseBagId(bagId),
      removeFiles: body.removeFiles,
      confirmation: body.confirmation,
    });

    return jsonOk(result);
  } catch (error) {
    return jsonError(error, {
      code: "TON_COMMAND_FAILED",
      message: "Bag removal failed.",
      statusCode: 400,
    });
  }
}
