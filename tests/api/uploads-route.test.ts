import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/files/staging", () => ({
  listStagedFiles: vi.fn(),
  stageBrowserFiles: vi.fn(),
}));

import { GET, POST } from "../../app/api/uploads/route";
import {
  listStagedFiles,
  stageBrowserFiles,
} from "../../src/server/files/staging";

describe("/api/uploads", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the staged file list", async () => {
    vi.mocked(listStagedFiles).mockResolvedValue({
      items: [],
      source: "filesystem",
      totalFiles: 0,
      totalBytes: 0,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        items: [],
        source: "filesystem",
        totalFiles: 0,
        totalBytes: 0,
      },
    });
  });

  it("rejects upload requests that are not multipart", async () => {
    const request = new Request("http://localhost/api/uploads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request as never);

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "UPLOAD_PLACEHOLDER_FAILED",
        message: "Uploads must use multipart/form-data.",
      },
    });
  });

  it("accepts multipart uploads and stages files", async () => {
    const file = new File(["hello"], "hello.txt", {
      type: "text/plain",
    });
    vi.mocked(stageBrowserFiles).mockResolvedValue({
      items: [
        {
          id: "file-1",
          filename: "hello.txt",
          relativePath: "folder/hello.txt",
          mimeType: "text/plain",
          sizeBytes: 5,
          storedAt: "2026-01-01T00:00:00.000Z",
          localPath: "/tmp/hello.txt",
          status: "staged",
        },
      ],
      source: "filesystem",
      totalFiles: 1,
      totalBytes: 5,
      message: "Staged 1 file(s).",
    });
    const formData = new FormData();
    formData.append("files", file);
    formData.append("relativePaths", "folder/hello.txt");
    const request = {
      headers: {
        get(headerName: string) {
          return headerName === "content-type"
            ? "multipart/form-data; boundary=test"
            : null;
        },
      },
      async formData() {
        return formData;
      },
    };

    const response = await POST(request as never);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        items: [
          {
            id: "file-1",
            filename: "hello.txt",
            relativePath: "folder/hello.txt",
            mimeType: "text/plain",
            sizeBytes: 5,
            storedAt: "2026-01-01T00:00:00.000Z",
            localPath: "/tmp/hello.txt",
            status: "staged",
          },
        ],
        source: "filesystem",
        totalFiles: 1,
        totalBytes: 5,
        message: "Staged 1 file(s).",
      },
    });
  });
});
