import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppError } from "../../src/server/errors/appError";

vi.mock("../../src/server/ton-storage/runtime", () => ({
  withTonStorageService: vi.fn(),
}));

vi.mock("../../src/server/ton-storage/addExistingBag", () => ({
  addBagByHash: vi.fn(),
  addBagByMeta: vi.fn(),
}));

vi.mock("../../src/server/files/managedBagSources", () => ({
  recoverManagedBagSourceToUploads: vi.fn(),
  deleteManagedBagSource: vi.fn(),
}));

vi.mock("../../src/server/ton-storage/removeBag", () => ({
  removeBag: vi.fn(),
}));

import { POST as addByHashRoute } from "../../app/api/bags/add-by-hash/route";
import { POST as addByMetaRoute } from "../../app/api/bags/add-by-meta/route";
import { POST as createBagRoute } from "../../app/api/bags/create/route";
import { POST as removeBagRoute } from "../../app/api/bags/[bagId]/remove/route";
import { POST as deleteManagedSourceRoute } from "../../app/api/bags/[bagId]/managed-source/delete/route";
import { POST as exportMetaRoute } from "../../app/api/bags/[bagId]/meta/route";
import { POST as pauseDownloadRoute } from "../../app/api/bags/[bagId]/download-pause/route";
import { POST as recoverToUploadsRoute } from "../../app/api/bags/[bagId]/recover-to-uploads/route";
import { POST as resumeDownloadRoute } from "../../app/api/bags/[bagId]/download-resume/route";
import { POST as pauseUploadRoute } from "../../app/api/bags/[bagId]/upload-pause/route";
import { POST as resumeUploadRoute } from "../../app/api/bags/[bagId]/upload-resume/route";
import {
  addBagByHash,
  addBagByMeta,
} from "../../src/server/ton-storage/addExistingBag";
import {
  deleteManagedBagSource,
  recoverManagedBagSourceToUploads,
} from "../../src/server/files/managedBagSources";
import { removeBag } from "../../src/server/ton-storage/removeBag";
import { withTonStorageService } from "../../src/server/ton-storage/runtime";

function createTonServiceMock() {
  return {
    listBags: vi.fn(),
    getBagById: vi.fn(),
    getBagPeers: vi.fn(),
    createBag: vi.fn(),
    addByHash: vi.fn(),
    addByMeta: vi.fn(),
    getMeta: vi.fn(),
    pauseDownload: vi.fn(),
    resumeDownload: vi.fn(),
    pauseUpload: vi.fn(),
    resumeUpload: vi.fn(),
    removeBag: vi.fn(),
    getPriorityNameSupport: vi.fn(),
  };
}

describe("bag mutation routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 for POST /api/bags/create", async () => {
    const service = createTonServiceMock();
    service.createBag.mockResolvedValue({
      action: "create",
      status: "accepted",
      bagId: "bag-123",
      rawOutput: "created",
    });
    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback(service),
    );

    const request = new Request("http://localhost/api/bags/create", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        path: "/opt/ton-storage/uploads/file.txt",
        description: "Example bag",
      }),
    });

    const response = await createBagRoute(request as never);

    expect(service.createBag).toHaveBeenCalledWith({
      path: "/opt/ton-storage/uploads/file.txt",
      description: "Example bag",
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        action: "create",
        status: "accepted",
        bagId: "bag-123",
        rawOutput: "created",
      },
    });
  });

  it("returns service errors for POST /api/bags/add-by-hash", async () => {
    vi.mocked(addBagByHash).mockRejectedValue(
      createAppError("VALIDATION_ERROR", "Hash must be a 64-character hex string.", 400),
    );

    const request = new Request("http://localhost/api/bags/add-by-hash", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        hash: "not-a-hash",
      }),
    });

    const response = await addByHashRoute(request as never);

    expect(addBagByHash).toHaveBeenCalledWith({
      hash: "not-a-hash",
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Hash must be a 64-character hex string.",
      },
    });
  });

  it("returns 201 for POST /api/bags/add-by-meta", async () => {
    vi.mocked(addBagByMeta).mockResolvedValue({
      bag: {
        action: "add-by-meta",
        status: "accepted",
        bagId: "bag-456",
        rawOutput: "meta added",
      },
      downloadDir: "/opt/ton-storage/bag-sources/2026-03-29-example.meta",
      storedWithLocalBags: true,
    });

    const request = new Request("http://localhost/api/bags/add-by-meta", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        metafilePath: "/opt/ton-storage/test-output/example.meta",
        storeWithLocalBags: true,
      }),
    });

    const response = await addByMetaRoute(request as never);

    expect(addBagByMeta).toHaveBeenCalledWith({
      metafilePath: "/opt/ton-storage/test-output/example.meta",
      storeWithLocalBags: true,
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        bag: {
          action: "add-by-meta",
          status: "accepted",
          bagId: "bag-456",
          rawOutput: "meta added",
        },
        downloadDir: "/opt/ton-storage/bag-sources/2026-03-29-example.meta",
        storedWithLocalBags: true,
      },
    });
  });

  it("passes the route bag ID into POST /api/bags/[bagId]/download-pause", async () => {
    const service = createTonServiceMock();
    service.pauseDownload.mockResolvedValue({
      action: "download-pause",
      status: "completed",
      bagId: "bag-789",
      rawOutput: "paused",
    });
    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback(service),
    );

    const request = new Request("http://localhost/api/bags/bag-789/download-pause", {
      method: "POST",
    });

    const response = await pauseDownloadRoute(request as never, {
      params: Promise.resolve({ bagId: "bag-789" }),
    });

    expect(service.pauseDownload).toHaveBeenCalledWith({
      bagId: "bag-789",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        action: "download-pause",
        status: "completed",
        bagId: "bag-789",
        rawOutput: "paused",
      },
    });
  });

  it("rejects blank bag IDs for POST /api/bags/[bagId]/download-resume", async () => {
    const service = createTonServiceMock();
    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback(service),
    );

    const request = new Request("http://localhost/api/bags/%20/download-resume", {
      method: "POST",
    });

    const response = await resumeDownloadRoute(request as never, {
      params: Promise.resolve({ bagId: "   " }),
    });

    expect(service.resumeDownload).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Bag ID is required.",
      },
    });
  });

  it("passes the route bag ID into POST /api/bags/[bagId]/upload-pause", async () => {
    const service = createTonServiceMock();
    service.pauseUpload.mockResolvedValue({
      action: "upload-pause",
      status: "accepted",
      bagId: "bag-789",
      rawOutput: "upload paused",
    });
    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback(service),
    );

    const request = new Request("http://localhost/api/bags/bag-789/upload-pause", {
      method: "POST",
    });

    const response = await pauseUploadRoute(request as never, {
      params: Promise.resolve({ bagId: "bag-789" }),
    });

    expect(service.pauseUpload).toHaveBeenCalledWith({
      bagId: "bag-789",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        action: "upload-pause",
        status: "accepted",
        bagId: "bag-789",
        rawOutput: "upload paused",
      },
    });
  });

  it("passes the route bag ID into POST /api/bags/[bagId]/upload-resume", async () => {
    const service = createTonServiceMock();
    service.resumeUpload.mockResolvedValue({
      action: "upload-resume",
      status: "accepted",
      bagId: "bag-789",
      rawOutput: "upload resumed",
    });
    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback(service),
    );

    const request = new Request("http://localhost/api/bags/bag-789/upload-resume", {
      method: "POST",
    });

    const response = await resumeUploadRoute(request as never, {
      params: Promise.resolve({ bagId: "bag-789" }),
    });

    expect(service.resumeUpload).toHaveBeenCalledWith({
      bagId: "bag-789",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        action: "upload-resume",
        status: "accepted",
        bagId: "bag-789",
        rawOutput: "upload resumed",
      },
    });
  });

  it("passes bag ID and output path into POST /api/bags/[bagId]/meta", async () => {
    const service = createTonServiceMock();
    service.getMeta.mockResolvedValue({
      bagId: "bag-meta-1",
      outputPath: "/opt/ton-storage/test-output/example.meta",
      created: true,
      rawOutput: "Saved meta (448 B)",
    });
    vi.mocked(withTonStorageService).mockImplementation(async (callback) =>
      callback(service),
    );

    const request = new Request("http://localhost/api/bags/bag-meta-1/meta", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        outputPath: "/opt/ton-storage/test-output/example.meta",
      }),
    });

    const response = await exportMetaRoute(request as never, {
      params: Promise.resolve({ bagId: "bag-meta-1" }),
    });

    expect(service.getMeta).toHaveBeenCalledWith({
      bagId: "bag-meta-1",
      outputPath: "/opt/ton-storage/test-output/example.meta",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        bagId: "bag-meta-1",
        outputPath: "/opt/ton-storage/test-output/example.meta",
        created: true,
        rawOutput: "Saved meta (448 B)",
      },
    });
  });

  it("passes the route bag ID into POST /api/bags/[bagId]/remove", async () => {
    vi.mocked(removeBag).mockResolvedValue({
      bag: {
        action: "remove",
        status: "completed",
        bagId: "bag-remove-1",
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

    const request = new Request("http://localhost/api/bags/bag-remove-1/remove", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        removeFiles: true,
        confirmation: "REMOVE BAG AND FILES",
      }),
    });

    const response = await removeBagRoute(request as never, {
      params: Promise.resolve({ bagId: "bag-remove-1" }),
    });

    expect(removeBag).toHaveBeenCalledWith({
      bagId: "bag-remove-1",
      removeFiles: true,
      confirmation: "REMOVE BAG AND FILES",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        bag: {
          action: "remove",
          status: "completed",
          bagId: "bag-remove-1",
          rawOutput: "Removed",
        },
        removeFiles: true,
        managedSourceTracked: false,
        managedSourcePreparedPath: null,
        recoveredToUploads: false,
        recoveredDestinationPaths: [],
        recoveryMessage: null,
        recoveryWarning: null,
      },
    });
  });

  it("passes the route bag ID into POST /api/bags/[bagId]/recover-to-uploads", async () => {
    vi.mocked(recoverManagedBagSourceToUploads).mockResolvedValue({
      status: "copied-to-uploads",
      bagId: "bag-restore-1",
      preparedPath: "/opt/ton-storage/bag-sources/prepared",
      destinationPaths: ["/opt/ton-storage/uploads/image.jpg"],
      message:
        "Managed source contents were copied into the uploads directory. The original bag source was left in place.",
    });

    const request = new Request("http://localhost/api/bags/bag-restore-1/recover-to-uploads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        confirmation: "COPY BACK",
      }),
    });

    const response = await recoverToUploadsRoute(request as never, {
      params: Promise.resolve({ bagId: "bag-restore-1" }),
    });

    expect(recoverManagedBagSourceToUploads).toHaveBeenCalledWith(
      "bag-restore-1",
      "COPY BACK",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        status: "copied-to-uploads",
        bagId: "bag-restore-1",
        preparedPath: "/opt/ton-storage/bag-sources/prepared",
        destinationPaths: ["/opt/ton-storage/uploads/image.jpg"],
        message:
          "Managed source contents were copied into the uploads directory. The original bag source was left in place.",
      },
    });
  });

  it("returns typed errors for POST /api/bags/[bagId]/managed-source/delete", async () => {
    vi.mocked(deleteManagedBagSource).mockRejectedValue(
      createAppError(
        "MANAGED_BAG_SOURCE_NOT_FOUND",
        "No app-managed source record was found for this bag.",
        404,
      ),
    );

    const request = new Request(
      "http://localhost/api/bags/bag-missing/managed-source/delete",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          confirmation: "DELETE CONTENTS",
        }),
      },
    );

    const response = await deleteManagedSourceRoute(request as never, {
      params: Promise.resolve({ bagId: "bag-missing" }),
    });

    expect(deleteManagedBagSource).toHaveBeenCalledWith(
      "bag-missing",
      "DELETE CONTENTS",
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "MANAGED_BAG_SOURCE_NOT_FOUND",
        message: "No app-managed source record was found for this bag.",
      },
    });
  });
});
