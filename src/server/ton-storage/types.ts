export type BagId = string;
export type BagReference = string;

export type TransferSnapshot = {
  completed: string;
  total: string;
};

export type BagSummary = {
  index: number | null;
  id: BagId;
  description: string | null;
  downloaded: TransferSnapshot | null;
  total: string | null;
  downloadRate: string | null;
  uploadRate: string | null;
};

export type BagFileEntry = {
  index: number | null;
  name: string;
  priority: number | null;
  downloaded: TransferSnapshot | null;
  total: string | null;
};

export type BagDetail = {
  id: BagId;
  description: string | null;
  downloaded: TransferSnapshot | null;
  total: string | null;
  downloadRate: string | null;
  uploadRate: string | null;
  files: BagFileEntry[];
  rawDetails: Record<string, string>;
};

export type BagPeer = {
  address: string;
  adnl: string | null;
  uploadRate: string | null;
  downloadRate: string | null;
  readyParts: string | null;
};

export type BagMetaExport = {
  bagId: BagReference;
  outputPath: string;
  created: boolean;
  rawOutput: string;
};

export type TonMutationStatus = "accepted" | "completed";

export type TonMutationResult = {
  action:
    | "create"
    | "add-by-hash"
    | "add-by-meta"
    | "download-pause"
    | "download-resume"
    | "upload-pause"
    | "upload-resume"
    | "remove";
  status: TonMutationStatus;
  bagId: string | null;
  rawOutput: string;
};

export type ProviderMutationResult = {
  action:
    | "import-pk"
    | "deploy-provider"
    | "init-provider"
    | "set-provider-params"
    | "set-provider-config"
    | "close-contract";
  status: TonMutationStatus;
  rawOutput: string;
  providerAddress?: string | null;
  contractAddress?: string | null;
  tonkeeperLink?: string | null;
  tonkeeperAddressFriendly?: string | null;
  amountTon?: string | null;
  amountNanoTon?: string | null;
};

export type BagListResult = {
  items: BagSummary[];
  totalBags: number | null;
  rawOutput: string;
};

export type BagDetailResult = {
  item: BagDetail;
  rawOutput: string;
};

export type BagPeersResult = {
  items: BagPeer[];
  rawOutput: string;
};

export type TonSupportedCommandName =
  | "create"
  | "add-by-hash"
  | "add-by-meta"
  | "list"
  | "get"
  | "get-peers"
  | "new-contract-message"
  | "get-meta"
  | "import-pk"
  | "deploy-provider"
  | "init-provider"
  | "get-provider-params"
  | "get-provider-info"
  | "set-provider-params"
  | "set-provider-config"
  | "close-contract"
  | "download-pause"
  | "download-resume"
  | "upload-pause"
  | "upload-resume"
  | "remove";

export type TonUnsupportedCommandName = "priority-name";

export type CreateBagInput = {
  path: string;
  description?: string;
  copy?: boolean;
  noUpload?: boolean;
};

export type AddByHashInput = {
  hash: string;
  downloadDir?: string;
  storeWithLocalBags?: boolean;
  partialFiles?: string[];
};

export type AddByMetaInput = {
  metafilePath: string;
  downloadDir?: string;
  storeWithLocalBags?: boolean;
  partialFiles?: string[];
};

export type GetMetaInput = {
  bagId: BagReference;
  outputPath: string;
};

export type DownloadControlInput = {
  bagId: BagReference;
};

export type RemoveBagInput = {
  bagId: BagReference;
  removeFiles?: boolean;
};

export type NewContractMessageInput = {
  bagId: BagReference;
  outputPath: string;
  providerAddress: string;
  queryId?: string;
};

export type ImportProviderPrivateKeyInput = {
  filePath: string;
};

export type InitProviderInput = {
  providerAddress: string;
};

export type GetProviderParamsInput = {
  providerAddress?: string;
};

export type GetProviderInfoInput = {
  includeBalances?: boolean;
  includeContracts?: boolean;
};

export type SetProviderParamsInput = {
  acceptNewContracts?: boolean;
  ratePerMbDayNanoTon?: number;
  maxSpanSeconds?: number;
  minimalFileSizeBytes?: number;
  maximalFileSizeBytes?: number;
};

export type SetProviderConfigInput = {
  maxContracts?: number;
  maxTotalSizeBytes?: number;
};

export type CloseProviderContractInput = {
  contractAddress: string;
};
