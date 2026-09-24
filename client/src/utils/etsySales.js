import { normalizeReportingPeriod } from "../../../shared/reportingPeriod.js";

export async function requestEtsySales({ shopId, listingIds, reportingPeriod, signal, fetchImpl = fetch }) {
  const period = normalizeReportingPeriod(reportingPeriod);
  const query = new URLSearchParams({ shopId, listingIds: listingIds.join(","), startDate: period.startDate, endDate: period.endDate });
  const response = await fetchImpl(`/api/etsy/shop/sales?${query}`, {
    credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" }, signal,
  });
  let data;
  try { data = await response.json(); } catch { throw new Error("Could not read sales. Your current figures have been kept. Please retry."); }
  if (!response.ok) {
    const messages = {
      ETSY_SALES_NOT_READY: "Automatic sales import is not available yet. Enter sales manually for now.",
      ETSY_SALES_PERMISSION_REQUIRED: "Reconnect Etsy to grant read access to sales, then retry.",
      ETSY_BROWSER_SESSION_REQUIRED: "Reconnect Etsy in this browser before importing sales.",
      ETSY_CONNECTION_NOT_FOUND: "Reconnect Etsy in this browser before importing sales.",
      ETSY_REAUTHORIZATION_REQUIRED: "Your connection expired. Reconnect Etsy and retry.",
      ETSY_SALES_SHOP_MISMATCH: "The connected shop changed. Import its products again.",
      ETSY_SALES_PERIOD_INVALID: "Choose up to 90 completed days to import sales.",
      ETSY_SALES_TOO_LARGE: "More than 1,000 orders were found across both periods. Choose a shorter period or enter sales manually.",
      ETSY_RATE_LIMITED: "Etsy is busy. Try importing sales again later.",
      PILOT_TERMS_REQUIRED: "Accept the pilot terms before importing sales.",
      PILOT_INVITATION_REQUIRED: "Sales import is available to invited Etsy accounts only.",
      PILOT_NOT_READY: "The private pilot is being prepared. You can enter sales manually.",
    };
    throw new Error(messages[data?.error] || "Sales import failed. Your figures have been kept. Retry or enter sales manually.");
  }
  return data;
}

export function mergeEtsySales(listings, data, shopId, period) {
  const invalid = () => { throw new Error("Sales did not match this shop, selection or reporting period. Nothing was imported."); };
  if (data?.source !== "ETSY_RECEIPTS" || data.shopId !== shopId || data.metric !== "PAID_UNITS" ||
      ["startDate", "endDate", "timeZone"].some(key => data.reportingPeriod?.[key] !== period[key]) || !Array.isArray(data.listings)) invalid();
  const expected = new Set(listings.filter(item => item.etsyListingId).map(item => item.id));
  const result = new Map();
  for (const item of data.listings) {
    if (!expected.has(item.id) || result.has(item.id) || typeof item.needsReview !== "boolean") invalid();
    const values = [item.sales, item.previousSales];
    if (item.needsReview ? values.some(value => value !== null) || item.trendPercent !== null
      : values.some(value => !Number.isSafeInteger(value) || value < 0) ||
        (item.trendPercent !== null && (!Number.isFinite(item.trendPercent) || item.trendPercent < -100)) ||
        (item.previousSales === 0 && item.trendPercent !== null)) invalid();
    result.set(item.id, item);
  }
  if (result.size !== expected.size) invalid();
  return listings.map(item => {
    const metric = result.get(item.id);
    // Preserve figures the seller entered, including edits made while a request was in flight.
    if (!metric || (item.salesSource !== "ETSY" && (item.sales !== "" || item.trendPercent !== ""))) return item;
    return { ...item, sales: metric.sales === null ? "" : String(metric.sales),
      trendPercent: metric.trendPercent === null ? "" : String(metric.trendPercent), salesSource: "ETSY", salesNeedsReview: metric.needsReview };
  });
}

export function clearPeriodMetrics(listings) {
  return listings.map(item => ({ ...item, views: "", sales: "", trendPercent: "", salesSource: undefined, salesNeedsReview: false }));
}
