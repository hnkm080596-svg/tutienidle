# QA run character-art-infra-2026-09-28

- phase: DECIDE
- outcome: QA_FIXED_POINT_REACHED
- state: product=178d47d706eb contract=cf9466eb0fb9 attack=a4ec1e669112 env=ac0d008c3b8a
- base/head: 578e99462d0b7e3c173ca3ea542e0d316dc67095 -> 578e99462d0b7e3c173ca3ea542e0d316dc67095

## Findings

- **F-CAI-01** Medium/REAL_DEFECT — CLOSED — Preview scene sync compared sprite texture against a single expected key - a mapped profile atlas/avatar legitimately draws a different key, so the player sprite was destroyed+rebuilt on EVERY sync under reskin
- **F-CAI-02** Medium/REAL_DEFECT — CLOSED — Ultimate cast on a variant with no authored 'ult' clip skipped the attack tell entirely - missing-clip path went straight to standby destination
- **F-CAI-03** Medium/COVERAGE_GAP — CLOSED — Preview test harness mocked the pre-reskin draw path (raw combatTextureKey) and lacked scene.textures.exists - the new reskin branches were untestable and silently diverged from production
- **F-CAI-04** Medium/COVERAGE_GAP — CLOSED — No behavioral test pinned slotRole through the emit->payload->onAttack chain, nor the ult->attack degradation - the wave central contract was covered only by types, not behavior
- **F-CAI-05** Low/REAL_DEFECT — CLOSED — Static-branch profile swap left in-flight clips running - a pending ANIMATION_COMPLETE once-listener could replay its standby destination on the old atlas and undo the swap; also no guard against swapping a dying sprite
- **F-CAI-06** Low/REAL_DEFECT — CLOSED — Atlas-miss + profile event wrote ATLAS sourceSize/extent onto a sprite actually drawing the avatar PNG - fallback squashed ~32% horizontally
- **F-CAI-07** Low/REAL_DEFECT — CLOSED — Avatar persistence on atlas-miss relied on Phaser incidental empty-anim no-op - a clip registered with zero frames would still be passed to play() and could swap texture off the avatar
- **F-CAI-08** Nit/COVERAGE_GAP — CLOSED — Character slugs share the catalogue keyspace with monster variants and companion ids - register() is last-writer-wins, so a future slug/id collision silently overwrites a reskin
- **F-CAI-09** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — readPivot JSON fallback {0.5,0} vs emit default {0.5,1}
- **F-CAI-10** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — MainScene home view still draws the legacy profile PNG (not reskin)
- **F-CAI-11** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — ~9 unwired character variants packed and staged - future VRAM cost when wired
- **F-CAI-12** Medium/REAL_DEFECT — CLOSED — beginDeathSequence plays a registered-but-empty death clip (atlas-miss) -> play() throws on frames[0], corpse freezes fully opaque; playCombatAnimation guarded this but the death path bypasses it
- **F-CAI-13** Medium/REAL_DEFECT — CLOSED — ResumePlayback cast variant drops slotRole -> a cast resumed via create()/rebindSession() replays onAttack without the role and an ultimate presents as attack
- **F-CAI-14** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — Queued repeat/multicast executions emit slotRole basic even for repeated ultimates
- **F-CAI-15** Low/TEST_DEFECT — CLOSED — Player-never-destroyed death test was vacuous: emitted animationcomplete with the profile texture key while the played key is the reskin slug - animDone never resolved so the isPlayer guard was untested
- **F-CAI-16** Low/REAL_DEFECT — CLOSED — TranPhapCombatPreviewScene.startEntityIdle plays a zero-frame registered idle clip -> play() throws on frames[0] (same class as F-CAI-12, preview surface)
- **F-CAI-17** Nit/REAL_DEFECT — CLOSED — Player branch add.sprite in combat-grid-view lacks the textures.exists(drawKey) gate the enemy branch has - double asset miss yields a __MISSING sprite instead of the fallback chain
- **F-CAI-18** Nit/COVERAGE_GAP — CLOSED — Character/monster slugs are not pinned disjoint from profile texture keys / FALLBACK / PLACEHOLDER entity keys (unrealistic under naming conventions)
- **F-CAI-19** Medium/REAL_DEFECT — CLOSED — ANIMATION_COMPLETE destination hop plays destinationKey guarded only by exists() - partial multi-sheet miss (zuofeng clips split across 3 sheets) leaves destination registered-empty; play() throws on frames[0] inside the event callback, sprite frozen on last attack frame
- **F-CAI-20** Nit/REAL_DEFECT — DUPLICATE_LINKED — Player branch add.sprite lacks textures.exists(drawKey) gate - double asset miss yields __MISSING instead of fallback chain (same as F-CAI-17)
- **F-CAI-21** Nit/REAL_DEFECT — CLOSED — Animated-branch profile swap left the pending ANIMATION_COMPLETE once-listener armed - dead listener stacks per mid-clip swap (key-guarded, cannot fire wrong)
- **F-CAI-22** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — Mid-turn profile swap replays idle while runtime reports standby - cosmetic one-frame divergence until next turn event re-syncs
- **F-CAI-23** Low/TEST_DEFECT — CLOSED — e2e sampler dropped non-sprite kinds and seeded animatedIds with the probe - a natural reskin regressing to Rectangle was invisible to criterion 3
- **F-CAI-24** Nit/DOCUMENTATION_DEFECT — CLOSED — TranPhapPanel queue-card comment claimed the card shows the same PNG combat draws - stale post-reskin (combat draws the zuofeng atlas)
- **F-CAI-25** Medium/REAL_DEFECT — CLOSED — Player draw branch had NO terminal fallback: after atlas-miss -> avatar swap, a double miss left drawKey pointing at the absent atlas sheet -> add.sprite drew Phaser __MISSING checkerboard at full character height. Enemy branch ends on host-fallback/Rectangle; player did not (independent confirmation of F-CAI-17 nit, upgraded)
- **F-CAI-26** Medium/REAL_DEFECT — CLOSED — monsterCatalogue/characterCatalogue emitted optional clips as present-but-undefined (attack: undefined / ult: undefined); Object.values(clips) consumers (registerClipCatalogue, CombatPreload, AssetBundleCatalog, preview preload) dereference undefined.sheetKey -> crash on any variant lacking attack art
- **F-CAI-27** Low/REAL_DEFECT — CLOSED — pack-character-art emitted clip ranges from first/last source index without contiguity validation, and wrote sheet PNG/JSON files BEFORE the split-across-sheets guard - a gap in source indices registers frames naming un-emitted PNGs; a late throw left partial sheets on disk
- **F-CAI-28** Low/REAL_DEFECT — CLOSED — A one-shot clip completing onto a missing/empty standby loop left the sprite frozen on the last attack frame - no fallback from the loop class existed (only MISSING_CLIP_FALLBACK.ult -> attack)
- **F-CAI-29** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — MainScene and TribulationScene contain latent zero-frame .play() paths - dormant while player/entities render in static mode, but the same crash class as F-CAI-12/16/19 if animated mode expands to those scenes
- **F-CAI-30** Medium/REAL_DEFECT — CLOSED — playCombatAnimation had no dying guard: a late turn_cast_start/turn_standby_complete mid-death replaced the death clip; the key-filtered ANIMATION_COMPLETE then never fired -> animDone stayed false -> finalize() wedged (enemy corpse permanent, skipped by reconcile) / corpse replayed casts (player). Companion reskin surface inherits the same wedge. Secondary: onBattleStart cleared playerDying AFTER its idle replay, so the gate would have swallowed the reset (found while fixing)
- **F-CAI-31** Low/REAL_DEFECT — CLOSED — Preview rebuild-guard acceptableTextureKeys omitted playerProfile.combatTextureKey - the grid-view terminal fallback (F-CAI-25 repair) can legitimately leave the sprite on the profile PNG, so every sync under a double asset miss would destroy+recreate the sprite
- **F-CAI-32** Low/REAL_DEFECT — CLOSED — applyPlayerVisualProfile sized a double-miss sprite by atlas metrics while it actually drew the profile PNG or host fallback - the avatar-miss branch had no deeper tier
- **F-CAI-33** Low/REAL_DEFECT — CLOSED — pack-character-art clipOfDirName accepted bare death/ but not <slug>-death/ - a future dump using the sibling-dir convention would silently drop real death frames and substitute the darkened attack frame
- **F-CAI-34** Nit/REAL_DEFECT — CLOSED — readPivot malformed-file default {0.5,0.0} disagreed with the missing-file default {0.5,1.0} - provenance-only field but self-inconsistent
- **F-CAI-35** Low/SPEC_DEFECT — CLOSED — Charge-resolve turn emitted slotRole basic (action null on resolve) though declared.chargedSkill IS the ultimate/special skill - the resolve hit played attack instead of ult (spec ambiguity hardened into a defect by I-ULT-SLOT-SELECT wording)
- **F-CB2-01** Medium/REAL_DEFECT — CLOSED — standby_to_idle interrupts in-flight one-shot clip on every routine cast
- **F-CB2-02** Low/REAL_DEFECT — CLOSED — charge-continuation turns emit slotRole basic and replay the attack tell
- **F-CB2-03** Low/REAL_DEFECT — CLOSED — partial multi-sheet loss froze the sprite on the last one-shot frame
- **F-CB2-04** Nit/REAL_DEFECT — CLOSED — resume-path attack replayed the horizontal impulse on a dying actor
- **F-CB2-05** Nit/REAL_DEFECT — CLOSED — MainScene dormant animated mode resolved the legacy atlas, not resolvePlayerEntityKey
- **F-R7-01** Medium/REAL_DEFECT — CLOSED — getHomeDescriptors bypasses resolvePlayerEntityKey - home bundle under-enumerates reskin sheets
- **F-R7-02** Medium/COVERAGE_GAP — CLOSED — applyPlayerVisualProfile swap path had zero direct test coverage
- **F-R7-03** Low/REAL_DEFECT — CLOSED — same-key one-shot re-arm leaves orphaned once-listener that consumes the deferred intent
- **F-R7-04** Low/REAL_DEFECT — CLOSED — loop request truncates a one-shot whose destination clip is unloadable
- **F-DEF-01** Low/NON_ACTIONABLE — REJECTED_WITH_PROOF — PlayerPortrait.vue bypasses resolvePlayerEntityKey (dormant-mode only)
- **F-DEF-02** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — CombatScene.ts local EntitySprite duplicates combatTypes.ts (drift hazard)
- **F-DEF-03** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — death/clearSceneState paths clear listener field without off() on emitter
- **F-DEF-04** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — profile swap while armed + new-profile atlas missing leaves stale listener
- **F-DEF-05** Nit/NON_ACTIONABLE — REJECTED_WITH_PROOF — vestigial PROMOTED.set fixtures in CombatScene.combatAnimations.test.ts

## Coverage

- cells: 23 total; SATISFIED=23

## Chronology

- cycle CYC-P5: STALE; reviews RV-P5-1,RV-P5-2,RV-P5-3
- cycle CYC-CLEAN-A: STALE; reviews RV-CA-1,RV-CA-2,RV-CA-3
- cycle CYC-CLEAN-R1: STALE; reviews RV-R1-1,RV-R1-2,RV-R1-3
- cycle CYC-CLEAN-R2: STALE; reviews RV-R2-1,RV-R2-2,RV-R2-3
- cycle CYC-CLEAN-A2: STALE; reviews RV-A2-1,RV-A2-2,RV-A2-3
- cycle CYC-CLEAN-A3: STALE; reviews RV-CA-1,RV-CA-2,RV-CA-3
- cycle CYC-CLEAN-B3: STALE; reviews RV-CB-1,RV-CB-2,RV-CB-3
- cycle CYC-CLEAN-A4: CLEAN; reviews RV-FA-1,RV-FA-2,RV-FA-3,RV-FA-TERM
- cycle CYC-CLEAN-B4: CLEAN; reviews RV-FB-1,RV-FB-2,RV-FB-3,RV-FB-TERM

## Convergence

- OK C1-identity: all final evidence binds the declared state
- OK C2-census-coverage: census + coverage complete
- OK C3-no-open: none open
- OK C4-final-gates: final gates green
- OK C5-sequential: sequential phase reviews present
- OK C6-clean-pair: Clean A/B complete and independent
- OK C7-mutation-corpus: mutation + corpus satisfied
- OK C8-terminal-check: independent terminal verifier sealed
- OK C9-readiness: brief(s) lack finalConformance evidence: 
