import "server-only";
import path from "node:path/posix";
import { z } from "zod";
import { createManagedRemoteBagDirectory } from "@/src/server/files/remoteFiles";
import { withTonStorageService } from "@/src/server/ton-storage/runtime";
import type {
  AddByHashInput,
  AddByMetaInput,
  TonMutationResult,
} from "@/src/server/ton-storage/types";

const addByHashRequestSchema = z.object({
  hash: z.string(),
  partialFiles: z.array(z.string()).optional(),
  storeWithLocalBags: z.boolean().optional(),
});

const addByMetaRequestSchema = z.object({
  metafilePath: z.string(),
  partialFiles: z.array(z.string()).optional(),
  storeWithLocalBags: z.boolean().optional(),
});

export type AddExistingBagResult = {
  bag: TonMutationResult;
  downloadDir: string | null;
  storedWithLocalBags: boolean;
};

function buildManagedImportLabel(source: string, fallback: string) {
  const basename = path.basename(source.trim());

  if (!basename || basename === "." || basename === "/") {
    return fallback;
  }

  return basename;
}

export async function addBagByHash(
  input: AddByHashInput,
): Promise<AddExistingBagResult> {
  const request = addByHashRequestSchema.parse(input);
  let downloadDir: string | undefined;

  if (request.storeWithLocalBags) {
    const managedDirectory = await createManagedRemoteBagDirectory(
      `hash-${request.hash.slice(0, 12)}`,
    );
    downloadDir = managedDirectory.directory;
  }

  const bag = await withTonStorageService((service) =>
    service.addByHash({
      hash: request.hash,
      partialFiles: request.partialFiles,
      downloadDir,
      storeWithLocalBags: request.storeWithLocalBags,
    }),
  );

  return {
    bag,
    downloadDir: downloadDir ?? null,
    storedWithLocalBags: Boolean(downloadDir),
  };
}

export async function addBagByMeta(
  input: AddByMetaInput,
): Promise<AddExistingBagResult> {
  const request = addByMetaRequestSchema.parse(input);
  let downloadDir: string | undefined;

  if (request.storeWithLocalBags) {
    const managedDirectory = await createManagedRemoteBagDirectory(
      buildManagedImportLabel(request.metafilePath, "meta-import"),
    );
    downloadDir = managedDirectory.directory;
  }

  const bag = await withTonStorageService((service) =>
    service.addByMeta({
      metafilePath: request.metafilePath,
      partialFiles: request.partialFiles,
      downloadDir,
      storeWithLocalBags: request.storeWithLocalBags,
    }),
  );

  return {
    bag,
    downloadDir: downloadDir ?? null,
    storedWithLocalBags: Boolean(downloadDir),
  };
}
