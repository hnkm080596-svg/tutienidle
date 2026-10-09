# QA quick review — phap_tu_shared combat art swap to 3x

- Date: 2026-10-09
- Branch: `devin/1791505867-phap-tu-art-3x` (base `devin/artui-c0-foundation` @ a83abb4)
- Mode: quick (scoped fixpoint round; coordinator + 2 blind reviewers)
- Task-owned paths: `game/public/assets/characters/animated/phap_tu_shared/*` (4 sheet PNG, 4 .atlas.json, avatar.png, avatar-transparent.png), `public/assets/characters/animated/manifest.json`, `scripts/index-phap-tu-shared-art.mjs`, `src/game/support/CharacterArt.ts`, `src/presentation/art/PlayerVisualProfiles.ts` + test, `tests/architecture/characterArtReskin.test.ts`, `src/components/panels/EquipmentPaperdoll.vue`, `src/components/scenes/character/fidelity/CharacterFidelityFigure.vue`, `src/game/scenes/CombatScene.ts` (anchor gate), `src/game/support/skill-vfx/HoaCauFireballPresentation.ts`, `tests/architecture/hoaCauAnchorGate.test.ts` (new pin).

## Risk map

`changed-risk-map.mjs`: every task path unmapped (mapper has no art/presentation entries); `deepAuditCandidate: false`. Manual routing: pinia-phaser-sync (atlas/manifest consumed by Phaser loaders + EntitySpriteCanvas), ui-input-lifecycle (the two Vue call sites). No save/clock/economy surface -> quick stays quick.

## Coordinator findings

| ID | Severity | Class | Finding | Disposition |
|---|---|---|---|---|
| F1 | Medium | REAL_DEFECT (EXECUTED_SOURCE_PROOF) | `CombatScene.ts` anchored Hoa Cau fireball origin via `sprite.sourceSize?.w === 244`; after swap w=732 -> gate misses -> fireball spawns at generic 'front' body anchor instead of the raised palm. | FIXED: gate `=== 732`; anchor fractions re-expressed in new cell (705/732, 138/756 — numerically identical, composition verified identical at 3x by eyeballing attack frames 6-12 and matching hand band measurement). Pin added: `hoaCauAnchorGate.test.ts` binds the literal to `CHARACTER_ART.phap_tu_shared.sourceSize`. |
| F2 | Low | REAL_DEFECT sibling (INFERRED, production-reachable) | `PlayerPortrait` variant 'portrait' (disc on tab Nhan Vat) renders the same idle clip unscaled -> phap_tu figure ~8.7% smaller than mortal in the same disc. | OPEN — out of the task's named surface (task scoped EquipmentPaperdoll + CharacterFidelityFigure); escalated to owner in report. |
| F3 | Nit | NON_ACTIONABLE | `SkillPaperTree.vue` `extent` refs = unrelated pan/zoom layout concept, not figure extent. | closed |
| F4 | — | (fixed pre-review) | Regenerated `manifest.json` dropped `impactFrameIndex` (attack 10, cast-special 12). Script now emits markers from `art/animation-impact-markers.json`; verified diff-clean vs base except sizes. | FIXED |

## Op B deterministic evidence

- `vitest run` reskin + PlayerVisualProfiles + staticArtExtentDeclared + animationCatalogue + artExtentDeclared: 39 pass.
- CombatScene.combatAnimations + HoaCauFireballPresentation + HoaCauFireballTimeline + hoaCauAnchorGate + TranPhapCombatPreviewScene + tamMuoiAuraArt + EquipmentPaperdoll: all pass.
- `tsc --noEmit -p tsconfig.json`: clean.
- `node scripts/index-phap-tu-shared-art.mjs --check`: clean.
- Atlas structural diff vs base: identical key/schema/meta shape; only dims changed.
- CI `verify` on PR #159 fails on pre-existing base-branch failures (ElementBossMatrix victory->defeat x6, PhapTuBasicNodes gate, SlotView art-literal coverage, i18n parity, asciiComments ratchet — all in files outside this diff; reproduced locally on this head => baseline-failed, not task-caused).

## Reviewer dispatches (Op L, Clean A)

- QA-A `devin-b92a2846801947a2a13aaa8db8a4c46b`: atlas/registry correctness lens.
- QA-B `devin-bc4a29559a764da58a041e4c7014d803`: UI scale + sibling-hunt lens.

### QA-A (atlas/registry lens) — SEALED_RESULT received, adjudicated

Independence: fresh context, own clone (`tutienidle-review`), two independent oracles (Pillow verifier + regen-diff vs committed blobs). Coverage complete.

| ID | Reviewer class/sev | Adjudication |
|---|---|---|
| A-F1 | REAL_DEFECT Medium — `sourceSize?.w === 244` gate stale | CONFIRMED (matches coordinator F1). FIXED in 7117c92c + pin `hoaCauAnchorGate.test.ts` (0fd1ff75). Reviewer's own probe confirms gate unreachable at 732 pre-fix. CLOSED. |
| A-F2 | REAL_DEFECT Medium — `emitJson --check` byte-compare EOL-sensitive: always stale on Windows autocrlf checkout | CONFIRMED (their clone repro: blob LF vs worktree CRLF; local pass was because files were generated, never checked out). FIXED in 9ed8c424: normalize `\r\n` before compare. Avatar PNG compare is binary — unaffected. CLOSED. |
| A-F3 | TEST_DEFECT Nit — HoaCau fixture dims `244*0.95` stale-looking; no coverage on the gate predicate | Coverage gap closed by `hoaCauAnchorGate.test.ts`. Fixture dims are arbitrary formula inputs (expected values unchanged since fractions identical) — left as-is, Nit recorded. CLOSED. |
| A-H1 | scale(1/extent.h) overflows figure ~9.6% above zone top | NON_ACTIONABLE — mortal (extent.h=1) already fills the zone identically; scaled phap_tu lands its opaque figure at the same top edge. Design intent, not regression. CLOSED. |
| A-H2/H3 | pack rebuild drops variant until re-index (documented workflow); avatar.png only dims-checked (unused file for this variant) | NON_ACTIONABLE — by design / unused path. CLOSED. |

Their oracle result: 0 drift in the art pack itself — schema, geometry, occupancy, extent, avatar all verified byte-exact.

### QA-B (UI scale + sibling lens) — SEALED_RESULT received, adjudicated

Independence: fresh context, own clone; equivalence oracle test mounted both components and asserted `--cf-figure-scale` = 1.0957 (phap_tu) vs 1.0 (mortal armed/unarmed); PIL re-measure of extent matches registry; all other extents h=1.

| ID | Reviewer class/sev | Adjudication |
|---|---|---|
| B-F1 | REAL sibling, LOW — `PlayerPortrait` 'portrait' canvas path same scale miss | CONFIRMED but DORMANT today (ENTITY_ART_MODE='static' -> img path; PNG extents 0.911 vs 0.913). FIXED anyway in 5d1333cd (same 1/extent.h var on canvas path) so the animated-mode flip cannot resurrect it. CLOSED. |
| B-F2 | Latent defect amplified, LOW-MED — `EntitySpriteCanvas` loads atlas once onMounted; profile/armed swap while mounted -> stale art + now wrong scale | CONFIRMED (pre-existing; this fix would amplify it). FIXED in 5d1333cd: `:key` on clip atlasUrl at all three call sites remounts the canvas on clip change; amplification neutralized on every EntitySpriteCanvas surface. CLOSED. |
| B-F3 | Layout interaction, LOW — cf-figure column (~275px) < canvas wants (~336px) -> max-width letterbox; feet float ~31px (mortal) / ~37px (phap_tu) | REAL cosmetic, PRE-EXISTING for mortal too (identical mechanism). Not a regression of this change; recorded as art-intent question for owner (zone wants wider canvas or accept letterbox). OPEN -> owner. |
| B-F4 | INFO — "feet planted" is 2.6% short in both combat and panels (extent.y+h=0.9762 is in-art margin) | Faithful port — identical in combat; changing it means re-authoring the art margin, not a code fix. NON_ACTIONABLE -> note to owner. |
| B-F5 | Inventory sweep (CombatPlayerCard/TurnOrderStrip/TranPhapPanel icons, MainScene/Tribulation statics, TranPhapPreview, AtlasIdleSprite, cultivate, hidden-way profiles) | All NON_ACTIONABLE — different size contracts, normalized already, or dormant same as B-F1. CLOSED. |

Hanging hypotheses for owner: feet-float 2.6% as "standing on the ground" (art intent), F2 trigger reachability in ritual flow, static-portrait 1.7% face-size delta (cosmetic).

## Outcome

Clean A complete: all REAL defects repaired + pinned (gate -> registry-bound pin; --check EOL normalize; stale-canvas remount keys; dormant portrait scale). Remaining opens: one owner escalation (PlayerPortrait static 1.7% / letterbox / feet-float art intent) and pre-existing base-branch verify failures outside this diff. Scoped verdict: **QA_FIXED_POINT_REACHED** for this change set with the noted owner question; not a repo-wide clean claim (baseline already red).
