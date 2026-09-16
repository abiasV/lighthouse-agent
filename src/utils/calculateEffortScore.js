function calculateEffortScore({ minutesPerOrder, humanDependency }) {
  let timeScore = 0;

  if (minutesPerOrder <= 5) {
    timeScore = 6;
  } else if (minutesPerOrder <= 15) {
    timeScore = 5;
  } else if (minutesPerOrder <= 30) {
    timeScore = 4;
  } else if (minutesPerOrder <= 60) {
    timeScore = 2;
  } else {
    timeScore = 1;
  }

  let dependencyScore = 0;

  if (humanDependency === "LOW") {
    dependencyScore = 4;
  } else if (humanDependency === "MEDIUM") {
    dependencyScore = 2;
  } else if (humanDependency === "HIGH") {
    dependencyScore = 0;
  }

  return Math.min(10, timeScore + dependencyScore);
}

export default calculateEffortScore;
