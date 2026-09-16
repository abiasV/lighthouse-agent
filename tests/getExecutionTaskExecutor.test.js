import test from "node:test";
import assert from "node:assert/strict";

import getExecutionTaskExecutor from "../src/tools/getExecutionTaskExecutor.js";
import executeTaskMock from "../src/tools/executeTaskMock.js";
import executeTaskReal from "../src/tools/executeTaskReal.js";

test("execution selector returns mock executor when real execution is disabled", () => {
  const executor = getExecutionTaskExecutor(false);

  assert.equal(executor, executeTaskMock);
});

test("execution selector returns real executor when real execution is enabled", () => {
  const executor = getExecutionTaskExecutor(true);

  assert.equal(executor, executeTaskReal);
});