const PREVIEW_TARGET = "preview";

const BRANCH_MARKER = "-git-";

export type ProjectRole = "app" | "api" | "agent";

export function previewSiblingUrl(role: ProjectRole): string | undefined {
	if (process.env.VERCEL_TARGET_ENV !== PREVIEW_TARGET) return undefined;

	const self = process.env.VERCEL_PROJECT_NAME?.trim();
	const branchUrl = process.env.VERCEL_BRANCH_URL?.trim();
	if (!self || !branchUrl) return undefined;

	if (!branchUrl.startsWith(`${self}${BRANCH_MARKER}`)) return undefined;

	const separator = self.lastIndexOf("-");
	if (separator <= 0) return undefined;

	const sibling = `${self.slice(0, separator)}-${role}`;

	return `https://${sibling}${branchUrl.slice(self.length)}`;
}
