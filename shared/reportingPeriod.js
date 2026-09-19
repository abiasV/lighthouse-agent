const DAY = 86400000;

export const PERIOD_ERRORS = {
  REPORTING_PERIOD_REQUIRED: "Choose a reporting period before building a plan.",
  INVALID_REPORTING_DATE: "Enter a valid reporting date (YYYY-MM-DD).",
  INVALID_REPORTING_TIME_ZONE: "Choose the time zone used by your source report.",
  INVALID_REPORTING_RANGE: "The reporting end date must be on or after its start date.",
  INCOMPLETE_REPORTING_PERIOD: "Use completed days only. The reporting period must end before today in the selected time zone.",
  REPORTING_PERIOD_CONFIRMATION_REQUIRED: "Confirm that views, sales, and trend use the displayed reporting periods and time zone.",
  INVALID_ETSY_REPORTING_PERIOD: "The Etsy reporting windows must be consecutive, equal-length, complete UTC days.",
  SELLER_PERIOD_MISMATCH: "The traffic dates and time zone must match the sales reporting period. Reload the data and enter traffic for the displayed period.",
  SELLER_PERIOD_CONFIRMATION_REQUIRED: "Confirm that your traffic number belongs to the displayed period and time zone.",
};

function dateNumber(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("INVALID_REPORTING_DATE");
  }
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) {
    throw new Error("INVALID_REPORTING_DATE");
  }
  return ms;
}

export function shiftDate(value, days) {
  return new Date(dateNumber(value) + days * DAY).toISOString().slice(0, 10);
}

export function todayInTimeZone(timeZone, now = new Date()) {
  try {
    if (typeof timeZone !== "string" || !timeZone.trim()) throw new Error();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const part = (type) => parts.find((p) => p.type === type).value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    throw new Error("INVALID_REPORTING_TIME_ZONE");
  }
}

// Calendar dates belong to the named source zone; they are not UTC timestamps.
export function normalizeReportingPeriod(period, now = new Date()) {
  if (!period || typeof period !== "object") throw new Error("REPORTING_PERIOD_REQUIRED");
  const { startDate, endDate, timeZone } = period;
  const start = dateNumber(startDate);
  const end = dateNumber(endDate);
  const today = todayInTimeZone(timeZone, now);
  if (end < start) throw new Error("INVALID_REPORTING_RANGE");
  if (endDate >= today) throw new Error("INCOMPLETE_REPORTING_PERIOD");
  const days = (end - start) / DAY + 1;
  return {
    startDate, endDate, timeZone, days,
    previousStartDate: shiftDate(startDate, -days),
    previousEndDate: shiftDate(startDate, -1),
  };
}

export function defaultReportingPeriod(timeZone = "UTC", now = new Date()) {
  const today = todayInTimeZone(timeZone, now);
  return normalizeReportingPeriod({
    startDate: shiftDate(today, -30), endDate: shiftDate(today, -1), timeZone,
  }, now);
}

// The current Etsy adapter aggregates UTC days only. Do not silently relabel
// these instants as a different reporting zone.
export function validateEtsyReportingPeriod(period, now = new Date()) {
  const fields = ["currentStart", "currentEndExclusive", "previousStart", "previousEndExclusive"];
  if (!period || period.timeZone !== "UTC" || !Number.isInteger(period.days) || period.days <= 0) {
    throw new Error("INVALID_ETSY_REPORTING_PERIOD");
  }
  for (const field of fields) {
    const value = period[field];
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(value)) {
      throw new Error("INVALID_ETSY_REPORTING_PERIOD");
    }
    dateNumber(value.slice(0, 10));
  }
  const { currentStart: start, currentEndExclusive: end, previousStart: previous, previousEndExclusive } = period;
  if (previousEndExclusive !== start || Date.parse(end) - Date.parse(start) !== period.days * DAY ||
      Date.parse(start) - Date.parse(previous) !== period.days * DAY) {
    throw new Error("INVALID_ETSY_REPORTING_PERIOD");
  }
  return normalizeReportingPeriod({
    startDate: start.slice(0, 10),
    endDate: shiftDate(end.slice(0, 10), -1),
    timeZone: "UTC",
  }, now);
}

export function assertSellerPeriod(snapshotPeriod, input) {
  if (!input?.period || ["currentStart", "currentEndExclusive", "timeZone"].some(
    (key) => input.period[key] !== snapshotPeriod[key],
  )) throw new Error("SELLER_PERIOD_MISMATCH");
  if (input.periodConfirmed !== true) throw new Error("SELLER_PERIOD_CONFIRMATION_REQUIRED");
}
