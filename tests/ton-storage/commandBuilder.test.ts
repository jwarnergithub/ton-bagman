import { describe, expect, it } from "vitest";
import {
  buildAddByHashCommand,
  buildAddByMetaCommand,
  buildCreateCommand,
  buildDownloadPauseCommand,
  buildDownloadResumeCommand,
  buildGetCommand,
  buildGetMetaCommand,
  buildGetPeersCommand,
  buildListCommand,
  buildRemoveCommand,
  buildUploadPauseCommand,
  buildUploadResumeCommand,
  buildUnsupportedPriorityNameCommand,
} from "../../src/server/ton-storage/commandBuilder";

const daemonConfig = {
  tonDaemonControlAddress: "127.0.0.1:5555",
  tonDaemonCliKeyPath: "/opt/ton-storage/db/cli-keys/client",
  tonDaemonServerPubPath: "/opt/ton-storage/db/cli-keys/server.pub",
};

describe("TON command builder", () => {
  it("builds the documented list commands", () => {
    expect(buildListCommand(daemonConfig)).toMatchObject({
      command: "storage-daemon-cli",
      args: [
        "-I",
        "127.0.0.1:5555",
        "-k",
        "/opt/ton-storage/db/cli-keys/client",
        "-p",
        "/opt/ton-storage/db/cli-keys/server.pub",
        "-c",
        "list --hashes",
      ],
      supported: true,
    });

    expect(buildListCommand(daemonConfig, { includeHashes: true }).args).toEqual([
      "-I",
      "127.0.0.1:5555",
      "-k",
      "/opt/ton-storage/db/cli-keys/client",
      "-p",
      "/opt/ton-storage/db/cli-keys/server.pub",
      "-c",
      "list --hashes",
    ]);
  });

  it("builds the documented read commands", () => {
    expect(buildGetCommand(daemonConfig, "BAG123").args.at(-1)).toBe("get BAG123");
    expect(buildGetPeersCommand(daemonConfig, "BAG123").args.at(-1)).toBe(
      "get-peers BAG123",
    );
    expect(
      buildGetMetaCommand(daemonConfig, {
        bagId: "BAG123",
        outputPath: "/tmp/bag.meta",
      }).args.at(-1),
    ).toBe("get-meta BAG123 /tmp/bag.meta");
  });

  it("builds the documented create command with optional flags", () => {
    expect(
      buildCreateCommand(daemonConfig, {
        path: "/data/site",
        description: "My bag",
        copy: true,
        noUpload: true,
      }).args,
    ).toEqual([
      "-I",
      "127.0.0.1:5555",
      "-k",
      "/opt/ton-storage/db/cli-keys/client",
      "-p",
      "/opt/ton-storage/db/cli-keys/server.pub",
      "-c",
      "create /data/site -d \"My bag\" --copy --no-upload",
    ]);
  });

  it("quotes create arguments that contain spaces", () => {
    expect(
      buildCreateCommand(daemonConfig, {
        path: "/data/folder with spaces",
        description: 'Bag "Alpha"',
      }).args.at(-1),
    ).toBe('create "/data/folder with spaces" -d "Bag \\"Alpha\\""');
  });

  it("builds the documented add commands with optional directory and partial flags", () => {
    expect(
      buildAddByHashCommand(daemonConfig, {
        hash: "A".repeat(64),
        downloadDir: "/bags",
        partialFiles: ["index.html", "assets/app.js"],
      }).args.at(-1),
    ).toBe(
      `add-by-hash ${"A".repeat(64)} -d /bags --partial index.html assets/app.js`,
    );

    expect(
      buildAddByMetaCommand(daemonConfig, {
        metafilePath: "/bags/file.meta",
        downloadDir: "/bags",
      }).args.at(-1),
    ).toBe("add-by-meta /bags/file.meta -d /bags");
  });

  it("builds the documented download control commands", () => {
    expect(buildDownloadPauseCommand(daemonConfig, { bagId: "BAG123" }).args.at(-1)).toBe(
      "download-pause BAG123",
    );
    expect(
      buildDownloadResumeCommand(daemonConfig, { bagId: "BAG123" }).args.at(-1),
    ).toBe("download-resume BAG123");
  });

  it("builds the documented upload control commands", () => {
    expect(buildUploadPauseCommand(daemonConfig, { bagId: "BAG123" }).args.at(-1)).toBe(
      "upload-pause BAG123",
    );
    expect(buildUploadResumeCommand(daemonConfig, { bagId: "BAG123" }).args.at(-1)).toBe(
      "upload-resume BAG123",
    );
  });

  it("builds the documented remove command", () => {
    expect(buildRemoveCommand(daemonConfig, { bagId: "BAG123" }).args.at(-1)).toBe(
      "remove BAG123",
    );
    expect(
      buildRemoveCommand(daemonConfig, { bagId: "BAG123", removeFiles: true }).args.at(-1),
    ).toBe("remove BAG123 --remove-files");
  });

  it("surfaces priority-name as explicitly unsupported in this service", () => {
    expect(buildUnsupportedPriorityNameCommand()).toEqual({
      command: "storage-daemon-cli",
      args: ["priority-name"],
      commandName: "priority-name",
      supported: false,
      note: "priority-name is documented but not implemented in the current service layer.",
    });
  });
});
