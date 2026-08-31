import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { ask } from "../agent/lib/perplexity";

type PerplexityChatResponse = {
	choices?: { message?: { content?: string } }[];
	citations?: string[];
	search_results?: { url?: string }[];
};

type PerplexityChatRequestBody = {
	model: string;
	messages: { role: string; content: string }[];
	search_domain_filter?: string[];
};

const realFetch = globalThis.fetch;
const savedKey = process.env.PERPLEXITY_API_KEY;

let requestUrl: string | null = null;
let requestBody: PerplexityChatRequestBody | null = null;

function respondsWith(body: PerplexityChatResponse, status = 200) {
	globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
		requestUrl = String(input instanceof Request ? input.url : input);
		requestBody = init?.body
			? (JSON.parse(String(init.body)) as PerplexityChatRequestBody)
			: null;
		return new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json" },
		});
	}) as typeof fetch;
}

beforeEach(() => {
	process.env.PERPLEXITY_API_KEY = "pplx-test-key";
	requestUrl = null;
	requestBody = null;
});

afterEach(() => {
	globalThis.fetch = realFetch;
	if (savedKey === undefined) delete process.env.PERPLEXITY_API_KEY;
	else process.env.PERPLEXITY_API_KEY = savedKey;
});

describe("ask, with a direct Perplexity key configured", () => {
	it("calls Perplexity's chat completions endpoint directly", async () => {
		respondsWith({
			choices: [{ message: { content: "Acme raised a Series C." } }],
			citations: ["https://example.test/acme-series-c"],
		});

		const answer = await ask("What has Acme announced recently?");

		expect(requestUrl).toBe("https://api.perplexity.ai/chat/completions");
		expect(answer).toEqual({
			ok: true,
			data: {
				text: "Acme raised a Series C.",
				citations: ["https://example.test/acme-series-c"],
			},
		});
	});

	it("sends the question, system prompt, and domain filter through", async () => {
		respondsWith({ choices: [{ message: { content: "Some answer." } }] });

		await ask("Find the person", {
			system: "Be terse.",
			domains: ["linkedin.com"],
		});

		expect(requestBody).toMatchObject({
			messages: [
				{ role: "system", content: "Be terse." },
				{ role: "user", content: "Find the person" },
			],
			search_domain_filter: ["linkedin.com"],
		});
	});

	it("picks sonar by default and sonar-pro for a larger maxResults", async () => {
		respondsWith({ choices: [{ message: { content: "Answer." } }] });
		await ask("Q", {});
		expect(requestBody?.model).toBe("sonar");

		respondsWith({ choices: [{ message: { content: "Answer." } }] });
		await ask("Q", { maxResults: 10 });
		expect(requestBody?.model).toBe("sonar-pro");
	});

	it("falls back to search_results urls when citations is absent", async () => {
		respondsWith({
			choices: [{ message: { content: "Answer." } }],
			search_results: [{ url: "https://example.test/one" }, {}],
		});

		const answer = await ask("Q");

		expect(answer).toMatchObject({
			ok: true,
			data: { citations: ["https://example.test/one"] },
		});
	});

	it("reports a non-2xx response as a failure, not a throw", async () => {
		respondsWith({}, 500);

		const answer = await ask("Q");

		expect(answer).toEqual({ ok: false, reason: "HTTP 500" });
	});

	it("reports an empty answer as a failure", async () => {
		respondsWith({ choices: [{ message: { content: "" } }] });

		const answer = await ask("Q");

		expect(answer).toEqual({ ok: false, reason: "Empty answer." });
	});
});
