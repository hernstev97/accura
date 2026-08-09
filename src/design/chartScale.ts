export type ChartDomain = readonly [number, number];

function niceStep(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const fraction = value / magnitude;
  const normalized = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return normalized * magnitude;
}

export function createPaddedChartDomain(values: readonly number[], paddingRatio = 0.08): ChartDomain {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [0, 1];

  const minimum = Math.min(...finite);
  const maximum = Math.max(...finite);
  const reference = Math.max(Math.abs(minimum), Math.abs(maximum), 1);
  const spread = Math.max(maximum - minimum, reference * 0.2, 1);
  const padding = spread * Math.max(0, paddingRatio);
  const step = niceStep(spread / 5);
  let lower = Math.floor((minimum - padding) / step) * step;
  let upper = Math.ceil((maximum + padding) / step) * step;

  if (minimum >= 0) lower = Math.max(0, lower);
  if (maximum <= 0) upper = Math.min(0, upper);
  if (lower === upper) upper = lower + step;
  return [lower, upper];
}
