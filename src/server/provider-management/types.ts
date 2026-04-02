import type { ProviderMutationResult } from "@/src/server/ton-storage/types";

export type MyProviderParams = {
  acceptNewContracts: boolean;
  ratePerMbDayNanoTon: number;
  ratePerMbDayTon: string;
  maxSpanSeconds: number;
  minimalFileSizeBytes: number;
  minimalFileSizeLabel: string;
  maximalFileSizeBytes: number;
  maximalFileSizeLabel: string;
};

export type MyProviderConfig = {
  maxContracts: number | null;
  maxTotalSizeBytes: number | null;
  maxTotalSizeLabel: string | null;
  currentContracts: number | null;
};

export type MyProviderContract = {
  addressRaw: string;
  addressFriendly: string;
  bagId: string | null;
  bagDescription: string | null;
  bagPresentLocally: boolean;
  clientAddressFriendly: string;
  balanceTon: string;
  fileSizeLabel: string;
  active: boolean;
  onChainStatus: string;
  maxSpanLabel: string;
  lastProofTimeLabel: string;
  expiresAtLabel: string;
  timeLeftLabel: string;
};

export type PendingProviderDeployment = {
  providerAddressRaw: string;
  providerAddressFriendly: string;
  tonkeeperAddressFriendly: string;
  tonkeeperLink: string;
  amountTon: string;
  amountNanoTon: string;
  createdAt: string;
};

export type MyProviderOverview = {
  configured: boolean;
  providerAddressRaw: string | null;
  providerAddressFriendly: string | null;
  onChainBalanceTon: string | null;
  onChainBalanceNanoTon: string | null;
  lastActivityLabel: string | null;
  lastActivityUnix: number | null;
  params: MyProviderParams | null;
  config: MyProviderConfig | null;
  contracts: MyProviderContract[];
  pendingDeployment: PendingProviderDeployment | null;
  rawInfo: Record<string, unknown> | null;
  setupHint: string | null;
};

export type ImportProviderPrivateKeyRequest = {
  filePath: string;
};

export type InitMyProviderRequest = {
  providerAddress: string;
};

export type UpdateMyProviderParamsRequest = {
  acceptNewContracts?: boolean;
  ratePerMbDayNanoTon?: number;
  maxSpanSeconds?: number;
  minimalFileSizeBytes?: number;
  maximalFileSizeBytes?: number;
};

export type UpdateMyProviderConfigRequest = {
  maxContracts?: number;
  maxTotalSizeBytes?: number;
};

export type CloseAcceptedContractRequest = {
  contractAddress: string;
  confirmation?: string;
};

export type MyProviderMutationResponse = {
  result: ProviderMutationResult;
  overview: MyProviderOverview;
};
