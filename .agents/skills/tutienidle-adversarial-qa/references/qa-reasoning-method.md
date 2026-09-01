# Adversarial QA Reasoning Method

## Model Each Scenario as a State Chain

For each meaningful user or system action, trace:

```text
State → Action → Transition → Side effect → Persisted result
```

Name the current state and its owner, the action that is permitted, the transition it causes, every observable side effect, and the state that survives a reload or recovery. Treat omitted, delayed, duplicated, and reordered steps as distinct scenarios rather than as variations of the happy path.

## Invariant Classes

| Class | Falsifiable rule |
| --- | --- |
| Conservation | Currency, items, rewards, and costs have a defined source or sink; no value is silently duplicated or lost. |
| Exactly-once | A reward, purchase, claim, death, or persistence side effect occurs once for one eligible transition. |
| Atomicity | A multi-part operation either completes its required mutations or leaves no partial mutation. |
| Boundedness | Values stay within their defined range and never become negative, `NaN`, `Infinity`, or unreasonably large where reachable. |
| Monotonicity | Progress that is only allowed to advance cannot regress through stale state, ordering, reload, or recovery. |
| Idempotency | A safe retry or duplicate delivery does not add a second effect. |
| Synchronization | Pinia, Phaser, Vue, persisted state, and cloud state agree at the observable handoff. |
| Recoverability | Corrupt, invalid, or interrupted current state fails safely and follows a valid recovery path. |
| Lifecycle | Listeners, timers, scenes, overlays, and controls are installed and removed at the intended boundaries. |
| Determinism | A fixed seed and fixed time produce the same required outcome. |

## Invariant Ledger

Create one row per meaningful hypothesis; retain it in the QA report even when the check finds no defect.

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `INV-<scope>-<n>` | Current state and owning module/store/scene | Trigger, allowed transition, and side effect | One falsifiable invariant class and rule | Operator applied at the boundary | Observable state, event, rendered result, persisted result, or failure | Unit, integration, Playwright, or browser | Impact/reachability/persistence/breadth/observability rationale |

Do not make an implementation detail the oracle when a user-observable state transition, saved result, emitted event, or rendered interaction can prove the hypothesis.

## Attack Operators

| Operator | Apply it by asking |
| --- | --- |
| Value mutation | What happens at zero, negative, missing, huge, `NaN`, or `Infinity` values where input is reachable? |
| Repeat | What happens after double input, retry, repeated mount/unmount, duplicate event, or duplicate message? |
| Reorder | What changes if otherwise valid actions occur in an unusual order? |
| Timing boundary | What happens just before, at, and just after a cooldown, reset, autosave, combat tick, or offline threshold? |
| Interruption | What survives reload, route change, pause, hidden tab, scene change, or closure during the transition? |
| Concurrency | What happens with two tabs, overlapping saves, simultaneous requests, or multiple timers? |
| Stale state | What happens when cached UI, an old store snapshot, a delayed callback, or cloud data is out of date? |
| Degraded environment | What happens under throttled timers, storage or network failure, a missing asset, or low FPS? |
| Cross-system chain | Which consequence crosses economy, progression, combat, inventory, UI, persistence, or recovery? |

## Rank Hypotheses Before Checking

Prioritize a hypothesis by:

1. **Impact**: save loss, exploitable duplication, boot failure, and progression locks outrank cosmetic errors.
2. **Reachability**: ordinary player flows and reachable boundaries outrank impossible inputs.
3. **State persistence**: effects surviving save, cloud, reload, or recovery outrank transient presentation defects.
4. **Cross-system breadth**: handoffs across more owners increase the likelihood and blast radius of a defect.
5. **Observability**: prefer hypotheses with a decisive oracle at the lowest useful test layer; record missing observability as a coverage gap instead of guessing.

Happy-path coverage does not lower the priority of a plausible high-impact hypothesis. It only supplies evidence about one path; keep the hypothesis ranked by the factors above until a relevant adversarial oracle resolves it.

## Design Provenance

This method adapts design ideas for TutienIdle from [AleksandrGarnov/qa_skill](https://github.com/AleksandrGarnov/qa_skill), [tinh2/skills-hub-registry game QA](https://github.com/tinh2/skills-hub-registry/tree/main/qa/game-qa), and [PlayableIntelligence/game-creator game QA](https://github.com/PlayableIntelligence/game-creator/tree/main/skills/game-qa). They are design references only, not runtime dependencies. This file paraphrases and specializes their ideas; if protected upstream text is ever copied into implementation, retain the source's required attribution and license notice.
