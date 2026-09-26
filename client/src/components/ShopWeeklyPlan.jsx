import { useState } from "react";
import { createSamplePlanner, buildMockEtsySnapshot } from "../utils/samplePlanner.js";
import TaskOutcomeForm from "./TaskOutcomeForm";
import EtsyMissingEvidence from "./EtsyMissingEvidence";
import EtsyConnection from "./EtsyConnection";
import EtsySalesImport from "./EtsySalesImport";
import { mergeEtsySales, clearPeriodMetrics } from "../utils/etsySales.js";
import PilotListingReview from "./PilotListingReview";
import PilotConsent from "./PilotConsent";
import { defaultReportingPeriod, normalizeReportingPeriod, todayInTimeZone, shiftDate, PERIOD_ERRORS } from "../../../shared/reportingPeriod.js";

function createEmptyListing() {
  return {
    id: crypto.randomUUID(),
    title: "",
    views: "",
    sales: "",
    trendPercent: "",
  };
}

function isWholeNonNegativeNumber(value) {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    return false;
  }

  const numericValue = Number(normalizedValue);

  return Number.isInteger(numericValue) && numericValue >= 0;
}

function getManualFormErrors({
  shopName,
  weeklyAvailableMinutes,
  listings,
}) {
  const errors = [];

  if (!shopName.trim()) {
    errors.push("Enter your shop name.");
  }

  if (!isWholeNonNegativeNumber(weeklyAvailableMinutes)) {
    errors.push("Enter your available minutes as a whole number of 0 or more.");
  }

  const startedListings = listings
    .map((listing, index) => ({ listing, index }))
    .filter(({ listing }) =>
      [listing.title, listing.views, listing.sales, listing.trendPercent].some(
        (value) => String(value ?? "").trim(),
      ),
    );

  if (startedListings.length === 0) {
    errors.push("Complete at least one listing with its title, views, and sales.");
  }

  startedListings.forEach(({ listing, index }) => {
    const listingLabel = `Listing ${index + 1}`;

    if (!listing.title.trim()) {
      errors.push(`${listingLabel}: enter the listing title.`);
    }

    if (!isWholeNonNegativeNumber(listing.views)) {
      errors.push(`${listingLabel}: enter views as a whole number of 0 or more.`);
    }

    if (!isWholeNonNegativeNumber(listing.sales)) {
      errors.push(`${listingLabel}: enter sales as a whole number of 0 or more.`);
    }

    const trendValue = String(listing.trendPercent ?? "").trim();

    if (
      trendValue &&
      (!Number.isFinite(Number(trendValue)) || Number(trendValue) < -100)
    ) {
      errors.push(
        `${listingLabel}: leave sales trend blank or enter a percentage of -100 or more.`,
      );
    }
  });

  return errors;
}

async function readJsonResponse(response) {
  const responseText = await response.text();

  if (!responseText) {
    throw new Error(
      response.ok
        ? "The server returned an empty response."
        : `Request failed with status ${response.status}.`,
    );
  }

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "The server returned an invalid response. Please try again.",
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message || data.error || `Request failed with status ${response.status}.`,
    );
  }

  return data;
}

function ShopWeeklyPlan({ onBack, etsyReturnStatus }) {
  const [reportingPeriod, setReportingPeriod] = useState(() => defaultReportingPeriod());
  const [etsyPeriodConfirmed, setEtsyPeriodConfirmed] = useState(false);
  const [shopName, setShopName] = useState("");
  const [pilot, setPilot] = useState(null);
  const [samplePlanner] = useState(createSamplePlanner);
  const [pilotDraftVersion, setPilotDraftVersion] = useState(0);
  const [catalogImported, setCatalogImported] = useState(false);
  const [importedShopId, setImportedShopId] = useState(null);
  const [periodNotice, setPeriodNotice] = useState("");

  const [weeklyAvailableMinutes, setWeeklyAvailableMinutes] = useState("180");

  const [listings, setListings] = useState([
    createEmptyListing(),
    createEmptyListing(),
    createEmptyListing(),
  ]);

  const [plan, setPlan] = useState(null);

  const [dataSourceMode, setDataSourceMode] = useState("ETSY");

  const [etsyPlanningResult, setEtsyPlanningResult] = useState(null);

  const [etsyViewInputs, setEtsyViewInputs] = useState({});

  const [etsyLoading, setEtsyLoading] = useState(false);

  const [isFormExpanded, setIsFormExpanded] = useState(true);

  const [loading, setLoading] = useState(false);

  const [executionLoading, setExecutionLoading] = useState(false);

  const [approvalLoadingTaskId, setApprovalLoadingTaskId] = useState(null);

  const [outcomeLoadingTaskId, setOutcomeLoadingTaskId] = useState(null);

  const [error, setError] = useState("");

  const [toast, setToast] = useState("");

  const [highlightedListingId, setHighlightedListingId] = useState(null);

  async function requestShop(path, body) {
    if (dataSourceMode === "ETSY") return samplePlanner.request(path, body);
    const response = await fetch("/api/shop" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return readJsonResponse(response);
  }

  function showToast(message) {
    setToast(message);

    window.setTimeout(() => {
      setToast("");
    }, 2200);
  }

  function handleDataSourceModeChange(mode) {
    if (mode === dataSourceMode) {
      return;
    }

    setDataSourceMode(mode);
    setEtsyPeriodConfirmed(false);

    setPlan(null);

    setIsFormExpanded(true);

    setError("");

    if (mode === "MANUAL") {
      setEtsyPlanningResult(null);
      setEtsyViewInputs({});
    }
  }

  function handleCatalogImport(draft) {
    const hasExistingData = Boolean(plan || shopName.trim() || listings.some(listing =>
      [listing.title, listing.views, listing.sales, listing.trendPercent].some(value => String(value ?? "").trim()),
    ));
    if (hasExistingData && !window.confirm("Replace the current shop form and displayed plan with your Etsy listings? Sales will be requested for the selected dates; views need to be entered again.")) return false;
    setShopName(draft.shopName);
    setImportedShopId(draft.shopId || null);
    setPeriodNotice("");
    setPilotDraftVersion(value => value + 1);
    setListings(draft.listings);
    setCatalogImported(true);
    setDataSourceMode("MANUAL");
    setPlan(null);
    setEtsyPlanningResult(null);
    setEtsyViewInputs({});
    setEtsyPeriodConfirmed(false);
    setIsFormExpanded(true);
    setError("");
    return true;
  }

  function updateListing(id, field, value) {
    setError("");
    setListings((currentListings) =>
      currentListings.map((listing) =>
        listing.id === id
          ? {
              ...listing,
              [field]: value,
              ...(["sales", "trendPercent"].includes(field) ? { salesSource: undefined, salesNeedsReview: false } : {}),
            }
          : listing,
      ),
    );
  }

  function addListing() {
    const newListing = createEmptyListing();

    setListings((currentListings) => [...currentListings, newListing]);

    setHighlightedListingId(newListing.id);

    showToast("Listing added");

    window.setTimeout(() => {
      document.getElementById(`listing-card-${newListing.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);

    window.setTimeout(() => {
      setHighlightedListingId(null);
    }, 1800);
  }

  function removeListing(id) {
    setListings((currentListings) => {
      if (currentListings.length <= 1) {
        return currentListings;
      }

      return currentListings.filter((listing) => listing.id !== id);
    });

    showToast("Listing removed");
  }

  async function handleLoadMockEtsyData() {
    try {
      setEtsyLoading(true);
      setError("");

      const data = await requestShop("/etsy/plan", {
          snapshot: buildMockEtsySnapshot(),
          sellerInputs: [],
          weeklyAvailableMinutes: Number(weeklyAvailableMinutes) || null,
        });

      setEtsyPlanningResult(data);

      setEtsyViewInputs({});
      setEtsyPeriodConfirmed(false);

      setPlan(null);
      showToast("Sample shop data loaded");

      window.setTimeout(() => {
        document.getElementById("etsy-evidence-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setEtsyLoading(false);
    }
  }

  function handleEtsyViewChange(listingId, value) {
    setEtsyPeriodConfirmed(false);
    setEtsyViewInputs((currentValues) => ({
      ...currentValues,
      [listingId]: value,
    }));
  }

  async function handleEtsyEvidenceSubmit(event) {
    event.preventDefault();

    if (!etsyPlanningResult?.missingEvidence?.length) {
      return;
    }

    if (!etsyPeriodConfirmed) {
      setError(PERIOD_ERRORS.SELLER_PERIOD_CONFIRMATION_REQUIRED);
      return;
    }

    const sellerInputs = etsyPlanningResult.missingEvidence.map((item) => ({
      listingId: item.listingId,
      periodViews: Number(etsyViewInputs[item.listingId]),
      period: item.resolution.period,
      periodConfirmed: etsyPeriodConfirmed,
    }));

    try {
      setEtsyLoading(true);
      setError("");

      const data = await requestShop("/etsy/plan", {
          snapshot: buildMockEtsySnapshot(),
          sellerInputs,
          weeklyAvailableMinutes: Number(weeklyAvailableMinutes) || null,
        });

      setEtsyPlanningResult(data);

      if (data.sessionPlan) {
        setPlan(data.sessionPlan);
      }

      showToast("Traffic data added");

      window.setTimeout(() => {
        document.getElementById("etsy-evidence-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setEtsyLoading(false);
    }
  }

  function buildRequestListings() {
    return listings
      .filter((listing) => listing.title.trim())
      .map((listing) => ({
        id: listing.id,
        title: listing.title.trim(),
        views: listing.views.trim() === "" ? null : Number(listing.views),
        sales: listing.sales.trim() === "" ? null : Number(listing.sales),
        trendPercent: listing.trendPercent.trim() === "" ? null : Number(listing.trendPercent),
      }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedShopName = shopName.trim();

    const requestListings = buildRequestListings();

    const isUpdatingExistingPlan = Boolean(plan);

    if (!trimmedShopName) {
      setError("Please enter your shop name.");
      return;
    }

    if (requestListings.length === 0) {
      setError("Please add at least one listing.");
      return;
    }

    try {
      normalizeReportingPeriod(reportingPeriod);

      const validationErrors = getManualFormErrors({
        shopName,
        weeklyAvailableMinutes,
        listings,
      });

      if (validationErrors.length > 0) {
        setError(validationErrors[0]);
        return;
      }

      setLoading(true);
      setError("");

      const response = await fetch("/api/shop/plan", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          shopName: trimmedShopName,
          reportingPeriod,

          weeklyAvailableMinutes: Number(weeklyAvailableMinutes),

          listings: requestListings,
        }),
      });

      const data = await readJsonResponse(response);

      setPlan(data);

      setIsFormExpanded(false);

      showToast(
        isUpdatingExistingPlan
          ? "Weekly growth plan updated"
          : "Weekly growth plan created",
      );

      window.setTimeout(() => {
        document.getElementById("weekly-plan-results")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (requestError) {
      setError(PERIOD_ERRORS[requestError.message] || requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExecuteSafeActions() {
    if (!plan?.shopPlanId) {
      setError("This growth plan does not have an execution session.");

      return;
    }

    try {
      setExecutionLoading(true);
      setError("");

      const data = await requestShop("/execute", {
          shopPlanId: plan.shopPlanId,
        });

      setPlan(data);

      if (data.executedTaskIds?.length > 0) {
        showToast(
          `${data.executedTaskIds.length} safe research actions completed`,
        );
      } else if (data.executionStatus === "AWAITING_APPROVAL") {
        showToast("Approval is required to continue");
      } else {
        showToast("Safe research finished");
      }

      window.setTimeout(() => {
        document.getElementById("execution-results")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setExecutionLoading(false);
    }
  }

  async function handleApproval(taskId, decision) {
    if (!plan?.shopPlanId) {
      setError("This growth plan does not have an approval session.");

      return;
    }

    try {
      setApprovalLoadingTaskId(taskId);
      setError("");

      const data = await requestShop("/approval", {
          shopPlanId: plan.shopPlanId,
          taskId,
          decision,
        });

      setPlan(data);

      showToast(
        decision === "APPROVE"
          ? "Proposed changes approved"
          : "Proposed changes rejected",
      );

      window.setTimeout(() => {
        document.getElementById("approval-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setApprovalLoadingTaskId(null);
    }
  }

  async function handleTaskOutcome(taskId, outcome) {
    if (!plan?.shopPlanId) {
      setError("This growth plan does not have an outcome session.");
      return;
    }

    try {
      setOutcomeLoadingTaskId(taskId);
      setError("");

      const data = await requestShop("/outcome", {
          shopPlanId: plan.shopPlanId,
          taskId,
          outcome,
        });

      setPlan(data);

      showToast("Task outcome saved");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setOutcomeLoadingTaskId(null);
    }
  }

  function getPlainLanguageAction(task) {
    if (task.opportunityType === "IMPROVE_CONVERSION") {
      return "Review conversion barriers";
    }

    if (task.opportunityType === "DIAGNOSE_DECLINE") {
      return "Investigate the decline";
    }

    if (task.opportunityType === "VALIDATE_EXPANSION") {
      return "Explore growth opportunities";
    }

    return task.title;
  }

  function getPlainLanguageSummary(task) {
    if (task.opportunityType === "IMPROVE_CONVERSION") {
      return "Many shoppers see this listing, but too few are buying. Review what may be limiting conversion before making changes.";
    }

    if (task.opportunityType === "DIAGNOSE_DECLINE") {
      return "This listing has sold before, but its recent performance dropped. Find the cause before changing anything.";
    }

    if (task.opportunityType === "VALIDATE_EXPANSION") {
      return "This listing is gaining momentum. Explore related product ideas before investing more time.";
    }

    return task.description;
  }

  function getImpactClasses(expectedImpact) {
    if (expectedImpact === "HIGH") {
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    }

    if (expectedImpact === "MEDIUM") {
      return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    }

    return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  }

  function getStatusLabel(task) {
    if (task.status === "COMPLETE") {
      return "Completed";
    }

    if (task.status === "AWAITING_APPROVAL") {
      return "Waiting for approval";
    }

    if (task.status === "APPROVED") {
      return "Approved";
    }

    if (task.status === "REJECTED") {
      return "Rejected";
    }

    if (task.status === "READY") {
      return "Ready";
    }

    if (task.status === "FAILED") {
      return "Failed";
    }

    return task.status;
  }

  function getStatusClasses(task) {
    if (task.status === "COMPLETE") {
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    }

    if (task.status === "AWAITING_APPROVAL") {
      return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    }

    if (task.status === "APPROVED") {
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    }

    if (task.status === "REJECTED") {
      return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
    }

    if (task.status === "FAILED") {
      return "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300";
    }

    return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  }

  function hasReadySafeActions() {
    return Boolean(
      plan?.tasks?.some(
        (task) =>
          task.status === "READY" && task.riskLevel === "SAFE_AUTOMATION",
      ),
    );
  }

  function getApprovalTask() {
    return (
      plan?.tasks?.find(
        (task) =>
          task.riskLevel === "APPROVAL_REQUIRED" && task.approval?.proposal,
      ) ?? null
    );
  }

  function getCompletedAiTasks() {
    return (
      plan?.tasks?.filter(
        (task) => task.status === "COMPLETE" && task.result,
      ) ?? []
    );
  }

  function openShopDataEditor() {
    setIsFormExpanded(true);

    window.setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, 50);
  }

  function renderApprovalProposal(task) {
    const proposal = task?.approval?.proposal;

    if (!proposal) {
      return null;
    }

    const isPending = task.status === "AWAITING_APPROVAL";

    const isApproved = task.status === "APPROVED";

    const isRejected = task.status === "REJECTED";

    const isLoading = approvalLoadingTaskId === task.id;

    return (
      <section
        id="approval-section"
        className="mt-8 scroll-mt-8 overflow-hidden rounded-3xl border-2 border-amber-300 bg-amber-50/60 shadow-sm dark:border-amber-800 dark:bg-amber-950/20"
      >
        <div className="border-b border-amber-200 bg-amber-100/70 px-6 py-5 dark:border-amber-800 dark:bg-amber-950/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                {isPending ? "Approval required" : "Decision recorded"}
              </p>

              <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                Lighthouse has changes ready for your review
              </h3>
            </div>

            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                isApproved
                  ? "bg-emerald-600 text-white"
                  : isRejected
                    ? "bg-rose-600 text-white"
                    : "bg-amber-500 text-white"
              }`}
            >
              {isApproved
                ? "Approved"
                : isRejected
                  ? "Rejected"
                  : "Waiting for your decision"}
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="rounded-2xl bg-white/80 p-5 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              In simple terms
            </p>

            <p className="mt-2 max-w-3xl text-base font-semibold leading-7 text-slate-900 dark:text-slate-100">
              Lighthouse thinks this listing gets enough attention, but not
              enough shoppers are buying it. It prepared possible improvements
              for you to review.
            </p>
          </div>

          <p className="mt-6 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Listing
          </p>

          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
            {proposal.listingTitle}
          </p>

          {proposal.diagnosis && (
            <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 dark:border-indigo-800 dark:bg-indigo-950/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
                    Lighthouse diagnosis
                  </p>

                  <h4 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    What the current data supports
                  </h4>
                </div>

                <span className="w-fit rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300">
                  {proposal.diagnosis.confidence} confidence
                </span>
              </div>

              <div className="mt-5 rounded-xl border border-indigo-100 bg-white p-4 dark:border-indigo-900 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Observed signal
                </p>

                <p className="mt-2 text-sm font-semibold leading-6 text-slate-800 dark:text-slate-200">
                  {proposal.diagnosis.observedSignal}
                </p>
              </div>

              {proposal.diagnosis.possibleContributors?.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    Possible contributors
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    These are hypotheses to review, not proven causes.
                  </p>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {proposal.diagnosis.possibleContributors.map(
                      (contributor) => (
                        <div
                          key={contributor.category}
                          className="rounded-xl border border-indigo-100 bg-white p-4 dark:border-indigo-900 dark:bg-slate-900"
                        >
                          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                            {contributor.category
                              .toLowerCase()
                              .split("_")
                              .map(
                                (word) =>
                                  word.charAt(0).toUpperCase() + word.slice(1),
                              )
                              .join(" ")}
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {contributor.explanation}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Proven cause
                </p>

                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-300">
                  {proposal.diagnosis.provenCause ??
                    "No single cause has been proven from the available data."}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
              Proposed tests
            </p>

            <h4 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              Changes Lighthouse recommends testing
            </h4>

            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              These suggestions are based on possible conversion barriers. They
              are not proof that any one element is causing the problem.
            </p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {proposal.proposedChanges?.map((change) => (
              <div
                key={change.field}
                className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm dark:border-amber-800 dark:bg-slate-900"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  {change.field
                    .toLowerCase()
                    .split("_")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ")}
                </p>

                {change.currentValue && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Current
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {change.currentValue}
                    </p>
                  </div>
                )}

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                    Proposed
                  </p>

                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-900 dark:text-white">
                    {change.proposedValue}
                  </p>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Why
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {change.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
              Nothing has been changed yet.
            </p>

            <p className="mt-1 text-sm leading-6 text-emerald-700 dark:text-emerald-300">
              Approving this only records your decision in this prototype.
              Lighthouse is not publishing anything to Etsy yet.
            </p>
          </div>

          {isPending && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => handleApproval(task.id, "APPROVE")}
                disabled={isLoading}
                className="flex-1 cursor-pointer rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Saving decision..." : "Approve Proposed Changes"}
              </button>

              <button
                type="button"
                onClick={() => handleApproval(task.id, "REJECT")}
                disabled={isLoading}
                className="flex-1 cursor-pointer rounded-xl border border-slate-300 bg-white px-5 py-3.5 font-semibold text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-red-800 dark:hover:bg-red-950/30 dark:hover:text-red-300"
              >
                Reject
              </button>
            </div>
          )}

          {isApproved && (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
                <p className="font-bold text-emerald-800 dark:text-emerald-300">
                  ✓ Proposal approved
                </p>

                <p className="mt-1 leading-6 text-emerald-700 dark:text-emerald-300">
                  Your decision was recorded. No Etsy changes have been made
                  yet.
                </p>
              </div>

              {task.approvedRecovery && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-indigo-800 dark:bg-indigo-950/20">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
                        Approved recovery package
                      </p>

                      <h4 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                        Ready for manual application
                      </h4>
                    </div>

                    <span className="w-fit rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300">
                      Manual
                    </span>
                  </div>

                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    These are the exact changes you approved. Lighthouse has not
                    applied them to your live Etsy listing.
                  </p>

                  <div className="mt-5 grid gap-4 lg:grid-cols-3">
                    {task.approvedRecovery.changes?.map((change) => (
                      <div
                        key={change.field}
                        className="rounded-xl border border-indigo-100 bg-white p-4 dark:border-indigo-900 dark:bg-slate-900"
                      >
                        <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                          {change.field
                            .toLowerCase()
                            .split("_")
                            .map(
                              (word) =>
                                word.charAt(0).toUpperCase() + word.slice(1),
                            )
                            .join(" ")}
                        </p>

                        {change.currentValue && (
                          <div className="mt-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              Current
                            </p>

                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                              {change.currentValue}
                            </p>
                          </div>
                        )}

                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                            Approved
                          </p>

                          <p className="mt-2 text-sm font-semibold leading-6 text-slate-900 dark:text-white">
                            {change.approvedValue}
                          </p>
                        </div>

                        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Why
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {change.reason}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                      You still need to apply these changes manually.
                    </p>

                    <p className="mt-1 text-sm leading-6 text-amber-700 dark:text-amber-300">
                      Lighthouse has prepared the approved recovery package, but
                      nothing has been published to Etsy.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {isRejected && (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-900 dark:bg-rose-950/20">
              <p className="font-bold text-rose-800 dark:text-rose-300">
                Proposal rejected
              </p>

              <p className="mt-2 text-sm leading-6 text-rose-700 dark:text-rose-300">
                No Etsy changes were made. Lighthouse will not continue with
                this proposed change.
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                If your shop data changes, you can edit it and rebuild the plan
                to let Lighthouse reassess this listing.
              </p>

              <button
                type="button"
                onClick={openShopDataEditor}
                className="mt-4 cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Edit shop data
              </button>
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderAiResult(task) {
    if (!task.result) {
      return null;
    }

    if (task.result.type === "SHOP_DECLINE_DIAGNOSIS") {
      return (
        <article className="overflow-hidden rounded-3xl border-2 border-indigo-200 bg-indigo-50/40 shadow-sm dark:border-indigo-800 dark:bg-slate-900">
          <div className="border-b border-indigo-200 bg-indigo-100/70 px-6 py-5 dark:border-indigo-800 dark:bg-indigo-950/40">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
              Lighthouse AI result
            </p>

            <h4 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {task.title}
            </h4>
          </div>

          <div className="p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              In simple terms
            </p>

            <p className="mt-2 text-base font-semibold leading-7 text-slate-900 dark:text-slate-100">
              This product used to perform well, but its recent results dropped.
              Lighthouse is checking where the problem may be before
              recommending changes.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {task.result.causes?.map((cause) => (
                <div
                  key={cause.category}
                  className="rounded-2xl border border-indigo-100 bg-white p-4 dark:border-indigo-900 dark:bg-slate-950"
                >
                  <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                    {cause.category}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {cause.explanation}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid items-start gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-slate-900 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-slate-100">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Recommended next step
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                  {task.result.nextStep}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  What Lighthouse did
                </p>

                <div className="mt-2 space-y-1 text-sm text-emerald-800 dark:text-emerald-300">
                  <p>✓ Research and diagnosis only</p>
                  <p>✓ No Etsy listing was changed</p>
                  <p>✓ No money was spent</p>
                </div>
              </div>
            </div>
          </div>
        </article>
      );
    }

    if (task.result.type === "SHOP_EXPANSION_VALIDATION") {
      return (
        <article className="overflow-hidden rounded-3xl border-2 border-indigo-200 bg-indigo-50/40 shadow-sm dark:border-indigo-800 dark:bg-slate-900">
          <div className="border-b border-indigo-200 bg-indigo-100/70 px-6 py-5 dark:border-indigo-800 dark:bg-indigo-950/40">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
              Lighthouse AI result
            </p>

            <h4 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {task.title}
            </h4>
          </div>

          <div className="p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              In simple terms
            </p>

            <p className="mt-2 text-base font-semibold leading-7 text-slate-900 dark:text-slate-100">
              This product is showing positive momentum. Lighthouse is exploring
              related product ideas that may be worth testing next.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {task.result.opportunities?.map((opportunity) => (
                <div
                  key={opportunity.idea}
                  className="rounded-2xl border border-indigo-100 bg-white p-4 dark:border-indigo-900 dark:bg-slate-950"
                >
                  <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                    {opportunity.idea}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {opportunity.reason}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid items-start gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-slate-900 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-slate-100">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Recommended next step
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                  {task.result.recommendation}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  What Lighthouse did
                </p>

                <div className="mt-2 space-y-1 text-sm text-emerald-800 dark:text-emerald-300">
                  <p>✓ Generated expansion directions</p>
                  <p>✓ No Etsy listing was changed</p>
                  <p>✓ No money was spent</p>
                </div>
              </div>
            </div>
          </div>
        </article>
      );
    }

    if (task.result.type === "SHOP_GENERAL_REVIEW") {
      const { summary, reviewedListingCount } = task.result;

      return (
        <article className="overflow-hidden rounded-3xl border-2 border-indigo-200 bg-indigo-50/40 shadow-sm dark:border-indigo-800 dark:bg-slate-900">
          <div className="border-b border-indigo-200 bg-indigo-100/70 px-6 py-5 dark:border-indigo-800 dark:bg-indigo-950/40">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
              Shop review result
            </p>
            <h4 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {task.title}
            </h4>
          </div>
          <div className="space-y-5 p-6">
            <p className="text-base font-semibold leading-7 text-slate-900 dark:text-slate-100">
              {typeof summary === "string" && summary.trim()
                ? summary
                : "The review returned no summary. Update your shop data and try again."}
            </p>
            {Number.isInteger(reviewedListingCount) &&
              reviewedListingCount >= 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Listings reviewed: {reviewedListingCount}
                </p>
              )}
            {task.measurementPlan && (
              <div className="rounded-2xl border border-indigo-200 bg-white p-4 dark:border-indigo-800 dark:bg-slate-950">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Recommended next step
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                  {task.measurementPlan}
                </p>
              </div>
            )}
            {task.result.didModifyShop === false && (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                No Etsy listing was changed.
              </p>
            )}
          </div>
        </article>
      );
    }

    return (
      <article className="rounded-3xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
        <h4 className="text-xl font-bold text-slate-900 dark:text-white">
          {task.title}
        </h4>
        <p className="mt-3 text-sm leading-6 text-amber-800 dark:text-amber-300">
          A result was received, but this page cannot display its format yet.
          The detailed report is unavailable.
        </p>
      </article>
    );
  }

  const readySafeActions = hasReadySafeActions();

  const priorityCount = plan?.tasks?.length ?? 0;
  const listingPriorityCount =
    plan?.tasks?.filter((task) => task.opportunityType !== "GENERAL_REVIEW")
      .length ?? 0;
  const isGeneralReviewOnly = priorityCount > 0 && listingPriorityCount === 0;
  const isSampleData = dataSourceMode === "ETSY";

  const priorityRowWidthClass =
    priorityCount === 1
      ? "max-w-2xl"
      : priorityCount === 2
        ? "max-w-4xl"
        : "max-w-6xl";

  const priorityCardWidthClass = priorityCount === 1 ? "max-w-2xl" : "max-w-md";

  const prioritySummaryWidthClass =
    priorityCount === 1 ? "max-w-2xl" : "max-w-sm";

  const safeActionCount =
    plan?.tasks?.filter(
      (task) => task.status === "READY" && task.riskLevel === "SAFE_AUTOMATION",
    ).length ?? 0;

  const approvalTask = getApprovalTask();

  const completedAiTasks = getCompletedAiTasks();

  const activeListingCount = buildRequestListings().length;

  const etsyListingCount = etsyPlanningResult?.shopData?.listings?.length ?? 0;

  const displayedListingCount =
    etsyPlanningResult?.sessionPlan?.shopPlanId === plan?.shopPlanId
      ? etsyListingCount
      : activeListingCount;

  let manualPeriodPreview = null;
  let manualPeriodError = "";
  let latestCompletedDate = "";
  try {
    latestCompletedDate = shiftDate(todayInTimeZone(reportingPeriod.timeZone), -1);
    manualPeriodPreview = normalizeReportingPeriod(reportingPeriod);
  } catch (periodError) {
    manualPeriodError = PERIOD_ERRORS[periodError.message] || periodError.message;
  }

  function updateReportingPeriod(field, value) {
    if (reportingPeriod[field] === value) return;
    setReportingPeriod((current) => ({ ...current, [field]: value }));
    setListings(clearPeriodMetrics);
    setPlan(null);
    setPeriodNotice("Dates changed. Previous views, sales and trends were cleared so different periods are not mixed.");
    setError("");
  }

  const salesListingIdsKey = JSON.stringify(listings.filter(item => item.etsyListingId).map(item => item.id));
  const salesPeriodKey = JSON.stringify(reportingPeriod);

  function applyPeriodSales(data) {
    // Validate before scheduling the update, then merge against current input to preserve seller edits.
    mergeEtsySales(listings, data, importedShopId, reportingPeriod);
    setListings(current => {
      try { return mergeEtsySales(current, data, importedShopId, reportingPeriod); }
      catch { return current; } // Selection changed while this update was queued.
    });
  }

  const manualFormErrors = getManualFormErrors({
    shopName,
    weeklyAvailableMinutes,
    listings,
  });

  const manualFormIsValid =
    manualFormErrors.length === 0 && Boolean(manualPeriodPreview);

  return (
    <section className="py-12 text-slate-900 dark:text-slate-100">
      {toast && (
        <div className="fixed right-5 top-5 z-50 rounded-xl border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 shadow-xl dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300">
          ✓ {toast}
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        className="mb-8 cursor-pointer text-sm font-semibold text-slate-500 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
      >
        ← Back to Lighthouse
      </button>

      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F1641E]">
            Weekly Growth Plan
          </p>

          <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            What deserves your attention
            <span className="block text-indigo-600 dark:text-indigo-400">
              this week?
            </span>
          </h2>

          <p className="mt-5 max-w-xl leading-7 text-slate-600 dark:text-slate-400">
            Add your Etsy listing performance data and Lighthouse will
            prioritize the actions with the strongest current signals.
          </p>
          <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 text-sm dark:border-indigo-800 dark:bg-indigo-950/30">
            <h3 className="font-bold">Start with a product you want to improve</h3>
            <ol className="mt-3 list-inside list-decimal space-y-3 leading-6">
              <li>Import active listing titles from Etsy, or enter a product manually.</li>
              <li>Choose a date range. Sales import fills available paid-unit counts; add the product’s views from Etsy Stats for the same dates.</li>
              <li>Use the weekly plan to decide what to investigate. Approved pilot sellers can also request a copy draft and one action to test.</li>
            </ol>
            <p className="mt-4 leading-6">Connecting does not change your listings, place orders or grant private-pilot access. No active products? You can still explore the sample workflow.</p>
          </div>
        </div>

        <div className="space-y-4">
          <EtsyConnection returnStatus={etsyReturnStatus} onImport={handleCatalogImport} onPilotChange={setPilot} />
          {pilot?.enabled && <p role="status" className="rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900">
            {!pilot.approved ? `Your Etsy connection works. This pilot is invitation-only; ask Lighthouse to approve account reference ${pilot.etsyUserId}.` : !pilot.ready ? "Your pilot access is approved. The review service is being prepared." : !pilot.termsAccepted ? "Read and accept the pilot terms below before continuing." : "Your private pilot access is ready. Add real product data below to prepare an improvement draft."}
          </p>}
          {pilot?.enabled && pilot.approved && pilot.ready && !pilot.termsAccepted &&
            <PilotConsent key={pilot.etsyUserId} onAccepted={() => setPilot(current => ({ ...current, termsAccepted: true }))} />}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Data source
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              How do you want to add your shop data?
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleDataSourceModeChange("ETSY")}
                className={`cursor-pointer rounded-xl border px-4 py-3 text-left transition ${
                  dataSourceMode === "ETSY"
                    ? "border-sky-500 bg-sky-50 text-sky-800 ring-2 ring-sky-500/10 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-300"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                }`}
              >
                <span className="block text-sm font-bold">
                  Try sample Etsy data
                </span>

                <span className="mt-1 block text-xs leading-5 opacity-80">
                  Explore the workflow with a sample shop. No Etsy connection needed.
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDataSourceModeChange("MANUAL")}
                className={`cursor-pointer rounded-xl border px-4 py-3 text-left transition ${
                  dataSourceMode === "MANUAL"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-500/10 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                }`}
              >
                <span className="block text-sm font-bold">Enter manually</span>

                <span className="mt-1 block text-xs leading-5 opacity-80">
                  Enter listing performance data yourself.
                </span>
              </button>
            </div>
          </div>

          {dataSourceMode === "ETSY" && (
            <div className="rounded-3xl border border-sky-200 bg-white p-6 shadow-xl shadow-slate-200/50 dark:border-sky-900 dark:bg-slate-900 dark:shadow-none">
              <div className="border-b border-slate-100 pb-5 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
                  Sample shop demo
                </p>

                <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  Try a sample shop review
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Load example listings and add a sample traffic number to see
                  how Lighthouse builds a weekly plan.
                </p>
              </div>

              <div className="mt-5">
                <label
                  htmlFor="etsyWeeklyMinutes"
                  className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-200"
                >
                  Minutes available this week
                </label>

                <input
                  id="etsyWeeklyMinutes"
                  type="number"
                  min="0"
                  value={weeklyAvailableMinutes}
                  onChange={(event) =>
                    setWeeklyAvailableMinutes(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <button
                type="button"
                onClick={handleLoadMockEtsyData}
                disabled={etsyLoading}
                className="mt-6 w-full rounded-xl bg-sky-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {etsyLoading
                  ? "Loading sample data..."
                  : "Load Sample Shop Data"}
              </button>

              <p className="mt-3 text-center text-xs leading-5 text-slate-400 dark:text-slate-500">
                Demo data only. This does not use your connected Etsy account.
                To review your shop, import your listings or choose Enter manually.
              </p>

              {error && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              )}
            </div>
          )}

          {dataSourceMode === "MANUAL" &&
            (!plan || isFormExpanded ? (
              <form
                onSubmit={handleSubmit}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
              >
                {catalogImported && (
                  <p role="status" className="mb-5 rounded-xl bg-sky-50 p-4 text-sm text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                    Started from your Etsy shop name and selected active products. Sales are requested for the dates below. Add views from Etsy Stats; enter sales manually if automatic import is unavailable. Remove products you do not want to review.
                  </p>
                )}
                <div className="mb-6 border-b border-slate-100 pb-5 dark:border-slate-800">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
                    Shop data
                  </p>

                  <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                    Enter this week's shop performance
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Add or update the shop information Lighthouse should use to
                    build this week's plan.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="shopName"
                      className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-200"
                    >
                      Shop name
                    </label>

                    <input
                      id="shopName"
                      required
                      value={shopName}
                      onChange={(event) => {
                        setShopName(event.target.value);
                        setError("");
                      }}
                      placeholder="Example: Maya Studio"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="weeklyMinutes"
                      className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-200"
                    >
                      Minutes available this week
                    </label>

                    <input
                      id="weeklyMinutes"
                      type="number"
                      min="0"
                      required
                      step="1"
                      value={weeklyAvailableMinutes}
                      onChange={(event) => {
                        setWeeklyAvailableMinutes(event.target.value);
                        setError("");
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                </div>

                <fieldset className="mt-6 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                  <legend className="px-2 font-semibold">Reporting period</legend>
                  <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
                    Use the same date range for views and sales. This data window is
                    separate from your weekly action plan.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium">
                      Start date (inclusive)
                      <input type="date" required value={reportingPeriod.startDate}
                        max={reportingPeriod.endDate || latestCompletedDate}
                        onChange={(event) => updateReportingPeriod("startDate", event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-950" />
                    </label>
                    <label className="text-sm font-medium">
                      End date (inclusive)
                      <input type="date" required value={reportingPeriod.endDate}
                        min={reportingPeriod.startDate} max={latestCompletedDate}
                        onChange={(event) => updateReportingPeriod("endDate", event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-950" />
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Lighthouse uses UTC for these reporting dates.
                  </p>
                  {manualPeriodPreview && (
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                      {manualPeriodPreview.days} completed days. Trend compares these dates with{" "}
                      {manualPeriodPreview.previousStartDate} to {manualPeriodPreview.previousEndDate}{" "}
                      ({manualPeriodPreview.timeZone}). Leave trend blank if you do not have this comparison.
                    </p>
                  )}
                  {manualPeriodError && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">{manualPeriodError}</p>}
                  {periodNotice && <p role="status" className="mt-3 text-sm">{periodNotice}</p>}
                  {catalogImported && importedShopId && salesListingIdsKey !== "[]" && manualPeriodPreview && (
                    <EtsySalesImport key={`${importedShopId}:${salesListingIdsKey}:${salesPeriodKey}:${Boolean(pilot?.termsAccepted)}`}
                      shopId={importedShopId} listingIdsKey={salesListingIdsKey} periodKey={salesPeriodKey} onApply={applyPeriodSales} />
                  )}
                </fieldset>

                <div className="mt-7 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Listings
                    </p>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Views and sales for the selected period; sales trend
                      compared with the preceding equal-length period.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addListing}
                    className="cursor-pointer rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                  >
                    + Add listing
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  {listings.map((listing, index) => {
                    const isHighlighted = highlightedListingId === listing.id;

                    return (
                      <div
                        id={`listing-card-${listing.id}`}
                        key={listing.id}
                        className={`rounded-2xl border p-4 transition-all duration-500 ${
                          isHighlighted
                            ? "border-indigo-400 bg-indigo-50 ring-4 ring-indigo-500/10 dark:border-indigo-700 dark:bg-indigo-950/30"
                            : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                            Listing {index + 1}
                          </p>

                          {listings.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeListing(listing.id)}
                              className="cursor-pointer text-xs font-semibold text-slate-400 transition hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <input
                          value={listing.title}
                          onChange={(event) =>
                            updateListing(
                              listing.id,
                              "title",
                              event.target.value,
                            )
                          }
                          placeholder="Listing title"
                          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                        />

                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                              Views
                            </label>

                            <input
                              type="number"
                              min="0"
                              value={listing.views}
                              required={Boolean(listing.title.trim())}
                              step="1"
                              onChange={(event) =>
                                updateListing(
                                  listing.id,
                                  "views",
                                  event.target.value,
                                )
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                              Sales (units)
                            </label>

                            <input
                              type="number"
                              min="0"
                              value={listing.sales}
                              required={Boolean(listing.title.trim())}
                              step="1"
                              onChange={(event) =>
                                updateListing(
                                  listing.id,
                                  "sales",
                                  event.target.value,
                                )
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                            {listing.salesNeedsReview && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Refunds affect this product. Check its sales for these dates and enter the correct units.</p>}
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                              Sales trend % (optional)
                            </label>

                            <input
                              type="number"
                              value={listing.trendPercent}
                              min="-100"
                              step="any"
                              onChange={(event) =>
                                updateListing(
                                  listing.id,
                                  "trendPercent",
                                  event.target.value,
                                )
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {manualFormErrors.length > 0 && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                  >
                    <p className="font-semibold">Complete these fields to continue:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {manualFormErrors.map((formError) => (
                        <li key={formError}>{formError}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {error && (
                  <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    loading ||
                    executionLoading ||
                    !manualFormIsValid ||
                    approvalLoadingTaskId !== null
                  }
                  className="mt-6 w-full cursor-pointer rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? plan
                      ? "Updating Weekly Plan..."
                      : "Building Weekly Plan..."
                    : plan
                      ? "Update Weekly Growth Plan"
                      : "Build My Weekly Growth Plan"}
                </button>

                {plan && (
                  <button
                    type="button"
                    onClick={() => setIsFormExpanded(false)}
                    className="mt-3 w-full cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    Cancel editing
                  </button>
                )}
              </form>
            ) : (
              <div className="self-start rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      Shop data used for this plan
                    </p>

                    <h3 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                      {shopName}
                    </h3>

                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {activeListingCount}{" "}
                      {activeListingCount === 1 ? "listing" : "listings"}
                      {" · "}
                      {weeklyAvailableMinutes} minutes available
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsFormExpanded(true)}
                    className="shrink-0 cursor-pointer rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
                  >
                    Edit shop data
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {pilot?.enabled && pilot.approved && pilot.ready && pilot.termsAccepted && <PilotListingReview
        key={`${pilot.etsyUserId}:${dataSourceMode}:${pilotDraftVersion}`}
        listings={dataSourceMode === "MANUAL" ? buildRequestListings() : []}
        reportingPeriod={reportingPeriod}
        suggestedListingId={plan?.tasks?.find(task => task.listingId)?.listingId}
      />}

      {dataSourceMode === "ETSY" && (
        <EtsyMissingEvidence
          isSampleData={isSampleData}
          items={etsyPlanningResult?.missingEvidence ?? []}
          values={etsyViewInputs}
          shopData={etsyPlanningResult?.shopData}
          onChange={handleEtsyViewChange}
          onSubmit={handleEtsyEvidenceSubmit}
          loading={etsyLoading}
          periodConfirmed={etsyPeriodConfirmed}
          onPeriodConfirmationChange={setEtsyPeriodConfirmed}
        />
      )}

      {plan?.tasks?.length > 0 && (
        <div id="weekly-plan-results" className="scroll-mt-8 pt-12">
          {plan.reportingPeriod && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="font-semibold">{isSampleData ? "Sample reporting period" : "Reporting period used"}</p>
              <p className="mt-1">{plan.reportingPeriod.startDate} to {plan.reportingPeriod.endDate}{" "}
                ({plan.reportingPeriod.timeZone}; {plan.reportingPeriod.days} days)</p>
              <p className="mt-1 text-slate-600 dark:text-slate-300">Trend comparison: {plan.reportingPeriod.previousStartDate}{" "}
                to {plan.reportingPeriod.previousEndDate}. This period stays attached to this plan.</p>
            </div>
          )}
          <section>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
              {isGeneralReviewOnly ? "This week's shop review" : "This week's priorities"}
            </p>

            <h4 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              {isGeneralReviewOnly
                ? "No strong listing priority found this week."
                : `Lighthouse found ${listingPriorityCount} ${listingPriorityCount === 1 ? "priority" : "priorities"} worth focusing on this week.`}
            </h4>

            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">
              Lighthouse analyzed {displayedListingCount}{" "}
              {isSampleData ? "sample " : ""}
              {displayedListingCount === 1 ? "listing" : "listings"}.{" "}
              {isGeneralReviewOnly
                ? "The available data does not point to a strong listing-level action. Review the summary and gather more evidence before making changes."
                : "The strongest current signals are listed below."}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {plan.tasks.map((task) => (
                <div
                  key={`plain-${task.id}`}
                  className={`flex w-full ${prioritySummaryWidthClass} basis-72 flex-1 gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800 dark:bg-emerald-950/20`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 font-bold text-white">
                    {task.opportunityType === "GENERAL_REVIEW" ? "—" : task.priority}
                  </div>

                  <div>
                    <p className="font-bold text-emerald-900 dark:text-emerald-300">
                      {getPlainLanguageAction(task)}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {task.listingTitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {readySafeActions && (
            <div
              className={`mx-auto mt-6 w-full ${priorityRowWidthClass} rounded-3xl border-2 border-emerald-300 bg-emerald-50/80 p-5 dark:border-emerald-800 dark:bg-emerald-950/20`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-bold text-emerald-900 dark:text-emerald-300">
                    {isGeneralReviewOnly
                      ? "A general shop review is available."
                      : `Lighthouse can investigate ${safeActionCount} ${safeActionCount === 1 ? "task" : "tasks"} now.`}
                  </p>

                  <p className="mt-1 text-sm leading-6 text-emerald-800 dark:text-emerald-300">
                    {isGeneralReviewOnly
                      ? "Open a review of the available data and what to collect next."
                      : "Run the ready research tasks to investigate the current signals."}
                    {isSampleData && " Results in this demo use sample shop data."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExecuteSafeActions}
                  disabled={executionLoading}
                  className="shrink-0 cursor-pointer rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {executionLoading
                    ? "Running review..."
                    : isGeneralReviewOnly
                      ? "Run Shop Review"
                      : "Run Safe Research"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-stretch justify-center gap-5">
            {plan.tasks.map((task) => (
              <article
                key={task.id}
                className={`flex w-full ${priorityCardWidthClass} basis-80 flex-1 flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-300">
                    {task.opportunityType === "GENERAL_REVIEW"
                      ? "General review"
                      : `Priority #${task.priority}`}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getImpactClasses(
                      task.expectedImpact,
                    )}`}
                  >
                    {task.expectedImpact} impact
                  </span>
                </div>

                <h4 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
                  {task.title}
                </h4>

                <p className="mt-3 text-sm font-medium leading-6 text-slate-700 dark:text-slate-300">
                  {getPlainLanguageSummary(task)}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                      task,
                    )}`}
                  >
                    {getStatusLabel(task)}
                  </span>

                  {task.riskLevel === "APPROVAL_REQUIRED" &&
                    task.status === "AWAITING_APPROVAL" && (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        Approval required
                      </span>
                    )}

                  {task.riskLevel === "SAFE_AUTOMATION" && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Safe to research
                    </span>
                  )}
                </div>

                <details className="mt-5">
                  <summary className="cursor-pointer text-sm font-semibold text-indigo-600 dark:text-indigo-300">
                    View analysis details
                  </summary>

                  <div className="mt-4 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Why this matters
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {task.reason}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Measure
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {task.measurementPlan}
                      </p>
                    </div>
                  </div>
                </details>

                {task.status === "COMPLETE" && task.result && (
                  <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/30">
                    <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                      Task execution complete
                    </p>

                    <p className="mt-1 text-sm leading-6 text-indigo-700 dark:text-indigo-300">
                      See the result section below for report availability.
                    </p>
                  </div>
                )}

                {task.approval?.proposal &&
                  task.status === "AWAITING_APPROVAL" && (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                        Your approval is needed
                      </p>

                      <p className="mt-1 text-sm leading-6 text-amber-700 dark:text-amber-300">
                        Lighthouse prepared proposed changes for review below.
                      </p>
                    </div>
                  )}
              </article>
            ))}
          </div>

          {approvalTask && renderApprovalProposal(approvalTask)}

          {completedAiTasks.length > 0 && (
            <section id="execution-results" className="mt-10 scroll-mt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">
                Review and research results
              </p>

              <h3 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                What Lighthouse learned
              </h3>

              <p className="mt-2 max-w-3xl leading-7 text-slate-600 dark:text-slate-400">
                {isSampleData
                  ? "These results use sample shop data and are for demonstration only."
                  : "These are the results from the completed shop review and research tasks."}
              </p>

              <div className="mt-6 space-y-6">
                {completedAiTasks.map((task) => (
                  <div key={task.id}>
                    {renderAiResult(task)}
                    <TaskOutcomeForm
                      task={task}
                      onSave={handleTaskOutcome}
                      loading={outcomeLoadingTaskId === task.id}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}

export default ShopWeeklyPlan;
