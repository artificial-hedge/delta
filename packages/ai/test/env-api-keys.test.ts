import { afterEach, describe, expect, test } from "vitest";
import { findEnvKeys, getEnvApiKey } from "../src/env-api-keys.js";
import { getModel } from "../src/models.js";

describe("camelStream catalog", () => {
	test("exposes auto on the Stream completions endpoint", () => {
		const llm = getModel("camel-stream", "auto");
		expect(llm.api).toBe("openai-completions");
		expect(llm.baseUrl).toBe("https://stream.camelai.com/v1");
		expect(llm.contextWindow).toBe(262144);
	});
});

describe("camelStream API key resolution", () => {
	const original = process.env.CAMEL_API_KEY;

	afterEach(() => {
		if (original === undefined) {
			delete process.env.CAMEL_API_KEY;
		} else {
			process.env.CAMEL_API_KEY = original;
		}
	});

	test("resolves CAMEL_API_KEY", () => {
		process.env.CAMEL_API_KEY = "qaml_live_test";
		expect(findEnvKeys("camel-stream")).toEqual(["CAMEL_API_KEY"]);
		expect(getEnvApiKey("camel-stream")).toBe("qaml_live_test");
	});

	test("returns nothing without CAMEL_API_KEY", () => {
		delete process.env.CAMEL_API_KEY;
		expect(findEnvKeys("camel-stream")).toBeUndefined();
		expect(getEnvApiKey("camel-stream")).toBeUndefined();
	});
});
