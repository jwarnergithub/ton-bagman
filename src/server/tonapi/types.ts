export type TonApiStorageProvider = {
  address: string;
  accept_new_contracts: boolean;
  rate_per_mb_day: number;
  max_span: number;
  minimal_file_size: number;
  maximal_file_size: number;
};

export type TonApiStorageProvidersResponse = {
  providers: TonApiStorageProvider[];
};

export type TonApiAccountSummary = {
  address: string;
  last_activity?: number;
  status?: string;
  balance?: number | string;
};

export type StorageProviderSummary = {
  address: string;
  acceptNewContracts: boolean;
  ratePerMbDayNanoTon: number;
  ratePerMbDayTonValue: number;
  ratePerMbDayTon: string;
  maxSpan: number;
  maxSpanLabel: string;
  minimalFileSize: number;
  minimalFileSizeLabel: string;
  maximalFileSize: number;
  maximalFileSizeLabel: string;
  lastActivityUnix: number | null;
  lastActivityIso: string | null;
  lastActivityLabel: string;
};

export type StorageProvidersResult = {
  providers: StorageProviderSummary[];
  fetchedAt: string;
};
