"""Prime Agent goal skill: manage the persistent thread goal from the kernel.

All goal state lives in the TypeScript host; these functions are thin typed
wrappers over the generic host bridge (`rlm.host_request`). They only work
inside the Prime Agent Python kernel.
"""

from __future__ import annotations

from typing import Any

from rlm import host_request


async def get() -> dict[str, Any]:
    """Read the current thread goal.

    Returns a dict with `goal` (None when no goal is set), `remaining_tokens`,
    `remaining_seconds`, and `completion_budget_report`. The `goal` dict carries
    the objective, status, token budget, optional time floor, and usage.
    """
    return await host_request("goal.get")


async def create(
    objective: str,
    token_budget: int | None = None,
    time_budget_seconds: int | None = None,
) -> dict[str, Any]:
    """Start a new active thread goal.

    Fails while a goal is still pending (active, paused, or budget-limited);
    a completed or errored goal is replaced. Only create a goal when the user
    or system/developer instructions explicitly ask for a persistent
    long-running goal. Set `token_budget` only when an explicit token budget is
    requested. Set `time_budget_seconds` only when the user asked for a
    host-enforced minimum working duration; `complete()` is rejected until
    that wall-clock floor is met.
    """
    if not isinstance(objective, str):
        raise TypeError(f"objective must be str, got {type(objective).__name__}")
    if token_budget is not None and not isinstance(token_budget, int):
        raise TypeError(f"token_budget must be int or None, got {type(token_budget).__name__}")
    if time_budget_seconds is not None and not isinstance(time_budget_seconds, int):
        raise TypeError(
            f"time_budget_seconds must be int or None, got {type(time_budget_seconds).__name__}"
        )
    payload: dict[str, Any] = {"objective": objective}
    if token_budget is not None:
        payload["token_budget"] = token_budget
    if time_budget_seconds is not None:
        payload["time_budget_seconds"] = time_budget_seconds
    return await host_request("goal.create", payload)


async def complete() -> dict[str, Any]:
    """Mark the existing thread goal achieved.

    Use only when the objective has actually been achieved, no required work
    remains, and any host time floor has elapsed — not because the budget is
    nearly exhausted or because you are stopping work. The host rejects
    early completion on time-bound goals. Pause, resume, and budget-limit
    transitions are controlled by the user and the host.
    """
    return await host_request("goal.complete")
