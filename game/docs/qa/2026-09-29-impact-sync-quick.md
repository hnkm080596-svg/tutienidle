# QA Review: impact-sync (animation-driven cast impact timing)

- Date: 2026-09-29
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/battle/turn/{CombatAnimationRuntime,SkillPresentationFacts,TurnBattleConstants}.ts`, `game/src/core/game/{GameManager,GameManagerTurnBattleOps,GameManagerTurnBattlePresentationOps}.ts`, `game/src/game/scenes/{CombatScene.ts,combat/combat-animation-playback.ts}`, `game/src/game/support/{CharacterArt,CombatPreload,MonsterArt}.ts`, `game/src/presentation/art/{CombatEntityPresentation,CombatPresentationCatalogue,PlayerVisualProfiles}.ts`, `game/src/presentation/assets/AssetBundleCatalog.ts`, `game/src/presentation/skills/SkillPresentationRunner.ts`, `game/src/components/common/PlayerPortrait.vue`, `game/src/dev/skill-vfx.ts`, `game/art/animation-impact-markers.json`, `game/scripts/{apply-impact-markers,pack-character-art,pack-enemy-art,render-contact-sheet}.mjs`, generated manifests, and the new/edited test files under `game/tests/architecture/` + `game/src/**`.
- Exclusions (non-task-owned dirty paths): none — the QA-run evidence dir `docs/qa/runs/impact-sync-2026-09-29/` is generated protocol evidence, reviewed for generation consistency only.

## Scope and Risk Map

Changed systems: combat turn-presentation pipeline (cast fact publication, admission, resume), art registries/catalogue (markers, wugu variant, companion reskin seam), presentation runner timing, PlayerPortrait live profile resolution.

One-hop consumers (from `changed-risk-map.mjs` + manual routing for the 11 unmapped paths): `skill_presentation_cast` subscribers (CombatScene binding — the only production consumer; `dev/skill-vfx.ts` is a manual harness), `turn_cast_start` (telemetry — `TurnActionPresentationEvents.ts` documents no production subscribers; verified by grep), `CombatScene` event teardown (bindings list is one teardown unit — unchanged mechanics), preload/AssetBundleCatalog asset enumeration (image descriptors only), PlayerPortrait consumers (visual-only).

Escalation decision: mapper returned `deepAuditCandidate: true` (5 domains + "critical state boundary: time-and-offline"). Risk is confidently bounded, so no deep escalation: (a) no file the diff touches owns clock, offline accrual, save schema, or economy — `TurnBattleConstants.ts` is a constants module and `GameManager.ts` received a docstring-only edit; (b) the time/offline flag came from `GameManager.ts` fan-out, but the GameManager hunk is a JSDoc refresh with zero behavior; (c) Vue/Pinia/Phaser lifecycle risk is bounded — PlayerPortrait adds a computed read over an existing store getter, and the scene binding change replaces one handler with another inside the same registration/teardown array, no lifecycle ownership change; (d) the changed combat surface is presentation timing — domain outcomes (damage, latches, tokens) are untouched.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-IS-1 | `pendingDeclaredAction` / CombatAnimationRuntime | `skill_presentation_cast` published exactly once per declared action | Exactly-once | Repeat | second `publishPendingCast()` for same action is no-op; §60/`presentationReceipt` asserts one `skill_presentation_cast` before `resolved` | Integration | High |
| INV-IS-2 | active playback / SkillPresentationRunner | same-ref duplicate cast emit vs fresh restart | Idempotency | Repeat/Reorder | `canStart` false on duplicate same-ref + stale token; `CombatScene.combatAnimations` tests assert `start` called once, zero restarts | Unit | High |
| INV-IS-3 | played clip ↔ timing clip / CombatScene | clip that fails `tryPlayExactAtlasClip` falls to next candidate | Synchronization (timing clip IS played clip) | Degraded env | zero-frame preferred clip → falls back, `start` gets the actually-played clip's castMs (test: missing per-skill → unarmed clip + `clipImpactMs(attack)`) | Unit | High |
| INV-IS-4 | resume payload / CombatAnimationRuntime | resume 'cast' re-delivers whole cast fact; 'complete' cannot replay cast | Atomicity | Interruption | §65 pins: requestId stable, token renewed, stale rejected, post-impact restart structurally impossible | Unit | High |
| INV-IS-5 | castMs override / SkillPresentationRunner | `clipImpactMs` outside (0, ANIMATION_FALLBACK_MS) or non-finite | Boundedness | Value mutation | §62: override rejected → recipe castMs + `fault()` diagnostic | Unit | High |
| INV-IS-6 | domain impact vs authored marker / real combat | marked clip impact lands on authored contact frame | Synchronization | Timing boundary | Phase-11 browser proof: `pham_nhan-attack` marker 6 → authored 812.5ms, measured 809–813ms, impact lands on `pham_nhan-attack-007.png` | Runtime | High |
| INV-IS-7 | slotRole 'none' / resolver | non-cast declared turns (charge tick, CC-skip) | Idempotency | Reorder | `startCastPlayback` returns `{source:'none'}` → recipe timing; no clip attempted | Unit | Medium |
| INV-IS-8 | markers.json ↔ manifest ↔ registry | drift between authoring surface and packed manifest | Determinism | Value mutation | `impactMarkers.test.ts`: committed-table validity + registry range check + applier failure modes | Unit | Medium |
| INV-IS-9 | COMPANION_RESKIN_MAP / catalogue | mapped companion animates via borrowed character variant | Boundedness | Stale state | `companionSeam.test.ts`: injected mapping → forced animated, correct sheet keys, preload enumeration | Unit | Medium |
| INV-IS-10 | no per-skill-id runtime branches / scene+runtime+runner | generic path only | Maintainability (contract) | — | `noSkillIdBranch.test.ts` scans the 4 hot files for literal skill-id branches | Unit | Medium |
| INV-IS-11 | `entityKey in COMPANION_RESKIN_MAP` / isForcedAnimatedEntity | inherited Object.prototype key (`'constructor'`, `'toString'`) as entityKey | Boundedness | Value mutation | see finding QA-2026-09-29-01 — Suspected/Low, unreachable via data-driven ids | — | Low |
| INV-IS-12 | portrait profile resolution / PlayerPortrait | non-mortal profile + hidden-way cultivate | Synchronization | Value mutation | `resolvePlayerEntityKey` falls back to combatTextureKey for unmapped ids; `getCultivateTexture` hidden-way override test | Unit | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run verify` (type-check + build + full vitest) | 798 passing files, 5 failing | Failures are 3 preexisting master failures (combatContract literal scan, dynamicRegionHost Phaser.Game, i18nKeyParity) verified on the main checkout — see Pre-existing Failures. All impact-sync tests green (48 scene tests, 14 marker, 7 wugu, ~10 seam, 6 resolver, resume pins, §60–64 matrix). |
| Real-browser Phase-11 proof (vite dev, headed+headless Chromium, eventBus instrumentation) | PASS | Marked `pham_nhan-attack`: Δ 809.0/812.5ms vs authored 812.5ms (±150ms bound); frame at impact = marker frame; unmarked boar clip lands at own last-frame midpoint (147–214ms vs 187.5 expected); static bandit → recipe timing ~240–277ms. |
| `node scripts/apply-impact-markers.mjs --dry-run` + failure-mode fixtures | PASS | 8 markers validate; fixture rejects unknown variant/clip, non-integer, out-of-range, negative — 7 failure-mode cases pinned. |
| Grep: production `turn_cast_start` consumers | none | Observation feed only (`TurnActionPresentationEvents.ts` header); scene binding removal removes no domain consumer. |
| `grep resolvedSkillId\|rootSkillId === 'literal'` hot files | clean | `noSkillIdBranch.test.ts` canary + scan green. |

## Findings

### QA-2026-09-29-01: `in` check on COMPANION_RESKIN_MAP inherits Object.prototype keys
- Severity: Low
- Status: Suspected
- Invariant: Boundedness — only actually-mapped companion ids should force animation.
- Preconditions: an entityKey colliding with an inherited `Object.prototype` property (e.g. `constructor`, `toString`, `hasOwnProperty`).
- Reproduction: `isForcedAnimatedEntity('toString')` returns `true` (membership via `in` walks the prototype chain); `companionArtVariant('toString')` would then throw (`COMPANION_RESKIN_MAP['toString']` resolves to `Object.prototype.toString`, not a slug — wait, `Function` → `CHARACTER_ART[Function]` → undefined → throws "maps to unknown character art"). In `entityPresentation` the forced check fires first, so a catalogue entry would emit `kind:'animated'` for a phantom key.
- Expected: own-enumerated-key membership only.
- Actual: inherited-key membership returns true for a phantom entityKey.
- Evidence: static proof (`'toString' in {}` === true; `COMPANION_RESKIN_MAP` is a plain object literal). Not runtime-confirmed: no data path produces such an entityKey — companion ids come from `COMPANIONS` data records, entity keys from combat actor ids; all real ids are data-authored slugs.
- Test file: none (existing `companionSeam` tests cover data-path behavior).
- Owner subsystem: presentation/art catalogue.
- Blast radius: none today — unreachable via data-driven ids; becomes reachable only if a future registry feeds attacker/external ids into `resolveCombatEntityKey`.
- Resolution (sequential-review Pass 1, same day): fixed — `entityKey in COMPANION_RESKIN_MAP` replaced with `Object.hasOwn(COMPANION_RESKIN_MAP, entityKey)` in `isForcedAnimatedEntity`; affected tests re-run green.

## New or Changed QA Tests

None authored this pass — all ledger hypotheses resolved against the task's own executed deterministic suite (§60–70) plus the real-browser instrumentation run; the one open item is unreachable-by-data and captured as Suspected/Low.

## Gaps and Residual Risk

- Other marked clips (`pham_nhan_unarmed` attack/cast-linh_bao, `ngu_kiem`, `ngu_hanh` attack/cast-special, `zuofeng` attack/ult@10fps, `wugu-demon-king` attack) share the identical `clipImpactMs → castMs` path proven end-to-end; only `pham_nhan-attack` was individually exercised in the browser. Residual risk is low — the per-clip inputs (marker + frameRate) are pinned by the marker/architecture tests.
- Resume mid-cast is pinned at unit level (token/requestId/no-replay); a mid-cast hard refresh in a live browser battle was not exercised — bounded coverage gap, non-material since the resume contract is what the tests pin.

## Pre-existing Failures

Verified on the main checkout (unmodified master), NOT task-owned:
- `tests/architecture/combatContract.test.ts` — `onBattleStart` literal scan.
- `tests/architecture/dynamicRegionHost.test.ts` — `dev/skill-vfx.ts` Phaser.Game guard.
- `tests/architecture/i18nKeyParity.test.ts` — `skillVfxLab.` locale keys.
