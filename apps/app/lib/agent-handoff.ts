import {
	type DailyDealSweepHandoff,
	type Handoff,
	type HandoffChannel,
	schemas,
} from "@crm/validation";

function channelResources(channel: HandoffChannel | null) {
	return [
		{
			kind: "integration" as const,
			id: "slack:workspace",
			label: "Slack",
			detail: "Connected workspace",
		},
		...(channel
			? [
					{
						kind: "integration" as const,
						id: `slack:channel:${channel.id}`,
						label: `#${channel.name}`,
						detail: channel.isMember
							? "Comp AI is a member"
							: "Comp AI is not in this channel yet",
					},
				]
			: []),
	];
}

export function handoffResources(handoff: Handoff) {
	return channelResources(handoff.channel);
}

export function handoffBrief(handoff: Handoff): string {
	const lines = [`Build an agent named "${handoff.name}".`, handoff.job];

	if (handoff.channel) {
		lines.push(
			`It posts to the tagged Slack channel #${handoff.channel.name} and nowhere else. Do not ask me where to post.`,
		);
	}

	lines.push(
		[
			"These Slack permissions are already decided. Use exactly this list and do not ask about it:",
			...schemas.agents.permissions.map(
				(entry) =>
					`- ${entry.label}: ${handoff.allowed.includes(entry.id) ? "allowed" : "not allowed"}`,
			),
		].join("\n"),
	);

	return lines.join("\n\n");
}

export function dailyDealSweepResources(handoff: DailyDealSweepHandoff) {
	return channelResources(handoff.channel);
}

export function dailyDealSweepBrief(handoff: DailyDealSweepHandoff): string {
	const lines = [
		`Build a scheduled agent that runs once a day and flags ${
			handoff.status === "open" ? "open" : "any"
		} deals with no activity for ${handoff.inactiveForDays}+ days.`,
		"Use a SCHEDULE trigger with a 24-hour interval and WORKSPACE record scope, since this watches the whole pipeline, not one record.",
	];

	if (handoff.channel) {
		lines.push(
			`Post the flagged deals to #${handoff.channel.name} and nowhere else. Do not ask me where to post.`,
		);
	} else {
		lines.push(
			"Ask me where to post the result if a Slack destination is needed, otherwise log a CRM task per flagged deal.",
		);
	}

	return lines.join("\n\n");
}
