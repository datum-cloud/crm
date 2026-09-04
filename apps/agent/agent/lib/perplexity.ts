import { DEFAULT_AGENT_MODEL } from "@crm/db/settings";
import { gateway, generateText, stepCountIs } from "ai";
import { selectedModel } from "./model";

const ENDPOINT = "https://api.perplexity.ai/chat/completions";
const TIMEOUT_MS = 45_000;
const MAX_STEPS = 3;

export type Answer = {
	text: string;
	citations: string[];
};

type Outcome<T> = { ok: true; data: T } | { ok: false; reason: string };

export type AskOptions = {
	domains?: string[];
	system?: string;
	maxResults?: number;
};

export async function ask(
	question: string,
	options: AskOptions = {},
): Promise<Outcome<Answer>> {
	const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
	return apiKey
		? askPerplexityDirect(question, options, apiKey)
		: askViaGateway(question, options);
}

async function askPerplexityDirect(
	question: string,
	options: AskOptions,
	apiKey: string,
): Promise<Outcome<Answer>> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		const response = await fetch(ENDPOINT, {
			method: "POST",
			headers: {
				authorization: `Bearer ${apiKey}`,
				"content-type": "application/json",
			},
			signal: controller.signal,
			body: JSON.stringify({
				model: (options.maxResults ?? 5) >= 10 ? "sonar-pro" : "sonar",
				messages: [
					...(options.system
						? [{ role: "system", content: options.system }]
						: []),
					{ role: "user", content: question },
				],
				search_domain_filter: options.domains,
			}),
		});

		if (!response.ok) {
			return { ok: false, reason: `HTTP ${response.status}` };
		}

		const body = (await response.json()) as {
			choices?: { message?: { content?: string } }[];
			citations?: string[];
			search_results?: { url?: string }[];
		};

		const text = body.choices?.[0]?.message?.content?.trim() ?? "";
		if (!text) return { ok: false, reason: "Empty answer." };

		const citations =
			body.citations ??
			(body.search_results ?? []).flatMap((r) => (r.url ? [r.url] : []));

		return { ok: true, data: { text, citations } };
	} catch (error) {
		const aborted = error instanceof Error && error.name === "AbortError";
		return {
			ok: false,
			reason: aborted
				? `Timed out after ${TIMEOUT_MS}ms.`
				: error instanceof Error
					? error.message
					: String(error),
		};
	} finally {
		clearTimeout(timer);
	}
}

type PerplexitySearchResult = { url?: string };
type PerplexitySearchOutput = { results?: PerplexitySearchResult[] };

async function askViaGateway(
	question: string,
	options: AskOptions,
): Promise<Outcome<Answer>> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		const model = (await selectedModel())?.model ?? DEFAULT_AGENT_MODEL.id;
		const result = await generateText({
			model,
			system: options.system,
			prompt: question,
			tools: {
				perplexity_search: gateway.tools.perplexitySearch({
					maxResults: options.maxResults ?? 5,
					searchDomainFilter: options.domains,
				}),
			},
			stopWhen: stepCountIs(MAX_STEPS),
			abortSignal: controller.signal,
		});

		const text = result.text.trim();
		if (!text) return { ok: false, reason: "Empty answer." };

		const citations = result.toolResults.flatMap((call) => {
			if (call.toolName !== "perplexity_search") return [];
			const output = call.output as PerplexitySearchOutput | undefined;
			return (output?.results ?? []).flatMap((r) => (r.url ? [r.url] : []));
		});

		return { ok: true, data: { text, citations } };
	} catch (error) {
		const aborted = error instanceof Error && error.name === "AbortError";
		return {
			ok: false,
			reason: aborted
				? `Timed out after ${TIMEOUT_MS}ms.`
				: error instanceof Error
					? error.message
					: String(error),
		};
	} finally {
		clearTimeout(timer);
	}
}

export async function findProfileUrls(
	terms: string[],
	companyName: string,
): Promise<string[]> {
	const slugs: string[] = [];

	for (const term of terms) {
		const answer = await ask(
			`Find the LinkedIn profile of the person called "${term}" who works at ${companyName}. Reply with their profile URL only.`,
			{ domains: ["linkedin.com"] },
		);

		if (!answer.ok) continue;

		const haystack = [answer.data.text, ...answer.data.citations].join(" ");
		for (const match of haystack.matchAll(
			/linkedin\.com\/in\/([A-Za-z0-9\-_%]+)/g,
		)) {
			const slug = match[1];
			if (slug && !slugs.includes(slug)) slugs.push(slug);
		}

		if (slugs.length > 0) break;
	}

	return slugs;
}
