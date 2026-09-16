import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import generateExecutionPlan from "../src/tools/generateExecutionPlan.js";

import { createStoredShopPlan } from "../src/state/shopPlanSession.js";

import { shopPlans } from "../src/state/sessionStore.js";

afterEach(() => {
  shopPlans.clear();
});

test("stores a valid shop plan and returns a normal shop plan response", () => {
  const shopData = {
    shopName: "Maya Studio",
    weeklyAvailableMinutes: 180,

    listings: [
      {
        id: "listing_1",
        title: "Printable Birthday Invitation",
        views: 700,
        sales: 5,
        trendPercent: 0,
      },
    ],
  };

  const executionPlan = generateExecutionPlan(shopData);

  const result = createStoredShopPlan({
    shopData,
    executionPlan,
  });

  assert.equal(result.valid, true);

  assert.ok(result.shopPlanId);

  assert.equal(result.response.shopPlanId, result.shopPlanId);

  assert.equal(
    shopPlans.get(result.shopPlanId)?.shopData.shopName,
    "Maya Studio",
  );

  assert.deepEqual(
    shopPlans.get(result.shopPlanId)?.executionPlan,
    result.state.executionPlan,
  );
});

test("does not create a session when the execution plan is invalid", () => {
  const originalSize = shopPlans.size;

  const result = createStoredShopPlan({
    shopData: {
      shopName: "Maya Studio",
      weeklyAvailableMinutes: 180,
      listings: [],
    },

    executionPlan: {
      tasks: [
        {
          id: "invalid_task",
          title: "Invalid task",
        },
      ],
    },
  });

  assert.equal(result.valid, false);

  assert.equal(result.shopPlanId, null);

  assert.equal(result.state, null);

  assert.equal(result.response, null);

  assert.equal(shopPlans.size, originalSize);
});