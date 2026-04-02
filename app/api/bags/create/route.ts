import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { withTonStorageService } from "@/src/server/ton-storage/runtime";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await withTonStorageService((service) => service.createBag(body));

    return jsonOk(result, 201);
  } catch (error) {
    return jsonError(error, {
      code: "TON_COMMAND_FAILED",
      message: "Bag creation failed.",
      statusCode: 400,
    });
  }
}
