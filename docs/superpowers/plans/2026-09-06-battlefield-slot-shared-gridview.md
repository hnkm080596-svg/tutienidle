# Battlefield Slot — Shared CombatGridView Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize `CombatGridView` behind a `CombatGridViewHost` interface so both real combat (`CombatScene`) and the Trận Pháp panel (a new `TranPhapCombatPreviewScene`, replacing the hand-rolled `TranPhapPreviewScene`) render sprites through the exact same code, fixing the animation-reset bug as a side effect and introducing the shared `SlotState` vocabulary.

**Architecture:** Extract an interface capturing everything `CombatGridView` currently reads off `this.scene: CombatScene`. `CombatScene` implements it with zero behavior change (one new one-line method). `CombatGridView`'s constructor takes the interface instead of the concrete class. A new minimal panel scene implements the same interface and drives `CombatGridView` directly instead of duplicating sprite/animation logic by hand.

**Tech Stack:** TypeScript, Phaser 4, Vue 3 `<script setup>`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-battlefield-slot-shared-gridview-design.md`

## Global Constraints

- TypeScript strict, no `any` anywhere.
- Explanatory comments MUST be in Vietnamese (short English technical terms/identifiers as lead-ins only) — this project's house style. Two prior violations this session, so review this closely.
- The ONLY correct type-check gate is `npm.cmd run type-check` (runs `vue-tsc --build`). `npx vue-tsc --noEmit` walks zero files in this repo — NEVER use it.
- `combat-grid-view.ts`, `CombatScene.ts`, and `combat-grid-view.test.ts` are production combat code — every task touching them must run the full existing suite (`npx vitest run`) and confirm zero regressions, not just the new/changed test file.
- No behavior change to real combat's rendering in any task except the one explicit, reviewed addition in Task 2 (`fallbackSpriteTextureKey` branch in `getOrCreateSprite`) — everything else in `combat-grid-view.ts` is a mechanical `this.scene.` → `this.host.` rename plus the five self-referential delegate calls becoming direct `this.` calls.
- Do not touch `EnemySpawnPlacement.ts`, `BattleLootSystem.ts`, or `BattlefieldRegions.ts` — out of scope.
- `TranPhapPanel.vue`'s drag-and-drop interaction code (`onDrop`/`removeAssignment`/click-to-remove/drag-from-cell) is shipped and correct — do not change its logic, only its imports and the new `slotStateAt()` addition (Task 5).

---

### Task 1: `CombatGridViewHost` interface + `CombatScene` conformance

**Files:**
- Create: `game/src/game/scenes/combat/CombatGridViewHost.ts`
- Create: `game/src/game/scenes/combat/CombatGridViewHost.test.ts`
- Modify: `game/src/game/scenes/CombatScene.ts:273` (class declaration only)

**Interfaces:**
- Produces: `CombatGridViewHost` interface, `CombatScene implements CombatGridViewHost` (with new method `fallbackSpriteTextureKey`).
- Consumes: nothing new (uses existing `EntitySprite` from `./combatTypes`, `BattleGridProjection` from `@/game/support/BattleGridProjection`).

- [ ] **Step 1: Write the new file**

```ts
// CombatGridViewHost (Battlefield Slot spec, 2026-09-06) — bề mặt API mà
// CombatGridView cần từ scene chủ của nó. Tách ra để CombatScene (combat
// thật) VÀ TranPhapCombatPreviewScene (panel Trận Pháp) có thể dùng chung
// đúng 1 class CombatGridView thay vì mỗi bên tự viết lại logic sprite/
// animation — xem spec §1.
import type Phaser from 'phaser'
import type { BattleGridProjection } from '@/game/support/BattleGridProjection'
import type { EntitySprite } from './combatTypes'

export interface CombatGridViewHost {
  readonly add: Phaser.GameObjects.GameObjectFactory
  readonly physics: Phaser.Physics.Arcade.ArcadePhysics
  readonly textures: Phaser.Textures.TextureManager
  // resetVisual() only — Phaser.Scene subclass đã có sẵn `tweens`.
  readonly tweens: Phaser.Tweens.TweenManager

  readonly isPerspective: boolean
  readonly projection: BattleGridProjection | undefined
  readonly gridGraphics: Phaser.GameObjects.Graphics | undefined
  readonly usingArtBackdrop: boolean
  readonly arenaRect: Phaser.GameObjects.Rectangle | undefined
  readonly characterWidth: number
  readonly characterHeight: number
  readonly playerSourceSize: { w: number; h: number }
  readonly playerProfile: { combatTextureKey: string }
  readonly sprites: Map<string, EntitySprite>
  // resetVisual() only — host không cần interpolate thật vẫn thoả type
  // bằng 1 Map rỗng (xem TranPhapCombatPreviewScene, Task 4).
  readonly interpolations: Map<string, unknown>
  entityFootMinY: number
  entityFootMaxY: number

  /**
   * Texture key dùng cho sprite khi id không phải PLAYER_ID và không khớp
   * resolveEnemyTextureKey() — combat thật trả undefined (giữ NGUYÊN
   * Rectangle fallback cho enemy ngoài batch Mortal, hành vi hiện tại
   * không đổi); panel Trận Pháp trả về sheet placeholder dùng chung cho
   * mọi combatant.
   */
  fallbackSpriteTextureKey(id: string): string | undefined
}
```

- [ ] **Step 2: Add `implements` + the new method to `CombatScene`**

In `game/src/game/scenes/CombatScene.ts`, add the import:

```ts
import type { CombatGridViewHost } from './combat/CombatGridViewHost'
```

Change line 273 from:

```ts
export class CombatScene extends Phaser.Scene {
```

to:

```ts
export class CombatScene extends Phaser.Scene implements CombatGridViewHost {
```

Add the new method anywhere among the other small public methods (e.g., right after the `entityHeadY` method — search for `entityHeadY(sprite: EntitySprite): number` in `CombatScene.ts` and add directly below its closing brace):

```ts
  // CombatGridViewHost (Battlefield Slot spec §1) — combat thật KHÔNG BAO
  // GIỜ fallback sang texture khác cho enemy ngoài batch Mortal (giữ
  // nguyên Rectangle như trước fix này) — chỉ panel Trận Pháp
  // (TranPhapCombatPreviewScene) override hàm này để trả về sheet
  // placeholder dùng chung.
  fallbackSpriteTextureKey(_id: string): string | undefined {
    return undefined
  }
```

- [ ] **Step 3: Write the failing test**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { CombatGridViewHost } from './CombatGridViewHost'
import { CombatScene } from '../CombatScene'

describe('CombatScene implements CombatGridViewHost', () => {
  it('fallbackSpriteTextureKey() luôn trả undefined — combat thật KHÔNG đổi hành vi Rectangle fallback', () => {
    const scene = Object.create(CombatScene.prototype) as CombatScene

    expect(scene.fallbackSpriteTextureKey('anything')).toBeUndefined()
    expect(scene.fallbackSpriteTextureKey('')).toBeUndefined()
  })

  it('type-check: CombatScene thoả CombatGridViewHost (biên dịch được là đủ chứng minh)', () => {
    const assertHost = (_host: CombatGridViewHost) => {}
    const scene = Object.create(CombatScene.prototype) as CombatScene

    // Không throw ở runtime — mục đích DUY NHẤT của dòng này là buộc
    // TypeScript kiểm tra CombatScene thoả CombatGridViewHost lúc biên dịch.
    expect(() => assertHost(scene)).not.toThrow()
  })
})
```

- [ ] **Step 4: Run test to verify it fails then passes**

Run: `npx vitest run CombatGridViewHost.test.ts`
Expected before Step 2: FAIL (`fallbackSpriteTextureKey` doesn't exist / type error).
Expected after Step 2: PASS.

- [ ] **Step 5: Type-check + full regression**

Run: `npm.cmd run type-check` (must be 0 errors — this is the step that actually proves `CombatScene implements CombatGridViewHost` structurally) + `npx vitest run` (full, no filter) — both green, no regressions.

- [ ] **Step 6: Commit**

```bash
git add game/src/game/scenes/combat/CombatGridViewHost.ts game/src/game/scenes/combat/CombatGridViewHost.test.ts game/src/game/scenes/CombatScene.ts
git commit -m "feat(battlefield-slot): CombatGridViewHost interface + CombatScene conformance"
```

---

### Task 2: `CombatGridView` decoupling (host instead of concrete scene)

**Files:**
- Modify: `game/src/game/scenes/combat/combat-grid-view.ts` (entire file — every `this.scene.` reference)
- Modify: `game/src/game/scenes/combat/combat-grid-view.test.ts` (fixture update + new test)

**Interfaces:**
- Consumes: `CombatGridViewHost` (Task 1).
- Produces: `CombatGridView`'s constructor now takes `host: CombatGridViewHost`; `getOrCreateSprite`'s branch order gains one new `else if` between the enemy-texture branch and the Rectangle fallback.

- [ ] **Step 1: Update the import and constructor**

In `game/src/game/scenes/combat/combat-grid-view.ts`, replace:

```ts
import type { CombatScene } from '../CombatScene'
```

with:

```ts
import type { CombatGridViewHost } from './CombatGridViewHost'
```

Replace:

```ts
export class CombatGridView {
  constructor(private readonly scene: CombatScene) {}
```

with:

```ts
export class CombatGridView {
  constructor(private readonly host: CombatGridViewHost) {}
```

- [ ] **Step 2: Rename every `this.scene.` to `this.host.`, except the five self-referential delegate calls**

Do a straightforward find-and-replace of `this.scene.` → `this.host.` across the whole file, THEN manually fix these five call sites back to direct `this.` calls (they exist because `CombatScene` currently has thin delegate methods that just forward into `this.gridView.xxx()` — the panel's host will not define matching delegates, so `CombatGridView` must call its own methods directly):

1. In `applySpriteSize(sprite: EntitySprite)`:
   ```ts
   // was: this.host.applyEntityDepthScale(sprite, this.host.projection.gridToScreen(sprite.row, 0).scale)
   this.applyEntityDepthScale(sprite, this.host.projection.gridToScreen(sprite.row, 0).scale)
   ```
2. In `applySpriteSize(sprite: EntitySprite)` (health bar branch):
   ```ts
   // was: this.host.updateEnemyHealthBar(sprite, sprite.healthBar.currentHp, sprite.healthBar.maxHp)
   this.updateEnemyHealthBar(sprite, sprite.healthBar.currentHp, sprite.healthBar.maxHp)
   ```
3. In `applyEntityDepthScale(sprite: EntitySprite, depthScale: number)` (health bar branch):
   ```ts
   // was: this.host.updateEnemyHealthBar(sprite, sprite.healthBar.currentHp, sprite.healthBar.maxHp)
   this.updateEnemyHealthBar(sprite, sprite.healthBar.currentHp, sprite.healthBar.maxHp)
   ```
4. In `positionSprite(sprite: EntitySprite, worldColumn: number, _id = '')`:
   ```ts
   // was: this.host.applyEntityDepthScale(sprite, point.scale)
   this.applyEntityDepthScale(sprite, point.scale)
   // ...and further down in the same method:
   // was: const headY = this.host.entityHeadY(sprite) - ENEMY_HP_BAR_OFFSET_Y
   const headY = this.entityHeadY(sprite) - ENEMY_HP_BAR_OFFSET_Y
   ```
5. In `getOrCreateSprite(...)` (player branch) and twice more in the enemy-texture branch, and twice in `resetVisual()`:
   ```ts
   // was: this.host.applySpriteSize(sprite)
   this.applySpriteSize(sprite)
   // was: this.host.updateEnemyHealthBar(sprite, healthBar.currentHp, healthBar.maxHp)  (appears twice, enemy branch + rect-fallback branch)
   this.updateEnemyHealthBar(sprite, healthBar.currentHp, healthBar.maxHp)
   ```
6. In `resetVisual(sprite: EntitySprite)`:
   ```ts
   // was: this.host.positionSprite(sprite, entry.toX, PLAYER_ID)
   this.positionSprite(sprite, entry.toX, PLAYER_ID)
   ```

After this step, `combat-grid-view.ts` should have **zero** occurrences of `this.host.applySpriteSize`, `this.host.applyEntityDepthScale`, `this.host.updateEnemyHealthBar`, `this.host.entityHeadY`, or `this.host.positionSprite` — grep to confirm:

```bash
grep -n "this\.host\.\(applySpriteSize\|applyEntityDepthScale\|updateEnemyHealthBar\|entityHeadY\|positionSprite\)" src/game/scenes/combat/combat-grid-view.ts
```

Expected: no output.

- [ ] **Step 3: Add the `fallbackSpriteTextureKey` branch to `getOrCreateSprite`**

In `getOrCreateSprite`, find the enemy-texture branch's closing brace (the `if (enemyTextureKey && this.host.textures.exists(enemyTextureKey)) { ... return sprite }` block) and the Rectangle-fallback code that follows it. Insert a new branch between them:

```ts
    // Enemy: Sprite art batch Mortal khi có texture khớp id (mortal-
    // enemy-art-batch-plan.md), fallback Rectangle màu cho id ngoài
    // batch (test fixture / realm khác chưa có art).
    const enemyTextureKey = resolveEnemyTextureKey(id)

    if (enemyTextureKey && this.host.textures.exists(enemyTextureKey)) {
      // ... (unchanged, existing branch)
      return sprite
    }

    // Host fallback (Battlefield Slot spec §4) — combat thật trả undefined
    // ở đây LUÔN (xem CombatScene.fallbackSpriteTextureKey()), giữ nguyên
    // 100% hành vi Rectangle fallback cho enemy ngoài batch Mortal. Panel
    // Trận Pháp (TranPhapCombatPreviewScene) trả về sheet placeholder
    // dùng chung — mọi combatant của panel render qua nhánh này, animate
    // được thay vì Rectangle tĩnh.
    const fallbackTextureKey = this.host.fallbackSpriteTextureKey(id)

    if (fallbackTextureKey && this.host.textures.exists(fallbackTextureKey)) {
      const gameSprite = this.host.add.sprite(0, 0, fallbackTextureKey)

      this.host.physics.add.existing(gameSprite)

      if (this.host.isPerspective) {
        gameSprite.setOrigin(0.5, 1)
      }

      const sprite: EntitySprite = {
        kind: 'sprite',
        rect: gameSprite,
        label,
        color,
        offsetX: 0,
        row,
        // sizeMultiplier: 1 (KHÔNG ENEMY_DISPLAY_SCALE_MULTIPLIER) — nhánh
        // này chỉ có panel Trận Pháp chạm tới (combat thật luôn nhận
        // fallbackSpriteTextureKey() === undefined, xem branch trước đó);
        // panel tự set characterWidth/Height BẰNG ĐÚNG kích thước sprite
        // mong muốn (0.8 × cell, xem TranPhapCombatPreviewScene, Task 4) —
        // applySpriteSize()'s flat formula là characterHeight ×
        // sizeMultiplier, nên multiplier phải là 1 để không nhân đôi kích
        // thước đã tính sẵn.
        sizeMultiplier: 1,
        boost: { value: 1 },
        footY: 0,
        columnFloat: 0,
      }

      if (this.host.isPerspective) {
        sprite.shadow = this.host.add
          .ellipse(0, 0, 10, 4, SHADOW_COLOR, SHADOW_ALPHA)
          .setDepth(DEPTH_ENTITY_SHADOW)
      }

      this.host.sprites.set(id, sprite)
      this.applySpriteSize(sprite)

      return sprite
    }

    const rect = this.host.add
      .rectangle(0, 0, this.host.characterWidth, this.host.characterHeight, color)
      .setOrigin(0.5)
    // ... (rest of the existing Rectangle-fallback branch, unchanged except this.scene. -> this.host.)
```

Note: this new branch does not attach a `healthBar` (the panel never passes a `health` argument, and real combat never reaches this branch at all — see Step 4's regression test) — matches the spec's Non-Goal "no health bars in the panel."

- [ ] **Step 4: Update `combat-grid-view.test.ts`'s fixture**

The existing `createFakeScene()` builds a plain object cast to `CombatScene` — now that `getOrCreateSprite` unconditionally calls `this.host.fallbackSpriteTextureKey(id)` before the Rectangle fallback, this fixture MUST provide that method or the existing tests will throw `TypeError: this.host.fallbackSpriteTextureKey is not a function`.

Update the file:

```ts
// @vitest-environment jsdom
//
// combat-grid-view.test.ts — regression thật cho Task 9.5: sprite-creation
// path (getOrCreateSprite) phải chọn ĐÚNG sizeMultiplier theo cờ isBoss của
// entity spawn, KHÔNG phải giá trị fixture gán tay như
// CombatScene.enemyScale.test.ts (test đó chỉ khoá applyEntityDepthScale()
// pass-through, không chạm production creation code — xem task-9-brief.md).
//
// Battlefield Slot (2026-09-06) — constructor giờ nhận CombatGridViewHost
// (không còn CombatScene cụ thể) nên fake host phải khai đủ
// fallbackSpriteTextureKey() — combat thật LUÔN trả undefined, xem
// CombatScene.fallbackSpriteTextureKey().
import { describe, expect, it, vi } from 'vitest'
import { CombatGridView } from './combat-grid-view'
import { BOSS_DISPLAY_SCALE_MULTIPLIER, ENEMY_DISPLAY_SCALE_MULTIPLIER } from './combatConstants'
import type { CombatGridViewHost } from './CombatGridViewHost'

function createFakeScene() {
  const chainable = () => {
    const obj = {
      setOrigin: () => obj,
      setDepth: () => obj,
      setStrokeStyle: () => obj,
      setSize: () => obj,
      setScale: () => obj,
      updateDisplayOrigin: () => obj,
      setDisplaySize: () => obj,
      destroy: () => obj,
    }

    return obj
  }

  const scene: Record<string, unknown> = {
    sprites: new Map(),
    isPerspective: false,
    projection: undefined,
    characterWidth: 40,
    characterHeight: 50,
    playerSourceSize: { w: 1244, h: 1264 },
    add: {
      text: () => chainable(),
      sprite: () => chainable(),
      rectangle: () => chainable(),
      ellipse: () => chainable(),
    },
    physics: { add: { existing: vi.fn() } },
    textures: { exists: () => true },
    fallbackSpriteTextureKey: () => undefined,
  }

  const gridView = new CombatGridView(scene as unknown as CombatGridViewHost)

  scene.applySpriteSize = (sprite: Parameters<CombatGridView['applySpriteSize']>[0]) =>
    gridView.applySpriteSize(sprite)
  scene.updateEnemyHealthBar = (
    sprite: Parameters<CombatGridView['updateEnemyHealthBar']>[0],
    currentHp: number,
    maxHp: number,
  ) => gridView.updateEnemyHealthBar(sprite, currentHp, maxHp)

  return { scene, gridView }
}

describe('CombatGridView.getOrCreateSprite() — Task 9.5 boss sizeMultiplier', () => {
  it('isBoss: true → sizeMultiplier = BOSS_DISPLAY_SCALE_MULTIPLIER (×4)', () => {
    const { gridView } = createFakeScene()

    const sprite = gridView.getOrCreateSprite('mortal_wild_boar_boss', 0xd94a4a, 'Boss Boar', 4, {
      currentHp: 100,
      maxHp: 100,
      isBoss: true,
    })

    expect(sprite.sizeMultiplier).toBe(BOSS_DISPLAY_SCALE_MULTIPLIER)
    expect(sprite.sizeMultiplier).toBe(4)
  })

  it('isBoss: false → sizeMultiplier = ENEMY_DISPLAY_SCALE_MULTIPLIER (×2)', () => {
    const { gridView } = createFakeScene()

    const sprite = gridView.getOrCreateSprite('mortal_wild_boar_regular', 0xd94a4a, 'Boar', 4, {
      currentHp: 100,
      maxHp: 100,
      isBoss: false,
    })

    expect(sprite.sizeMultiplier).toBe(ENEMY_DISPLAY_SCALE_MULTIPLIER)
    expect(sprite.sizeMultiplier).toBe(2)
  })

  it('health không truyền (undefined) → mặc định ENEMY_DISPLAY_SCALE_MULTIPLIER như enemy thường', () => {
    const { gridView } = createFakeScene()

    const sprite = gridView.getOrCreateSprite('mortal_wild_boar_no_health', 0xd94a4a, 'Boar', 4)

    expect(sprite.sizeMultiplier).toBe(ENEMY_DISPLAY_SCALE_MULTIPLIER)
  })

  it('nhánh fallback Rectangle (chưa có texture, host.fallbackSpriteTextureKey() = undefined): Boss vẫn KHÔNG được nhỏ hơn enemy thường có texture — round 1 review, tránh inversion', () => {
    const { gridView } = createFakeScene()

    const bossSprite = gridView.getOrCreateSprite('unknown_id_no_art_boss', 0xd94a4a, 'Boss X', 4, {
      currentHp: 100,
      maxHp: 100,
      isBoss: true,
    })

    expect(bossSprite.kind).toBe('rect')
    expect(bossSprite.sizeMultiplier).toBe(BOSS_DISPLAY_SCALE_MULTIPLIER)
    expect(bossSprite.sizeMultiplier).toBeGreaterThanOrEqual(ENEMY_DISPLAY_SCALE_MULTIPLIER)

    const regularSprite = gridView.getOrCreateSprite('unknown_id_no_art_regular', 0xd94a4a, 'Regular X', 4, {
      currentHp: 100,
      maxHp: 100,
      isBoss: false,
    })

    expect(regularSprite.kind).toBe('rect')
    expect(regularSprite.sizeMultiplier).toBe(1)
  })
})

describe('CombatGridView.getOrCreateSprite() — host.fallbackSpriteTextureKey() (Battlefield Slot, 2026-09-06)', () => {
  it('host trả về 1 texture key hợp lệ (fallbackSpriteTextureKey + textures.exists đều true) → sprite kind "sprite", KHÔNG phải Rectangle', () => {
    const { scene, gridView } = createFakeScene()

    scene.fallbackSpriteTextureKey = () => 'shared-placeholder-sheet'

    const sprite = gridView.getOrCreateSprite('any_non_enemy_non_player_id', 0x4caf50, 'Test', 0)

    expect(sprite.kind).toBe('sprite')
  })

  it('host trả undefined (như CombatScene thật) → vẫn rơi về Rectangle fallback y hệt trước khi có branch mới — KHÔNG regression cho combat thật', () => {
    const { gridView } = createFakeScene()

    const sprite = gridView.getOrCreateSprite('some_enemy_outside_mortal_batch', 0xd94a4a, 'Test', 0, {
      currentHp: 10,
      maxHp: 10,
      isBoss: false,
    })

    expect(sprite.kind).toBe('rect')
  })

  it('gọi getOrCreateSprite 2 lần cùng id → trả về CÙNG object sprite (không destroy/tạo lại) — đây là cơ chế fix bug animation-reset của panel Trận Pháp (Task 4)', () => {
    const { scene, gridView } = createFakeScene()

    scene.fallbackSpriteTextureKey = () => 'shared-placeholder-sheet'

    const first = gridView.getOrCreateSprite('stable_id', 0x4caf50, 'Test', 0)
    const second = gridView.getOrCreateSprite('stable_id', 0x4caf50, 'Test', 0)

    expect(second).toBe(first)
  })
})
```

- [ ] **Step 5: Run tests to verify**

Run: `npx vitest run combat-grid-view.test.ts` — all pass (5 existing + 3 new = 8 tests).

- [ ] **Step 6: Type-check + full regression**

Run: `npm.cmd run type-check` + `npx vitest run` (full, no filter) — both green, zero regressions in any other combat test file (`CombatScene.*.test.ts`, `CombatScene.combatAnimations.test.ts`, etc.).

- [ ] **Step 7: Commit**

```bash
git add game/src/game/scenes/combat/combat-grid-view.ts game/src/game/scenes/combat/combat-grid-view.test.ts
git commit -m "feat(battlefield-slot): decouple CombatGridView from concrete CombatScene, add host texture-override branch"
```

---

### Task 3: `SlotState` type

**Files:**
- Create: `game/src/game/support/SlotState.ts`

**Interfaces:**
- Produces: `export type SlotState = 'enabled' | 'locked' | 'disabled' | 'hover' | 'occupied'`.

- [ ] **Step 1: Write the file**

```ts
// SlotState (Battlefield Slot spec, 2026-09-06) — vocabulary chung cho
// trạng thái tương tác của 1 ô chiến trường, dùng bởi panel Trận Pháp hôm
// nay (combat thật chưa có tương tác click/kéo trên ô, nhưng type nằm ở
// đây để tính năng sau — targeting thủ công, tooltip theo ô — không phải
// tự bịa lại 1 bộ tên khác).
export type SlotState = 'enabled' | 'locked' | 'disabled' | 'hover' | 'occupied'
```

This file has no logic to unit-test (a type alias). No test file for this task.

- [ ] **Step 2: Type-check**

Run: `npm.cmd run type-check` — 0 errors (confirms the file itself is syntactically valid; nothing imports it yet until Task 5).

- [ ] **Step 3: Commit**

```bash
git add game/src/game/support/SlotState.ts
git commit -m "feat(battlefield-slot): add shared SlotState vocabulary"
```

---

### Task 4: `TranPhapCombatPreviewScene` (replaces `TranPhapPreviewScene`)

**Files:**
- Create: `game/src/game/scenes/TranPhapCombatPreviewScene.ts`
- Create: `game/src/game/scenes/TranPhapCombatPreviewScene.test.ts`
- Delete: `game/src/game/scenes/TranPhapPreviewScene.ts`
- Delete: `game/src/game/scenes/TranPhapPreviewScene.test.ts`

**Interfaces:**
- Consumes: `CombatGridViewHost` + `CombatGridView` (Tasks 1-2), `PLACEHOLDER_SHEET_KEY`/`PLACEHOLDER_SHEET_URL`/`PLACEHOLDER_FRAME_WIDTH`/`PLACEHOLDER_FRAME_HEIGHT`/`PLACEHOLDER_FRAME_COUNT`/`PLACEHOLDER_FRAME_RATE` (`@/game/support/CombatAnimationSet`, existing), `FormationSlotAssignment` (`@/core/player/Player`, existing), `EntitySprite`/`PLAYER_ID`/`HERO_LANE_INDEX` (`./combat/combatTypes`/`./combat/combatConstants`, existing).
- Produces: `PREVIEW_CELL_SIZE: number`, `PREVIEW_GRID_SIZE: number` (same values as before: 60, 6), `class TranPhapCombatPreviewScene extends Phaser.Scene implements CombatGridViewHost` with public `syncAssignments(assignments: FormationSlotAssignment[]): void`.

- [ ] **Step 1: Confirm nothing else imports the old scene before deleting it**

```bash
grep -rn "TranPhapPreviewScene" game/src --include="*.ts" --include="*.vue"
```

Expected: only `game/src/game/scenes/TranPhapPreviewScene.ts`, `game/src/game/scenes/TranPhapPreviewScene.test.ts`, and `game/src/components/panels/TranPhapPanel.vue` (updated in Task 5). If anything else appears, STOP and report — do not delete blindly.

- [ ] **Step 2: Write the failing test (pure helper only — same limitation as the file being replaced: the Phaser scene itself needs a WebGL/canvas context, not unit-testable)**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { PREVIEW_CELL_SIZE, previewCellTopLeft } from './TranPhapCombatPreviewScene'

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

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run TranPhapCombatPreviewScene.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 4: Write the new scene**

```ts
// TranPhapCombatPreviewScene (Battlefield Slot spec, 2026-09-06) — thay
// TranPhapPreviewScene (2026-09-06, Hỗn Độn Trận visual test tooling):
// scene Phaser RIÊNG (Phaser.Game riêng, TextureManager riêng — không có
// nguy cơ đụng key dù dùng lại ĐÚNG PLACEHOLDER_SHEET_KEY), nhưng giờ
// implements CombatGridViewHost và dùng ĐÚNG CombatGridView mà combat
// thật dùng (spec §4) — thay vì tự viết lại logic sprite/animation. Vẽ
// lưới 6x6 PHẲNG (isPerspective: false — 2.5D là spec riêng sau này,
// KHÔNG làm ở đây) + 1 layer background dự phòng cho art thật sau này.
// Tương tác kéo-thả KHÔNG nằm ở đây — canvas này thuần hiển thị, overlay
// HTML trong suốt (TranPhapPanel.vue, không đổi) mới là drop target thật.
import Phaser from 'phaser'
import {
  PLACEHOLDER_SHEET_KEY,
  PLACEHOLDER_SHEET_URL,
  PLACEHOLDER_FRAME_WIDTH,
  PLACEHOLDER_FRAME_HEIGHT,
  PLACEHOLDER_FRAME_COUNT,
  PLACEHOLDER_FRAME_RATE,
} from '@/game/support/CombatAnimationSet'
import type { BattleGridProjection } from '@/game/support/BattleGridProjection'
import type { FormationSlotAssignment } from '@/core/player/Player'
import type { LaneIndex } from '@/core/battle/BattleLane'
import { CombatGridView } from './combat/combat-grid-view'
import type { CombatGridViewHost } from './combat/CombatGridViewHost'
import type { EntitySprite } from './combat/combatTypes'

export const PREVIEW_CELL_SIZE = 60
export const PREVIEW_GRID_SIZE = 6

const PREVIEW_IDLE_ANIMATION_KEY = 'tran-phap-preview-idle'

export function previewCellTopLeft(row: number, column: number): { x: number; y: number } {
  return { x: column * PREVIEW_CELL_SIZE, y: row * PREVIEW_CELL_SIZE }
}

export class TranPhapCombatPreviewScene extends Phaser.Scene implements CombatGridViewHost {
  readonly isPerspective = false
  projection: BattleGridProjection | undefined
  gridGraphics: Phaser.GameObjects.Graphics | undefined
  readonly usingArtBackdrop = false
  arenaRect: Phaser.GameObjects.Rectangle | undefined
  // 0.8 × cell (KHÔNG bằng PREVIEW_CELL_SIZE thẳng) — characterWidth/Height
  // ở đây LÀ kích thước sprite hiển thị mong muốn (applySpriteSize()'s
  // flat formula: displayHeight = characterHeight × sizeMultiplier, và
  // sizeMultiplier của nhánh fallback panel dùng là 1, xem combat-grid-
  // view.ts Task 2 Step 3) — 0.8 tái tạo ĐÚNG tỉ lệ sprite/ô của
  // TranPhapPreviewScene cũ (`setDisplaySize(PREVIEW_CELL_SIZE * 0.8,
  // PREVIEW_CELL_SIZE * 0.8)`), không để sprite to lấn sang ô kế bên.
  characterWidth = PREVIEW_CELL_SIZE * 0.8
  characterHeight = PREVIEW_CELL_SIZE * 0.8
  // Không dùng khi isPerspective=false (applySpriteSize() nhánh flat đọc
  // characterWidth/Height trực tiếp) — giữ 1:1 để tránh chia 0 nếu code
  // sau này lỡ đọc tới.
  readonly playerSourceSize = { w: 1, h: 1 }
  readonly playerProfile = { combatTextureKey: PLACEHOLDER_SHEET_KEY }
  sprites = new Map<string, EntitySprite>()
  entityFootMinY = 0
  entityFootMaxY = 1
  // resetVisual() không dùng ở panel — Map rỗng thoả type, .get() luôn
  // undefined (đã guard sẵn trong CombatGridView.resetVisual()).
  readonly interpolations = new Map<string, unknown>()

  private gridView!: CombatGridView

  constructor() {
    super('TranPhapCombatPreviewScene')
  }

  fallbackSpriteTextureKey(_id: string): string | undefined {
    return PLACEHOLDER_SHEET_KEY
  }

  preload(): void {
    this.load.spritesheet(PLACEHOLDER_SHEET_KEY, PLACEHOLDER_SHEET_URL, {
      frameWidth: PLACEHOLDER_FRAME_WIDTH,
      frameHeight: PLACEHOLDER_FRAME_HEIGHT,
    })
  }

  create(): void {
    this.gridView = new CombatGridView(this)

    // Layer background — hiện tại chỉ 1 màu phẳng, để dành gắn ảnh thật
    // sau này mà không cần đổi cấu trúc scene.
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

  /**
   * Diff theo combatantId qua chính CombatGridView.getOrCreateSprite() —
   * KHÔNG tự viết lại logic tạo/xoá sprite: entity còn trong assignment
   * mới → getOrCreateSprite() no-op nếu id đã có trong this.sprites (chỉ
   * reposition), animation KHÔNG bị ngắt/reset (đây chính là fix cho bug
   * "animation reset về 0 mỗi lần kéo-thả 1 entity", 2026-09-06); entity
   * biến mất → destroyEntitySprite() qua CombatGridView; entity mới xuất
   * hiện → getOrCreateSprite() tạo sprite mới, play() từ frame 0 (đúng —
   * chưa từng animate trong panel này).
   */
  syncAssignments(assignments: FormationSlotAssignment[]): void {
    const nextIds = new Set(assignments.map((a) => a.combatantId))

    for (const [id, sprite] of this.sprites) {
      if (!nextIds.has(id)) {
        this.gridView.destroyEntitySprite(sprite)
        this.sprites.delete(id)
      }
    }

    for (const assignment of assignments) {
      const sprite = this.gridView.getOrCreateSprite(
        assignment.combatantId,
        0x4caf50,
        assignment.combatantId,
        assignment.row as LaneIndex,
      )

      if (sprite.kind === 'sprite' && !(sprite.rect as Phaser.GameObjects.Sprite).anims.isPlaying) {
        ;(sprite.rect as Phaser.GameObjects.Sprite).play(PREVIEW_IDLE_ANIMATION_KEY)
      }

      this.gridView.positionSprite(sprite, assignment.column)
    }
  }
}
```

Note on the `anims.isPlaying` guard: `getOrCreateSprite()`'s new host-fallback branch (Task 2, Step 3) creates the sprite but does not call `.play()` itself (that branch is generic — real combat's equivalent branch never plays automatically either, animation playback is driven by combat events via `playCombatAnimation()`). The panel has no combat events, so `syncAssignments()` explicitly starts the idle animation the first time a sprite appears, and the `isPlaying` guard prevents restarting it on every subsequent call (which would reintroduce the exact bug this whole plan fixes).

- [ ] **Step 5: Delete the old files**

```bash
git rm game/src/game/scenes/TranPhapPreviewScene.ts game/src/game/scenes/TranPhapPreviewScene.test.ts
```

- [ ] **Step 6: Run tests to verify**

Run: `npx vitest run TranPhapCombatPreviewScene.test.ts` — 3/3 pass.

- [ ] **Step 7: Type-check + full regression**

Run: `npm.cmd run type-check` — expect FAILURES at this point (`TranPhapPanel.vue` still imports the now-deleted `TranPhapPreviewScene` — this is fixed in Task 5, not this task). Confirm the ONLY errors are in `TranPhapPanel.vue` referencing `TranPhapPreviewScene` — if any OTHER file errors, stop and investigate before proceeding.

Run: `npx vitest run` (full) — expect `TranPhapPanel.vue`-related test failures if any exist (there are none as of this plan — `TranPhapPanel.vue` has no dedicated `.test.ts` file); all other tests must stay green.

- [ ] **Step 8: Commit**

```bash
git add game/src/game/scenes/TranPhapCombatPreviewScene.ts game/src/game/scenes/TranPhapCombatPreviewScene.test.ts
git commit -m "feat(battlefield-slot): TranPhapCombatPreviewScene replaces TranPhapPreviewScene, drives shared CombatGridView"
```

(The `git rm` from Step 5 is staged automatically by `git rm` and included in this same commit — confirm with `git status` before committing that both the new files and the two deletions are staged together.)

---

### Task 5: Wire `TranPhapPanel.vue` to the new scene + `SlotState`

**Files:**
- Modify: `game/src/components/panels/TranPhapPanel.vue`

**Interfaces:**
- Consumes: `TranPhapCombatPreviewScene`, `PREVIEW_CELL_SIZE`/`PREVIEW_GRID_SIZE` (Task 4), `SlotState` (Task 3).

- [ ] **Step 1: Update imports and the dynamic-import target**

Change:

```ts
import { PREVIEW_CELL_SIZE, PREVIEW_GRID_SIZE } from '@/game/scenes/TranPhapPreviewScene'
import type { TranPhapPreviewScene } from '@/game/scenes/TranPhapPreviewScene'
```

to:

```ts
import { PREVIEW_CELL_SIZE, PREVIEW_GRID_SIZE } from '@/game/scenes/TranPhapCombatPreviewScene'
import type { TranPhapCombatPreviewScene } from '@/game/scenes/TranPhapCombatPreviewScene'
import type { SlotState } from '@/game/support/SlotState'
```

Change the two `previewScene`-typed declarations:

```ts
let previewScene: TranPhapPreviewScene | null = null
```

to:

```ts
let previewScene: TranPhapCombatPreviewScene | null = null
```

(there is exactly one such declaration — `let previewGame: Phaser.Game | null = null` stays as-is, only the `previewScene` line changes).

Change the dynamic import + scene-lookup inside the `watch()` callback:

```ts
const [{ default: Phaser }, { TranPhapPreviewScene: TranPhapPreviewSceneClass }] = await Promise.all([
  import('phaser'),
  import('@/game/scenes/TranPhapPreviewScene'),
])
```

to:

```ts
const [{ default: Phaser }, { TranPhapCombatPreviewScene: TranPhapCombatPreviewSceneClass }] = await Promise.all([
  import('phaser'),
  import('@/game/scenes/TranPhapCombatPreviewScene'),
])
```

And:

```ts
scene: [TranPhapPreviewSceneClass],
```

to:

```ts
scene: [TranPhapCombatPreviewSceneClass],
```

And:

```ts
previewScene = (previewGame?.scene.getScene('TranPhapPreviewScene') as TranPhapPreviewScene | undefined) ?? null
```

to:

```ts
previewScene = (previewGame?.scene.getScene('TranPhapCombatPreviewScene') as TranPhapCombatPreviewScene | undefined) ?? null
```

- [ ] **Step 2: Add `slotStateAt()` and hover tracking (Goal 5 — SlotState vocabulary consumed by the panel)**

Add near `assignmentAt()`:

```ts
// Battlefield Slot spec (2026-09-06) — thay boolean rời (--lit) bằng
// SlotState dùng chung, để nếu sau này combat thật cần state tương tự
// (targeting thủ công, tooltip theo ô) không phải bịa lại tên khác.
const hoveredCell = ref<{ row: number; column: number } | null>(null)

function slotStateAt(row: number, column: number): SlotState {
  if (!isLitCell(row, column)) {
    return 'locked'
  }

  if (assignmentAt(row, column)) {
    return 'occupied'
  }

  if (hoveredCell.value?.row === row && hoveredCell.value?.column === column) {
    return 'hover'
  }

  return 'enabled'
}
```

- [ ] **Step 3: Wire hover tracking + `slotStateAt()` into the template**

Change the cell `<div>` in the template from:

```html
<div
  v-for="column in PREVIEW_GRID_SIZE"
  :key="column"
  class="tran-phap-panel__cell"
  :class="{ 'tran-phap-panel__cell--lit': isLitCell(row - 1, column - 1) }"
  :draggable="!!assignmentAt(row - 1, column - 1)"
  @dragstart="(event) => { const occupant = assignmentAt(row - 1, column - 1); if (occupant) (event as DragEvent).dataTransfer?.setData('text/plain', occupant.combatantId) }"
  @dragover.prevent
  @drop="(event) => onDrop(row - 1, column - 1, (event as DragEvent).dataTransfer?.getData('text/plain') ?? '')"
  @click="() => { const occupant = assignmentAt(row - 1, column - 1); if (occupant) removeAssignment(occupant.combatantId) }"
>
  {{ assignmentAt(row - 1, column - 1)?.combatantId ?? '' }}
</div>
```

to:

```html
<div
  v-for="column in PREVIEW_GRID_SIZE"
  :key="column"
  :class="['tran-phap-panel__cell', `tran-phap-panel__cell--${slotStateAt(row - 1, column - 1)}`]"
  :draggable="!!assignmentAt(row - 1, column - 1)"
  @dragstart="(event) => { const occupant = assignmentAt(row - 1, column - 1); if (occupant) (event as DragEvent).dataTransfer?.setData('text/plain', occupant.combatantId) }"
  @dragenter="hoveredCell = { row: row - 1, column: column - 1 }"
  @dragleave="() => { if (hoveredCell?.row === row - 1 && hoveredCell?.column === column - 1) hoveredCell = null }"
  @dragover.prevent
  @drop="(event) => { onDrop(row - 1, column - 1, (event as DragEvent).dataTransfer?.getData('text/plain') ?? ''); hoveredCell = null }"
  @click="() => { const occupant = assignmentAt(row - 1, column - 1); if (occupant) removeAssignment(occupant.combatantId) }"
>
  {{ assignmentAt(row - 1, column - 1)?.combatantId ?? '' }}
</div>
```

- [ ] **Step 4: Update CSS — replace `--lit` with the four visible `SlotState` classes**

Change:

```css
.tran-phap-panel__cell {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--surface-line);
  opacity: 0.35;
  font-size: var(--text-xs, 11px);
}

.tran-phap-panel__cell--lit {
  opacity: 1;
  border-color: var(--jade, #4caf50);
}
```

to:

```css
.tran-phap-panel__cell {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--surface-line);
  font-size: var(--text-xs, 11px);
}

/* SlotState (Battlefield Slot spec, 2026-09-06) — 'locked' giữ đúng look
   mờ cũ (--lit trước đây = false); 'enabled'/'occupied' giữ đúng look
   sáng cũ (--lit trước đây = true); 'hover' thêm viền nhấn khi đang kéo
   một quân TỚI ô này (chỉ hiện trên ô enabled, chưa có ai chiếm — xem
   slotStateAt()'s thứ tự ưu tiên locked > occupied > hover > enabled). */
.tran-phap-panel__cell--locked {
  opacity: 0.35;
}

.tran-phap-panel__cell--enabled,
.tran-phap-panel__cell--occupied {
  opacity: 1;
  border-color: var(--jade, #4caf50);
}

.tran-phap-panel__cell--hover {
  opacity: 1;
  border-color: var(--jade, #4caf50);
  box-shadow: 0 0 0 2px var(--jade, #4caf50) inset;
}
```

(`disabled` is part of the `SlotState` type but has no current consumer in this panel — spec §Goal 5 explicitly reserves it for a future feature; no CSS rule needed for a state nothing produces yet.)

- [ ] **Step 5: Type-check + full regression**

Run: `npm.cmd run type-check` — must be 0 errors now (this is the step that resolves Task 4's expected failures).
Run: `npx vitest run` (full, no filter) — all green.

- [ ] **Step 6: Commit**

```bash
git add game/src/components/panels/TranPhapPanel.vue
git commit -m "feat(battlefield-slot): wire TranPhapPanel.vue to TranPhapCombatPreviewScene + SlotState"
```

---

### Task 6: Final verification + roadmap update

- [ ] Run `npx vitest run` — full suite green, confirm test count only grew by the new tests added in Tasks 1, 2, and 4 (no unrelated file changed test counts).
- [ ] Run `npm.cmd run type-check` — zero errors.
- [ ] Run `npx vitest run combat-grid-view.test.ts CombatGridViewHost.test.ts` explicitly and confirm all 8 tests pass — the two files with the highest blast-radius risk in this plan.
- [ ] Grep-diff every other `CombatScene.*.test.ts` file's pass/fail count against the Task 1 baseline (`npx vitest run` output before this plan started vs. now) — must be identical counts, proving zero behavior change to real combat.
- [ ] Playwright manual pass (same guest-flow pattern as the 2026-09-06 Hỗn Độn Trận plan): `npm run dev`, open the Trận Pháp panel, select "Hỗn Độn Trận", drag the player card and 2-3 test companions into different cells one at a time, taking a screenshot after each drop — confirm the EARLIER-placed sprites' animation frame keeps advancing across drops (does not visibly reset/flicker to frame 0 each time a new card is dropped). This is the direct behavioral proof of Goal 6, on top of Task 2's unit-level identity-preservation test.
- [ ] Start one real battle (any stage) and confirm combat renders exactly as before this plan (player visible and animating — from the earlier 2026-09-06 bug-fix commit, still intact; enemies render correctly) — proves Task 2's `getOrCreateSprite` branch reordering introduced no regression to the live game, not just to its test file.
- [ ] Update `game/docs/roadmap.md` with a section noting: `CombatGridView` is now shared between real combat and the Trận Pháp panel via `CombatGridViewHost`; the panel's scene is `TranPhapCombatPreviewScene` (replacing `TranPhapPreviewScene`); the `SlotState` vocabulary is introduced (only the panel consumes it today); this is Part 1 of a four-part initiative — Parts 2 (2.5D projection for the panel), 3 (wave spawn redesign), and 4 (spawn VFX wiring for turn-based combat) are separate future specs, not started.
- [ ] Commit: `git commit -m "docs: roadmap - Battlefield Slot / shared CombatGridView shipped (Part 1 of 4)"`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-06-battlefield-slot-shared-gridview.md`. This plan is written for a **separate executor session/agent** (per the user's explicit request) — set up an isolated worktree first (`superpowers:using-git-worktrees`, `.agent-worktrees/battlefield-slot-shared-gridview` per this project's convention), then run it with `superpowers:executing-plans` (batch execution with human checkpoints) or `superpowers:subagent-driven-development` (fresh subagent per task, automated review loop) — either works; Task 2 is the one task that warrants a careful, unhurried reviewer regardless of which mode is chosen, given its blast radius on live combat rendering.
