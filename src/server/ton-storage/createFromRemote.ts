import "server-only";
import { saveManagedBagSourceRecord } from "@/src/server/files/managedBagSources";
import { prepareRemoteItemForBagCreation } from "@/src/server/files/remoteFiles";
import { withTonStorageService } from "@/src/server/ton-storage/runtime";
import type { TonMutationResult } from "@/src/server/ton-storage/types";

export type CreateBagFromRemoteInput = {
  remotePath?: string;
  description?: string;
  copy?: boolean;
  noUpload?: boolean;
};

export type CreateBagFromRemoteResult = {
  preparedPath: string;
  originalPath: string;
  itemKind: "file" | "directory" | "symlink";
  managedSourceTracked: boolean;
  bag: TonMutationResult;
};

export async function createBagFromRemoteInput(
  input: CreateBagFromRemoteInput,
): Promise<CreateBagFromRemoteResult> {
  const prepared = await prepareRemoteItemForBagCreation({
    remotePath: input.remotePath,
  });
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
      workflow: "remote-item",
      preparedPath: prepared.preparedPath,
      originalPath: prepared.originalPath,
      itemKind: prepared.kind,
      movedItems: [prepared.originalPath.split("/").pop() ?? prepared.originalPath],
    });
  }

  return {
    preparedPath: prepared.preparedPath,
    originalPath: prepared.originalPath,
    itemKind: prepared.kind,
    managedSourceTracked,
    bag,
  };
}
