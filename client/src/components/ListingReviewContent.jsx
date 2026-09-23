import { useState } from "react";

function CopyDraft({ label, text }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label} copied. Check the facts before using it.`);
    } catch {
      setMessage("Copy is unavailable in this browser. Select the draft text below and copy it manually.");
    }
  }
  return <div className="mt-2">
    <button type="button" onClick={copy} className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950">Copy {label.toLowerCase()}</button>
    {message && <p role="status" className="mt-2 text-sm text-slate-600 dark:text-slate-400">{message}</p>}
  </div>;
}

export default function ListingReviewContent({ result }) {
  return <div className="space-y-5">
    {[["Assessment", "assessment"], ["Suggested title — draft", "draftTitle"], ["Suggested description — draft", "draftDescription"], ["One action to test", "nextAction"], ["How to measure it", "measurementPlan"], ["What remains uncertain", "limitations"]].map(([label, key]) => <div key={key}>
      <p className="text-sm font-bold">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{result[key]}</p>
      {["draftTitle", "draftDescription"].includes(key) && <CopyDraft key={result[key]} label={key === "draftTitle" ? "Title" : "Description"} text={result[key]} />}
    </div>)}
  </div>;
}
