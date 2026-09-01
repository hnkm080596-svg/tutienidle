# TutienIdle Adversarial QA Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a project-native Codex skill that adversarially reviews TutienIdle changes, discovers unanticipated game defects, writes reproduction tests and QA reports, and never repairs production code.

**Architecture:** A concise `SKILL.md` routes between quick and deep modes, then progressively loads project-system, reasoning, workflow, evidence, learning, and domain references. A dependency-free Node helper deterministically maps explicitly supplied changed paths to risk domains; project-level `AGENTS.md` rules invoke quick QA after implementation and deep QA at release boundaries.

**Tech Stack:** Codex skills (`SKILL.md`, `agents/openai.yaml`), Markdown references, Node.js 22+ ESM and `node:test`, existing Vitest/Playwright/type-check/build commands.

**Spec:** `docs/superpowers/specs/2026-08-31-tutienidle-adversarial-qa-design.md`

## Global Constraints

- The skill is specialized for `game/`; do not turn it into a reusable generic QA framework.
- Do not add dependencies or change application architecture.
- QA may inspect production code but may write only `game/src/**/*.test.ts`, `game/tests/e2e/**/*.spec.ts`, `game/tests/e2e/helpers.ts`, and `game/docs/qa/**` during a QA run.
- QA must never modify production code, configuration, dependencies, assets, snapshots without independent evidence, secrets, live services, or Git history.
- A defect is `Confirmed` only with a failing reproduction test or direct runtime evidence; otherwise classify it as `Suspected` or `Coverage gap`.
- Preserve current-development behavior: do not test or require backward migration of old save formats.
- Keep automatic skill discovery enabled; deep mode remains explicitly invokable as `$tutienidle-adversarial-qa deep`.
- Do not commit, merge, push, or deploy. Replace commit steps from generic workflows with user review checkpoints.
- Preserve unrelated dirty UI and documentation changes already present in the worktree.
- If implementation is delegated, use a dedicated worktree and follow the repository's coordination rules.

## File Map

| File | Responsibility |
|---|---|
| `.agents/skills/tutienidle-adversarial-qa/SKILL.md` | Discovery description, mode routing, permissions, reference-loading rules, and final execution contract. |
| `.agents/skills/tutienidle-adversarial-qa/agents/openai.yaml` | UI metadata, default prompt, and implicit-invocation policy. |
| `.agents/skills/tutienidle-adversarial-qa/scripts/changed-risk-map.mjs` | Pure changed-path-to-domain mapping and CLI JSON output. |
| `.agents/skills/tutienidle-adversarial-qa/scripts/changed-risk-map.test.mjs` | Node built-in tests for normalization, overlap, escalation candidates, unmapped paths, and empty input. |
| `.agents/skills/tutienidle-adversarial-qa/references/project-system-map.md` | Current project ownership, important boundaries, test seams, and one-hop consumers. |
| `.agents/skills/tutienidle-adversarial-qa/references/qa-reasoning-method.md` | State-transition model, invariant ledger, attack operators, and hypothesis prioritization. |
| `.agents/skills/tutienidle-adversarial-qa/references/quick-review.md` | Bounded post-change workflow and deep-escalation rules. |
| `.agents/skills/tutienidle-adversarial-qa/references/deep-audit.md` | Fresh-session whole-scope audit workflow and full verification matrix. |
| `.agents/skills/tutienidle-adversarial-qa/references/test-authoring-and-evidence.md` | Test-layer selection, reproduction-test quality, evidence statuses, severity, and flaky handling. |
| `.agents/skills/tutienidle-adversarial-qa/references/reporting-and-learning.md` | Exact QA report schema, verdict rules, learned-defect schema, and promotion boundary. |
| `.agents/skills/tutienidle-adversarial-qa/references/domains/*.md` | Seven project-specific attack packs. |
| `game/docs/qa/learned-defects.md` | Initially empty, versioned defect-learning ledger with schema instructions. |
| `AGENTS.md` | Project routing for mandatory quick/deep invocation and the QA write boundary. |

---

### Task 1: Deterministic Changed-Path Risk Mapper

**Files:**

- Create: `.agents/skills/tutienidle-adversarial-qa/scripts/changed-risk-map.mjs`
- Create: `.agents/skills/tutienidle-adversarial-qa/scripts/changed-risk-map.test.mjs`

**Interfaces:**

- Consumes: An explicit `string[]` of repository-relative paths; it never calls Git or reads the working tree itself.
- Produces: `mapChangedPaths(paths)` returning `{ domains, oneHopConsumers, deepAuditCandidate, reasons, unmappedPaths }`, with sorted unique string arrays and a boolean candidate flag.
- CLI: `node changed-risk-map.mjs <path> [<path> ...]` prints the same object as formatted JSON; no paths exits with code `2` and a usage message on stderr.

- [ ] **Step 1: Create the failing Node tests**

Use `node:test` and `node:assert/strict`. Define these exact behavioral cases:

```js
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mapChangedPaths } from './changed-risk-map.mjs'

test('maps a focused combat path without forcing a deep candidate', () => {
  assert.deepEqual(mapChangedPaths(['game/src/core/battle/BattleSystem.ts']), {
    domains: ['combat-and-tribulation'],
    oneHopConsumers: [
      'combat presentation and controls',
      'loot, progression, and persistence after combat',
    ],
    deepAuditCandidate: false,
    reasons: [],
    unmappedPaths: [],
  })
})

test('normalizes Windows separators and maps save changes as deep candidates', () => {
  const result = mapChangedPaths([
    'game\\src\\services\\save\\SaveSystem.ts',
    'game\\src\\services\\cloudSave\\CloudSaveCoordinator.ts',
  ])

  assert.deepEqual(result.domains, ['save-and-cloud'])
  assert.equal(result.deepAuditCandidate, true)
  assert.deepEqual(result.reasons, ['critical state boundary: save-and-cloud'])
})

test('returns all overlapping domains and cross-system escalation', () => {
  const result = mapChangedPaths(['game/src/core/game/GameManager.ts'])

  assert.deepEqual(result.domains, [
    'combat-and-tribulation',
    'economy-and-progression',
    'pinia-phaser-sync',
    'time-and-offline',
  ])
  assert.equal(result.deepAuditCandidate, true)
  assert.ok(result.reasons.includes('cross-system change: 4 domains'))
})

test('keeps unknown paths visible instead of guessing', () => {
  assert.deepEqual(mapChangedPaths(['game/unknown/new-system.ts']), {
    domains: [],
    oneHopConsumers: [],
    deepAuditCandidate: false,
    reasons: [],
    unmappedPaths: ['game/unknown/new-system.ts'],
  })
})

test('deduplicates paths and output values', () => {
  const result = mapChangedPaths([
    './game/src/stores/player.ts',
    'game/src/stores/player.ts',
  ])

  assert.deepEqual(result.domains, ['pinia-phaser-sync'])
  assert.equal(new Set(result.oneHopConsumers).size, result.oneHopConsumers.length)
})
```

- [ ] **Step 2: Run the tests and verify the mapper is missing**

Run from repository root:

```powershell
node --test .agents/skills/tutienidle-adversarial-qa/scripts/changed-risk-map.test.mjs
```

Expected: FAIL because `changed-risk-map.mjs` does not exist.

- [ ] **Step 3: Implement the pure mapper and CLI**

Use this public shape and deterministic mechanics:

```js
import { pathToFileURL } from 'node:url'

const DOMAIN_RULES = [
  {
    domain: 'economy-and-progression',
    patterns: [
      /^game\/src\/core\/(economy|production|profession|reward|building|alchemy|pill|progression|quest|realm|cultivation)\//,
      /^game\/src\/data\/(alchemy|building|pill|progression|quest|realm|realms)\//,
      /^game\/src\/components\/panels\/(Vendor|Production|Alchemy|Pill|Quest|Realm|LuyenThe|SpiritSpring)/,
      /^game\/src\/core\/game\/(GameManager|BattleLootSystem)\.ts$/,
    ],
    consumers: ['save and offline progression', 'UI affordability and unlock state'],
  },
  {
    domain: 'time-and-offline',
    patterns: [
      /^game\/src\/core\/idle\//,
      /^game\/src\/core\/game\/GameManager\.ts$/,
      /^game\/src\/core\/player\/PersistentTimedEffect\.ts$/,
      /^game\/src\/composables\/(useAutoRetryCountdown|useCadenceSmoothing)\.ts$/,
    ],
    consumers: ['economy and progression accrual', 'save timestamps and recovery'],
  },
  {
    domain: 'save-and-cloud',
    patterns: [
      /^game\/src\/services\/(save|cloudSave|auth|character|supabase)\//,
      /^game\/src\/composables\/useBootFlow\.ts$/,
      /^game\/src\/stores\/(saveIssue|offlineSummary|uiFlagsPersistence)\.ts$/,
      /^game\/tests\/e2e\/(save-reload|boot-fresh)\.spec\.ts$/,
    ],
    consumers: ['boot and recovery UI', 'all persisted progression and inventory'],
  },
  {
    domain: 'pinia-phaser-sync',
    patterns: [
      /^game\/src\/stores\//,
      /^game\/src\/components\/game\//,
      /^game\/src\/game\/scenes\//,
      /^game\/src\/composables\/(useGameState|useStageActive|useCombatSceneActive)\.ts$/,
      /^game\/src\/core\/(events\/EventBus|game\/GameManager)\.ts$/,
    ],
    consumers: ['Vue panels and overlays', 'Phaser scenes and event lifecycle'],
  },
  {
    domain: 'combat-and-tribulation',
    patterns: [
      /^game\/src\/core\/(battle|combat|enemy|ailment|buff|tribulation|skill|talent|element)\//,
      /^game\/src\/data\/(enemy|skill|tribulation|buff|ailment|talent)\//,
      /^game\/src\/game\/scenes\/(CombatScene|TribulationScene)/,
      /^game\/src\/components\/game\/(combat|tribulation)\//,
      /^game\/src\/core\/game\/(GameManager|BattleLootSystem)\.ts$/,
    ],
    consumers: ['combat presentation and controls', 'loot, progression, and persistence after combat'],
  },
  {
    domain: 'inventory-equipment',
    patterns: [
      /^game\/src\/core\/(equipment|inventory|item|material)\//,
      /^game\/src\/data\/(equipment|materials)\//,
      /^game\/src\/components\/panels\/(Bag|Inventory|Equipment)/,
      /^game\/src\/composables\/useEquipment/,
    ],
    consumers: ['player stats and combat loadout', 'economy costs and persisted ownership'],
  },
  {
    domain: 'ui-input-lifecycle',
    patterns: [
      /^game\/src\/.*\.vue$/,
      /^game\/src\/assets\/theme\.css$/,
      /^game\/src\/(router|directives)\//,
      /^game\/src\/composables\/(uiScale|useTooltip|usePanelPagination|useBagPagination)\.ts$/,
      /^game\/tests\/e2e\/(ink-wash-ui|create-to-combat)\.spec\.ts$/,
    ],
    consumers: ['keyboard, pointer, focus, and overlay behavior', 'observable domain-state feedback'],
  },
]

const CRITICAL_DOMAINS = new Set([
  'save-and-cloud',
  'time-and-offline',
])

function normalizePath(value) {
  return value.trim().replace(/\\/g, '/').replace(/^\.\//, '')
}

export function mapChangedPaths(paths) {
  const normalizedPaths = [...new Set(paths.filter((path) => typeof path === 'string').map(normalizePath).filter(Boolean))]
  const domains = new Set()
  const oneHopConsumers = new Set()
  const mappedPaths = new Set()

  for (const path of normalizedPaths) {
    for (const rule of DOMAIN_RULES) {
      if (!rule.patterns.some((pattern) => pattern.test(path))) continue
      mappedPaths.add(path)
      domains.add(rule.domain)
      rule.consumers.forEach((consumer) => oneHopConsumers.add(consumer))
    }
  }

  const sortedDomains = [...domains].sort()
  const reasons = []
  for (const domain of sortedDomains.filter((domain) => CRITICAL_DOMAINS.has(domain))) {
    reasons.push(`critical state boundary: ${domain}`)
  }
  if (sortedDomains.length >= 2) reasons.push(`cross-system change: ${sortedDomains.length} domains`)

  return {
    domains: sortedDomains,
    oneHopConsumers: [...oneHopConsumers].sort(),
    deepAuditCandidate: reasons.length > 0,
    reasons,
    unmappedPaths: normalizedPaths.filter((path) => !mappedPaths.has(path)).sort(),
  }
}

function runCli(args) {
  if (args.length === 0) {
    console.error('Usage: node changed-risk-map.mjs <path> [<path> ...]')
    process.exitCode = 2
    return
  }
  console.log(JSON.stringify(mapChangedPaths(args), null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv.slice(2))
}
```

During implementation, correct only syntax or platform issues needed to satisfy the stated interface and tests; do not broaden the mapping beyond actual project paths without evidence.

- [ ] **Step 4: Run the mapper tests**

Run:

```powershell
node --test .agents/skills/tutienidle-adversarial-qa/scripts/changed-risk-map.test.mjs
```

Expected: 5 tests PASS.

- [ ] **Step 5: Exercise the CLI boundary**

Run:

```powershell
node .agents/skills/tutienidle-adversarial-qa/scripts/changed-risk-map.mjs game/src/services/save/SaveSystem.ts game/src/core/game/GameManager.ts
```

Expected: valid JSON, `deepAuditCandidate: true`, and domains including save, time, economy, combat, and synchronization.

Run without arguments and verify exit code `2` and the exact usage message. Do not hide or reinterpret unmapped paths.

- [ ] **Step 6: Review checkpoint**

Review only the two new script files and their test output. Do not commit.

---

### Task 2: Current Project System Map and Seven Domain Packs

**Files:**

- Create: `.agents/skills/tutienidle-adversarial-qa/references/project-system-map.md`
- Create: `.agents/skills/tutienidle-adversarial-qa/references/domains/economy-and-progression.md`
- Create: `.agents/skills/tutienidle-adversarial-qa/references/domains/time-and-offline.md`
- Create: `.agents/skills/tutienidle-adversarial-qa/references/domains/save-and-cloud.md`
- Create: `.agents/skills/tutienidle-adversarial-qa/references/domains/pinia-phaser-sync.md`
- Create: `.agents/skills/tutienidle-adversarial-qa/references/domains/combat-and-tribulation.md`
- Create: `.agents/skills/tutienidle-adversarial-qa/references/domains/inventory-equipment.md`
- Create: `.agents/skills/tutienidle-adversarial-qa/references/domains/ui-input-lifecycle.md`

**Interfaces:**

- Consumes: Current `game/src`, `game/tests/e2e`, project docs, and risk-map domain names from Task 1.
- Produces: Stable reference headings and exact domain filenames consumed by `SKILL.md`, quick review, and deep audit.

- [ ] **Step 1: Write `project-system-map.md` from current code**

Include these sections and concrete ownership rows:

```markdown
# TutienIdle System Map

## Source of Truth
Code is primary. Docs are secondary; report disagreement as documentation drift.

## System Boundaries
| System | Primary paths | State owner | One-hop consumers | Existing test seams |
| Economy/progression | `core/economy`, `core/production`, `core/progression`, `core/game/GameManager.ts` | domain objects and GameManager | UI, save, offline, combat loot | colocated Vitest tests |
| Time/offline | `core/idle`, timed effects in player/GameManager | GameClock/GameManager | economy, combat retry, persistence | OfflineProgressSystem and fixed-step tests |
| Save/cloud | `services/save`, `services/cloudSave`, boot flow | SaveSystem/CloudSaveCoordinator | every persistent system, boot UI | save round-trip, coordinator, boot and reload E2E |
| Vue/Pinia/Phaser sync | `stores`, `components/game`, `game/scenes`, EventBus | boundary-specific; verify ownership per flow | UI and simulation | store, composable, scene lifecycle tests |
| Combat/tribulation | `core/battle`, `core/combat`, `core/tribulation`, combat scenes | BattleSystem/GameManager/scene adapters | loot, progression, UI, save | extensive domain and scene Vitest tests |
| Inventory/equipment | `core/equipment`, `core/item`, `core/material`, inventory panels | bags, slot manager, GameManager orchestration | stats, combat, economy, save | system, bag, action and panel tests |
| UI/input/lifecycle | Vue components, router, directives, Phaser scenes | Vue/Pinia plus scene lifecycle | all user-observable flows | component tests and Playwright E2E |

## Cross-System Hotspots
`GameManager.ts`, `BattleLootSystem.ts`, `useGameState.ts`, `useStageActive.ts`, `SaveSystem.ts`, `CloudSaveCoordinator.ts`, `EventBus.ts`, `CombatScene.ts`, and boot flow require explicit one-hop review.

## Verification Commands
List focused Vitest, full Vitest, type-check, build, Playwright, and browser inspection commands from `game/package.json`.

## Maintenance Rule
Confirm paths against code at review time. Do not treat this map as authority when it has drifted.
```

Expand each row with actual representative tests discovered in the repository. Do not invent APIs or claim state ownership when code inspection is ambiguous; state the ambiguity as a review question.

- [ ] **Step 2: Write a common domain-pack contract into each domain file**

Every domain pack must contain exactly these decision-oriented sections:

```markdown
# <Domain Name>

## Load When
Concrete changed paths and cross-system triggers.

## State Owners and Boundaries
Current source files and handoff points.

## High-Risk Invariants
Domain-specific invariants stated as falsifiable rules.

## Attack Recipes
Short setup/action/observable-result scenarios.

## Cross-System Chains
At least three realistic chains into neighboring domains.

## Existing Test Seams
Specific current test files or test families.

## Coverage Gaps to Look For
Observability or control gaps, not speculative bug claims.
```

- [ ] **Step 3: Populate domain-specific invariants and attacks**

Use the following required minimum content; add project details only when verified in code:

| Pack | Required invariants and attacks |
|---|---|
| `economy-and-progression` | reward/cost conservation, exactly-once claims, atomic purchases/upgrades, unlock boundaries, zero/negative/huge values, repeat purchase, reload after transaction, combat-loot-to-save chain |
| `time-and-offline` | one clock owner per calculation, bounded offline duration, no duplicate accrual, clock rollback/forward, threshold ±1 ms, timer throttling, pause/resume, repeated offline application |
| `save-and-cloud` | current-shape round trip, atomic write/recovery, conflict policy, two-tab race, corrupt/partial current data, overlapping autosave, network interruption; explicitly exclude old-save migration compatibility |
| `pinia-phaser-sync` | single authoritative mutation, ordered propagation, no stale subscription, mount/unmount cleanup, duplicate event delivery, scene recreation, UI/store/scene agreement |
| `combat-and-tribulation` | deterministic seeded outcome, tick ordering, death/victory simultaneity, bounded damage/resources, reward exactly once, low-FPS catch-up, pause/resume, result-to-loot-to-progression chain |
| `inventory-equipment` | unique ownership, bounded capacity, stack conservation, atomic equip/unequip, consumed/removed equipped item, duplicate IDs, stat recomputation, save round trip |
| `ui-input-lifecycle` | repeat input, disabled/loading state, keyboard/pointer/focus parity, overlay stacking, listener/timer cleanup, route/scene interruption, visual state equals domain state; require `ui-ux-pro-max` for UI/UX decisions |

- [ ] **Step 4: Check domain filenames against mapper output**

Run:

```powershell
$skillRoot = '.agents/skills/tutienidle-adversarial-qa'
$expected = @(
  'combat-and-tribulation','economy-and-progression','inventory-equipment',
  'pinia-phaser-sync','save-and-cloud','time-and-offline','ui-input-lifecycle'
)
$actual = Get-ChildItem -LiteralPath "$skillRoot/references/domains" -Filter '*.md' |
  ForEach-Object BaseName | Sort-Object
Compare-Object $expected $actual
```

Expected: no output.

- [ ] **Step 5: Scan the domain references for forbidden generic placeholders**

Run:

```powershell
rg -n "T[B]D|T[O]DO|PLACEH[O]LDER|implement[ ]later|handle[ ]edge[ ]cases|write[ ]tests[ ]for" .agents/skills/tutienidle-adversarial-qa/references
```

Expected: no matches.

- [ ] **Step 6: Review checkpoint**

Compare every domain file to design spec section 6 and verify save migration remains explicitly out of scope. Do not commit.

---

### Task 3: Adversarial Reasoning and Quick/Deep Workflows

**Files:**

- Create: `.agents/skills/tutienidle-adversarial-qa/references/qa-reasoning-method.md`
- Create: `.agents/skills/tutienidle-adversarial-qa/references/quick-review.md`
- Create: `.agents/skills/tutienidle-adversarial-qa/references/deep-audit.md`

**Interfaces:**

- Consumes: Domain names and project boundaries from Tasks 1–2.
- Produces: An invariant-ledger schema and two complete workflows routed by `SKILL.md` in Task 5.

- [ ] **Step 1: Write the reasoning method**

`qa-reasoning-method.md` must define:

```text
State → Action → Transition → Side effect → Persisted result
```

Include all ten invariant classes from the spec: conservation, exactly-once, atomicity, boundedness, monotonicity, idempotency, synchronization, recoverability, lifecycle, and determinism.

Define this invariant-ledger row shape:

```markdown
| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
```

Define all attack operators: value mutation, repeat, reorder, timing boundary, interruption, concurrency, stale state, degraded environment, and cross-system chain. Prioritize a hypothesis by impact, reachability, state persistence, cross-system breadth, and observability. Never downgrade a plausible high-impact hypothesis merely because the happy path is tested.

End with a concise design-provenance note linking the three repositories named in the design spec. State that their ideas were adapted to TutienIdle and are not runtime dependencies. Paraphrase upstream guidance; if implementation copies any protected text, retain the attribution and license notice required by that source.

- [ ] **Step 2: Write `quick-review.md`**

Specify this bounded sequence:

1. Establish the exact user request and task-owned diff; exclude unrelated dirty files.
2. Run `changed-risk-map.mjs` with only task-owned paths.
3. Inspect the changed subsystem and one-hop consumers from current code.
4. Load `qa-reasoning-method.md`, matching domain packs, and matching entries from `game/docs/qa/learned-defects.md`.
5. Create a small invariant ledger and rank hypotheses.
6. Run the lowest conclusive focused checks.
7. Add a failing reproduction test only when it proves the issue and is inside the allowlist.
8. Classify evidence and write a quick report.
9. Escalate instead of issuing a quick verdict when the scope is materially cross-system or hits a critical state boundary.

Deep escalation is mandatory when any of these is true:

- Save/cloud consistency or recovery behavior materially changes.
- Clock/offline accrual or time ownership materially changes.
- A transaction changes economy/progression across persistence or combat boundaries.
- Pinia/Phaser/Vue ownership or lifecycle crosses more than one boundary.
- The mapper returns `deepAuditCandidate: true` and code inspection cannot confidently bound the risk.
- The quick review cannot produce a reliable oracle for a high-impact hypothesis.

State that the mapper is advisory: code inspection decides whether a changed path is material, but the reviewer must document why a candidate was not escalated.

- [ ] **Step 3: Write `deep-audit.md`**

Specify this sequence:

1. Prefer a fresh QA session and read the requirement plus current code before implementation commentary.
2. Rebuild the system map for the audit scope; report documentation drift separately.
3. Load every domain pack, the reasoning method, test/evidence rules, reporting rules, and all learned defects.
4. Build a full invariant ledger.
5. Generate state-machine paths and cross-system sequences, including repeat/reorder/interruption/concurrency/time manipulation/two tabs/corruption/low FPS/soak.
6. Select focused tests first, then run full Vitest, type-check, build, Playwright, and browser playtest where applicable.
7. Add failing reproduction tests for confirmed defects without production edits.
8. Record pre-existing failures and blocked tools separately.
9. Issue only an allowed verdict; green tests alone cannot produce `PASS WITH EVIDENCE`.

Use the exact project commands:

```powershell
cd game
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
npm.cmd run test:e2e
```

Browser playtest is required only when the audited behavior is interactive or visual and an in-app browser is available. For UI/UX reasoning, load `ui-ux-pro-max` before deciding expected interaction or presentation behavior.

- [ ] **Step 4: Verify workflow completeness and routing names**

Run:

```powershell
rg -n "changed-risk-map|learned-defects|deepAuditCandidate|PASS WITH EVIDENCE|ui-ux-pro-max" .agents/skills/tutienidle-adversarial-qa/references
```

Expected: each concept appears in the workflow or reference where it is consumed; no dead reference names.

- [ ] **Step 5: Review checkpoint**

Trace one focused combat example through quick mode and one save/time example through escalation. Confirm neither workflow authorizes a production edit. Do not commit.

---

### Task 4: Test Evidence, Reporting, and Defect Learning

**Files:**

- Create: `.agents/skills/tutienidle-adversarial-qa/references/test-authoring-and-evidence.md`
- Create: `.agents/skills/tutienidle-adversarial-qa/references/reporting-and-learning.md`
- Create: `game/docs/qa/learned-defects.md`

**Interfaces:**

- Consumes: Invariant IDs and workflow outcomes from Task 3.
- Produces: Exact finding schema, verdict schema, report path convention, regression-test rules, and learned-defect ledger.

- [ ] **Step 1: Write test-layer and evidence rules**

In `test-authoring-and-evidence.md`, define the selection order:

1. Vitest unit/domain for isolated rules.
2. Vitest integration for store/service/persistence/subsystem boundaries.
3. Playwright for browser lifecycle, input, reload, navigation, render integration, and multi-tab behavior.
4. Interactive browser evidence when automation lacks an observable oracle.

Require every reproduction test to fail for the intended reason before a production fix, assert observable behavior, use real project objects when practical, mock only external boundaries, fix seed/clock, and remain as a regression test.

Define statuses exactly as `Confirmed`, `Suspected`, and `Coverage gap`. Define severity exactly as `Critical`, `High`, `Medium`, and `Low` using the spec thresholds. A production-hook requirement becomes `Coverage gap` plus a minimal hook proposal, never a QA-authored production change.

For surprising failures, rerun once. If outcomes differ, label the evidence `Flaky` and retain both executions. Label unavailable tooling `Not verified`; separate pre-existing failures.

- [ ] **Step 2: Write the exact report template**

In `reporting-and-learning.md`, define path `game/docs/qa/YYYY-MM-DD-<scope>-<mode>.md` and include this complete template:

```markdown
# QA Review: <scope>

- Date: YYYY-MM-DD
- Mode: quick | deep
- Verdict: PASS WITH EVIDENCE | PASS WITH GAPS | FAIL | BLOCKED
- Task-owned paths: explicit list

## Scope and Risk Map
Changed systems, one-hop consumers, escalation decision, and exclusions.

## Invariant Ledger
Completed invariant-ledger table.

## Verification Evidence
| Command or observation | Result | Evidence/limitation |

## Findings
### QA-<date>-<sequence>: <title>
- Severity: Critical | High | Medium | Low
- Status: Confirmed | Suspected | Coverage gap
- Invariant:
- Preconditions:
- Reproduction:
- Expected:
- Actual:
- Evidence:
- Test file: path | none
- Owner subsystem:
- Blast radius:

## New or Changed QA Tests
Paths and why each test proves its target behavior.

## Gaps and Residual Risk
Unverified hypotheses, unavailable tools, flaky evidence, and missing hooks.

## Pre-existing Failures
Failures not caused by the audited task.
```

Angle-bracket labels above are schema fields to fill in generated reports, not unfinished implementation placeholders. The finished reference must explicitly say so to avoid confusing them with scaffold placeholders.

Allow only `PASS WITH EVIDENCE`, `PASS WITH GAPS`, `FAIL`, and `BLOCKED`; forbid bare `PASS`. Define the minimum evidence required for each verdict.

- [ ] **Step 3: Define the learned-defect loop**

In `reporting-and-learning.md`, require confirmed defects to append a row only after evidence exists. Use these fields:

```markdown
| ID | Component | Trigger pattern | Missed invariant | Why prior QA missed it | Regression test | Domain-pack weighting recommendation |
```

Quick mode filters entries by mapped subsystem; deep mode reads the full ledger. The skill may recommend promotion but must not self-edit its domain packs during a QA review.

- [ ] **Step 4: Initialize the project ledger without fake defects**

Create `game/docs/qa/learned-defects.md` with purpose, entry criteria, the exact table header above, and no fabricated rows. State that only `Confirmed` defects enter the ledger.

- [ ] **Step 5: Verify evidence vocabulary is consistent**

Run:

```powershell
rg -n "Confirmed|Suspected|Coverage gap|PASS WITH EVIDENCE|PASS WITH GAPS|FAIL|BLOCKED|Flaky|Not verified" .agents/skills/tutienidle-adversarial-qa/references game/docs/qa/learned-defects.md
```

Expected: all terms occur in their defining files, with matching capitalization.

- [ ] **Step 6: Review checkpoint**

Using the template, mentally classify: a stable failing test, an unproven static concern, a missing production hook, and a failure that passes on the single rerun. Confirm they become `Confirmed`, `Suspected`, `Coverage gap`, and `Flaky` respectively. Do not commit.

---

### Task 5: Skill Entrypoint and Invocation Metadata

**Files:**

- Create: `.agents/skills/tutienidle-adversarial-qa/SKILL.md`
- Create: `.agents/skills/tutienidle-adversarial-qa/agents/openai.yaml`

**Interfaces:**

- Consumes: Every reference and script produced by Tasks 1–4.
- Produces: Discoverable skill `$tutienidle-adversarial-qa`, default quick mode, explicit deep mode, progressive reference loading, and the hard QA write boundary.

- [ ] **Step 1: Initialize only if the skill directory does not yet exist**

Because earlier tasks create the directory, normally skip the initializer. If execution order changes and the directory is absent, run:

```powershell
python C:\Users\hnkm0\.codex\skills\.system\skill-creator\scripts\init_skill.py tutienidle-adversarial-qa --path .agents/skills --resources scripts,references
```

Never reinitialize an existing skill or allow the initializer to overwrite Tasks 1–4.

- [ ] **Step 2: Write `SKILL.md` frontmatter and shared contract**

Use this frontmatter:

```yaml
---
name: tutienidle-adversarial-qa
description: Adversarially review TutienIdle game changes for unanticipated state, timing, persistence, progression, lifecycle, and cross-system defects. Use after implementing a feature or bug fix, for game QA/review requests, and before milestone or release readiness; do not use it to repair production code.
---
```

The body must remain a concise router and include:

- Default to quick mode; select deep for an explicit `deep` request, milestone/release readiness, or mandatory escalation.
- Establish task-owned paths before using the mapper; never feed unrelated dirty paths into it.
- Always read `project-system-map.md` and `qa-reasoning-method.md`.
- Quick: read `quick-review.md`, matching domain packs, evidence/reporting references, and matching learned defects.
- Deep: read `deep-audit.md`, every domain pack, evidence/reporting references, and the full learned-defect ledger.
- For any UI/UX judgment, load `ui-ux-pro-max` before setting the oracle.
- The exact write allowlist and all forbidden actions from the spec.
- The rule that confirmation requires failing-test or runtime evidence.
- The four allowed verdicts and the report destination.
- Stop after creating QA evidence; hand production repair back to the development workflow.

Link every supporting reference with a correct relative Markdown path and state when it is read. Do not duplicate the full contents of the references in the entrypoint.

- [ ] **Step 3: Write `agents/openai.yaml`**

Use exact quoted strings and keep implicit invocation enabled:

```yaml
interface:
  display_name: "TutienIdle Adversarial QA"
  short_description: "Find hidden cross-system game defects"
  default_prompt: "Use $tutienidle-adversarial-qa to adversarially review this TutienIdle change and produce evidence-backed findings without modifying production code."
policy:
  allow_implicit_invocation: true
```

Do not add icons, brand color, dependencies, or assets.

- [ ] **Step 4: Validate the skill package**

Run:

```powershell
python C:\Users\hnkm0\.codex\skills\.system\skill-creator\scripts\quick_validate.py .agents/skills/tutienidle-adversarial-qa
```

Expected: validation succeeds with no frontmatter, naming, or scaffold-placeholder errors.

- [ ] **Step 5: Verify every local link resolves**

Inspect all Markdown links in `SKILL.md` and confirm each relative target exists under the skill directory. Also confirm all seven domain filenames exactly match Task 1 mapper output.

- [ ] **Step 6: Review checkpoint**

Read only the name and description and verify they trigger relevant game QA/completion work without attracting generic software or unrelated requests. Then read the body and verify a QA run cannot infer production-edit permission. Do not commit.

---

### Task 6: Project Routing Rules

**Files:**

- Modify: `AGENTS.md`

**Interfaces:**

- Consumes: The completed discoverable skill from Task 5.
- Produces: Project-level invocation rules that apply to future development sessions.

- [ ] **Step 1: Recheck the dirty worktree before editing**

Run:

```powershell
git status --short
git diff -- AGENTS.md
```

Expected: preserve all unrelated files. If `AGENTS.md` has new user changes, merge the new section without overwriting them.

- [ ] **Step 2: Add a focused QA skill section to `AGENTS.md`**

Append this section without altering existing rules:

```markdown
## TutienIdle Adversarial QA

- After implementing a feature or bug fix, use the `tutienidle-adversarial-qa` skill in quick mode before claiming completion.
- Use deep mode when the user invokes `$tutienidle-adversarial-qa deep` and before milestone or release readiness claims.
- During a QA run, the skill may write only `game/src/**/*.test.ts`, `game/tests/e2e/**/*.spec.ts`, `game/tests/e2e/helpers.ts`, and `game/docs/qa/**`; it must not modify production code.
- Treat a defect as confirmed only when a failing reproduction test or direct runtime evidence proves it. Otherwise report it as suspected or as a coverage gap.
- If quick mode identifies materially broad save/cloud, time/offline, economy/progression, or Vue/Pinia/Phaser lifecycle risk, escalate to deep mode rather than issuing a quick pass verdict.
```

- [ ] **Step 3: Check routing text and avoid policy conflict**

Run:

```powershell
rg -n "TutienIdle Adversarial QA|tutienidle-adversarial-qa|production code|coverage gap" AGENTS.md
```

Expected: one coherent section; existing no-commit, secret, worktree, UI/UX, and verification rules remain intact.

- [ ] **Step 4: Review checkpoint**

Inspect `git diff -- AGENTS.md` and verify the change is additive and narrowly scoped. Do not commit.

---

### Task 7: End-to-End Skill Validation and Handoff

**Files:**

- Modify only if validation exposes a defect: files created in Tasks 1–6
- Do not create QA findings or reproduction tests from synthetic validation scenarios in the real project tree.

**Interfaces:**

- Consumes: Complete skill package and project routing.
- Produces: Structural, deterministic, and behavioral evidence that the skill is ready without claiming exhaustive defect prevention.

- [ ] **Step 1: Run structural and script verification once**

Run from repository root:

```powershell
python C:\Users\hnkm0\.codex\skills\.system\skill-creator\scripts\quick_validate.py .agents/skills/tutienidle-adversarial-qa
node --test .agents/skills/tutienidle-adversarial-qa/scripts/changed-risk-map.test.mjs
```

Expected: both commands PASS. Do not repeat successful commands unless their relevant files change.

- [ ] **Step 2: Run reference-integrity checks**

Run:

```powershell
rg -n "T[B]D|T[O]DO|PLACEH[O]LDER|implement[ ]later|handle[ ]edge[ ]cases|write[ ]tests[ ]for" .agents/skills/tutienidle-adversarial-qa AGENTS.md game/docs/qa/learned-defects.md
rg -n "game/src/\*\*/\*\.test\.ts|game/tests/e2e/\*\*/\*\.spec\.ts|game/tests/e2e/helpers\.ts|game/docs/qa/\*\*" .agents/skills/tutienidle-adversarial-qa/SKILL.md AGENTS.md
```

Expected: the placeholder scan has no implementation placeholders. The allowlist appears consistently in `SKILL.md` and `AGENTS.md`; if glob spelling differs while meaning remains exact, normalize it.

- [ ] **Step 3: Forward-test quick mode in an isolated temporary workspace or clean agent session**

Use a realistic prompt with only a focused combat file and its diff:

```text
Use $tutienidle-adversarial-qa in quick mode to review a change to game/src/core/battle/BattleSystem.ts. Do not modify production code. Return the risk map, invariant ledger, focused verification choice, evidence status, and verdict.
```

Verify the outcome:

- Loads combat, reasoning, quick, evidence, reporting, and relevant learned-defect guidance.
- Does not load unrelated domain packs without a cross-system reason.
- Does not invent confirmation without a failing test or runtime evidence.
- Does not propose or make a production edit.

- [ ] **Step 4: Forward-test mandatory escalation**

Use:

```text
Use $tutienidle-adversarial-qa to review changes spanning game/src/services/save/SaveSystem.ts and game/src/core/idle/OfflineProgressSystem.ts. Start in quick mode and follow the skill's escalation rules.
```

Verify it escalates to deep, loads all domain packs, includes corrupt current-save, clock-boundary, duplicate offline reward, interruption, and cross-system persistence hypotheses, while excluding backward old-save migration testing.

- [ ] **Step 5: Forward-test evidence boundaries**

Use three isolated scenarios:

```text
Scenario A: Static inspection suggests a duplicate reward but no test or runtime reproduction exists.
Scenario B: The required state cannot be observed without a new production test hook.
Scenario C: A focused test fails once and passes on the one permitted rerun.
```

Verify classification is respectively `Suspected`, `Coverage gap`, and `Flaky`; no scenario becomes `Confirmed`.

- [ ] **Step 6: Forward-test non-trigger behavior**

Use an unrelated request such as summarizing a prose document. Verify the skill description does not attract the task implicitly.

- [ ] **Step 7: Verify the final diff and scope**

Run:

```powershell
git diff -- AGENTS.md .agents/skills/tutienidle-adversarial-qa game/docs/qa/learned-defects.md
git status --short
```

Confirm only the intended skill, ledger, and additive `AGENTS.md` rule are part of this implementation. Preserve and report unrelated pre-existing UI and documentation changes.

- [ ] **Step 8: Final summary**

Report:

- What was created or changed.
- Structural validation and mapper-test results.
- Which forward scenarios were exercised and their observed classifications.
- Any remaining limitation, especially that behavioral skill quality improves through real defect backfill and cannot guarantee zero bugs.
- That no commit, push, merge, deploy, production-code edit, or dependency change occurred.

Do not claim completion if structural validation, mapper tests, reference links, write-boundary checks, or required scenario behaviors remain unresolved.

## Notes / Suggestions

- The deterministic mapper is retained because this repository has enough overlapping systems that repeatedly reconstructing changed-path routing would be error-prone. It is advisory, not an architectural source of truth.
- `GameManager.ts` intentionally maps to four domains. This creates a deep-audit candidate because it is a real orchestration hotspot, not because every edit automatically proves broad risk.
- Independent forward-testing is valuable for this complex skill. Perform it only when the chosen execution workflow authorizes a fresh agent/session; otherwise use an isolated manual session and record that limitation.
- No production test hooks are planned. A missing hook discovered during real QA is reported as a coverage gap and proposed separately for user approval.
