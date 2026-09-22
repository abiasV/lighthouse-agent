import { useEffect, useRef, useState } from "react";
import { requestEtsyCatalog } from "../utils/etsyCatalog.js";
import {
  ETSY_RETURN_MESSAGES,
  isLocalEtsyDevelopmentOrigin,
  requestEtsy,
  requestEtsyWithRetry,
  shouldRecheckEtsyConnectionAfterPageShow,
  validateEtsyAuthorizationUrl,
} from "../utils/etsyConnection.js";

export default function EtsyConnection({ returnStatus, onImport }) {
  const localDevelopment = isLocalEtsyDevelopmentOrigin(window.location);
  const [status, setStatus] = useState(localDevelopment
    ? "local-development"
    : ETSY_RETURN_MESSAGES[returnStatus] ? "error" : "checking");
  const [message, setMessage] = useState(localDevelopment
    ? "Real Etsy connection is available on the deployed Lighthouse site. Use sample or manual data during local development."
    : ETSY_RETURN_MESSAGES[returnStatus] || "");
  const [attempt, setAttempt] = useState(0);
  const activeRequest = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const importRequest = useRef(null);
  const onImportRef = useRef(onImport);
  useEffect(() => { onImportRef.current = onImport; }, [onImport]);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (localDevelopment) return;
    if (ETSY_RETURN_MESSAGES[returnStatus] && attempt === 0) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const timeout = setTimeout(() => controller.abort("timeout"), 60000);
    requestEtsyWithRetry("/api/etsy/me", {
      signal: controller.signal,
      onRetry: () => setMessage(
        "Lighthouse is waking up. Checking your Etsy connection again…",
      ),
    }).then((data) => {
      if (controller.signal.aborted) return;
      if (data.connected !== true) throw new Error("Could not verify your Etsy connection. Please try again.");
      setStatus("connected");
      setMessage("Your Etsy connection has been verified.");
    }).catch((error) => {
      if (controller.signal.aborted && controller.signal.reason !== "timeout") return;
      if (["ETSY_BROWSER_SESSION_REQUIRED", "ETSY_CONNECTION_NOT_FOUND", "ETSY_REAUTHORIZATION_REQUIRED"].includes(error.code)) {
        setStatus("disconnected");
        setMessage(returnStatus === "connected"
          ? "The connection could not be verified in this browser. Please reconnect."
          : error.code === "ETSY_REAUTHORIZATION_REQUIRED" ? "Your Etsy connection needs to be renewed." : "");
      } else {
        setStatus("error");
        setMessage(controller.signal.aborted ? "The server is taking too long. Please try again." : error.message);
      }
    }).finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt, localDevelopment, returnStatus]);

  useEffect(() => () => activeRequest.current?.abort(), []);
  useEffect(() => () => importRequest.current?.abort(), []);

  async function importCatalog() {
    if (importRequest.current || !onImport) return;
    const controller = new AbortController();
    importRequest.current = controller;
    const timeout = setTimeout(() => controller.abort("timeout"), 60000);
    setImporting(true);
    setImportMessage("");
    try {
      const draft = await requestEtsyCatalog({ signal: controller.signal });
      if (controller.signal.aborted) return;
      const applied = onImportRef.current?.(draft);
      setImportMessage(applied
        ? `Imported ${draft.listings.length} active listings. Add views and sales below to build your plan.`
        : "Import cancelled. Your existing form data was kept.");
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason !== "timeout") return;
      setImportMessage(controller.signal.aborted ? "Import timed out. Please try again. Your form data was kept." : error.message);
      if (["ETSY_BROWSER_SESSION_REQUIRED", "ETSY_CONNECTION_NOT_FOUND", "ETSY_REAUTHORIZATION_REQUIRED"].includes(error.code)) {
        setStatus("disconnected");
        setMessage("Please reconnect Etsy before importing.");
      }
    } finally {
      clearTimeout(timeout);
      importRequest.current = null;
      setImporting(false);
    }
  }

  useEffect(() => {
    if (localDevelopment) return;

    function handlePageShow(event) {
      if (!shouldRecheckEtsyConnectionAfterPageShow(event, statusRef.current)) return;
      activeRequest.current?.abort();
      setStatus("checking");
      setMessage("");
      setAttempt((value) => value + 1);
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [localDevelopment]);

  async function connect() {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const timeout = setTimeout(() => controller.abort("timeout"), 60000);
    statusRef.current = "connecting";
    setStatus("connecting");
    setMessage("");
    try {
      const data = await requestEtsy("/api/etsy/auth/start", { signal: controller.signal });
      if (controller.signal.aborted) return;
      let destination;
      try {
        destination = validateEtsyAuthorizationUrl(data.authorizationUrl, window.location.origin);
      } catch {
        throw new Error("Etsy connection is not configured for this website address yet. Please contact Lighthouse support.");
      }
      window.location.assign(destination);
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason !== "timeout") return;
      setStatus("error");
      setMessage(controller.signal.aborted ? "The server is taking too long. Please try again." : error.message);
    } finally {
      clearTimeout(timeout);
    }
  }

  const busy = importing || status === "checking" || status === "connecting";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-busy={busy}>
      <h3 className="font-bold text-slate-900 dark:text-white">Connect your Etsy account</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Authorize read-only access on Etsy. Lighthouse will not change listings or place orders.
        Import your shop name and active listing titles, then add views and sales for your reporting period.
      </p>
      <p className="mt-3 text-sm text-slate-700 dark:text-slate-200" role="status" aria-live="polite">
        {status === "checking"
          ? message || "Checking your connection…"
          : status === "connecting" ? "Opening Etsy…" : message}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {!localDevelopment && status === "connected" && onImport && (
          <button type="button" disabled={busy} onClick={importCatalog}
            className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {importing ? "Importing listings…" : "Import My Etsy Listings"}
          </button>
        )}
        {!localDevelopment && status !== "connected" && (
          <button type="button" disabled={busy} onClick={connect}
            className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            {status === "connecting" ? "Opening Etsy…" : "Connect Etsy"}
          </button>
        )}
        {!localDevelopment && (
          <button type="button" disabled={busy} onClick={() => {
            setStatus("checking");
            setMessage("");
            setAttempt((value) => value + 1);
          }} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200">
            {status === "connected" ? "Check connection" : "Retry check"}
          </button>
        )}
      </div>
      {importMessage && <p role="status" className="mt-3 text-sm text-slate-700 dark:text-slate-200">{importMessage}</p>}
    </div>
  );
}
