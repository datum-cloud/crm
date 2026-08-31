"use client";

import ArrowRight from "@carbon/icons-react/es/ArrowRight";
import { Button } from "@crm/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { InvalidInput, parse, schemas } from "@crm/validation";
import { useState } from "react";
import { toast } from "sonner";
import { useSlackChannels } from "@/components/slack/use-slack-channels";
import {
	dailyDealSweepBrief,
	dailyDealSweepResources,
} from "@/lib/agent-handoff";
import type { BuilderResource } from "./agent-composer";

const DAY_OPTIONS = ["7", "14", "30"] as const;

export function DailyDealSweepPreset({
	onCreate,
	pending,
}: {
	onCreate: (input: { message: string; resources: BuilderResource[] }) => void;
	pending: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [days, setDays] = useState<(typeof DAY_OPTIONS)[number]>("14");
	const [channelId, setChannelId] = useState("");

	const channels = useSlackChannels({ enabled: open });
	const rows = channels.channels;
	const channel = rows.find((row) => row.id === channelId);

	const create = () => {
		try {
			const handoff = parse(
				schemas.agents.dailyDealSweepHandoff,
				{
					inactiveForDays: Number(days),
					status: "open",
					channel: channel
						? { id: channel.id, name: channel.name, isMember: channel.isMember }
						: null,
				},
				"This agent",
			);

			onCreate({
				message: dailyDealSweepBrief(handoff),
				resources: dailyDealSweepResources(handoff),
			});
			setOpen(false);
		} catch (error) {
			toast.error(
				error instanceof InvalidInput
					? error.message
					: "Could not hand this to the builder.",
			);
		}
	};

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<button
					className="flex h-[42px] w-full items-center border-t text-left outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
					type="button"
				>
					<span className="min-w-0 flex-1 font-medium text-sm">
						Flag stale deals
					</span>
					<Icon icon={ArrowRight} className="size-4 text-muted-foreground" />
				</button>
			</PopoverTrigger>

			<PopoverContent align="start" className="w-80">
				<FieldGroup>
					<Field>
						<FieldLabel>Inactive for</FieldLabel>
						<ToggleGroup
							onValueChange={(next) => {
								if (next) setDays(next as (typeof DAY_OPTIONS)[number]);
							}}
							size="sm"
							type="single"
							value={days}
						>
							{DAY_OPTIONS.map((option) => (
								<ToggleGroupItem key={option} value={option}>
									{option} days
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</Field>

					<Field>
						<FieldLabel htmlFor="daily-deal-sweep-channel">Post to</FieldLabel>
						<Select onValueChange={setChannelId} value={channelId}>
							<SelectTrigger id="daily-deal-sweep-channel">
								<SelectValue placeholder="Pick a Slack channel (optional)" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{rows.map((row) => (
										<SelectItem key={row.id} value={row.id}>
											#{row.name}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>

					<Button disabled={pending} onClick={create} type="button">
						Create agent
					</Button>
				</FieldGroup>
			</PopoverContent>
		</Popover>
	);
}
