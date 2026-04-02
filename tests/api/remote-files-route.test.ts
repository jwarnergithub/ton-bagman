import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppError } from "../../src/server/errors/appError";

vi.mock("../../src/server/files/remoteFiles", () => ({
  listRemoteFiles: vi.fn(),
  listRemoteDirectories: vi.fn(),
}));

import { GET } from "../../app/api/remote-files/route";
import { GET as getDirectories } from "../../app/api/remote-files/directories/route";
import {
  listRemoteDirectories,
  listRemoteFiles,
} from "../../src/server/files/remoteFiles";

describe("GET /api/remote-files", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the remote file list", async () => {
    vi.mocked(listRemoteFiles).mockResolvedValue({
      directory: "/opt/ton-storage/uploads",
      items: [
        {
          name: "image.jpg",
          remotePath: "/opt/ton-storage/uploads/image.jpg",
          kind: "file",
          sizeBytes: 592800,
        },
      ],
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        directory: "/opt/ton-storage/uploads",
        items: [
          {
            name: "image.jpg",
            remotePath: "/opt/ton-storage/uploads/image.jpg",
            kind: "file",
            sizeBytes: 592800,
          },
        ],
      },
    });
  });

  it("returns typed errors when the listing fails", async () => {
    vi.mocked(listRemoteFiles).mockRejectedValue(
      createAppError("REMOTE_FILE_LIST_FAILED", "Permission denied.", 502),
    );

    const response = await GET();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "REMOTE_FILE_LIST_FAILED",
        message: "Permission denied.",
      },
    });
  });
});

describe("GET /api/remote-files/directories", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the remote directory list", async () => {
    vi.mocked(listRemoteDirectories).mockResolvedValue({
      directory: "/opt/ton-storage/uploads",
      directories: [
        "/opt/ton-storage/uploads",
        "/opt/ton-storage/uploads/testingfolder",
      ],
    });

    const response = await getDirectories();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        directory: "/opt/ton-storage/uploads",
        directories: [
          "/opt/ton-storage/uploads",
          "/opt/ton-storage/uploads/testingfolder",
        ],
      },
    });
  });

  it("returns typed errors when the directory listing fails", async () => {
    vi.mocked(listRemoteDirectories).mockRejectedValue(
      createAppError("REMOTE_FILE_LIST_FAILED", "Permission denied.", 502),
    );

    const response = await getDirectories();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "REMOTE_FILE_LIST_FAILED",
        message: "Permission denied.",
      },
    });
  });
});
