# Executable graph patterns

Code patterns for when the graph will be executed by Claude Code dynamic workflows
(orchestration in plain JavaScript; coordination costs zero model tokens because it's
code, not conversation). Nodes are `agent()` calls; edges are variables passed between
them; plain JS between calls is the free reduce layer.

## Node with a contract (schema-validated output)

A node the graph can trust returns a validated shape, not free text. Validation happens
at the tool-call layer, so the subagent retries on mismatch.

```js
const ITEM = {
  type: 'object', additionalProperties: false,
  properties: {
    title:  { type: 'string' },
    url:    { type: 'string' },
    impact: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['title', 'url', 'impact'],
};

const result = await agent(source.prompt, {
  label: `research:${source.key}`,
  schema: ITEM,
  agentType: 'general-purpose',
});
```

## Fan-out with parallel()

`parallel()` takes thunks, spawns one subagent each, runs them concurrently, and is a
barrier — it returns only when all resolve. A throwing thunk resolves to `null` instead
of sinking the batch; always `.filter(Boolean)`. Concurrency is capped near core count;
excess queues, so hundreds of thunks are fine.

```js
phase('Research');
const raw = await parallel(
  SOURCES.map((s) => () =>
    agent(s.prompt, { label: `research:${s.key}`, schema: ITEM_SCHEMA })),
);
const collected = raw.filter(Boolean);
```

## The free edge (reduce in plain JS)

Never spawn an agent to "combine results" when combining is deterministic:

```js
const flat = collected.flatMap((c) => c.items);      // zero tokens
const unique = [...new Map(flat.map((i) => [i.url, i])).values()];
```

Save agents for judgment (the synthesize node), not plumbing.

## Router (judgment in the node, branching in code)

```js
const { severity } = await agent(`Classify this diff's risk:\n${diff}`, {
  schema: { type: 'object',
    properties: { severity: { enum: ['low', 'high'] } },
    required: ['severity'] },
});

const review = severity === 'high'
  ? await parallel(FILES.map((f) => () => agent(`Audit ${f}`)))
  : await agent(`Quick review of ${diff}`);
```

Deterministic routing means no emergent "the agent decided to skip the audit".

## Verifier patterns

- **Adversarial:** N skeptics per finding, keep on majority survival.
- **Perspective-diverse:** distinct lenses per verifier (correctness / security / repro).
- **Judge panel:** N attempts, parallel judges, synthesize from the winner.

```js
const judged = await parallel(findings.map((b) => () =>
  parallel(['correctness', 'security', 'repro'].map((lens) => () =>
    agent(`Judge "${b.desc}" via ${lens} — real?`, { schema: VERDICT })))
  .then((v) => ({ b, real: v.filter(Boolean).filter((x) => x.real).length >= 2 }))));
const confirmed = judged.filter((v) => v.real).map((v) => v.b);
```

## Loop-until-dry (convergent cycle)

Stop after K consecutive empty rounds. Dedupe against everything SEEN, not just
confirmed — otherwise rejected findings reappear and the loop never dries.

```js
const seen = new Set(); const confirmed = []; let dry = 0;
while (dry < 2) {
  const found = (await parallel(FINDERS.map((f) => () =>
    agent(f.prompt, { schema: BUGS })))).filter(Boolean).flatMap((r) => r.bugs);
  const fresh = found.filter((b) => !seen.has(key(b)));
  if (!fresh.length) { dry++; continue; }
  dry = 0;
  fresh.forEach((b) => seen.add(key(b)));           // vs SEEN, not confirmed
  confirmed.push(...await verify(fresh));            // diverse-lens verify
}
```

## Isolation

Nodes that write files in parallel can collide. `isolation: "worktree"` gives each agent
its own git worktree, merged cleanly after. Use only where nodes actually write in
parallel — it's a seatbelt for that topology, not a default tax.

## Model tiering

Every subagent inherits the session model unless overridden. Route bounded/repetitive
nodes (`extract`, `classify`) to a cheaper model via the `model` option on that
`agent()` call; keep the merge/synthesize node on the strong model.

## parallel() vs pipeline()

`parallel()` is a barrier: the next stage waits for the slowest node. `pipeline()`
streams each item through all stages independently — item A can be in stage 3 while
item B is in stage 1. Default to pipeline; take the barrier only when a stage needs the
whole set at once (cross-set dedupe, early-exit on the total, "compare against the
other findings").

## Self-routing

For jobs you can't plan in advance, describe the objective and let Claude write the
orchestration script (say "workflow" in the prompt, or use ultracode). Save good runs
into `.claude/workflows/` — version-controlled, re-runnable by name.
