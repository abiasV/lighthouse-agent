import { useEffect, useRef, useState } from "react";
import { requestEtsySales } from "../utils/etsySales.js";

export default function EtsySalesImport({ shopId, listingIdsKey, periodKey, onApply }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ busy: true, message: "Importing sales for your selected dates…" });
  const applyRef = useRef(onApply);
  useEffect(() => { applyRef.current = onApply; }, [onApply]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("timeout"), 60000);
    requestEtsySales({ shopId, listingIds: JSON.parse(listingIdsKey), reportingPeriod: JSON.parse(periodKey), signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return;
        applyRef.current(data);
        const review = data.listings.filter(item => item.needsReview).length;
        setState({ busy: false, message: review
          ? `Sales received. ${review} product(s) have refunds that need manual review; their sales remain blank. Figures you entered yourself have been kept.`
          : "Sales and available trends imported. Figures you entered yourself have been kept. Add views below to complete your plan." });
      }).catch(error => {
        if (controller.signal.aborted && controller.signal.reason !== "timeout") return;
        setState({ busy: false, error: true, message: controller.signal.aborted
          ? "Sales import timed out. Your figures have been kept. Retry or enter them manually." : error.message });
      }).finally(() => clearTimeout(timer));
    return () => { controller.abort(); clearTimeout(timer); };
  }, [shopId, listingIdsKey, periodKey, attempt]);
  return <div className="mt-4 space-y-2 rounded-xl bg-sky-50 p-4 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-100">
    <p role={state.error ? "alert" : "status"}>{state.message}</p>
    <p>Sales count paid units from Etsy orders created in these UTC dates. Cancelled and fully refunded orders are excluded; partial refunds need your review. This can differ from Etsy Stats order counts.</p>
    <p>Etsy does not provide date-range views through its API. Copy each selected product’s views from Etsy Stats for these dates. Lifetime views are not used.</p>
    <button type="button" disabled={state.busy} className="font-semibold underline disabled:opacity-50" onClick={() => {
      setState({ busy: true, message: "Importing sales for your selected dates…" }); setAttempt(value => value + 1);
    }}>{state.busy ? "Importing sales…" : "Refresh sales for these dates"}</button>
  </div>;
}
