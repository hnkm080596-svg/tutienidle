# Hỗn Độn Trận Visual Test Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-shipped Trận Pháp/Companion Roster mechanism visually verifiable — a global 32-frame numbered placeholder animation (proves `AnimationManager` is actually cycling, not frozen), a "Hỗn Độn Trận" test formation unlocking all 36 local cells, 5 test companions to fill it, and a flat 6×6 Phaser-rendered preview inside `TranPhapPanel.vue`.

**Architecture:** Swap the single shared texture `buildPlaceholderAnimationSet()` points every entity's animation clips at (one PNG, 32 numbered frames, loaded exactly once via existing `sheetKey`-dedup in `queueCombatAssets()`) — zero changes to loading/animation-registration code elsewhere. Add one test-only formation + buff + 5 companions as pure content. Add a small, independent `Phaser.Game` instance embedded in `TranPhapPanel.vue` (same bootstrap pattern as `PhaserCanvas.vue`) that renders a flat, unprojected 6×6 grid + placed sprites; existing HTML5 drag-and-drop markup from Task 20 stays as an invisible overlay on top, untouched.

**Tech Stack:** Vue 3 `<script setup>` + TypeScript + Phaser (dynamic import) + Vitest. Asset generation via the `canvas` npm package (already a devDependency), matching the existing `scripts/generate-vendor-placeholder-art.mjs` precedent.

**Spec:** `docs/superpowers/specs/2026-09-06-hon-don-tran-visual-test-design.md`

## Global Constraints

- TypeScript, no `any`.
- Comments: short English/technical lead-in is fine; the explanatory prose MUST be Vietnamese (house style — two prior tasks this session shipped English-only comments and had to be corrected; read your own comments once more before committing).
- Type-check gate is `npm.cmd run type-check` (`vue-tsc --build`). **NEVER** `npx vue-tsc --noEmit` — it walks zero files in this repo (root `tsconfig.json` is solution-style with `files: []`) and has let type errors ship before.
- Do not touch `game/src/core/battle/legacy/**`.
- Do not touch `game/src/core/battle/EnemySpawnPlacement.ts` or change `resolveEnemySpawnPosition()`'s behavior — confirmed out of scope, existing coverage in `EnemySpawnPlacement.test.ts` must stay green untouched.
- Do not touch `game/src/core/game/BattleLootSystem.ts` — reward-timing is a separate, deferred piece of work.
- Every piece of new content (`hon_don_tran` formation, its test buff, the 5 companions) must be commented as **TEST-ONLY**, clearly distinguishing it from real content, matching how `COMPANIONS`/`TRAN_PHAP_FORMATIONS` are already documented as mechanism-only elsewhere.
- Run every verification command **synchronously in the foreground** — do not background test runs and wait for notifications.
- This is a multi-file feature: work happens in a dedicated worktree via the `using-git-worktrees` skill, convention `.agent-worktrees/hon-don-tran-visual-test`, branch auto-prefixed by the skill.

---

## Task 1: Global 32-frame placeholder spritesheet

**Files:**
- Create: `game/scripts/generate-hon-don-tran-placeholder-art.mjs`
- Create (generated, committed binary): `game/public/assets/characters/placeholder/combat-anim-32frame.png`
- Modify: `game/src/game/support/CombatAnimationSet.ts`
- Modify: `game/src/game/support/CombatAnimationSet.test.ts`

**Interfaces:**
- Produces: `PLACEHOLDER_SHEET_KEY: string`, `PLACEHOLDER_SHEET_URL: string`, `PLACEHOLDER_FRAME_WIDTH/HEIGHT/COUNT/RATE: number` (all exported from `CombatAnimationSet.ts`).
- Modifies behavior of: `buildPlaceholderAnimationSet(entityKey, staticTextureUrl, frameSize?): CombatAnimationSet` — signature UNCHANGED (3 existing call sites in `CombatPreload.ts` keep compiling and calling it exactly as before), but the returned clips' `sheetKey`/`sheetUrl`/`frameWidth`/`frameHeight`/`frameCount` now come from the shared constants above, ignoring the `staticTextureUrl`/`frameSize` arguments. `clip.key` (per-entity, `${entityKey}-${name}`) is unchanged — this is what keeps `CombatScene.ts`'s `registerCombatAnimations()`/`sprite.play()` call sites working with zero changes, since `key` still uniquely identifies each entity's animation even though the underlying texture (`sheetKey`) is now shared.
- Consumes: nothing new. `queueCombatAssets()` (`CombatPreload.ts`) already dedupes texture loads by `sheetKey` (`if (queuedKeys.has(clip.sheetKey) || scene.textures.exists(clip.sheetKey)) continue`) — confirmed by reading the file; sharing one `sheetKey` across every entity means the new asset loads exactly once regardless of how many entities reference it. No change needed to `CombatPreload.ts` or `CombatScene.ts`.

- [ ] **Step 1: Write the failing test**

Replace `game/src/game/support/CombatAnimationSet.test.ts` entirely — the old tests assert the *previous* per-entity-reuse behavior and must be rewritten, not extended:

```ts
import { describe, expect, it } from 'vitest'
import {
  buildPlaceholderAnimationSet,
  PLACEHOLDER_SHEET_KEY,
  PLACEHOLDER_SHEET_URL,
  PLACEHOLDER_FRAME_WIDTH,
  PLACEHOLDER_FRAME_HEIGHT,
  PLACEHOLDER_FRAME_COUNT,
  type CombatAnimationName,
} from './CombatAnimationSet'

describe('buildPlaceholderAnimationSet', () => {
  it('every clip points at the SHARED 32-frame placeholder sheet, regardless of caller-provided url/size', () => {
    const set = buildPlaceholderAnimationSet('player-mortal', '/some/other/static-image.png', { width: 999, height: 999 })

    const names: CombatAnimationName[] = ['idle', 'ready', 'cast', 'standby', 'death']

    for (const name of names) {
      const clip = set[name]

      expect(clip.sheetKey).toBe(PLACEHOLDER_SHEET_KEY)
      expect(clip.sheetUrl).toBe(PLACEHOLDER_SHEET_URL)
      expect(clip.frameWidth).toBe(PLACEHOLDER_FRAME_WIDTH)
      expect(clip.frameHeight).toBe(PLACEHOLDER_FRAME_HEIGHT)
      expect(clip.frameCount).toBe(PLACEHOLDER_FRAME_COUNT)
      // key vẫn per-entity — CombatScene.ts cần key riêng để play() đúng
      // entity dù texture nguồn (sheetKey) dùng chung.
      expect(clip.key).toBe(`player-mortal-${name}`)
    }
  })

  it('two different entities share the exact same sheetKey (one texture load for both)', () => {
    const playerSet = buildPlaceholderAnimationSet('player-mortal', '/a.png')
    const enemySet = buildPlaceholderAnimationSet('enemy-wolf', '/b.png')

    expect(playerSet.idle.sheetKey).toBe(enemySet.idle.sheetKey)
  })

  it('cast/death play once (repeat: 0), idle/ready/standby loop (repeat: -1)', () => {
    const set = buildPlaceholderAnimationSet('enemy-wolf', '/assets/enemies/wolf.png')

    expect(set.idle.repeat).toBe(-1)
    expect(set.ready.repeat).toBe(-1)
    expect(set.standby.repeat).toBe(-1)
    expect(set.cast.repeat).toBe(0)
    expect(set.death.repeat).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run CombatAnimationSet.test.ts`
Expected: FAIL — `PLACEHOLDER_SHEET_KEY` etc. don't exist yet, and the old function still returns per-entity `sheetUrl`/`frameCount: 1`.

- [ ] **Step 3: Generate the placeholder asset**

Create `game/scripts/generate-hon-don-tran-placeholder-art.mjs` (mirror the header/structure of the existing `game/scripts/generate-vendor-placeholder-art.mjs` precedent — same `canvas` import, same `mkdirSync`+`writeFileSync` pattern):

```js
// Hỗn Độn Trận visual test tooling (2026-09-06) — placeholder spritesheet
// 32-frame DÙNG CHUNG cho MỌI entity combat (player/enemy/companion, kể cả
// trận đấu thật), thay thế việc mỗi entity tái dùng ảnh tĩnh của chính nó
// làm "sheet" 1-frame. Mỗi frame là 1 thân người cách điệu + số thứ tự lớn
// (0-31) — nhìn là biết ngay AnimationManager có thực sự chạy hay bị đứng
// (đúng lớp bug freeze 2026-09-05, chỉ khác là ở animation thay vì tick
// loop). Xoá/ghi đè trực tiếp khi có content thật, không cần sửa code nơi
// khác (chỉ cần đổi hằng số trong CombatAnimationSet.ts).
import { createCanvas } from 'canvas'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const FRAME_WIDTH = 200
const FRAME_HEIGHT = 350
const FRAME_COUNT = 32

const OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../public/assets/characters/placeholder',
)

mkdirSync(OUT_DIR, { recursive: true })

const canvas = createCanvas(FRAME_WIDTH, FRAME_HEIGHT * FRAME_COUNT)
const ctx = canvas.getContext('2d')

for (let frame = 0; frame < FRAME_COUNT; frame++) {
  const top = frame * FRAME_HEIGHT

  // Hue xoay theo frame — thêm 1 tín hiệu trực quan phụ (không chỉ số) để
  // nhận ra animation đang chạy ngay cả khi không đọc kịp số.
  const hue = Math.round((frame / FRAME_COUNT) * 360)

  ctx.fillStyle = `hsl(${hue}, 55%, 45%)`
  ctx.fillRect(0, top, FRAME_WIDTH, FRAME_HEIGHT)

  // Thân người cách điệu: đầu tròn + thân chữ nhật bo góc, để rõ đây là
  // "nhân vật đứng" chứ không phải khối màu vô nghĩa.
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.arc(FRAME_WIDTH / 2, top + FRAME_HEIGHT * 0.18, FRAME_WIDTH * 0.16, 0, Math.PI * 2)
  ctx.fill()

  const bodyX = FRAME_WIDTH * 0.28
  const bodyY = top + FRAME_HEIGHT * 0.32
  const bodyW = FRAME_WIDTH * 0.44
  const bodyH = FRAME_HEIGHT * 0.56
  const radius = FRAME_WIDTH * 0.08

  ctx.beginPath()
  ctx.roundRect(bodyX, bodyY, bodyW, bodyH, radius)
  ctx.fill()

  // Số thứ tự — tín hiệu chính để test animation, to và tương phản cao.
  ctx.fillStyle = '#111111'
  ctx.font = `bold ${Math.round(FRAME_HEIGHT * 0.22)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(frame), FRAME_WIDTH / 2, top + FRAME_HEIGHT / 2)
}

writeFileSync(path.join(OUT_DIR, 'combat-anim-32frame.png'), canvas.toBuffer('image/png'))

console.log(`Hỗn Độn Trận placeholder spritesheet written to ${OUT_DIR}/combat-anim-32frame.png (${FRAME_WIDTH}x${FRAME_HEIGHT * FRAME_COUNT}, ${FRAME_COUNT} frames)`)
```

Run it: `node scripts/generate-hon-don-tran-placeholder-art.mjs` (from `game/`). Confirm the file exists and its dimensions are `200 × 11200` (200 × 350 × 32) — check with any available tool (e.g. `node -e "const {createCanvas,loadImage}=require('canvas'); loadImage('public/assets/characters/placeholder/combat-anim-32frame.png').then(img=>console.log(img.width,img.height))"`).

- [ ] **Step 4: Implement `CombatAnimationSet.ts` changes**

Read the current file first (header comment needs updating too — it currently claims "reuses an entity's existing static PNG", which stops being true). Add the shared constants near the top, after `ALL_NAMES`:

```ts
// Hỗn Độn Trận visual test tooling (2026-09-06) — sheet placeholder DUY
// NHẤT dùng chung cho mọi entity (sinh bởi
// scripts/generate-hon-don-tran-placeholder-art.mjs). sheetKey CHIA SẺ
// giữa mọi entity/clip (khác `key`, vẫn per-entity) — queueCombatAssets()
// (CombatPreload.ts) đã dedupe theo sheetKey nên texture chỉ tải 1 LẦN
// DUY NHẤT dù hàng chục entity cùng dùng, không cần sửa gì ở đó. Khi có
// content thật, chỉ cần đổi các hằng số này — không đụng consumer nào.
export const PLACEHOLDER_SHEET_KEY = 'combat-placeholder-32frame-sheet'
export const PLACEHOLDER_SHEET_URL = 'assets/characters/placeholder/combat-anim-32frame.png'
export const PLACEHOLDER_FRAME_WIDTH = 200
export const PLACEHOLDER_FRAME_HEIGHT = 350
export const PLACEHOLDER_FRAME_COUNT = 32
export const PLACEHOLDER_FRAME_RATE = 8
```

Rewrite `buildPlaceholderAnimationSet()`'s body (keep the signature exactly the same — 3rd param becomes unused, prefix it `_frameSize` matching this codebase's existing convention for a deliberately-unused-but-signature-preserved param, see `registerCombatAnimations(_entityKey, ...)` in `CombatScene.ts`):

```ts
export function buildPlaceholderAnimationSet(
  entityKey: string,
  _staticTextureUrl: string,
  _frameSize: { width: number; height: number } = { width: 256, height: 256 },
): CombatAnimationSet {
  const entries = ALL_NAMES.map((name) => {
    const clip: CombatAnimationClip = {
      key: combatAnimationKey(entityKey, name),
      sheetKey: PLACEHOLDER_SHEET_KEY,
      sheetUrl: PLACEHOLDER_SHEET_URL,
      frameWidth: PLACEHOLDER_FRAME_WIDTH,
      frameHeight: PLACEHOLDER_FRAME_HEIGHT,
      frameCount: PLACEHOLDER_FRAME_COUNT,
      frameRate: PLACEHOLDER_FRAME_RATE,
      repeat: LOOPING_NAMES.includes(name) ? -1 : 0,
    }

    return [name, clip] as const
  })

  return Object.fromEntries(entries) as CombatAnimationSet
}
```

Update the file's header comment to describe the new reality (shared 32-frame sheet, not per-entity 1-frame reuse).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run CombatAnimationSet.test.ts`
Expected: PASS.

- [ ] **Step 6: Full regression**

Run: `npm.cmd run type-check` (must be clean — `_staticTextureUrl`/`_frameSize` unused-param rename must not break any caller relying on the old param names via destructuring, which none do based on the 3 real call sites in `CombatPreload.ts` — they pass positional args).
Run: `npx vitest run` (full suite, no filter) — confirm nothing else broke. `EnemyArt.ts`/`PlayerVisualProfiles.ts`-adjacent tests that assert texture *dimensions* for the plain-image keys (not the animation sheet) are unaffected since this task never touches those.

- [ ] **Step 7: Commit**

```bash
git add game/scripts/generate-hon-don-tran-placeholder-art.mjs game/public/assets/characters/placeholder/combat-anim-32frame.png game/src/game/support/CombatAnimationSet.ts game/src/game/support/CombatAnimationSet.test.ts
git commit -m "feat(hon-don-tran-test): global 32-frame numbered placeholder spritesheet"
```

## Task 2: Hỗn Độn Trận test buff + formation

**Files:**
- Modify: `game/src/data/buff/buffs.ts`
- Modify: `game/src/data/formation/TranPhap.ts`
- Modify: `game/src/data/formation/TranPhap.test.ts`

**Interfaces:**
- Consumes: `BuffDefinition` (`game/src/core/buff/BuffDefinition.ts`), `TranPhapDefinition`/`TranPhapCell` (Task 16, already shipped).
- Produces: 1 new entry in `buffs: BuffDefinition[]` (id `hon_don_tran_test_buff`), 1 new entry in `TRAN_PHAP_FORMATIONS` (id `hon_don_tran`) whose `cellPattern` covers all 36 cells of the local 0–5×0–5 space.

- [ ] **Step 1: Write the failing test**

Add to `game/src/data/formation/TranPhap.test.ts`:

```ts
describe('hon_don_tran (TEST-ONLY stress-test formation)', () => {
  it('unlocks all 36 cells of the local 6x6 space, each exactly once', () => {
    const formation = TRAN_PHAP_FORMATIONS.find((f) => f.id === 'hon_don_tran')

    expect(formation).toBeDefined()
    expect(formation!.cellPattern).toHaveLength(36)

    const seen = new Set(formation!.cellPattern.map((cell) => `${cell.row},${cell.column}`))

    expect(seen.size).toBe(36)

    for (let row = 0; row <= 5; row++) {
      for (let column = 0; column <= 5; column++) {
        expect(seen.has(`${row},${column}`)).toBe(true)
      }
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run TranPhap.test.ts`
Expected: FAIL — `hon_don_tran` not found (`formation` is `undefined`).

- [ ] **Step 3: Add the test buff**

Read `game/src/data/buff/buffs.ts`'s existing entries first for exact formatting conventions (import block, array structure). Add a new `BuffDefinition` to the `buffs` array (any position, e.g. near the top alongside other simple entries):

```ts
// Hỗn Độn Trận visual test tooling (2026-09-06) — buff TEST-ONLY, vô hại
// (+1% attack, gần như không ảnh hưởng cân bằng), tồn tại DUY NHẤT để
// formation test hon_don_tran có 1 buff.definitionId resolve được thật
// trong TURN_BUFF_REGISTRY thay vì luôn rơi vào nhánh skip-an-toàn (Task
// 19's fix) — xoá khi có buff Trận Pháp thật thay thế.
const HON_DON_TRAN_TEST_BUFF: BuffDefinition = {
  id: 'hon_don_tran_test_buff',
  name: 'Hỗn Độn Khí Tức (test)',
  description: 'Buff test-only của Hỗn Độn Trận — không dùng cho nội dung thật.',
  polarity: 'buff',
  duration: Infinity,
  stackMode: 'refresh',
  effects: [{ type: 'statModifier', stat: 'attack', percent: 1 }],
}
```

Add `HON_DON_TRAN_TEST_BUFF` to the exported `buffs` array.

- [ ] **Step 4: Add the formation**

In `game/src/data/formation/TranPhap.ts`, add a helper + the formation entry:

```ts
// Hỗn Độn Trận (2026-09-06, visual test tooling) — TEST-ONLY: mở toàn bộ
// 36 ô của lưới cục bộ 6x6, dùng để test panel/wiring khi chưa có nội
// dung Trận Pháp thật. Xoá khi có formation thật đầu tiên thay thế vai
// trò "stress-test mọi ô" này.
function allLocalCells(): TranPhapCell[] {
  const cells: TranPhapCell[] = []

  for (let row = 0; row <= 5; row++) {
    for (let column = 0; column <= 5; column++) {
      cells.push({ row, column })
    }
  }

  return cells
}

const HON_DON_TRAN: TranPhapDefinition = {
  id: 'hon_don_tran',
  name: 'Hỗn Độn Trận',
  cellPattern: allLocalCells(),
  buff: { definitionId: 'hon_don_tran_test_buff' },
  description: 'TEST-ONLY — mở toàn bộ 36 ô để kiểm tra wiring đội hình.',
}
```

Add `HON_DON_TRAN` to `TRAN_PHAP_FORMATIONS`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run TranPhap.test.ts`
Expected: PASS. Also re-run the pre-existing `'every formation cell is within the local 6x6 pattern space (0-5)'`/`'every formation id is unique'` tests in the same file — must still pass (they iterate `TRAN_PHAP_FORMATIONS` generically, so `hon_don_tran` is automatically covered).

- [ ] **Step 6: Full regression**

Run: `npm.cmd run type-check` + `npx vitest run` (full, no filter) — both clean. Specifically confirm `buffs.test.ts` (if it exists — check via Glob first) and anything asserting a fixed count of `buffs`/`LIVE_BUFFS` doesn't hardcode a stale count.

- [ ] **Step 7: Commit**

```bash
git add game/src/data/buff/buffs.ts game/src/data/formation/TranPhap.ts game/src/data/formation/TranPhap.test.ts
git commit -m "feat(hon-don-tran-test): add hon_don_tran stress-test formation + its test buff"
```

## Task 3: Five test-only companions

**Files:**
- Modify: `game/src/data/companion/Companions.ts`
- Modify: `game/src/data/companion/Companions.test.ts`

**Interfaces:**
- Consumes: `CompanionDefinition`/`CompanionBaseStats` (Task 10, already shipped), `TurnSkillDefinition` (`game/src/core/battle/turn/TurnSkillAction.ts`, confirmed shape: `{ id, cooldownTurns, damage: { kind, multiplier }, targeting: { shape } }`).
- Produces: 5 new entries in `COMPANIONS`, ids `test_companion_1` through `test_companion_5`.

- [ ] **Step 1: Write the failing test**

Add to `game/src/data/companion/Companions.test.ts`:

```ts
describe('TEST-ONLY placeholder companions (Hỗn Độn Trận visual test tooling)', () => {
  it('has at least 5 test companions, each with a valid grade and basic skill', () => {
    const testCompanions = COMPANIONS.filter((c) => c.id.startsWith('test_companion_'))

    expect(testCompanions.length).toBeGreaterThanOrEqual(5)

    for (const companion of testCompanions) {
      expect(ITEM_GRADE_ORDER).toContain(companion.grade)
      expect(companion.basic.id).toBeTruthy()
    }
  })
})
```

(`ITEM_GRADE_ORDER` is already imported in this test file per Task 10 — confirm the import exists, add it if the existing test doesn't already import it.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run Companions.test.ts`
Expected: FAIL — `testCompanions.length` is `0`.

- [ ] **Step 3: Implement**

In `game/src/data/companion/Companions.ts`, add 5 entries to `COMPANIONS` (currently `[]`):

```ts
// 5 companion TEST-ONLY (2026-09-06, visual test tooling) — chỉ để
// TranPhapPanel.vue có đủ quân lấp lưới 36 ô của hon_don_tran khi test.
// Chỉ số/tên tạm bợ, dùng art placeholder chung (không có combatTextureKey
// riêng — companionToCombatEntity()/render layer tự fallback về
// placeholder animation set theo id). Xoá khi có roster thật.
const TEST_COMPANION_BASE_STATS: CompanionBaseStats = { maxHp: 100, attack: 10, speed: 100 }

function testCompanionBasicSkill(id: string): TurnSkillDefinition {
  return {
    id: `${id}_basic`,
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  }
}

const TEST_COMPANIONS: CompanionDefinition[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `test_companion_${n}`,
  name: `Test Companion ${n}`,
  grade: 'hoang',
  baseStats: TEST_COMPANION_BASE_STATS,
  basic: testCompanionBasicSkill(`test_companion_${n}`),
}))
```

Spread `...TEST_COMPANIONS` into the `COMPANIONS` array.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run Companions.test.ts`
Expected: PASS. Also re-run the pre-existing `'every companion id is unique'` test — must still pass.

- [ ] **Step 5: Full regression**

Run: `npm.cmd run type-check` + `npx vitest run` (full, no filter).

- [ ] **Step 6: Commit**

```bash
git add game/src/data/companion/Companions.ts game/src/data/companion/Companions.test.ts
git commit -m "feat(hon-don-tran-test): 5 test-only companions to populate the Hỗn Độn Trận stress test"
```

## Task 4: `TranPhapPreviewScene` — flat 6×6 Phaser grid renderer

**Files:**
- Create: `game/src/game/scenes/TranPhapPreviewScene.ts`
- Create: `game/src/game/scenes/TranPhapPreviewScene.test.ts`

**Interfaces:**
- Consumes: `PLACEHOLDER_SHEET_KEY`/`PLACEHOLDER_SHEET_URL`/`PLACEHOLDER_FRAME_WIDTH`/`PLACEHOLDER_FRAME_HEIGHT`/`PLACEHOLDER_FRAME_COUNT`/`PLACEHOLDER_FRAME_RATE` (Task 1), `FormationSlotAssignment` (`game/src/core/player/Player.ts`, Task 17).
- Produces: `PREVIEW_CELL_SIZE: number`, `previewCellTopLeft(row: number, column: number): { x: number; y: number }` (pure, unit-tested directly), `class TranPhapPreviewScene extends Phaser.Scene` with a public `syncAssignments(assignments: FormationSlotAssignment[]): void` method.

- [ ] **Step 1: Write the failing test (pure helper only — Phaser scene itself is not unit-testable without a WebGL/canvas context)**

```ts
import { describe, expect, it } from 'vitest'
import { PREVIEW_CELL_SIZE, previewCellTopLeft } from './TranPhapPreviewScene'

describe('previewCellTopLeft', () => {
  it('maps local (0,0) to the pixel origin', () => {
    expect(previewCellTopLeft(0, 0)).toEqual({ x: 0, y: 0 })
  })

  it('maps local (5,5) to the bottom-right cell, offset by 5 full cells', () => {
    expect(previewCellTopLeft(5, 5)).toEqual({ x: 5 * PREVIEW_CELL_SIZE, y: 5 * PREVIEW_CELL_SIZE })
  })

  it('row drives y, column drives x (not swapped)', () => {
    expect(previewCellTopLeft(1, 0)).toEqual({ x: 0, y: PREVIEW_CELL_SIZE })
    expect(previewCellTopLeft(0, 1)).toEqual({ x: PREVIEW_CELL_SIZE, y: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run TranPhapPreviewScene.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Read `game/src/components/game/PhaserCanvas.vue`'s `new Phaser.Game({...})` config once for the exact convention this codebase uses (`type: Phaser.AUTO`, `transparent: true`, `render: { roundPixels: true }`) before writing this — match it, since Task 5 will embed this scene the same way.

```ts
// TranPhapPreviewScene (Hỗn Độn Trận visual test tooling, 2026-09-06) —
// scene Phaser RIÊNG, độc lập hoàn toàn với CombatScene/MainScene thật
// (Phaser.Game riêng, TextureManager riêng — không có nguy cơ đụng key
// dù dùng lại ĐÚNG PLACEHOLDER_SHEET_KEY, vì đó là 1 Phaser.Game khác).
// Vẽ lưới 6x6 PHẲNG (không phối cảnh, không tái dùng
// BattleGridProjection.ts — quyết định thiết kế rõ ràng, xem spec
// 2026-09-06-hon-don-tran-visual-test-design.md §Non-Goals) + 1 layer
// background dự phòng cho art thật sau này + sprite animate tại từng ô
// đã gán trong TranPhapPanel.vue. Tương tác kéo-thả KHÔNG nằm ở đây —
// canvas này thuần hiển thị, overlay HTML trong suốt (Task 20, không
// đổi) mới là drop target thật.
import Phaser from 'phaser'
import {
  PLACEHOLDER_SHEET_KEY,
  PLACEHOLDER_SHEET_URL,
  PLACEHOLDER_FRAME_WIDTH,
  PLACEHOLDER_FRAME_HEIGHT,
  PLACEHOLDER_FRAME_COUNT,
  PLACEHOLDER_FRAME_RATE,
} from '@/game/support/CombatAnimationSet'
import type { FormationSlotAssignment } from '@/core/player/Player'

export const PREVIEW_CELL_SIZE = 64
export const PREVIEW_GRID_SIZE = 6

const PREVIEW_IDLE_ANIMATION_KEY = 'tran-phap-preview-idle'

export function previewCellTopLeft(row: number, column: number): { x: number; y: number } {
  return { x: column * PREVIEW_CELL_SIZE, y: row * PREVIEW_CELL_SIZE }
}

export class TranPhapPreviewScene extends Phaser.Scene {
  private sprites: Phaser.GameObjects.Sprite[] = []

  constructor() {
    super('TranPhapPreviewScene')
  }

  preload(): void {
    this.load.spritesheet(PLACEHOLDER_SHEET_KEY, PLACEHOLDER_SHEET_URL, {
      frameWidth: PLACEHOLDER_FRAME_WIDTH,
      frameHeight: PLACEHOLDER_FRAME_HEIGHT,
    })
  }

  create(): void {
    // Layer background — hiện tại chỉ 1 màu phẳng, để dành gắn ảnh thật
    // sau này (spec §4) mà không cần đổi cấu trúc scene.
    this.add
      .rectangle(0, 0, PREVIEW_CELL_SIZE * PREVIEW_GRID_SIZE, PREVIEW_CELL_SIZE * PREVIEW_GRID_SIZE, 0x1a1a1a)
      .setOrigin(0, 0)

    const grid = this.add.graphics()

    grid.lineStyle(1, 0x4caf50, 0.6)

    for (let i = 0; i <= PREVIEW_GRID_SIZE; i++) {
      grid.lineBetween(0, i * PREVIEW_CELL_SIZE, PREVIEW_CELL_SIZE * PREVIEW_GRID_SIZE, i * PREVIEW_CELL_SIZE)
      grid.lineBetween(i * PREVIEW_CELL_SIZE, 0, i * PREVIEW_CELL_SIZE, PREVIEW_CELL_SIZE * PREVIEW_GRID_SIZE)
    }

    if (!this.anims.exists(PREVIEW_IDLE_ANIMATION_KEY)) {
      this.anims.create({
        key: PREVIEW_IDLE_ANIMATION_KEY,
        frames: this.anims.generateFrameNumbers(PLACEHOLDER_SHEET_KEY, { start: 0, end: PLACEHOLDER_FRAME_COUNT - 1 }),
        frameRate: PLACEHOLDER_FRAME_RATE,
        repeat: -1,
      })
    }
  }

  /** Xoá hết sprite cũ, dựng lại đúng theo assignment hiện tại — đơn giản, đủ dùng cho panel test (không cần diff tối ưu như combat thật). */
  syncAssignments(assignments: FormationSlotAssignment[]): void {
    for (const sprite of this.sprites) {
      sprite.destroy()
    }

    this.sprites = assignments.map((assignment) => {
      const { x, y } = previewCellTopLeft(assignment.row, assignment.column)

      const sprite = this.add.sprite(x + PREVIEW_CELL_SIZE / 2, y + PREVIEW_CELL_SIZE / 2, PLACEHOLDER_SHEET_KEY)

      sprite.setDisplaySize(PREVIEW_CELL_SIZE * 0.8, PREVIEW_CELL_SIZE * 0.8)
      sprite.play(PREVIEW_IDLE_ANIMATION_KEY)

      return sprite
    })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run TranPhapPreviewScene.test.ts`
Expected: PASS.

- [ ] **Step 5: Full regression**

Run: `npm.cmd run type-check` + `npx vitest run` (full, no filter).

- [ ] **Step 6: Commit**

```bash
git add game/src/game/scenes/TranPhapPreviewScene.ts game/src/game/scenes/TranPhapPreviewScene.test.ts
git commit -m "feat(hon-don-tran-test): TranPhapPreviewScene - flat 6x6 Phaser grid renderer"
```

## Task 5: Wire `TranPhapPreviewScene` into `TranPhapPanel.vue`

**Files:**
- Modify: `game/src/components/panels/TranPhapPanel.vue`

**Interfaces:**
- Consumes: `TranPhapPreviewScene` (Task 4), `PREVIEW_CELL_SIZE`/`PREVIEW_GRID_SIZE` (Task 4).

**Context you must read before writing this task:** `game/src/components/game/PhaserCanvas.vue`'s `onMounted`/`onUnmounted` (dynamic `import('phaser')`, `new Phaser.Game({...})`, `game?.destroy(true)`) is the reference bootstrap pattern. **Important difference here:** `OverlayPanel.vue`'s template is `<div v-if="open">...<slot/></div>` — the container `<div ref>` for the Phaser canvas lives inside that slot, so it only exists in the DOM while the panel is open. `TranPhapPanel.vue`'s own `onMounted` fires once (when the panel component first mounts into `GameRoot.vue`, at game boot) — it does **not** re-fire each time the overlay opens/closes. This means the Phaser game must be created/destroyed from a **watcher** on `ui.standalonePanel === 'tran_phap'`, not from `onMounted`/`onUnmounted` alone.

- [ ] **Step 1: Manual verification is the only meaningful check here (Phaser + DOM, no unit test)**

State up front in the implementation report that Step 4 (`npm run dev`, open the panel, confirm the grid renders, drag a card in, confirm a sprite appears and animates, close and reopen, confirm no console errors / no duplicate `Phaser.Game` warnings) is deferred to the final verification task (Task 6) where a real dev server + Playwright pass happens — this task's own commit gate is type-check + full suite green (no visual regression possible to unit-test for a Phaser canvas), consistent with how Task 20 handled the same limitation.

- [ ] **Step 2: Implement**

Read the current `TranPhapPanel.vue` in full first (Task 20 already shipped it) — modify only the `<script setup>` additions and the grid section of the template; the drag-and-drop logic (`onDrop`/`onDragStart`/`isLitCell`/`assignmentAt`/`combatantCards`/`onSelectFormation`/`onConfirm`/`close`) stays **exactly as-is**.

Add to `<script setup>`:

```ts
import { onUnmounted, watch } from 'vue'
import { PREVIEW_CELL_SIZE, PREVIEW_GRID_SIZE } from '@/game/scenes/TranPhapPreviewScene'
// (giữ nguyên các import đã có)

const previewContainerRef = ref<HTMLDivElement | null>(null)

let previewGame: Phaser.Game | null = null
let previewScene: import('@/game/scenes/TranPhapPreviewScene').TranPhapPreviewScene | null = null

// Bootstrap Phaser CHỈ khi panel thật sự mở — container ref (bên trong
// slot của OverlayPanel) chỉ tồn tại trong DOM lúc `open`, nên onMounted
// của CHÍNH component này (chạy 1 lần lúc GameRoot boot) không đủ — phải
// theo dõi bằng watch(), { flush: 'post' } để containerRef.value chắc
// chắn đã có sau khi DOM cập nhật.
watch(
  () => ui.standalonePanel === 'tran_phap',
  async (isOpen) => {
    if (isOpen) {
      const container = previewContainerRef.value

      if (!container) {
        return
      }

      const [{ default: Phaser }, { TranPhapPreviewScene }] = await Promise.all([
        import('phaser'),
        import('@/game/scenes/TranPhapPreviewScene'),
      ])

      // Panel có thể đã đóng lại trong lúc 2 dynamic import trên đang
      // chạy (đóng rất nhanh) — kiểm tra lại trước khi tạo Game để
      // tránh Game mồ côi không ai destroy.
      if (ui.standalonePanel !== 'tran_phap' || !previewContainerRef.value) {
        return
      }

      previewGame = new Phaser.Game({
        type: Phaser.AUTO,
        parent: previewContainerRef.value,
        width: PREVIEW_CELL_SIZE * PREVIEW_GRID_SIZE,
        height: PREVIEW_CELL_SIZE * PREVIEW_GRID_SIZE,
        transparent: true,
        scene: [TranPhapPreviewScene],
      })

      previewGame.events.once('ready', () => {
        previewScene = previewGame?.scene.getScene('TranPhapPreviewScene') as InstanceType<typeof TranPhapPreviewScene> | null
        previewScene?.syncAssignments(currentAssignments.value)
      })
    } else {
      previewGame?.destroy(true)
      previewGame = null
      previewScene = null
    }
  },
)

// Đồng bộ sprite mỗi khi assignment đổi (kéo-thả) trong lúc panel đang mở.
watch(currentAssignments, (assignments) => {
  previewScene?.syncAssignments(assignments)
})

onUnmounted(() => {
  previewGame?.destroy(true)
  previewGame = null
  previewScene = null
})
```

In the template, replace the pure-CSS grid cells' inner content (keep the `<div>` overlay structure, `@dragover`/`@drop` handlers, and `isLitCell`/`assignmentAt` bindings exactly as they are — this is the drop-target overlay, untouched) by adding the Phaser container **underneath** it, absolutely positioned to exactly overlap:

```html
<div class="tran-phap-panel__grid-stack">
  <div ref="previewContainerRef" class="tran-phap-panel__preview-canvas"></div>

  <div class="tran-phap-panel__grid tran-phap-panel__grid--overlay">
    <!-- existing row/column v-for, @dragover.prevent, @drop, isLitCell class binding — UNCHANGED -->
  </div>
</div>
```

Add to `<style scoped>`:

```css
.tran-phap-panel__grid-stack {
  position: relative;
}

.tran-phap-panel__preview-canvas {
  position: absolute;
  inset: 0;
}

.tran-phap-panel__grid--overlay {
  position: relative;
  /* Ô vẫn giữ background/border cũ để vẫn thấy rõ vùng lit khi kéo-thả —
     Phaser canvas vẽ NGAY BÊN DƯỚI, không che overlay tương tác. */
}
```

(Adjust exact class names to match whatever the real file currently uses — read it fresh, this is describing the *shape* of the change, not a literal patch.)

- [ ] **Step 3: Type-check + full regression**

Run: `npm.cmd run type-check` + `npx vitest run` (full, no filter) — both clean. No new unit test is expected to fail or pass here (nothing new is programmatically assertable without a live Phaser context); confirm this task introduced zero regressions in the existing suite.

- [ ] **Step 4: Commit**

```bash
git add game/src/components/panels/TranPhapPanel.vue
git commit -m "feat(hon-don-tran-test): embed TranPhapPreviewScene into TranPhapPanel.vue (flat 6x6, HTML drag-drop overlay unchanged)"
```

## Task 6: Final verification + roadmap update

- [ ] Run `npx vitest run` — full suite green, confirm test count grew by exactly the new tests added in Tasks 1–4 (no unrelated file changed test counts).
- [ ] Run `npm.cmd run type-check` — zero errors.
- [ ] Run `npx vitest run EnemySpawnPlacement.test.ts` explicitly and diff `git status` on `game/src/core/battle/EnemySpawnPlacement.ts` — confirm the file is untouched (`git diff` empty) and its existing test suite is unmodified and green, proving the Non-Goal ("enemy spawn behavior unchanged") held.
- [ ] Playwright manual pass (this is the first real visual confirmation possible for this whole feature): `npm run dev`, open the Trận Pháp panel (via the `formation_slot` command-wheel entry, Task 20), select "Hỗn Độn Trận", confirm all 36 cells are lit/droppable, drag several of the 5 test companions plus the player card in, confirm sprites appear at their cells and visibly animate (frame number cycling 0→31), confirm no console errors, close and reopen the panel once to confirm no duplicate-`Phaser.Game`/leaked-canvas issues.
- [ ] Start one real battle (any stage) and confirm the real `CombatScene` now also shows the numbered placeholder animation instead of a frozen static image — this is the intended, confirmed side effect of Task 1's global swap; note it explicitly in the roadmap so nobody mistakes it for a regression later.
- [ ] Update `game/docs/roadmap.md` with a section noting this tooling shipped: what it's for (visual verification of Trận Pháp/Companion Roster mechanism), that `hon_don_tran`/the 5 test companions/the test buff are explicitly TEST-ONLY and expected to be removed or superseded once real content ships, and that the global placeholder swap affects real combat too (until real art lands).
- [ ] **Asset Manifest decision:** this project's convention requires updating an Asset Manifest tracking Artifact whenever a new PNG path ships. The new `game/public/assets/characters/placeholder/combat-anim-32frame.png` is explicitly TEST-ONLY/temporary (same status as the existing `scripts/generate-vendor-placeholder-art.mjs` precedent, which also did not update the manifest for its placeholder output). Do not update the manifest for this path — note this explicit decision (and the precedent it follows) in the roadmap section above so a future reviewer doesn't treat the omission as an oversight.
- [ ] Commit: `git commit -m "docs: roadmap — Hỗn Độn Trận visual test tooling shipped"`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-06-hon-don-tran-visual-test.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach?
