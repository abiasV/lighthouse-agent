import { useId, useState } from "react";
import { selectCatalogListings } from "../utils/etsyCatalog.js";

export default function EtsyListingPicker({ draft, onApply, onCancel }) {
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState("");
  const matching = draft.listings.filter(listing => listing.title.toLowerCase().includes(search.trim().toLowerCase()));
  function toggle(id) {
    setError("");
    setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }
  function apply(event) {
    event.preventDefault();
    try { onApply(selectCatalogListings(draft, selectedIds)); }
    catch { setError("Could not apply this selection. Choose at least one product and try again. Your current form has been kept."); }
  }
  return <form onSubmit={apply} className="mt-5 space-y-4 rounded-xl border border-indigo-200 p-4 dark:border-indigo-800">
    <div>
      <h4 className="font-bold">Choose products to review</h4>
      <p className="mt-2 text-sm leading-6">Found {draft.listings.length} active listings in {draft.shopName}. Start with one product that needs attention. Only selected products will be added to the form; your Etsy listings stay unchanged.</p>
    </div>
    <label htmlFor={searchId} className="block text-sm font-semibold">Search product titles</label>
    <input id={searchId} type="search" value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-950" />
    <fieldset className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <legend className="px-1 text-sm font-semibold">Active products</legend>
      {matching.map(listing => <label key={listing.id} className="flex items-start gap-3 rounded-lg p-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-950">
        <input type="checkbox" className="mt-1" checked={selectedIds.includes(listing.id)} onChange={() => toggle(listing.id)} />
        <span className="min-w-0 break-words">{listing.title}</span>
      </label>)}
      {!matching.length && <p role="status" className="text-sm">No products match this search. Try another word or clear the search.</p>}
    </fieldset>
    <p role="status" className="text-sm">{selectedIds.length} selected · {matching.length} shown. Searching keeps your selection.</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={!selectedIds.length} onClick={() => { setSelectedIds([]); setError(""); }} className="text-sm font-semibold text-indigo-700 disabled:opacity-50 dark:text-indigo-300">Clear selection</button>
      <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600">Cancel</button>
      <button type="submit" disabled={!selectedIds.length} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Import selected products ({selectedIds.length})</button>
    </div>
    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Next: check the reporting dates and sales import, then add each product’s views from Etsy Stats. You can enter sales manually if import is unavailable.</p>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  </form>;
}
