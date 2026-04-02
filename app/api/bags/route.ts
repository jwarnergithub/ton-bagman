import { jsonError, jsonOk } from "@/src/server/api/responses";
import { withTonStorageService } from "@/src/server/ton-storage/runtime";

function parseIncludeHashesParam(value: string | null) {
  if (value === null) {
    return true;
  }

  return value === "1" || value === "true";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const includeHashes = parseIncludeHashesParam(url.searchParams.get("hashes"));
    const result = await withTonStorageService((service) =>
      service.listBags({ includeHashes }),
    );

    return jsonOk(result);
  } catch (error) {
    return jsonError(error, {
      code: "TON_COMMAND_FAILED",
      message: "Bag list lookup failed.",
      statusCode: 502,
    });
  }
}
