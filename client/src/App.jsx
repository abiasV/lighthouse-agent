import { useEffect, useState } from "react";
import ShopWeeklyPlan from "./components/ShopWeeklyPlan";
import TaskOutcomeForm from "./components/TaskOutcomeForm";

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  const [etsyReturnStatus] = useState(() => {
    const status = new URLSearchParams(window.location.search).get("etsy");
    return ["connected", "denied", "expired", "failed", "switched"].includes(status) ? status : null;
  });
  const [view, setView] = useState(() => etsyReturnStatus ? "shopPlan" : "landing");

  useEffect(() => {
    if (!etsyReturnStatus) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("etsy");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [etsyReturnStatus]);

  const [idea, setIdea] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerLoading, setAnswerLoading] = useState(false);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [delegationLoadingTaskId, setDelegationLoadingTaskId] = useState(null);
  const [deliveryLoadingTaskId, setDeliveryLoadingTaskId] = useState(null);
  const [outcomeLoadingTaskId, setOutcomeLoadingTaskId] = useState(null);

  const [verifiedFacts, setVerifiedFacts] = useState({
    productType: "",
    dimensions: "",
    personalization: "",
    material: "",
  });

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });

    return () => {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "auto";
      }
    };
  }, []);

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
  }

  function handleOpenShopPlan() {
    setError("");
    setView("shopPlan");
  }

  function handleBackToLanding() {
    setError("");
    setView("landing");
  }

  async function handleStartAnalysis(event) {
    event.preventDefault();

    const trimmedIdea = idea.trim();

    if (!trimmedIdea) {
      setError("Please enter a product idea.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idea: trimmedIdea,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed.");
      }

      setAnalysis(data);
      setAnswer("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswerSubmit(event) {
    event.preventDefault();

    if (answerLoading) {
      return;
    }

    if (!analysis?.analysisId) {
      setError("Analysis session is missing.");
      return;
    }

    if (!String(answer).trim()) {
      setError("Please enter an answer.");
      return;
    }

    try {
      setAnswerLoading(true);
      setError("");

      const response = await fetch("/api/analysis/input", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          analysisId: analysis.analysisId,
          value: answer,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to continue analysis.");
      }

      setAnalysis(data);
      setAnswer("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAnswerLoading(false);
    }
  }

  async function handleStartExecution() {
    if (!analysis?.analysisId) {
      setError("Analysis session is missing.");
      return;
    }

    try {
      setExecutionLoading(true);
      setError("");

      const response = await fetch("/api/analysis/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          analysisId: analysis.analysisId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Execution failed.");
      }

      setAnalysis(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setExecutionLoading(false);
    }
  }

  async function handleExternalDelegationDecision(taskId, decision) {
    if (!analysis?.analysisId) {
      setError("Analysis session is missing.");
      return;
    }

    try {
      setDelegationLoadingTaskId(taskId);
      setError("");

      const requestBody = {
        analysisId: analysis.analysisId,
        taskId,
        decision,
      };

      if (decision === "APPROVE") {
        requestBody.verifiedFacts = verifiedFacts;
      }

      const response = await fetch("/api/analysis/delegation/approval", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to record delegation decision.");
      }

      setAnalysis(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDelegationLoadingTaskId(null);
    }
  }

  async function handleExternalDelivery(taskId, scenario) {
    if (!analysis?.analysisId) {
      setError("Analysis session is missing.");
      return;
    }

    try {
      setDeliveryLoadingTaskId(taskId);
      setError("");

      const response = await fetch("/api/analysis/delegation/delivery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          analysisId: analysis.analysisId,
          taskId,
          scenario,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process freelancer delivery.");
      }

      setAnalysis(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeliveryLoadingTaskId(null);
    }
  }

  async function handleTaskOutcome(taskId, outcome) {
    if (!analysis?.analysisId) {
      setError("Analysis session is missing.");
      return;
    }

    try {
      setOutcomeLoadingTaskId(taskId);
      setError("");

      const response = await fetch("/api/analysis/outcome", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          analysisId: analysis.analysisId,
          taskId,
          outcome,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save task outcome.");
      }

      setAnalysis(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setOutcomeLoadingTaskId(null);
    }
  }

  function handleStartNewAnalysis() {
    setAnalysis(null);
    setIdea("");
    setAnswer("");
    setError("");
    setLoading(false);
    setAnswerLoading(false);
    setExecutionLoading(false);
    setDelegationLoadingTaskId(null);
    setDeliveryLoadingTaskId(null);
    setOutcomeLoadingTaskId(null);

    setVerifiedFacts({
      productType: "",
      dimensions: "",
      personalization: "",
      material: "",
    });

    setView("landing");

    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      });
    });
  }

  function formatStatus(status) {
    if (!status) {
      return "";
    }

    return status
      .toLowerCase()
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function getTaskStatusClasses(status) {
    if (status === "COMPLETE") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300";
    }

    if (status === "AWAITING_APPROVAL") {
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300";
    }

    if (status === "APPROVED") {
      return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300";
    }

    if (
      status === "REJECTED" ||
      status === "FAILED" ||
      status === "REVISION_REQUIRED"
    ) {
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300";
    }

    return "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
  }

  function formatDelegationSignal(signal) {
    if (signal === "THUMBNAIL_QUALITY_SIGNAL") {
      return "Visual quality signal";
    }

    return formatStatus(signal);
  }

  function formatConfidence(confidence) {
    if (!confidence) {
      return "Unknown confidence";
    }

    return `${formatStatus(confidence)} confidence`;
  }

  function getFinalMessage(status) {
    if (status === "WORTH_TESTING") {
      return "Your idea shows promising potential and is worth testing.";
    }

    if (status === "NEEDS_MORE_RESEARCH") {
      return "Your idea may have potential, but more research is needed before moving forward.";
    }

    if (status === "REJECT") {
      return "This idea currently shows significant weaknesses that should be addressed before testing.";
    }

    return "Lighthouse has completed the analysis of your idea.";
  }

  function getCriterionDetails(name, criterion) {
    if (!criterion) {
      return [];
    }

    if (name === "Demand") {
      const demandEvidence = criterion.evidence?.[0]?.value;
      return demandEvidence ? [String(demandEvidence)] : [];
    }

    if (name === "Competition") {
      const competitionEvidence = criterion.evidence?.[0]?.value;

      return competitionEvidence ? [String(competitionEvidence)] : [];
    }

    if (name === "Profitability") {
      const details = [];

      if (criterion.unitEconomics?.profitPerSale != null) {
        details.push(
          `${criterion.currency || ""} ${
            criterion.unitEconomics.profitPerSale
          } estimated profit per sale`,
        );
      }

      if (criterion.unitEconomics?.breakEvenSales != null) {
        details.push(
          `${criterion.unitEconomics.breakEvenSales} sales to break even`,
        );
      }

      return details;
    }

    if (name === "Effort") {
      const details = [];

      if (criterion.minutesPerOrder != null) {
        details.push(`${criterion.minutesPerOrder} minutes of work per order`);
      }

      if (criterion.humanDependency) {
        details.push(
          `${formatStatus(criterion.humanDependency)} human dependency`,
        );
      }

      return details;
    }

    if (name === "Scalability") {
      const details = [];

      if (criterion.ordersPerHourWithoutExtraHelp != null) {
        details.push(
          `${criterion.ordersPerHourWithoutExtraHelp} orders per hour without extra help`,
        );
      }

      if (criterion.manualBottleneckLevel) {
        details.push(
          `${formatStatus(criterion.manualBottleneckLevel)} manual bottleneck`,
        );
      }

      return details;
    }

    return [];
  }

  function renderCriterionCard(name, criterion) {
    if (!criterion) {
      return null;
    }

    const details = getCriterionDetails(name, criterion);

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold">{name}</p>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {formatConfidence(criterion.confidence)}
            </p>
          </div>

          <div className="text-right">
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {criterion.score}
            </p>

            <p className="text-xs text-slate-400">/ 10</p>
          </div>
        </div>

        {details.length > 0 && (
          <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 dark:border-slate-800">
            {details.map((detail) => (
              <p
                key={detail}
                className="text-sm leading-6 text-slate-600 dark:text-slate-300"
              >
                {detail}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderExecutionPlan() {
    const plan = analysis?.executionPlan;

    if (!plan?.tasks?.length) {
      return null;
    }

    const hasReadySafeTask = plan.tasks.some(
      (task) => task.status === "READY" && task.riskLevel === "SAFE_AUTOMATION",
    );

    const hasCompletedTask = plan.tasks.some(
      (task) => task.status === "COMPLETE",
    );

    const externalTask = plan.tasks.find(
      (task) =>
        task.executorType === "EXTERNAL" && task.riskLevel === "MONEY_REQUIRED",
    );

    const isDelegationPending = externalTask?.status === "AWAITING_APPROVAL";

    const isDelegationApproved = externalTask?.status === "APPROVED";

    const isRevisionRequired = externalTask?.status === "REVISION_REQUIRED";

    const isDelegationComplete = externalTask?.status === "COMPLETE";

    const isDelegationRejected = externalTask?.status === "REJECTED";

    const delegationLoading = delegationLoadingTaskId === externalTask?.id;

    const deliveryLoading = deliveryLoadingTaskId === externalTask?.id;

    const brief = externalTask?.delegation?.brief;

    const failedCriteria =
      externalTask?.delegation?.delivery?.failedCriteria ?? [];

    function updateVerifiedFact(field, value) {
      setVerifiedFacts((currentFacts) => ({
        ...currentFacts,
        [field]: value,
      }));
    }

    return (
      <section className="mt-8 border-t border-slate-200 pt-8 dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
            Execution Plan
          </p>

          <h3 className="mt-2 text-2xl font-bold">Recommended next steps</h3>

          {plan.summary && (
            <p className="mt-2 leading-7 text-slate-600 dark:text-slate-300">
              {plan.summary}
            </p>
          )}
        </div>

        <div className="mt-5 space-y-4">
          {plan.tasks.map((task, index) => (
            <div
              key={task.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Task {index + 1}
                  </p>

                  <h4 className="mt-1 text-lg font-bold">{task.title}</h4>

                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {task.description}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${getTaskStatusClasses(
                    task.status,
                  )}`}
                >
                  {formatStatus(task.status)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  {formatStatus(task.executorType)}
                </span>

                <span className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {formatStatus(task.riskLevel)}
                </span>
              </div>

              {task.executorType === "EXTERNAL" && task.delegationReason && (
                <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
                  <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                    Why Lighthouse recommends a specialist
                  </p>

                  <p className="mt-2 text-sm leading-6 text-indigo-800 dark:text-indigo-300">
                    {task.delegationReason}
                  </p>

                  {task.detectedFrom && (
                    <p className="mt-2 text-xs text-indigo-600 dark:text-indigo-400">
                      Detected from: {formatDelegationSignal(task.detectedFrom)}
                    </p>
                  )}
                </div>
              )}

              {task.budget && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                  Estimated budget: {task.budget.currency} {task.budget.min}–
                  {task.budget.max}
                </div>
              )}

              {task.acceptanceCriteria?.length > 0 && (
                <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <p className="text-sm font-semibold">Acceptance criteria</p>

                  <ul className="mt-3 space-y-2">
                    {task.acceptanceCriteria.map(
                      (criterion, criterionIndex) => (
                        <li
                          key={`${task.id}-criterion-${criterionIndex}`}
                          className="flex gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300"
                        >
                          <span aria-hidden="true">
                            {task.verificationResults?.[criterionIndex]
                              ?.status === "PASSED"
                              ? "✓"
                              : task.verificationResults?.[criterionIndex]
                                    ?.status === "FAILED"
                                ? "✕"
                                : "○"}
                          </span>

                          <span>
                            {criterion.description}

                            <span className="ml-2 text-xs text-slate-400">
                              ({formatStatus(criterion.evaluationType)})
                            </span>

                            {task.verificationResults?.[criterionIndex]
                              ?.reason && (
                              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                {
                                  task.verificationResults[criterionIndex]
                                    .reason
                                }
                              </span>
                            )}
                          </span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}
              {task.status === "COMPLETE" && (
                <TaskOutcomeForm
                  task={task}
                  onSave={handleTaskOutcome}
                  loading={outcomeLoadingTaskId === task.id}
                />
              )}
            </div>
          ))}
        </div>

        {hasReadySafeTask && (
          <button
            type="button"
            onClick={handleStartExecution}
            disabled={executionLoading}
            className="mt-6 w-full cursor-pointer rounded-xl bg-emerald-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]"
          >
            {executionLoading
              ? "Executing..."
              : hasCompletedTask
                ? "Continue Execution"
                : "Start Execution"}
          </button>
        )}

        {!hasReadySafeTask && externalTask && isDelegationPending && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">
              Your approval is required
            </p>

            <h4 className="mt-2 text-xl font-bold text-amber-950 dark:text-amber-100">
              External specialist recommended
            </h4>

            <p className="mt-2 text-sm leading-6 text-amber-900 dark:text-amber-200">
              Lighthouse determined that this step is better suited to a
              specialist rather than automatic AI execution.
            </p>

            <div className="mt-4 rounded-xl border border-amber-200 bg-white/70 p-4 dark:border-amber-900 dark:bg-slate-950/40">
              <p className="text-sm font-semibold">
                Why this is being delegated
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {externalTask.delegationReason}
              </p>

              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Signal: {formatDelegationSignal(externalTask.detectedFrom)}
              </p>
            </div>

            <div className="mt-4">
              <p className="font-semibold">Confirmed product facts</p>

              <p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-300">
                Enter only facts you know are correct. Leave anything unknown
                blank. Lighthouse will store missing values as UNKNOWN rather
                than guessing.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Product type
                  <input
                    type="text"
                    value={verifiedFacts.productType}
                    onChange={(event) =>
                      updateVerifiedFact("productType", event.target.value)
                    }
                    placeholder="e.g. Digital invitation"
                    className="mt-1.5 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>

                <label className="text-sm font-medium">
                  Dimensions
                  <input
                    type="text"
                    value={verifiedFacts.dimensions}
                    onChange={(event) =>
                      updateVerifiedFact("dimensions", event.target.value)
                    }
                    placeholder="e.g. 8 x 10 inches"
                    className="mt-1.5 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>

                <label className="text-sm font-medium">
                  Personalization
                  <input
                    type="text"
                    value={verifiedFacts.personalization}
                    onChange={(event) =>
                      updateVerifiedFact("personalization", event.target.value)
                    }
                    placeholder="e.g. Yes"
                    className="mt-1.5 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>

                <label className="text-sm font-medium">
                  Material
                  <input
                    type="text"
                    value={verifiedFacts.material}
                    onChange={(event) =>
                      updateVerifiedFact("material", event.target.value)
                    }
                    placeholder="Leave blank if unknown"
                    className="mt-1.5 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() =>
                  handleExternalDelegationDecision(externalTask.id, "APPROVE")
                }
                disabled={delegationLoading}
                className="cursor-pointer rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {delegationLoading
                  ? "Saving decision..."
                  : `Approve CAD ${externalTask.budget.min}–${externalTask.budget.max}`}
              </button>

              <button
                type="button"
                onClick={() =>
                  handleExternalDelegationDecision(externalTask.id, "REJECT")
                }
                disabled={delegationLoading}
                className="cursor-pointer rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Reject delegation
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-400">
              Approval prepares the delegation brief only. No freelancer is
              hired and no money is spent yet.
            </p>
          </div>
        )}

        {externalTask && isDelegationApproved && brief && (
          <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-indigo-900 dark:bg-indigo-950/20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
              Delegation approved
            </p>

            <h4 className="mt-2 text-xl font-bold">
              Freelancer brief prepared
            </h4>

            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {brief.requestedWork}
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-indigo-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-sm font-semibold">Verified facts</p>

                <dl className="mt-3 space-y-2 text-sm">
                  {Object.entries(brief.verifiedFacts ?? {}).map(
                    ([key, value]) => (
                      <div key={key} className="flex justify-between gap-4">
                        <dt className="text-slate-500 dark:text-slate-400">
                          {formatStatus(key)}
                        </dt>

                        <dd className="font-medium text-right">{value}</dd>
                      </div>
                    ),
                  )}
                </dl>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-sm font-semibold">Deliverables</p>

                <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {brief.deliverables?.map((deliverable) => (
                    <li key={deliverable.id} className="flex gap-2">
                      <span>•</span>
                      <span>{deliverable.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm font-semibold">Local delivery test</p>

              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                These controls simulate the future freelancer delivery step
                without hiring anyone or spending money.
              </p>

              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    handleExternalDelivery(externalTask.id, "GOOD_DELIVERABLE")
                  }
                  disabled={deliveryLoading}
                  className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Simulate complete delivery
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleExternalDelivery(
                      externalTask.id,
                      "DELIVERABLE_MISSING_REQUIREMENT",
                    )
                  }
                  disabled={deliveryLoading}
                  className="cursor-pointer rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                >
                  Simulate incomplete delivery
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleExternalDelivery(
                      externalTask.id,
                      "UNVERIFIED_PRODUCT_FACT",
                    )
                  }
                  disabled={deliveryLoading}
                  className="cursor-pointer rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
                >
                  Simulate unverified fact
                </button>
              </div>
            </div>
          </div>
        )}

        {externalTask && isRevisionRequired && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-900 dark:bg-rose-950/20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600 dark:text-rose-400">
              Revision required
            </p>

            <h4 className="mt-2 text-xl font-bold text-rose-950 dark:text-rose-100">
              The freelancer deliverable needs changes
            </h4>

            <p className="mt-2 text-sm leading-6 text-rose-800 dark:text-rose-300">
              Lighthouse did not accept the deliverable because one or more
              requirements failed verification.
            </p>

            <div className="mt-4 space-y-3">
              {failedCriteria.map((criterion, index) => (
                <div
                  key={`${criterion.description}-${index}`}
                  className="rounded-xl border border-rose-200 bg-white p-4 dark:border-rose-900 dark:bg-slate-950"
                >
                  <p className="text-sm font-semibold">
                    {criterion.description}
                  </p>

                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {criterion.reason}
                  </p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                handleExternalDelivery(externalTask.id, "GOOD_DELIVERABLE")
              }
              disabled={deliveryLoading}
              className="mt-5 cursor-pointer rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deliveryLoading
                ? "Checking revision..."
                : "Simulate corrected delivery"}
            </button>

            <p className="mt-3 text-xs text-rose-700 dark:text-rose-400">
              The task remains blocked until the corrected deliverable passes
              verification.
            </p>
          </div>
        )}

        {externalTask && isDelegationComplete && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
              Verification passed
            </p>

            <h4 className="mt-2 text-xl font-bold text-emerald-950 dark:text-emerald-100">
              External task complete
            </h4>

            <p className="mt-2 text-sm leading-6 text-emerald-800 dark:text-emerald-300">
              The freelancer deliverable passed all acceptance criteria,
              including the verified product facts constraint.
            </p>
          </div>
        )}

        {externalTask && isDelegationRejected && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
            <p className="font-semibold">Delegation declined</p>

            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              No freelancer was hired and no money was spent.
            </p>
          </div>
        )}
      </section>
    );
  }

  function renderAnswerInput() {
    const field = analysis?.pendingInput?.field;
    const expectedType = analysis?.pendingInput?.expectedType;

    function handleAnswerChange(value) {
      setAnswer(value);

      if (error) {
        setError("");
      }
    }

    if (field === "currency") {
      return (
        <select
          key={field}
          autoFocus
          value={answer}
          onChange={(event) => handleAnswerChange(event.target.value)}
          className="w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3.5 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="">Select currency</option>
          <option value="CAD">CAD — Canadian Dollar</option>
          <option value="USD">USD — US Dollar</option>
          <option value="EUR">EUR — Euro</option>
        </select>
      );
    }

    if (field === "humanDependencyChoice") {
      const options = ["VERY LITTLE", "SOMEWHAT", "A LOT"];

      return (
        <div className="grid gap-2 sm:grid-cols-3">
          {options.map((option) => {
            const isSelected = answer === option;

            const label =
              option === "VERY LITTLE"
                ? "Very little"
                : option === "SOMEWHAT"
                  ? "Somewhat"
                  : "A lot";

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleAnswerChange(option)}
                className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      );
    }

    const isNumericInput =
      expectedType === "currency" || expectedType === "number";

    let minimumValue;

    if (field === "sellingPrice") {
      minimumValue = "0.01";
    } else if (field === "parallelOrders") {
      minimumValue = "1";
    } else if (isNumericInput) {
      minimumValue = "0";
    }

    return (
      <input
        key={field}
        autoFocus
        type={isNumericInput ? "number" : "text"}
        inputMode={isNumericInput ? "decimal" : undefined}
        value={answer}
        onChange={(event) => handleAnswerChange(event.target.value)}
        min={minimumValue}
        step={expectedType === "currency" ? "0.01" : "any"}
        placeholder={isNumericInput ? "Enter a number" : "Enter your answer"}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-600"
      />
    );
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-slate-50 via-white to-orange-50/40 px-5 py-6 text-slate-900 transition-colors duration-300 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBackToLanding}
            className="flex cursor-pointer items-center gap-3 text-left"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F1641E] text-xl font-bold text-white shadow-lg shadow-orange-200/60 dark:shadow-none">
              L
            </div>

            <div>
              <h1 className="font-serif text-2xl font-bold tracking-tight text-[#F1641E]">
                Lighthouse
              </h1>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                AI Growth Operator for Etsy Sellers
              </p>
            </div>
          </button>

          {!analysis && view === "landing" && (
            <nav className="hidden items-center gap-6 lg:flex">
              <a
                href="#how-it-works"
                className="text-sm font-medium text-slate-600 transition hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400"
              >
                How it works
              </a>

              <a
                href="#why-lighthouse"
                className="text-sm font-medium text-slate-600 transition hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400"
              >
                Why Lighthouse
              </a>

              <a
                href="#pricing"
                className="text-sm font-medium text-slate-600 transition hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400"
              >
                Pricing
              </a>
            </nav>
          )}

          <div className="flex items-center gap-3">
            {!analysis && view === "landing" && (
              <button
                type="button"
                onClick={handleOpenShopPlan}
                className="hidden cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 sm:inline-flex"
              >
                Start Free
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span>{theme === "light" ? "🌙" : "☀️"}</span>

              <span className="hidden sm:inline">
                {theme === "light" ? "Dark mode" : "Light mode"}
              </span>
            </button>
          </div>
        </header>

        {!analysis && view === "shopPlan" && (
          <ShopWeeklyPlan onBack={handleBackToLanding} etsyReturnStatus={etsyReturnStatus} />
        )}

        {!analysis && view === "landing" && (
          <>
            <section className="py-16 lg:py-24">
              <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
                <div>
                  <h2 className="max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl">
                    Stop guessing
                    <span className="block text-indigo-600 dark:text-indigo-400">
                      what to do next.
                    </span>
                  </h2>

                  <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-400">
                    Lighthouse helps Etsy sellers analyze opportunities,
                    prioritize the highest-impact actions, and execute the next
                    best steps with less manual work.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3 text-sm font-medium text-indigo-800 dark:text-indigo-200">
                    <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/70 px-3 py-2 dark:border-indigo-900 dark:bg-indigo-950/30">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-[#F1641E]"
                      />
                      Listing recovery
                    </span>

                    <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/70 px-3 py-2 dark:border-indigo-900 dark:bg-indigo-950/30">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-[#F1641E]"
                      />
                      Growth prioritization
                    </span>

                    <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/70 px-3 py-2 dark:border-indigo-900 dark:bg-indigo-950/30">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-[#F1641E]"
                      />
                      Outcome tracking
                    </span>
                  </div>

                  <div
                    id="analysis-form"
                    className="mt-8 max-w-2xl scroll-mt-8 rounded-3xl border-2 border-[#F1641E]/70 bg-white p-6 shadow-xl shadow-orange-100/70 ring-1 ring-[#F1641E]/20 dark:border-[#F1641E]/60 dark:bg-slate-900 dark:shadow-none dark:ring-[#F1641E]/20"
                  >
                    <div className="mb-4 flex items-center gap-2">
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#F1641E]" />

                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F1641E]">
                        Existing Shop
                      </p>
                    </div>

                    <h3 className="text-xl font-bold">
                      Find out what deserves your attention this week.
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                      Add your listing performance data and let Lighthouse
                      prioritize the highest-impact actions for your shop.
                    </p>

                    <button
                      type="button"
                      onClick={handleOpenShopPlan}
                      className="mt-5 w-full cursor-pointer rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 active:scale-[0.99]"
                    >
                      Build My Weekly Growth Plan
                    </button>

                    <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Testing a new product idea?
                      </p>

                      <form
                        id="opportunity-analysis-form"
                        onSubmit={handleStartAnalysis}
                        className="mt-3"
                      >
                        <label
                          htmlFor="idea"
                          className="mb-2 block text-sm font-semibold"
                        >
                          Evaluate a new Etsy product idea
                        </label>

                        <input
                          id="idea"
                          type="text"
                          value={idea}
                          onChange={(event) => setIdea(event.target.value)}
                          placeholder="Example: Printable puppy training planner"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base outline-none transition placeholder:text-slate-400 focus:border-[#F1641E] focus:ring-4 focus:ring-[#F1641E]/10 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-600"
                        />

                        <button
                          type="submit"
                          disabled={loading}
                          className="mt-3 w-full cursor-pointer rounded-xl border border-indigo-300 bg-indigo-50 px-5 py-3 font-semibold text-indigo-800 shadow-sm transition hover:border-indigo-500 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/80"
                        >
                          {loading
                            ? "Evaluating..."
                            : "Evaluate This Product Idea"}
                        </button>
                      </form>
                    </div>

                    {error && (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -left-6 -top-8 h-40 w-40 rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-900/30" />

                  <div className="absolute -bottom-8 -right-8 h-40 w-40 rounded-full bg-orange-200/50 blur-3xl dark:bg-orange-950/20" />

                  <div className="relative rounded-4xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-300/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#F1641E]">
                          Etsy Shop
                        </p>

                        <h3 className="mt-1 text-lg font-bold">
                          Your Growth Overview
                        </h3>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Illustrative preview
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                        <p className="text-xs text-slate-500">
                          Listings analyzed
                        </p>

                        <p className="mt-2 text-2xl font-bold">42</p>
                      </div>

                      <div className="rounded-2xl bg-indigo-50 p-4 dark:bg-indigo-950/40">
                        <p className="text-xs text-indigo-600 dark:text-indigo-300">
                          Opportunities found
                        </p>

                        <p className="mt-2 text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                          3
                        </p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="text-sm font-semibold">
                        Highest-impact actions
                      </p>

                      <div className="mt-3 space-y-3">
                        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            ↑
                          </div>

                          <div>
                            <p className="text-sm font-semibold">
                              Improve listing performance
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                              Update weak title positioning and underperforming
                              keywords.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                            ✦
                          </div>

                          <div>
                            <p className="text-sm font-semibold">
                              Test a new product opportunity
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                              Validate demand before spending time creating the
                              product.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                            ✓
                          </div>

                          <div>
                            <p className="text-sm font-semibold">
                              Execute safe actions
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                              Automate low-risk work and pause before money or
                              approval is required.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white dark:bg-black">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="h-3 w-3 rounded-full bg-indigo-400"
                        />

                        <div>
                          <p className="text-sm font-semibold">
                            Example Lighthouse workflow
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            Analyze → Prioritize → Execute
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section
              id="how-it-works"
              className="scroll-mt-12 border-t border-slate-200 py-20 dark:border-slate-800"
            >
              <div className="text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                  How it works
                </p>

                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  From uncertainty to action
                </h2>

                <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600 dark:text-slate-400">
                  Lighthouse turns scattered research and decisions into a clear
                  execution workflow.
                </p>
              </div>

              <div className="mt-12 grid gap-8 text-center md:grid-cols-3">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                    1
                  </div>

                  <p className="mt-4 text-lg font-bold">Analyze</p>

                  <p className="mt-1 text-sm font-medium">
                    Understand opportunities
                  </p>

                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Evaluate demand, competition, profitability, effort, and
                    scalability.
                  </p>
                </div>

                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                    2
                  </div>

                  <p className="mt-4 text-lg font-bold">Prioritize</p>

                  <p className="mt-1 text-sm font-medium">
                    Focus on what matters
                  </p>

                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Turn research into clear, ranked actions instead of
                    scattered recommendations.
                  </p>
                </div>

                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                    3
                  </div>

                  <p className="mt-4 text-lg font-bold">Execute</p>

                  <p className="mt-1 text-sm font-medium">
                    Move from insight to action
                  </p>

                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Automate safe tasks and pause when your approval is
                    required.
                  </p>
                </div>
              </div>
            </section>

            <section id="why-lighthouse" className="scroll-mt-12 py-20">
              <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                    Why Lighthouse
                  </p>

                  <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                    More than another AI chat.
                  </h2>

                  <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-400">
                    General AI tools can generate answers. Lighthouse is
                    designed to help Etsy sellers manage the workflow around
                    those answers.
                  </p>

                  <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
                    <p className="font-semibold text-indigo-900 dark:text-indigo-200">
                      General AI chat tools give you answers.
                    </p>

                    <p className="mt-2 text-sm leading-6 text-indigo-700 dark:text-indigo-300">
                      Lighthouse helps you decide what matters, execute the
                      work, and track what happens next.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      title: "Remember your shop",
                      description:
                        "Keep context about products, decisions, and previous actions in one workflow.",
                    },
                    {
                      title: "Prioritize actions",
                      description:
                        "Focus on the highest-impact opportunities instead of juggling scattered suggestions.",
                    },
                    {
                      title: "Execute the work",
                      description:
                        "Move beyond recommendations and automate safe tasks when possible.",
                    },
                    {
                      title: "Measure results",
                      description:
                        "Track what changed and use the results to improve future decisions.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-lg text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                        ✓
                      </div>

                      <h3 className="mt-4 font-bold">{item.title}</h3>

                      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="py-16" aria-labelledby="seller-stories-title">
              <div className="relative overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-orange-50 p-8 text-center shadow-sm dark:border-indigo-900 dark:from-indigo-950/40 dark:via-slate-900 dark:to-orange-950/20 sm:p-10">
                <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-800/20" />

                <div className="relative">
                  <span className="inline-flex rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                    Coming soon
                  </span>

                  <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                    Seller stories
                  </p>

                  <h2
                    id="seller-stories-title"
                    className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl"
                  >
                    Real seller results are on the way.
                  </h2>

                  <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600 dark:text-slate-400">
                    We are currently validating Lighthouse with real Etsy
                    sellers. As verified results become available, this section
                    will share what sellers found useful and what changed after
                    they acted.
                  </p>

                  <div className="mt-7 flex flex-wrap justify-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {[
                      "Seller feedback",
                      "Before & after results",
                      "Verified time saved",
                    ].map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-2 rounded-full border border-white bg-white/80 px-4 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
                      >
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full bg-[#F1641E]"
                        />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section
              id="pricing"
              className="scroll-mt-12 border-t border-slate-200 py-20 dark:border-slate-800"
            >
              <div className="text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                  Simple pricing
                </p>

                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  Start free. Upgrade when Lighthouse saves you more work.
                </h2>

                <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600 dark:text-slate-400">
                  Pricing below is an early product hypothesis and will be
                  refined after real seller testing.
                </p>
              </div>

              <div className="mt-12 grid gap-6 lg:grid-cols-3">
                <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-sm font-semibold text-slate-500">Free</p>

                  <div className="mt-3">
                    <span className="text-4xl font-bold">$0</span>
                    <span className="ml-1 text-slate-500">/ month</span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    For sellers exploring Lighthouse.
                  </p>

                  <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                    <li>✓ 3 opportunity analyses per month</li>
                    <li>✓ Basic opportunity scoring</li>
                    <li>✓ Limited execution preview</li>
                    <li className="text-slate-400 dark:text-slate-500">
                      — Continuous monitoring not included
                    </li>
                  </ul>

                  <button
                    type="button"
                    onClick={handleOpenShopPlan}
                    className="mt-8 w-full cursor-pointer rounded-xl border border-slate-300 px-4 py-3 font-semibold transition hover:border-indigo-500 hover:text-indigo-600 dark:border-slate-700 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                  >
                    Start Free
                  </button>
                </div>

                <div className="relative flex h-full flex-col rounded-3xl border-2 border-indigo-500 bg-white p-7 shadow-xl shadow-indigo-100 dark:bg-slate-900 dark:shadow-none">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white">
                    Most Popular
                  </div>

                  <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                    Growth
                  </p>

                  <div className="mt-3">
                    <span className="text-4xl font-bold">$29</span>
                    <span className="ml-1 text-slate-500">/ month</span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    For active Etsy sellers who want more execution.
                  </p>

                  <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                    <li>✓ 30 analyses per month</li>
                    <li>✓ AI execution</li>
                    <li>✓ Prioritized growth actions</li>
                    <li>✓ Execution history</li>
                    <li>✓ Approval controls</li>
                    <li>✓ Future Etsy shop connection</li>
                  </ul>

                  <button
                    type="button"
                    onClick={handleOpenShopPlan}
                    className="mt-8 w-full cursor-pointer rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700"
                  >
                    Start with Growth
                  </button>
                </div>

                <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-sm font-semibold text-slate-500">Pro</p>

                  <div className="mt-3">
                    <span className="text-4xl font-bold">$79</span>
                    <span className="ml-1 text-slate-500">/ month</span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    For serious sellers with higher usage needs.
                  </p>

                  <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                    <li>✓ Higher monthly usage limits</li>
                    <li>✓ More AI execution credits</li>
                    <li>✓ Multiple opportunity workflows</li>
                    <li>✓ Advanced monitoring</li>
                    <li>✓ Priority processing</li>
                    <li>✓ Deeper shop insights</li>
                  </ul>

                  <button
                    type="button"
                    onClick={handleOpenShopPlan}
                    className="mt-8 w-full cursor-pointer rounded-xl border border-slate-300 px-4 py-3 font-semibold transition hover:border-indigo-500 hover:text-indigo-600 dark:border-slate-700 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                  >
                    Explore Pro
                  </button>
                </div>
              </div>
            </section>

            <section className="pb-24 pt-8">
              <div className="rounded-4xl bg-slate-950 px-6 py-12 text-center text-white sm:px-12 dark:bg-black">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
                  Ready to test Lighthouse?
                </p>

                <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
                  Find the highest-impact actions for your Etsy shop.
                </h2>

                <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-300">
                  Start with your shop data, get a prioritized weekly plan, and
                  use Lighthouse to decide what deserves attention next.
                </p>

                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleOpenShopPlan}
                    className="cursor-pointer rounded-xl bg-indigo-500 px-6 py-3.5 font-semibold text-white transition hover:bg-indigo-400"
                  >
                    Build My Weekly Growth Plan
                  </button>
                </div>

                <p className="mt-4 text-xs text-slate-500">
                  No credit card required.
                </p>
              </div>
            </section>
          </>
        )}

        {analysis && (
          <section className="flex min-h-[75vh] items-center justify-center py-16">
            <div
              className={`w-full ${
                analysis?.agentStatus === "COMPLETE" ? "max-w-4xl" : "max-w-2xl"
              }`}
            >
              <div className="mb-5 flex justify-center">
                <span className="rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-sm font-medium text-[#F1641E] dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300">
                  Etsy Opportunity Analysis
                </span>
              </div>

              <div className="text-center">
                <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
                  Turn insight into
                  <span className="block text-indigo-600 dark:text-indigo-400">
                    your next best action.
                  </span>
                </h2>

                <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg dark:text-slate-400">
                  Lighthouse evaluates the opportunity, builds an execution
                  plan, and helps you move forward with clear next steps.
                </p>
              </div>

              <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                {error && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                  </div>
                )}

                {analysis?.pendingInput && (
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950/40">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Lighthouse needs more information
                    </p>

                    <p className="mt-2 text-lg font-semibold">
                      {analysis.pendingInput.question}
                    </p>

                    <form onSubmit={handleAnswerSubmit} className="mt-4">
                      {renderAnswerInput()}

                      <button
                        type="submit"
                        disabled={answerLoading || !String(answer).trim()}
                        className="mt-3 w-full cursor-pointer rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {answerLoading ? "Continuing..." : "Continue"}
                      </button>
                    </form>
                  </div>
                )}

                {analysis &&
                  !analysis.pendingInput &&
                  analysis.agentStatus === "COMPLETE" && (
                    <div>
                      <div className="text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                          Analysis Complete
                        </p>

                        <div className="mt-4">
                          <span className="text-5xl font-bold tracking-tight">
                            {analysis.finalScore}
                          </span>

                          <span className="ml-1 text-xl font-semibold text-slate-400">
                            / 10
                          </span>
                        </div>

                        <h3 className="mt-3 text-2xl font-bold">
                          {formatStatus(analysis.finalStatus)}
                        </h3>

                        <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600 dark:text-slate-300">
                          {getFinalMessage(analysis.finalStatus)}
                        </p>
                      </div>

                      <div className="mt-8 grid gap-4 sm:grid-cols-2">
                        {renderCriterionCard(
                          "Demand",
                          analysis.criteria?.demand,
                        )}

                        {renderCriterionCard(
                          "Competition",
                          analysis.criteria?.competition,
                        )}

                        {renderCriterionCard(
                          "Profitability",
                          analysis.criteria?.profitability,
                        )}

                        {renderCriterionCard(
                          "Effort",
                          analysis.criteria?.effort,
                        )}

                        {renderCriterionCard(
                          "Scalability",
                          analysis.criteria?.scalability,
                        )}
                      </div>

                      {renderExecutionPlan()}

                      <button
                        type="button"
                        onClick={handleStartNewAnalysis}
                        className="mt-8 w-full cursor-pointer rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 active:scale-[0.99]"
                      >
                        Start New Analysis
                      </button>
                    </div>
                  )}
              </div>

              <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-600">
                From insight to action — with you in control.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default App;
