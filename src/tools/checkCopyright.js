function checkCopyright(idea, scenario = "PASS") {
  console.log(`Checking copyright risk for: ${idea} | Scenario: ${scenario}`);

  if (scenario === "PASS") {
    return {
      passed: true,
      risk: "LOW",
    };
  }

  if (scenario === "FAIL") {
    return {
      passed: false,
      risk: "HIGH",
    };
  }

  throw new Error(`Unknown copyright scenario: ${scenario}`);
}

export default checkCopyright;