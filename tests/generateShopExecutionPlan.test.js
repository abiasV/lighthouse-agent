import test from "node:test";
import assert from "node:assert/strict";

import generateExecutionPlan from "../src/tools/generateExecutionPlan.js";
import validateExecutionPlan from "../src/utils/validateExecutionPlan.js";

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
      {
        id: "listing_5",
        title: "Wedding Planner",
        views: 75,
        sales: 1,
        trendPercent: 0,
      },
    ],
  };
}

test("creates a prioritized weekly growth plan from Etsy shop data", () => {
  const plan = generateExecutionPlan(createShopData());

  assert.equal(plan.version, 1);

  assert.equal(plan.planType, "SHOP_WEEKLY_GROWTH");

  assert.equal(plan.shopName, "Maya Studio");

  assert.equal(plan.tasks.length, 3);

  assert.equal(plan.tasks[0].opportunityType, "IMPROVE_CONVERSION");

  assert.equal(plan.tasks[0].listingId, "listing_2");

  assert.equal(plan.tasks[1].opportunityType, "DIAGNOSE_DECLINE");

  assert.equal(plan.tasks[1].listingId, "listing_4");

  assert.equal(plan.tasks[2].opportunityType, "VALIDATE_EXPANSION");

  assert.equal(plan.tasks[2].listingId, "listing_3");
});

test("requires approval before preparing changes to a weak-conversion listing", () => {
  const plan = generateExecutionPlan(createShopData());

  const task = plan.tasks[0];

  assert.equal(task.riskLevel, "APPROVAL_REQUIRED");

  assert.equal(task.status, "AWAITING_APPROVAL");

  assert.equal(task.detectedFrom, "LOW_CONVERSION_SIGNAL");
});

test("allows diagnostic and opportunity research to start safely", () => {
  const plan = generateExecutionPlan(createShopData());

  const declineTask = plan.tasks[1];

  const expansionTask = plan.tasks[2];

  assert.equal(declineTask.riskLevel, "SAFE_AUTOMATION");

  assert.equal(declineTask.status, "READY");

  assert.equal(expansionTask.riskLevel, "SAFE_AUTOMATION");

  assert.equal(expansionTask.status, "READY");
});

test("shop growth plans remain compatible with the existing plan validator", () => {
  const plan = generateExecutionPlan(createShopData());

  const validation = validateExecutionPlan(plan);

  assert.deepEqual(validation, {
    valid: true,
    reason: null,
  });
});

test("keeps the existing idea-based execution plan compatible", () => {
  const plan = generateExecutionPlan("Birthday Invitation");

  assert.equal(plan.version, 1);

  assert.equal(plan.tasks[0].title, "Research purchase-intent keywords");

  assert.equal(plan.tasks.length, 3);
});

test("does not create a low-conversion opportunity when traffic evidence is unavailable", () => {
  const shopData = {
    shopName: "Maya Studio",
    weeklyAvailableMinutes: 180,

    listings: [
      {
        id: "listing_1",
        title: "Printable Birthday Invitation",
        views: null,
        sales: 5,
        trendPercent: 0,
      },
    ],
  };

  const plan = generateExecutionPlan(shopData);

  const conversionTask = plan.tasks.find(
    (task) => task.opportunityType === "IMPROVE_CONVERSION",
  );

  assert.equal(conversionTask, undefined);
});

test("still creates a decline diagnosis when traffic is unavailable but sales trend evidence is sufficient", () => {
  const shopData = {
    shopName: "Maya Studio",
    weeklyAvailableMinutes: 180,

    listings: [
      {
        id: "listing_1",
        title: "Meal Planner Bundle",
        views: null,
        sales: 34,
        trendPercent: -30,
      },
    ],
  };

  const plan = generateExecutionPlan(shopData);

  assert.equal(plan.tasks.length, 1);

  assert.equal(plan.tasks[0].opportunityType, "DIAGNOSE_DECLINE");

  assert.equal(plan.tasks[0].riskLevel, "SAFE_AUTOMATION");
});