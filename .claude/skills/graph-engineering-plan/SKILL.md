---
name: graph-engineering-plan
description: Convert a linear implementation plan, roadmap, or phased delivery document into a graph-engineered plan — nodes with contracts, real data edges, fan-out/fan-in diamonds, routers, verifiers, convergent cycles, model tiering, and topology-driven cost/latency analysis. Use this whenever the user asks to review, restructure, parallelize, or "go deep on" an implementation plan, delivery roadmap, phased project, or multi-step agent workflow — even if they don't say the word "graph". Also use it when a plan looks like a numbered phase list (Phase 0, Phase 1, …) and the user wants it faster, more parallel, more verifiable, or executable by a fleet of agents.
---

# Graph Engineering Plan

Turn a straight-line plan into a dependency graph that fans out where work is independent, gates edges where confidence matters, and converges where results must merge. The output is both a *review* of the linear plan (which waits are real, which are fake) and a *restructured graph plan* that can be executed by parallel agents or parallel humans.

The core insight to carry through every step: **an edge exists only when data actually moves**. "Phase 2 comes after Phase 1" is a claim about typing order, not dependency. If nothing produced by Phase 1 is consumed by Phase 2, the arrow is fake and the wait is wasted.

## Method — 7 passes over the input plan

Work through these in order. Each pass produces a named section of the output document (see Output Format below).

### Pass 1 — Extract the nodes

Break the plan into units of work where each node has:
- **one bounded job** (if you can't state it in one sentence, split it),
- **explicit input** — what it reads, passed in, never assumed from shared context,
- **explicit output** — a defined, checkable shape (an artifact, a passing test, a reviewed record — not "progress").

Phases are almost never nodes. A "Phase" in a linear plan is usually 3–8 nodes stapled together by narrative. Unstaple them. Give each node a short kebab-case id you'll use in edges and diagrams.

### Pass 2 — Audit every edge

For each "and then" / phase ordering in the original plan, ask: **does the later step consume the earlier step's output?**

Classify every claimed dependency:
- **Real data edge** — a named artifact crosses (a schema, a verified checkout, an approved register). Name the edge by its data, not its order: `consolidated-checkout → preview-deploy`, not "Phase 0 → Phase 6".
- **Policy gate** — no data crosses, but a human/governance decision must land first (approval, confidentiality rules, sign-off). These are real edges too, but they're unblocked by a decision, not by work — call them out separately because they can often be resolved *now*, in parallel with everything.
- **Fake edge** — pure narrative ordering. Cut it. This is where the parallelism comes from.

The review's headline finding is usually here: count the fake edges and say what they cost.

### Pass 3 — Draw the topology

With fake edges cut, the chain collapses into a wider graph. Draw it (mermaid `flowchart`). Look for the standard shapes and name them:

- **Diamond (fan-out → reduce → synthesize):** N independent jobs feeding one merge. The workhorse. The reduce step (flatten, dedupe, filter) is plain code/checklist work — zero judgment, zero tokens; never assign an agent or a meeting to it.
- **Barrier vs pipeline:** a barrier makes everything wait for the slowest node. Use one only when a stage genuinely needs *every* prior result at once (cross-set dedupe, go/no-go on the total). If items can stream through stages independently, pipeline them — fast items should finish early, not idle behind slow ones. "The phases feel separate" is not a reason for a barrier.
- **Router:** when the path depends on what a node found, put judgment in the node and the branch in deterministic logic ("if severity=high → full audit, else → quick pass"). Write the routing rule down explicitly so no one improvises the skip.

### Pass 4 — Put verifiers on the edges that matter

Confidence comes from structure, not from more effort at a node. For each edge whose downstream consequences are serious (security, money, legal, external comms), specify a verifier whose only job is to try to kill the result before it flows on:

- **Adversarial verify:** N independent skeptics try to refute a finding; it passes only if a majority fail to kill it.
- **Perspective-diverse verify:** distinct lenses (correctness, security, reproduces-in-preview) rather than N identical checks — diversity catches what repetition can't.
- **Judge panel:** generate N attempts, score in parallel, synthesize from the winner.

Not every edge needs one. Say which do and why; a graph where every edge is a verifier is paying rent on its own wiring.

### Pass 5 — Contain failure and find the cycles

- **Isolation:** in a chain, one failure strands everything upstream. Design every fan-in to tolerate missing inputs (`filter(Boolean)` thinking): 8 of 9 sources arriving is a result, not a failure. If parallel nodes write to shared state (same repo, same table), give them isolation (worktrees, staging areas) — but only where they actually collide.
- **Cycles:** unknown-size work (discovery, bug sweeps, mailbox ingestion) needs a loop, and every loop needs a convergence rule. The pattern is **loop-until-dry**: stop after K consecutive rounds that surface nothing new. The detail that makes or breaks it: **dedupe against everything seen, not just against accepted results** — otherwise rejected items reappear every round and the loop never dries.

### Pass 6 — Tier the effort

Not every node needs the most expensive resource (top model, senior human, committee meeting). Bounded, repetitive nodes (extract, classify, checksum, format) go to the cheap tier; judgment nodes (synthesize, adjudicate, approve) keep the expensive tier. In an agent execution this is the `model:` option per node; in a human plan it's who has to be in the room. Mark each node's tier.

### Pass 7 — Cost the topology

Topology *is* latency. Compute and state:
- **Critical path:** the longest chain of real edges — the theoretical minimum duration. Everything off the critical path is free parallelism.
- **Waste in the original:** duration of the linear plan minus the critical path.
- **Barrier costs:** each remaining barrier, what it waits for, and why the wait is genuinely required.

## Output format

Produce one document with exactly these sections:

```markdown
# Graph review: <plan name>
## Verdict            — 3–5 sentences: how linear was it, what the graph unlocks, top risk
## Edge audit         — table: claimed dependency | real data edge / policy gate / fake | what actually crosses
## Node inventory     — table: node id | job (one sentence) | input | output contract | tier
## Topology           — mermaid flowchart of the real graph + named shapes (diamonds, routers, cycles)
## Verifiers          — which edges get verification, which pattern, and why
## Cycles             — each loop, its dry-out rule, and its dedupe key
## Critical path      — the binding chain, the parallel free lunch, remaining barriers and their justification
## Unblock-now list   — every policy gate and input that can be resolved today, in parallel with all build work
## Execution notes    — how to run it (waves of parallel work; optionally a dynamic-workflow / parallel() sketch)
```

Keep the edge audit honest — it is the review. If the original plan was already well-factored, say so; don't invent fake edges to cut just to look useful.

For executable code patterns (schemas on `agent()` calls, `parallel()` fan-out, routers, loop-until-dry, verifier panels), read `references/patterns.md` — include a sketch in Execution notes only when the plan will actually be run by agents.

## Smell tests (apply before finishing)

- Any "and then" where no artifact crosses → you missed a fake edge.
- A merge step assigned to an agent/meeting that is really flatten-and-dedupe → move it to the reduce, zero cost.
- `parallel → transform → parallel` with no cross-item dependency in the middle → should be a pipeline, kill the barrier.
- A cycle with no dry-out rule → infinite loop; a cycle deduping only against accepted results → never dries.
- Every node at the same tier → you skipped Pass 6.
- A verifier on every edge → wiring rent; strip back to consequential edges.
- A "missing capability" claim not verified against the actual codebase (grep the schema/policies before asserting something doesn't exist) → the gap may be smaller or different than the plan text implies; cite file:line for every existence/absence claim.
- The topology diagram and the critical-path section disagree about what fans into the terminal barrier → resolve it explicitly, usually as a scope router, never by leaving both versions standing.
- "Existing tests/scripts already cover this" → check what tables/paths they actually exercise; predecessor *patterns* are not *coverage*.
- An edge drawn from runtime data into build-time construction (e.g. ingested content feeding route/schema work) → construction consumes contracts; runtime data feeds seeds, verification, and evidence.
