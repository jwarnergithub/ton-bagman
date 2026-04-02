import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { addBagByMeta } from "@/src/server/ton-storage/addExistingBag";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await addBagByMeta(body);

    return jsonOk(result, 201);
  } catch (error) {
    return jsonError(error, {
      code: "TON_COMMAND_FAILED",
      message: "add-by-meta failed.",
      statusCode: 400,
    });
  }
}
