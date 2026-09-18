import { describe, expect, it } from "vitest";
import {
	createGoalContextMessage,
	formatGoalDuration,
	formatGoalUsage,
	type GoalState,
	goalHostResponse,
	goalTimeFloorError,
	goalTimeFloorRemainingSeconds,
	parseGoalDuration,
	validateGoalTimeBudget,
} from "../src/core/goals.js";

function goal(overrides: Partial<GoalState> = {}): GoalState {
	return {
		active: true,
		status: "active",
		objective: "stay on the desk",
		tokensUsed: 0,
		timeUsedSeconds: 0,
		continuationsUsed: 0,
		...overrides,
	};
}

describe("parseGoalDuration", () => {
	it.each([
		["10h", 10 * 3600],
		["10hrs", 10 * 3600],
		["10 hours", 10 * 3600],
		["90m", 90 * 60],
		["1h30m", 90 * 60],
		["1h 30m", 90 * 60],
		["45s", 45],
		["2d", 2 * 24 * 3600],
	])("parses %s", (input, seconds) => {
		expect(parseGoalDuration(input)).toBe(seconds);
	});

	it.each(["", "10", "10x", "0h", "-2h", "hour"])("rejects %s", (input) => {
		expect(() => parseGoalDuration(input)).toThrow(/duration/i);
	});
});

describe("goal time floor", () => {
	it("blocks complete until the floor is met", () => {
		const pending = goal({ timeBudgetSeconds: 36000, timeUsedSeconds: 120 });
		expect(goalTimeFloorRemainingSeconds(pending)).toBe(36000 - 120);
		expect(goalTimeFloorError(pending)).toMatch(/2m of 10h elapsed/);
		expect(goalHostResponse(pending, false)).toMatchObject({
			remaining_seconds: 36000 - 120,
			goal: { time_budget_seconds: 36000 },
		});
	});

	it("lifts the floor once elapsed time reaches the budget", () => {
		const met = goal({ timeBudgetSeconds: 3600, timeUsedSeconds: 3600 });
		expect(goalTimeFloorRemainingSeconds(met)).toBe(0);
		expect(createGoalContextMessage(met, "continuation").content).toMatch(/floor met/i);
	});

	it("shows the floor in usage and continuation prompts while time remains", () => {
		const pending = goal({ timeBudgetSeconds: 36000, timeUsedSeconds: 3661 });
		expect(formatGoalUsage(pending)).toBe("1h 01m / 10h");
		expect(formatGoalDuration(3661)).toBe("1h 01m");
		expect(String(createGoalContextMessage(pending, "continuation").content)).toMatch(
			/host-enforced time-bound goal/i,
		);
	});

	it("rejects a time floor above the maximum", () => {
		expect(() => validateGoalTimeBudget(31 * 24 * 3600)).toThrow(/at most/i);
	});
});
