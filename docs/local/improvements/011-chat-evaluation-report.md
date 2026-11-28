# Improvement 011: Chat evaluation report for Stage 9

- **Status:** Partly done: `chat-stage-9-baseline` and `chat-stage-9` are committed, but were run with `qwen2.5-coder:3b`
- **Severity:** Medium
- **Area:** `apps/api/src/app/modules/chat/chat.eval.spec.ts`, `libs/server/testing/eval/reports`, decision 0013
- **Target stage:** Any (before changing chat thresholds or models)

## Problem

The Stage 9 definition of done asks for an evaluation report, and `CHAT_MIN_VECTOR_SIMILARITY` and `CHAT_MIN_TERM_COVERAGE` keep their 0.5 defaults without a measurement, although decision 0013 says they are tuned with the chat evaluation.

The committed reports do not settle this:

- With 3b, the model rarely writes `[n]` markers, so 97% of answerable questions end as `unsupported` (`chat-stage-9`: 2.6% cite an expected location). They measure the model, not retrieval or the thresholds.
- Uncommitted runs with `qwen2.5-coder:7b` (the default `CHAT_MODEL`) on the same code reached 71–82% answerable questions citing an expected location, 100% citation validity, 100% follow-ups, and 100% declines on unanswerable questions, at about 9–10 s p50 and 27–34 s p95.
- No run, with 3b or 7b and thresholds between 0.4 and 0.5, abstained on the server (`Unanswerable: abstained by the server` 0%). Every unanswerable question was declined by the model after a model call, so the thresholds were never exercised.

## Proposed fix

1. Rerun with 7b and replace the two reports (`CHAT_MODEL=qwen2.5-coder:7b`, local models and test database):
   - Baseline: check out `0b14526` (main after PR #15, question set `chat-questions.v1.json`), `EVAL_LABEL=stage-9-baseline`.
   - Final: current main (question set v2, with follow-ups), `EVAL_LABEL=stage-9`.
2. Fill in the manual groundedness column of `chat-stage-9.md` (0–2 per answered question) and add a short summary at the top: baseline vs final, what changed, open issues.
3. Tune the thresholds: log or add to the report the best vector similarity and term coverage of each question, then pick values that let the server abstain on most unanswerable questions without abstaining on answerable ones. If no value separates them, keep 0.5 and record that abstention relies on the model.
4. Update config defaults, README, `.env.example`, and decision 0013 if the values change, and record the chosen values and why in decision 0013.

## Tests

- None; the reports are the deliverable. If step 3 adds per-question scores to the report, cover the report writer with a unit test.

## Related

- [Stage 9](../../stage-9.md)
- [Decision 0013](../../decisions/0013-chat-and-grounded-generation.md)
