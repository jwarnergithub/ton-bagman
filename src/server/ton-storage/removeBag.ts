import "server-only";
import { logDangerousAction } from "@/src/server/audit/logger";
import {
  getManagedBagSourceRecord,
  removeManagedBagSourceRecord,
} from "@/src/server/files/managedBagSources";
import { createAppError } from "@/src/server/errors/appError";
import { withTonStorageService } from "@/src/server/ton-storage/runtime";
import type { TonMutationResult } from "@/src/server/ton-storage/types";

export type RemoveBagRequest = {
  bagId: string;
  removeFiles?: boolean;
  confirmation?: string;
};

export type RemoveBagResult = {
  bag: TonMutationResult;
  removeFiles: boolean;
  managedSourceTracked: boolean;
  managedSourcePreparedPath: string | null;
  recoveredToUploads: boolean;
  recoveredDestinationPaths: string[];
  recoveryMessage: string | null;
  recoveryWarning: string | null;
};

function assertRemoveConfirmation(
  confirmation: string | undefined,
  removeFiles: boolean,
) {
  const expected = removeFiles ? "REMOVE BAG AND FILES" : "REMOVE BAG";

  if (confirmation?.trim() !== expected) {
    throw createAppError(
      "VALIDATION_ERROR",
      `confirmation must equal "${expected}".`,
      400,
    );
  }
}

export async function removeBag(request: RemoveBagRequest): Promise<RemoveBagResult> {
  const bagId = request.bagId.trim();

  if (!bagId) {
    throw createAppError("VALIDATION_ERROR", "Bag ID is required.", 400);
  }

  const removeFiles = Boolean(request.removeFiles);
  assertRemoveConfirmation(request.confirmation, removeFiles);

  const managedSource = await getManagedBagSourceRecord(bagId);

  await logDangerousAction({
    action: removeFiles ? "ton-bag-remove-with-files-requested" : "ton-bag-remove-requested",
    target: bagId,
  });

  const bag = await withTonStorageService((service) =>
    service.removeBag({
      bagId,
      removeFiles,
    }),
  );

  if (managedSource) {
    await removeManagedBagSourceRecord(bagId);
  }

  await logDangerousAction({
    action: removeFiles ? "ton-bag-remove-with-files-completed" : "ton-bag-remove-completed",
    target: bagId,
  });

  return {
    bag,
    removeFiles,
    managedSourceTracked: false,
    managedSourcePreparedPath: null,
    recoveredToUploads: false,
    recoveredDestinationPaths: [],
    recoveryMessage: null,
    recoveryWarning: null,
  };
}
