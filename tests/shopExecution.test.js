import test from "node:test";
import assert from "node:assert/strict";

import generateExecutionPlan from "../src/tools/generateExecutionPlan.js";
import runExecutionLoop from "../src/agent/runExecutionLoop.js";

function createShopData() {
  return {
    shopName: "Maya Studio",

    weeklyAvailableMinutes: 180,

    listings: [
      {
        id: "listing_1",
        title: "Weekly ADHD Planner",
        views: 1200,
        sales: 84,
        trendPercent: 0,
      },
      {
        id: "listing_2",
        title: "Daily Focus Planner",
        views: 950,
        sales: 9,
        trendPercent: 0,
      },
      {
        id: "listing_3",
        title: "Student ADHD Planner",
        views: 190,
        sales: 11,
        trendPercent: 25,
      },
      {
        id: "listing_4",
        title: "Meal Planner Bundle",
        views: 610,
        sales: 34,
        trendPercent: -30,
      },
    ],
  };
}

function createShopExecutionState() {
  const shopData = createShopData();

  return {
    shopData,

    executionPlan: generateExecutionPlan(shopData),
  };
}

test("executes safe shop tasks and stops at the approval boundary", async () => {
  const state = createShopExecutionState();

  const result = await runExecutionLoop(state);

  assert.equal(result.executionStatus, "AWAITING_APPROVAL");

  assert.deepEqual(result.executedTaskIds, ["shop_task_2", "shop_task_3"]);

  assert.equal(result.stoppedTaskId, "shop_task_1");

  const tasks = result.state.executionPlan.tasks;

  assert.equal(tasks[0].status, "AWAITING_APPROVAL");

  assert.equal(tasks[1].status, "COMPLETE");
  assert.equal(tasks[2].status, "COMPLETE");
});

test("stores decline diagnosis output in the completed shop task", async () => {
  const state = createShopExecutionState();

  const result = await runExecutionLoop(state);

  const declineTask = result.state.executionPlan.tasks.find(
    (task) => task.opportunityType === "DIAGNOSE_DECLINE",
  );

  assert.equal(declineTask.result.type, "SHOP_DECLINE_DIAGNOSIS");

  assert.equal(declineTask.result.listingId, "listing_4");

  assert.ok(Array.isArray(declineTask.result.causes));

  assert.ok(declineTask.result.causes.length > 0);

  assert.equal(declineTask.result.didModifyShop, false);
});

test("stores expansion validation output in the completed shop task", async () => {
  const state = createShopExecutionState();

  const result = await runExecutionLoop(state);

  const expansionTask = result.state.executionPlan.tasks.find(
    (task) => task.opportunityType === "VALIDATE_EXPANSION",
  );

  assert.equal(expansionTask.result.type, "SHOP_EXPANSION_VALIDATION");

  assert.equal(expansionTask.result.listingId, "listing_3");

  assert.ok(Array.isArray(expansionTask.result.opportunities));

  assert.ok(expansionTask.result.opportunities.length > 0);

  assert.equal(expansionTask.result.externalSpend, 0);
});

test("keeps the existing opportunity execution flow working", async () => {
  const idea = "Birthday Invitation";

  const state = {
    idea,
    executionPlan: generateExecutionPlan(idea),
  };

  const result = await runExecutionLoop(state);

  assert.equal(result.executionStatus, "AWAITING_APPROVAL");

  assert.deepEqual(result.executedTaskIds, ["task_1", "task_2"]);

  const tasks = result.state.executionPlan.tasks;

  assert.equal(tasks[0].status, "COMPLETE");
  assert.equal(tasks[1].status, "COMPLETE");

  assert.equal(tasks[2].status, "AWAITING_APPROVAL");
});