import "server-only";
import { getRuntimeConfig } from "@/src/server/config/env";
import { createAppError } from "@/src/server/errors/appError";

type TonApiFetchOptions = {
  revalidate?: number | false;
};

export async function tonApiFetch<T>(
  path: string,
  options: TonApiFetchOptions = {},
): Promise<T> {
  const config = getRuntimeConfig();

  if (!config.tonApiKey) {
    throw createAppError(
      "PROVIDER_LOOKUP_FAILED",
      "TONAPI_API_KEY is required to load storage providers.",
      500,
    );
  }

  const response = await fetch(`${config.tonApiBaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${config.tonApiKey}`,
    },
    ...(options.revalidate === false
      ? { cache: "no-store" as const }
      : {
          next: {
            revalidate: options.revalidate ?? 60,
          },
        }),
  });

  if (!response.ok) {
    const message = await response.text();

    throw createAppError(
      "PROVIDER_LOOKUP_FAILED",
      message || "TonAPI provider lookup failed.",
      response.status,
    );
  }

  return (await response.json()) as T;
}
