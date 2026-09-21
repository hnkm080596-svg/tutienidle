# QA Quick — Queue stands (battle-slot look + idle art) for Tran Phap queue

Date: 2026-09-13 · Branch: `feat/queue-stand` · Scope: `TranPhapPanel.vue`, new `AtlasIdleSprite.vue`, tests
Verdict: **PASS WITH GAPS** (P14 visual deferred to post-merge browser check)

## Request

"hàng chờ cũng có slot có góc nhìn như trong trận — nhân vật art đứng trên slot + idle đợi kéo thả."

## Change

- Queue cards are no longer item-slots (`SlotView`). Each card is a
  `.queue-stand`: trapezoid `.queue-stand__base` (clip-path polygon, same
  enabled fill as battlefield cells, fx-border-beam `--clip` variant) +
  `.queue-stand__art` anchored feet-on-base + name caption.
- Player: `<img>` of the entity-derived profile `combatTextureUrl` —
  matches combat (player art is a static texture there too).
- Companions: `AtlasIdleSprite` — DOM canvas frame-stepper replaying the
  SAME placeholder atlas the preview scene plays (`combat-anim-32frame`,
  32 frames @ 8fps, trimmed-rect aware, shared fetch/Image cache,
  `prefers-reduced-motion` static, fail → `display:none` not throw).
- Drag/drop contract unchanged: `.tran-phap-panel__card` class, dragstart
  dataTransfer payload, caption text — e2e `standing-slot-panel.spec.ts`
  selectors still hold. Tooltip preserved via `v-tooltip`.

## Evidence

- `TranPhapPanel.test.ts` — 5/5: player stand = base + profile PNG;
  companion stand = base + idle canvas + id caption; commit/reject/
  resync unchanged.
- `AtlasIdleSprite.test.ts` — 2/2: mounts canvas, load-fail degrades.
- `vue-tsc --build` clean · `npm run build` green.

## Gaps / deferred

- **P14 deferred (isolated worktree):** verify on real browser — trapezoid
  silhouette + art standing on base + companion idle stepping + beam on
  card hover + drag ghost appearance.
- Atlas frame-range knowledge (32 frames = the idle loop) is read from the
  same catalogue constants the scene uses — no duplicated magic numbers.
- If atlas fetch fails, companion stand shows base + label only (degrade,
  not blank card).
