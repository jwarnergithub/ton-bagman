import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppError } from "../../src/server/errors/appError";

vi.mock("../../src/server/ton-storage/createFromUploads", () => ({
  createBagFromUploadsDirectory: vi.fn(),
}));

import { POST } from "../../app/api/bags/create-from-uploads/route";
import { createBagFromUploadsDirectory } from "../../src/server/ton-storage/createFromUploads";

describe("POST /api/bags/create-from-uploads", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates one bag from the uploads directory", async () => {
    vi.mocked(createBagFromUploadsDirectory).mockResolvedValue({
      originalDirectory: "/opt/ton-storage/uploads",
      preparedPath: "/opt/ton-storage/bag-sources/run-1-uploads",
      movedItems: ["folder-a", "image.jpg"],
      managedSourceTracked: true,
      bag: {
        action: "create",
        status: "accepted",
        bagId: "bag-999",
        rawOutput: "Created bag-999",
      },
    });

    const request = new Request("http://localhost/api/bags/create-from-uploads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        description: "workspace",
      }),
    });

    const response = await POST(request as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        originalDirectory: "/opt/ton-storage/uploads",
        preparedPath: "/opt/ton-storage/bag-sources/run-1-uploads",
        movedItems: ["folder-a", "image.jpg"],
        managedSourceTracked: true,
        bag: {
          action: "create",
          status: "accepted",
          bagId: "bag-999",
          rawOutput: "Created bag-999",
        },
      },
    });
  });

  it("returns typed errors when uploads preparation fails", async () => {
    vi.mocked(createBagFromUploadsDirectory).mockRejectedValue(
      createAppError("BAG_PREPARE_FAILED", "The uploads directory is empty.", 400),
    );

    const request = new Request("http://localhost/api/bags/create-from-uploads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "BAG_PREPARE_FAILED",
        message: "The uploads directory is empty.",
      },
    });
  });
});
