import "server-only";
import { saveManagedBagSourceRecord } from "@/src/server/files/managedBagSources";
import { prepareRemoteUploadsDirectoryForBagCreation } from "@/src/server/files/remoteFiles";
import { withTonStorageService } from "@/src/server/ton-storage/runtime";
import type { TonMutationResult } from "@/src/server/ton-storage/types";

export type CreateBagFromUploadsInput = {
  description?: string;
  copy?: boolean;
  noUpload?: boolean;
};

export type CreateBagFromUploadsResult = {
  originalDirectory: string;
  preparedPath: string;
  movedItems: string[];
  managedSourceTracked: boolean;
  bag: TonMutationResult;
};

export async function createBagFromUploadsDirectory(
  input: CreateBagFromUploadsInput,
): Promise<CreateBagFromUploadsResult> {
  const prepared = await prepareRemoteUploadsDirectoryForBagCreation();
  const bag = await withTonStorageService((service) =>
    service.createBag({
      path: prepared.preparedPath,
      description: input.description,
      copy: input.copy,
      noUpload: input.noUpload,
    }),
  );

  const managedSourceTracked = Boolean(bag.bagId);

  if (bag.bagId) {
    await saveManagedBagSourceRecord({
      bagId: bag.bagId,
      createdAt: new Date().toISOString(),
      workflow: "uploads-directory",
      preparedPath: prepared.preparedPath,
      originalPath: prepared.originalDirectory,
      itemKind: "workspace",
      movedItems: prepared.movedItems,
    });
  }

  return {
    originalDirectory: prepared.originalDirectory,
    preparedPath: prepared.preparedPath,
    movedItems: prepared.movedItems,
    managedSourceTracked,
    bag,
  };
}
