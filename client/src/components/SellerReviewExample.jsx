import ListingReviewContent from "./ListingReviewContent";

const example = {
  assessment: "The original title does not tell a buyer whether this is a digital file or what it includes. Clarifying those facts is one change worth testing; the numbers alone do not explain why people did not buy.",
  draftTitle: "Printable Weekly Meal Planner PDF with Shopping List — A4 and US Letter",
  draftDescription: "Plan a week of meals and write your shopping list in one place. This digital download includes two PDF pages: a weekly meal planner and a shopping list, in A4 and US Letter sizes. Print at home. No physical item will be shipped.",
  nextAction: "For this example, update only the opening description to explain the format and what is included. Keep the other listing elements unchanged while you observe the result.",
  measurementPlan: "Record the edit date. After another 30 completed days, compare views and sales with the original 30-day period. Note price changes, promotions and seasonal effects. A difference does not prove that this edit caused it.",
  limitations: "This is a hand-written illustration, not a live AI review or a seller success story. Photos, search demand and competitors have not been evaluated. Suggested wording must match the actual product.",
};

export default function SellerReviewExample() {
  return <section id="sample-review" aria-labelledby="sample-review-title" className="relative scroll-mt-8 rounded-3xl border border-indigo-200 bg-white p-6 shadow-xl shadow-indigo-100/50 dark:border-indigo-800 dark:bg-slate-900 dark:shadow-none">
    <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">See the output before connecting</p>
    <h3 id="sample-review-title" className="mt-3 text-2xl font-bold">One product. One clearer next step.</h3>
    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">Explore this fictional example without an Etsy account. It makes no API request and does not use your shop data.</p>
    <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-950">
      <p className="font-semibold">Example seller’s problem</p>
      <p className="mt-2">“People view my meal planner, but few buy. How can I explain it more clearly?”</p>
      <dl className="mt-4 space-y-3">
        <div><dt className="font-semibold">Current title</dt><dd>Meal Planner</dd></div>
        <div><dt className="font-semibold">Product facts</dt><dd>Two PDF pages: meal planner and shopping list. A4 and US Letter. Digital download; no physical item.</dd></div>
        <div><dt className="font-semibold">Illustrative 30-day figures</dt><dd>700 views · 5 sales. These are example inputs, not improved results.</dd></div>
      </dl>
    </div>
    <details className="mt-5 rounded-xl border border-indigo-200 p-4 dark:border-indigo-800">
      <summary className="cursor-pointer font-semibold text-indigo-700 dark:text-indigo-300">See the suggested improvement</summary>
      <div className="mt-5"><ListingReviewContent result={example} /></div>
    </details>
    <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">Personalized AI drafts are part of the invite-only pilot, still being prepared. This preview does not grant pilot access.</p>
  </section>;
}
