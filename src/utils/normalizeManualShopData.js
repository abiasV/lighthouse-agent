import { normalizeReportingPeriod } from "../../shared/reportingPeriod.js";

export default function normalizeManualShopData(data) {
  const reportingPeriod = normalizeReportingPeriod(data.reportingPeriod);
  if (data.periodConfirmed !== true) throw new Error("REPORTING_PERIOD_CONFIRMATION_REQUIRED");
  const listings = data.listings.map((listing) => {
    if (!listing || !String(listing.title ?? "").trim() ||
        !Number.isInteger(listing.views) || listing.views < 0 ||
        !Number.isInteger(listing.sales) || listing.sales < 0 ||
        (listing.trendPercent != null && (!Number.isFinite(listing.trendPercent) || listing.trendPercent < -100))) {
      throw new Error("INVALID_MANUAL_LISTING_METRICS");
    }
    return { ...listing, title: String(listing.title).trim(), trendPercent: listing.trendPercent ?? null };
  });
  return {
    shopName: String(data.shopName).trim(),
    weeklyAvailableMinutes: typeof data.weeklyAvailableMinutes === "number" ? data.weeklyAvailableMinutes : null,
    reportingPeriod,
    listings,
  };
}
