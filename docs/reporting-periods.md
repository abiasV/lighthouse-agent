# Reporting periods

The weekly action plan and the observation window are separate. Manual input
defaults to the last 30 completed UTC calendar days. Sellers can select a
different completed window and the IANA time zone of their source report.
Changing the dates or metrics clears the confirmation checkbox.

`POST /api/shop/plan` requires `reportingPeriod: { startDate, endDate, timeZone }`
(inclusive YYYY-MM-DD dates) and `periodConfirmed: true`. All listing views and
sales belong to this shared declared period. An optional `trendPercent` compares
sales with the immediately preceding equal-length window; unknown is `null`,
not zero. Confirmation is a seller declaration, not independent verification
of the numbers or their source.

The server validates real calendar dates, ordering, time zone, completed days,
and numeric metrics. It derives `days`, `previousStartDate`, and `previousEndDate`
itself. Calendar arithmetic counts dates rather than elapsed local hours, so
daylight-saving transitions do not change the number of reporting days.

For `POST /api/shop/etsy/plan`, each seller input now requires a `period` object
with `currentStart`, `currentEndExclusive`, and `timeZone` matching the snapshot,
plus `periodConfirmed: true`. Missing/mismatched metadata is rejected with HTTP
400. Views must be a non-negative integer. Snapshot windows must be adjacent,
equal-length complete UTC days. The current transaction adapter supports UTC
only; local-zone reports cannot be relabeled as UTC. Existing clients must send
this new metadata and confirmation.

The normalized `reportingPeriod` is stored in `shopData` and returned on plan
creation and subsequent execution/approval/outcome responses. Reopening or
executing a stored plan never moves its period to today's date.

The sample Etsy dataset retains its fixed sample dates. Live Etsy shop/listing/
transaction retrieval is not wired into this page by this change. Authentication
and profile-reading infrastructure alone do not make the live data flow complete.
Snapshot provenance and the seller's declared dates cannot be independently
verified by this validation layer. Shop execution remains mock-only.

Deploy backend and frontend from the same revision. An older browser may receive
a validation error after the backend update until refreshed. Verify both the
backend deployment and Netlify before running the UI checks.
