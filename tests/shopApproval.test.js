import test from "node:test";
import assert from "node:assert/strict";

import generateExecutionPlan from "../src/tools/generateExecutionPlan.js";
import buildShopApprovalProposalMock from "../src/tools/buildShopApprovalProposalMock.js";
import applyShopApprovalDecision from "../src/state/applyShopApprovalDecision.js";
import attachApprovedRecoveryPackage from "../src/state/attachApprovedRecoveryPackage.js";

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

function createApprovalState() {
  const shopData = createShopData();

  const executionPlan = generateExecutionPlan(shopData);

  const approvalTask = executionPlan.tasks.find(
    (task) => task.status === "AWAITING_APPROVAL",
  );

  const proposal = buildShopApprovalProposalMock(approvalTask, shopData);

  const tasks = executionPlan.tasks.map((task) =>
    task.id === approvalTask.id
      ? {
          ...task,

          approval: {
            status: "PENDING",

            proposal,
          },
        }
      : task,
  );

  return {
    shopData,

    executionPlan: {
      ...executionPlan,

      tasks,
    },
  };
}

test("builds a protected shop change proposal without modifying the shop", () => {
  const state = createApprovalState();

  const approvalTask = state.executionPlan.tasks.find(
    (task) => task.status === "AWAITING_APPROVAL",
  );

  const proposal = approvalTask.approval.proposal;

  assert.equal(proposal.type, "SHOP_LISTING_CHANGE_PROPOSAL");

  assert.equal(proposal.source, "MOCK");

  assert.equal(proposal.listingId, "listing_2");

  assert.equal(
    proposal.diagnosis.observedSignal,
    "This listing receives meaningful traffic but converts relatively few visitors into sales.",
  );

  assert.ok(Array.isArray(proposal.diagnosis.possibleContributors));

  assert.equal(proposal.diagnosis.possibleContributors.length, 5);

  assert.equal(proposal.diagnosis.confidence, "LOW");

  assert.equal(proposal.diagnosis.provenCause, null);

  assert.ok(Array.isArray(proposal.proposedChanges));

  assert.ok(proposal.proposedChanges.length > 0);

  assert.equal(proposal.safeguards.didModifyShop, false);

  assert.equal(proposal.safeguards.externalSpend, 0);
});

test("approving a protected shop task updates approval state without executing it", () => {
  const state = createApprovalState();

  const updatedState = applyShopApprovalDecision(
    state,
    "shop_task_1",
    "APPROVE",
  );

  const task = updatedState.executionPlan.tasks.find(
    (candidateTask) => candidateTask.id === "shop_task_1",
  );

  assert.equal(task.status, "APPROVED");

  assert.equal(task.approval.status, "APPROVED");

  assert.equal(task.approval.decision, "APPROVE");

  assert.equal(task.approval.proposal.safeguards.didModifyShop, false);
});

test("approved recovery package preserves the exact seller-approved proposal for manual application", () => {
  const state = createApprovalState();

  const approvedState = applyShopApprovalDecision(
    state,
    "shop_task_1",
    "APPROVE",
  );

  const updatedState = attachApprovedRecoveryPackage(
    approvedState,
    "shop_task_1",
  );

  const task = updatedState.executionPlan.tasks.find(
    (candidateTask) => candidateTask.id === "shop_task_1",
  );

  const proposedChanges = task.approval.proposal.proposedChanges;

  assert.equal(task.status, "APPROVED");

  assert.equal(task.approvedRecovery.status, "READY_FOR_MANUAL_APPLICATION");

  assert.equal(task.approvedRecovery.applicationMode, "MANUAL");

  assert.equal(task.approvedRecovery.source, "APPROVED_PROPOSAL");

  assert.equal(task.approvedRecovery.listingId, "listing_2");

  assert.equal(task.approvedRecovery.listingTitle, "Daily Focus Planner");

  assert.equal(task.approvedRecovery.changes.length, proposedChanges.length);

  for (let index = 0; index < proposedChanges.length; index += 1) {
    assert.equal(
      task.approvedRecovery.changes[index].field,
      proposedChanges[index].field,
    );

    assert.equal(
      task.approvedRecovery.changes[index].currentValue,
      proposedChanges[index].currentValue ?? null,
    );

    assert.equal(
      task.approvedRecovery.changes[index].approvedValue,
      proposedChanges[index].proposedValue,
    );

    assert.equal(
      task.approvedRecovery.changes[index].reason,
      proposedChanges[index].reason,
    );
  }

  assert.equal(task.approvedRecovery.safeguards.didModifyShop, false);

  assert.equal(task.approvedRecovery.safeguards.externalSpend, 0);

  assert.ok(task.approvedRecovery.preparedAt);
});

test("approved recovery package does not regenerate or alter approved values", () => {
  const state = createApprovalState();

  const approvedState = applyShopApprovalDecision(
    state,
    "shop_task_1",
    "APPROVE",
  );

  const originalTask = approvedState.executionPlan.tasks.find(
    (candidateTask) => candidateTask.id === "shop_task_1",
  );

  const originalApprovedValues =
    originalTask.approval.proposal.proposedChanges.map(
      (change) => change.proposedValue,
    );

  const updatedState = attachApprovedRecoveryPackage(
    approvedState,
    "shop_task_1",
  );

  const updatedTask = updatedState.executionPlan.tasks.find(
    (candidateTask) => candidateTask.id === "shop_task_1",
  );

  const packagedValues = updatedTask.approvedRecovery.changes.map(
    (change) => change.approvedValue,
  );

  assert.deepEqual(packagedValues, originalApprovedValues);
});

test("rejecting a protected shop task marks it rejected without executing it", () => {
  const state = createApprovalState();

  const updatedState = applyShopApprovalDecision(
    state,
    "shop_task_1",
    "REJECT",
  );

  const task = updatedState.executionPlan.tasks.find(
    (candidateTask) => candidateTask.id === "shop_task_1",
  );

  assert.equal(task.status, "REJECTED");

  assert.equal(task.approval.status, "REJECTED");

  assert.equal(task.approval.decision, "REJECT");

  assert.equal(task.approvedRecovery, undefined);
});

test("approval cannot be applied to a safe automation task", () => {
  const state = createApprovalState();

  assert.throws(
    () => applyShopApprovalDecision(state, "shop_task_2", "APPROVE"),
    {
      message: "TASK_DOES_NOT_REQUIRE_APPROVAL",
    },
  );
});