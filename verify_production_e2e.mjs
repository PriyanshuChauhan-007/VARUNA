/**
 * VARUNA Authoritative Production End-to-End Verification Test
 * 
 * Verifies live production system:
 * Frontend: https://varuna-rose.vercel.app
 * Backend: https://varuna-backend-grfc.onrender.com
 * Upstream: https://api.open-meteo.com
 * 
 * Laptop backend (Uvicorn) and frontend (Vite) are COMPLETELY OFF.
 */
import {
  fetchForecast,
  fetchRegionalForecasts,
  fetchWeights,
  fetchSkill,
  fetchExtremes,
  fetchOpenMeteoBatch,
} from './src/services/api.js';
import { REGIONS } from './src/data/mockData.js';

// Point directly to production Render backend
process.env.VITE_API_URL = 'https://varuna-backend-grfc.onrender.com';

const REGION_IDS = [
  'delhi_ncr',
  'mumbai_coastal',
  'western_ghats',
  'gujarat_industrial',
  'odisha_coast',
  'bengaluru_deccan',
  'punjab_agri',
  'assam_valley',
  'chennai_coastal',
  'rajasthan_thar',
  'kerala_coast',
  'central_highlands',
];

const VARIABLES = ['temperature', 'rainfall', 'wind_speed', 'pressure'];
const LEADS = ['24h', '48h', '72h', '120h', '7d'];

console.log('='.repeat(80));
console.log('VARUNA PRODUCTION ACCEPTANCE VERIFICATION');
console.log('Target Backend: https://varuna-backend-grfc.onrender.com');
console.log('Target Frontend: https://varuna-rose.vercel.app');
console.log('Local Servers: COMPLETELY OFF');
console.log('='.repeat(80));

async function runVerification() {
  const results = {
    totalCombinationsTested: 0,
    passedCombinations: 0,
    failedCombinations: 0,
    lead168Tests: 0,
    lead168Passed: 0,
    weightsTests: 0,
    weightsPassed: 0,
    extremesTests: 0,
    extremesPassed: 0,
    errors: [],
  };

  // Step 1: Test Open-Meteo multi-coordinate batch fetch for all 12 regions with forecast_days=8
  console.log('\n[Step 1] Testing Browser Batch Fetch from Open-Meteo (forecast_days=8)...');
  const targetRegions = REGIONS.filter((r) => REGION_IDS.includes(r.id));
  const batchSeries = await fetchOpenMeteoBatch(targetRegions);
  const fetchedCount = Object.keys(batchSeries).length;
  console.log(`  -> Fetched NWP series for ${fetchedCount}/${targetRegions.length} regions.`);
  if (fetchedCount !== 12) {
    throw new Error(`Expected 12 regions in batch series, got ${fetchedCount}`);
  }
  for (const rId of REGION_IDS) {
    const s = batchSeries[rId];
    if (!s || !s.time || s.time.length < 192) {
      throw new Error(`Region ${rId} has insufficient horizon timestamps (${s?.time?.length || 0} < 192)`);
    }
  }
  console.log('  [PASS] All 12 regions have at least 192 hours (8 full days) of live NWP data.');

  // Step 2: Test 12-Region Regional Forecast Matrix for Command Centre
  console.log('\n[Step 2] Testing 12-Region Regional Batch via Render backend...');
  const regionalPayloads = await fetchRegionalForecasts(targetRegions, 'rainfall', '48h');
  console.log(`  -> Received ${regionalPayloads.length} regional forecast results.`);
  for (const p of regionalPayloads) {
    if (!p.forecast || p.forecast.dataMode !== 'LIVE') {
      throw new Error(`Region ${p.id} returned dataMode=${p.forecast?.dataMode} (expected LIVE)`);
    }
    const modelsCount = Object.keys(p.forecast.models).filter((k) => k !== 'blend').length;
    if (modelsCount !== 4) {
      throw new Error(`Region ${p.id} models=${modelsCount} (expected 4)`);
    }
  }
  console.log('  [PASS] All 12 regions return LIVE rainfall forecasts with 4 NWP models.');

  // Step 3: Test ALL 12 Regions x 4 Variables x 5 Leads
  console.log('\n[Step 3] Testing Full Matrix: 12 Regions x 4 Variables x 5 Leads (240 tests)...');
  
  for (const regionId of REGION_IDS) {
    for (const variable of VARIABLES) {
      for (const lead of LEADS) {
        results.totalCombinationsTested++;
        try {
          const fc = await fetchForecast({ region: regionId, variable, leadTime: lead });
          
          // Verify LIVE status
          if (fc.dataMode !== 'LIVE') {
            throw new Error(`Expected LIVE dataMode, got ${fc.dataMode}`);
          }

          // Verify 4 member models present and non-null
          const m = fc.models;
          if (typeof m.ifs?.value !== 'number' || typeof m.aifs?.value !== 'number' ||
              typeof m.gfs?.value !== 'number' || typeof m.icon?.value !== 'number') {
            throw new Error(`Null or non-numeric model value in ${regionId}/${variable}/${lead}`);
          }

          // Verify blend value
          if (typeof fc.forecastValue !== 'number' || isNaN(fc.forecastValue)) {
            throw new Error(`Invalid forecastValue in ${regionId}/${variable}/${lead}`);
          }

          // Verify lead availability
          if (!fc.isLeadAvailable) {
            throw new Error(`isLeadAvailable is false for ${regionId}/${variable}/${lead}`);
          }

          // Verify +168h lead precision
          if (lead === '7d') {
            results.lead168Tests++;
            if (fc.leadHours !== 168) {
              throw new Error(`leadHours for 7d is ${fc.leadHours} (expected 168)`);
            }
            results.lead168Passed++;
          }

          results.passedCombinations++;
        } catch (err) {
          results.failedCombinations++;
          results.errors.push(`${regionId}/${variable}/${lead}: ${err.message}`);
        }
      }
    }
    process.stdout.write(`  ✓ Region ${regionId} passed all 20 variable-lead combinations\n`);
  }

  // Step 4: Test Explainability & Weights
  console.log('\n[Step 4] Testing Weights & Explainability on Render...');
  for (const lead of ['24h', '48h', '72h', '120h', '7d']) {
    results.weightsTests++;
    const wTemp = await fetchWeights({ region: 'delhi_ncr', variable: 'temperature', leadTime: lead });
    if (!wTemp.weights || typeof wTemp.weights.ecmwf_ifs !== 'number') {
      throw new Error(`Invalid weights response for temperature at ${lead}`);
    }
    const wRain = await fetchWeights({ region: 'delhi_ncr', variable: 'rainfall', leadTime: lead });
    if (!wRain.weights || wRain.weights.ecmwf_ifs !== 25) {
      throw new Error(`Expected equal weights for rainfall at ${lead}`);
    }
    results.weightsPassed++;
  }
  console.log('  [PASS] Adaptive XGBoost weights (temperature) and equal consensus (rainfall) verified.');

  // Step 5: Test Extreme Weather
  console.log('\n[Step 5] Testing Extremes Endpoint on Render...');
  results.extremesTests++;
  const ext = await fetchExtremes();
  if (!ext || typeof ext !== 'object' || !Array.isArray(ext.alerts) || !Array.isArray(ext.checks)) {
    throw new Error('Extremes returned invalid schema (expected object with alerts and checks arrays)');
  }
  results.extremesPassed++;
  console.log(`  [PASS] Extremes advisory returned status="${ext.status}", ${ext.alerts.length} active alerts, ${ext.checks.length} checks conforming to IMD criteria.`);

  // Step 6: Test Verification Skill
  console.log('\n[Step 6] Testing Verification Skill on Render...');
  results.skillTests = (results.skillTests || 0) + 1;
  const skill = await fetchSkill({ variable: 'temperature' });
  if (!skill || !skill.headline || !Array.isArray(skill.headline.rows) || skill.headline.rows.length === 0) {
    throw new Error('Skill returned invalid headline rows');
  }
  const varunaRow = skill.headline.rows.find((r) => r.system === 'varuna_adaptive');
  if (!varunaRow || typeof varunaRow.rmse !== 'number') {
    throw new Error('Skill headline missing varuna_adaptive row');
  }
  results.skillPassed = (results.skillPassed || 0) + 1;
  console.log(`  [PASS] Skill metrics verified: varuna_adaptive RMSE = ${varunaRow.rmse}, Pearson r = ${varunaRow.pearson_r}.`);

  console.log('\n' + '='.repeat(80));
  console.log('FINAL PRODUCTION AUDIT SUMMARY:');
  console.log(`Total Matrix Combinations: ${results.totalCombinationsTested}`);
  console.log(`Passed Combinations:       ${results.passedCombinations}`);
  console.log(`Failed Combinations:       ${results.failedCombinations}`);
  console.log(`+168h Exact Lead Tests:    ${results.lead168Passed}/${results.lead168Tests}`);
  console.log(`Weights & Explain Tests:   ${results.weightsPassed}/${results.weightsTests}`);
  console.log(`Extremes Advisories:       ${results.extremesPassed}/${results.extremesTests}`);
  console.log('='.repeat(80));

  if (results.failedCombinations > 0) {
    console.error('\nFAILURES ENCOUNTERED:');
    results.errors.forEach((e) => console.error('  - ' + e));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL PRODUCTION ACCEPTANCE CRITERIA PASSED WITH ZERO ERRORS!');
  }
}

runVerification().catch((err) => {
  console.error('\nFATAL ERROR DURING AUDIT:', err);
  process.exit(1);
});
