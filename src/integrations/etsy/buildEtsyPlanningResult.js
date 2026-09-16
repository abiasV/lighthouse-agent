import generateExecutionPlan from "../../tools/generateExecutionPlan.js";

import {
  attachSellerPeriodViews,
  mapEtsySnapshotToShopData,
} from "./buildEtsyReadSnapshot.js";

import { buildMissingEvidence } from "./buildMissingEvidence.js";

function validatePlanningInput({
  snapshot,
  sellerInputs,
  weeklyAvailableMinutes,
}) {
  if (!snapshot || !snapshot.period || !Array.isArray(snapshot.listings)) {
    throw new Error("INVALID_ETSY_SNAPSHOT");
  }

  if (!Array.isArray(sellerInputs)) {
    throw new Error("INVALID_SELLER_INPUTS");
  }

  if (
    weeklyAvailableMinutes !== null &&
    weeklyAvailableMinutes !== undefined &&
    (typeof weeklyAvailableMinutes !== "number" ||
      !Number.isFinite(weeklyAvailableMinutes) ||
      weeklyAvailableMinutes < 0)
  ) {
    throw new Error("INVALID_WEEKLY_AVAILABLE_MINUTES");
  }

  const listingIds = new Set(
    snapshot.listings.map((listing) => String(listing.id)),
  );

  for (const input of sellerInputs) {
    const listingId = String(input?.listingId ?? "");

    if (!listingIds.has(listingId)) {
      throw new Error("SELLER_LISTING_NOT_FOUND");
    }
  }
}

function buildEtsyPlanningResult({
  snapshot,
  sellerInputs = [],
  weeklyAvailableMinutes = null,
}) {
  validatePlanningInput({
    snapshot,
    sellerInputs,
    weeklyAvailableMinutes,
  });

  const updatedSnapshot = attachSellerPeriodViews(snapshot, sellerInputs);

  const shopData = mapEtsySnapshotToShopData(
    updatedSnapshot,
    weeklyAvailableMinutes,
  );

  const plan = generateExecutionPlan(shopData);

  const missingEvidence = buildMissingEvidence(updatedSnapshot);

  return {
    shopData,
    plan,
    missingEvidence,
  };
}

export { validatePlanningInput };

export default buildEtsyPlanningResult;