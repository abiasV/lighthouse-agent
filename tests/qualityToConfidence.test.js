import test from "node:test";
import assert from "node:assert/strict";

import qualityToConfidence from "../src/utils/qualityToConfidence.js";

test("high quality returns HIGH confidence", () => {
  const quality = {
    sourceQuality: 90,
    relevance: 90,
    freshness: 85,
    completeness: 85,
  };

  const confidence = qualityToConfidence(quality);

  assert.equal(confidence, "HIGH");
});

test("medium quality returns MEDIUM confidence", () => {
  const quality = {
    sourceQuality: 75,
    relevance: 80,
    freshness: 70,
    completeness: 75,
  };

  const confidence = qualityToConfidence(quality);

  assert.equal(confidence, "MEDIUM");
});

test("low quality returns LOW confidence", () => {
  const quality = {
    sourceQuality: 50,
    relevance: 60,
    freshness: 55,
    completeness: 60,
  };

  const confidence = qualityToConfidence(quality);

  assert.equal(confidence, "LOW");
});

test("average of exactly 85 returns HIGH", () => {
  const quality = {
    sourceQuality: 85,
    relevance: 85,
    freshness: 85,
    completeness: 85,
  };

  assert.equal(qualityToConfidence(quality), "HIGH");
});

test("average of exactly 70 returns MEDIUM", () => {
  const quality = {
    sourceQuality: 70,
    relevance: 70,
    freshness: 70,
    completeness: 70,
  };

  assert.equal(qualityToConfidence(quality), "MEDIUM");
});