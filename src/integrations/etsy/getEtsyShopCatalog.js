import etsyApiGet from "./etsyApiClient.js";

export const MAX_CATALOG_LISTINGS = 500;

function positiveId(value) {
  const id = String(value ?? "");
  if (!/^[1-9]\d*$/.test(id)) throw new Error("ETSY_CATALOG_INVALID");
  return id;
}

// Only identifiers and titles leave this adapter. Lifetime views/sales are
// deliberately excluded: they are not reporting-period performance metrics.
export default async function getEtsyShopCatalog({ etsyUserId, apiGet = etsyApiGet, ...credentials }) {
  const userId = positiveId(etsyUserId);
  const signal = AbortSignal.timeout(45000);
  const get = (path, query) => apiGet({
    ...credentials, path, query,
    fetchImpl: (url, options) => fetch(url, { ...options, signal }),
    sleepImpl: async (ms) => {
      if (ms > 5000 || signal.aborted) throw new Error("ETSY_RATE_LIMITED");
      await new Promise(resolve => setTimeout(resolve, ms));
    },
  });
  let shop;
  try {
    shop = await get(`/application/users/${userId}/shops`);
  } catch (error) {
    if (error.status === 404) throw new Error("ETSY_SHOP_NOT_FOUND");
    throw error;
  }
  const shopId = positiveId(shop?.shop_id);
  if (positiveId(shop?.user_id) !== userId || typeof shop.shop_name !== "string" || !shop.shop_name.trim()) {
    throw new Error("ETSY_CATALOG_INVALID");
  }

  const listings = [];
  const ids = new Set();
  let expectedCount;
  do {
    const page = await get(`/application/shops/${shopId}/listings/active`, {
      limit: 100, offset: listings.length, sort_on: "created", sort_order: "asc",
    });
    if (!Number.isInteger(page?.count) || page.count < 0 || !Array.isArray(page.results) || page.results.length > 100) {
      throw new Error("ETSY_CATALOG_INVALID");
    }
    if (page.count > MAX_CATALOG_LISTINGS) throw new Error("ETSY_CATALOG_TOO_LARGE");
    if (expectedCount !== undefined && page.count !== expectedCount) throw new Error("ETSY_CATALOG_CHANGED");
    expectedCount = page.count;
    for (const listing of page.results) {
      const id = positiveId(listing.listing_id);
      if (ids.has(id) || positiveId(listing.shop_id) !== shopId || listing.state !== "active" ||
          typeof listing.title !== "string" || !listing.title.trim()) {
        throw new Error("ETSY_CATALOG_INVALID");
      }
      ids.add(id);
      listings.push({ id, title: listing.title.trim() });
    }
    if (listings.length > expectedCount || (listings.length < expectedCount && page.results.length === 0)) {
      throw new Error("ETSY_CATALOG_CHANGED");
    }
  } while (listings.length < expectedCount);

  return { source: "ETSY", shopId, shopName: shop.shop_name.trim(), listings };
}
