function explainReport(report) {
  const explanations = [];

  if (report.recommendation === "WORTH_TESTING") {
    explanations.push(
      "This idea is worth testing based on the current evidence.",
    );
  }

  if (report.recommendation === "NEEDS_MORE_RESEARCH") {
    explanations.push(
      "More research is needed before making a strong recommendation.",
    );
  }

  if (report.recommendation === "REJECT") {
    explanations.push(
      "This idea does not currently meet the required decision rules.",
    );
  }

  const demand = report.criteria.demand;

  if (demand.score !== null) {
    explanations.push(
      `Demand scored ${demand.score}/10 with ${demand.confidence} confidence.`,
    );
  }

  const competition = report.criteria.competition;

  if (competition.score !== null) {
    explanations.push(
      `Competition scored ${competition.score}/10 with ${competition.confidence} confidence.`,
    );
  }

  explanations.push(`Overall score: ${report.score}/10.`);

  explanations.push(`Evidence coverage: ${report.evidenceCoverage}%.`);

  return explanations.join("\n");
}

export default explainReport;