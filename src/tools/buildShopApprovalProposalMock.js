function findListing(shopData, task) {
  if (!Array.isArray(shopData?.listings)) {
    return null;
  }

  return (
    shopData.listings.find((listing) => listing.id === task.listingId) ?? null
  );
}

function buildShopApprovalProposalMock(task, shopData) {
  if (task.opportunityType !== "IMPROVE_CONVERSION") {
    throw new Error("SHOP_APPROVAL_PROPOSAL_TASK_NOT_SUPPORTED");
  }

  const listing = findListing(shopData, task);

  if (!listing) {
    throw new Error("SHOP_APPROVAL_PROPOSAL_LISTING_NOT_FOUND");
  }

  return {
    type: "SHOP_LISTING_CHANGE_PROPOSAL",

    source: "MOCK",

    listingId: listing.id,

    listingTitle: listing.title,

    diagnosis: {
      observedSignal:
        "This listing receives meaningful traffic but converts relatively few visitors into sales.",

      possibleContributors: [
        {
          category: "POSITIONING",
          explanation:
            "The offer may not communicate a clear or differentiated value to buyers.",
        },
        {
          category: "TITLE",
          explanation:
            "The title may not communicate the strongest buyer intent clearly enough.",
        },
        {
          category: "THUMBNAIL_MESSAGE",
          explanation:
            "The main image may not communicate the product value clearly enough.",
        },
        {
          category: "PRICE",
          explanation:
            "The price may not match buyer expectations for the current offer.",
        },
        {
          category: "DESCRIPTION",
          explanation:
            "Important purchase information may not be clear enough in the listing description.",
        },
      ],

      confidence: "LOW",

      provenCause: null,
    },

    summary:
      "Lighthouse found a low-conversion signal and prepared possible listing improvements for review. No single cause has been proven.",

    proposedChanges: [
      {
        field: "TITLE",

        currentValue: listing.title,

        proposedValue: `${listing.title} Printable | Simple Focus Planning Template`,

        reason:
          "Test whether clearer product format and buyer intent improve conversion.",
      },

      {
        field: "THUMBNAIL_MESSAGE",

        currentValue: null,

        proposedValue: "Stay Focused. Plan Your Day.",

        reason:
          "Test whether communicating the primary benefit more clearly improves buyer understanding.",
      },

      {
        field: "DESCRIPTION_OPENING",

        currentValue: null,

        proposedValue:
          "A simple printable planning tool designed to help you organize priorities, reduce distractions, and stay focused throughout the day.",

        reason:
          "Test whether leading with the buyer problem, expected outcome, and core product value improves conversion.",
      },
    ],

    safeguards: {
      didModifyShop: false,
      externalSpend: 0,
    },
  };
}

export default buildShopApprovalProposalMock;
