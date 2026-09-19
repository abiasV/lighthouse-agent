function formatUtcDate(isoString) {
  if (!isoString) {
    return "";
  }

  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function EtsyMissingEvidence({
  items,
  values,
  shopData,
  onChange,
  onSubmit,
  loading = false,
  isSampleData = false,
  periodConfirmed = false,
  onPeriodConfirmationChange,
}) {
  const missingItems = Array.isArray(items) ? items : [];

  const completedListings =
    shopData?.listings?.filter(
      (listing) =>
        listing.views !== null &&
        listing.views !== undefined &&
        Number.isFinite(Number(listing.views)),
    ) ?? [];

  if (missingItems.length === 0) {
    if (completedListings.length === 0) {
      return null;
    }

    return (
      <section
        id="etsy-evidence-section"
        className="mt-8 scroll-mt-8 overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50/60 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/20"
      >
        <div className="border-b border-emerald-200 bg-emerald-100/70 px-6 py-5 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            {isSampleData ? "Sample traffic added" : "Traffic data added"}
          </p>

          <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
            {isSampleData ? "Sample conversion analysis is now available" : "Conversion analysis is now available"}
          </h3>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {isSampleData
              ? "Your test traffic number is combined with sample sales for the demo reporting period. This is not an analysis of your real shop."
              : "Lighthouse now has traffic and sales from the same reporting period, so it can evaluate conversion without guessing."}
          </p>
        </div>

        <div className="space-y-4 p-6">
          {completedListings.map((listing) => (
            <div
              key={listing.id}
              className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900 dark:bg-slate-900"
            >
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {listing.title}
                </p>

                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {isSampleData ? "Sample traffic input was accepted." : "Seller-provided traffic evidence was accepted."}
                </p>
              </div>

              <div className="rounded-xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                {listing.views} views recorded
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const hasInvalidInput = missingItems.some((item) => {
    const value = values?.[item.listingId];

    if (value === "" || value === undefined || value === null) {
      return true;
    }

    const numericValue = Number(value);

    return !Number.isInteger(numericValue) || numericValue < 0;
  });

  return (
    <section
      id="etsy-evidence-section"
      className="mt-8 scroll-mt-8 overflow-hidden rounded-3xl border border-sky-200 bg-sky-50/60 shadow-sm dark:border-sky-900 dark:bg-sky-950/20"
    >
      <div className="border-b border-sky-200 bg-sky-100/70 px-6 py-5 dark:border-sky-900 dark:bg-sky-950/40">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
          {isSampleData ? "Sample data needs your input" : "Etsy data needs your input"}
        </p>

        <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
          Complete missing traffic data
        </h3>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          {isSampleData
            ? "The sample shop is loaded. Enter a test traffic number, such as 200, to explore the analysis. No data was imported from an Etsy account."
            : "Lighthouse imported the available listing data from Etsy. Add the missing traffic for the same reporting period so conversion can be evaluated without guessing."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 p-6">
        {missingItems.map((item) => {
          const currentStart = formatUtcDate(
            item.resolution?.period?.currentStart,
          );

          const currentEndExclusive = new Date(
            item.resolution?.period?.currentEndExclusive,
          );

          if (!Number.isNaN(currentEndExclusive.getTime())) {
            currentEndExclusive.setUTCDate(
              currentEndExclusive.getUTCDate() - 1,
            );
          }

          const currentEnd = Number.isNaN(currentEndExclusive.getTime())
            ? ""
            : formatUtcDate(currentEndExclusive.toISOString());

          const value = values?.[item.listingId] ?? "";

          return (
            <div
              key={`${item.listingId}-${item.signal}-${item.field}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Missing evidence
                  </p>

                  <h4 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                    {item.listingTitle}
                  </h4>

                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {item.reason}
                  </p>
                </div>

                <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  {isSampleData ? "Sample input required" : "Seller input required"}
                </span>
              </div>

              <div className="mt-5">
                <label
                  htmlFor={`etsy-period-views-${item.listingId}`}
                  className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  {currentStart && currentEnd
                    ? `${isSampleData ? "Sample reporting period — " : ""}Views from ${currentStart} to ${currentEnd} (${item.resolution?.period?.timeZone ?? "unknown time zone"})`
                    : "Views for the reporting period"}
                </label>

                <input
                  id={`etsy-period-views-${item.listingId}`}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={value}
                  onChange={(event) =>
                    onChange(item.listingId, event.target.value)
                  }
                  placeholder="Enter views"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-sky-500 dark:focus:ring-sky-900"
                />

                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {isSampleData
                    ? "For this demo, try 200 views. For a real shop review, use traffic and sales from the same reporting period."
                    : "Use the traffic number for this exact period so Lighthouse compares views and sales from the same window."}
                </p>
              </div>
            </div>
          );
        })}

        <label className="flex items-start gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={periodConfirmed} className="mt-1"
            onChange={(event) => onPeriodConfirmationChange?.(event.target.checked)} />
          {isSampleData
            ? "I am using test traffic numbers for the sample reporting period shown above."
            : "I confirm these traffic numbers cover exactly the dates and time zone displayed above. If my source report uses different dates or a different time zone, I will not submit it here."}
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || hasInvalidInput || !periodConfirmed}
            className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Updating analysis..." : "Update analysis"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default EtsyMissingEvidence;
