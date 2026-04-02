import { MyProviderScreen } from "@/src/components/providers/my-provider-screen";
import { getMyProviderOverview } from "@/src/server/provider-management/service";

export const dynamic = "force-dynamic";

async function getInitialProviderState() {
  try {
    return {
      overview: await getMyProviderOverview(),
      error: null,
    };
  } catch (error) {
    return {
      overview: null,
      error: error instanceof Error ? error.message : "My provider view unavailable.",
    };
  }
}

export default async function MyProviderPage() {
  const { overview, error } = await getInitialProviderState();

  return <MyProviderScreen initialOverview={overview} initialError={error} />;
}
