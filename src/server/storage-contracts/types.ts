export type StorageContractDiscoveryResult = {
  bagId: string;
  walletAddress: string;
  contracts: StorageContractSummary[];
};

export type StorageContractSummary = {
  addressRaw: string;
  addressFriendly: string;
  bagId: string | null;
  providerAddressRaw: string;
  providerAddressFriendly: string;
  clientAddressRaw: string;
  clientAddressFriendly: string;
  creationTraceId: string | null;
  latestTraceIds: string[];
  onChainStatus: string;
  active: boolean;
  balanceNanoTon: string;
  balanceTon: string;
  fileSize: number;
  nextProof: number;
  ratePerMbDayNanoTon: number;
  maxSpanSeconds: number;
  lastProofTime: number;
  estimatedDailyCostNanoTon: string | null;
  estimatedDailyCostTon: string | null;
  estimatedSecondsRemaining: number | null;
  estimatedExpiresAt: number | null;
};

export type PreparedStartContractLink = {
  bagId: string;
  providerAddressRaw: string;
  providerAddressFriendly: string;
  amountTon: string;
  amountNanoTon: string;
  payloadBase64: string;
  tonkeeperLink: string;
  commandOutput: string;
};

export type PreparedCancelContractLink = {
  contractAddressRaw: string;
  contractAddressFriendly: string;
  amountTon: string;
  amountNanoTon: string;
  payloadBase64: string;
  tonkeeperLink: string;
};

export type PrepareStartContractInput = {
  bagId: string;
  providerAddress: string;
  amountTon: string;
  queryId?: string;
};

export type PrepareCancelContractInput = {
  contractAddress: string;
  amountTon: string;
  queryId?: string;
};
