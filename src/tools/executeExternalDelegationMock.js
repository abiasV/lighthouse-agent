function executeExternalDelegationMock(task, scenario = "GOOD_DELIVERABLE") {
  if (!task || task.executorType !== "EXTERNAL") {
    throw new Error("EXTERNAL_TASK_REQUIRED");
  }

  if (!task.delegation?.brief) {
    throw new Error("DELEGATION_BRIEF_REQUIRED");
  }

  const verifiedFacts = task.delegation.verifiedFacts ?? {};

  if (scenario === "DELIVERABLE_MISSING_REQUIREMENT") {
    return {
      type: "EXTERNAL_FREELANCER_DELIVERABLE",

      source: "MOCK",

      scenario,

      taskId: task.id,

      taskMatch: true,

      copyrightCheck: {
        passed: true,
      },

      productFactsUsed: {
        ...verifiedFacts,
      },

      files: [
        {
          name: "etsy-thumbnail.png",
          type: "FINAL_ASSET",
        },
      ],

      notes:
        "The freelancer delivered the final visual asset but did not include the editable source file.",
    };
  }

  if (scenario === "UNVERIFIED_PRODUCT_FACT") {
    return {
      type: "EXTERNAL_FREELANCER_DELIVERABLE",

      source: "MOCK",

      scenario,

      taskId: task.id,

      taskMatch: true,

      copyrightCheck: {
        passed: true,
      },

      productFactsUsed: {
        ...verifiedFacts,
        material: "Premium cardstock",
      },

      files: [
        {
          name: "etsy-thumbnail.png",
          type: "FINAL_ASSET",
        },
        {
          name: "etsy-thumbnail-source.fig",
          type: "SOURCE_FILE",
        },
      ],

      notes:
        "The deliverable introduced a product fact that was not verified by the seller.",
    };
  }

  if (scenario !== "GOOD_DELIVERABLE") {
    throw new Error("UNSUPPORTED_EXTERNAL_DELIVERY_SCENARIO");
  }

  return {
    type: "EXTERNAL_FREELANCER_DELIVERABLE",

    source: "MOCK",

    scenario,

    taskId: task.id,

    taskMatch: true,

    copyrightCheck: {
      passed: true,
    },

    productFactsUsed: {
      ...verifiedFacts,
    },

    files: [
      {
        name: "etsy-thumbnail.png",
        type: "FINAL_ASSET",
      },
      {
        name: "etsy-thumbnail-source.fig",
        type: "SOURCE_FILE",
      },
    ],

    notes:
      "The requested visual deliverable and editable source file were provided.",
  };
}

export default executeExternalDelegationMock;