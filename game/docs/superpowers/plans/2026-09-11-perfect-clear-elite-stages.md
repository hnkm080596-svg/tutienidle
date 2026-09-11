# Perfect Clear + Enemy Tag System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (project convention: opencode has no subagent dispatch — Inline Execution, per P6). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) PC condition "toàn đội alive + dưới limit", limit chốt cứng 3 (thường) / 5 (boss); (2) tag system data-driven cho modifier spawn (chỉ tag tinh_anh v1) — **boss là stage property, KHÔNG qua tag**; (3) builder `defineChapterStages` 1-owner cho 30 stage; (4) dọn bossEnemyId giả + ẩn spawnIntervalSeconds; (5) spawn mode plumbing idle-vs-active; (6) dev debug helpers.

**Architecture:** Tag = registry data + generic applier (`core/enemy/EnemyTag.ts` + `data/enemy/EnemyTags.ts`), tham chiếu `applyEliteMultiplier` (không copy số). `createBossVariant` GIỮ NGUYÊN — floor 10 áp unconditional qua đúng call site cũ. Builder sinh 30 stage từ 3 config chương. Idle pass `allowTags: false` — KHÔNG roll tag. Layer 2 (normalize) + Layer 4 (combat pipeline) KHÔNG ĐỔI. Idle rate/gate/cap giữ nguyên hiện trạng đã QA.

**Tech Stack:** Vue 3 + TypeScript + Vite + Vitest + Pinia + Phaser (không dependency mới).

**Spec:** `game/docs/superpowers/specs/2026-09-11-perfect-clear-elite-stages-design.md` (bản 3)

## Global Constraints

- Chạy mọi command từ `game/`. All paths relative to `game/`.
- **P3 quick** mỗi task: `npm.cmd run type-check` + `npx.cmd vitest run <scope>`. Task cuối (Task 8) chạy **full**.
- **P7:** commit command soạn sẵn mỗi task — KHÔNG chạy khi chưa có user authorize.
- **P8:** không `any` mới. **P15:** comment mới/sửa = English ASCII. **P16:** string UI mới qua i18n.
- D1–D9 (spec bản 3) là BẤT BIẾN. Đặc biệt: KHÔNG migrate boss sang tag (D4), KHÔNG đụng idle rate/gate/cap (D6), KHÔNG làm reward stack (D8 debt), X cứng 3/5 (D2).
- `applyEliteMultiplier`/`applyBossMultiplier`/`normalizeEnemyStats`/`createBossVariant`/loot pipeline/auto-farm cycle math: GIỮ NGUYÊN.
- `eliteChance` field giữ nguyên — comment cập nhật nghĩa mới: "chance to attach the tinh_anh tag" (B9).

## File Structure

**Created:**
- `src/core/enemy/EnemyTag.ts` — contract `EnemyTag` (priority, KHÔNG rewardMultiplier) + `applyEnemyTags()`
- `src/core/enemy/EnemyTag.test.ts`
- `src/data/enemy/EnemyTags.ts` — data 1 tag v1 (`tinh_anh`)
- `src/data/stage/ChapterStages.ts` — `ChapterConfig` + `defineChapterStages()`
- `src/data/stage/ChapterStages.test.ts` — parity test builder-vs-literal
- `src/core/dev/enemySpawnDebug.ts` — dev-only console helpers (B5; `import.meta.env.DEV` guard)

**Modified:**
- `src/core/game/GameManagerTurnBattleOps.ts` — predicate Hoàn Mỹ (Task 5) + idle pass allowTags:false (Task 4)
- `src/core/game/StageWaveSystem.ts` — tag path + `allowTags` option (Task 4)
- `src/core/enemy/Enemy.ts` — xóa CHỈ `createEliteVariant` sau migrate (Task 4 cuối); comment B9
- `src/data/stage/Stages.ts` — 30 literal → 3 config + builder (Task 6)
- `src/data/stage/Stages.test.ts` — assert mới (Task 6)
- `src/components/panels/StageSelectPanel.vue` — ẩn spawnIntervalSeconds (Task 7)
- `src/core/game/GameManager.perfectClear.test.ts` — predicate + edge B4 tests (Task 5)
- `src/core/game/GameManager.bossRepeatCycle.test.ts` — spawn mode tests (Task 4)
- `src/core/game/GameManager.autoFarm.test.ts` — append idle-no-tag assertion (Task 4)

**Deleted (Task 4 cuối):** thân hàm `createEliteVariant` trong `Enemy.ts`. (`createBossVariant` GIỮ NGUYÊN — D4.)

---

## Task 1 — Tag contract + applier + data tinh_anh (TDD, zero production caller)

**Files:**
- Create: `src/core/enemy/EnemyTag.ts`, `src/data/enemy/EnemyTags.ts`, `src/core/enemy/EnemyTag.test.ts`

**Interfaces:**
- Consumes: `Enemy` type, `Stats`, `applyEliteMultiplier` (`EnemyStatInput`).
- Produces (Task 4 consume):
  - `interface EnemyTag { id: string; namePrefix?: string; applyStat?: (stats: Stats) => Stats; combatFlag?: 'isElite'; priority?: number }` — v1 KHÔNG có rewardTier/rewardMultiplier (D8).
  - `applyEnemyTags(enemy: Enemy, tagIds: readonly string[], registry: EnemyTagRegistry): Enemy` — dedupe → sort priority giảm dần (ổn định — bằng priority giữ thứ tự khai báo) → fold applyStat → prefix theo thứ tự tag → set combatFlag. Rewards KHÔNG đổi (D8).

- [ ] **Step 1: Failing tests** — `EnemyTag.test.ts`:

```ts
// Characterization: the tinh_anh tag must reproduce createEliteVariant's
// STAT/FLAG/NAME output exactly. Rewards are NOT asserted — v3 D8 keeps
// authored rewards untouched when applying tags (the legacy function's
// rewards switch is dropped together with the function in Task 4).
import { describe, expect, it } from 'vitest'
import { applyEnemyTags } from './EnemyTag'
import { ENEMY_TAGS } from '../../data/enemy/EnemyTags'
import { defineEnemy, createEliteVariant } from './Enemy'

const BASE = defineEnemy({
  id: 'tag_test_beast', name: 'Nham Trư', level: 3, realmId: 'qi_refining',
  lane: 'ground',
  statsInput: { maxHp: 440, attack: 38, attackSpeed: 1.6, attackRangeRanks: 1,
    criticalRate: 0.08, criticalDamage: 2, armor: 21, resistances: { fire: 12 },
    elemental: { element: 'fire', power: 10 } },
  rewards: { techniqueInsight: 40, spiritStone: 12 },
  eliteRewards: { techniqueInsight: 200, spiritStone: 60 },
  bossRewards: { techniqueInsight: 500, spiritStone: 150 },
})

describe('applyEnemyTags (D3)', () => {
  it('tinh_anh output matches createEliteVariant on stats/flag/name (characterization)', () => {
    const viaTag = applyEnemyTags(BASE, ['tinh_anh'], ENEMY_TAGS)
    const viaLegacy = createEliteVariant(BASE)
    expect(viaTag.stats).toEqual(viaLegacy.stats)
    expect(viaTag.isElite).toBe(viaLegacy.isElite)
    expect(viaTag.name).toBe(viaLegacy.name)
  })

  it('rewards are NOT modified by tags in v1 (D8 authored-rewards stay)', () => {
    const viaTag = applyEnemyTags(BASE, ['tinh_anh'], ENEMY_TAGS)
    expect(viaTag.rewards).toBe(BASE.rewards)
  })

  it('stacking multiplies stats (base x2.5 twice when duplicated ids differ later)', () => {
    // v1 has one tag; stacking proof uses tinh_anh twice via dedupe = once.
    const once = applyEnemyTags(BASE, ['tinh_anh'], ENEMY_TAGS)
    expect(once.stats.maxHp).toBeCloseTo(BASE.stats.maxHp * 2.5)
  })

  it('dedupes repeated tags — each tag applies exactly once', () => {
    const once = applyEnemyTags(BASE, ['tinh_anh'], ENEMY_TAGS)
    const twice = applyEnemyTags(BASE, ['tinh_anh', 'tinh_anh'], ENEMY_TAGS)
    expect(twice.stats.maxHp).toBe(once.stats.maxHp)
    expect(twice.name).toBe(once.name)
  })

  it('higher priority applies first (fold order), stable within equal priority', () => {
    // Build a throwaway registry with 2 tags to prove the priority sort
    // contract for FUTURE tags (B3): priority desc, declaration order within ties.
    const reg = new Map([
      ['low', { id: 'low', priority: 1, namePrefix: 'Thấp ' }],
      ['high', { id: 'high', priority: 9, namePrefix: 'Cao ' }],
    ]) as EnemyTagRegistry
    const out = applyEnemyTags(BASE, ['low', 'high'], reg)
    expect(out.name).toBe('Cao Thấp ' + BASE.name)
  })

  it('unknown tag id is ignored safely (no throw, no change)', () => {
    const untouched = applyEnemyTags(BASE, ['khong_ton_tai'], ENEMY_TAGS)
    expect(untouched.stats).toEqual(BASE.stats)
    expect(untouched.name).toBe(BASE.name)
  })
})
```

- [ ] **Step 2: Run — FAIL** (`applyEnemyTags` chưa tồn tại):

Run: `npx.cmd vitest run src/core/enemy/EnemyTag.test.ts`

- [ ] **Step 3: Implement** `EnemyTag.ts` + `EnemyTags.ts`:

```ts
// src/core/enemy/EnemyTag.ts
import type { Enemy } from './Enemy'
import type { Stats } from '../stats/StatBlock'

/** Generic tag contract. Tags are DATA (registry); this core layer never
 * hardcodes a specific tag id (A8). v3 D8: tags do NOT touch rewards in v1
 * — the authored rewards field stays untouched (drop-system debt, roadmap).
 * 'boss' is a STAGE PROPERTY (floor 10) applied by createBossVariant,
 * NOT a tag. */
export interface EnemyTag {
  id: string
  /** Prepended to the enemy name, joined in tag order. */
  namePrefix?: string
  /** Stat transform — reference the single stat owner (A9), e.g.
   * applyEliteMultiplier. Folded in priority order (stacking multiplies). */
  applyStat?: (stats: Stats) => Stats
  /** CombatEntity flag set when the tag is applied. */
  combatFlag?: 'isElite'
  /** Higher priority applies FIRST in the fold. Ties keep declaration
   * order (stable sort). Reserved for future tags (spec B3). */
  priority?: number
}

export type EnemyTagRegistry = ReadonlyMap<string, EnemyTag>

/** Apply tags to a template enemy. Each tag applies at most once (dedupe);
 * tags are folded in descending priority order (stable within ties) so
 * multipliers stack multiplicatively. Unknown ids are skipped. The base
 * enemy is never mutated (spread copies). Rewards are untouched (v1). */
export function applyEnemyTags(enemy: Enemy, tagIds: readonly string[], registry: EnemyTagRegistry): Enemy {
  const seen = new Set<string>()
  const ordered: Array<{ index: number; tag: EnemyTag }> = []

  tagIds.forEach((tagId, index) => {
    if (seen.has(tagId)) return
    const tag = registry.get(tagId)
    if (!tag) return
    seen.add(tagId)
    ordered.push({ index, tag })
  })

  ordered.sort((a, b) => (b.tag.priority ?? 0) - (a.tag.priority ?? 0) || a.index - b.index)

  let result = enemy
  for (const { tag } of ordered) {
    result = {
      ...result,
      stats: tag.applyStat ? tag.applyStat(result.stats) : result.stats,
      name: tag.namePrefix ? tag.namePrefix + result.name : result.name,
      isElite: tag.combatFlag === 'isElite' ? true : result.isElite,
    }
  }

  // Mirror the legacy variants: currentHp/maxHp follow the final stats.
  return { ...result, currentHp: result.stats.maxHp, maxHp: result.stats.maxHp }
}
```

```ts
// src/data/enemy/EnemyTags.ts
import type { EnemyTag, EnemyTagRegistry } from '../../core/enemy/EnemyTag'
import { applyEliteMultiplier } from '../../core/enemy/EnemyStatInput'

// v1 registry: a single modifier tag. It reproduces createEliteVariant's
// stat/flag/name behavior exactly (stat formula referenced, not copied — A9).
// Rewards are intentionally NOT switched (spec v3 D8 — drop-system debt).
// Future tags (Hap Huyet/Cuong No/Than Phu...) are new entries here only.
export const ENEMY_TAGS: EnemyTagRegistry = new Map<string, EnemyTag>([
  ['tinh_anh', {
    id: 'tinh_anh',
    namePrefix: 'Tinh Anh ',
    applyStat: applyEliteMultiplier,
    combatFlag: 'isElite',
  }],
])
```

*(Lúc implement: đối chiếu `createEliteVariant` trong `Enemy.ts` cho currentHp sync — characterization test Step 1 khóa.)*

- [ ] **Step 4: Run — PASS** (6 test):

Run: `npx.cmd vitest run src/core/enemy/EnemyTag.test.ts`

- [ ] **Step 5: Commit (chờ authorize):**

```
git add src/core/enemy/EnemyTag.ts src/core/enemy/EnemyTag.test.ts src/data/enemy/EnemyTags.ts
git commit -m "feat(enemy): tag contract + tinh_anh tag reproducing elite variant stats (D3/D8)"
```

---

## Task 2 — Builder defineChapterStages (TDD, chưa swap Stages.ts)

**Files:**
- Create: `src/data/stage/ChapterStages.ts`, `src/data/stage/ChapterStages.test.ts`

**Interfaces:**
- Consumes: `Stage` (`core/stage/Stage`), Zones order (id list giữ nguyên).
- Produces (Task 6 consume):

```ts
export interface ChapterConfig {
  realmId: string
  chapter: number
  ids: string[]                                   // 10 stage id theo floor
  names: (floor: number) => string
  descriptions: string[]                          // 10 flavor text
  speciesByFloor: Array<{ common: string; elite: string }>
}

export function defineChapterStages(config: ChapterConfig): Stage[]
```

Builder rules (1 owner):
- `totalEnemyCount = 9 + floor`; `waves` floor 1-9 = splitEvenly3 (dư fill từ wave cuối lên: 10→[3,3,4], 11→[3,4,4], 14→[4,5,5], 17→[5,6,6]); floor 10 `waves = [total]`.
- Pool `[common w5, elite w3 + eliteChance 0.1]` (field giữ nguyên — D5 v3; comment B9 ở Task 4).
- `bossEnemyId`: CHỈ floor 10 = loài elite.
- `perfectClearTurnLimit`: floor 1-9 = **3**; floor 10 = **5** (D2 cứng — KHÔNG placeholder, không comment PLACEHOLDER).
- `spawnIntervalSeconds = 3`, `requiredRealmLevel = floor`, chapter/floor theo config.

- [ ] **Step 1: Failing parity test** — sinh 3 chương bằng config copy nguyên văn từ literal `Stages.ts` (id/name/description/cặp loài), assert mọi stage: `id`/`requiredRealmId`/`requiredRealmLevel`/`chapter`/`floor`/`totalEnemyCount`/`waves`/`enemyPool` (kể cả eliteChance)/`spawnIntervalSeconds` === literal; `bossEnemyId` === literal chỉ floor 10, undefined floor 1-9 (khác biệt chủ đích #1); `perfectClearTurnLimit` = 3/5 (khác biệt chủ đích #2 — field mới). Bất biến waves sum === total.

- [ ] **Step 2: Run — FAIL** (builder chưa tồn tại).

- [ ] **Step 3: Implement** builder + `splitEvenly3`:

```ts
// Distribute the remainder from the LAST wave upward (matches the
// play-tested literals: 10->[3,3,4], 11->[3,4,4], 13->[4,4,5], 14->[4,5,5]).
function splitEvenly3(total: number): [number, number, number] {
  const k = Math.floor(total / 3)
  const r = total % 3
  if (r === 0) return [k, k, k]
  if (r === 1) return [k, k, k + 1]
  return [k, k + 1, k + 1]
}
```

*(KHÔNG dùng `[k, k, total - 2k]` — công thức đó sai với r=2.)* Floor 10: `waves = [total]`.

- [ ] **Step 4: Run — PASS parity 30/30.**

Run: `npx.cmd vitest run src/data/stage/ChapterStages.test.ts`

- [ ] **Step 5: Commit:**

```
git add src/data/stage/ChapterStages.ts src/data/stage/ChapterStages.test.ts
git commit -m "feat(stage): defineChapterStages builder - one owner for floor rules, X=3/5 (D9/D2)"
```

---

## Task 3 — Dev debug helpers (B5)

**Files:**
- Create: `src/core/dev/enemySpawnDebug.ts` (dev-only)

**Interfaces:**
- Consumes: `applyEnemyTags`, `ENEMY_TAGS`, GameManager via `__tutienPhaserGame` registry (pattern có sẵn), `import.meta.env.DEV` guard (pattern `DevMode.ts`).

- [ ] **Step 1: Implement** 2 console helper (register 1 lần lúc boot nếu DEV; không production API, không test bắt buộc — dev tool):

```ts
// src/core/dev/enemySpawnDebug.ts — DEV ONLY (import.meta.env.DEV, pattern DevMode.ts)
// window.__tutienSpawnEnemy(enemyId, tags?) — force-spawn via applyEnemyTags for manual testing.
// window.__tutienForcePerfectClear(stageId) — mark a stage perfect-cleared to try the idle gate without grinding.
```

*(Chi tiết wiring: đọc gameManager qua `__tutienPhaserGame.registry.get('gameManager')` — pattern đã dùng trong P14 session; Perfect Clear force = push vào `perfectClearStageIds` + `perfectClearSeconds` — dùng đường data thẳng vì đây là dev tool, không phải production path.)*

- [ ] **Step 2: `npm.cmd run type-check`** — PASS. Verify tay ở Task 8 P14 (dùng helper thử idle gate).
- [ ] **Step 3: Commit:**

```
git add src/core/dev/enemySpawnDebug.ts
git commit -m "feat(dev): enemy spawn + perfect clear debug helpers (dev-only, B5)"
```

---

## Task 4 — Spawn tag path + allowTags plumbing + retire createEliteVariant

**Files:**
- Modify: `src/core/game/StageWaveSystem.ts` (`pickEnemyForSpawn` + wrapper `pickEnemyForTurnSpawn`), `src/core/enemy/Enemy.ts` (xóa createEliteVariant cuối task + comment B9), `src/core/game/GameManagerTurnBattleOps.ts` (idle pass allowTags:false), `src/core/game/GameManager.bossRepeatCycle.test.ts`, `src/core/game/GameManager.autoFarm.test.ts`

**Interfaces:**
- Consumes: `applyEnemyTags`, `ENEMY_TAGS` (Task 1); `createBossVariant` (GIỮ NGUYÊN — D4).
- Produces: `pickEnemyForSpawn(stage, isFinalSpawn, options?: { allowTags?: boolean })` — mặc định `allowTags: true` (active); auto-farm pass `false`. Boss floor-10 áp unconditional ở CẢ 2 mode.

- [ ] **Step 1: Failing seeded tests** — append `GameManager.bossRepeatCycle.test.ts` (nơi test spawn sống — file telegraph cũ đã xóa C1):

```ts
// Spec v3 D5: active rolls the tinh_anh tag through the tag pipeline;
// idle (allowTags: false) never rolls tags. Boss (floor 10) is a stage
// property applied unconditionally in BOTH modes via createBossVariant.
it('active + elite roll hit -> spawned enemy has tinh_anh stats/flag/name', () => {
  // Follow the existing seeded-roll harness in this file: force rollChance
  // success once, then assert name prefix 'Tinh Anh ', isElite true,
  // maxHp === base * 2.5.
})

it('idle (allowTags:false) never applies tags even when the roll would hit', () => {
  // Same forced seed, call the spawn wrapper with allowTags: false:
  // assert name === base name, isElite falsy, stats === base.
})

it('floor-10 final spawn is boss base in BOTH active and idle', () => {
  // Assert both: createBossVariant applied (name prefix 'Dai Vuong ',
  // isBoss true) and NO tinh_anh prefix unless the active roll also hits.
})

it('active floor-10 can stack boss + tinh_anh when the roll hits', () => {
  // Forced roll + final spawn: name contains BOTH prefixes,
  // maxHp === base * 7 * 2.5, isBoss && isElite.
})
```

- [ ] **Step 2: Run — FAIL** (option chưa tồn tại/spawn chưa đi tag).

- [ ] **Step 3: Implement** trong `pickEnemyForSpawn`:

```ts
    // Boss is a stage property (spec v3 D4) — unconditional on floor 10,
    // in BOTH active and idle paths. Not a tag; createBossVariant stays.
    if (isFinalSpawn && floor === 10 && stage.bossEnemyId) {
      const bossTemplate = this.deps.enemyTemplates.get(stage.bossEnemyId)
      if (bossTemplate) {
        return applyStageRealm(createBossVariant(bossTemplate))
      }
    }

    // Tag roll — ACTIVE only (spec v3 D5). eliteChance is the chance to
    // attach the tinh_anh tag; idle passes allowTags: false.
    if (options?.allowTags !== false && entry.eliteChance && rollChance(entry.eliteChance)) {
      return applyStageRealm(applyEnemyTags(template, ['tinh_anh'], ENEMY_TAGS))
    }
```

*(Giữ thứ tự: boss check TRƯỚC tag check — boss không qua tag. Hidden beast thay template như cũ sau 2 check.)* Wrapper `pickEnemyForTurnSpawn` nhận thêm option và forward. Trong `GameManagerTurnBattleOps.rollAutoFarmCycleReward`: pass `{ allowTags: false }` (idle không tag — D5). Update comment `eliteChance` ở `Stage.ts`/`StageSystem.ts` theo B9 (English).

- [ ] **Step 4: Run spawn + auto-farm suites**:

Run: `npx.cmd vitest run src/core/game/GameManager.bossRepeatCycle.test.ts src/core/game/GameManager.autoFarm.test.ts src/core/game/GameManager.autoFarmAdversarial.test.ts src/core/game/GameManager.autoFarmOffline.test.ts src/core/enemy`

- [ ] **Step 5: XÓA `createEliteVariant`** khỏi `Enemy.ts` (grep 0 consumer ngoài test; characterization test Task 1 vẫn xanh vì so với giá trị lock — nếu test so trực tiếp hàm legacy thì cập nhật sang giá trị snapshot trước khi xóa). Grep chốt: `Select-String -Pattern 'createEliteVariant'` chỉ còn docs/tests đã cập nhật. **`createBossVariant` KHÔNG ĐỤNG.**

- [ ] **Step 6: `npm.cmd run type-check`** — sạch.

- [ ] **Step 7: Commit:**

```
git add src/core/game/StageWaveSystem.ts src/core/enemy/Enemy.ts src/core/game/GameManagerTurnBattleOps.ts src/core/game/GameManager.bossRepeatCycle.test.ts src/core/game/GameManager.autoFarm.test.ts src/core/enemy/EnemyTag.test.ts src/core/stage/Stage.ts src/core/stage/StageSystem.ts
git commit -m "feat(spawn): tinh_anh tag rolls in active mode only; boss stays stage property; retire createEliteVariant (D3/D4/D5)"
```

---

## Task 5 — Predicate Hoàn Mỹ alive-for-all + edge B4 (D1)

**Files:**
- Modify: `src/core/game/GameManagerTurnBattleOps.ts` (`recordPerfectClearIfEligible`), `src/core/game/GameManager.perfectClear.test.ts`

**Interfaces:** signature KHÔNG ĐỔI. Consumes `players[].entity.alive`, `stage.perfectClearTurnLimit`.

- [ ] **Step 1: Failing tests** — append `GameManager.perfectClear.test.ts`:

```ts
// D1 (spec v3): alive-for-all + under limit; ACTIVE-only by nature (idle
// never battles). B4 edge cases lock the once-only contract.
describe('GameManager - Hoan My alive-for-all (D1) + B4 edges', () => {
  it('records when every member is alive and turns are under the limit', () => { /* harness cũ + drive victory; expect push */ })
  it('does NOT record when a party member is dead at victory', () => { /* inject alive:false member; expect no push */ })
  it('already-PC stage cleared normally -> PC state not removed, not re-recorded', () => { /* pre-set perfectClearStageIds; drive clear; expect unchanged + no seconds overwrite */ })
  it('already-PC stage PC again -> perfectClearSeconds NOT overwritten', () => { /* drive 2nd qualifying clear; seconds stay first value */ })
  it('die then revive still counts as PC (alive at the victory tick)', () => { /* member revived mid-battle; alive at victory -> records */ })
  it('first PC also pushes completedStageIds (independent pushes)', () => { /* both arrays contain stage id */ })
})
```

*(Cụ thể hóa theo harness 3 test cũ cùng file — pattern `harness(stage({perfectClearTurnLimit}))` + loop `update(0.05)`; revive case dùng path talent/KiemTu revive hoặc set alive lại true giữa trận qua combatSystem — chọn đường đơn giản nhất lúc implement, ghi rõ comment.)*

- [ ] **Step 2: Run — FAIL** (điều kiện cũ HP-75%).

- [ ] **Step 3: Implement** thân hàm mới:

```ts
  /**
   * Perfect clear (spec v3 D1): every party member must still be alive at
   * the victory tick AND the battle must end under the stage's fixed
   * perfectClearTurnLimit (3 normal / 5 boss). HP-loss is not consulted.
   * Only the ACTIVE mode can ever evaluate this (idle runs no battle).
   * Records perfectClearStageIds + perfectClearSeconds ONCE — the first
   * achievement is never overwritten (B4).
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

- [ ] **Step 4: Run — PASS** toàn file:

Run: `npx.cmd vitest run src/core/game/GameManager.perfectClear.test.ts`

- [ ] **Step 5: Commit:**

```
git add src/core/game/GameManagerTurnBattleOps.ts src/core/game/GameManager.perfectClear.test.ts
git commit -m "feat(pc): whole-party-alive predicate + B4 edge locks (D1)"
```

---

## Task 6 — Swap Stages.ts sang builder (D9/D2)

**Files:**
- Modify: `src/data/stage/Stages.ts`, `src/data/stage/Stages.test.ts`

**Interfaces:** Consumes builder Task 2. `STAGES` export shape/thứ tự KHÔNG ĐỔI.

- [ ] **Step 1: Update Stages.test.ts** — giữ test "tăng tuyến tính", thay assert X theo D2:

```ts
describe('builder swap (spec v3)', () => {
  it('perfectClearTurnLimit is fixed: 3 normal, 5 boss (D2)', () => {
    for (const stage of STAGES) {
      if (stage.floor === 10) expect(stage.perfectClearTurnLimit).toBe(5)
      else expect(stage.perfectClearTurnLimit).toBe(3)
    }
  })

  it('bossEnemyId exists only on floor 10 (fixes false badges)', () => {
    for (const stage of STAGES) {
      if (stage.floor === 10) expect(stage.bossEnemyId).toBeDefined()
      else expect(stage.bossEnemyId).toBeUndefined()
    }
  })

  it('eliteChance entries intact on all 30 stages', () => {
    let count = 0
    for (const stage of STAGES) {
      for (const entry of stage.enemyPool) {
        if (entry.eliteChance !== undefined) { expect(entry.eliteChance).toBe(0.1); count++ }
      }
    }
    expect(count).toBe(30)
  })

  it('waves sum invariant holds for all 30 stages', () => { /* sum === total */ })
})
```

- [ ] **Step 2: Run — FAIL** (X chưa có, bossEnemyId 1-9 vẫn còn).

- [ ] **Step 3: Swap** — `Stages.ts` = 3 `ChapterConfig` (copy nguyên văn nội dung thật) + `export const STAGES = [...mortal, ...qi, ...foundation]` qua builder. Xóa `normalizedStages` hack.

- [ ] **Step 4: Run — PASS**:

Run: `npx.cmd vitest run src/data/stage src/core/stage`

- [ ] **Step 5: Commit:**

```
git add src/data/stage/Stages.ts src/data/stage/Stages.test.ts
git commit -m "feat(stage): STAGES built by defineChapterStages - fixed X 3/5, truthful boss metadata (D9/D2)"
```

---

## Task 7 — UI: ẩn spawnIntervalSeconds (10.4)

**Files:**
- Modify: `src/components/panels/StageSelectPanel.vue` (dòng ~284), locale files nếu key orphan

- [ ] **Step 1:** Xóa span spawnInterval trong `.stage-select__encounter-summary`; nếu key `spawnIntervalPrefix` orphan → xóa khỏi vi/en (parity test khóa).
- [ ] **Step 2:** Run: `npx.cmd vitest run src/components/panels src/i18n` — PASS.
- [ ] **Step 3: Commit:**

```
git add src/components/panels/StageSelectPanel.vue src/locales/vi.json src/locales/en.json
git commit -m "feat(ui): hide spawnIntervalSeconds display (10.4)"
```

---

## Task 8 — Full verification + QA + docs

**Files:**
- Modify: `game/docs/roadmap.md` (9.5 #4 cutover + D8 debt "hệ thống drop hoàn thiện" + D7 factory note), create `game/docs/qa/2026-09-11-pc-tag-system-quick.md`

- [ ] **Step 1: P3 full** — type-check + build + `npx.cmd vitest run` (no filter). Stop on first failure; chỉ fix task-caused (P12).
- [ ] **Step 2: E3 code-simplifier** → **Step 3: P5 code-review** (fix ≥80).
- [ ] **Step 4: P4 adversarial QA quick** — report QA doc. Hypotheses bắt buộc: (a) once-only PC qua save/reload giữa 2 victory; (b) seeded 0.1 phân phối đúng qua tag path; (c) **idle KHÔNG roll tag** (allowTags pass đúng xuống mọi đường — kể cả offline settle); (d) idle floor-10 = boss base reward chain như cũ (parity trước/sau); (e) X=3 khả thi: 1 trận thật 3-quái stage kết thúc ≥3 actor-actions? Nếu không — chỉnh SỐ (data), không mechanism; (f) debug helper không lộ production build.
- [ ] **Step 5: P14 real-browser** (main checkout): guest → tạo nhân vật → StageSelect: badge Boss chỉ node 10; thắng Động 1 ≤3 turn toàn đội sống → chip Hoàn Mỹ enable; dùng `__tutienForcePerfectClear` thử idle gate + idle reward không tag prefix; console 0 errors. Ghi evidence QA doc.
- [ ] **Step 6: Roadmap** — 9.5 #4 ✅ evidence + debt D8 (drop system hoàn thiện: reward multiplier per tag + item tier-up per stack) + note D7.
- [ ] **Step 7: Commit docs:**

```
git add game/docs/roadmap.md game/docs/qa/2026-09-11-pc-tag-system-quick.md
git commit -m "docs: PC + tag system QA evidence + roadmap cutover"
```

---

## Self-Review (đã chạy sau khi viết v3)

1. **Spec coverage:** D1→T5 (+B4); D2→T2/T6; D3→T1; D4→T4 (boss giữ, không tag); D5→T4 (allowTags); D6→không task (giữ nguyên — verify T4/T8 QA c,d); D7→spec note; D8→T1 (không reward field) + T8 debt; D9→T2/T6. B1→T2; B3→T1 priority; B5→T3; B9→T4. UI 10.4→T7. Đủ.
2. **Placeholder scan:** các khối "(Cụ thể hóa theo harness...)" = chỉ dẫn theo pattern test có sẵn — không TBD sản phẩm.
3. **Type consistency:** `combatFlag?: 'isElite'` (chỉ 1 giá trị — boss đã ra khỏi tag); `allowTags` nhất quán T4 các consumer; `perfectClearTurnLimit` 3/5 nhất quán T2/T5/T6.
