import test from "node:test";
import assert from "node:assert/strict";
import { createSamplePlanner, buildMockEtsySnapshot } from "../client/src/utils/samplePlanner.js";
import buildEtsyPlanningResult from "../src/integrations/etsy/buildEtsyPlanningResult.js";

function evidence(views) {
  return { sellerInputs: [{ listingId: "listing_mock_1", periodViews: views,
    period: buildMockEtsySnapshot().period, periodConfirmed: true }], weeklyAvailableMinutes: 180 };
}
test("sample planner needs no API and uses the existing planning rules", async t => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Sample must not call the network"); });
  const planner = createSamplePlanner();
  const missing = await planner.request("/etsy/plan");
  assert.equal(missing.sessionPlan, null);
  assert.equal(missing.missingEvidence.length, 1);
  const input = evidence(200);
  // Take the exact resolution period expected by the shared evidence validator.
  input.sellerInputs[0].period = missing.missingEvidence[0].resolution.period;
  const result = await planner.request("/etsy/plan", input);
  const expected = buildEtsyPlanningResult({ snapshot: buildMockEtsySnapshot(), ...input });
  assert.deepEqual(result.plan, expected.plan);
  assert.match(result.sessionPlan.shopPlanId, /^sample-/);
  const executed = await planner.request("/execute", { shopPlanId: result.sessionPlan.shopPlanId });
  assert.ok(executed.executedTaskIds.length > 0);
  const completed = executed.tasks.find(task => task.status === "COMPLETE");
  assert.ok(completed);
  const outcome = await planner.request("/outcome", { shopPlanId: executed.shopPlanId,
    taskId: completed.id, outcome: { result: "NEUTRAL", note: "Sample only" } });
  assert.equal(outcome.shopPlanId, executed.shopPlanId);
});
test("sample sessions reject foreign IDs and replacement invalidates previous plans", async () => {
  const a = createSamplePlanner(), b = createSamplePlanner();
  const missing = await a.request("/etsy/plan");
  const input = evidence(700);
  input.sellerInputs[0].period = missing.missingEvidence[0].resolution.period;
  const first = await a.request("/etsy/plan", input);
  await assert.rejects(b.request("/execute", { shopPlanId: first.sessionPlan.shopPlanId }), /SAMPLE_PLAN_NOT_FOUND/);
  await a.request("/etsy/plan");
  await assert.rejects(a.request("/execute", { shopPlanId: first.sessionPlan.shopPlanId }), /SAMPLE_PLAN_NOT_FOUND/);
  const next = await a.request("/etsy/plan", { ...input, snapshot: { shopName: "Untrusted real shop" } });
  assert.equal(next.shopData.shopName, "Maya Studio");
  const task = next.sessionPlan.tasks.find(item => item.status === "AWAITING_APPROVAL");
  assert.ok(task?.approval?.proposal);
  const approved = await a.request("/approval", { shopPlanId: next.sessionPlan.shopPlanId,
    taskId: task.id, decision: "APPROVE" });
  assert.equal(approved.tasks[0].approvedRecovery.safeguards.didModifyShop, false);
  assert.equal(approved.tasks[0].approvedRecovery.safeguards.externalSpend, 0);
  await assert.rejects(a.request("/reviews", { shopPlanId: next.sessionPlan.shopPlanId }), /SAMPLE_ACTION_UNSUPPORTED/);
});
