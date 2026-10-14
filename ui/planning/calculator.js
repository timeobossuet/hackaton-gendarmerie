const SHORT_RANGE_SHARE = 0.8;

export function calculateFleetRequirements(areaKm2, coveragePercent, models) {
  const safeArea = Number(areaKm2);
  const safeCoverage = Math.max(50, Math.min(100, Number(coveragePercent) || 80));
  const targetAreaKm2 = Number.isFinite(safeArea) && safeArea > 0
    ? safeArea * (safeCoverage / 100)
    : 0;
  const scenarios = models
    .filter((model) => Number.isFinite(Number(model.maxRange)) && Number(model.maxRange) > 0)
    .map((model) => {
      const coverageAreaKm2 = Math.PI * (Number(model.maxRange) / 1000) ** 2;
      const count = targetAreaKm2 > 0 ? Math.ceil(targetAreaKm2 / coverageAreaKm2) : 0;
      return {
        model,
        count,
        coverageAreaKm2: count * coverageAreaKm2
      };
    });

  const distinctRanges = [...new Set(scenarios.map(({ model }) => Number(model.maxRange)))].sort((a, b) => a - b);
  let mixed = null;
  if (targetAreaKm2 > 0 && distinctRanges.length > 1) {
    const shortScenario = scenarios.find(({ model }) => Number(model.maxRange) === distinctRanges[0]);
    const longRange = distinctRanges[distinctRanges.length - 1];
    const longScenario = scenarios.find(({ model }) => Number(model.maxRange) === longRange);
    const shortCoverage = shortScenario.coverageAreaKm2 / shortScenario.count;
    const longCoverage = longScenario.coverageAreaKm2 / longScenario.count;
    const averageCoverage = SHORT_RANGE_SHARE * shortCoverage + (1 - SHORT_RANGE_SHARE) * longCoverage;
    const roundingMargin = Math.abs(longCoverage - shortCoverage) / 2;
    let total = Math.max(2, Math.floor((targetAreaKm2 - roundingMargin) / averageCoverage));

    while (true) {
      const longCount = Math.max(1, Math.round((1 - SHORT_RANGE_SHARE) * total));
      const shortCount = Math.max(1, total - longCount);
      const coverageAreaKm2 = shortCount * shortCoverage + longCount * longCoverage;
      if (coverageAreaKm2 >= targetAreaKm2) {
        mixed = {
          shortModel: shortScenario.model,
          shortCount,
          longModel: longScenario.model,
          longCount,
          total: shortCount + longCount,
          coverageAreaKm2
        };
        break;
      }
      total += 1;
    }
  }

  return { areaKm2: targetAreaKm2 > 0 ? safeArea : 0, coveragePercent: safeCoverage, targetAreaKm2, scenarios, mixed };
}
