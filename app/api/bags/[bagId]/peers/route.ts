import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/src/server/api/responses";
import { parseBagId } from "@/src/server/ton-storage/validators";
import { withTonStorageService } from "@/src/server/ton-storage/runtime";

type RouteContext = {
  params: Promise<{
    bagId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { bagId } = await context.params;
    const validatedBagId = parseBagId(bagId);
    const result = await withTonStorageService((service) =>
      service.getBagPeers(validatedBagId),
    );

    return jsonOk(result);
  } catch (error) {
    return jsonError(error, {
      code: "BAG_PEERS_FAILED",
      message: "Bag peer lookup failed.",
      statusCode: 400,
    });
  }
}
