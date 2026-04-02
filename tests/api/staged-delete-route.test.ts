import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppError } from "../../src/server/errors/appError";

vi.mock("../../src/server/files/staging", () => ({
  removeStagedFile: vi.fn(),
}));

import { DELETE } from "../../app/api/uploads/staged/[stagedFileId]/route";
import { removeStagedFile } from "../../src/server/files/staging";

describe("DELETE /api/uploads/staged/[stagedFileId]", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("removes a staged file", async () => {
    const response = await DELETE(new Request("http://localhost") as never, {
      params: Promise.resolve({ stagedFileId: "stage-1" }),
    });

    expect(removeStagedFile).toHaveBeenCalledWith("stage-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        removed: true,
        stagedFileId: "stage-1",
      },
    });
  });

  it("returns typed errors when staged removal fails", async () => {
    vi.mocked(removeStagedFile).mockRejectedValue(
      createAppError("VALIDATION_ERROR", "staged file ID is required.", 400),
    );

    const response = await DELETE(new Request("http://localhost") as never, {
      params: Promise.resolve({ stagedFileId: "" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "staged file ID is required.",
      },
    });
  });
});
