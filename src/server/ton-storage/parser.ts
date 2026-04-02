import type {
  BagDetail,
  BagDetailResult,
  BagFileEntry,
  BagId,
  BagListResult,
  BagMetaExport,
  BagPeer,
  BagPeersResult,
  BagSummary,
  TonMutationResult,
} from "@/src/server/ton-storage/types";

function stripLogPrefix(line: string) {
  if (line.includes("storage-daemon-cli.cpp") || line.trim() === "Connected") {
    return "";
  }

  return line;
}

function normalizeLines(rawOutput: string) {
  return rawOutput
    .split(/\r?\n/)
    .map((line) => stripLogPrefix(line).trimEnd())
    .filter((line) => line.trim().length > 0);
}

function parseTransferSnapshot(value: string | null) {
  if (!value || !value.includes("/")) {
    return null;
  }

  const [completed, total] = value
    .replace(/\s+\(.+\)$/, "")
    .split("/", 2)
    .map((part) => part.trim());

  return {
    completed,
    total,
  };
}

function splitTableLine(line: string) {
  return line.trim().split(/\s{2,}/).filter(Boolean);
}

function parseInteger(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function extractBagId(rawOutput: string) {
  const match = rawOutput.match(/\b[A-Fa-f0-9]{64}\b/);
  return match ? match[0].toUpperCase() : null;
}

function parseBagSummary(line: string): BagSummary | null {
  const columns = splitTableLine(line);

  if (columns.length < 6) {
    return null;
  }

  const [indexToken, id, maybeDescription, maybeDownloaded, maybeTotal, maybeDownload, maybeUpload] =
    columns;
  const hasDescription = columns.length >= 7;
  const description = hasDescription ? maybeDescription : null;
  const downloadedToken = hasDescription ? maybeDownloaded : maybeDescription;
  const totalToken = hasDescription ? maybeTotal : maybeDownloaded;
  const downloadRate = hasDescription ? maybeDownload : maybeTotal;
  const uploadRate = hasDescription ? maybeUpload ?? null : maybeDownload ?? null;

  if (!id) {
    return null;
  }

  return {
    index: parseInteger(indexToken),
    id,
    description,
    downloaded: parseTransferSnapshot(downloadedToken ?? null),
    total: totalToken ?? null,
    downloadRate: downloadRate ?? null,
    uploadRate,
  };
}

function parseBagFile(line: string): BagFileEntry | null {
  const normalizedLine = line.trim();
  const realMatch = normalizedLine.match(
    /^(\d+):\s+\((\d+)\)\s+([0-9A-Za-z./]+\/[0-9A-Za-z./]+)\s+\+\s+(.+)$/,
  );

  if (realMatch) {
    return {
      index: parseInteger(realMatch[1]),
      name: realMatch[4],
      priority: parseInteger(realMatch[2]),
      downloaded: parseTransferSnapshot(realMatch[3]),
      total: parseTransferSnapshot(realMatch[3])?.total ?? null,
    };
  }

  const columns = splitTableLine(normalizedLine);

  if (columns.length < 2) {
    return null;
  }

  if (columns.length === 2) {
    return {
      index: parseInteger(columns[0]),
      name: columns[1],
      priority: null,
      downloaded: null,
      total: null,
    };
  }

  return {
    index: parseInteger(columns[0]),
    name: columns[1],
    priority: parseInteger(columns[2]),
    downloaded: parseTransferSnapshot(columns[3] ?? null),
    total: columns[4] ?? null,
  };
}

export function parseBagList(rawOutput: string): BagListResult {
  const lines = normalizeLines(rawOutput);
  const totalLine = lines.find((line) => /\bbags?\b/i.test(line));
  const totalBags = totalLine ? parseInteger(totalLine.split(" ", 1)[0]) : null;
  const items = lines
    .filter((line) => /^\d+\s+/.test(line.trimStart()))
    .map(parseBagSummary)
    .filter((item): item is BagSummary => item !== null);

  return {
    items,
    totalBags,
    rawOutput,
  };
}

export function parseBagDetail(bagId: BagId, rawOutput: string): BagDetailResult {
  const lines = normalizeLines(rawOutput);
  const rawDetails: Record<string, string> = {};
  const files: BagFileEntry[] = [];
  let inFilesSection = false;
  let description: string | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (/^\d+\s+files:?$/i.test(line) || /^files:?$/i.test(line)) {
      inFilesSection = true;
      continue;
    }

    if (/^-{3,}$/.test(trimmedLine)) {
      continue;
    }

    if (
      !description &&
      trimmedLine &&
      !line.includes(":") &&
      !line.includes("=") &&
      !/^\d+\s+files:?$/i.test(line) &&
      !/^[#\s]+(?:prior|ready\/size|name|bagid|description|downloaded|total)\b/i.test(trimmedLine) &&
      !/^#+$/.test(trimmedLine)
    ) {
      description = trimmedLine;
      continue;
    }

    if (inFilesSection && /^\s*\d+[:\s]/.test(line)) {
      const parsedFile = parseBagFile(line);
      if (parsedFile) {
        files.push(parsedFile);
      }
      continue;
    }

    const labeledMatch = line.match(/^([^:]+):\s*(.+)$/);
    if (labeledMatch) {
      rawDetails[labeledMatch[1].trim()] = labeledMatch[2].trim();
      continue;
    }

    const equalsMatch = line.match(/^([^=]+)=\s*(.+)$/);
    if (equalsMatch) {
      rawDetails[equalsMatch[1].trim()] = equalsMatch[2].trim();
    }
  }

  const parsedId = rawDetails.BagID ?? extractBagId(rawOutput) ?? bagId;
  const detail: BagDetail = {
    id: parsedId,
    description: rawDetails.Description ?? description,
    downloaded: parseTransferSnapshot(rawDetails.Downloaded ?? null),
    total: rawDetails.Total ?? rawDetails["Total size"] ?? null,
    downloadRate: rawDetails.Download ?? rawDetails["Download speed"] ?? null,
    uploadRate: rawDetails.Upload ?? rawDetails["Upload speed"] ?? null,
    files,
    rawDetails,
  };

  return {
    item: detail,
    rawOutput,
  };
}

export function parseBagPeers(_bagId: BagId, rawOutput: string): BagPeersResult {
  const lines = normalizeLines(rawOutput);
  void _bagId;
  const items = lines
    .map((line): BagPeer | null => {
      const columns = splitTableLine(line);

      if (columns.length < 5) {
        return null;
      }

      if (/^\d+$/.test(columns[0] ?? "")) {
        return {
          address: columns[1] ?? "",
          adnl: columns[2] ?? null,
          uploadRate: columns[3] ?? null,
          downloadRate: columns[4] ?? null,
          readyParts: columns[5] ?? null,
        };
      }

      if (!columns[1]?.includes(":")) {
        return null;
      }

      return {
        address: columns[1] ?? "",
        adnl: columns[0] ?? null,
        downloadRate: columns[2] ?? null,
        uploadRate: columns[3] ?? null,
        readyParts: columns[4] ?? null,
      };
    })
    .filter((item): item is BagPeer => item !== null && item.address.length > 0);

  return {
    items,
    rawOutput,
  };
}

export function parseCreateOutput(rawOutput: string): TonMutationResult {
  return {
    action: "create",
    status: extractBagId(rawOutput) ? "completed" : "accepted",
    bagId: extractBagId(rawOutput),
    rawOutput,
  };
}

export function parseAddByHashOutput(rawOutput: string): TonMutationResult {
  return {
    action: "add-by-hash",
    status: "accepted",
    bagId: extractBagId(rawOutput),
    rawOutput,
  };
}

export function parseAddByMetaOutput(rawOutput: string): TonMutationResult {
  return {
    action: "add-by-meta",
    status: extractBagId(rawOutput) ? "completed" : "accepted",
    bagId: extractBagId(rawOutput),
    rawOutput,
  };
}

export function parseGetMetaOutput(
  bagId: string,
  outputPath: string,
  rawOutput: string,
): BagMetaExport {
  return {
    bagId,
    outputPath,
    created: !/\berror\b/i.test(rawOutput),
    rawOutput,
  };
}

export function parseDownloadPauseOutput(rawOutput: string): TonMutationResult {
  return {
    action: "download-pause",
    status: "accepted",
    bagId: extractBagId(rawOutput),
    rawOutput,
  };
}

export function parseDownloadResumeOutput(rawOutput: string): TonMutationResult {
  return {
    action: "download-resume",
    status: "accepted",
    bagId: extractBagId(rawOutput),
    rawOutput,
  };
}

export function parseUploadPauseOutput(rawOutput: string): TonMutationResult {
  return {
    action: "upload-pause",
    status: "accepted",
    bagId: extractBagId(rawOutput),
    rawOutput,
  };
}

export function parseUploadResumeOutput(rawOutput: string): TonMutationResult {
  return {
    action: "upload-resume",
    status: "accepted",
    bagId: extractBagId(rawOutput),
    rawOutput,
  };
}

export function parseRemoveOutput(
  bagId: string,
  rawOutput: string,
): TonMutationResult {
  return {
    action: "remove",
    status: "completed",
    bagId: extractBagId(rawOutput) ?? bagId,
    rawOutput,
  };
}
