import etsyApiGet from "./etsyApiClient.js";
import { normalizeReportingPeriod, shiftDate } from "../../../shared/reportingPeriod.js";

const fail = (code = "ETSY_SALES_INVALID") => { throw new Error(code); };
const id = value => {
  if ((typeof value === "number" && !Number.isSafeInteger(value)) || !/^[1-9]\d{0,19}$/.test(String(value ?? ""))) fail();
  return String(value);
};
const seconds = date => Date.parse(`${date}T00:00:00.000Z`) / 1000;

// Read paid units by receipt creation date, not revenue or a lifetime counter.
// Raw receipt/customer fields never leave this adapter or enter AI prompts.
export default async function getEtsyPeriodSales({ etsyUserId, shopId: requestedShopId,
  listingIds, reportingPeriod, apiGet = etsyApiGet, now = new Date(), ...credentials }) {
  const period = normalizeReportingPeriod(reportingPeriod, now);
  if (period.timeZone !== "UTC" || period.days > 90 || period.previousStartDate < "2000-01-01") fail("ETSY_SALES_PERIOD_INVALID");
  if (!Array.isArray(listingIds) || !listingIds.length || listingIds.length > 500) fail("ETSY_SALES_SELECTION_INVALID");
  const selected = listingIds.map(id);
  if (new Set(selected).size !== selected.length) fail("ETSY_SALES_SELECTION_INVALID");
  const userId = id(etsyUserId), shopId = id(requestedShopId);
  const signal = AbortSignal.timeout(45000);
  const get = (path, query) => apiGet({ ...credentials, path, query,
    fetchImpl: (url, options) => fetch(url, { ...options, signal }),
    sleepImpl: async ms => {
      if (signal.aborted || ms > 5000) fail("ETSY_RATE_LIMITED");
      await new Promise(resolve => setTimeout(resolve, ms));
    },
  });
  const shop = await get(`/application/users/${userId}/shops`);
  if (id(shop?.user_id) !== userId || id(shop?.shop_id) !== shopId) fail("ETSY_SALES_SHOP_MISMATCH");
  const start = seconds(period.startDate), previous = seconds(period.previousStartDate);
  const end = seconds(shiftDate(period.endDate, 1));
  const metrics = new Map(selected.map(value => [value, { id: value, current: 0, previous: 0, uncertain: false }]));
  const receiptIds = new Set(), transactionIds = new Set();
  let offset = 0, expected;
  do {
    if (signal.aborted) fail("ETSY_TEMPORARY_ERROR");
    let page;
    try {
      page = await get(`/application/shops/${shopId}/receipts`, {
        min_created: previous, max_created: end - 1, was_paid: true, was_canceled: false,
        limit: 100, offset, sort_on: "receipt_id", sort_order: "asc",
      });
    } catch (error) {
      if (error.status === 403) fail("ETSY_SALES_PERMISSION_REQUIRED");
      throw error;
    }
    if (!Number.isSafeInteger(page?.count) || page.count < 0 || !Array.isArray(page.results) || page.results.length > 100) fail();
    if (page.count > 1000) fail("ETSY_SALES_TOO_LARGE");
    if (expected !== undefined && expected !== page.count) fail("ETSY_SALES_CHANGED");
    expected = page.count;
    for (const receipt of page.results) {
      const receiptId = id(receipt.receipt_id);
      if (receiptIds.has(receiptId) || id(receipt.seller_user_id) !== userId) fail("ETSY_SALES_CHANGED");
      receiptIds.add(receiptId);
      const created = receipt.created_timestamp ?? receipt.create_timestamp;
      if (!Number.isSafeInteger(created) || created < previous || created >= end ||
          typeof receipt.is_paid !== "boolean" || !Array.isArray(receipt.refunds) ||
          !["paid", "completed", "open", "payment processing", "canceled", "fully refunded", "partially refunded"].includes(receipt.status) ||
          ![0, 1, 5].includes(receipt.receipt_type)) fail();
      // Pattern orders, cancelled/unpaid orders and fully refunded receipts are excluded.
      if (receipt.receipt_type === 1 || !receipt.is_paid || ["open", "payment processing", "canceled", "fully refunded"].includes(receipt.status)) continue;
      if (!Array.isArray(receipt.transactions) || !receipt.transactions.length) fail();
      for (const transaction of receipt.transactions) {
        const transactionId = id(transaction.transaction_id);
        if (transactionIds.has(transactionId) || id(transaction.receipt_id) !== receiptId || id(transaction.seller_user_id) !== userId) fail();
        transactionIds.add(transactionId);
        // Deleted/custom listings may have a null listing ID and cannot match a selected active product.
        if (transaction.listing_id === null || transaction.listing_id === 0) continue;
        const listingId = id(transaction.listing_id);
        if (!Number.isSafeInteger(transaction.quantity) || transaction.quantity < 1) fail();
        const metric = metrics.get(listingId);
        if (!metric) continue;
        // Receipt refunds do not identify how many units of each listing were returned.
        // Leave affected listings blank instead of presenting a guessed net quantity.
        if (receipt.refunds.length || receipt.status === "partially refunded") metric.uncertain = true;
        metric[created >= start ? "current" : "previous"] += transaction.quantity;
        if (!Number.isSafeInteger(metric.current) || !Number.isSafeInteger(metric.previous)) fail();
      }
    }
    offset += page.results.length;
    if (offset > expected || (offset < expected && !page.results.length)) fail("ETSY_SALES_CHANGED");
  } while (offset < expected);
  return { source: "ETSY_RECEIPTS", shopId, reportingPeriod: period,
    metric: "PAID_UNITS", viewsAvailability: "UNAVAILABLE",
    listings: [...metrics.values()].map(item => ({ id: item.id,
      sales: item.uncertain ? null : item.current,
      previousSales: item.uncertain ? null : item.previous,
      trendPercent: item.uncertain || item.previous === 0 ? null : Math.round((item.current - item.previous) / item.previous * 10000) / 100,
      needsReview: item.uncertain,
    })),
  };
}
