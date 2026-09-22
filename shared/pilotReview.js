import { normalizeReportingPeriod, PERIOD_ERRORS } from "./reportingPeriod.js";

export function validatePilotReview(input) {
  const errors = [];
  const text = (key, label, min, max) => {
    const value = typeof input?.[key] === "string" ? input[key].trim() : "";
    if (value.length < min || value.length > max) errors.push(`${label}: enter ${min}–${max} characters.`);
    return value;
  };
  const title = text("title", "Product title", 1, 140);
  const facts = text("facts", "Product details", 20, 2000);
  const problem = text("problem", "What you want to improve", 10, 500);
  let reportingPeriod;
  try { reportingPeriod = normalizeReportingPeriod(input?.reportingPeriod); }
  catch (error) { errors.push(PERIOD_ERRORS[error.message] || "Choose a valid reporting period."); }
  for (const key of ["views", "sales"]) {
    if (!Number.isSafeInteger(input?.[key]) || input[key] < 0 || input[key] > 100000000) errors.push(`${key}: enter a whole number from 0 to 100,000,000.`);
  }
  return { errors, value: { title, facts, problem, views: input?.views, sales: input?.sales, reportingPeriod } };
}
