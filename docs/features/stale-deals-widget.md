# Stale deals dashboard widget

A card on the overview dashboard that surfaces open deals with no recent
activity, using the same "stale" idea as the daily deal-sweep agent
(`docs/features/daily-deal-agents.md`), but as a passive glance on the
dashboard rather than an automated agent action.

## What it is

The overview page (`/{workspace-slug}`) already summarizes pipeline value,
overdue tasks, and recent activity. This adds a "Stale deals" card next to
them: the open deals with no activity for 14+ days, oldest-touch first,
each showing its stage, days inactive, and value. Clicking a row opens the
deal's record sheet, same as every other dashboard table.

This card is read-only and has no agent, schedule, or Slack involvement —
it's a plain query rendered on page load, unlike the deal-sweep feature
which deploys an autonomous agent.

## Where the pieces live

| Piece | Path |
| --- | --- |
| Query + threshold constant | `staleDeals` query and `STALE_DEAL_DAYS` in `apps/api/src/dashboard/dashboard.service.ts` |
| Output schema | `staleDealOutput` in `apps/api/src/dashboard/dashboard.contracts.ts` |
| Card UI | `"Stale deals"` card in `apps/app/app/(app)/[slug]/dashboard-summary.tsx` |

## How it works

`dashboard.service.ts`'s `summary()` already runs a batch of `Promise.all`
Prisma queries for the dashboard (pipeline stages, biggest open deals,
overdue tasks, recent activity). The stale-deals query follows the exact
same shape as `biggestOpen`: open-stage deals, scoped by `me`/`everyone`
like every other dashboard query, filtered to `lastActivityAt` (or
`createdAt` when a deal has never had activity) at or before a
`STALE_DEAL_DAYS`-day cutoff, ordered oldest-activity-first, capped at 6
rows to match the sizing of the other dashboard cards.

The 14-day threshold is a local constant in `dashboard.service.ts`
(`STALE_DEAL_DAYS`), matching that file's existing convention of small,
file-local constants (`TREND_MONTHS`, `RATE_WINDOW_DAYS`) rather than a
shared config module — this widget has exactly one tunable number, unlike
the deal-sweep agent's per-agent configurable window.

## Limitations of v1

- **Fixed threshold, not configurable.** Unlike the deal-sweep agent (which
  lets a rep pick 7/14/30 days), this card always uses 14 days. If reps ask
  for a different window, promote `STALE_DEAL_DAYS` to a query parameter
  rather than hard-coding a second value.
- **No action from the card itself.** It's a read-only glance; flagging or
  automating outreach on a stale deal is still the deal-sweep agent's job,
  not this widget's.
- **Same `me`/`everyone` scope as the rest of the dashboard** — no
  additional filters (owner, company) beyond what the dashboard already
  supports.
