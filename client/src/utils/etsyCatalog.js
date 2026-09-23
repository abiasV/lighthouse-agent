export function catalogToManualDraft(catalog) {
  if (catalog?.source !== "ETSY" || typeof catalog.shopName !== "string" ||
      !catalog.shopName.trim() || !Array.isArray(catalog.listings)) {
    throw new Error("Lighthouse received invalid shop data. Please try again.");
  }
  if (!catalog.listings.length) throw new Error("No active listings were found. Existing form data has been kept. You can enter listings manually.");
  const ids = new Set();
  const listings = catalog.listings.map(listing => {
    const id = String(listing.id ?? "");
    if (!/^[1-9]\d*$/.test(id) || ids.has(id) || typeof listing.title !== "string" || !listing.title.trim()) {
      throw new Error("Lighthouse received invalid listing data. Please try again.");
    }
    ids.add(id);
    return { id, title: listing.title.trim(), views: "", sales: "", trendPercent: "" };
  });
  return { shopName: catalog.shopName.trim(), listings };
}

export function selectCatalogListings(draft, selectedIds) {
  const selected = new Set(selectedIds);
  const known = new Set(draft.listings.map(listing => listing.id));
  if (!selected.size || selectedIds.length !== selected.size || [...selected].some(id => !known.has(id))) {
    throw new Error("Choose at least one product from this shop before importing.");
  }
  return { ...draft, listings: draft.listings.filter(listing => selected.has(listing.id)).map(listing => ({ ...listing })) };
}

export async function requestEtsyCatalog({ signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl("/api/etsy/shop/catalog", {
    credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" }, signal,
  });
  let data;
  try { data = await response.json(); } catch {
    throw new Error("Could not read the import response. Please try again.");
  }
  if (!response.ok) {
    const messages = {
      PILOT_TERMS_REQUIRED: "Read and accept the pilot terms below before importing.",
      PILOT_INVITATION_REQUIRED: "Import is available only to approved Etsy accounts during the private pilot.",
      PILOT_NOT_READY: "The private pilot is still being prepared. Your current form data has been kept.",
      PILOT_ACCESS_UNAVAILABLE: "Your pilot access could not be checked. Please try again later.",
      ETSY_BROWSER_SESSION_REQUIRED: "Please reconnect Etsy in this browser.",
      ETSY_CONNECTION_NOT_FOUND: "Please reconnect Etsy in this browser.",
      ETSY_REAUTHORIZATION_REQUIRED: "Your connection expired. Please reconnect Etsy.",
      ETSY_SHOP_NOT_FOUND: "This account has no Etsy shop. Connect your shop owner's account.",
      ETSY_RATE_LIMITED: "Etsy is busy. Please try again later.",
      ETSY_CATALOG_TOO_LARGE: "Import supports up to 500 active listings. Use manual entry for selected listings.",
      ETSY_CATALOG_CHANGED: "Your listing collection changed during import. Please try again.",
    };
    const error = new Error(messages[data?.error] ?? "Could not import Etsy listings. Please retry or use manual entry.");
    error.code = data?.error;
    throw error;
  }
  return catalogToManualDraft(data);
}
