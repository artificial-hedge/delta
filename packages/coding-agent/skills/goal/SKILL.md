---
name: goal
description: Manage the persistent thread goal from the Python REPL. Use to read goal status, token budget, and time-floor usage, to start a goal when the user explicitly asks for one, or to mark the active goal complete once its objective is fully achieved and any host time floor has elapsed.
---

# Goal

The thread goal is a persistent objective the harness keeps re-prompting you to
pursue across turns until it is complete. Goal state (status, token budget,
optional time floor, usage accounting) lives in the host; this skill is the
kernel-side interface to it. Call it directly from the Python REPL:

```python
await goal.get()
await goal.create("ship the release notes")
# Only pass token_budget or time_budget_seconds when the user explicitly asks:
# await goal.create("stay on the desk", time_budget_seconds=36000)
await goal.complete()
```

## API

- `await goal.get()` — current goal as a dict: `goal` (or `None` when no goal
  is set), `remaining_tokens`, `remaining_seconds`, and
  `completion_budget_report`. The `goal` dict carries `objective`, `status`,
  `token_budget`, `time_budget_seconds`, `tokens_used`, `time_used_seconds`,
  and timestamps.
- `await goal.create(objective, token_budget=None, time_budget_seconds=None)` —
  start a new active goal. Fails while a goal is still pending (active, paused,
  or budget-limited); a completed or errored goal is replaced by the new one.
  Only create a goal when the user or system/developer instructions explicitly
  ask for a persistent long-running goal; do not infer goals from ordinary
  tasks. Set `token_budget` or `time_budget_seconds` only when the user asked
  for that budget.
- `await goal.complete()` — mark the existing goal achieved. Use only when the
  objective has actually been achieved, no required work remains, and any host
  time floor has elapsed. The host rejects early completion on time-bound
  goals. Do not call it merely because the token budget is nearly exhausted or
  because you are stopping work. When the result includes a
  `completion_budget_report`, report that final usage to the user.

## Rules

- Goal status transitions other than completion (pause, resume, clear,
  budget-limiting) are controlled by the user and the host; there is no API for
  them here.
- When an active goal has a time floor, keep making concrete progress until
  `remaining_seconds` is 0. Saying the work is done does not stop the harness.
- When an active goal is actually complete and the time floor is met, call
  `await goal.complete()`; do not merely say it is done — the harness keeps
  continuing the goal until the completion call arrives.
