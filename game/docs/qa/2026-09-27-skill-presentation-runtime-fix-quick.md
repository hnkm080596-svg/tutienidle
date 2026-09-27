# QA Quick Review — skill-presentation-runtime fix spec W1-W8

Date: 2026-09-27 · Mode: quick · Scope: 563061f9..HEAD (10 commits, 30 files) on `codex/skill-presentation-runtime` — actor-impulse restore, camera-cue primitive, dead action_impact surface removal, bounded awaitStep, production e2e, dev-lab conformance, invariant pins, runner resume fix.

## Inputs

Task-owned paths: the full `git diff 563061f9..HEAD --name-only` list (30 files). Mapper flagged `deepAuditCandidate` (cross-system: 4 domains, time-and-offline boundary) and left 17 paths unmapped. Bounding by code inspection: the mapped high-risk domains trace to a comment-only `GameManager.ts` change, test-only battle files, a deleted unused preset getter, and a scene VFX surface. No save/offline/progression/lifecycle-authority semantics touched — CombatClock, persistence, stores untouched. Risk confidently bounded; no deep escalation.

## Invariant ledger

| ID | Hypothesis | Operator | Oracle | Result |
| --- | --- | --- | --- | --- |
| H1 | Impulse ACKs the engine (actor motion leaks authority) | boundary | ack mocks on scene + runner tests | Rejected — impulse returns quietHandle before accent; scene test asserts no ACK |
| H2 | Impulse/camera-cue reaches accent() draw path | boundary | accent-warn driver test | Rejected — warn + zero draws pinned |
| H3 | Double impulse/camera per action (re-emit, multi-group) | replay | sameRef dedupe, per-token latch, ≤1/action pin | Rejected — pinned |
| H4 | Generic camera fires on miss/empty/reduced-motion | contradiction | landed-hit + reducedMotion gates | Rejected — pinned by driver tests |
| H5 | Stale resume tears down healthy playback | stale-state | token check before cancel | Rejected — new runner test pins it |
| H6 | Resume tail exceeds 120 ms or ACKs impact again | bound | duration cap, sample bound test | Rejected — completes exactly at 120 |
| H7 | Force-drive while held double-settles or re-arms forever | replay/bound | presentationReceipt test | Rejected — one drive, stale entry dropped, warn once |
| H8 | awaitStep fallback completes step without mechanical work | authority | driveStepWork = acknowledge* (real work) | Rejected — force-drive plays renderer's part; rejected drive leaves step parked (warn) |
| H9 | Routed primary + synthesized fallback duplicate | duplication | skillPlan pin | Rejected — exact role list pinned |
| H10 | Companion/player-side entity lunges wrong direction | cross-entity | `entityId === PLAYER_ID ? 1 : -1` fallback vs sprite `facing: entityId === PLAYER_ID ? 'right' : 'left'` | Nit — impulse fallback matches the pre-existing facing convention exactly (companions already face left); consistent, not a regression |
| H11 | Resume mid-cast wedges pipeline (impact parked, complete ACK'd) | ordering | token gate narrows trigger; cancel-first was pre-change behavior | Pre-existing/out-of-scope — identical wedge existed pre-diff; W4 bound + warns mitigate; unchanged surface |

## Verification evidence

| Command / observation | Result |
| --- | --- |
| `npm run type-check` (vue-tsc) | green per commit |
| `npx vitest run` full suite | 7337 pass / 5 fail — all pre-existing env/branch noise (see below) |
| `npx playwright test skill-presentation-production` | green, 57.6s (single run — flake risk noted) |
| New pins | runner stale-token + tail-cap tests; driver disposition + accent-warn tests; skillPlan no-fallback pin; recipe bounds tests; receipt cap test |

## Findings

No confirmed defects. Nit-level only (deferred, recorded):

- **Nit — no phase-level guard for one-shot primitives.** A recipe authoring `actor-impulse`/`camera-cue` outside its valid phase would fire it there; enforced today by authoring + recipe tests. Safe to defer: no authored recipe does this, bounds are validated, pin exists behaviorally.
- **Nit — recovery-phase camera-cue would re-fire on resume after rejoin** (latch is driver-instance-scoped; a fresh driver has an empty latch). No recipe authors recovery camera-cues; dead path today.
- **Nit — `as never` sprite-stub cast** in `CombatScene.actionPlayback.test.ts` vs `as unknown as EntitySprite` used elsewhere. Cosmetic.
- **Nit — `activeSkillCast` lingers between casts** on CombatScene; only read during cast-phase impulse opens, when it always points at the current cast. Cleared on battle start / destroy.
- **Coverage gap (acknowledged) — resume/rejoin path not exercised by e2e**; unit-pinned only. E2E covers live cast→resolve; rejoin requires a second scene session which the spec did not require.

## New or changed QA tests

None added by this pass — the spec's W7 pin suite already covers the attacked invariants; no hypothesis survived to warrant a repro test.

## Gaps and residual risk

- E2E ran once green; treat as moderate flake risk on CI-less re-runs.
- H11 wedge class is structural and pre-existing; out of this spec's authority.

## Pre-existing failures

`dongFuBackgroundAssets` + `dongFuBuildingPipeline` (spawnSync `magick` ENOENT), `cultivationPathIsolation` (`.swordPath` in BalanceBaselines.ts — untouched), `dynamicRegionHost` (`new Phaser.Game` in dev/skill-vfx.ts — byte-identical at base), `i18nKeyParity` (`skillVfxLab.` prefix probe — unchanged production code). None caused by this diff.

## Verdict

PASS WITH EVIDENCE — all attacked hypotheses rejected by pinned behavior or bounded as pre-existing/nit.
