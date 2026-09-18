import type { AgentTool } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import { isUnlimitedAutonomousLimit } from "../../src/core/autonomous.js";
import { createHarness, type Harness } from "./harness.js";

function createWaitingTool(): {
	tool: AgentTool;
	release: () => void;
	waitForStart: (harness: Harness) => Promise<void>;
} {
	let releaseToolExecution: (() => void) | undefined;
	const toolRelease = new Promise<void>((resolve) => {
		releaseToolExecution = resolve;
	});
	const tool: AgentTool = {
		name: "wait",
		label: "Wait",
		description: "Wait for release.",
		parameters: Type.Object({}),
		execute: async (_toolCallId, _params, signal) => {
			await new Promise<void>((resolve, reject) => {
				if (signal?.aborted) {
					reject(new Error("aborted"));
					return;
				}
				const abort = () => reject(new Error("aborted"));
				signal?.addEventListener("abort", abort, { once: true });
				toolRelease.then(() => {
					signal?.removeEventListener("abort", abort);
					resolve();
				});
			});
			return { content: [{ type: "text", text: "released" }], details: {}, terminate: true };
		},
	};
	return {
		tool,
		release: () => releaseToolExecution?.(),
		waitForStart: (harness) =>
			new Promise<void>((resolve) => {
				const unsubscribe = harness.session.subscribe((event) => {
					if (event.type === "tool_execution_start" && event.toolName === "wait") {
						unsubscribe();
						resolve();
					}
				});
			}),
	};
}

describe("AgentSession /24x7", () => {
	const harnesses: Harness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	it("turns on unlimited always-on autonomy and turns it off", async () => {
		const waiting = createWaitingTool();
		const harness = await createHarness({ tools: [waiting.tool] });
		harnesses.push(harness);
		harness.setResponses([fauxAssistantMessage(fauxToolCall("wait", {}), { stopReason: "toolUse" })]);

		const waitForStart = waiting.waitForStart(harness);
		const promptPromise = harness.session.prompt("/24x7 on stay on the desk");
		await waitForStart;

		expect(harness.session.alwaysOnState).toMatchObject({
			enabled: true,
			objective: "stay on the desk",
		});
		const status = harness.session.getAutonomousStatus();
		expect(status.enabled).toBe(true);
		expect(isUnlimitedAutonomousLimit(status.limits.maxContinuations)).toBe(true);
		expect(isUnlimitedAutonomousLimit(status.limits.maxTokens)).toBe(true);
		expect(isUnlimitedAutonomousLimit(status.limits.timeoutMs)).toBe(true);

		await harness.session.prompt("/24x7 off");
		waiting.release();
		await promptPromise;

		expect(harness.session.alwaysOnState.enabled).toBe(false);
		expect(harness.session.getAutonomousStatus().enabled).toBe(false);
	});
});
