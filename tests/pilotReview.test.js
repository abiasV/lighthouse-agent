import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import net from "node:net";
import { validatePilotReview } from "../shared/pilotReview.js";
import { defaultReportingPeriod, shiftDate } from "../shared/reportingPeriod.js";
import { generatePilotReview, PILOT_MODEL } from "../src/pilot/generatePilotReview.js";
import { createPilotAccess, isPrivatePilot, pilotUserIds, PILOT_COOKIE } from "../src/pilot/pilotAccess.js";
import { createEtsyBrowserSession } from "../src/integrations/etsy/auth/etsyBrowserSession.js";
import { createPilotRouter } from "../src/routes/pilotRoutes.js";
import shopRoutes from "../src/routes/shopRoutes.js";
import { shopPlans } from "../src/state/sessionStore.js";

const input = { title: "Meal planner PDF", facts: "A printable two-page PDF with a weekly meal plan and shopping list.", problem: "People view it but few buy. Clarify the product value.", views: 700, sales: 5, reportingPeriod: defaultReportingPeriod() };
const origin = "https://lighthouse.example";
const env = { LIGHTHOUSE_PRIVATE_PILOT: "true", LIGHTHOUSE_PILOT_ETSY_USER_IDS: "123,456", ETSY_REDIRECT_URI: origin + "/api/etsy/auth/callback" };

async function serve(t, configure) {
  const app = express(); app.use(express.json()); configure(app);
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test("pilot validates required evidence and bounded input without silently inventing metrics", () => {
  assert.deepEqual(validatePilotReview(input).errors, []);
  for (const change of [{ views: "700" }, { sales: -1 }, { views: 1.5 }, { sales: Number.MAX_SAFE_INTEGER }, { title: "x".repeat(141) }, { facts: "short" }, { facts: "x".repeat(2001) }, { reportingPeriod: null }]) {
    assert.ok(validatePilotReview({ ...input, ...change }).errors.length);
  }
  assert.deepEqual(validatePilotReview({ ...input, accessToken: "must-not-forward", extra: "ignored" }).value, validatePilotReview(input).value);
  assert.equal(validatePilotReview({ ...input, views: 0, sales: 0 }).errors.length, 0);
});

test("pilot configuration fails closed and accepts at most five exact identities", () => {
  assert.equal(isPrivatePilot({}), false);
  assert.equal(isPrivatePilot({ LIGHTHOUSE_PRIVATE_PILOT: "typo" }), true);
  assert.throws(() => pilotUserIds({ ...env, LIGHTHOUSE_PRIVATE_PILOT: "typo" }));
  for (const ids of ["1,2,3,4,5,6", "123,123", "abc", "0"]) assert.throws(() => pilotUserIds({ ...env, LIGHTHOUSE_PILOT_ETSY_USER_IDS: ids }));
  assert.deepEqual(pilotUserIds({ ...env, LIGHTHOUSE_PILOT_ETSY_USER_IDS: "" }), []);
});

test("access checks real browser ownership, invitation, origin and live revocation", async t => {
  const session = createEtsyBrowserSession();
  let connection = { etsyUserId: "123" };
  let ready = true;
  const access = createPilotAccess({ env, ready: () => ready, getConnection: async hash => hash === session.ownerSessionHash ? connection : null });
  const base = await serve(t, app => {
    app.use("/api/shop", access.requireAccess, (req, res) => res.json(req.pilotIdentity));
    app.use("/api/etsy/pilot", access.requireAccess, (req, res) => res.json(req.pilotIdentity));
  });
  const headers = { Cookie: `${PILOT_COOKIE}=${session.token}`, Origin: origin, "Content-Type": "application/json" };
  assert.equal((await fetch(base + "/api/shop", { method: "POST", headers, body: "{}" })).status, 200);
  assert.equal((await fetch(base + "/api/shop", { method: "POST", headers: { ...headers, Origin: "https://evil.example" }, body: "{}" })).status, 403);
  assert.equal((await fetch(base + "/api/shop", { method: "POST", headers: { ...headers, "Content-Type": "text/plain" }, body: "{}" })).status, 403);
  assert.equal((await fetch(base + "/api/shop", { headers: { "X-Etsy-User-Id": "123" } })).status, 401);
  assert.equal((await fetch(base + "/api/etsy/pilot", { headers: { Cookie: `lighthouse_etsy_session=${session.token}` } })).status, 200);
  connection = { etsyUserId: "999" };
  assert.equal((await fetch(base + "/api/shop", { headers })).status, 403);
  connection = null; // Disconnect is effective even if the alias cookie remains.
  assert.equal((await fetch(base + "/api/shop", { headers })).status, 401);
  ready = false;
  assert.equal((await fetch(base + "/api/shop", { headers })).status, 503);
});

test("only approved accounts receive a scoped HttpOnly pilot alias", () => {
  const session = createEtsyBrowserSession();
  const cookies = [];
  const access = createPilotAccess({ env, ready: () => true });
  const req = { headers: { cookie: `lighthouse_etsy_session=${session.token}` } };
  const res = { append: (name, value) => cookies.push([name, value]) };
  assert.equal(access.describe({ etsyUserId: "999" }, req, res).approved, false);
  assert.equal(cookies.length, 0);
  assert.equal(access.describe({ etsyUserId: "123" }, req, res).approved, true);
  assert.match(cookies[0][1], /Path=\/api; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure/);
});

test("AI request is bounded, has no tools, no stored response and verifies output", async () => {
  const result = { assessment: "Insufficient evidence for a cause.", draftTitle: "Weekly Meal Planner PDF", draftDescription: "Two-page weekly planner and shopping list.", nextAction: "Clarify what is included.", measurementPlan: "Compare equal periods after changing one thing.", limitations: "No market or image data is available." };
  let sent;
  const client = { responses: { create: async request => { sent = request; return { status: "completed", output_text: JSON.stringify(result), usage: { input_tokens: 100, output_tokens: 120 } }; } } };
  assert.deepEqual((await generatePilotReview(input, { client })).result, result);
  assert.equal(sent.model, PILOT_MODEL);
  assert.equal(sent.max_output_tokens, 2200);
  assert.equal(sent.store, false);
  assert.equal(sent.tools, undefined);
  assert.equal(sent.text.format.strict, true);
  assert.match(sent.instructions, /untrusted product data/);
  for (const response of [{ status: "incomplete" }, { status: "completed", output_text: "not json" }, { status: "completed", output_text: JSON.stringify({ ...result, draftTitle: "a".repeat(141) }) }]) {
    await assert.rejects(generatePilotReview(input, { client: { responses: { create: async () => response } } }));
  }
});

test("paid calls require successful reservation; duplicates and invalid input never run AI", async t => {
  const session = createEtsyBrowserSession();
  const access = createPilotAccess({ env, ready: () => true, getConnection: async () => ({ etsyUserId: "123" }) });
  let calls = 0, reserves = 0, block = false;
  const saved = new Map();
  const store = {
    async reserve(user, key, value) {
      reserves++;
      if (block) throw new Error("PILOT_BUDGET_LIMIT");
      if (saved.has(key)) return { fresh: false, review: saved.get(key) };
      const review = { id: key, input: value, status: "pending" };
      saved.set(key, review); return { fresh: true, review };
    },
    async finish(user, id, value, status) { const review = { id, ...value, status }; saved.set(id, review); return review; },
    async list() { return [...saved.values()]; },
  };
  const base = await serve(t, app => app.use("/api/etsy/pilot", createPilotRouter({ store, access, generate: async () => { calls++; return { result: { assessment: "fixture" } }; } })));
  const post = (body, headers = {}) => fetch(base + "/api/etsy/pilot/reviews", { method: "POST", headers: { Cookie: `lighthouse_etsy_session=${session.token}`, Origin: origin, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const body = { requestKey: randomUUID(), input };
  assert.equal((await post({ ...body, input: { ...input, sales: null } })).status, 400);
  assert.equal(reserves, 0);
  assert.equal((await post(body, { Cookie: "" })).status, 401);
  assert.equal(calls, 0);
  assert.equal((await post(body)).status, 200);
  assert.equal((await post(body)).status, 200);
  assert.equal(calls, 1);
  block = true;
  assert.equal((await post({ ...body, requestKey: randomUUID() })).status, 429);
  assert.equal(calls, 1);
});

test("a provider failure is recorded and cannot become an unreserved automatic retry", async t => {
  let calls = 0, status = "pending";
  const session = createEtsyBrowserSession();
  const access = createPilotAccess({ env, ready: () => true, getConnection: async () => ({ etsyUserId: "123" }) });
  const id = randomUUID();
  const store = { reserve: async () => ({ fresh: calls === 0, review: { id, status, input } }), finish: async (_user, _id, _value, value) => { status = value; } };
  const base = await serve(t, app => app.use("/api/etsy/pilot", createPilotRouter({ access, store, generate: async () => { calls++; throw new Error("secret provider detail"); } })));
  const post = () => fetch(base + "/api/etsy/pilot/reviews", { method: "POST", headers: { Cookie: `lighthouse_etsy_session=${session.token}`, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ requestKey: id, input }) });
  const failure = await post(); assert.equal(failure.status, 503); assert.equal((await failure.text()).includes("secret"), false);
  assert.equal(status, "failed");
  assert.equal((await post()).status, 200);
  assert.equal(calls, 1);
});

test("private plans cannot be executed, approved or updated by another approved account", async t => {
  shopPlans.clear(); t.after(() => shopPlans.clear());
  const base = await serve(t, app => app.use("/api/shop", (req, _res, next) => { req.pilotIdentity = { etsyUserId: req.get("test-user") }; next(); }, shopRoutes));
  const post = (path, body, user) => fetch(base + "/api/shop" + path, { method: "POST", headers: { "Content-Type": "application/json", "test-user": user }, body: JSON.stringify(body) });
  const response = await post("/plan", { shopName: "Owned shop", reportingPeriod: input.reportingPeriod, listings: [{ id: "one", title: input.title, views: 700, sales: 5 }] }, "123");
  const plan = await response.json(); assert.equal(response.status, 200);
  assert.equal(shopPlans.get(plan.shopPlanId).pilotOwnerId, "123");
  assert.equal(plan.pilotOwnerId, undefined);
  assert.equal((await post("/execute", { shopPlanId: plan.shopPlanId }, "456")).status, 404);
  assert.equal((await post("/approval", { shopPlanId: plan.shopPlanId, taskId: plan.tasks[0].id, decision: "APPROVE" }, "456")).status, 404);
  assert.equal((await post("/outcome", { shopPlanId: plan.shopPlanId, taskId: plan.tasks[0].id, outcome: { result: "POSITIVE" } }, "456")).status, 404);
});

test("real server blocks legacy paid routes and private calls when durable storage is missing", async t => {
  const probe = net.createServer().listen(0, "127.0.0.1"); await once(probe, "listening");
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ["server.js"], { cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port), LIGHTHOUSE_PRIVATE_PILOT: "true", LIGHTHOUSE_ETSY_REVIEW_APPROVED: "true",
      ETSY_CONNECTION_STORAGE: "disabled", OPENAI_API_KEY: "test-never-call-provider", USE_REAL_EXECUTION_AI: "true", BETA_REAL_AI_ENABLED: "true" },
    stdio: ["ignore", "pipe", "pipe"] });
  child.stderr.resume();
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, "exit"); } });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server startup timed out")), 5000);
    child.stdout.on("data", chunk => { if (String(chunk).includes("Lighthouse API server")) { clearTimeout(timeout); resolve(); } });
    child.once("error", error => { clearTimeout(timeout); reject(error); });
  });
  for (const [path, expected] of [["/api/analysis", 403], ["/api/analysis/input", 403], ["/api/analysis/execute", 403], ["/api/shop/plan", 503], ["/api/etsy/pilot/reviews", 503]]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(response.status, expected, path);
    assert.equal(response.headers.get("content-type").includes("application/json"), true);
  }
});

test("follow-up preserves ownership and requires comparable completed reporting windows", async t => {
  const period = defaultReportingPeriod();
  const baseline = { startDate: shiftDate(period.startDate, -period.days), endDate: shiftDate(period.startDate, -1), timeZone: period.timeZone, days: period.days };
  const id = randomUUID();
  const session = createEtsyBrowserSession();
  const access = createPilotAccess({ env, ready: () => true, getConnection: async () => ({ etsyUserId: "123" }) });
  let saved = null;
  const store = {
    list: async user => { assert.equal(user, "123"); return [{ id, status: "complete", input: { ...input, reportingPeriod: baseline } }]; },
    outcome: async (user, reviewId, outcome) => { assert.equal(user, "123"); assert.equal(reviewId, id); saved = outcome; return { id, outcome }; },
  };
  const base = await serve(t, app => app.use("/api/etsy/pilot", createPilotRouter({ access, store })));
  const post = (body, reviewId = id) => fetch(`${base}/api/etsy/pilot/reviews/${reviewId}/outcome`, { method: "POST", headers: { Cookie: `lighthouse_etsy_session=${session.token}`, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const outcome = { note: "Clarified the product description", views: 800, sales: 8, reportingPeriod: period };
  assert.equal((await post(outcome, randomUUID())).status, 404);
  for (const change of [{ views: -1 }, { sales: "8" }, { note: "" }, { reportingPeriod: baseline }, { reportingPeriod: { ...period, endDate: shiftDate(period.endDate, -1) } }]) {
    assert.equal((await post({ ...outcome, ...change })).status, 400);
    assert.equal(saved, null);
  }
  assert.equal((await post(outcome)).status, 200);
  assert.equal(saved.sales, 8);
});
