import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/files/remoteFiles", () => ({
  createManagedRemoteBagDirectory: vi.fn(),
}));

vi.mock("../../src/server/ton-storage/runtime", () => ({
  withTonStorageService: vi.fn(),
}));

import {
  addBagByHash,
  addBagByMeta,
} from "../../src/server/ton-storage/addExistingBag";
import { createManagedRemoteBagDirectory } from "../../src/server/files/remoteFiles";
import { withTonStorageService } from "../../src/server/ton-storage/runtime";

function createTonServiceMock() {
  return {
    addByHash: vi.fn(),
    addByMeta: vi.fn(),
  };
}

describe("addExistingBag", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a managed directory for add-by-hash when requested", async () => {
    const service = createTonServiceMock();
    service.addByHash.mockResolvedValue({
      action: "add-by-hash",
      status: "accepted",
      bagId: "bag-1",
      rawOutput: "added",
    });
    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback(service as never),
    );
    vi.mocked(createManagedRemoteBagDirectory).mockResolvedValue({
      directory: "/opt/ton-storage/bag-sources/2026-03-29-hash-ABCDEF123456",
    });

    const result = await addBagByHash({
      hash: "ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890",
      storeWithLocalBags: true,
    });

    expect(createManagedRemoteBagDirectory).toHaveBeenCalledWith("hash-ABCDEF123456");
    expect(service.addByHash).toHaveBeenCalledWith({
      hash: "ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890",
      partialFiles: undefined,
      downloadDir: "/opt/ton-storage/bag-sources/2026-03-29-hash-ABCDEF123456",
      storeWithLocalBags: true,
    });
    expect(result).toEqual({
      bag: {
        action: "add-by-hash",
        status: "accepted",
        bagId: "bag-1",
        rawOutput: "added",
      },
      downloadDir: "/opt/ton-storage/bag-sources/2026-03-29-hash-ABCDEF123456",
      storedWithLocalBags: true,
    });
  });

  it("keeps daemon internal storage for add-by-meta when local-bag storage is unchecked", async () => {
    const service = createTonServiceMock();
    service.addByMeta.mockResolvedValue({
      action: "add-by-meta",
      status: "accepted",
      bagId: "bag-2",
      rawOutput: "added",
    });
    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback(service as never),
    );

    const result = await addBagByMeta({
      metafilePath: "/opt/ton-storage/test-output/example.meta",
      storeWithLocalBags: false,
    });

    expect(createManagedRemoteBagDirectory).not.toHaveBeenCalled();
    expect(service.addByMeta).toHaveBeenCalledWith({
      metafilePath: "/opt/ton-storage/test-output/example.meta",
      partialFiles: undefined,
      downloadDir: undefined,
      storeWithLocalBags: false,
    });
    expect(result).toEqual({
      bag: {
        action: "add-by-meta",
        status: "accepted",
        bagId: "bag-2",
        rawOutput: "added",
      },
      downloadDir: null,
      storedWithLocalBags: false,
    });
  });
});
