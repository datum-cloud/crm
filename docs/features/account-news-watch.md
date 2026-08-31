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
attending. It reports only genuinely new findings by default as a `NOTE`
logged directly on the flagged company's own CRM record — accessible to
anyone who opens that company, no Slack access or run-history page needed —
and, optionally, also as a Slack message, starting with a private DM before
ever posting to a team channel.

## How a rep uses it

There is no dedicated preset for this one, unlike daily deal-sweep agents.
Deal-sweep's preset works because its parameters — an inactivity window, an
optional channel — are a small, universal choice space that fits any rep's
pipeline unmodified. This feature's entire "configuration" *is* company
selection: a specific, month-to-month-changing list picked by one person,
with no generic parameter space to build a form around. Building it goes
through the builder chat instead, step by step below.

**Important**: `/{workspace-slug}/chat` is dual-purpose. Without a clear
build request, it answers as a general CRM assistant, using the **root**
agent's own tools (`research_company`, `research_person`, `enrich_company`,
under `apps/agent/agent/tools/`) — a completely different toolset from the
one a *deployed* agent's scheduled run uses
(`apps/agent/agent/subagents/agent_runner/tools/`, where
`research_account_news` and `list_own_runs` actually live), and the two are
never available to each other. A message like "research Datum and Ramp for
news and write it to their timeline" is read as a direct question and
answered immediately by the root agent (often with `research_company`,
which is unrelated to this feature, reads a company's marketing website
via Context.dev, and writes an `ENRICHMENT` activity, not a `NOTE`) —
**no draft gets built, nothing gets deployed, `research_account_news` is
never touched.** Step 2 below is how to avoid that.

### Step by step

1. Open `/{workspace-slug}/chat`.
2. Start the message with the **`/Create agent`** command so the composer
   routes to the agent builder instead of answering directly — this is the
   same command the deal-sweep suggestions and `NewAgentDialog` use under
   the hood (`agent-composer.tsx`'s `CREATE_AGENT_COMMAND`,
   `invocation: "/Create agent"`). For example:

   > `/Create agent watch Datum and Ramp for news — product, exec,
   > funding, event — and log each finding as a note on the company`

3. Before or after typing the command, tag every company on the list, one
   at a time, using the composer's resource picker — search by name, click
   to tag. The cap is 30 tagged records per agent
   (`apps/agent/agent/subagents/agent_builder/lib/draft-input.ts`), so a
   ~10-company list is comfortably inside it.
4. Send the message. The builder saves exactly the tagged companies as the
   version's `dataScope.resources` (`SELECTED` mode) — nothing more,
   nothing less — and may ask a clarifying question (e.g. a Slack
   destination) before producing a draft.
5. **Review the READY draft**: confirm it has a `SCHEDULE` trigger,
   `SELECTED` scope over exactly the tagged companies, and a
   `crm.activity.create` action authorized for `NOTE`.
6. **Deploy it.** A saved draft does nothing until deployed.
7. **Trigger a run.** A freshly deployed `SCHEDULE` trigger does not fire
   immediately, and locally, `eve dev` never fires schedules on their cron
   cadence at all (see `docs/setup.md`). Force one with:

   ```sh
   bun run --filter=agent dispatch
   ```

   Only once this actually runs does the `agent_runner` session — with
   `research_account_news`, `list_own_runs`, and `create_crm_activity` —
   get invoked at all.
8. **Verify**: open one of the flagged companies' records → Timeline tab →
   "All" or "Notes" — a genuine finding shows up as a new `NOTE` there.

Because the source list is described as a moving target ("a WIP" that
changes month to month), **there is no way to point a deployed agent at a
list that updates itself** — when the underlying list changes, someone has
to open that agent's draft and re-tag the new set of companies by hand
(repeat step 3 onward). This is a real limitation, not an oversight: no
"saved list" concept currently connects to an agent's `dataScope` (see
"Limitations of v1" below).

## Updating the company list, pausing, or deleting the agent

These controls are generic to every deployed team agent (not specific to
this feature) and live on the agent's detail page,
`/{workspace-slug}/agents/{agentId}`.

**To add or remove a watched company on a live (already-deployed) agent:
there is currently no working in-app path.** This is a real gap, not a
documentation oversight — worth knowing before you go looking for a
button:

- The **"Change details"** button (`team-agent-detail.tsx`'s
  `DraftAgentActions`, linking to `version.sourceConversationId`) only
  renders while the agent's overall status is `DRAFT` — i.e., before its
  very first deploy. Once deployed (`LIVE`/`PAUSED`), that component is
  gone entirely, replaced by Run now/Pause/Resume/Delete.
- The API has an `agents.revise` mutation
  (`apps/api/src/agent/agent-definitions.service.ts`) purpose-built for
  changing a live version's `dataScope.resources` (and channel/actions) by
  creating a new version — but **no button anywhere in the app calls it.**
- The "Code" tab (`AgentCode`, `agents.saveFile`) can edit
  `manifest.json`'s raw text, but reading `saveFile`'s backend
  (`agent-definitions.service.ts`'s `saveFile()`), the new version it
  creates carries forward `current.manifest` **unchanged** regardless of
  which file's text was edited — only `instructions.md` edits are actually
  reflected in the row the runtime reads. Editing `manifest.json` there
  looks like it should work but, on this reading, silently does not change
  the effective scope. Unverified live — flagged as suspect, not confirmed
  broken.

**The one thing that reliably works today: deploy a new, separate agent**
for the additional compan(ies), rather than trying to extend an existing
live one.

### Another watch: new agent, or update the existing one?

Given the gap above, **once an agent is live, a new agent is the practical
answer** — there is no working in-app way to extend its watched-company
list after its first deploy. The only case where "update the existing one"
is genuinely possible is if it's still sitting as an undeployed `DRAFT`:
open it, use "Change details" to tag more companies, and deploy for the
first time with the full list.

Separately from that constraint, a new agent is also the *architecturally
right* choice whenever the new watch has a different schedule, a different
Slack destination, or a different audience than the existing one — one
agent has exactly one `SCHEDULE` trigger and one set of actions/
destinations for its entire company list, so two genuinely different needs
(e.g. one team's daily channel vs. another team's weekly DM) can't share
a single agent regardless of the update-path gap above.

**To pause it** (stop it running without deleting it): the agent detail
page has a **Pause** button; **Resume** brings it back. Existing history
and settings are untouched either way.

**To delete it**: the same page has a **Remove** button, behind a
confirmation dialog. This disables its triggers and cancels any in-flight
runs (`agents.remove`, `apps/api/src/agent/agent-definitions.service.ts`) —
it does not fire again after this.

## How the runner finds candidates

The deployed agent calls `research_account_news`
(`apps/agent/agent/subagents/agent_runner/tools/research_account_news.ts`),
backed by `researchRunAccountNews` in
`apps/agent/agent/lib/run-runtime.ts`, which asks a dated, cited question
about one company at a time through `apps/agent/agent/lib/perplexity.ts`'s
`ask()`. Scope is enforced the same way as every other runner action —
`assertResourceAllowed` rejects a company that isn't in the run's approved
`dataScope.resources`.

Each genuinely new finding is logged via `create_crm_activity`
(`apps/agent/agent/subagents/agent_runner/tools/create_crm_activity.ts`,
backed by `createRunActivity` in `run-runtime.ts`) as a `NOTE` on that
company's record — the same scope-checked, idempotent-per-call tool the
deal-sweep agent uses for tasks. No new tool was needed for this: `NOTE`
targeting `company` was already fully supported, it just wasn't part of
this agent shape's default action set until now.

`ask()`'s own backend (Perplexity, reached through Vercel AI Gateway rather
than Perplexity's API directly) is documented separately in
`docs/features/web-research-backend.md`, since `research_person` (the
chat-side tool) shares the exact same function. Read that doc for how it
works, why it needs no dedicated API key, and how to revert to calling
Perplexity's API directly if that backend ever changes again.

This tool intentionally does **not** use the per-session research budget
(`apps/agent/agent/lib/focus.ts`'s `spend()`) that gates the chat-side
`research_person` tool. That budget exists to stop one open-ended
interactive session from making unbounded search calls; a scheduled sweep
is already bounded by its approved scope (at most 30 tagged records per
agent), so the same guard would just silently truncate research after a
few companies for no safety benefit.

Like every optional capability in this repo
(`apps/agent/agent/lib/capabilities.ts`), the tool never throws when web
research isn't configured — it returns an inert "not available here"
result, and the run still completes and says so in its summary.

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

- **The company list is hand-tagged, with no source-of-truth link.** No
  Saved View or other list concept feeds an agent's `dataScope` today — see
  "Step by step" above. A changing list means manual re-tagging, every
  time.
- **No dedicated news vendor.** This is general open-web Q&A with
  citations (Perplexity search, via AI Gateway) — see
  `docs/features/web-research-backend.md` — the same backend the chat-side
  `research_person` tool already uses. No press-release/funding-round-
  specific data source.
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
