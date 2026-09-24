import { useEffect, useRef, useState } from "react";
import { PILOT_TERMS_VERSION } from "../../../shared/pilotTerms.js";

export default function PilotConsent({ onAccepted }) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);

  async function submit(event) {
    event.preventDefault();
    if (!accepted || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError("");
    const timeout = setTimeout(() => controller.abort("timeout"), 25000);
    try {
      const response = await fetch("/api/etsy/pilot/consent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ accepted: true, termsVersion: PILOT_TERMS_VERSION }),
      });
      const data = await response.json();
      if (!response.ok || data.accepted !== true) throw new Error();
      if (!controller.signal.aborted) onAccepted();
    } catch {
      if (!controller.signal.aborted || controller.signal.reason === "timeout") {
        setError("Acceptance could not be confirmed. Check your connection and try again. If this continues, reload the planner to check your access and the current terms.");
      }
    } finally {
      clearTimeout(timeout); request.current = null;
      if (!controller.signal.aborted || controller.signal.reason === "timeout") setBusy(false);
    }
  }

  return <form onSubmit={submit} className="space-y-4 rounded-2xl border border-indigo-200 bg-white p-5 dark:border-indigo-800 dark:bg-slate-900">
    <h3 className="text-lg font-bold">Before using the private pilot</h3>
    <p className="text-sm leading-6">This early pilot is free. When you request an AI review, selected product text, supplied facts and aggregate performance figures (including imported sales) go to OpenAI to prepare suggestions. Review drafts before using them; sales improvements are not guaranteed.</p>
    <label className="flex items-start gap-3 text-sm leading-6">
      <input className="mt-1" type="checkbox" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)} />
      <span>I accept the <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">pilot terms</a> and have read the <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">privacy notice</a>, including AI processing and retention.</span>
    </label>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    <button type="submit" disabled={!accepted || busy} className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Saving acceptance…" : "Accept and continue"}</button>
  </form>;
}
