function calculateScalabilityScore({
  ordersPerHourWithoutExtraHelp,
  manualBottleneckLevel,
}) {
  let capacityScore = 0;

  if (ordersPerHourWithoutExtraHelp >= 20) {
    capacityScore = 6;
  } else if (ordersPerHourWithoutExtraHelp >= 10) {
    capacityScore = 5;
  } else if (ordersPerHourWithoutExtraHelp >= 5) {
    capacityScore = 4;
  } else if (ordersPerHourWithoutExtraHelp >= 2) {
    capacityScore = 2;
  } else {
    capacityScore = 1;
  }

  let bottleneckScore = 0;

  if (manualBottleneckLevel === "LOW") {
    bottleneckScore = 4;
  } else if (manualBottleneckLevel === "MEDIUM") {
    bottleneckScore = 2;
  } else if (manualBottleneckLevel === "HIGH") {
    bottleneckScore = 0;
  }

  return Math.min(10, capacityScore + bottleneckScore);
}

export default calculateScalabilityScore;