import { defineTool } from "eve/tools";
import { z } from "zod";
import { listRunHistory } from "../../../lib/run-runtime";
import { requireTeamAgentAttribute } from "../../../lib/session-purpose";

export default defineTool({
	description:
		"Read this agent's own last few successful run summaries and results, most recent first. Call this before reporting anything, to compare against what was already reported, so you only surface genuinely new findings.",
	inputSchema: z.object({
		limit: z.number().int().min(1).max(20).default(5),
	}),
	async execute(input, ctx) {
		return listRunHistory(requireTeamAgentAttribute(ctx, "runId"), input);
	},
});
