import test from "node:test";
import assert from "node:assert/strict";

import evaluateEvidenceQuality from "../src/utils/evaluateEvidenceQuality.js";

test("strong sources receive higher source quality", () => {
  const evidence = {
    type: "REAL_DEMAND_RESEARCH",

    value: `
Current 2026 demand evidence shows active buyer interest,
recent marketplace activity, and current search behavior.
`,

    sources: [
      "https://www.etsy.com/market/digital_birthday_invitations",
      "https://trends.google.com/trends/explore",
      "https://www.apple.com/newsroom/",
      "https://www.paperlesspost.com/birthday",
      "https://www.evite.com/invites/birthday/",
    ],
  };

  const quality = evaluateEvidenceQuality(evidence);

  assert.ok(quality.sourceQuality >= 70);

  assert.ok(quality.relevance >= 80);

  assert.ok(quality.freshness >= 80);

  assert.ok(quality.completeness >= 75);
});

test("weak sources receive lower source quality", () => {
  const evidence = {
    type: "REAL_DEMAND_RESEARCH",

    value: `
Some discussion exists about birthday invitations,
but the evidence is limited.
`,

    sources: [
      "https://www.reddit.com/r/example/",
      "https://en.wikipedia.org/wiki/Invitation",
      "https://unknown-example-site.com/article",
    ],
  };

  const quality = evaluateEvidenceQuality(evidence);

  assert.ok(quality.sourceQuality < 70);
});

test("quality scores always stay between 0 and 100", () => {
  const evidence = {
    type: "REAL_DEMAND_RESEARCH",

    value: `
2026 demand evidence with many sources.
`,

    sources: [
      "https://www.etsy.com/a",
      "https://www.google.com/b",
      "https://www.apple.com/c",
      "https://www.businesswire.com/d",
      "https://www.paperlesspost.com/e",
      "https://www.evite.com/f",
    ],
  };

  const quality = evaluateEvidenceQuality(evidence);

  for (const score of Object.values(quality)) {
    assert.ok(score >= 0);
    assert.ok(score <= 100);
  }
});