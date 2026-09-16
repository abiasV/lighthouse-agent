import test from "node:test";
import assert from "node:assert/strict";

import generateExecutionPlan from "../src/tools/generateExecutionPlan.js";
import executeTaskReal from "../src/tools/executeTaskReal.js";

test("real executor creates keyword research using an injected client", async () => {
  const plan = generateExecutionPlan(
    "Dog Training Course",
  );

  const task = plan.tasks[0];

  let requestOptions = null;

  const fakeClient = {
    responses: {
      async create(options) {
        requestOptions = options;

        return {
          output_text: JSON.stringify({
            keywords: [
              "dog training course",
              "online dog training course",
              "best dog training course",
              "dog training course for beginners",
              "puppy training course",
              "dog obedience course",
              "dog training classes online",
              "dog behavior training course",
              "home dog training program",
              "professional dog training course",
            ],
          }),
        };
      },
    },
  };

  const result = await executeTaskReal(
    task,
    "Dog Training Course",
    "GOOD_OUTPUT",
    fakeClient,
  );

  assert.equal(result.type, "KEYWORD_RESEARCH");

  assert.equal(
    result.idea,
    "Dog Training Course",
  );

  assert.equal(result.keywords.length, 10);

  assert.equal(requestOptions.model, "gpt-5.6");

  assert.equal(requestOptions.store, false);

  assert.match(
    requestOptions.input,
    /Dog Training Course/,
  );
});

test("real executor creates product copy using an injected client", async () => {
  const plan = generateExecutionPlan(
    "Dog Training Course",
  );

  const task = plan.tasks[1];

  const fakeClient = {
    responses: {
      async create() {
        return {
          output_text: JSON.stringify({
            title:
              "Dog Training Course - Beginner Guide",

            description:
              "A practical dog training course designed to help beginners build better everyday training habits.",

            keyBenefits: [
              "Beginner friendly",
              "Practical exercises",
              "Easy-to-follow guidance",
            ],
          }),
        };
      },
    },
  };

  const result = await executeTaskReal(
    task,
    "Dog Training Course",
    "GOOD_OUTPUT",
    fakeClient,
  );

  assert.equal(result.type, "PRODUCT_COPY");

  assert.ok(result.title);

  assert.ok(result.description);

  assert.equal(
    result.keyBenefits.length,
    3,
  );
});

test("real executor rejects invalid JSON output", async () => {
  const plan = generateExecutionPlan(
    "Dog Training Course",
  );

  const task = plan.tasks[0];

  const fakeClient = {
    responses: {
      async create() {
        return {
          output_text: "This is not JSON",
        };
      },
    },
  };

  await assert.rejects(
    () =>
      executeTaskReal(
        task,
        "Dog Training Course",
        "GOOD_OUTPUT",
        fakeClient,
      ),

    /REAL_EXECUTOR_INVALID_JSON/,
  );
});

test("real executor rejects unsupported tasks", async () => {
  const plan = generateExecutionPlan(
    "Dog Training Course",
  );

  const task = {
    ...plan.tasks[0],
    id: "task_999",
  };

  const fakeClient = {
    responses: {
      async create() {
        throw new Error(
          "Client should not be called",
        );
      },
    },
  };

  await assert.rejects(
    () =>
      executeTaskReal(
        task,
        "Dog Training Course",
        "GOOD_OUTPUT",
        fakeClient,
      ),

    /REAL_EXECUTOR_TASK_NOT_SUPPORTED/,
  );
});