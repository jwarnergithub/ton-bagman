import "server-only";
import { tonApiFetch } from "@/src/server/tonapi/client";
import type {
  TonApiAccountSummary,
  StorageProvidersResult,
  StorageProviderSummary,
  TonApiStorageProvidersResponse,
} from "@/src/server/tonapi/types";

function formatBytes(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${sizeBytes} B`;
}

function formatTonFromNanoTon(value: number) {
  const ton = value / 1_000_000_000;

  return ton.toLocaleString("en-US", {
    maximumFractionDigits: 9,
  });
}

function formatSpanAsDaysHoursMinutes(totalSeconds: number) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(clamped / 86400);
  const hours = Math.floor((clamped % 86400) / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);

  return `${days}d:${hours}h:${minutes}m`;
}

function formatLastActivity(lastActivityUnix: number | null) {
  if (!lastActivityUnix) {
    return {
      lastActivityUnix: null,
      lastActivityIso: null,
      lastActivityLabel: "Unknown",
    };
  }

  const iso = new Date(lastActivityUnix * 1000).toISOString();

  return {
    lastActivityUnix,
    lastActivityIso: iso,
    lastActivityLabel: new Date(iso).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }),
  };
}

function mapProvider(
  provider: TonApiStorageProvidersResponse["providers"][number],
  account: TonApiAccountSummary | null,
): StorageProviderSummary {
  const lastActivity = formatLastActivity(account?.last_activity ?? null);

  return {
    address: provider.address,
    acceptNewContracts: provider.accept_new_contracts,
    ratePerMbDayNanoTon: provider.rate_per_mb_day,
    ratePerMbDayTonValue: provider.rate_per_mb_day / 1_000_000_000,
    ratePerMbDayTon: formatTonFromNanoTon(provider.rate_per_mb_day),
    maxSpan: provider.max_span,
    maxSpanLabel: formatSpanAsDaysHoursMinutes(provider.max_span),
    minimalFileSize: provider.minimal_file_size,
    minimalFileSizeLabel: formatBytes(provider.minimal_file_size),
    maximalFileSize: provider.maximal_file_size,
    maximalFileSizeLabel: formatBytes(provider.maximal_file_size),
    lastActivityUnix: lastActivity.lastActivityUnix,
    lastActivityIso: lastActivity.lastActivityIso,
    lastActivityLabel: lastActivity.lastActivityLabel,
  };
}

export async function listStorageProviders(): Promise<StorageProvidersResult> {
  const response = await tonApiFetch<TonApiStorageProvidersResponse>("/v2/storage/providers");
  const accounts = await Promise.all(
    response.providers.map(async (provider) => {
      try {
        return await tonApiFetch<TonApiAccountSummary>(`/v2/accounts/${provider.address}`);
      } catch {
        return null;
      }
    }),
  );

  return {
    providers: response.providers.map((provider, index) => mapProvider(provider, accounts[index])),
    fetchedAt: new Date().toISOString(),
  };
}
