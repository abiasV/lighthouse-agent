import { useEffect, useRef, useState } from "react";
import { validatePilotReview } from "../../../shared/pilotReview.js";
import { normalizeReportingPeriod, shiftDate } from "../../../shared/reportingPeriod.js";

const fieldClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white";
const buttonClass = "rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";

async function request(path, { body, signal } = {}) {
  const response = await fetch("/api/etsy/pilot" + path, {
    method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store", signal,
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Could not complete this request. Please try later.");
  return data;
}

function OutcomeForm({ review, onSaved }) {
  const [note, setNote] = useState(review.outcome?.note || "");
  const [views, setViews] = useState(review.outcome ? String(review.outcome.views) : "");
  const [sales, setSales] = useState(review.outcome ? String(review.outcome.sales) : "");
  const baseline = review.input.reportingPeriod;
  const [startDate, setStartDate] = useState(review.outcome?.reportingPeriod.startDate || shiftDate(baseline.endDate, 1));
  const [endDate, setEndDate] = useState(review.outcome?.reportingPeriod.endDate || shiftDate(baseline.endDate, baseline.days));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const active = useRef(null);
  useEffect(() => () => active.current?.abort(), []);
  let period;
  try { period = normalizeReportingPeriod({ startDate, endDate, timeZone: baseline.timeZone }); } catch { /* Shown below. */ }
  const validCount = value => value.trim() !== "" && Number.isSafeInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 100000000;
  const errors = [];
  if (note.trim().length < 5 || note.length > 1000) errors.push("Describe what you changed in 5–1,000 characters.");
  if (!validCount(views)) errors.push("Views: enter a whole number from 0 to 100,000,000.");
  if (!validCount(sales)) errors.push("Sales: enter a whole number from 0 to 100,000,000.");
  if (!period || period.days !== baseline.days || startDate <= baseline.endDate) errors.push(`Choose ${baseline.days} completed days after the original period (${baseline.timeZone}).`);
  const valid = errors.length === 0;
  async function save(event) {
    event.preventDefault();
    if (!valid || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 25000);
    setBusy(true); setMessage("");
    try {
      const data = await request(`/reviews/${review.id}/outcome`, { signal: controller.signal,
        body: { note, views: Number(views), sales: Number(sales), reportingPeriod: period } });
      if (!controller.signal.aborted) { onSaved(data.review); setMessage("Follow-up saved. A before/after difference alone does not prove the change caused it."); }
    } catch { if (active.current) setMessage("Could not save the follow-up. Please try again."); }
    finally { clearTimeout(timeout); active.current = null; setBusy(false); }
  }
  return <details className="mt-5 border-t border-slate-200 pt-4">
    <summary className="cursor-pointer font-semibold">Record what happened after your change</summary>
    <p className="mt-2 text-sm">Original period: {baseline.startDate} to {baseline.endDate}. {review.input.views} views, {review.input.sales} sales.</p>
    {review.outcome && <p className="mt-2 text-sm">Saved follow-up: {review.outcome.views} views, {review.outcome.sales} sales.</p>}
    <form onSubmit={save} className="mt-3 space-y-3">
      <label className="block text-sm">What did you change?
        <textarea className={fieldClass} value={note} maxLength={1000} onChange={e => setNote(e.target.value)} disabled={busy} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Follow-up start date<input className={fieldClass} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={busy} /></label>
        <label className="text-sm">Follow-up end date<input className={fieldClass} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={busy} /></label>
        <label className="text-sm">Views<input className={fieldClass} type="number" min="0" step="1" value={views} onChange={e => setViews(e.target.value)} disabled={busy} /></label>
        <label className="text-sm">Sales<input className={fieldClass} type="number" min="0" step="1" value={sales} onChange={e => setSales(e.target.value)} disabled={busy} /></label>
      </div>
      {!valid && <ul role="status" className="list-inside list-disc text-sm text-amber-800 dark:text-amber-300">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
      <button className={buttonClass} disabled={!valid || busy}>{busy ? "Saving…" : "Save follow-up"}</button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
  </details>;
}

export default function PilotListingReview({ listings, reportingPeriod, suggestedListingId }) {
  const [chosenId, setChosenId] = useState("");
  const [facts, setFacts] = useState("");
  const [problem, setProblem] = useState("");
  const [reviews, setReviews] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const submission = useRef(null);
  const active = useRef(null);
  const candidates = listings.filter(listing => listing.title.trim());
  const selected = chosenId ? candidates.find(listing => listing.id === chosenId)
    : candidates.find(listing => listing.id === suggestedListingId) || candidates[0];
  const { errors, value: input } = validatePilotReview({ title: selected?.title, facts, problem,
    views: selected?.views, sales: selected?.sales, reportingPeriod });

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    request("/reviews", { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setReviews(data.reviews);
    }).catch(() => {
      if (!controller.signal.aborted) setMessage("Could not load saved reviews. Use Refresh saved reviews before creating another.");
    }).finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [refresh]);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);

  async function submit(event) {
    event.preventDefault();
    if (errors.length || active.current || reviews.length >= 6) return;
    const fingerprint = JSON.stringify(input);
    if (submission.current?.fingerprint !== fingerprint) submission.current = { fingerprint, requestKey: crypto.randomUUID() };
    const controller = new AbortController();
    active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    setBusy(true); setMessage("");
    try {
      const { review } = await request("/reviews", { signal: controller.signal, body: { input, requestKey: submission.current.requestKey } });
      if (controller.signal.aborted) return;
      setReviews(current => [review, ...current.filter(item => item.id !== review.id)]);
      setMessage(review.status === "complete" ? "Your draft is ready below. Check the facts before using it." : "This request is pending or did not finish. Refresh saved reviews before starting another.");
      // Keep the key for an unchanged submission: double-clicks/retries reuse the result.
    } catch (error) {
      if (active.current) setMessage(controller.signal.aborted ? "The request took too long. Refresh saved reviews; submitting unchanged data retries the same request." : error.message);
    } finally { clearTimeout(timeout); active.current = null; setBusy(false); }
  }
  function updateReview(review) { setReviews(current => current.map(item => item.id === review.id ? review : item)); }
  return <section className="mt-8 rounded-2xl border border-indigo-200 bg-white p-6 dark:border-indigo-800 dark:bg-slate-900">
    <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Private seller pilot</p>
    <h3 className="mt-2 text-xl font-bold">Turn one listing problem into a practical next step</h3>
    <p className="mt-2 text-sm leading-6">Choose a product from your manual shop data above. Add its real details and what you want to improve. Receive draft copy, one action to test, and a way to measure the result. Up to six reviews are included.</p>
    <p className="mt-2 text-sm leading-6">Submitting sends this product’s title, details, problem and reported numbers to OpenAI to prepare your draft. Do not include buyer names, messages or contact details. Lighthouse saves the review privately for your account. Nothing is published to Etsy.</p>
    <form onSubmit={submit} className="mt-4 space-y-4">
      <label className="block text-sm font-semibold">Product to review
        <select className={fieldClass} value={selected?.id || ""} disabled={busy} onChange={event => { setChosenId(event.target.value); setFacts(""); setProblem(""); }}>
          {!selected && <option value="">Choose a product from Enter manually above</option>}
          {candidates.map(listing => <option key={listing.id} value={listing.id}>{listing.title}</option>)}
        </select>
      </label>
      <label className="block text-sm font-semibold">Product details
        <textarea className={fieldClass} rows={4} maxLength={2000} value={facts} disabled={busy} onChange={e => { setChosenId(selected?.id || ""); setFacts(e.target.value); }} placeholder="What the buyer receives, who it is for, format or materials, and any important limits. You can paste your current description." />
      </label>
      <label className="block text-sm font-semibold">What do you want to improve?
        <textarea className={fieldClass} rows={2} maxLength={500} value={problem} disabled={busy} onChange={e => { setChosenId(selected?.id || ""); setProblem(e.target.value); }} placeholder="For example: People view this product but few buy. Help me explain its value more clearly." />
      </label>
      {errors.length > 0 && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="status"><p>Complete these fields to continue:</p><ul className="mt-1 list-inside list-disc">{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
      <button className={buttonClass} disabled={busy || errors.length > 0 || reviews.length >= 6}>{busy ? "Preparing your draft…" : "Prepare my improvement draft"}</button>
      {reviews.length >= 6 && <p className="text-sm">You have used your six pilot review attempts. Saved drafts and follow-up forms remain available.</p>}
    </form>
    <div className="mt-6 flex items-center justify-between gap-3"><h4 className="font-bold">Your saved reviews</h4><button type="button" className="text-sm font-semibold text-indigo-600 disabled:opacity-50" disabled={busy} onClick={() => { setMessage(""); setRefresh(value => value + 1); }}>Refresh saved reviews</button></div>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    {reviews.map(review => <article key={review.id} className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <h4 className="font-bold">{review.input.title}</h4>
      <p className="mt-1 text-xs text-slate-500">{review.input.reportingPeriod.startDate} to {review.input.reportingPeriod.endDate} · {review.input.views} views · {review.input.sales} sales</p>
      {review.status === "complete" ? <>
        {[["Assessment", "assessment"], ["Suggested title — draft", "draftTitle"], ["Suggested description — draft", "draftDescription"], ["One action to test", "nextAction"], ["How to measure it", "measurementPlan"], ["What remains uncertain", "limitations"]].map(([label, key]) => <div className="mt-4" key={key}><h5 className="text-sm font-bold">{label}</h5><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{review.result[key]}</p></div>)}
        <OutcomeForm review={review} onSaved={updateReview} />
      </> : <p className="mt-3 text-sm">{review.status === "pending" ? "This review is still pending or was interrupted. Refresh later; contact Lighthouse if it remains pending." : "This review did not finish. It counts toward the pilot allowance because the provider may have processed it."}</p>}
    </article>)}
  </section>;
}
