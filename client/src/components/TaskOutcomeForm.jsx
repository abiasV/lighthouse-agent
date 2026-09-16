import { useState } from "react";

function TaskOutcomeForm({ task, onSave, loading = false }) {
  const [result, setResult] = useState(task?.outcome?.result ?? "");
  const [note, setNote] = useState(task?.outcome?.note ?? "");
  const [metric, setMetric] = useState(
    task?.outcome?.measurement?.metric ?? "",
  );
  const [before, setBefore] = useState(
    task?.outcome?.measurement?.before ?? "",
  );
  const [after, setAfter] = useState(task?.outcome?.measurement?.after ?? "");
  const [localError, setLocalError] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();

    if (!result) {
      setLocalError("Please select an outcome.");
      return;
    }

    const hasAnyMeasurement = Boolean(
      metric.trim() || before.trim() || after.trim(),
    );

    const hasCompleteMeasurement = Boolean(
      metric.trim() && before.trim() && after.trim(),
    );

    if (hasAnyMeasurement && !hasCompleteMeasurement) {
      setLocalError(
        "Complete all three measurement fields or leave them all blank.",
      );
      return;
    }

    setLocalError("");

    onSave(task.id, {
      result,
      note: note.trim() || null,
      measurement: hasCompleteMeasurement
        ? {
            metric: metric.trim(),
            before: before.trim(),
            after: after.trim(),
          }
        : null,
    });
  }

  const hasRecordedOutcome = task?.outcome?.status === "RECORDED";

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="flex w-full cursor-pointer items-center justify-between gap-4 p-5 text-left"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
            Outcome tracking
          </p>

          <h5 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
            {hasRecordedOutcome
              ? "Outcome recorded"
              : "What happened after this action?"}
          </h5>

          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {hasRecordedOutcome
              ? "Review or update the real result of this action."
              : "Record the real result so Lighthouse can track what changed."}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {hasRecordedOutcome && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              Outcome recorded
            </span>
          )}

          <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">
            {isExpanded
              ? "Hide"
              : hasRecordedOutcome
                ? "Edit outcome"
                : "Show outcome form"}
          </span>

          <span
            className={`text-slate-400 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          >
            ▼
          </span>
        </div>
      </button>

      {isExpanded && (
        <form
          onSubmit={handleSubmit}
          className="border-t border-slate-100 p-5 dark:border-slate-800"
        >
          <div>
            <p className="text-sm font-semibold">Result</p>

            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {[
                ["POSITIVE", "Positive"],
                ["NEUTRAL", "Neutral"],
                ["NEGATIVE", "Negative"],
              ].map(([value, label]) => {
                const selected = result === value;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setResult(value);
                      setLocalError("");
                    }}
                    className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      selected
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="mt-4 block text-sm font-medium">
            Note
            <textarea
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setLocalError("");
              }}
              rows={3}
              placeholder="Optional: describe what happened after this action"
              className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-600"
            />
          </label>

          <div className="mt-5">
            <p className="text-sm font-semibold">Measurement</p>

            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Optional. If you add a measurement, complete all three fields.
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="text-sm font-medium">
                Metric
                <input
                  type="text"
                  value={metric}
                  onChange={(event) => {
                    setMetric(event.target.value);
                    setLocalError("");
                  }}
                  placeholder="e.g. Conversion rate"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-600"
                />
              </label>

              <label className="text-sm font-medium">
                Before
                <input
                  type="text"
                  value={before}
                  onChange={(event) => {
                    setBefore(event.target.value);
                    setLocalError("");
                  }}
                  placeholder="e.g. 1.4%"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-600"
                />
              </label>

              <label className="text-sm font-medium">
                After
                <input
                  type="text"
                  value={after}
                  onChange={(event) => {
                    setAfter(event.target.value);
                    setLocalError("");
                  }}
                  placeholder="e.g. 2.0%"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:placeholder:text-slate-600"
                />
              </label>
            </div>
          </div>

          {localError && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              {localError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full cursor-pointer rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {loading
              ? "Saving outcome..."
              : hasRecordedOutcome
                ? "Update Outcome"
                : "Save Outcome"}
          </button>
        </form>
      )}
    </div>
  );
}

export default TaskOutcomeForm;