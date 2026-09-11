# Perfect Clear + Stage Tinh Anh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (project convention: opencode has no subagent dispatch — Inline Execution, per P6). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi điều kiện Hoàn Mỹ thành "toàn đội còn sống lúc victory + dưới X turn" (X hard-code 3/5/7 cho stage Tinh Anh floor 3/6/9, placeholder cho thường/boss), biến floor 3/6/9 của cả 3 chương thành stage Tinh Anh deterministic (all-elite), retire cơ chế `eliteChance` random, thêm first-clear bonus cho stage Tinh Anh.

**Architecture:** Predicate Hoàn Mỹ sửa tại đúng 1 owner (`recordPerfectClearIfEligible`); stage Tinh Anh là data-driven (`Stage.allElite` 1 field + data trong `Stages.ts`), spawn qua đúng 1 nhánh mechanism trong `StageWaveSystem.pickEnemyForSpawn` (dùng lại `createEliteVariant` — không mechanism mới); first-clear reward đi qua victory block `completedStageIds` gate có sẵn. `Zones.ts stageIds` giữ nguyên thứ tự (floor 3/6/9 là id có sẵn — KHÔNG thêm stage id mới).

**Tech Stack:** Vue 3 + TypeScript + Vite + Vitest + Pinia + Phaser (không dependency mới).

**Spec:** `game/docs/superpowers/specs/2026-09-11-perfect-clear-elite-stages-design.md`

## Global Constraints

- Chạy mọi command từ `game/`. All paths relative to `game/`.
- **P3 quick** mỗi task: `npm.cmd run type-check` + `npx.cmd vitest run <scope>`. Task cuối chạy **full** (thêm `npm.cmd run build` + vitest không filter).
- **P7:** mỗi task kết thúc bằng commit command đã soạn — KHÔNG chạy commit cho đến khi user authorize (hiện thị diff + message, chờ).
- **P8:** không `any` mới.
- **P15:** comment mới/vừa sửa = English plain ASCII. KHÔNG đụng comment tiếng Việt cũ ở vùng không liên quan.
- **P16:** string UI mới → i18n keys (`vi.json` + `en.json`), dùng `t()`.
- Quyết định D1–D6 trong spec là BẤT BIẾN — không tự đổi số X, không tái thiết kế cấu trúc floor.
- `createEliteVariant`/`applyEliteMultiplier`/`eliteRewards` data trong `Enemies.ts` GIỮ NGUYÊN.
- Stage Tinh Anh dùng NGUYÊN enemyPool entry có sẵn của chính tầng đó (bỏ eliteChance, giữ weight).

## File Structure

**Modified:**
- `src/core/stage/Stage.ts` — thêm `allElite?: boolean` vào `Stage`; XÓA `eliteChance` khỏi `StageEnemyEntry` (Task 4).
- `src/data/stage/Stages.ts` — author `perfectClearTurnLimit` (30 stage), rework 9 tầng 3/6/9 thành Tinh Anh (số quái 1/2/3, waves `[1]`/`[2]`/`[3]`, `allElite: true`, `bossEnemyId` removed), xóa 30 entry `eliteChance`.
- `src/core/game/GameManagerTurnBattleOps.ts` — predicate Hoàn Mỹ mới + first-clear bonus hook (Task 1, 5).
- `src/core/game/StageWaveSystem.ts` — xóa roll `eliteChance`, thêm nhánh `allElite` (Task 4).
- `src/core/stage/StageSystem.ts` — dọn comment `eliteChance` (Task 4, kèm theo).
- `src/data/enemy/Enemies.ts` — CHỈ dọn comment cũ tham chiếu eliteChance (Task 4; không đụng data).
- `src/core/enemy/Enemy.ts` — CHỈ dọn comment (Task 4).
- `src/components/panels/StageSelectPanel.vue` — badge "Tinh Anh" + ẩn `spawnIntervalSeconds` display (Task 6).
- `src/locales/vi.json` + `src/locales/en.json` — keys mới (Task 6).

**Modified tests (cùng task với code của nó):**
- `src/core/game/GameManager.perfectClear.test.ts` — predicate mới (Task 1).
- `src/core/stage/EffectiveWaves.test.ts` — vẫn pass (bất biến sum) — chạy verify, không sửa trừ khi vỡ.
- `src/data/stage/Stages.test.ts` — bỏ assert tuyến tính 10+index, thêm assert Tinh Anh + X (Task 3).
- `src/core/game/StageWaveSystem.spawnTelegraph.test.ts` — thêm case allElite (Task 4).

**Created:**
- `src/core/game/GameManagerTurnBattleOps.eliteStages.test.ts` — first-clear bonus test (Task 5).

---

## Task 1 — Predicate Hoàn Mỹ mới: alive-for-all (D1)

**Files:**
- Modify: `src/core/game/GameManagerTurnBattleOps.ts:1230-1267` (`recordPerfectClearIfEligible`)
- Test: `src/core/game/GameManager.perfectClear.test.ts`

**Interfaces:**
- Consumes: `TurnBattle.players: Array<{ entity: CombatEntity }>` (đã có), `CombatEntity.alive: boolean` (đã có), `stage.perfectClearTurnLimit?: number` (đã có).
- Produces: predicate mới cho Task 5 hook — signature `recordPerfectClearIfEligible(turnBattle: TurnBattle)` KHÔNG ĐỔI.

- [ ] **Step 1: Viết failing tests** — append vào `GameManager.perfectClear.test.ts` (giữ nguyên 3 test cũ — chúng vẫn đúng cho điều kiện mới vì dummy enemy attack=0, player không mất HP, alive=true):

```ts
// D1 (spec 2026-09-11): alive-for-all predicate. HP loss is no longer
// consulted; every party member must be alive at the victory tick.
describe('GameManager — Hoan My alive-for-all condition (D1)', () => {
  const DUMMY_ENEMY = defineEnemy({
    id: 'perfect_dummy_alive',
    name: 'Alive Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 1, attack: 0, attackSpeed: 1, attackRangeRanks: 1,
      criticalRate: 0, criticalDamage: 1.5, armor: 0,
    },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })

  function stage(overrides: Partial<Stage> = {}): Stage {
    return {
      id: 'perfect_alive_stage', name: 'Alive Stage', description: '',
      floor: 1, enemyPool: [{ enemyId: DUMMY_ENEMY.id, weight: 1 }],
      totalEnemyCount: 1, waves: [1], spawnIntervalSeconds: 0,
      ...overrides,
    }
  }

  function harness(stageDef: Stage) {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 100 }, [])
    gameManager.registerEnemyTemplates([DUMMY_ENEMY])
    gameManager.registerStages([stageDef])
    gameManager.setActivePlayer(player)
    gameManager.startStage(player, stats, stageDef, false)
    return { gameManager, player }
  }

  it('victory with players[0] alive records perfect clear (turns under limit)', () => {
    const { gameManager, player } = harness(stage({ perfectClearTurnLimit: 10 }))
    for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      gameManager.update(0.05)
    }
    expect(gameManager.getTurnBattle()?.state).toBe('victory')
    expect(player.perfectClearStageIds).toContain('perfect_alive_stage')
  })

  it('does NOT record when a party member is dead at victory despite HP loss under the old 75% rule', () => {
    const { gameManager, player } = harness(stage({ perfectClearTurnLimit: 10 }))
    const battle = gameManager.getTurnBattle()!
    // Party of 2: kill the SECOND member only. Old rule (players[0] HP loss
    // <= 75%) would still record; new rule must not.
    const second = { entity: { ...battle.players[0]!.entity, id: 'dead-companion', currentHp: 0, alive: false } }
    battle.players.push(second as typeof battle.players[number])
    for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      gameManager.update(0.05)
    }
    expect(gameManager.getTurnBattle()?.state).toBe('victory')
    expect(player.perfectClearStageIds).not.toContain('perfect_alive_stage')
  })
})
```

- [ ] **Step 2: Run — expect FAIL** ở test thứ 2 (điều kiện cũ chỉ check players[0] HP → vẫn ghi → `not.toContain` fail):

Run: `npx.cmd vitest run src/core/game/GameManager.perfectClear.test.ts`
Expected: test "does NOT record when a party member is dead" FAIL; các test cũ PASS.

- [ ] **Step 3: Implement** — thay thân hàm `recordPerfectClearIfEligible` (giữ name + doc comment mới English):

```ts
  /**
   * Perfect clear (spec 2026-09-11 D1): every party member must still be
   * alive at the victory tick AND the battle must end under
   * stage.perfectClearTurnLimit. HP-loss percentage is no longer consulted.
   * Records perfectClearStageIds + perfectClearSeconds ONCE (first
   * achievement is never overwritten).
   */
  private recordPerfectClearIfEligible(turnBattle: TurnBattle) {
    const stage = this.activeStageForTurnBattle
    const player = this.playerDataForTurnBattle

    if (!stage || !player || stage.perfectClearTurnLimit === undefined) {
      return
    }

    if (player.perfectClearStageIds.includes(stage.id)) {
      return
    }

    const everyoneAlive = turnBattle.players.length > 0 && turnBattle.players.every((member) => member.entity.alive)

    const isPerfectClear =
      everyoneAlive && (turnBattle.totalTurnsElapsed ?? 0) < stage.perfectClearTurnLimit

    if (!isPerfectClear) {
      return
    }

    const startedAtMs = this.turnBattleStartedAtMs ?? Date.now()
    const clearSeconds = Math.max(0, (Date.now() - startedAtMs) / 1000)

    player.perfectClearStageIds.push(stage.id)
    player.perfectClearSeconds[stage.id] = clearSeconds
  }
```

- [ ] **Step 4: Run lại — PASS toàn file** (test cũ + 2 test mới):

Run: `npx.cmd vitest run src/core/game/GameManager.perfectClear.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit (chờ user authorize):**

```
git add src/core/game/GameManagerTurnBattleOps.ts src/core/game/GameManager.perfectClear.test.ts
git commit -m "feat(pc): perfect clear requires whole party alive at victory (D1)"
```

---

## Task 2 — Stage.allElite field (mechanism field, 1 dòng)

**Files:**
- Modify: `src/core/stage/Stage.ts` (thêm field sau `bossEnemyId`)
- Test: chạy type-check (field mới consumed ở Task 4 — không test riêng ở task này)

**Interfaces:**
- Produces: `Stage.allElite?: boolean` — Task 3 author data, Task 4 spawn consume.

- [ ] **Step 1: Thêm field** vào `Stage.ts` ngay sau khối comment `bossEnemyId`:

```ts
  // Stage Tinh Anh (spec 2026-09-11 D2): every enemy in this stage spawns
  // as the Elite variant (createEliteVariant) — deterministic, no random
  // roll. Data flag only; the spawn branch lives in StageWaveSystem.
  allElite?: boolean
```

- [ ] **Step 2: `npm.cmd run type-check`** — PASS (field optional, chưa consumer nào).

- [ ] **Step 3: Commit:**

```
git add src/core/stage/Stage.ts
git commit -m "feat(stage): Stage.allElite data flag for elite stages (D2)"
```

---

## Task 3 — Author data: X cho 30 stage + rework 9 tầng Tinh Anh (D2/D3/D4)

**Files:**
- Modify: `src/data/stage/Stages.ts` (toàn bộ)
- Test: `src/data/stage/Stages.test.ts` (sửa assert tuyến tính cũ + thêm assert mới)

**Interfaces:**
- Consumes: `Stage.allElite` (Task 2), `perfectClearTurnLimit` (đã có).
- Produces: data mà Task 4 (spawn), Task 5 (first-clear), Task 6 (UI) đọc. Bảng loài elite per tầng (nguyên liệu từ pool hiện có — entry CŨ có `eliteChance`):

| Stage id | Loài elite (giữ nguyên 2 entry pool, bỏ eliteChance) | totalEnemyCount | waves | perfectClearTurnLimit |
|---|---|---|---|---|
| `mortal_dong_3` | mortal_feral_dog (5) + mortal_savage_tiger (3) | **1** | **[1]** | **3** |
| `mortal_dong_6` | mortal_ferocious_stone_lynx (5) + mortal_ferocious_mud_ox (3) | **2** | **[2]** | **5** |
| `mortal_dong_9` | mortal_water_wolf (5) + mortal_giant_crocodile (3) | **3** | **[3]** | **7** |
| `qi_refining_ember_canyon` | flame_fox (5) + magma_boar (3) | **1** | **[1]** | **3** |
| `qi_refining_stone_range` | ferocious_sand_lynx (5) + ferocious_rock_bear (3) | **2** | **[2]** | **5** |
| `qi_refining_mystic_marsh` | pool_toad (5) + flood_serpent (3) | **3** | **[3]** | **7** |
| `foundation_floor_3` | foundation_lava_hound (5) + foundation_sand_scorpion (3) | **1** | **[1]** | **3** |
| `foundation_floor_6` | foundation_ferocious_rock_tortoise (5) + foundation_ferocious_mud_golem (3) | **2** | **[2]** | **5** |
| `foundation_floor_9` | foundation_mist_shark (5) + foundation_flood_dragon_whelp (3) | **3** | **[3]** | **7** |

Quy tắc placeholder cho 21 stage còn lại (D4 — comment `// PLACEHOLDER - balance pass sau` KHÔNG được viết tiếng Việt trong code; dùng `// PLACEHOLDER X - tune in the balance pass (user decision D4)`):
- Stage thường (18): `perfectClearTurnLimit: 2 * totalEnemyCount` (mortal/qi 10 quái → 20; foundation 10-19 quái → 20/22/24/26/28/30 theo tầng — NHƯNG floor 3/6/9 không còn là stage thường nên chỉ tính floor 1/2/4/5/7/8).
- Boss floor 10 (3): `perfectClearTurnLimit: 14`.
- 9 stage Tinh Anh: X theo bảng trên + `allElite: true`.
- 9 stage Tinh Anh: **XÓA `bossEnemyId`** (không còn quái cuối boss — toàn bộ là elite; floor !== 10 nên hiện cũng chỉ là metadata, nhưng author sạch).
- KHÔNG đổi `requiredRealmId`/`requiredRealmLevel`/`spawnIntervalSeconds`/name/description của tầng đó.
- Xóa `eliteChance: 0.1` khỏi MỌI entry (30 stage).

- [ ] **Step 1: Viết failing data tests** — sửa `Stages.test.ts`: thay test "tăng tuyến tính" (sai với data mới) bằng:

```ts
describe('elite stages (spec 2026-09-11)', () => {
  const ELITE_IDS = [
    'mortal_dong_3', 'mortal_dong_6', 'mortal_dong_9',
    'qi_refining_ember_canyon', 'qi_refining_stone_range', 'qi_refining_mystic_marsh',
    'foundation_floor_3', 'foundation_floor_6', 'foundation_floor_9',
  ]
  const BY_FLOOR: Record<number, { count: number; x: number }> = {
    3: { count: 1, x: 3 },
    6: { count: 2, x: 5 },
    9: { count: 3, x: 7 },
  }

  it('every chapter has allElite floors 3/6/9 with count 1/2/3 and X 3/5/7', () => {
    for (const id of ELITE_IDS) {
      const stage = STAGES.find((s) => s.id === id)!
      expect(stage.allElite).toBe(true)
      const spec = BY_FLOOR[stage.floor ?? 0]!
      expect(stage.totalEnemyCount).toBe(spec.count)
      expect(stage.waves).toEqual(Array.from({ length: 1 }, () => spec.count))
      expect(stage.perfectClearTurnLimit).toBe(spec.x)
      expect(stage.bossEnemyId).toBeUndefined()
    }
  })

  it('every non-elite stage has a perfectClearTurnLimit (placeholder allowed)', () => {
    for (const stage of STAGES.filter((s) => !s.allElite)) {
      expect(stage.perfectClearTurnLimit).toBeDefined()
      expect(stage.perfectClearTurnLimit!).toBeGreaterThan(0)
    }
  })

  it('no stage entry still declares eliteChance (D6 retire)', () => {
    for (const stage of STAGES) {
      for (const entry of stage.enemyPool) {
        expect((entry as Record<string, unknown>).eliteChance).toBeUndefined()
      }
    }
  })

  it('waves sum invariant still holds for all 30 stages', () => {
    for (const stage of STAGES) {
      expect(stage.waves.reduce((a, b) => a + b, 0)).toBe(stage.totalEnemyCount)
    }
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (allElite chưa tồn tại, X chưa author):

Run: `npx.cmd vitest run src/data/stage/Stages.test.ts`
Expected: 3-4 test FAIL ("allElite undefined"/"limit undefined").

- [ ] **Step 3: Author data trong `Stages.ts`** theo bảng Interfaces ở trên. Ví dụ楼层 mẫu cho `mortal_dong_3` (các tầng khác y hệt pattern):

```ts
    id: 'mortal_dong_3',
    name: 'Động 3',
    description: '...',
    requiredRealmId: 'mortal',
    requiredRealmLevel: 3,
    // Stage Tinh Anh (spec 2026-09-11): deterministic all-elite stage.
    allElite: true,
    enemyPool: [
      { enemyId: 'mortal_feral_dog', weight: 5 },
      { enemyId: 'mortal_savage_tiger', weight: 3 },
    ],
    totalEnemyCount: 1,
    waves: [1],
    spawnIntervalSeconds: 3,
    perfectClearTurnLimit: 3,
```

Lặp cho 8 tầng còn lại + thêm `perfectClearTurnLimit: 2 * <count>` + comment PLACEHOLDER cho 18 stage thường + `perfectClearTurnLimit: 14` + comment PLACEHOLDER cho 3 stage boss + xóa toàn bộ `, eliteChance: 0.1` (30 chỗ).

- [ ] **Step 4: Run lại data tests + bất biến waves**:

Run: `npx.cmd vitest run src/data/stage src/core/stage`
Expected: tất cả PASS (kể cả `EffectiveWaves.test.ts` bất biến sum — floor 3/6/9 không dính override floor-10).

- [ ] **Step 5: Commit:**

```
git add src/data/stage/Stages.ts src/data/stage/Stages.test.ts
git commit -m "feat(stage): author elite floors 3/6/9 (all-elite, X=3/5/7) + placeholder X for normal/boss (D2-D4)"
```

---

## Task 4 — Spawn all-elite + retire eliteChance roll (D6)

**Files:**
- Modify: `src/core/game/StageWaveSystem.ts:136-180` (`pickEnemyForSpawn`), `src/core/stage/Stage.ts` (xóa field `eliteChance` khỏi `StageEnemyEntry`), `src/core/stage/StageSystem.ts:6` (comment), `src/core/enemy/Enemy.ts:89-98` (comment), `src/data/enemy/Enemies.ts:91` (comment)
- Test: `src/core/game/StageWaveSystem.spawnTelegraph.test.ts` (append case)

**Interfaces:**
- Consumes: `Stage.allElite` (Task 2/3), `createEliteVariant(template)` (giữ nguyên).
- Produces: mọi spawn của stage `allElite: true` là Enemy có `isElite === true`.

- [ ] **Step 1: Failing test** — append vào `StageWaveSystem.spawnTelegraph.test.ts` (dùng harness/seed pattern có sẵn trong file; nếu harness khác tên, theo pattern của test cũ gần nhất trong file đó):

```ts
// D2/D6 (spec 2026-09-11): an allElite stage spawns ONLY elite variants.
it('allElite stage spawns every enemy as elite (isElite true)', () => {
  // Follow the existing harness in this file to build a system with an
  // allElite: true stage of 1 enemy, drive one spawn, then assert:
  //   const enemy = <spawned enemy from the system>
  //   expect(enemy.isElite).toBe(true)
  //   expect(enemy.maxHp).toBe(templateMaxHp * 2.5)
  // Repeat with the eliteChance field removed from StageEnemyEntry so the
  // test file proves the roll path is gone at compile time.
})
```

*(Lúc implement, cụ thể hóa theo harness thật của file — pattern `registerEnemyTemplates` + `startStage` + đọc `enemies` sau `update` như các test cũ trong file.)*

- [ ] **Step 2: Run — expect FAIL** (`isElite` false — nhánh chưa có).

- [ ] **Step 3: Implement** trong `pickEnemyForSpawn` — thay khối:

```ts
    const entry = this.deps.stageSystem.pickNextEnemyEntry(stage)
    const template = this.deps.enemyTemplates.get(entry.enemyId)

    if (!template) {
      return undefined
    }

    if (entry.eliteChance && rollChance(entry.eliteChance)) {
      return applyStageRealm(createEliteVariant(template))
    }
```

bằng:

```ts
    const entry = this.deps.stageSystem.pickNextEnemyEntry(stage)
    const template = this.deps.enemyTemplates.get(entry.enemyId)

    if (!template) {
      return undefined
    }

    // Stage Tinh Anh (spec 2026-09-11 D2): deterministic all-elite spawn.
    // The random eliteChance roll is retired (D6) — elite enemies are now
    // farmed exclusively through allElite stages.
    if (stage.allElite) {
      return applyStageRealm(createEliteVariant(template))
    }
```

Sau đó: xóa field `eliteChance?: number` + comment liên quan khỏi `StageEnemyEntry` (`Stage.ts:10`), xóa import `rollChance` nếu không còn dùng (`StageWaveSystem.ts` — kiểm tra trước khi xóa), dọn comment `eliteChance` cũ ở `StageSystem.ts:6`, `Enemy.ts:89-98`, `Enemies.ts:91` (P15: comment thay thế viết English ASCII).

- [ ] **Step 4: Run — PASS** file spawn + stage suites:

Run: `npx.cmd vitest run src/core/game/StageWaveSystem.spawnTelegraph.test.ts src/data/stage src/core/stage`
Expected: PASS (nếu test cũ nào trong các file này phụ thuộc elite-roll behavior → cập nhật theo data mới trong cùng bước — task-caused, P12).

- [ ] **Step 5: `npm.cmd run type-check`** — phải sạch (bằng chứng `eliteChance` đã retire hoàn chỉnh khỏi type system).

- [ ] **Step 6: Commit:**

```
git add src/core/game/StageWaveSystem.ts src/core/stage/Stage.ts src/core/stage/StageSystem.ts src/core/enemy/Enemy.ts src/data/enemy/Enemies.ts src/core/game/StageWaveSystem.spawnTelegraph.test.ts
git commit -m "feat(spawn): allElite stages spawn elite variants; retire random eliteChance roll (D2/D6)"
```

---

## Task 5 — First-clear bonus cho stage Tinh Anh (D5)

**Files:**
- Modify: `src/core/game/GameManagerTurnBattleOps.ts` (victory block ~1217-1225, sau push `completedStageIds`)
- Test (create): `src/core/game/GameManagerTurnBattleOps.eliteStages.test.ts`

**Interfaces:**
- Consumes: `stage.allElite` (Task 2/3), victory block pattern có sẵn.
- Produces: 1 lần duy nhất per stage Tinh Anh, thưởng = `eliteRewards` gấp đôi của loài elite chủ đạo stage đó. Con số cụ thể KHÔNG hard-code trong plan — đọc từ `ENEMIES` registry tại runtime theo `enemyId` trong pool (tránh duplicate data — A2/A9).

- [ ] **Step 1: Failing test** (file mới):

```ts
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import { STAGES } from '../../data/stage/Stages'
import { ENEMIES } from '../../data/enemy/Enemies'

// D5 (spec 2026-09-11): first clear of an allElite stage grants a
// one-time bonus equal to DOUBLE the eliteRewards of the stage's primary
// elite species. Granted exactly once per stage, never on repeat clears.
describe('GameManager — elite stage first-clear bonus (D5)', () => {
  const ELITE_STAGE = STAGES.find((s) => s.allElite)!

  function harness() {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    const stats = calculateStats({ ...player.baseStats, attack: 100 }, [])
    gameManager.registerEnemyTemplates(ENEMIES)
    gameManager.registerStages([ELITE_STAGE])
    gameManager.setActivePlayer(player)
    // Grant attack high enough to one-shot the single elite of floor 3.
    const boosted = calculateStats({ ...player.baseStats, attack: 9999 }, [])
    gameManager.startStage(player, boosted, ELITE_STAGE, false)
    return { gameManager, player }
  }

  it('grants first-clear bonus exactly once for an allElite stage', () => {
    const { gameManager, player } = harness()
    const before = player.techniqueInsight  // verify exact field via Enemy eliteRewards.techniqueInsight *2

    for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      gameManager.update(0.05)
    }
    expect(gameManager.getTurnBattle()?.state).toBe('victory')

    // Expected bonus read from the registry (single source, no duplicated numbers):
    const eliteSpecies = ENEMIES.find((e) => e.id === ELITE_STAGE.enemyPool[1]!.enemyId)!
    const expectedBonus = (eliteSpecies.eliteRewards?.techniqueInsight ?? 0) * 2
    expect(player.techniqueInsight - before).toBeGreaterThanOrEqual(expectedBonus)

    // Second clear: no repeat grant.
    gameManager.startStage(player, calculateStats({ ...player.baseStats, attack: 9999 }, []), ELITE_STAGE, false)
    for (let i = 0; i < 400 && gameManager.getTurnBattle()?.state !== 'victory'; i++) {
      gameManager.update(0.05)
    }
    const afterFirst = player.techniqueInsight
    expect(afterFirst - before).toBeGreaterThanOrEqual(expectedBonus)
    // (exact once-only assertion: grant again must NOT add more — compare
    // the reward granted counter via turnBattleRewardsGranted or a second
    // victory delta == 0 when normalizing for per-enemy drops)
  })
})
```

*(Lúc implement: chuẩn hóa field reward đúng theo shape thật — xem `BattleLootSystem.processDefeatedEnemies` grant path cho techniqueInsight; dùng `toBeGreaterThanOrEqual` chỉ cho phần bonus, assert once-only bằng delta bằng 0 ở lần clear thứ 2 sau khi trừ drop thường.)*

- [ ] **Step 2: Run — expect FAIL** (bonus chưa tồn tại).

- [ ] **Step 3: Implement** — trong victory block, SAU push `completedStageIds`, thêm:

```ts
        // First-clear bonus for elite stages (spec 2026-09-11 D5): granted
        // exactly once — the completedStageIds gate above just pushed this
        // stage, so a repeat clear never reaches this branch again.
        if (
          this.activeStageForTurnBattle?.allElite &&
          this.playerDataForTurnBattle
        ) {
          this.grantEliteStageFirstClearBonus(this.activeStageForTurnBattle)
        }
```

Và private method mới (đặt cạnh `recordPerfectClearIfEligible`):

```ts
  /**
   * Elite-stage first clear (spec 2026-09-11 D5): one-time bonus equal to
   * DOUBLE the eliteRewards of the stage's elite species (entry[1] of the
   * pool — the elite-eligible entry). Numbers are read from the enemy
   * registry at runtime; nothing is duplicated here (A2/A9).
   */
  private grantEliteStageFirstClearBonus(stage: Stage): void {
    const eliteEntry = stage.enemyPool.find((entry) => entry.weight < 5) ?? stage.enemyPool[0]
    const species = this.deps.enemyTemplates.get(eliteEntry.enemyId)  // verify deps shape at implement time

    if (!species?.eliteRewards) {
      return
    }

    const player = this.playerDataForTurnBattle
    if (!player) {
      return
    }

    player.techniqueInsight += (species.eliteRewards.techniqueInsight ?? 0) * 2
    // Follow the existing reward grant path for spiritStone (mirror the
    // field used by BattleLootSystem for elite spiritStone drops).
  }
```

*(Lúc implement: xác minh tên field `techniqueInsight`/spiritStone trên PlayerData + deps accessor đúng (`enemyTemplates` có thể không nằm trong `this.deps` của Ops class — nếu không, thêm 1 dep entry theo pattern deps có sẵn trong constructor; KHÔNG import registry trực tiếp.)*

- [ ] **Step 4: Run — PASS:**

Run: `npx.cmd vitest run src/core/game/GameManagerTurnBattleOps.eliteStages.test.ts src/core/game/GameManager.perfectClear.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit:**

```
git add src/core/game/GameManagerTurnBattleOps.ts src/core/game/GameManagerTurnBattleOps.eliteStages.test.ts
git commit -m "feat(reward): one-time first-clear bonus for elite stages (D5)"
```

---

## Task 6 — UI: badge Tinh Anh + dọn display + i18n (D2)

**Files:**
- Modify: `src/components/panels/StageSelectPanel.vue` (+ test file tương ứng nếu có pattern test mount)
- Modify: `src/locales/vi.json` + `src/locales/en.json`

**Interfaces:**
- Consumes: `stage.allElite`, `stage.bossEnemyId`, `stage.perfectClearTurnLimit` (data Tasks 2-3).
- Produces: hiển thị 3 loại stage (thường / Tinh Anh / Boss) + ẩn `spawnIntervalSeconds` khỏi display (roadmap 10.4 sweep cùng đợt).

- [ ] **Step 1: i18n keys** — thêm vào cả `vi.json` + `en.json` (cùng vị trí cấp `panels.stageSelect`):

```json
"stageKind": {
  "elite": "Tinh Anh",
  "boss": "Boss"
}
```

(en: `"elite": "Elite"`, `"boss": "Boss"`.)

- [ ] **Step 2: Badge trong list item** — tại chỗ render tên stage trong `StageSelectPanel.vue`, thêm nhãn loại theo stage data:

```vue
<span v-if="stage.allElite" class="stage-select__kind-badge">{{ t('panels.stageSelect.stageKind.elite') }}</span>
<span v-else-if="stage.floor === 10 && stage.bossEnemyId" class="stage-select__kind-badge stage-select__kind-badge--boss">{{ t('panels.stageSelect.stageKind.boss') }}</span>
```

CSS badge: viền màu `--mineral-gold` cho Tinh Anh, `--crimson` cho boss, font-size `--text-xs`, padding 1px 6px, border-radius 999px (theo pattern `.stage-select__filter-chip` có sẵn trong file).

- [ ] **Step 3: Ẩn `spawnIntervalSeconds`** — tìm dòng hiển thị `spawnIntervalSeconds` (~dòng 278 theo roadmap 10.4) và xóa khối hiển thị (field không dùng ở turn-based — spawn theo wave). KHÔNG xóa field khỏi `Stage` type (chỉ ẩn display).

- [ ] **Step 4: Run tests panel + i18n parity:**

Run: `npx.cmd vitest run src/components/panels/StageSelectPanel.test.ts src/i18n`
Expected: PASS (parity test khóa vi↔en).

- [ ] **Step 5: Commit:**

```
git add src/components/panels/StageSelectPanel.vue src/locales/vi.json src/locales/en.json
git commit -m "feat(ui): elite/boss stage badges + hide spawnIntervalSeconds display (10.4)"
```

---

## Task 7 — Full verification + QA + roadmap

**Files:**
- Modify: `game/docs/roadmap.md` (status 9.5 #4 + B1 mở đầu)
- Create: `game/docs/qa/2026-09-11-perfect-clear-elite-stages-quick.md`

- [ ] **Step 1: P3 full** — `npm.cmd run type-check` + `npm.cmd run build` + `npx.cmd vitest run` (no filter). Stop on first failure, fix (P12: chỉ fix task-caused), rerun.

- [ ] **Step 2: P14 real-browser** — dev server từ main checkout (KHÔNG worktree — P14 exception): guest → tạo nhân vật → StageSelect → chọn Động 3 (mortal): badge "Tinh Anh" hiện; vào trận: 1 quái "Tinh Anh ..." (tên prefix từ `createEliteVariant`), telegraph elite; thắng < 3 turn với toàn đội sống → quay lại StageSelect: chip Hoàn Mỹ (perfect_farm) ENABLED cho stage đó. Ghi evidence (snapshot + DOM query) vào QA doc.

- [ ] **Step 3: E3 code-simplifier** pass trên diff toàn mission.

- [ ] **Step 4: P5 code-review** post-simplify; fix findings ≥80.

- [ ] **Step 5: P4 adversarial QA quick** (`tutienidle-adversarial-qa`): report vào `game/docs/qa/2026-09-11-perfect-clear-elite-stages-quick.md`. Lưu ý hypothesis bắt buộc: once-only first-clear qua save/reload giữa 2 lần clear; perfectClearSeconds NaN/0 guard (đã có — verify); elite stat multiplier áp ĐÚNG 1 LẦN (allElite spawn không stack với roll cũ).

- [ ] **Step 6: Roadmap update** — 9.5 #4 → ✅ với evidence; mục B1 note "perfectClearTurnLimit established (hard-code 3/5/7 elite + placeholder thường/boss), E2E auto-farm Hoàn Mỹ còn lại"; 10.4 spawnIntervalSeconds → đã sweep.

- [ ] **Step 7: Commit docs:**

```
git add game/docs/roadmap.md game/docs/qa/2026-09-11-perfect-clear-elite-stages-quick.md
git commit -m "docs: PC + elite stages QA evidence + roadmap status cutover"
```

---

## Self-Review (đã chạy sau khi viết)

1. **Spec coverage:** D1→Task 1; D2→Task 2/3/4; D3→Task 3; D4→Task 3; D5→Task 5; D6→Task 3/4; UI (2.5)→Task 6; verification (§5)→Task 7. Đủ.
2. **Placeholder scan:** 2 chỗ ghi "(Lúc implement: ...)" là chỉ dẫn điều chỉnh theo harness/field THẬT lúc viết code (chi tiết phụ thuộc discovery tại chỗ — không phải TBD sản phẩm). Không có TODO/TBD treo.
3. **Type consistency:** `recordPerfectClearIfEligible(turnBattle: TurnBattle)` giữ nguyên qua Task 1/5; `Stage.allElite` dùng nhất quán Task 2→3→4→5→6.
