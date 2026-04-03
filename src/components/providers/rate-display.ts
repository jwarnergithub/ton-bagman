export const USD_RATE_DISCLAIMER =
  "USD estimate may not be accurate due to market fluctuations.";

function formatUsdAmount(value: number) {
  if (value > 0 && value < 0.00000001) {
    return "<$0.00000001";
  }

  const maximumFractionDigits =
    value >= 1 ? 2 : value >= 0.01 ? 4 : value >= 0.0001 ? 6 : 8;

  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })}`;
}

export function estimateUsdPerMbDay(
  ratePerMbDayTonValue: number,
  tonPriceUsd: number | null,
) {
  if (
    tonPriceUsd === null ||
    !Number.isFinite(tonPriceUsd) ||
    !Number.isFinite(ratePerMbDayTonValue) ||
    ratePerMbDayTonValue < 0
  ) {
    return {
      ratePerMbDayUsdValue: null,
      ratePerMbDayUsd: null,
    };
  }

  const ratePerMbDayUsdValue = Number((ratePerMbDayTonValue * tonPriceUsd).toPrecision(12));

  return {
    ratePerMbDayUsdValue,
    ratePerMbDayUsd: `${formatUsdAmount(ratePerMbDayUsdValue)} USD / MB / day`,
  };
}
