import { describe, expect, it } from "vitest";
import {
  joinUnitToBytes,
  joinUnitToSeconds,
  nanoTonToTon,
  splitBytesToUnit,
  splitSecondsToUnit,
  tonToNanoTon,
} from "@/src/components/providers/provider-form-units";

describe("provider form unit helpers", () => {
  it("splits bytes into the largest exact binary unit", () => {
    expect(splitBytesToUnit(0)).toEqual({ amount: "0", unit: "B" });
    expect(splitBytesToUnit(1024)).toEqual({ amount: "1", unit: "KB" });
    expect(splitBytesToUnit(1048576)).toEqual({ amount: "1", unit: "MB" });
    expect(splitBytesToUnit(1073741824)).toEqual({ amount: "1", unit: "GB" });
    expect(splitBytesToUnit(123)).toEqual({ amount: "123", unit: "B" });
  });

  it("joins binary size input back to bytes", () => {
    expect(joinUnitToBytes("2", "KB")).toBe(2048);
    expect(joinUnitToBytes("5", "GB")).toBe(5 * 1024 * 1024 * 1024);
    expect(() => joinUnitToBytes("1.5", "MB")).toThrow("Size must be a whole number.");
  });

  it("splits seconds into the largest exact time unit", () => {
    expect(splitSecondsToUnit(60)).toEqual({ amount: "1", unit: "minutes" });
    expect(splitSecondsToUnit(3600)).toEqual({ amount: "1", unit: "hours" });
    expect(splitSecondsToUnit(86400)).toEqual({ amount: "1", unit: "days" });
    expect(splitSecondsToUnit(90)).toEqual({ amount: "90", unit: "seconds" });
  });

  it("joins proof interval input back to seconds", () => {
    expect(joinUnitToSeconds("2", "days")).toBe(172800);
    expect(joinUnitToSeconds("15", "minutes")).toBe(900);
    expect(() => joinUnitToSeconds("0", "seconds")).toThrow(
      "Time between proofs must be a positive integer.",
    );
  });

  it("converts TON strings to nanoTON and back", () => {
    expect(tonToNanoTon("1")).toBe(1_000_000_000);
    expect(tonToNanoTon("0.001")).toBe(1_000_000);
    expect(nanoTonToTon(1_000_000_000)).toBe("1");
    expect(nanoTonToTon(1_500_000_000)).toBe("1.5");
    expect(nanoTonToTon(1_000_000)).toBe("0.001");
    expect(() => tonToNanoTon("1.1234567891")).toThrow(
      "Rate must be a TON amount with up to 9 decimal places.",
    );
  });
});
