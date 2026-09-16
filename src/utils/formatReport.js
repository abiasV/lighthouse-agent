function formatReport(report) {
  const lines = [];

  lines.push("Lighthouse Analysis");
  lines.push("");
  lines.push(`Idea: ${report.idea}`);
  lines.push(`Score: ${report.score} / 10`);
  lines.push(
    `Evidence Coverage: ${report.evidenceCoverage}%`,
  );

  lines.push("");
  lines.push(
    `Recommendation: ${report.recommendation}`,
  );

  lines.push(`Reason: ${report.reason}`);

  lines.push("");
  lines.push("Criteria:");

  for (const [name, criterion] of Object.entries(
    report.criteria,
  )) {
    lines.push(
      `- ${name}: score=${criterion.score}, confidence=${criterion.confidence}, status=${criterion.status}`,
    );
  }

  return lines.join("\n");
}

export default formatReport;