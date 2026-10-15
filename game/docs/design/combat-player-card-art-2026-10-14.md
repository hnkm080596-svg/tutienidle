# Combat player card art

Checkout: `E:\tutienidle`, app `game`, branch `master`; local edits only, no commit/push.

User reference: `C:\Users\hnkm0\AppData\Local\Temp\codex-clipboard-a16da7c7-0caa-45fe-9fbe-2621ff0c4574.png`.

## Components and assets

Assets are under `game/public/assets/ui/tien-hiep-2026-10/combat/player-card/`:

- `frame-v1.png`: transparent gold meander outer frame, nine-slice via GameCard's optional frameSrc; other cards retain their default frame.
- `avatar-ring-v1.png`: transparent antique gold circular cloud ring; portrait and circular skill SlotViews use the same art vocabulary. Player portrait/icon content remains runtime-owned.
- `meter-frame-v1.png`: transparent gold meter outline. CombatVitalMeter owns track/fill/value geometry, takes read-only percent/text/tone/ward inputs.
- `backdrop-v1.png`: parchment upper band with mountains, dark ink lower texture.

Frame and backdrop live independently of text and gameplay content. CombatPlayerCard consumes existing vitals/resource bridges; TurnCombatSkillBar retains command/cooldown/role authority and hidden ultimate behavior. No invented resource or skill is inserted. Layout anchors in the existing scaled 1440x810 canvas.

The horizontal card anchors at upper right to avoid covering the player's battlefield sprite. At viewport 800x600 the game root was 800x450 at y=75 and the card was fully contained; visual proof saved in `game/docs/qa/combat-player-card-art-small-2026-10-14.png`.

## Built-in imagegen prompts

1. Empty rectangular nine-slice xianxia frame: fine antique gold double border, angular Chinese meander corners, black lacquer only under strokes, fully transparent interior/exterior, straight stretchable edges, no text/portrait/landscape/skills, horizontal 2:1.
2. Circular antique gold portrait ring: fine double rim, black lacquer channel, small golden cloud flourishes lower left/upper right, transparent hole/exterior, no portrait/text/shadow, exact circle.
3. Empty long thin gold health/resource frame: symmetric tapered bevel tips, cloud curls at ends, transparent interior/exterior, no fill/text/icons, stretchable straight edges.
4. Background only: upper 27% aged ivory parchment with ink mountains/temple/amber sun far right; lower 73% near-black lacquer mountain shadows, empty text/content areas, no frame/portrait/UI/text.

Tool: built-in imagegen. Original generated files retained; copied assets live in project.

## Focused evidence

- Type-check passed after the new failure-result test fixture's literal type was corrected.
- Eight focused Vitest files: 101 tests passed (card/slot, body, decompose command/UI/FX helper, i18n parity); no full QA.
- Real combat: avatar/name/HP/three role slots visible, HP changes with battle facts. Screenshot `game/docs/qa/combat-player-card-art-2026-10-14.png`.
- Real Luyện Thể: restored particle stream captured after one Tôi Luyện action, portal rect 1280x720. Screenshot `game/docs/qa/body-pour-restored-2026-10-14.png`.
- Phân Giải/Hóa Luyện shared FX: isolated browser fixture mounts the actual DecomposeFxLayer and queues its real effect, 20 particles observed, portal rect 1280x720. Screenshot `game/docs/qa/decompose-fx-restored-2026-10-14.png`. This verifies rendering without consuming bag materials; no claim of live conversion E2E.
- Repeated mixed command regression: ore 6 + mortal Hồi Linh Thảo 5; first converts ore only, herb remains inert, second returns insufficient_amount without spending, +1 herb re-enables and converts successfully. Capacity rejection remains atomic.

## Root cause and fixes

Body and decompose portals used left/top only with absolute children, giving zero-size clip reference boxes. Fixed inset:0 while retaining viewport coordinates and 16:9 clipping. Body now uses the same reduced-motion preference gateway as other effects.

Bulk decomposition's selectable query previously included stacks yielding zero output. It now uses the authoritative yield threshold; below-minimum stacks are preserved with a visible hint. Commands can return a typed reason so rejection is no longer silent. Existing boolean consumers remain compatible. /6 floor, grade/age factors and materials are unchanged pending separate rulings.

QA status: focused verification only, not aggregate fixed-point/full QA. MP/path-specific resource appearance remains conditional on real character state; live browser account exercised mortal HP-only card.
