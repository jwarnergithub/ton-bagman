import { BagDetailScreen } from "@/src/components/bags/bag-detail-screen";

export const dynamic = "force-dynamic";

type BagDetailPageProps = {
  params: Promise<{
    bagId: string;
  }>;
  searchParams: Promise<{
    providerAddress?: string;
  }>;
};

export default async function BagDetailPage({ params, searchParams }: BagDetailPageProps) {
  const { bagId } = await params;
  const { providerAddress } = await searchParams;

  return <BagDetailScreen bagId={bagId} initialProviderAddress={providerAddress ?? null} />;
}
