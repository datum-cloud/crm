# Account news-watch agents

A team agent that periodically checks a curated list of named companies for
newsworthy developments and reports only what's new. Read with
`docs/features/daily-deal-agents.md` for the runner/builder split this
reuses, and `docs/agent.md` for the eve app itself.

## What it is

A rep tags a specific, hand-picked list of companies — an evolving watchlist
like "our top accounts this month," not a general filter — and deploys a
scheduled agent that checks each one for a new product announcement, a new
executive hire, a funding announcement, or an event they're hosting or
attending. It reports only genuinely new findings, either as a logged run
summary or as a Slack message, starting with a private DM before ever
posting to a team channel.

## How a rep uses it

There is no dedicated preset for this one, unlike daily deal-sweep agents.
Deal-sweep's preset works because its parameters — an inactivity window, an
optional channel — are a small, universal choice space that fits any rep's
pipeline unmodified. This feature's entire "configuration" *is* company
selection: a specific, month-to-month-changing list picked by one person,
with no generic parameter space to build a form around. The existing
builder-chat resource picker (tag the companies you want watched) plus a
freeform description — "watch these companies for news, DM me privately for
now" — is the right and sufficient interface, the same "freeform request"
path daily deal-sweep agents document as fully capable alongside their
preset.

Either way produces a READY draft for review before deploy. Nothing runs
until someone deploys it.

## How the runner finds candidates

The deployed agent calls `research_account_news`
(`apps/agent/agent/subagents/agent_runner/tools/research_account_news.ts`),
backed by `researchRunAccountNews` in
`apps/agent/agent/lib/run-runtime.ts`, which asks Perplexity
(`apps/agent/agent/lib/perplexity.ts`) a dated, cited question about one
company at a time. Scope is enforced the same way as every other runner
action — `assertResourceAllowed` rejects a company that isn't in the run's
approved `dataScope.resources`.

This tool intentionally does **not** use the per-session research budget
(`apps/agent/agent/lib/focus.ts`'s `spend()`) that gates the chat-side
`research_person` tool. That budget exists to stop one open-ended
interactive session from making unbounded Perplexity calls; a scheduled
sweep is already bounded by its approved scope (at most 30 tagged records
per agent), so the same guard would just silently truncate research after a
few companies for no safety benefit.

Like every optional capability in this repo
(`apps/agent/agent/lib/capabilities.ts`), the tool never throws when
`PERPLEXITY_API_KEY` isn't configured — it returns an inert "not available
here" result, and the run still completes and says so in its summary.

## Dedup: no schema migration

Nothing in the schema tracks "have I already reported this." Rather than add
a new table, the runner reads its own history back: `list_own_runs`
(`apps/agent/agent/subagents/agent_runner/tools/list_own_runs.ts`, backed by
`listRunHistory` in `run-runtime.ts`) returns the agent's last few
`SUCCEEDED` runs' summaries and results, most recent first — data that was
already sitting in `AgentRun.result`/`AgentRun.summary`, which are never
pruned. The runner's instructions tell it to call this before reporting
anything, and to give `finish_run`'s result a `findings` array (company id,
one-line description, a stable dedup key) so the next run has something to
compare against.

This makes dedup **model-enforced, not database-enforced** — correctness
depends on the model faithfully reading and diffing its own history each
run, not on a uniqueness constraint the database checks. If that proves
unreliable in practice, the fix is a real table (something like
`AgentAccountFinding`: `agentId`, `companyId`, `dedupKey`, `firstSeenAt`,
`lastReportedRunId`) with a hard uniqueness constraint — not built yet,
because the JSON-history approach is the simplest thing that could work and
this whole feature ships with zero migrations.

## Limitations of v1

- **Perplexity only.** There's no dedicated news/press-release/funding-round
  vendor — this is general open-web Q&A with citations, the same backend
  the chat-side `research_person` tool already uses.
- **One question per company, per run.** Not deep multi-turn research —
  fast and cheap enough to run against ~10 companies daily or weekly.
- **Dedup is model-enforced, not guaranteed.** See above.
- **Fixed-interval scheduling only**, the same caveat as daily deal-sweep
  agents — `intervalMinutes` only, no day-of-week or time-of-day window.

## Where the pieces live

| Piece | Path |
| --- | --- |
| Runner tool: research | `apps/agent/agent/subagents/agent_runner/tools/research_account_news.ts` |
| Runner tool: own history | `apps/agent/agent/subagents/agent_runner/tools/list_own_runs.ts` |
| Scope-checked research | `researchRunAccountNews` in `apps/agent/agent/lib/run-runtime.ts` |
| Run-history read | `listRunHistory` in `apps/agent/agent/lib/run-runtime.ts` |
| Open-web research backend | `apps/agent/agent/lib/perplexity.ts` |
| Capability gating | `apps/agent/agent/lib/capabilities.ts` |
| Runner instructions | `apps/agent/agent/subagents/agent_runner/instructions.md` |
| Builder instructions | `apps/agent/agent/subagents/agent_builder/instructions.md` |
