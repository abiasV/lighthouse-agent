import test from "node:test";
import assert from "node:assert/strict";
import getEtsyShopCatalog from "../src/integrations/etsy/getEtsyShopCatalog.js";
import { catalogToManualDraft, requestEtsyCatalog } from "../client/src/utils/etsyCatalog.js";

const shop = { shop_id: 22, user_id: 11, shop_name: "Real Shop", email: "private" };
const listing = id => ({ listing_id: id, shop_id: 22, state: "active", title: `Product ${id}`, views: 9000, num_favorers: 90 });
const read = apiGet => getEtsyShopCatalog({ etsyUserId: "11", connectionId: "owned", apiGet });

test("catalog follows pagination, uses owned identity and excludes lifetime metrics and private fields", async () => {
  const calls = [];
  const result = await read(async args => {
    calls.push(args);
    assert.equal(args.connectionId, "owned");
    if (args.path === "/application/users/11/shops") return shop;
    assert.equal(args.path, "/application/shops/22/listings/active");
    return { count: 101, results: args.query.offset === 0
      ? Array.from({ length: 100 }, (_, i) => listing(i + 1)) : [listing(101)] };
  });
  assert.deepEqual(calls.slice(1).map(c => c.query.offset), [0, 100]);
  assert.deepEqual(result.listings[0], { id: "1", title: "Product 1" });
  assert.deepEqual(Object.keys(result).sort(), ["listings", "shopId", "shopName", "source"]);
  const draft = catalogToManualDraft(result);
  assert.deepEqual(draft.listings[0], { id: "1", title: "Product 1", views: "", sales: "", trendPercent: "" });
});

test("catalog handles no active listings without inventing products", async () => {
  const result = await read(async args => args.query ? { count: 0, results: [] } : shop);
  assert.deepEqual(result.listings, []);
  assert.throws(() => catalogToManualDraft(result), /No active listings/);
});

for (const [name, page, code] of [
  ["oversized shops", { count: 501, results: [] }, "ETSY_CATALOG_TOO_LARGE"],
  ["missing pages", { count: 2, results: [] }, "ETSY_CATALOG_CHANGED"],
  ["duplicate IDs", { count: 2, results: [listing(1), listing(1)] }, "ETSY_CATALOG_INVALID"],
  ["foreign shop", { count: 1, results: [{ ...listing(1), shop_id: 99 }] }, "ETSY_CATALOG_INVALID"],
  ["missing titles", { count: 1, results: [{ ...listing(1), title: "" }] }, "ETSY_CATALOG_INVALID"],
  ["malformed response", {}, "ETSY_CATALOG_INVALID"],
]) {
  test(`catalog fails closed for ${name}`, async () => {
    await assert.rejects(read(async args => args.query ? page : shop), new RegExp(code));
  });
}

test("catalog rejects foreign ownership and invalid stored user IDs", async () => {
  await assert.rejects(read(async () => ({ ...shop, user_id: 12 })), /ETSY_CATALOG_INVALID/);
  await assert.rejects(getEtsyShopCatalog({ etsyUserId: "../12", apiGet: () => assert.fail() }), /ETSY_CATALOG_INVALID/);
});

test("catalog maps a missing shop and propagates provider failures without returning partial data", async () => {
  await assert.rejects(read(async () => { throw Object.assign(new Error("ETSY_API_REQUEST_FAILED"), { status: 404 }); }), /ETSY_SHOP_NOT_FOUND/);
  await assert.rejects(read(async args => {
    if (!args.query) return shop;
    if (!args.query.offset) return { count: 2, results: [listing(1)] };
    throw new Error("ETSY_RATE_LIMITED");
  }), /ETSY_RATE_LIMITED/);
  await assert.rejects(read(async args => !args.query ? shop : args.query.offset
    ? { count: 3, results: [listing(2)] } : { count: 2, results: [listing(1)] }), /ETSY_CATALOG_CHANGED/);
});

test("client import uses same-origin cookie and only blank performance fields", async () => {
  const result = await requestEtsyCatalog({ fetchImpl: async (path, options) => {
    assert.equal(path, "/api/etsy/shop/catalog");
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.cache, "no-store");
    return Response.json({ source: "ETSY", shopName: "Shop", listings: [{ id: "1", title: "Title", sales: 123, views: 456 }] });
  }});
  assert.equal(result.listings[0].sales, "");
  assert.equal(result.listings[0].views, "");
  await assert.rejects(requestEtsyCatalog({ fetchImpl: async () => Response.json({ error: "ETSY_SHOP_NOT_FOUND", message: "secret" }, { status: 404 }) }), /This account has no Etsy shop/);
  await assert.rejects(requestEtsyCatalog({ fetchImpl: async () => new Response("<html>offline</html>") }), /Could not read/);
});
