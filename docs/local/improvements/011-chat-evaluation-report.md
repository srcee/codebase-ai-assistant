# Improvement 011: Chat evaluation report for Stage 9

- **Status:** Open
- **Severity:** Medium
- **Area:** `apps/api/src/app/modules/chat/chat.eval.spec.ts`, `libs/server/testing/eval/reports`, decision 0013
- **Target stage:** Any (before changing chat thresholds or models)

## Problem

The Stage 9 definition of done asks for an updated evaluation report, but no chat report is committed. `CHAT_MIN_VECTOR_SIMILARITY` and `CHAT_MIN_TERM_COVERAGE` keep their 0.5 defaults without a measurement, although decision 0013 says they are tuned with the chat evaluation.

## Proposed fix

- Baseline: check out `0b14526` (main after CAA-17, question set `chat-questions.v1.json`) and run the chat evaluation from the README with `EVAL_LABEL=stage9-baseline`.
- Final: run it on main (question set v2, with follow-ups) with `EVAL_LABEL=stage9`.
- Fill in the manual groundedness table of `chat-stage9.md`, compare citation validity, abstention, and answers that cite an expected location, and tune the two thresholds if needed (config defaults, README, `.env.example`, decision 0013).
- Commit both reports to `libs/server/testing/eval/reports`.

Both runs need the local embedding and chat models and the test database.

## Tests

- None; the reports are the deliverable.

## Related

- [Stage 9](../../stage-9.md)
- [Decision 0013](../../decisions/0013-chat-and-grounded-generation.md)
