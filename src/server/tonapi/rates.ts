import "server-only";
import { tonApiFetch } from "@/src/server/tonapi/client";
import type { TonApiRatesResponse } from "@/src/server/tonapi/types";

function readCaseInsensitiveNumber(
  record: Record<string, number> | undefined,
  key: string,
) {
  if (!record) {
    return null;
  }

  const matchedKey = Object.keys(record).find(
    (candidate) => candidate.toLowerCase() === key.toLowerCase(),
  );

  if (!matchedKey) {
    return null;
  }

  const value = record[matchedKey];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function getTonUsdPrice() {
  try {
    const response = await tonApiFetch<TonApiRatesResponse>(
      "/v2/rates?tokens=ton&currencies=usd",
    );
    const matchedTokenKey = Object.keys(response.rates).find(
      (candidate) => candidate.toLowerCase() === "ton",
    );

    if (!matchedTokenKey) {
      return null;
    }

    return readCaseInsensitiveNumber(response.rates[matchedTokenKey]?.prices, "usd");
  } catch {
    return null;
  }
}
