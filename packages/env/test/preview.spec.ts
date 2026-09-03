import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { previewSiblingUrl } from "../src/preview";

const KEYS = [
	"VERCEL_TARGET_ENV",
	"VERCEL_PROJECT_NAME",
	"VERCEL_BRANCH_URL",
] as const;

const saved = new Map<string, string | undefined>();

function set(values: Partial<Record<(typeof KEYS)[number], string>>) {
	for (const key of KEYS) {
		const value = values[key];
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
}

beforeEach(() => {
	for (const key of KEYS) saved.set(key, process.env[key]);
});

afterEach(() => {
	for (const key of KEYS) {
		const value = saved.get(key);
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

describe("previewSiblingUrl", () => {
	it("points at the sibling project on the same branch", () => {
		set({
			VERCEL_TARGET_ENV: "preview",
			VERCEL_PROJECT_NAME: "crm-app",
			VERCEL_BRANCH_URL:
				"crm-app-git-feature-agent-list-datum-cloud.vercel.app",
		});

		expect(previewSiblingUrl("api")).toBe(
			"https://crm-api-git-feature-agent-list-datum-cloud.vercel.app",
		);
		expect(previewSiblingUrl("agent")).toBe(
			"https://crm-agent-git-feature-agent-list-datum-cloud.vercel.app",
		);
	});

	it("keeps whatever spelling Vercel gave the branch", () => {
		set({
			VERCEL_TARGET_ENV: "preview",
			VERCEL_PROJECT_NAME: "crm-api",
			VERCEL_BRANCH_URL:
				"crm-api-git-dodik-fix-a-very-lo-9f2c1a-datum.vercel.app",
		});

		expect(previewSiblingUrl("agent")).toBe(
			"https://crm-agent-git-dodik-fix-a-very-lo-9f2c1a-datum.vercel.app",
		);
	});

	it("leaves a custom environment alone, which reports itself as a preview", () => {
		set({
			VERCEL_TARGET_ENV: "staging",
			VERCEL_PROJECT_NAME: "crm-app",
			VERCEL_BRANCH_URL: "crm-app-git-main-datum-cloud.vercel.app",
		});

		expect(previewSiblingUrl("api")).toBeUndefined();
	});

	it("leaves production and local alone", () => {
		set({
			VERCEL_TARGET_ENV: "production",
			VERCEL_PROJECT_NAME: "crm-app",
			VERCEL_BRANCH_URL: "crm-app-git-release-datum-cloud.vercel.app",
		});
		expect(previewSiblingUrl("api")).toBeUndefined();

		set({});
		expect(previewSiblingUrl("api")).toBeUndefined();
	});

	it("declines when the branch url is missing or does not name this project", () => {
		set({ VERCEL_TARGET_ENV: "preview", VERCEL_PROJECT_NAME: "crm-app" });
		expect(previewSiblingUrl("api")).toBeUndefined();

		set({
			VERCEL_TARGET_ENV: "preview",
			VERCEL_PROJECT_NAME: "crm-app",
			VERCEL_BRANCH_URL: "something-else-git-main-datum-cloud.vercel.app",
		});
		expect(previewSiblingUrl("api")).toBeUndefined();
	});

	it("declines a project name with no role suffix to swap", () => {
		set({
			VERCEL_TARGET_ENV: "preview",
			VERCEL_PROJECT_NAME: "crm",
			VERCEL_BRANCH_URL: "crm-git-main-datum-cloud.vercel.app",
		});

		expect(previewSiblingUrl("api")).toBeUndefined();
	});
});
