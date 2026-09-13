# QA quick — shared slot beam + entity-derived player art in Tran Phap preview

Date: 2026-09-14 · Mode: quick · Branch: feat/slot-beam

## Scope (task-owned paths only)

- `game/src/assets/theme.css` — shared `.fx-border-beam` mechanism (+`--clip` variant, `--active` trigger, reduced-motion guard)
- `game/src/components/common/SlotView.vue` — `fx-border-beam` class + `__fx` layer
- `game/src/components/panels/TranPhapPanel.vue` — cells consume shared beam; queue cards migrated to `SlotView`; payload now `{assignments, playerProfileId}`; watch also keys `player.visualProfileId`
- `game/src/core/player/PlayerVisualForm.ts` (new) — entity-owned profile-id derivation
- `game/src/presentation/art/PlayerVisualProfiles.ts` — id/resolver moved to core, re-exported
- `game/src/stores/player.ts` — `visualProfileId` getter
- `game/src/components/game/PhaserCanvas.vue` — gate publish now reads the store getter
- `game/src/game/scenes/CombatScene.ts` — dead import removal only
- `game/src/game/scenes/TranPhapCombatPreviewScene.ts` — payload normalization, real profile art, placeholder fallback, profile-switch rebuild
- `game/src/presentation/contracts/regionEvents.ts` — `FormationAssignmentsPayload`
- Tests: `TranPhapCombatPreviewScene.test.ts`, `player.visualProfile.test.ts`

Mapper: `deepAuditCandidate: true` (3 domains) — NOT escalated: every touched
transition is presentation-side (event payload shape, art resolution, CSS).
No save/clock/economy/combat-rule semantics changed; the single new state
(`currentProfileId`) lives and dies with the scene. `unmappedPaths` all routed
manually: PlayerVisualForm (domain leaf, no imports), PlayerVisualProfiles
(presentation data + re-export), regionEvents (type-only contract file — no
runtime cycle).

## Invariant ledger

| ID | Hypothesis | Result |
| --- | --- | --- |
| INV-1 | Wrapped payload `{assignments, playerProfileId}` vs legacy array — malformed/null payload must not crash the scene handler | Guard added (`return` on junk); legacy array covered by test |
| INV-2 | Player profile changes while panel open → preview sprite must not stay on the old form | Panel watch now keys `player.visualProfileId`; scene rebuilds the player sprite when its texture key differs from the active profile; test covers mortal→phap_tu rebuild |
| INV-3 | Preview must show the SAME art CombatScene shows | Found real divergence mid-review: catalogue marks every profile `animated` and non-mortal clips are placeholder-sheet clips — playing `<profile>-idle` would have rendered placeholder art AND diverged from CombatScene's static-PNG player (`playerUsesStaticTexture`). Corrected: player renders static profile PNG, no clip; companions keep placeholder idle |
| INV-4 | Event subscription lifecycle | `assignmentsHandler` still `on` in create / `off` on shutdown — unchanged |
| INV-5 | SlotView `__fx` layer vs existing chrome | `::before`/`::after` of `.slot-view` untouched (max-rank bar, rarity tint); `__fx` is z-index 8, below veil (9), `pointer-events:none`, `aria-hidden`; beam suppressed on `aria-disabled`; `prefers-reduced-motion` stops the spin |
| INV-6 | Trapezoid cells keep geometry | `clip-path` + `--fx-beam-clip` share the same polygon from `formationSlotStyle`; pointer hit-zone unchanged; beam `--active` only on `hover` state (empty enabled cells) so occupant labels stay visible |
| INV-7 | Store getter single-source | `visualProfileId` derives via `resolvePlayerVisualProfileId` in `core/player/PlayerVisualForm.ts`; PhaserCanvas publishes it to the registry gate; MainScene/CombatScene read the gate (fallback = same resolver, mortal). No second derivation path added |
| INV-8 | Preload correctness | Preview loads placeholder atlas + the 3 profile PNGs only; `textures.exists` guards; no enemy/gourd assets needed |

## Coverage gaps / deferred

- **P14 deferred** (worktree exception): beam spin, trapezoid-edge beam, real profile PNG in the preview, and queue-card drag affordance need a real browser. Check list at merge: hover a bag slot (beam spins), drag a combatant to a trapezoid cell (beam hugs the edge), open Tran Phap (player shows real art, companions show placeholder), drag queue card back.
- Companion combat art still does not exist — placeholder fallback is the declared contract, not a downgrade.

## Verdict

PASS WITH EVIDENCE — bounded presentation change, failing-then-passing tests
for the new contract, one real divergence (animated vs static player art) found
and corrected during this pass.
