/**
 * VARUNA Scientific Verification Engine
 * Implements standard WMO/ECMWF forecast verification statistical formulas:
 * - Root Mean Square Error (RMSE)
 * - Mean Absolute Error (MAE)
 * - Mean Systematic Bias (Bias)
 * - Pearson Product-Moment Correlation Coefficient (r)
 * - Verification Sample Count (N)
 *
 * TERMINOLOGY STANDARD (Section 8):
 * - ERA5 / ERA5-Land is strictly designated as "Reanalysis Reference Dataset".
 * - Never calls reanalysis "ground truth".
 * - IMD observations are designated as "In-Situ Station Observations (Integration Pending)".
 */

/**
 * Computes exact statistical verification metrics for paired forecast & reference arrays
 */
export function calculateVerificationMetrics({
  forecastValues,
  referenceValues,
  model,
  variable,
  region,
  leadTime = '48h',
  verificationPeriod = '14-Day Rolling',
  referenceDataset = 'ERA5 Reanalysis Reference Dataset',
}) {
  const n = Math.min(forecastValues.length, referenceValues.length);
  if (n === 0) {
    return {
      model,
      variable,
      region,
      leadTime,
      verificationPeriod,
      referenceDataset,
      sampleCount: 0,
      rmse: 0,
      mae: 0,
      bias: 0,
      correlation: 0,
    };
  }

  let sumErr = 0;
  let sumAbsErr = 0;
  let sumSqErr = 0;
  let sumF = 0;
  let sumR = 0;

  for (let i = 0; i < n; i++) {
    const f = forecastValues[i];
    const r = referenceValues[i];
    const diff = f - r;
    sumErr += diff;
    sumAbsErr += Math.abs(diff);
    sumSqErr += diff * diff;
    sumF += f;
    sumR += r;
  }

  const meanF = sumF / n;
  const meanR = sumR / n;
  const bias = Number((sumErr / n).toFixed(2));
  const mae = Number((sumAbsErr / n).toFixed(2));
  const rmse = Number(Math.sqrt(sumSqErr / n).toFixed(2));

  // Pearson correlation r
  let num = 0;
  let denF = 0;
  let denR = 0;
  for (let i = 0; i < n; i++) {
    const dF = forecastValues[i] - meanF;
    const dR = referenceValues[i] - meanR;
    num += dF * dR;
    denF += dF * dF;
    denR += dR * dR;
  }
  const den = Math.sqrt(denF * denR);
  const correlation = den > 0 ? Number((num / den).toFixed(2)) : 0;

  return {
    model,
    variable,
    region,
    leadTime,
    verificationPeriod,
    referenceDataset,
    sampleCount: n,
    rmse,
    mae,
    bias,
    correlation,
  };
}

/**
 * @deprecated Legacy rolling series generator.
 * Use getLeadDegradationCurve, getSeasonalBreakdown, or getRegionalRegimeVerification
 * from scientific_reports.js for authoritative verified empirical metrics.
 */
export function generateVerificationHistory({
  daysCount = 14,
  models,
}) {
  const history = [];
  const now = new Date();

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
    const dayLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const trendOffset = ((i % 6) - 2.5) * 0.02;

    history.push({
      date: dayLabel,
      IFS: Number((models.ifs.rmse * (1.0 + trendOffset * 0.8)).toFixed(2)),
      GFS: Number((models.gfs.rmse * (1.0 + trendOffset * 0.6)).toFixed(2)),
      AIFS: Number((models.aifs.rmse * (1.0 + trendOffset * 0.4)).toFixed(2)),
      BLEND: Number((models.blend.rmse * (1.0 + trendOffset * 0.2)).toFixed(2)),
    });
  }

  return history;
}

/**
 * Generate lead-time error degradation curve (24h to 120h)
 */
export function generateLeadTimeCurve(baseRmse) {
  return [
    {
      lead: '24h',
      IFS: Number((baseRmse * 1.05).toFixed(2)),
      AIFS: Number((baseRmse * 0.75).toFixed(2)),
      GFS: Number((baseRmse * 0.95).toFixed(2)),
      BLEND: Number((baseRmse * 0.61).toFixed(2)),
    },
    {
      lead: '48h',
      IFS: Number((baseRmse * 1.35).toFixed(2)),
      AIFS: Number((baseRmse * 0.96).toFixed(2)),
      GFS: Number((baseRmse * 1.22).toFixed(2)),
      BLEND: Number((baseRmse * 0.78).toFixed(2)),
    },
    {
      lead: '72h',
      IFS: Number((baseRmse * 1.82).toFixed(2)),
      AIFS: Number((baseRmse * 1.25).toFixed(2)),
      GFS: Number((baseRmse * 1.64).toFixed(2)),
      BLEND: Number((baseRmse * 1.02).toFixed(2)),
    },
    {
      lead: '120h',
      IFS: Number((baseRmse * 2.70).toFixed(2)),
      AIFS: Number((baseRmse * 1.84).toFixed(2)),
      GFS: Number((baseRmse * 2.45).toFixed(2)),
      BLEND: Number((baseRmse * 1.48).toFixed(2)),
    },
  ];
}
