# Web research backend: Perplexity, direct or via AI Gateway

How the agent's one open-web research primitive (`ask()` in
`apps/agent/agent/lib/perplexity.ts`) reaches Perplexity, and why it needs
no dedicated API key by default.

Two tools share this file: the chat-side `research_person`
(`apps/agent/agent/tools/research_person.ts`) and the scheduled
`research_account_news` (`docs/features/account-news-watch.md`). Neither
tool knows which backend is in use — both just call `ask()`.

## Two backends, one function

`ask()` picks its backend per call, based on one check:

- **`PERPLEXITY_API_KEY` set** → calls Perplexity's `/chat/completions` API
  directly with that key (`askPerplexityDirect` in `perplexity.ts`). This
  is the original implementation, and it always wins when the key is
  present — an install that already has a Perplexity account, wants its
  own tiering (`sonar` vs `sonar-pro`), or simply prefers not to route
  research through Vercel can set this and get the old behavior back with
  no other change.
- **`PERPLEXITY_API_KEY` unset** → calls Vercel AI Gateway's own
  Perplexity-search tool, `gateway.tools.perplexitySearch()`
  (`askViaGateway` in `perplexity.ts`), billed and authenticated through
  `AI_GATEWAY_API_KEY` (or Vercel OIDC on Vercel) — the credential the app
  already needs to run its model at all. This is the default: every
  install that can run the agent already has this credential, so research
  works out of the box with no second vendor account.

Both paths return the exact same `Outcome<Answer>` shape (`{ok, data:
{text, citations}}` or `{ok: false, reason}`), so `research_person.ts` and
`run-runtime.ts`'s `researchRunAccountNews` never know or care which one
ran.

## Why the Gateway path exists at all

The Gateway path fixed a real fragility in the alternative we considered
and rejected: eve's own built-in `web_search` tool is "provider-managed,"
meaning it only works when the session's *model* natively supports search
(Anthropic, OpenAI, Google, xAI) — so its availability would silently
follow whichever model a workspace happens to have picked in Settings. AI
Gateway's `perplexitySearch` tool works with **any** model, so research
stays available regardless of model choice, with no dedicated key needed.
(eve's built-in `web_search` and `web_fetch` also remain deliberately
disabled for `agent_runner` and `agent_builder` — see
`docs/features/daily-deal-agents.md` — unrelated to this.)

## How each path works

**Direct (`askPerplexityDirect`)**: a plain `fetch()` to
`https://api.perplexity.ai/chat/completions` with an `Authorization:
Bearer` header, `search_domain_filter` for `AskOptions.domains`, and a
model choice — `sonar` normally, `sonar-pro` when `maxResults` is 10 or
more (an approximation of the old `deep` flag, since there's no separate
"tier" concept once you're on the Gateway path). Citations come from the
response's `citations` field, falling back to `search_results[].url`.

**Gateway (`askViaGateway`)**: calls the AI SDK's `generateText()` with
`gateway.tools.perplexitySearch()` in `tools`, using whatever model
`apps/agent/agent/lib/model.ts`'s `selectedModel()` reports (falling back
to `DEFAULT_AGENT_MODEL.id` from `@crm/db/settings`). The model calls the
search tool, AI Gateway executes it server-side against Perplexity, and
the same `generateText` call synthesizes a cited answer — `stopWhen:
stepCountIs(3)` gives it room for the search step plus the follow-up
answer step. Citations come from `result.toolResults`' `perplexity_search`
output, one URL per search result.

`AskOptions.model` (Perplexity's own `sonar`/`sonar-pro` tier picker) is
gone from the public option type — `research_person`'s `deep` flag now
asks for more search results (`maxResults: 10` vs `5`) instead, which both
backends interpret in their own way (a bigger `max_results`/tier on the
direct path, more Gateway search results on the other).

## Capability gating

The "Web research" capability in `apps/agent/agent/lib/capabilities.ts` is
keyed `WEB_RESEARCH` (a synthetic id, not a literal env var — matching the
existing `CONTEXT_DEV`/`CONTEXT_DEV_PEOPLE` precedent). Its `enabled` check
is `PERPLEXITY_API_KEY` **or** `AI_GATEWAY_API_KEY` **or**
`VERCEL_OIDC_TOKEN` — any one of the three is enough, matching `ask()`'s
own routing exactly. In practice this capability is on for nearly every
install, since the Gateway credential is also what runs the model at all;
it can only be genuinely off when eve is wired to a provider's own SDK
package directly in `agent.ts` (bypassing AI Gateway) and no Perplexity key
is set either — a real, if uncommon, self-hoster configuration, which is
why the check still exists instead of assuming "always on."

## Switching between the two, either direction

Both directions are pure configuration, not code changes:

- **Direct → Gateway**: unset `PERPLEXITY_API_KEY`.
- **Gateway → direct**: set `PERPLEXITY_API_KEY` in `.env` to a real
  Perplexity API key ([perplexity.ai/settings/api](https://perplexity.ai/settings/api)).

No schema migration, no manifest change, no instruction-file change either
way — this was and remains a pure implementation detail behind `ask()`.

## Where the pieces live

| Piece | Path |
| --- | --- |
| The branch, and both implementations | `ask()`/`askPerplexityDirect`/`askViaGateway` in `apps/agent/agent/lib/perplexity.ts` |
| Capability gate | `WEB_RESEARCH`/`WEB_RESEARCH_SOURCE` in `apps/agent/agent/lib/capabilities.ts` |
| Model used for the Gateway call | `selectedModel()` in `apps/agent/agent/lib/model.ts` |
| Chat-side caller | `apps/agent/agent/tools/research_person.ts` |
| Scheduled-agent caller | `researchRunAccountNews` in `apps/agent/agent/lib/run-runtime.ts` |
| Tests for the direct path | `apps/agent/test/perplexity.spec.ts` |
