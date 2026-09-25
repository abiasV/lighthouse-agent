export default function SellerReviewExample({ onOpenPlanner }) {
  return (
    <section
      id="sample-review"
      aria-labelledby="sample-review-title"
      className="relative scroll-mt-8 overflow-hidden rounded-3xl border border-indigo-200 bg-white shadow-xl shadow-indigo-100/50 dark:border-indigo-800 dark:bg-slate-900 dark:shadow-none"
    >
      <div className="border-b border-indigo-100 bg-indigo-50/70 p-6 dark:border-indigo-900 dark:bg-indigo-950/40 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
          From a shop question to a next step
        </p>
        <h3 id="sample-review-title" className="mt-3 text-2xl font-bold tracking-tight">
          Getting views, but few sales?
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Start with one product. Use its figures and details to choose a change
          worth testing, then keep track of what happens.
        </p>
      </div>

      <div className="p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Example: a printable meal planner</p>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Fictional example
          </span>
        </div>

        <ol className="mt-5 space-y-5">
          <li className="flex gap-3">
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">1</span>
            <div>
              <h4 className="font-semibold">Find a question to investigate</h4>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                The title says “Meal Planner.” Can a buyer tell it is a printable
                PDF and that a shopping list is included?
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">2</span>
            <div>
              <h4 className="font-semibold">Choose one practical change</h4>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Make the download format and included pages clear in the opening
                description. Check that the wording matches the product.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">3</span>
            <div>
              <h4 className="font-semibold">Check the result</h4>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Record the edit date, then compare views and sales across equal
                periods. Note promotions and other changes that could affect them.
              </p>
            </div>
          </li>
        </ol>

        <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
          This illustrates the approach, not a proven sales result. Your figures
          alone cannot tell us why someone did not buy.
        </p>
        <button
          type="button"
          onClick={onOpenPlanner}
          className="mt-5 w-full cursor-pointer rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950"
        >
          Explore the sample planner
        </button>
        <p className="mt-3 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
          No Etsy connection needed. Personal AI suggestions are part of the
          private pilot, which is still being prepared.
        </p>
      </div>
    </section>
  );
}
