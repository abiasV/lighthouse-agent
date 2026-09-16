import decideNextAction from "./decideNextAction.js";
import executeAction from "./executeAction.js";

async function runAgent(state, options = {}) {
  while (true) {
    const action = decideNextAction(state);

    console.log(`\nNext action: ${action}`);

    if (action === "STOP" || action === "NO_ACTION") {
      break;
    }

    state = await executeAction(action, state, options);

    if (
      state.agentStatus === "PAUSED" ||
      state.agentStatus === "COMPLETE" ||
      state.agentStatus === "REJECTED" ||
      state.agentStatus === "PLANNING_FAILED"
    ) {
      break;
    }
  }

  return state;
}

export default runAgent;
