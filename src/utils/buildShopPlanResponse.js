function buildShopPlanResponse(shopPlanId, state) {
  const plan = state.executionPlan;

  return {
    shopPlanId,

    shopName: plan?.shopName ?? state.shopData?.shopName ?? null,

    planType: plan?.planType ?? null,

    summary: plan?.summary ?? null,

    weeklyAvailableMinutes:
      plan?.weeklyAvailableMinutes ??
      state.shopData?.weeklyAvailableMinutes ??
      null,

    tasks: plan?.tasks ?? [],
  };
}

export default buildShopPlanResponse;