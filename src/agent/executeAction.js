import checkCopyright from "../tools/checkCopyright.js";

import researchDemand from "../tools/researchDemand.js";
import researchDemandFallback from "../tools/researchDemandFallback.js";
import runRealDemandPipeline from "../tools/runRealDemandPipeline.js";

import researchCompetition from "../tools/researchCompetition.js";
import researchCompetitionFallback from "../tools/researchCompetitionFallback.js";
import runRealCompetitionPipeline from "../tools/runRealCompetitionPipeline.js";

import evaluateProfitability from "../tools/evaluateProfitability.js";
import buildProfitabilityCriterion from "../tools/buildProfitabilityCriterion.js";

import evaluateEffort from "../tools/evaluateEffort.js";
import buildEffortCriterion from "../tools/buildEffortCriterion.js";

import evaluateScalability from "../tools/evaluateScalability.js";
import buildScalabilityCriterion from "../tools/buildScalabilityCriterion.js";

import calculateFinalScore from "../rules/calculateFinalScore.js";

import applyDecisionRules from "../rules/applyDecisionRules.js";

import getErrorPolicy from "../rules/getErrorPolicy.js";

import validateEvidenceResult from "../utils/validateEvidenceResult.js";

import generateExecutionPlan from "../tools/generateExecutionPlan.js";

import validateExecutionPlan from "../utils/validateExecutionPlan.js";

import sleep from "../utils/sleep.js";

function applyDemandResult(state, result, validation) {
  state.criteria.demand.score = result.score;

  state.criteria.demand.confidence = validation.lowerConfidence
    ? "LOW"
    : result.confidence;

  state.criteria.demand.evidence = result.evidence;

  state.criteria.demand.status = "COMPLETE";

  if (result.signals) {
    state.criteria.demand.signals = result.signals;
  }

  state.tasks.demandResearch.status = "COMPLETE";

  state.tasks.competitionResearch.status = "READY";

  state.tasks.competitionResearch.blockedBy = null;

  return state;
}

function applyCompetitionResult(state, result, validation) {
  state.criteria.competition.score = result.score;

  state.criteria.competition.confidence = validation.lowerConfidence
    ? "LOW"
    : result.confidence;

  state.criteria.competition.evidence = result.evidence;

  state.criteria.competition.status = "COMPLETE";

  if (result.signals) {
    state.criteria.competition.signals = result.signals;
  }

  state.tasks.competitionResearch.status = "COMPLETE";

  state.tasks.profitabilityInput.status = "READY";

  state.tasks.profitabilityInput.blockedBy = null;

  return state;
}

async function executeAction(action, state, options = {}) {
  const sleepFn = options.sleepFn ?? sleep;

  const useRealDemand = options.useRealDemand ?? false;

  const useRealCompetition = options.useRealCompetition ?? false;

  const useRealProfitability = options.useRealProfitability ?? false;

  const useRealEffort = options.useRealEffort ?? false;

  const useRealScalability = options.useRealScalability ?? false;

  if (action === "CHECK_COPYRIGHT") {
    const result = checkCopyright(state.idea, state.mockScenarios.copyright);

    if (result.passed) {
      state.tasks.copyrightCheck.status = "COMPLETE";

      state.tasks.demandResearch.status = "READY";

      state.tasks.demandResearch.blockedBy = null;
    } else {
      state.tasks.copyrightCheck.status = "COMPLETE";

      state.tasks.executionPlanning.blockedBy = null;

      state.tasks.executionPlanning.blockedReason = "COPYRIGHT_HARD_CONSTRAINT";

      state.agentStatus = "REJECTED";

      state.finalStatus = "REJECT";

      state.finalReason = "COPYRIGHT_HARD_CONSTRAINT";
    }

    return state;
  }

  if (action === "RESEARCH_DEMAND") {
    // REAL DEMAND MODE
    if (useRealDemand) {
      console.log(`Running REAL demand research for: ${state.idea}`);

      try {
        const result = await runRealDemandPipeline(state.idea, {
          researchClient: options.demandResearchClient ?? null,

          signalClient: options.demandSignalClient ?? null,
        });

        const validation = validateEvidenceResult(result);

        if (!validation.valid) {
          state.criteria.demand.score = null;

          state.criteria.demand.confidence = "LOW";

          state.criteria.demand.status = "N_A";

          state.criteria.demand.evidence = [];

          state.criteria.demand.failureReason = "REAL_DEMAND_EVIDENCE_INVALID";

          state.tasks.demandResearch.status = "COMPLETE";

          state.tasks.competitionResearch.status = "READY";

          state.tasks.competitionResearch.blockedBy = null;

          return state;
        }

        return applyDemandResult(state, result, validation);
      } catch (error) {
        state.criteria.demand.score = null;

        state.criteria.demand.confidence = "LOW";

        state.criteria.demand.status = "N_A";

        state.criteria.demand.evidence = [];

        state.criteria.demand.failureReason = "REAL_DEMAND_RESEARCH_FAILED";

        state.tasks.demandResearch.status = "COMPLETE";

        state.tasks.competitionResearch.status = "READY";

        state.tasks.competitionResearch.blockedBy = null;

        return state;
      }
    }

    // MOCK DEMAND MODE
    let attempt = 1;
    let delay = 1000;

    while (attempt <= 3) {
      try {
        const result = researchDemand(state.idea, state.mockScenarios.demand);

        const validation = validateEvidenceResult(result);

        if (!validation.valid) {
          break;
        }

        return applyDemandResult(state, result, validation);
      } catch (error) {
        const policy = getErrorPolicy(error);

        if (policy.action !== "RETRY") {
          break;
        }

        if (attempt === policy.maxAttempts) {
          break;
        }

        if (policy.useBackoff) {
          console.log(`Retrying demand research after ${delay}ms...`);

          await sleepFn(delay);

          delay *= 2;
        }

        attempt += 1;
      }
    }

    console.log("Primary demand research failed. Trying fallback...");

    const fallbackResult = researchDemandFallback(
      state.idea,
      state.mockScenarios.demandFallback,
    );

    const fallbackValidation = validateEvidenceResult(fallbackResult);

    if (fallbackValidation.valid) {
      const updatedState = applyDemandResult(
        state,
        fallbackResult,
        fallbackValidation,
      );

      updatedState.criteria.demand.usedFallback = true;

      return updatedState;
    }

    state.criteria.demand.score = null;

    state.criteria.demand.confidence = "LOW";

    state.criteria.demand.status = "N_A";

    state.criteria.demand.evidence = [];

    state.criteria.demand.failureReason = "PRIMARY_AND_FALLBACK_UNAVAILABLE";

    state.tasks.demandResearch.status = "COMPLETE";

    state.tasks.competitionResearch.status = "READY";

    state.tasks.competitionResearch.blockedBy = null;

    return state;
  }

  if (action === "RESEARCH_COMPETITION") {
    // REAL COMPETITION MODE
    if (useRealCompetition) {
      console.log(
        `Running REAL competition research for: ${state.researchInputs.competitionQuery}`,
      );

      try {
        const result = await runRealCompetitionPipeline(
          state.researchInputs.competitionQuery,
          {
            researchClient: options.competitionResearchClient ?? null,

            signalClient: options.competitionSignalClient ?? null,
          },
        );

        const validation = validateEvidenceResult(result);

        if (!validation.valid) {
          state.criteria.competition.score = null;

          state.criteria.competition.confidence = "LOW";

          state.criteria.competition.status = "N_A";

          state.criteria.competition.evidence = [];

          state.criteria.competition.failureReason =
            "REAL_COMPETITION_EVIDENCE_INVALID";

          state.tasks.competitionResearch.status = "COMPLETE";

          state.tasks.profitabilityInput.status = "READY";

          state.tasks.profitabilityInput.blockedBy = null;

          return state;
        }

        return applyCompetitionResult(state, result, validation);
      } catch (error) {
        state.criteria.competition.score = null;

        state.criteria.competition.confidence = "LOW";

        state.criteria.competition.status = "N_A";

        state.criteria.competition.evidence = [];

        state.criteria.competition.failureReason =
          "REAL_COMPETITION_RESEARCH_FAILED";

        state.tasks.competitionResearch.status = "COMPLETE";

        state.tasks.profitabilityInput.status = "READY";

        state.tasks.profitabilityInput.blockedBy = null;

        return state;
      }
    }

    // MOCK COMPETITION MODE
    let attempt = 1;
    let delay = 1000;
    let fallbackAllowed = true;

    while (attempt <= 3) {
      try {
        const result = researchCompetition(
          state.researchInputs.competitionQuery,
          state.mockScenarios.competition,
        );

        const validation = validateEvidenceResult(result);

        if (!validation.valid) {
          break;
        }

        return applyCompetitionResult(state, result, validation);
      } catch (error) {
        const policy = getErrorPolicy(error);

        if (policy.action === "FIX_INPUT") {
          fallbackAllowed = false;

          state.criteria.competition.status = "NOT_STARTED";

          state.criteria.competition.confidence = "LOW";

          state.criteria.competition.failureReason = "INVALID_INPUT";

          state.tasks.competitionResearch.status = "WAITING_FOR_USER";

          state.agentStatus = "PAUSED";

          state.pendingInput = {
            field: "competitionQuery",

            question:
              "The competition search input was invalid. Please provide a clearer product description.",

            expectedType: "text",
          };

          return state;
        }

        if (policy.action === "STOP") {
          fallbackAllowed = false;

          state.criteria.competition.status = "FAILED";

          state.criteria.competition.confidence = "LOW";

          state.criteria.competition.failureReason = "NON_RECOVERABLE_ERROR";

          state.tasks.competitionResearch.status = "FAILED";

          return state;
        }

        if (policy.action !== "RETRY") {
          fallbackAllowed = false;
          break;
        }

        if (attempt === policy.maxAttempts) {
          break;
        }

        if (policy.useBackoff) {
          console.log(`Retrying competition research after ${delay}ms...`);

          await sleepFn(delay);

          delay *= 2;
        }

        attempt += 1;
      }
    }

    if (!fallbackAllowed) {
      return state;
    }

    console.log("Primary competition research failed. Trying fallback...");

    const fallbackResult = researchCompetitionFallback(
      state.researchInputs.competitionQuery,
      state.mockScenarios.competitionFallback,
    );

    const fallbackValidation = validateEvidenceResult(fallbackResult);

    if (fallbackValidation.valid) {
      const updatedState = applyCompetitionResult(
        state,
        fallbackResult,
        fallbackValidation,
      );

      updatedState.criteria.competition.usedFallback = true;

      return updatedState;
    }

    state.criteria.competition.score = null;

    state.criteria.competition.confidence = "LOW";

    state.criteria.competition.status = "N_A";

    state.criteria.competition.evidence = [];

    state.criteria.competition.failureReason =
      "PRIMARY_AND_FALLBACK_UNAVAILABLE";

    state.tasks.competitionResearch.status = "COMPLETE";

    state.tasks.profitabilityInput.status = "READY";

    state.tasks.profitabilityInput.blockedBy = null;

    return state;
  }

  if (action === "ASK_PROFITABILITY_INPUT") {
    state.tasks.profitabilityInput.status = "WAITING_FOR_USER";

    state.criteria.profitability.inputMode = useRealProfitability
      ? "REAL"
      : "MOCK";

    state.agentStatus = "PAUSED";

    state.pendingInput = {
      field: "currency",
      question: "What currency are you using? (CAD, USD, EUR)",
      expectedType: "currencyCode",
    };

    return state;
  }

  if (action === "EVALUATE_PROFITABILITY") {
    // REAL PROFITABILITY MODE
    if (useRealProfitability) {
      const result = buildProfitabilityCriterion({
        fixedCost: state.criteria.profitability.fixedCost,

        sellingPrice: state.criteria.profitability.sellingPrice,

        variableCost: state.criteria.profitability.variableCost,
      });

      const validation = validateEvidenceResult(result);

      if (!validation.valid) {
        state.criteria.profitability.status = "FAILED";

        state.criteria.profitability.confidence = "LOW";

        state.tasks.profitabilityEvaluation.status = "FAILED";

        return state;
      }

      state.criteria.profitability.score = result.score;

      state.criteria.profitability.confidence = validation.lowerConfidence
        ? "LOW"
        : result.confidence;

      state.criteria.profitability.evidence = result.evidence;

      state.criteria.profitability.status = "COMPLETE";

      state.criteria.profitability.unitEconomics = result.unitEconomics;

      state.tasks.profitabilityEvaluation.status = "COMPLETE";

      if (useRealEffort) {
        state.tasks.effortInput.status = "READY";

        state.tasks.effortInput.blockedBy = null;
      } else {
        state.tasks.effortEvaluation.status = "READY";

        state.tasks.effortEvaluation.blockedBy = null;
      }

      return state;
    }

    // MOCK PROFITABILITY MODE
    const result = evaluateProfitability(
      state.criteria.profitability.fixedCost,

      state.mockScenarios.profitability,
    );

    const validation = validateEvidenceResult(result);

    if (!validation.valid) {
      state.criteria.profitability.status = "FAILED";

      state.criteria.profitability.confidence = "LOW";

      state.tasks.profitabilityEvaluation.status = "FAILED";

      return state;
    }

    state.criteria.profitability.score = result.score;

    state.criteria.profitability.confidence = validation.lowerConfidence
      ? "LOW"
      : result.confidence;

    state.criteria.profitability.evidence = result.evidence;

    state.criteria.profitability.status = "COMPLETE";

    state.tasks.profitabilityEvaluation.status = "COMPLETE";

    if (useRealEffort) {
      state.tasks.effortInput.status = "READY";

      state.tasks.effortInput.blockedBy = null;
    } else {
      state.tasks.effortEvaluation.status = "READY";

      state.tasks.effortEvaluation.blockedBy = null;
    }

    return state;
  }

  if (action === "ASK_EFFORT_INPUT") {
    state.tasks.effortInput.status = "WAITING_FOR_USER";

    state.criteria.effort.inputMode = useRealEffort ? "REAL" : "MOCK";

    state.agentStatus = "PAUSED";

    state.pendingInput = {
      field: "minutesPerOrder",
      question:
        "About how many minutes of your own work does one order require?",
      expectedType: "number",
    };

    return state;
  }

  if (action === "EVALUATE_EFFORT") {
    // REAL EFFORT MODE
    if (useRealEffort) {
      const result = buildEffortCriterion({
        minutesPerOrder: state.criteria.effort.minutesPerOrder,

        humanDependency: state.criteria.effort.humanDependency,
      });

      const validation = validateEvidenceResult(result);

      if (!validation.valid) {
        state.criteria.effort.status = "FAILED";

        state.criteria.effort.confidence = "LOW";

        state.tasks.effortEvaluation.status = "FAILED";

        return state;
      }

      state.criteria.effort.score = result.score;

      state.criteria.effort.confidence = validation.lowerConfidence
        ? "LOW"
        : result.confidence;

      state.criteria.effort.evidence = result.evidence;

      state.criteria.effort.status = "COMPLETE";

      state.criteria.effort.effortInputs = result.effortInputs;

      state.tasks.effortEvaluation.status = "COMPLETE";

      if (useRealScalability) {
        state.tasks.scalabilityInput.status = "READY";

        state.tasks.scalabilityInput.blockedBy = null;
      } else {
        state.tasks.scalabilityEvaluation.status = "READY";

        state.tasks.scalabilityEvaluation.blockedBy = null;
      }

      return state;
    }

    // MOCK EFFORT MODE
    const result = evaluateEffort();

    const validation = validateEvidenceResult(result);

    if (!validation.valid) {
      state.criteria.effort.status = "FAILED";

      state.criteria.effort.confidence = "LOW";

      state.tasks.effortEvaluation.status = "FAILED";

      return state;
    }

    state.criteria.effort.score = result.score;

    state.criteria.effort.confidence = validation.lowerConfidence
      ? "LOW"
      : result.confidence;

    state.criteria.effort.evidence = result.evidence;

    state.criteria.effort.status = "COMPLETE";

    state.tasks.effortEvaluation.status = "COMPLETE";

    if (useRealScalability) {
      state.tasks.scalabilityInput.status = "READY";

      state.tasks.scalabilityInput.blockedBy = null;
    } else {
      state.tasks.scalabilityEvaluation.status = "READY";

      state.tasks.scalabilityEvaluation.blockedBy = null;
    }

    return state;
  }

  if (action === "ASK_SCALABILITY_INPUT") {
    state.tasks.scalabilityInput.status = "WAITING_FOR_USER";

    state.criteria.scalability.inputMode = useRealScalability ? "REAL" : "MOCK";

    state.agentStatus = "PAUSED";

    state.pendingInput = {
      field: "parallelOrders",
      question:
        "How many orders can you realistically handle at the same time without extra help?",
      expectedType: "number",
    };

    return state;
  }

  if (action === "EVALUATE_SCALABILITY") {
    // REAL SCALABILITY MODE
    if (useRealScalability) {
      const result = buildScalabilityCriterion({
        ordersPerHourWithoutExtraHelp:
          state.criteria.scalability.ordersPerHourWithoutExtraHelp,

        manualBottleneckLevel: state.criteria.scalability.manualBottleneckLevel,
      });

      const validation = validateEvidenceResult(result);

      if (!validation.valid) {
        state.criteria.scalability.status = "FAILED";

        state.criteria.scalability.confidence = "LOW";

        state.tasks.scalabilityEvaluation.status = "FAILED";

        return state;
      }

      state.criteria.scalability.score = result.score;

      state.criteria.scalability.confidence = validation.lowerConfidence
        ? "LOW"
        : result.confidence;

      state.criteria.scalability.evidence = result.evidence;

      state.criteria.scalability.status = "COMPLETE";

      state.criteria.scalability.scalabilityInputs = result.scalabilityInputs;

      state.tasks.scalabilityEvaluation.status = "COMPLETE";

      state.tasks.finalEvaluation.status = "READY";

      state.tasks.finalEvaluation.blockedBy = null;

      return state;
    }

    // MOCK SCALABILITY MODE
    const result = evaluateScalability();

    const validation = validateEvidenceResult(result);

    if (!validation.valid) {
      state.criteria.scalability.status = "FAILED";

      state.criteria.scalability.confidence = "LOW";

      state.tasks.scalabilityEvaluation.status = "FAILED";

      return state;
    }

    state.criteria.scalability.score = result.score;

    state.criteria.scalability.confidence = validation.lowerConfidence
      ? "LOW"
      : result.confidence;

    state.criteria.scalability.evidence = result.evidence;

    state.criteria.scalability.status = "COMPLETE";

    state.tasks.scalabilityEvaluation.status = "COMPLETE";

    state.tasks.finalEvaluation.status = "READY";

    state.tasks.finalEvaluation.blockedBy = null;

    return state;
  }

  if (action === "CALCULATE_FINAL_SCORE") {
    const scoreResult = calculateFinalScore(state.criteria);

    const decision = applyDecisionRules(
      state.criteria,
      scoreResult.score,
      scoreResult.incomplete,
    );

    state.finalScore = scoreResult.score;

    state.evidenceCoverage = scoreResult.coverage;

    state.incompleteAnalysis = scoreResult.incomplete;

    state.finalStatus = decision.finalStatus;

    state.finalReason = decision.reason;

    state.tasks.finalEvaluation.status = "COMPLETE";

    if (decision.finalStatus === "REJECT") {
      state.tasks.executionPlanning.blockedBy = null;

      state.tasks.executionPlanning.blockedReason = decision.reason;

      state.agentStatus = "REJECTED";

      return state;
    }

    if (decision.finalStatus === "WORTH_TESTING") {
      state.agentStatus = "VALIDATION_COMPLETE";

      state.tasks.executionPlanning.status = "READY";

      state.tasks.executionPlanning.blockedBy = null;

      state.tasks.executionPlanning.blockedReason = null;

      return state;
    }

    state.tasks.executionPlanning.blockedBy = null;

    state.tasks.executionPlanning.blockedReason = decision.reason;

    state.agentStatus = "COMPLETE";

    return state;
  }

  if (action === "GENERATE_EXECUTION_PLAN") {
    state.tasks.executionPlanning.status = "IN_PROGRESS";

    state.tasks.executionPlanning.blockedReason = null;

    const plan = generateExecutionPlan(
      state.idea,
      state.mockScenarios.executionPlan,
    );

    const validation = validateExecutionPlan(plan);

    if (!validation.valid) {
      state.executionPlan = null;

      state.tasks.executionPlanning.status = "FAILED";

      state.tasks.executionPlanning.blockedBy = null;

      state.tasks.executionPlanning.blockedReason = null;

      state.tasks.executionPlanning.failureReason = validation.reason;

      state.agentStatus = "PLANNING_FAILED";

      return state;
    }

    state.executionPlan = plan;

    state.tasks.executionPlanning.status = "COMPLETE";

    state.tasks.executionPlanning.blockedBy = null;

    state.tasks.executionPlanning.blockedReason = null;

    delete state.tasks.executionPlanning.failureReason;

    state.agentStatus = "COMPLETE";

    return state;
  }

  return state;
}

export default executeAction;