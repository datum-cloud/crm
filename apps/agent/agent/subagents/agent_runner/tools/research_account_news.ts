import { defineTool } from "eve/tools";
import { z } from "zod";
import { researchRunAccountNews } from "../../../lib/run-runtime";
import { requireTeamAgentAttribute } from "../../../lib/session-purpose";

export default defineTool({
	description:
		"Check the open web for newsworthy developments at one approved CRM company — a product announcement, an executive hire, a funding announcement, or an event they are hosting or attending. Returns cited claims, or reports that web research is not configured here. The company must be in this run's approved scope.",
	inputSchema: z.object({
		companyId: z.string().min(1),
		companyName: z.string().min(1),
	}),
	async execute(input, ctx) {
		return researchRunAccountNews(
			requireTeamAgentAttribute(ctx, "runId"),
			input,
		);
	},
});
