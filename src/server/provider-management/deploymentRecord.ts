import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const PROVIDER_STATE_ROOT_DIR = ".ton-storage/provider-state";
const DEPLOYMENT_RECORD_FILENAME = "pending-deployment.json";

export type PendingProviderDeploymentRecord = {
  providerAddressRaw: string;
  tonkeeperAddressFriendly: string;
  tonkeeperLink: string;
  amountTon: string;
  amountNanoTon: string;
  createdAt: string;
};

function getProviderStateRoot() {
  return path.join(process.cwd(), PROVIDER_STATE_ROOT_DIR);
}

function getDeploymentRecordPath() {
  return path.join(getProviderStateRoot(), DEPLOYMENT_RECORD_FILENAME);
}

async function ensureProviderStateRoot() {
  await mkdir(getProviderStateRoot(), { recursive: true });
}

export async function savePendingProviderDeploymentRecord(
  record: PendingProviderDeploymentRecord,
) {
  await ensureProviderStateRoot();
  await writeFile(getDeploymentRecordPath(), JSON.stringify(record, null, 2), "utf8");
}

export async function getPendingProviderDeploymentRecord(): Promise<PendingProviderDeploymentRecord | null> {
  try {
    const payload = await readFile(getDeploymentRecordPath(), "utf8");
    return JSON.parse(payload) as PendingProviderDeploymentRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function removePendingProviderDeploymentRecord() {
  await rm(getDeploymentRecordPath(), { force: true });
}
