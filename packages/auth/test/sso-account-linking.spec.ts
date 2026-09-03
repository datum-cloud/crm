import { beforeAll, describe, expect, it } from "bun:test";

process.env.DATABASE_URL ??= "postgresql://x:x@localhost:5432/x";
process.env.BETTER_AUTH_SECRET ??= "x".repeat(32);
process.env.ALLOWED_SIGN_IN ??= "example.com";
process.env.API_URL ??= "https://api.example.test";

let ssoOptions: { trustEmailVerified?: boolean } | undefined;

beforeAll(async () => {
	const { auth } = await import("../src/auth");
	const plugin = auth.options.plugins?.find(
		(candidate) => candidate.id === "sso",
	) as { options?: typeof ssoOptions } | undefined;

	ssoOptions = plugin?.options;
});

describe("SSO account linking", () => {
	it("trusts an identity provider's emailVerified claim", () => {
		expect(ssoOptions?.trustEmailVerified).toBe(true);
	});
});
