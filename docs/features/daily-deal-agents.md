# Daily deal-sweep agents

A team agent that reviews the deal pipeline on a schedule and flags deals with
no recent activity. Read with `docs/agent.md` for the runner/builder split and
`docs/agent-panel.md` for how a run shows up on a record.

## What it is

v1 scope is **deals only** — no contacts (leads) or companies (accounts) yet.
A rep deploys a scheduled agent that reviews some or all of the pipeline once
a day and flags every deal with no activity for a chosen number of days,
either by logging a CRM task per deal or by posting a Slack summary. It uses
the same runtime every team agent uses: a `SCHEDULE` trigger, an idempotent
action per flagged deal, and a legitimate "no action needed" outcome when
nothing is stale.

## How a rep uses it

Two paths, both on the agent builder home screen at
**`/{workspace-slug}/chat`**
(`apps/app/app/(app)/[slug]/(agent-builder)/chat/page.tsx`): the
**"Daily tasks"** preset
(`apps/app/components/agent-builder/daily-deal-sweep-preset.tsx`, which
hands off the same way `NewAgentDialog` does at
`apps/app/components/agent-builder/new-agent-dialog.tsx`), or a freeform
request typed straight into the composer. See the step-by-step below.

### Setting the criteria, step by step

Unlike account-news-watch agents (`docs/features/account-news-watch.md`),
which watch a hand-picked list of companies with no generic parameter
space, this feature's criteria — inactivity window, stage, destination —
are a small, universal set any rep can pick from a form:

**Using the preset:**

1. Open `/{workspace-slug}/chat`.
2. Under **"Daily tasks"**, click **"Flag stale deals"**.
3. In the popover, pick an inactivity window — **7, 14, or 30 days**
   (`daily-deal-sweep-preset.tsx`'s `ToggleGroup`).
4. Optionally pick a Slack channel to post to; leave it empty to log a CRM
   task per flagged deal instead.
5. Click **"Create agent"** — this opens a builder chat with the brief
   already filled in (`dailyDealSweepBrief` in `apps/app/lib/agent-handoff.ts`).
6. Review the READY draft (confirm the stage filter, the day count, and the
   destination), then deploy.

**Using a freeform request instead**, type directly into the composer,
e.g. "Flag deals with no activity for 14 days" — the builder's
instructions require it to state the exact stage filter and day count
in the agent it writes, so this produces an equally precise result without
the preset.

Either path opens the builder chat at **`/{workspace-slug}/chat/{chatId}`**
(`apps/app/app/(app)/[slug]/(agent-builder)/chat/[chatId]/page.tsx`) with a
READY draft for human review before deploy — nothing runs until someone
deploys it. Once deployed, the agent and its run history show at
**`/{workspace-slug}/agents/{agentId}`**
(`apps/app/app/(app)/[slug]/(agent-builder)/agents/[agentId]/page.tsx`); the
full list of deployed agents is at **`/{workspace-slug}/agents`**.

## How the runner finds candidates

The deployed agent calls `list_deals`
(`apps/agent/agent/subagents/agent_runner/tools/list_deals.ts`), backed by
`listRunDeals` in `apps/agent/agent/lib/run-runtime.ts`, which wraps the same
`listDeals()` the chat-side builder tool uses
(`apps/agent/agent/lib/lookup.ts`).

Scope is enforced per the deployed version's `dataScope`:

- `WORKSPACE` — unrestricted, sees the whole pipeline.
- `SELECTED` — filtered to the exact approved deal ids, **at the database
  query level** (a new `ids` filter on `listDeals`'s `where` clause), not by
  filtering the result set afterward. `list_deals` is cursor-paginated
  (`hasMore`/`nextCursor`), so filtering its output in memory after the query
  — the way `query_crm`'s free-text search does, since that search has no
  pagination to protect — would silently break pagination: a page could come
  back short or empty even though `hasMore` was true before filtering.

## Limitations of v1

- **Deals only.** No `list_contacts`/`list_companies` runner tool yet, so a
  request about leads or accounts still falls back to `query_crm`'s free-text
  search, with no status/inactivity/owner filtering.
- **Fixed-interval scheduling only.** `SCHEDULE.config.intervalMinutes` is the
  only cadence primitive — no cron string, no day-of-week or time-of-day
  window.
- **"No action needed" is expected, not a bug.** A `SCHEDULE` run that finds
  zero stale deals ends with `finish_run`'s `noActionNeeded`, per
  `NO_ACTION_TRIGGER_TYPES` in `apps/agent/agent/lib/dispatch-config.ts`.

## Where the pieces live

| Piece | Path |
| --- | --- |
| Agent builder home (the preset) | `/{workspace-slug}/chat` — `apps/app/app/(app)/[slug]/(agent-builder)/chat/page.tsx` |
| Builder chat draft | `/{workspace-slug}/chat/{chatId}` — `apps/app/app/(app)/[slug]/(agent-builder)/chat/[chatId]/page.tsx` |
| Deployed agents list | `/{workspace-slug}/agents` — `apps/app/app/(app)/[slug]/(agent-builder)/agents/page.tsx` |
| Agent detail and run history | `/{workspace-slug}/agents/{agentId}` — `apps/app/app/(app)/[slug]/(agent-builder)/agents/[agentId]/page.tsx` |
| Runner tool | `apps/agent/agent/subagents/agent_runner/tools/list_deals.ts` |
| Scope-checked query | `listRunDeals` in `apps/agent/agent/lib/run-runtime.ts` |
| Deal-listing semantics | `listDeals` in `apps/agent/agent/lib/lookup.ts` |
| Runner instructions | `apps/agent/agent/subagents/agent_runner/instructions.md` |
| Builder instructions | `apps/agent/agent/subagents/agent_builder/instructions.md` |
| UI preset | `apps/app/components/agent-builder/daily-deal-sweep-preset.tsx` |
| Preset handoff schema | `dailyDealSweepHandoff` in `packages/validation/src/agents.ts` |
| Preset brief/resources | `dailyDealSweepBrief`/`dailyDealSweepResources` in `apps/app/lib/agent-handoff.ts` |
