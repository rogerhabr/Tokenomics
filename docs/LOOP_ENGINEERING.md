# Loop Engineering

How loops (an agent repeating cycles of work until a stop condition is met) are defined,
triggered, and stopped in this repo. Loops are categorized by how they're triggered, how
they're stopped, and what Claude Code primitive runs them. **Not every task needs one —
start simple.**

This file is loaded on demand by a `UserPromptSubmit` hook (see `.claude/hooks/loop-context.sh`)
so it costs zero context tokens unless a prompt is actually about loops/recurring work.
Keep it out of CLAUDE.md for that reason.

## The 4 loop types

| # | Type | Trigger | Stops when | Best for |
|---|------|---------|-----------|----------|
| 1 | **Turn-based** | a user prompt | Claude judges it's done or needs context | shorter, one-off tasks |
| 2 | **Goal-based** (`/goal`) | a manual prompt | goal achieved OR max turns reached | tasks with verifiable exit criteria |
| 3 | **Time-based** (`/loop`, `/schedule`) | a time interval | you cancel it, or the work completes | recurring work or external systems |
| 4 | **Proactive** | event or schedule, no human in real time | each task exits on its own goal; routine runs until turned off | recurring streams — triage, migrations, dependency upgrades |

Examples:
- Goal-based: `/goal get Lighthouse to 99+, stop after 5 tries`
- Time-based: `/loop 5m check the PR, address review comments + fix CI`
- Proactive, composed: `/schedule` every hour + `/goal` don't stop until every item found
  this run is triaged, actioned, and responded to.

## Quick reference — what you hand off per loop type

| Loop | You hand off | Use when | Reach for |
|------|--------------|----------|-----------|
| Turn-based | the check | exploring or deciding | custom verification skills |
| Goal-based | the stop condition | you know what done looks like | `/goal` |
| Time-based | the trigger | work happens on a schedule | `/loop`, `/schedule` |
| Proactive | the prompt | work is recurring + well-defined | all of the above + dynamic workflows |

Recipe: **find your bottleneck → pick the loop type → define the stop condition → run + iterate.**

## Token usage rules

- **Match the primitive + model to the job size** — don't spawn a workflow for a one-liner.
- **Define clear stop criteria** so the loop lands sooner instead of burning turns.
- **Pilot first** before a large dynamic-workflow run.
- **Use scripts for deterministic work, not reasoning** — a `.mjs` script in `scripts/` is
  free to run in CI; an agent turn is not.
- **Review with `/usage`, `/goal`, `/workflows`** to see what a loop actually cost.
- Load reference material on demand (like this file) instead of putting it in CLAUDE.md,
  which is re-sent on every session.

## Code quality rules for loops

- Keep the codebase clean — Claude follows existing patterns.
- Give the loop a way to **self-verify** (here: `npm run lint` + `npm run build`; there is no test suite).
- Keep docs reachable for up-to-date conventions.
- Use a second agent for unbiased code review before merging loop output.

## Loops already running in this repo

These are the house patterns — extend them rather than inventing parallel ones:

- **`refresh-data.yml`** (proactive, time-based): daily 06:00 UTC, runs
  `scripts/fetch-live-data.mjs`, commits `public/live-data.json` straight to `master`.
  Deterministic script, no agent — the cheapest kind of loop.
- **`monitor-throughput.yml`** (proactive, PR-gated): weekly Monday 07:00 UTC, runs
  `scripts/monitor-throughput.mjs`; material changes open a PR on `agent/throughput-update`
  with an evidence report. Stop condition = human review at the PR gate. Optional
  `ANTHROPIC_API_KEY` upgrades extraction; it degrades gracefully without it.
- **PR babysitting** (time/event-based): remote sessions subscribe to PR activity and
  re-check on webhook events plus an hourly `send_later` fallback until the PR is merged
  or closed — that merged/closed state is the stop condition.

When adding a new loop here: prefer a deterministic script in `scripts/` run by a scheduled
workflow; make it PR-gated if it changes anything a human should review; give it a clear
stop condition; and let it degrade gracefully when optional secrets are absent (same as the
two existing workflows).
