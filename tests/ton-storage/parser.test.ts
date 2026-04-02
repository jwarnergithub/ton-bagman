import { describe, expect, it } from "vitest";
import {
  parseAddByHashOutput,
  parseAddByMetaOutput,
  parseBagDetail,
  parseBagList,
  parseBagPeers,
  parseCreateOutput,
  parseDownloadPauseOutput,
  parseDownloadResumeOutput,
  parseGetMetaOutput,
  parseRemoveOutput,
  parseUploadPauseOutput,
  parseUploadResumeOutput,
} from "../../src/server/ton-storage/parser";

describe("parseBagList", () => {
  it("parses the documented bag list table", () => {
    const output = `
[ 3][t 0][2023-04-21 07:00:13.187545850][storage-daemon-cli.cpp:231][!extclient]        Connected
1 bags
#####        BagID  Description  Downloaded  Total   Download  Upload
    0  951F17615255BE82E12C770143F80856091AA3A80B6E102CEA27616D0EF4FEB1  Test file       66B/66B    66B  COMPLETED    0B/s
`;

    expect(parseBagList(output)).toEqual({
      items: [
        {
          index: 0,
          id: "951F17615255BE82E12C770143F80856091AA3A80B6E102CEA27616D0EF4FEB1",
          description: "Test file",
          downloaded: {
            completed: "66B",
            total: "66B",
          },
          total: "66B",
          downloadRate: "COMPLETED",
          uploadRate: "0B/s",
        },
      ],
      totalBags: 1,
      rawOutput: output,
    });
  });
});

describe("parseBagDetail", () => {
  it("parses bag details and files from labeled output", () => {
    const output = `
BagID = 951F17615255BE82E12C770143F80856091AA3A80B6E102CEA27616D0EF4FEB1
Index = 0
Added: Sun Mar 22 21:18:37 2026
-----------------------------------
Test file
-----------------------------------
Downloaded: 66B/66B (completed)
Dir name: images/
Total size: 66B
Upload speed: 0B/s
1 files:
######  Prior   Ready/Size       Name
     0: (001)    66B/66B    +  test.txt
`;

    expect(parseBagDetail("ignored", output)).toEqual({
      item: {
        id: "951F17615255BE82E12C770143F80856091AA3A80B6E102CEA27616D0EF4FEB1",
        description: "Test file",
        downloaded: {
          completed: "66B",
          total: "66B",
        },
        total: "66B",
        downloadRate: null,
        uploadRate: "0B/s",
        files: [
          {
            index: 0,
            name: "test.txt",
            priority: 1,
            downloaded: {
              completed: "66B",
              total: "66B",
            },
            total: "66B",
          },
        ],
        rawDetails: {
          BagID: "951F17615255BE82E12C770143F80856091AA3A80B6E102CEA27616D0EF4FEB1",
          Index: "0",
          Added: "Sun Mar 22 21:18:37 2026",
          Downloaded: "66B/66B (completed)",
          "Dir name": "images/",
          "Total size": "66B",
          "Upload speed": "0B/s",
        },
      },
      rawOutput: output,
    });
  });

  it("does not treat detail table headers as descriptions", () => {
    const output = `
BagID = 58867386DD9A2A68B3D023D119007AA8829D0C88DFCB9702180994376E123456
Downloaded: 593KB/593KB (completed)
######  Prior   Ready/Size       Name
1 files:
     0: (000)    593KB/593KB    +  image.jpg
`;

    expect(parseBagDetail("ignored", output)).toEqual({
      item: {
        id: "58867386DD9A2A68B3D023D119007AA8829D0C88DFCB9702180994376E123456",
        description: null,
        downloaded: {
          completed: "593KB",
          total: "593KB",
        },
        total: null,
        downloadRate: null,
        uploadRate: null,
        files: [
          {
            index: 0,
            name: "image.jpg",
            priority: 0,
            downloaded: {
              completed: "593KB",
              total: "593KB",
            },
            total: "593KB",
          },
        ],
        rawDetails: {
          BagID: "58867386DD9A2A68B3D023D119007AA8829D0C88DFCB9702180994376E123456",
          Downloaded: "593KB/593KB (completed)",
        },
      },
      rawOutput: output,
    });
  });
});

describe("parseBagPeers", () => {
  it("parses legacy indexed peer rows from tabular output", () => {
    const output = `
Peers:
0  203.0.113.7:3333  UQADNL1  1KB/s  2KB/s  7/7
1  198.51.100.4:3333  UQADNL2  0B/s  4KB/s  6/7
`;

    expect(parseBagPeers("BAG123", output)).toEqual({
      items: [
        {
          address: "203.0.113.7:3333",
          adnl: "UQADNL1",
          uploadRate: "1KB/s",
          downloadRate: "2KB/s",
          readyParts: "7/7",
        },
        {
          address: "198.51.100.4:3333",
          adnl: "UQADNL2",
          uploadRate: "0B/s",
          downloadRate: "4KB/s",
          readyParts: "6/7",
        },
      ],
      rawOutput: output,
    });
  });

  it("parses current ADNL-first peer rows from daemon output", () => {
    const output = `
BagID BFD0EE352C1899CD551B07757CE2578F668BE19E53A38ECC3C59BE50FF954CD0
Download speed: 0B/s
Upload speed: 0B/s
Peers: 1
                                     ADNL id             Address  Download  Upload   Ready
bN49ecE1QNRyD6yuVrkh33ET7chwbfsI/Lp2pUarIv0=  203.0.113.9:3333      0B/s    0B/s  100.0%
`;

    expect(parseBagPeers("BAG123", output)).toEqual({
      items: [
        {
          address: "203.0.113.9:3333",
          adnl: "bN49ecE1QNRyD6yuVrkh33ET7chwbfsI/Lp2pUarIv0=",
          downloadRate: "0B/s",
          uploadRate: "0B/s",
          readyParts: "100.0%",
        },
      ],
      rawOutput: output,
    });
  });
});

describe("mutation output parsers", () => {
  const bagId = "951F17615255BE82E12C770143F80856091AA3A80B6E102CEA27616D0EF4FEB1";

  it("extracts bag IDs for create and add operations", () => {
    expect(parseCreateOutput(`Created bag ${bagId}`)).toEqual({
      action: "create",
      status: "completed",
      bagId,
      rawOutput: `Created bag ${bagId}`,
    });

    expect(parseAddByHashOutput(`Added bag ${bagId}`)).toEqual({
      action: "add-by-hash",
      status: "accepted",
      bagId,
      rawOutput: `Added bag ${bagId}`,
    });

    expect(parseAddByMetaOutput(`Imported metafile for ${bagId}`)).toEqual({
      action: "add-by-meta",
      status: "completed",
      bagId,
      rawOutput: `Imported metafile for ${bagId}`,
    });
  });

  it("returns typed metadata export results", () => {
    expect(parseGetMetaOutput("BAG123", "/tmp/bag.meta", "saved")).toEqual({
      bagId: "BAG123",
      outputPath: "/tmp/bag.meta",
      created: true,
      rawOutput: "saved",
    });
  });

  it("returns typed pause and resume results", () => {
    expect(parseDownloadPauseOutput(`Paused ${bagId}`)).toEqual({
      action: "download-pause",
      status: "accepted",
      bagId,
      rawOutput: `Paused ${bagId}`,
    });
    expect(parseDownloadResumeOutput(`Resumed ${bagId}`)).toEqual({
      action: "download-resume",
      status: "accepted",
      bagId,
      rawOutput: `Resumed ${bagId}`,
    });
    expect(parseUploadPauseOutput(`Upload paused ${bagId}`)).toEqual({
      action: "upload-pause",
      status: "accepted",
      bagId,
      rawOutput: `Upload paused ${bagId}`,
    });
    expect(parseUploadResumeOutput(`Upload resumed ${bagId}`)).toEqual({
      action: "upload-resume",
      status: "accepted",
      bagId,
      rawOutput: `Upload resumed ${bagId}`,
    });
  });

  it("returns typed remove results", () => {
    expect(parseRemoveOutput(bagId, `Removed ${bagId}`)).toEqual({
      action: "remove",
      status: "completed",
      bagId,
      rawOutput: `Removed ${bagId}`,
    });

    expect(parseRemoveOutput(bagId, "Removed")).toEqual({
      action: "remove",
      status: "completed",
      bagId,
      rawOutput: "Removed",
    });
  });
});
