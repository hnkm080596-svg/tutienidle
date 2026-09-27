# P4 Quick Adversarial QA — enemy-art-wave1

- Branch: `enemy-art-wave1` (worktree `.agent-worktrees/enemy-art-wave1`)
- Scope: NEWSPRITE reskin pipeline — `scripts/pack-enemy-art.mjs`, `src/game/support/MonsterArt.ts`, `CombatPresentationCatalogue` animated overrides, `combat-animation-playback` attack clip, preload/bundle wiring, `enemyArtReskin` + `combat-idle-motion-capture` tests.
- Date: 2026-09-27
- Mode: quick

## Hypotheses exercised

| # | Hypothesis | Evidence | Verdict |
|---|---|---|---|
| H1 | Duplicate animation registration on 2nd combat | `CombatScene.registerCombatAnimations` → `registerClipCatalogue` guards `anims.exists(key)` | Closed — idempotent |
| H2 | Stale death-callback destroys replacement sprite | `finalizeAnimatedDeath` identity-checks `this.sprite` + `pendingDeathIds` token | Closed |
| H3 | Attack/death once-listener fires on wrong clip | `current.once(ANIMATION_COMPLETE)` filters `anim.key === key` | Closed |
| H4 | Registry `sheet-1` hardcode breaks multi-sheet clips | Manifest inspected: all 22 wired variants are 1-sheet; reserved wugu is 4-sheet (unwired). **Latent** — pinned by new manifest-parity assertion on `sheet`/`atlas` per clip | Closed as defect-in-waiting, guarded |
| H5 | Combat bundle enumerates on-disk manifest (loads reserved wugu) | `AssetBundleCatalog`/`CombatPreload` both iterate `MONSTER_ART` registry only — wugu sheets never load | Closed |
| H6 | Old PNG texture + new atlas double-draw per enemy | `resolveEnemyArt` picks avatar for mapped ids; `ENEMY_TEMPLATE_IDS` loop unchanged for unmapped | Closed — exclusive branches |
| H7 | Ferocious/boss runtime ids miss the map | Longest-prefix matching `id.startsWith(templateId+'_')`; boss ids verified against `ENEMIES` (`foundation_ferocious_flood_dragon_whelp` is the floor-10 boss; earlier `foundation_dragon_phase*` keys were buff ids — fixed pre-QA) | Closed |
| H8 | Feet anchoring wrong (Unity pivot ≠ ground) | Measured: wolf bbox bottom 0.76 vs pivot ~0.01 — pivot unusable; packer now crops `sourceSize` to idle union bbox; e2e screenshots confirm feet planted | Closed — fixed in packer |
| H9 | Missing atlas → crash instead of fallback | `anims.create` on missing texture warns + no-ops; sprite keeps avatar/placeholder texture. Not crash-critical. **Coverage gap**: no e2e for network-miss atlas path | Coverage gap (Low) |
| H10 | VRAM blowup from 21 eager sheets | ~61MB PNG on disk; all registered variants preload regardless of floor — matches existing eager-enumeration design, but notable on low-end | Low / design-consistent |

## Findings

None at Critical/High/Medium. Two Lows + one coverage gap:

- **L1 (Low, latent)**: `clip()` hardcodes `sheet-1`. Safe today; will break when reserved 4-sheet `wugu-demon-king` is wired. Mitigation added: `enemyArtReskin` now asserts `sheetUrl`/`atlasUrl` end with the manifest-emitted `sheet`/`atlas` per clip — wiring wugu will fail the test loudly instead of shipping silent empty frames.
- **L2 (Low)**: `attackSfxUrl` is staged metadata — declared, files copied, not consumed by AudioManager. Per user ruling (SFX design deferred); documented as such in registry.
- **CG1 (coverage gap)**: atlas-load-failure degradation path (placeholder persistence) unexercised e2e.

## Evidence gathered during QA (fixes landed in this pass)

- `readPivot` m_X/m_Y parser fix — real pivots recovered into manifest (provenance).
- Crop-to-idle-union anchoring — sourceSize now = feet-anchored box; verified via e2e screenshots (boars + probe planted on ground line).
- `avatarSize` now real PNG dims (was hardcoded 512×512).
- Dead `pivot` registry field removed (manifest retains provenance).

## Decision basis

Quick mode only; no production repair performed under QA boundary beyond registry/test hardening listed above (pre-QA fixes excluded). Verified path: type-check clean; `enemyArtReskin` 8/8; focused suite 61/61 earlier; e2e combat-idle-motion-capture 1/1 (~1.9m) with authored idle/attack/death + clean destruction observed live.
