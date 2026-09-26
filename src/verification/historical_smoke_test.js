import process from 'node:process';
import {
  HISTORICAL_LOCATION,
  HISTORICAL_MODEL_IDS,
  buildVerificationPairs,
  fetchHistoricalForecast,
  fetchReferenceData,
} from './historical.js';

function utcDateDaysAgo(daysAgo) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function main() {
  const startDate = utcDateDaysAgo(7);
  const endDate = startDate;
  const leadTimes = [24, 48];
  const modelIds = Object.values(HISTORICAL_MODEL_IDS);
  const configuration = {
    location: 'Delhi',
    latitude: HISTORICAL_LOCATION.latitude,
    longitude: HISTORICAL_LOCATION.longitude,
    variable: 'temperature_2m',
    start_date: startDate,
    end_date: endDate,
    lead_times_hours: leadTimes,
    models: modelIds,
    reference: 'ERA5',
  };
  console.log('VARUNA real historical-data smoke test');
  console.log(JSON.stringify(configuration, null, 2));

  let totalExactPairs = 0;
  const perModelResults = [];
  for (const modelId of modelIds) {
    const forecastResult = await fetchHistoricalForecast({
      modelId,
      latitude: configuration.latitude,
      longitude: configuration.longitude,
      startDate,
      endDate,
      leadTimes,
    });
    const forecastResolvedLocation = forecastResult.resolved_location;
    const referenceResult = await fetchReferenceData({
      latitude: forecastResolvedLocation.latitude,
      longitude: forecastResolvedLocation.longitude,
      startDate,
      endDate,
    });
    const pairing = buildVerificationPairs({
      forecasts: forecastResult.records,
      references: referenceResult.records,
    });
    const modelLabel = forecastResult.model;
    totalExactPairs += pairing.diagnostics.matched_count;
    perModelResults.push({ modelId, forecastResult, referenceResult, pairing });

    console.log(`\n${modelLabel}`);
    console.log(`requested coordinates: ${JSON.stringify(forecastResult.requested_location)}`);
    console.log(`resolved coordinates: ${JSON.stringify(forecastResolvedLocation)}`);
    console.log(`ERA5 requested coordinates: ${JSON.stringify(referenceResult.requested_location)}`);
    console.log(`ERA5 resolved coordinates: ${JSON.stringify(referenceResult.resolved_location)}`);
    console.log(`forecast records: ${forecastResult.records.length}`);
    console.log(`reference records: ${referenceResult.records.length}`);
    console.log(`exact pairs: ${pairing.diagnostics.matched_count}`);
    console.log(`unmatched forecasts: ${pairing.diagnostics.unmatched_forecasts.length}`);
    console.log(`unmatched references: ${pairing.diagnostics.unmatched_references.length}`);

    const rejectionReasons = [...new Set(forecastResult.rejected_records.map((record) => record.reason))];
    if (rejectionReasons.length > 0) {
      console.log(`rejected forecast rows: ${forecastResult.rejected_records.length} (${rejectionReasons.join('; ')})`);
    }
    if (pairing.diagnostics.matched_count === 0) {
      if (forecastResult.records.length > 0 &&
          (forecastResolvedLocation.latitude !== referenceResult.resolved_location.latitude ||
           forecastResolvedLocation.longitude !== referenceResult.resolved_location.longitude)) {
        console.log('unmatched reason: forecast and ERA5 resolved coordinates differ; exact-location policy retained');
      } else if (rejectionReasons.length > 0) {
        console.log(`unmatched reason: ${rejectionReasons.join('; ')}`);
      } else {
        const reasons = [...new Set([
          ...pairing.diagnostics.unmatched_forecasts.map((record) => record.reason),
          ...pairing.diagnostics.unmatched_references.map((record) => record.reason),
        ])];
        console.log(`unmatched reason: ${reasons.join('; ') || 'no exact forecast/reference match'}`);
      }
    }
  }

  console.log(`\nTotal normalized forecasts: ${perModelResults.reduce((sum, item) => sum + item.forecastResult.records.length, 0)}`);
  console.log(`Total ERA5 reference records across model-specific requests: ${perModelResults.reduce((sum, item) => sum + item.referenceResult.records.length, 0)}`);
  console.log(`Total exact matched pairs: ${totalExactPairs}`);
  if (totalExactPairs === 0) throw new Error('No exact forecast/reference pairs were produced for any model.');
}

main().catch((error) => {
  console.error('HISTORICAL SMOKE TEST FAILED');
  console.error(error.message);
  if (error.details) console.error(JSON.stringify(error.details, null, 2));
  process.exitCode = 1;
});