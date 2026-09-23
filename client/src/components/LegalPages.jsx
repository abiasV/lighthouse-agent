import { useEffect, useState } from "react";
import { PILOT_TERMS_VERSION } from "../../../shared/pilotTerms.js";

const sections = {
  terms: [
    ["Who provides Lighthouse", "These terms are between you and Abbas Vaziri, the operator of Lighthouse Agent in Ontario, Canada. You must be an adult authorized to manage the shop and provide its content. Etsy is not a party to this agreement."],
    ["An early, free private pilot", "The pilot is limited to invited, approved accounts. It is free, has no automatic renewal and does not authorize any charge to you. Any future paid service requires a separate agreement. Review attempts are limited; failed or interrupted requests may count toward your allowance."],
    ["What you receive", "Lighthouse can import your shop name and active listing titles through a read-only Etsy connection. You supply reporting-period views, sales, product facts and a specific problem. When the private AI review is available, you can request draft copy, a suggested action and a measurement plan. Lighthouse does not publish edits, place orders, purchase advertising or hire people on your behalf."],
    ["Your content and permission", "You retain your rights in your content. You give Lighthouse permission to process it only to provide and support the requested service, including sending the selected listing text, supplied facts and aggregate performance figures to OpenAI when you request an AI review. Do not submit buyer details, passwords, payment details or content you lack permission to use. Lighthouse does not use your content to train its own AI models. The privacy notice explains provider processing and retention."],
    ["Review suggestions before using them", "You are responsible for checking drafts for accuracy, intellectual property rights and Etsy requirements before applying them. Suggestions are hypotheses based on limited inputs, not verified market research. No increase in traffic, sales or profit is promised. You choose whether to make changes and remain responsible for your shop."],
    ["Availability and warranties", "To the extent permitted by applicable law, Lighthouse is provided as available, without a warranty of uninterrupted service, accuracy or particular results. Abbas Vaziri alone provides this application. Etsy and its affiliates do not provide Lighthouse and offer no warranties for this application or the data it accesses. These terms do not remove rights or remedies that applicable law does not allow us to exclude."],
    ["Stopping, access and updates", "You can stop using the pilot and disconnect your Etsy account. Disconnecting does not delete saved reviews; contact support to request deletion. We may restrict access for misuse, security problems or exhausted pilot allowances. Material changes to these terms or the privacy notice require acceptance of the new version before further private-pilot use. Contact support with questions or disputes."],
  ],
  privacy: [
    ["Purpose and responsibility", "Abbas Vaziri operates Lighthouse Agent in Ontario, Canada. We process information to connect your authorized Etsy account, prepare the review you request, save your results and follow-up, provide support and enforce invitation and usage limits."],
    ["Information processed", "This includes Etsy account identifiers and profile information returned during verification, access and refresh tokens, shop names and active listing information returned during import. We also process the product facts, reporting dates, aggregate views and sales, problem descriptions and follow-up notes you enter. We do not ask for buyer identities, order details, passwords or payment-card information. Do not enter them into free-text fields."],
    ["Storage and service providers", "Netlify hosts the frontend; Render hosts the API and PostgreSQL storage. Connection credentials and saved private-review content are encrypted by the application before database storage. Account identifiers, consent version and time, and usage-ledger metadata are stored separately from encrypted content. Ordinary manual plans use server memory; private reviews and follow-up results are saved in the database. No security measure can eliminate every risk."],
    ["AI processing", "When you request a private AI review, the selected listing text, supplied product facts, problem, reporting dates and aggregate figures are sent to OpenAI to generate suggestions. The review request does not include your Etsy tokens or password. We disable response storage in the API request; this does not guarantee zero retention by the provider. Providers may process information outside Canada under their own security, retention and legal obligations. Lighthouse does not train its own models on this content."],
    ["Cookies and logs", "HttpOnly session cookies associate this browser with your Etsy connection and private-pilot access. Your theme preference is stored in your browser. Hosting providers may record IP addresses and request metadata in operational logs. Avoid sending credentials, full callback URLs or unredacted sensitive screenshots to support."],
    ["Retention and deletion", "Saved private reviews, follow-up results, acceptance records and the usage ledger currently have no automatic time-based deletion. Session expiry is not a deletion request. Disconnecting removes the stored credentials for that browser connection, but not saved reviews. You may request access, correction or deletion through support; we verify account ownership before acting. We may retain minimal acceptance, security and allowance records where needed to handle disputes, prevent abuse or meet legal obligations, and will explain applicable limits. Provider logs and backups may not disappear immediately."],
    ["Your choices", "You may decline the pilot terms, stop requesting reviews, disconnect Lighthouse or separately revoke its authorization in Etsy. Disconnecting Lighthouse does not sign you out of Etsy. For privacy questions or an access, correction or deletion request, use the support contact below. Do not send passwords or tokens to prove ownership."],
  ],
  support: [
    ["Help with your shop review", "Contact us about connecting a shop, importing active listings, understanding a draft or recording a follow-up. Include the page, what you expected and the error message. Use a redacted screenshot if helpful. Never send passwords, API keys, buyer information or full authorization callback URLs."],
    ["Privacy and access requests", "You can also ask to access, correct or delete information associated with your account. We will verify ownership before releasing or changing private information. An invitation request does not guarantee pilot access. The private AI pilot remains closed until its operating requirements are complete."],
  ],
};

function SupportContact() {
  const [contact, setContact] = useState({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    fetch("/api/legal", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) setContact({ email: data.supportEmail });
      })
      .catch(() => setContact({ error: true }))
      .finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, []);
  if (contact.loading) return <p role="status">Loading support contact…</p>;
  if (contact.error) return <p role="status">The support contact could not be loaded. Please reload this page.</p>;
  return contact.email
    ? <a className="underline" href={`mailto:${contact.email}`}>{contact.email}</a>
    : <p>The public support contact is being configured. The private AI pilot is not open for use yet.</p>;
}

export function LegalFooter() {
  return <footer className="mx-auto mt-12 max-w-7xl border-t border-slate-200 px-5 py-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
    <nav aria-label="Legal and support" className="flex flex-wrap gap-5">
      <a className="underline" href="/terms">Pilot terms</a>
      <a className="underline" href="/privacy">Privacy notice</a>
      <a className="underline" href="/support">Support</a>
    </nav>
    <p className="mt-4">Etsy is a trademark of Etsy, Inc. Lighthouse uses the Etsy API and is neither endorsed nor certified by Etsy.</p>
  </footer>;
}

export default function LegalPage({ page }) {
  const title = { terms: "Pilot terms of use", privacy: "Privacy notice", support: "Support" }[page];
  return <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <article className="mx-auto max-w-3xl space-y-7">
      <a className="text-indigo-600 underline dark:text-indigo-300" href="/">Back to Lighthouse</a>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">Version {PILOT_TERMS_VERSION} · Updated September 23, 2026</p>
      {sections[page].map(([heading, text]) => <section key={heading}>
        <h2 className="mb-2 text-xl font-semibold">{heading}</h2>
        <p className="leading-7">{text}</p>
      </section>)}
      <section><h2 className="mb-2 text-xl font-semibold">Contact the operator</h2><SupportContact /></section>
    </article>
    <LegalFooter />
  </main>;
}
