export type BinarySizeUnit = "B" | "KB" | "MB" | "GB";
export type ProofIntervalUnit = "seconds" | "minutes" | "hours" | "days";

const SIZE_FACTORS: Record<BinarySizeUnit, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
};

const INTERVAL_FACTORS: Record<ProofIntervalUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 60 * 60,
  days: 60 * 60 * 24,
};

export function splitBytesToUnit(value: number) {
  if (value <= 0) {
    return { amount: "0", unit: "B" as const };
  }

  if (value % SIZE_FACTORS.GB === 0) {
    return { amount: String(value / SIZE_FACTORS.GB), unit: "GB" as const };
  }

  if (value % SIZE_FACTORS.MB === 0) {
    return { amount: String(value / SIZE_FACTORS.MB), unit: "MB" as const };
  }

  if (value % SIZE_FACTORS.KB === 0) {
    return { amount: String(value / SIZE_FACTORS.KB), unit: "KB" as const };
  }

  return { amount: String(value), unit: "B" as const };
}

export function joinUnitToBytes(amount: string, unit: BinarySizeUnit) {
  const normalized = amount.trim();

  if (!/^\d+$/.test(normalized)) {
    throw new Error("Size must be a whole number.");
  }

  const parsed = Number(normalized);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Size must be a safe non-negative integer.");
  }

  const bytes = parsed * SIZE_FACTORS[unit];

  if (!Number.isSafeInteger(bytes)) {
    throw new Error("Size is too large.");
  }

  return bytes;
}

export function splitSecondsToUnit(value: number) {
  if (value <= 0) {
    return { amount: "0", unit: "seconds" as const };
  }

  if (value % INTERVAL_FACTORS.days === 0) {
    return { amount: String(value / INTERVAL_FACTORS.days), unit: "days" as const };
  }

  if (value % INTERVAL_FACTORS.hours === 0) {
    return { amount: String(value / INTERVAL_FACTORS.hours), unit: "hours" as const };
  }

  if (value % INTERVAL_FACTORS.minutes === 0) {
    return { amount: String(value / INTERVAL_FACTORS.minutes), unit: "minutes" as const };
  }

  return { amount: String(value), unit: "seconds" as const };
}

export function joinUnitToSeconds(amount: string, unit: ProofIntervalUnit) {
  const normalized = amount.trim();

  if (!/^\d+$/.test(normalized)) {
    throw new Error("Time between proofs must be a whole number.");
  }

  const parsed = Number(normalized);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("Time between proofs must be a positive integer.");
  }

  const seconds = parsed * INTERVAL_FACTORS[unit];

  if (!Number.isSafeInteger(seconds)) {
    throw new Error("Time between proofs is too large.");
  }

  return seconds;
}

export function tonToNanoTon(value: string) {
  const normalized = value.trim();

  if (!/^\d+(\.\d{1,9})?$/.test(normalized)) {
    throw new Error("Rate must be a TON amount with up to 9 decimal places.");
  }

  const [wholePart, fractionPart = ""] = normalized.split(".");
  const fraction = fractionPart.padEnd(9, "0");
  const nano = BigInt(wholePart) * BigInt(1_000_000_000) + BigInt(fraction);

  if (nano < BigInt(0) || nano > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Rate is too large.");
  }

  return Number(nano);
}

export function nanoTonToTon(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Rate must be a safe non-negative integer in nanoTON.");
  }

  const whole = Math.floor(value / 1_000_000_000);
  const fraction = String(value % 1_000_000_000).padStart(9, "0").replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : String(whole);
}
