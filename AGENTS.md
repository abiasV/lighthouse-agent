# Lighthouse Agent Instructions

## Working Style

- Be concise.
- Read only files relevant to the current task and their direct dependencies.
- Do not scan or analyze the entire repository unless the task requires it.
- Do not repeat information already established.
- Prefer the smallest safe implementation.
- Do not refactor unrelated code.
- Do not create unnecessary documentation.
- Do not ask for confirmation for routine implementation details.
- Ask only when a decision could materially change product behavior.

## Implementation

- Preserve existing behavior unless the task explicitly changes it.
- Reuse existing architecture, utilities, patterns, and naming conventions.
- Avoid unnecessary abstractions.
- Avoid adding dependencies unless they are clearly necessary.
- Do not modify unrelated files.

## Testing

- Run verification proportional to the change.
- For isolated changes, run only relevant tests first.
- Do not repeatedly run broad test suites for small changes.
- Run broader tests when the change affects shared or critical behavior.
- Run lint/build when relevant to the modified area.
- Fix failures caused by your changes.

## Lighthouse Safety Rules

- Preserve the existing agent workflow unless explicitly asked to change it.
- Preserve decision thresholds and scoring rules unless explicitly asked to change them.
- Do not silently change business logic.
- Do not silently change API contracts.
- Do not remove existing validation or tests without a clear reason.
- Keep changes backward-compatible when reasonably possible.

## Final Response

After implementation, report only:

1. Files changed
2. Key changes
3. Tests / lint / build results
4. Unresolved blockers, if any

Do not provide long explanations unless requested.