import { MyProviderScreen } from "@/src/components/providers/my-provider-screen";
import { getMyProviderOverview } from "@/src/server/provider-management/service";
import { getTonUsdPrice } from "@/src/server/tonapi/rates";

export const dynamic = "force-dynamic";

async function getInitialProviderState() {
  try {
    return {
      overview: await getMyProviderOverview(),
      tonPriceUsd: await getTonUsdPrice(),
      error: null,
    };
  } catch (error) {
    return {
      overview: null,
      tonPriceUsd: null,
      error: error instanceof Error ? error.message : "My provider view unavailable.",
    };
  }
}

export default async function MyProviderPage() {
  const { overview, error, tonPriceUsd } = await getInitialProviderState();

  return (
    <MyProviderScreen
      initialOverview={overview}
      initialError={error}
      initialTonPriceUsd={tonPriceUsd}
    />
  );
}
