import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppError } from "../../src/server/errors/appError";

vi.mock("../../src/server/ton-storage/createFromRemote", () => ({
  createBagFromRemoteInput: vi.fn(),
}));

import { POST } from "../../app/api/bags/create-from-remote/route";
import { createBagFromRemoteInput } from "../../src/server/ton-storage/createFromRemote";

describe("POST /api/bags/create-from-remote", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a bag from a remote file or folder", async () => {
    vi.mocked(createBagFromRemoteInput).mockResolvedValue({
      originalPath: "/opt/ton-storage/uploads/image.jpg",
      preparedPath: "/opt/ton-storage/bag-sources/abc-image.jpg",
      itemKind: "file",
      managedSourceTracked: true,
      bag: {
        action: "create",
        status: "accepted",
        bagId: "bag-123",
        rawOutput: "Created bag-123",
      },
    });

    const request = new Request("http://localhost/api/bags/create-from-remote", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        remotePath: "/opt/ton-storage/uploads/image.jpg",
        description: "image.jpg",
      }),
    });

    const response = await POST(request as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        originalPath: "/opt/ton-storage/uploads/image.jpg",
        preparedPath: "/opt/ton-storage/bag-sources/abc-image.jpg",
        itemKind: "file",
        managedSourceTracked: true,
        bag: {
          action: "create",
          status: "accepted",
          bagId: "bag-123",
          rawOutput: "Created bag-123",
        },
      },
    });
  });

  it("returns typed errors when prepare-or-create fails", async () => {
    vi.mocked(createBagFromRemoteInput).mockRejectedValue(
      createAppError("BAG_PREPARE_FAILED", "Could not inspect source path.", 502),
    );

    const request = new Request("http://localhost/api/bags/create-from-remote", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        remotePath: "/opt/ton-storage/uploads/missing.jpg",
      }),
    });

    const response = await POST(request as never);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "BAG_PREPARE_FAILED",
        message: "Could not inspect source path.",
      },
    });
  });
});
