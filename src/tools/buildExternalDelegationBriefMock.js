function buildExternalDelegationBriefMock(task, context, verifiedFacts) {
  if (!task || task.executorType !== "EXTERNAL") {
    throw new Error("EXTERNAL_TASK_REQUIRED");
  }

  if (task.riskLevel !== "MONEY_REQUIRED") {
    throw new Error("MONEY_REQUIRED_TASK_EXPECTED");
  }

  const projectContext =
    typeof context === "string" && context.trim() ? context.trim() : "UNKNOWN";

  return {
    type: "EXTERNAL_DELEGATION_BRIEF",

    source: "MOCK",

    taskId: task.id,

    projectContext,

    title: task.title,

    requestedWork:
      task.detectedFrom === "THUMBNAIL_QUALITY_SIGNAL"
        ? "Create a professional visual concept for the Etsy listing thumbnail."
        : task.description,

    delegationReason: task.delegationReason,

    detectedFrom: task.detectedFrom,

    budget: {
      ...task.budget,
    },

    verifiedFacts: {
      ...verifiedFacts,
    },

    constraints: [
      "Use only the verified product facts provided in this brief.",
      "Treat UNKNOWN values as unknown and do not invent missing product details.",
      "Do not introduce copyrighted characters, protected brands, or unverified intellectual property.",
    ],

    deliverables: [
      {
        id: "primary_asset",
        description:
          "Provide the requested production-ready visual deliverable.",
      },
      {
        id: "source_files",
        description:
          "Include the editable source files required for future revisions.",
      },
    ],

    acceptanceCriteria: task.acceptanceCriteria.map((criterion) => ({
      description: criterion.description,
      evaluationType: criterion.evaluationType,
    })),

    safeguards: {
      allowUnverifiedFacts: false,
      unknownValue: "UNKNOWN",
      requiresBudgetApproval: true,
    },
  };
}

export default buildExternalDelegationBriefMock;