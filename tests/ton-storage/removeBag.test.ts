import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppError } from "../../src/server/errors/appError";

vi.mock("../../src/server/ton-storage/runtime", () => ({
  withTonStorageService: vi.fn(),
}));

vi.mock("../../src/server/files/managedBagSources", () => ({
  getManagedBagSourceRecord: vi.fn(),
  removeManagedBagSourceRecord: vi.fn(),
}));

vi.mock("../../src/server/audit/logger", () => ({
  logDangerousAction: vi.fn(),
}));

import {
  getManagedBagSourceRecord,
  removeManagedBagSourceRecord,
} from "../../src/server/files/managedBagSources";
import { removeBag } from "../../src/server/ton-storage/removeBag";
import { withTonStorageService } from "../../src/server/ton-storage/runtime";

describe("removeBag", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls TON remove with the verified remove-files variant", async () => {
    vi.mocked(getManagedBagSourceRecord).mockResolvedValue({
      bagId: "bag-1",
      createdAt: "2026-03-29T00:00:00.000Z",
      workflow: "uploads-directory",
      preparedPath: "/opt/ton-storage/bag-sources/prepared",
      originalPath: "/opt/ton-storage/uploads",
      itemKind: "workspace",
      movedItems: ["image.jpg"],
    });
    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback({
        removeBag: vi.fn().mockResolvedValue({
          action: "remove",
          status: "completed",
          bagId: "bag-1",
          rawOutput: "Removed",
        }),
      } as never),
    );

    const result = await removeBag({
      bagId: "bag-1",
      removeFiles: true,
      confirmation: "REMOVE BAG AND FILES",
    });

    expect(result).toEqual({
      bag: {
        action: "remove",
        status: "completed",
        bagId: "bag-1",
        rawOutput: "Removed",
      },
      removeFiles: true,
      managedSourceTracked: false,
      managedSourcePreparedPath: null,
      recoveredToUploads: false,
      recoveredDestinationPaths: [],
      recoveryMessage: null,
      recoveryWarning: null,
    });
    expect(removeManagedBagSourceRecord).toHaveBeenCalledWith("bag-1");
  });

  it("leaves the managed source in place after remove-bag-only", async () => {
    vi.mocked(getManagedBagSourceRecord).mockResolvedValue({
      bagId: "bag-1",
      createdAt: "2026-03-29T00:00:00.000Z",
      workflow: "uploads-directory",
      preparedPath: "/opt/ton-storage/bag-sources/prepared",
      originalPath: "/opt/ton-storage/uploads",
      itemKind: "workspace",
      movedItems: ["image.jpg"],
    });
    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback({
        removeBag: vi.fn().mockResolvedValue({
          action: "remove",
          status: "completed",
          bagId: "bag-1",
          rawOutput: "Removed",
        }),
      } as never),
    );

    const result = await removeBag({
      bagId: "bag-1",
      confirmation: "REMOVE BAG",
    });

    expect(result).toEqual({
      bag: {
        action: "remove",
        status: "completed",
        bagId: "bag-1",
        rawOutput: "Removed",
      },
      removeFiles: false,
      managedSourceTracked: false,
      managedSourcePreparedPath: null,
      recoveredToUploads: false,
      recoveredDestinationPaths: [],
      recoveryMessage: null,
      recoveryWarning: null,
    });
    expect(removeManagedBagSourceRecord).toHaveBeenCalledWith("bag-1");
  });

  it("rejects the wrong confirmation string", async () => {
    await expect(
      removeBag({
        bagId: "bag-1",
        removeFiles: false,
        confirmation: "DELETE",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: 'confirmation must equal "REMOVE BAG".',
    });
  });

  it("surfaces service errors", async () => {
    vi.mocked(getManagedBagSourceRecord).mockResolvedValue(null);
    vi.mocked(withTonStorageService).mockRejectedValue(
      createAppError("TON_COMMAND_FAILED", "remove failed", 502),
    );

    await expect(
      removeBag({
        bagId: "bag-1",
        confirmation: "REMOVE BAG",
      }),
    ).rejects.toMatchObject({
      code: "TON_COMMAND_FAILED",
      message: "remove failed",
    });
  });
});
