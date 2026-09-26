export const LEAD_TIME_TOLERANCE_HOURS = 1 / 3600;

const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/**
 * Parse a strict UTC ISO timestamp. Inputs with invalid calendar dates or offsets
 * are rejected rather than normalized silently.
 * @param {string} timestamp
 * @param {string} fieldName
 * @returns {number} Epoch milliseconds.
 */
export function parseUtcTimestamp(timestamp, fieldName = 'timestamp') {
  if (typeof timestamp !== 'string' || !UTC_TIMESTAMP_PATTERN.test(timestamp)) {
    throw new TypeError(`${fieldName} must be an ISO 8601 UTC timestamp ending in Z`);
  }

  const epochMilliseconds = Date.parse(timestamp);
  const fractionalPart = timestamp.match(/\.(\d{1,3})Z$/)?.[1] || '';
  const normalizedTimestamp = timestamp.replace(/(?:\.\d{1,3})?Z$/, `.${fractionalPart.padEnd(3, '0')}Z`);
  if (!Number.isFinite(epochMilliseconds) || new Date(epochMilliseconds).toISOString() !== normalizedTimestamp) {
    throw new TypeError(`${fieldName} is not a valid UTC timestamp`);
  }
  return epochMilliseconds;
}

/**
 * Derive lead time in hours from the forecast's two timestamps.
 * Valid times earlier than initialization are invalid for a forecast.
 * @param {string} initializationTime
 * @param {string} validTime
 * @returns {number}
 */
export function deriveLeadTimeHours(initializationTime, validTime) {
  const initializationMilliseconds = parseUtcTimestamp(initializationTime, 'initialization_time');
  const validMilliseconds = parseUtcTimestamp(validTime, 'valid_time');
  const leadTimeHours = (validMilliseconds - initializationMilliseconds) / 3_600_000;
  if (leadTimeHours < 0) {
    throw new RangeError('valid_time must be at or after initialization_time');
  }
  return leadTimeHours;
}

/**
 * Verify supplied lead time against the timestamp-derived value.
 * Tolerance is one second (1/3600 hour), accommodating timestamp precision only.
 * @param {{initialization_time: string, valid_time: string, lead_time_hours: number}} record
 * @returns {true}
 */
export function validateLeadTime(record) {
  if (record === null || typeof record !== 'object') {
    throw new TypeError('Forecast record must be an object');
  }
  if (typeof record.lead_time_hours !== 'number' || !Number.isFinite(record.lead_time_hours)) {
    throw new TypeError('lead_time_hours must be a finite number');
  }

  const derivedLeadTimeHours = deriveLeadTimeHours(record.initialization_time, record.valid_time);
  if (Math.abs(record.lead_time_hours - derivedLeadTimeHours) > LEAD_TIME_TOLERANCE_HOURS) {
    throw new RangeError(
      `lead_time_hours (${record.lead_time_hours}) does not agree with timestamp-derived lead (${derivedLeadTimeHours}) within ${LEAD_TIME_TOLERANCE_HOURS} hours`
    );
  }
  return true;
}