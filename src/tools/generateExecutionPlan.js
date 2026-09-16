function createIdeaExecutionPlan(idea, scenario) {
  if (scenario === "MISSING_ACCEPTANCE_CRITERIA") {
    return {
      version: 1,

      summary: `Test the "${idea}" idea with a small execution plan.`,

      tasks: [
        {
          id: "task_1",

          title: "Research purchase-intent keywords",

          description:
            "Identify keywords potential customers may use when looking for this product.",

          executorType: "AI",

          riskLevel: "SAFE_AUTOMATION",

          status: "READY",

          budget: null,

          acceptanceCriteria: [],
        },
      ],
    };
  }

  return {
    version: 1,

    summary: `Test the "${idea}" idea with a small execution plan.`,

    tasks: [
      {
        id: "task_1",

        title: "Research purchase-intent keywords",

        description:
          "Identify keywords potential customers may use when looking for this product.",

        executorType: "AI",

        riskLevel: "SAFE_AUTOMATION",

        status: "READY",

        budget: null,

        acceptanceCriteria: [
          {
            description: "At least 10 candidate keywords are provided",
            evaluationType: "DETERMINISTIC",
          },
          {
            description: "Keywords are relevant to the product",
            evaluationType: "AI_EVALUATED",
          },
        ],
      },

      {
        id: "task_2",

        title: "Create initial product copy",

        description:
          "Create a first version of the product title, description, and key benefits.",

        executorType: "AI",

        riskLevel: "SAFE_AUTOMATION",

        status: "READY",

        budget: null,

        acceptanceCriteria: [
          {
            description: "A product title is included",
            evaluationType: "DETERMINISTIC",
          },
          {
            description: "A product description is included",
            evaluationType: "DETERMINISTIC",
          },
        ],
      },

      {
        id: "task_3",

        title: "Prepare external production task",

        description:
          "Prepare a production task that can be assigned to an external freelancer if needed.",

        executorType: "EXTERNAL",

        riskLevel: "MONEY_REQUIRED",

        status: "AWAITING_APPROVAL",

        delegationReason:
          "This task requires specialized visual design work that should be handled by an external specialist.",

        detectedFrom: "THUMBNAIL_QUALITY_SIGNAL",

        verifiedFactsPolicy: {
          source: "USER_INPUT_AT_APPROVAL",
          unknownValue: "UNKNOWN",
          allowInvention: false,
        },

        budget: {
          currency: "CAD",
          min: 60,
          max: 90,
        },

        acceptanceCriteria: [
          {
            description: "Deliverables match the requested task",
            evaluationType: "AI_EVALUATED",
          },
          {
            description:
              "All product facts used in the brief and accepted deliverable come from verified facts",
            evaluationType: "DETERMINISTIC",
          },
          {
            description: "No copyrighted characters or brands are used",
            evaluationType: "AI_EVALUATED",
          },
          {
            description: "Required source files are included",
            evaluationType: "DETERMINISTIC",
          },
        ],
      },
    ],
  };
}

function calculateConversionRate(listing) {
  if (!listing.views || listing.views <= 0) {
    return 0;
  }

  return listing.sales / listing.views;
}

function buildListingOpportunity(listing) {
  const conversionRate = calculateConversionRate(listing);

  const hasStrongTraffic = listing.views >= 500;

  const hasWeakConversion =
    hasStrongTraffic && listing.sales >= 0 && conversionRate < 0.02;

  const hasMeaningfulSalesHistory = listing.sales >= 10;

  const hasSignificantDecline =
    hasMeaningfulSalesHistory &&
    typeof listing.trendPercent === "number" &&
    listing.trendPercent <= -20;

  const hasPositiveGrowth =
    listing.sales >= 5 &&
    typeof listing.trendPercent === "number" &&
    listing.trendPercent >= 20;

  if (hasWeakConversion) {
    return {
      type: "IMPROVE_CONVERSION",

      score: 100,

      listing,

      reason:
        "The listing receives meaningful traffic but converts relatively few visitors into sales.",

      action:
        "Review possible conversion barriers such as positioning, title, thumbnail message, price, and description before making changes or trying to increase traffic.",

      expectedImpact: "HIGH",

      riskLevel: "APPROVAL_REQUIRED",

      measurementPlan:
        "Compare conversion performance before and after the approved listing changes.",
    };
  }

  if (hasSignificantDecline) {
    return {
      type: "DIAGNOSE_DECLINE",

      score: 90,

      listing,

      reason:
        "The listing has a proven sales history but its recent performance has declined significantly.",

      action:
        "Diagnose whether the decline is related to traffic, conversion, competition, seasonality, pricing, or recent listing changes.",

      expectedImpact: "HIGH",

      riskLevel: "SAFE_AUTOMATION",

      measurementPlan:
        "Identify the likely source of the decline before recommending any listing changes.",
    };
  }

  if (hasPositiveGrowth) {
    return {
      type: "VALIDATE_EXPANSION",

      score: 70,

      listing,

      reason:
        "The listing shows positive recent momentum and enough early sales activity to justify further investigation.",

      action:
        "Research adjacent buyer intent and related product opportunities before investing significant production time.",

      expectedImpact: "MEDIUM",

      riskLevel: "SAFE_AUTOMATION",

      measurementPlan:
        "Track whether related keywords, products, or variations show enough demand to justify expansion.",
    };
  }

  return null;
}

function createShopTask(opportunity, index) {
  const taskNumber = index + 1;

  const taskId = `shop_task_${taskNumber}`;

  if (opportunity.type === "IMPROVE_CONVERSION") {
    return {
      id: taskId,

      title: `Review conversion barriers for ${opportunity.listing.title}`,

      description: opportunity.action,

      executorType: "AI",

      riskLevel: opportunity.riskLevel,

      status: "AWAITING_APPROVAL",

      budget: null,

      priority: taskNumber,

      opportunityType: opportunity.type,

      detectedFrom: "LOW_CONVERSION_SIGNAL",

      listingId: opportunity.listing.id,

      listingTitle: opportunity.listing.title,

      reason: opportunity.reason,

      expectedImpact: opportunity.expectedImpact,

      measurementPlan: opportunity.measurementPlan,

      acceptanceCriteria: [
        {
          description:
            "Potential conversion problems are identified using the listing data",
          evaluationType: "DETERMINISTIC",
        },
        {
          description:
            "Recommended listing changes are prepared before anything is published",
          evaluationType: "AI_EVALUATED",
        },
      ],
    };
  }

  if (opportunity.type === "DIAGNOSE_DECLINE") {
    return {
      id: taskId,

      title: `Diagnose decline for ${opportunity.listing.title}`,

      description: opportunity.action,

      executorType: "AI",

      riskLevel: opportunity.riskLevel,

      status: "READY",

      budget: null,

      priority: taskNumber,

      opportunityType: opportunity.type,

      listingId: opportunity.listing.id,

      listingTitle: opportunity.listing.title,

      reason: opportunity.reason,

      expectedImpact: opportunity.expectedImpact,

      measurementPlan: opportunity.measurementPlan,

      acceptanceCriteria: [
        {
          description:
            "At least one plausible cause of the performance decline is identified",
          evaluationType: "AI_EVALUATED",
        },
        {
          description:
            "No shop changes are made before the decline is diagnosed",
          evaluationType: "DETERMINISTIC",
        },
      ],
    };
  }

  return {
    id: taskId,

    title: `Validate expansion for ${opportunity.listing.title}`,

    description: opportunity.action,

    executorType: "AI",

    riskLevel: opportunity.riskLevel,

    status: "READY",

    budget: null,

    priority: taskNumber,

    opportunityType: opportunity.type,

    listingId: opportunity.listing.id,

    listingTitle: opportunity.listing.title,

    reason: opportunity.reason,

    expectedImpact: opportunity.expectedImpact,

    measurementPlan: opportunity.measurementPlan,

    acceptanceCriteria: [
      {
        description:
          "At least one relevant adjacent product or buyer-intent opportunity is identified",
        evaluationType: "AI_EVALUATED",
      },
      {
        description:
          "No external spending is performed during opportunity validation",
        evaluationType: "DETERMINISTIC",
      },
    ],
  };
}

function createShopExecutionPlan(shopData) {
  const opportunities = shopData.listings
    .map(buildListingOpportunity)
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (opportunities.length === 0) {
    return {
      version: 1,

      planType: "SHOP_WEEKLY_GROWTH",

      summary: `No high-priority actions were detected for ${shopData.shopName}.`,

      tasks: [
        {
          id: "shop_task_1",

          title: "Review overall shop performance",

          description:
            "Review the shop data for weaker signals that may require further investigation.",

          executorType: "AI",

          riskLevel: "SAFE_AUTOMATION",

          status: "READY",

          budget: null,

          priority: 1,

          opportunityType: "GENERAL_REVIEW",

          listingId: null,

          listingTitle: null,

          reason:
            "The current deterministic rules did not identify a strong listing-level priority.",

          expectedImpact: "LOW",

          measurementPlan:
            "Collect additional shop data before making listing changes.",

          acceptanceCriteria: [
            {
              description: "The available shop data is reviewed",
              evaluationType: "DETERMINISTIC",
            },
          ],
        },
      ],
    };
  }

  return {
    version: 1,

    planType: "SHOP_WEEKLY_GROWTH",

    shopName: shopData.shopName,

    weeklyAvailableMinutes: shopData.weeklyAvailableMinutes ?? null,

    summary: `Prioritize the highest-impact actions for ${shopData.shopName} this week.`,

    tasks: opportunities.map(createShopTask),
  };
}

function generateExecutionPlan(input, scenario = "GOOD_PLAN") {
  const isShopData =
    input && typeof input === "object" && Array.isArray(input.listings);

  if (isShopData) {
    return createShopExecutionPlan(input);
  }

  return createIdeaExecutionPlan(input, scenario);
}

export default generateExecutionPlan;
