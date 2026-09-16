function getShopListing(shopData, task) {
  if (!Array.isArray(shopData?.listings)) {
    return null;
  }

  return (
    shopData.listings.find((listing) => listing.id === task.listingId) ?? null
  );
}

function executeShopTaskMock(task, shopData) {
  const listing = getShopListing(shopData, task);

  if (task.opportunityType !== "GENERAL_REVIEW" && !listing) {
    throw new Error("SHOP_LISTING_NOT_FOUND");
  }

  if (task.opportunityType === "DIAGNOSE_DECLINE") {
    return {
      type: "SHOP_DECLINE_DIAGNOSIS",

      listingId: listing.id,
      listingTitle: listing.title,

      causes: [
        {
          category: "TRAFFIC",
          explanation:
            "Check whether recent listing traffic declined compared with the previous period.",
        },
        {
          category: "CONVERSION",
          explanation:
            "Check whether visitors are still arriving but converting at a lower rate.",
        },
        {
          category: "MARKET",
          explanation:
            "Review possible seasonality, competitor changes, and buyer-demand shifts.",
        },
      ],

      nextStep:
        "Compare traffic and conversion trends before making listing changes.",

      didModifyShop: false,
      externalSpend: 0,
    };
  }

  if (task.opportunityType === "VALIDATE_EXPANSION") {
    return {
      type: "SHOP_EXPANSION_VALIDATION",

      listingId: listing.id,
      listingTitle: listing.title,

      opportunities: [
        {
          idea: `${listing.title} Bundle`,
          reason:
            "A bundle can extend an existing product direction without starting from an unrelated niche.",
        },
        {
          idea: `${listing.title} Student Edition`,
          reason:
            "A more specific audience variation can test adjacent buyer intent.",
        },
        {
          idea: `${listing.title} Extended Version`,
          reason:
            "A higher-value variation can test whether existing interest supports expansion.",
        },
      ],

      recommendation:
        "Validate adjacent buyer intent before investing significant production time.",

      didModifyShop: false,
      externalSpend: 0,
    };
  }

  if (task.opportunityType === "GENERAL_REVIEW") {
    const reviewedListingCount = Array.isArray(shopData?.listings)
      ? shopData.listings.length
      : 0;

    return {
      type: "SHOP_GENERAL_REVIEW",

      reviewedListingCount,

      summary:
        "The available shop data was reviewed, but no strong deterministic priority was detected.",

      didModifyShop: false,
      externalSpend: 0,
    };
  }

  throw new Error("MOCK_SHOP_TASK_NOT_SUPPORTED");
}

function executeIdeaTaskMock(task, idea, scenario = "GOOD_OUTPUT") {
  const normalizedIdea = String(idea).trim();

  if (task.id === "task_1") {
    if (scenario === "TOO_FEW_KEYWORDS") {
      return {
        type: "KEYWORD_RESEARCH",
        idea: normalizedIdea,
        keywords: [
          normalizedIdea,
          `${normalizedIdea} template`,
          `${normalizedIdea} online`,
          `${normalizedIdea} custom`,
          `${normalizedIdea} digital`,
        ],
      };
    }

    if (scenario === "IRRELEVANT_KEYWORDS") {
      return {
        type: "KEYWORD_RESEARCH",
        idea: normalizedIdea,
        keywords: [
          "running shoes",
          "winter jackets",
          "coffee maker",
          "gaming keyboard",
          "office chair",
          "travel backpack",
          "phone case",
          "water bottle",
          "desk lamp",
          "wireless mouse",
        ],
      };
    }

    return {
      type: "KEYWORD_RESEARCH",
      idea: normalizedIdea,
      keywords: [
        normalizedIdea,
        `${normalizedIdea} template`,
        `${normalizedIdea} editable`,
        `${normalizedIdea} digital`,
        `${normalizedIdea} printable`,
        `${normalizedIdea} custom`,
        `${normalizedIdea} personalized`,
        `${normalizedIdea} online`,
        `${normalizedIdea} instant download`,
        `best ${normalizedIdea}`,
      ],
    };
  }

  if (task.id === "task_2") {
    if (scenario === "MISSING_PRODUCT_DESCRIPTION") {
      return {
        type: "PRODUCT_COPY",
        idea: normalizedIdea,
        title: `${normalizedIdea} - Practical Digital Guide`,
        description: "",
        keyBenefits: [
          "Easy to understand",
          "Designed for practical use",
          "Suitable for beginners",
        ],
      };
    }

    return {
      type: "PRODUCT_COPY",
      idea: normalizedIdea,
      title: `${normalizedIdea} - Practical Digital Guide`,
      description: `A practical ${normalizedIdea} resource designed to help customers get started with clear, useful, and easy-to-follow guidance.`,
      keyBenefits: [
        "Easy to understand",
        "Designed for practical use",
        "Suitable for beginners",
      ],
    };
  }

  throw new Error("MOCK_EXECUTOR_TASK_NOT_SUPPORTED");
}

function executeTaskMock(task, context, scenario = "GOOD_OUTPUT") {
  if (task.opportunityType) {
    return executeShopTaskMock(task, context);
  }

  return executeIdeaTaskMock(task, context, scenario);
}

export default executeTaskMock;
