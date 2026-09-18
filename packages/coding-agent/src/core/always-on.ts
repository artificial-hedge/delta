import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import { type AgentAutonomousConfig, UNLIMITED_AUTONOMOUS_LIMIT } from "./autonomous.js";
import type { CustomMessage } from "./messages.js";

export const ALWAYS_ON_STATE_CUSTOM_TYPE = "thread_always_on_state";
export const ALWAYS_ON_CONTEXT_CUSTOM_TYPE = "always_on_context";
export const ALWAYS_ON_CONTEXT_PREVIEW_LABEL = "24x7";
export const ALWAYS_ON_DEFAULT_OBJECTIVE =
	"Keep this workspace at SOTA, then add the next high-ROI capability. Never idle.";

export interface AlwaysOnState {
	enabled: boolean;
	objective: string;
	startedAt?: number;
	updatedAt?: number;
}

export type AlwaysOnSlashCommand = { kind: "status" } | { kind: "off" } | { kind: "on"; objective: string };

export function emptyAlwaysOnState(): AlwaysOnState {
	return {
		enabled: false,
		objective: ALWAYS_ON_DEFAULT_OBJECTIVE,
	};
}

export function isPersistedAlwaysOnState(value: unknown): value is AlwaysOnState {
	if (!value || typeof value !== "object") {
		return false;
	}
	const record = value as Record<string, unknown>;
	return (
		typeof record.enabled === "boolean" && typeof record.objective === "string" && record.objective.trim().length > 0
	);
}

export function alwaysOnAutonomousConfig(objective: string): AgentAutonomousConfig {
	return {
		enabled: true,
		alwaysOn: true,
		maxContinuations: UNLIMITED_AUTONOMOUS_LIMIT,
		maxTurns: UNLIMITED_AUTONOMOUS_LIMIT,
		maxTokens: UNLIMITED_AUTONOMOUS_LIMIT,
		timeoutMs: UNLIMITED_AUTONOMOUS_LIMIT,
		gates: { commands: [] },
		subagentKeepAliveMs: 10 * 60 * 1000,
		continuationPrompt: alwaysOnContinuationPrompt(objective),
	};
}

export function alwaysOnContinuationPrompt(objective: string): string {
	return `24x7 always-on mode is active. No human input will arrive. Token spend is not a stop condition. Only the user stopping this session (/24x7 off, /autonomous off, abort, or shutdown) ends the run.

<objective>
${escapeXmlText(objective)}
</objective>

Work charter — never idle:
1. If there is an active user goal, pursue it with concrete progress this turn.
2. If current work is incomplete, finish it and verify with tests, types, or a runnable check.
3. If it already works, raise it to SOTA: correctness, edge cases, performance, UX, docs, and failure modes.
4. If it is already SOTA, add the next high-ROI feature or function and make that SOTA too.
5. Do not ask the user. Do not end the session. Do not wait. Pick the next best action and do it.

Risk-weighted self-decision (score every intended action before you act):
- Dimensions (0-1 each): irreversibility, blast radius, secrecy, spend, and whether it leaves the user's machine or accounts.
- Risk = max(dimension). ROI = expected capability/reliability/user-visible gain per unit of effort.
- Low (<0.3): act now. Local reads, workspace edits, tests, project dependency installs, refactors you can revert in git.
- Medium (0.3-0.6): act if ROI is clearly higher than safer alternatives. State a one-line justification. Prefer reversible steps.
- High (>0.6): skip it and keep working on a safer high-ROI path. Never: attack systems, steal credentials, disable OS security, rm -rf /, rewrite SSH keys, force-push main/master, exfiltrate secrets, or send email/Slack/calendar invites the user did not ask for.

Computer use: you already run as this user. Use the Python REPL, shell, files, subagents, and available MCP tools. Do not wait for permission on routine local work. Prefer the workspace and this machine; do not reach other people's systems.

If you believe the work is perfect, you are wrong for stopping: raise quality or add the next capability.`;
}

export function createAlwaysOnContextMessage(
	state: AlwaysOnState,
	images?: ImageContent[],
): CustomMessage<{ objective: string }> {
	const text = `[24x7]\n\n${alwaysOnContinuationPrompt(state.objective)}`;
	const content: string | (TextContent | ImageContent)[] =
		images && images.length > 0 ? [{ type: "text", text }, ...images] : text;
	return {
		role: "custom",
		customType: ALWAYS_ON_CONTEXT_CUSTOM_TYPE,
		content,
		display: true,
		details: { objective: state.objective },
		timestamp: Date.now(),
	};
}

export function parseAlwaysOnSlashCommand(args: string): AlwaysOnSlashCommand {
	const rest = args.trim();
	const normalized = rest.toLowerCase();
	if (!rest || normalized === "status") {
		return { kind: "status" };
	}
	if (normalized === "off" || normalized === "stop" || normalized === "clear") {
		return { kind: "off" };
	}
	if (normalized === "on" || normalized === "start" || normalized === "enable") {
		return { kind: "on", objective: ALWAYS_ON_DEFAULT_OBJECTIVE };
	}
	if (normalized.startsWith("on ") || normalized.startsWith("start ") || normalized.startsWith("enable ")) {
		const objective = rest.slice(rest.indexOf(" ") + 1).trim();
		return { kind: "on", objective: objective || ALWAYS_ON_DEFAULT_OBJECTIVE };
	}
	return { kind: "on", objective: rest };
}

export function formatAlwaysOnStatus(state: AlwaysOnState): string {
	if (!state.enabled) {
		return "[24x7: off]\n\nAlways-on is stopped. /24x7 on starts an unlimited run until you stop it.";
	}
	return `[24x7: on]\n\nWorking until manually stopped.\nObjective: ${state.objective}`;
}

function escapeXmlText(input: string): string {
	return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
