import buildEtsyPlanningResult from "../../../src/integrations/etsy/buildEtsyPlanningResult.js";
import buildShopPlanResponse from "../../../src/utils/buildShopPlanResponse.js";
import validateExecutionPlan from "../../../src/utils/validateExecutionPlan.js";
import runExecutionLoop from "../../../src/agent/runExecutionLoop.js";
import executeTaskMock from "../../../src/tools/executeTaskMock.js";
import { attachPendingApprovalProposal } from "../../../src/state/attachPendingApprovalProposal.js";
import applyShopApprovalDecision from "../../../src/state/applyShopApprovalDecision.js";
import attachApprovedRecoveryPackage from "../../../src/state/attachApprovedRecoveryPackage.js";
import applyTaskOutcome from "../../../src/state/applyTaskOutcome.js";

export function buildMockEtsySnapshot() {
    return {
      shopId: "shop_mock_1",
      shopName: "Maya Studio",

      period: {
        days: 30,
        currentStart: "2026-08-13T00:00:00.000Z",
        currentEndExclusive: "2026-09-12T00:00:00.000Z",
        previousStart: "2026-07-14T00:00:00.000Z",
        previousEndExclusive: "2026-08-13T00:00:00.000Z",
        timeZone: "UTC",
      },

      listings: [
        {
          id: "listing_mock_1",
          title: "Printable Birthday Invitation",

          metrics: {
            periodViews: null,
            currentPeriodSales: 5,
            previousPeriodSales: 5,
            trendPercent: 0,
          },

          availability: {
            periodViews: "UNAVAILABLE",
            currentPeriodSales: "AVAILABLE",
            previousPeriodSales: "AVAILABLE",
            trendPercent: "DERIVED",
          },

          sources: {
            periodViews: null,
            currentPeriodSales: "ETSY",
            previousPeriodSales: "ETSY",
            trendPercent: "LIGHTHOUSE_DERIVED",
          },
        },
      ],
    };
  }


// One disposable in-browser session. No network, credentials, provider or shared
// server store: the public sample remains usable when private APIs are locked.
export function createSamplePlanner() {
  let session = null;
  return {
    async request(path, input = {}) {
      if (path === "/etsy/plan") {
        session = null;
        const result = buildEtsyPlanningResult({
          snapshot: buildMockEtsySnapshot(),
          sellerInputs: input.sellerInputs ?? [],
          weeklyAvailableMinutes: input.weeklyAvailableMinutes ?? null,
        });
        if (result.missingEvidence.length) return { ...result, sessionPlan: null };
        const validation = validateExecutionPlan(result.plan);
        if (!validation.valid) throw new Error(validation.reason);
        const id = "sample-" + crypto.randomUUID();
        session = { id, state: attachPendingApprovalProposal({
          shopData: result.shopData, executionPlan: result.plan,
        }) };
        return { ...result, sessionPlan: buildShopPlanResponse(id, session.state) };
      }
      const current = session;
      if (!current || input.shopPlanId !== current.id) throw new Error("SAMPLE_PLAN_NOT_FOUND");
      let extra;
      if (path === "/execute") {
        const result = await runExecutionLoop(current.state, { executeTask: executeTaskMock });
        if (session !== current) throw new Error("SAMPLE_PLAN_REPLACED");
        current.state = attachPendingApprovalProposal(result.state);
        extra = { executionStatus: result.executionStatus, executedTaskIds: result.executedTaskIds ?? [],
          stoppedTaskId: result.stoppedTaskId ?? null };
      } else if (path === "/approval") {
        current.state = applyShopApprovalDecision(current.state, input.taskId, input.decision);
        if (input.decision === "APPROVE") current.state = attachApprovedRecoveryPackage(current.state, input.taskId);
        extra = { approvalDecision: input.decision, taskId: input.taskId };
      } else if (path === "/outcome") {
        current.state = applyTaskOutcome(current.state, input.taskId, input.outcome);
        extra = { taskId: input.taskId };
      } else {
        throw new Error("SAMPLE_ACTION_UNSUPPORTED");
      }
      return { ...buildShopPlanResponse(current.id, current.state), ...extra };
    },
  };
}
