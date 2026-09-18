import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import {
	ALWAYS_ON_DEFAULT_OBJECTIVE,
	isPersistedAlwaysOnState,
	parseAlwaysOnSlashCommand,
} from "../src/core/always-on.js";
import { createAutonomousRuntimeState, shouldAutonomouslyContinue } from "../src/core/autonomous.js";

describe("24x7 always-on policy", () => {
	it.each([
		["", { kind: "status" }],
		["status", { kind: "status" }],
		["off", { kind: "off" }],
		["stop", { kind: "off" }],
		["on", { kind: "on", objective: ALWAYS_ON_DEFAULT_OBJECTIVE }],
		["keep the desk SOTA", { kind: "on", objective: "keep the desk SOTA" }],
		["on ship features", { kind: "on", objective: "ship features" }],
	])("parses /24x7 %s", (args, expected) => {
		expect(parseAlwaysOnSlashCommand(args)).toEqual(expected);
	});

	it("rejects incomplete persisted state", () => {
		expect(isPersistedAlwaysOnState({ enabled: true })).toBe(false);
		expect(isPersistedAlwaysOnState({ enabled: true, objective: "keep going" })).toBe(true);
	});

	it("keeps continuing when always-on even after an error or exhausted budget", async () => {
		const state = createAutonomousRuntimeState({
			enabled: true,
			alwaysOn: true,
			maxContinuations: 1,
			maxTurns: 1,
			maxTokens: 1,
			timeoutMs: 1,
		});
		state.continuationsUsed = 1;
		state.turnsUsed = 1;
		state.tokensUsed = 1;
		state.startedAt = Date.now() - 10_000;

		expect(
			await shouldAutonomouslyContinue(state, fauxAssistantMessage("provider failed", { stopReason: "error" })),
		).toMatchObject({ shouldContinue: true });
		expect(await shouldAutonomouslyContinue(state, fauxAssistantMessage("Done."))).toMatchObject({
			shouldContinue: true,
		});
		expect(
			await shouldAutonomouslyContinue(state, fauxAssistantMessage("stopped", { stopReason: "aborted" })),
		).toMatchObject({ shouldContinue: false });
	});
});
