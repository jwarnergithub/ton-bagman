import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { createBagFromRemoteInput } from "@/src/server/ton-storage/createFromRemote";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createBagFromRemoteInput(body);

    return jsonOk(result, 201);
  } catch (error) {
    return jsonError(error, {
      code: "BAG_PREPARE_FAILED",
      message: "Create-from-remote failed.",
      statusCode: 400,
    });
  }
}
