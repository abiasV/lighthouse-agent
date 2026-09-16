import "dotenv/config";

import researchDemandReal from "../src/tools/researchDemandReal.js";

const runRealDemandTest = process.env.RUN_REAL_DEMAND_TEST === "true";

console.log("\n=== LIGHTHOUSE REAL DEMAND TEST ===");

if (!runRealDemandTest) {
  console.log("\n🟢 FREE TEST");
  console.log("Real demand research is disabled.");
  console.log("OpenAI API requests: 0");

  console.log("\nTo run the intentional paid test:");
  console.log("RUN_REAL_DEMAND_TEST=true npm run test:real:demand");

  process.exit(0);
}

console.log("\n💰 REAL API TEST");

try {
  const result = await researchDemandReal("Birthday Invitation");

  console.log("\nREAL DEMAND SUMMARY:");
  console.log(result.summary);

  console.log("\nCONFIDENCE:");
  console.log(result.confidence);

  console.log("\nSOURCES:");
  console.dir(result.sources, {
    depth: null,
  });

  console.log("\nSTRUCTURED EVIDENCE:");
  console.dir(result.evidence, {
    depth: null,
  });

  console.log("\n=== REAL DEMAND TEST FINISHED ===");
} catch (error) {
  console.error("\n=== REAL DEMAND TEST FAILED ===");
  console.error(error?.message ?? error);

  process.exitCode = 1;
}