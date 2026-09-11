# Perfect Clear + Enemy Tag System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (project convention: opencode has no subagent dispatch — Inline Execution, per P6). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Đổi điều kiện Hoàn Mỹ thành "toàn đội alive lúc victory + dưới X turn" và author X placeholder cho 30 stage; (2) tổng quát hóa `createEliteVariant`/`createBossVariant` thành Enemy Tag System data-driven (stack được kiểu Diablo 2); (3) chuyển 30 stage literal sang builder `defineChapterStages` với quy định chung tại 1 nơi; (4) dọn bossEnemyId metadata giả (chỉ floor 10) + ẩn spawnIntervalSeconds display.

**Architecture:** Tag = registry data + generic applier (`core/enemy/EnemyTag.ts` + `data/enemy/EnemyTags.ts`), tham chiếu công thức `applyEliteMultiplier`/`applyBossMultiplier` có sẵn (không copy số). Builder sinh 30 stage từ 3 config chương. Predicate Hoàn Mỹ sửa tại 1 owner. Layer 2 (normalize) + Layer 4 (combat pipeline) KHÔNG ĐỔI.

**Tech Stack:** Vue 3 + TypeScript + Vite + Vitest + Pinia + Phaser (không dependency mới).

**Spec:** `game/docs/superpowers/specs/2026-09-11-perfect-clear-elite-stages-design.md` (bản 2)

## Global Constraints

- Chạy mọi command từ `game/`. All paths relative to `game/`.
- **P3 quick** mỗi task: `npm.cmd run type-check` + `npx.cmd vitest run <scope>`. Task cuối (Task 7) chạy **full**.
- **P7:** commit command soạn sẵn mỗi task — KHÔNG chạy khi chưa có user authorize.
- **P8:** không `any` mới. **P15:** comment mới/sửa = English ASCII. **P16:** string UI mới qua i18n.
- D1–D7 (spec bản 2) là BẤT BIẾN. KHÔNG tạo stage Tinh Anh, KHÔNG đổi eliteChance, KHÔNG copy số multiplier (tham chiếu hàm có sẵn).
- `applyEliteMultiplier`/`applyBossMultiplier`/`normalizeEnemyStats`/loot pipeline: GIỮ NGUYÊN.

## File Structure

**Created:**
- `src/core/enemy/EnemyTag.ts` — contract `EnemyTag` + `applyEnemyTags()` + `ENEMY_TAG_REGISTRY_KEY` (nếu applier cần registry inject; đặt tên theo pattern đã có)
- `src/core/enemy/EnemyTag.test.ts`
- `src/data/enemy/EnemyTags.ts` — data 2 tag đầu (`tinh_anh`, `boss`)
- `src/data/stage/ChapterStages.ts` — `ChapterConfig` type + `defineChapterStages()` builder
- `src/data/stage/ChapterStages.test.ts` — parity test builder-vs-literal

**Modified:**
- `src/core/game/GameManagerTurnBattleOps.ts` — predicate Hoàn Mỹ (Task 4)
- `src/core/game/StageWaveSystem.ts` — spawn qua `applyEnemyTags` (Task 3)
- `src/core/enemy/Enemy.ts` — xóa `createEliteVariant`/`createBossVariant` SAU khi migrate (Task 3 cuối)
- `src/data/stage/Stages.ts` — 30 literal → 3 config + builder call (Task 5)
- `src/data/stage/Stages.test.ts` — assert mới (Task 5)
- `src/components/panels/StageSelectPanel.vue` — ẩn spawnIntervalSeconds (Task 6)
- `src/core/game/GameManager.perfectClear.test.ts` — predicate test mới (Task 4)
- `src/core/game/GameManager.bossRepeatCycle.test.ts` — append tag-path spawn tests (Task 3; file test spawn sống hiện tại — `StageWaveSystem.spawnTelegraph.test.ts` đã bị xóa cùng C1 retire legacy 2026-09-08)

**Deleted (Task 3 cuối, sau characterization xanh):** thân hàm `createEliteVariant` + `createBossVariant` trong `Enemy.ts`.

---

## Task 1 — Tag contract + applier + data 2 tag đầu (TDD, zero production caller)

**Files:**
- Create: `src/core/enemy/EnemyTag.ts`, `src/core/enemy/EnemyTags.ts` (data), `src/core/enemy/EnemyTag.test.ts`

**Interfaces:**
- Consumes: `Enemy` type (`Enemy.ts`), `Stats` (`StatBlock`), `applyEliteMultiplier`/`applyBossMultiplier` (`EnemyStatInput`).
- Produces (Task 3 consume):
  - `interface EnemyTag { id: string; namePrefix?: string; applyStat?: (stats: Stats) => Stats; combatFlag?: 'isElite' | 'isBoss'; rewardTier?: 'eliteRewards' | 'bossRewards' }`
  - `applyEnemyTags(enemy: Enemy, tagIds: readonly string[], registry: EnemyTagRegistry): Enemy` — dedupe, fold applyStat, ghép prefix theo thứ tự, chọn rewards theo rewardTier (fallback boss→elite→base như cũ), set combatFlag.

- [ ] **Step 1: Failing characterization + stack tests** — `EnemyTag.test.ts`:

```ts
// Characterization: tag output must be byte-equal to the legacy variant
// functions, which stay alive until Task 3 Step 5 removes them.
import { describe, expect, it } from 'vitest'
import { applyEnemyTags } from './EnemyTag'
import { ENEMY_TAGS } from '../../data/enemy/EnemyTags'
import { defineEnemy, createEliteVariant, createBossVariant } from './Enemy'
import type { Enemy } from './Enemy'

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
  it('tag tinh_anh output === createEliteVariant legacy (characterization)', () => {
    const viaTag = applyEnemyTags(BASE, ['tinh_anh'], ENEMY_TAGS)
    const viaLegacy = createEliteVariant(BASE)
    expect(viaTag.stats).toEqual(viaLegacy.stats)
    expect(viaTag.isElite).toBe(viaLegacy.isElite)
    expect(viaTag.isBoss).toBe(viaLegacy.isBoss)
    expect(viaTag.name).toBe(viaLegacy.name)
    expect(viaTag.rewards).toEqual(viaLegacy.rewards)
  })

  it('tag boss output === createBossVariant legacy (characterization)', () => {
    const viaTag = applyEnemyTags(BASE, ['boss'], ENEMY_TAGS)
    const viaLegacy = createBossVariant(BASE)
    expect(viaTag.stats).toEqual(viaLegacy.stats)
    expect(viaTag.isBoss).toBe(true)
    expect(viaTag.rewards).toEqual(viaLegacy.rewards)
  })

  it('stack boss + tinh_anh multiplies stats and joins prefixes (Diablo-style)', () => {
    const stacked = applyEnemyTags(BASE, ['boss', 'tinh_anh'], ENEMY_TAGS)
    expect(stacked.stats.maxHp).toBeCloseTo(BASE.stats.maxHp * 7 * 2.5)
    expect(stacked.isBoss).toBe(true)
    expect(stacked.isElite).toBe(true)
    expect(stacked.name).toContain('Đại Vương')
    expect(stacked.name).toContain('Tinh Anh')
  })

  it('dedupes repeated tags — each tag applies exactly once', () => {
    const once = applyEnemyTags(BASE, ['tinh_anh'], ENEMY_TAGS)
    const twice = applyEnemyTags(BASE, ['tinh_anh', 'tinh_anh'], ENEMY_TAGS)
    expect(twice.stats.maxHp).toBe(once.stats.maxHp)
  })

  it('unknown tag id is ignored safely (no throw, no change)', () => {
    const untouched = applyEnemyTags(BASE, ['khong_ton_tai'], ENEMY_TAGS)
    expect(untouched.stats).toEqual(BASE.stats)
    expect(untouched.name).toBe(BASE.name)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`applyEnemyTags` chưa tồn tại):

Run: `npx.cmd vitest run src/core/enemy/EnemyTag.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** `EnemyTag.ts` (contract + applier) + `EnemyTags.ts` (data):

```ts
// src/core/enemy/EnemyTag.ts
import type { Enemy } from './Enemy'
import type { Stats } from '../stats/StatBlock'

/** Generic tag contract. Tags are DATA (registry) — this core layer
 * never hardcodes a specific tag id (A8). */
export interface EnemyTag {
  id: string
  /** Prepended to the enemy name, joined in tag order. */
  namePrefix?: string
  /** Stat transform — reference the single stat owner (A9), e.g.
   * applyEliteMultiplier. Applied in tag order (stacking multiplies). */
  applyStat?: (stats: Stats) => Stats
  /** CombatEntity flag set when the tag is applied. */
  combatFlag?: 'isElite' | 'isBoss'
  /** Which reward field the variant uses; missing tier falls back to base
   * rewards (same fallback chain as the legacy variant functions). */
  rewardTier?: 'eliteRewards' | 'bossRewards'
}

export type EnemyTagRegistry = ReadonlyMap<string, EnemyTag>

/** Apply tags to a template enemy. Each tag applies at most once (dedupe);
 * applyStat folds in the given order so tags stack multiplicatively.
 * Unknown ids are skipped. Base enemy is never mutated (spread copies).
 * Rewards follow the LAST tag that declares rewardTier, resolved through
 * that tag's legacy fallback chain (boss: bossRewards ?? eliteRewards ??
 * rewards; tinh_anh: eliteRewards ?? rewards). */
export function applyEnemyTags(enemy: Enemy, tagIds: readonly string[], registry: EnemyTagRegistry): Enemy {
  const seen = new Set<string>()
  let result = enemy
  let resolvedRewards = enemy.rewards

  for (const tagId of tagIds) {
    if (seen.has(tagId)) continue
    const tag = registry.get(tagId)
    if (!tag) continue
    seen.add(tagId)

    result = {
      ...result,
      stats: tag.applyStat ? tag.applyStat(result.stats) : result.stats,
      name: tag.namePrefix ? tag.namePrefix + result.name : result.name,
      isElite: tag.combatFlag === 'isElite' ? true : result.isElite,
      isBoss: tag.combatFlag === 'isBoss' ? true : result.isBoss,
    }

    if (tag.rewardTier) {
      // The fallback helper checks the tier field first, so one call covers
      // both the present and the missing case (no redundant ?? chain here).
      resolvedRewards = resolvedRewardsFallback(tag.rewardTier, result)
    }
  }

  // Mirror the legacy variants: currentHp/maxHp follow the final stats.
  return { ...result, rewards: resolvedRewards, currentHp: result.stats.maxHp, maxHp: result.stats.maxHp }
}

/** Legacy fallback chains, one per tier field (verified against
 * createEliteVariant/createBossVariant in Enemy.ts):
 * bossRewards tier falls through eliteRewards before base;
 * eliteRewards tier falls straight to base. */
function resolvedRewardsFallback(tier: 'eliteRewards' | 'bossRewards', enemy: Enemy) {
  if (tier === 'bossRewards') return enemy.bossRewards ?? enemy.eliteRewards ?? enemy.rewards
  return enemy.eliteRewards ?? enemy.rewards
}
```

```ts
// src/data/enemy/EnemyTags.ts
import type { EnemyTag, EnemyTagRegistry } from '../../core/enemy/EnemyTag'
import { applyEliteMultiplier, applyBossMultiplier } from '../../core/enemy/EnemyStatInput'

// First two tags reproduce the legacy createEliteVariant/createBossVariant
// behavior EXACTLY (stat formula referenced, not copied — A9).
// Reward resolution (shared, mirrors the legacy fallback chains):
// - tinh_anh: eliteRewards ?? rewards          (legacy: eliteRewards ?? rewards)
// - boss:     bossRewards ?? eliteRewards ?? rewards   (legacy 3-tier chain)
// When tags STACK, rewards follow the LAST tag's chain applied in tag
// order (boss applied after tinh_anh → boss chain wins), same rule the
// legacy boss function used over elite.
export const ENEMY_TAGS: EnemyTagRegistry = new Map<string, EnemyTag>([
  ['tinh_anh', {
    id: 'tinh_anh',
    namePrefix: 'Tinh Anh ',
    applyStat: applyEliteMultiplier,
    combatFlag: 'isElite',
    rewardTier: 'eliteRewards',
  }],
  ['boss', {
    id: 'boss',
    namePrefix: 'Đại Vương ',
    applyStat: applyBossMultiplier,
    combatFlag: 'isBoss',
    rewardTier: 'bossRewards',
  }],
])
```

*(Lúc implement: đối chiếu lại thân 2 hàm legacy trong `Enemy.ts` — prefix, currentHp sync, isElite/isBoss set, rewards switch. Reward resolve trong applier: theo rewardTier của tag CUỐI CÙNG có rewardTier (stack order), chain `bossRewards ?? eliteRewards ?? rewards` cho tag boss và `eliteRewards ?? rewards` cho tag tinh_anh — ĐÚNG 2 chuỗi legacy. Characterization test ở Step 1 là chốt khóa.)*

- [ ] **Step 4: Run — PASS** (5 test):

Run: `npx.cmd vitest run src/core/enemy/EnemyTag.test.ts`

- [ ] **Step 5: Commit (chờ authorize):**

```
git add src/core/enemy/EnemyTag.ts src/core/enemy/EnemyTag.test.ts src/data/enemy/EnemyTags.ts
git commit -m "feat(enemy): generic tag contract + tinh_anh/boss tags reproducing legacy variants (D3)"
```

---

## Task 2 — Builder defineChapterStages (TDD, chưa swap Stages.ts)

**Files:**
- Create: `src/data/stage/ChapterStages.ts`, `src/data/stage/ChapterStages.test.ts`

**Interfaces:**
- Consumes: `Stage` (`core/stage/Stage`), `Zone.stageIds` order (id list giữ nguyên).
- Produces (Task 5 consume):

```ts
export interface ChapterConfig {
  realmId: string
  chapter: number
  ids: [string, string, string, string, string, string, string, string, string, string] // 10 theo floor
  names: (floor: number) => string          // 'Động N' | 'Quật N' | 'Màn 3.N'
  descriptions: string[]                    // 10 flavor text (nội dung thật duy nhất)
  speciesByFloor: Array<{ common: string; elite: string }> // 10 cặp loài
}

export function defineChapterStages(config: ChapterConfig): Stage[]
```

Builder rules (mọi quy định chung tại ĐÚNG 1 chỗ):
- `totalEnemyCount = 9 + floor` (mọi floor, đủ 3 chương — khớp literal đã đo).
- floor 1-9: `waves = splitEvenly3(total)` (chia đều, dư phân bổ dần từ phần 2 — xem code ở Step 3); floor 10: `waves = [total]`.
- Pool: `[{ enemyId: common, weight: 5 }, { enemyId: elite, weight: 3, eliteChance: 0.1 }]`.
- `bossEnemyId`: CHỈ floor 10 = loài elite (floor 1-9 KHÔNG set — noted behavior change).
- `perfectClearTurnLimit`: floor 1-9 = `2 * total` — PLACEHOLDER; floor 10 = `14` — PLACEHOLDER. Comment 1 chỗ: `// PLACEHOLDER X - tune in the balance pass (user decision D4)`.
- `spawnIntervalSeconds = 3`, `requiredRealmLevel = floor`, `chapter`/`floor` theo config.

- [ ] **Step 1: Failing parity test** — `ChapterStages.test.ts`: sinh 3 chương bằng config copy nguyên văn từ `Stages.ts` literal hiện tại (mortal/qi/foundation — read file lấy id/name/description/cặp loài), assert:
  - Với MỌI stage: `id`, `requiredRealmId`, `requiredRealmLevel`, `chapter`, `floor`, `totalEnemyCount`, `waves`, `enemyPool` (enemyId/weight/eliteChance từng entry), `spawnIntervalSeconds` === literal cũ.
  - `bossEnemyId`: === literal cũ floor 10; `undefined` floor 1-9 (sự khác có chủ đích duy nhất #1).
  - `perfectClearTurnLimit`: định nghĩa + `2*total` (floor 1-9) / `14` (floor 10) — sự khác có chủ đích #2.
  - Bất biến: `waves` sum === `totalEnemyCount`.

*(Viết test trước builder — parity FAIL vì builder chưa tồn tại.)*

- [ ] **Step 2: Run — FAIL** (module not found).

- [ ] **Step 3: Implement** builder theo Interfaces. `splitEvenly3(total)` — chia đều 3 phần, dư PHÂN BỔ DẦN từ phần 2 (khớp literal đã đo: 10→[3,3,4], 11→[3,4,4], 13→[4,4,5], 14→[4,5,5], 17→[5,6,6], 18→[6,6,6]):

```ts
function splitEvenly3(total: number): [number, number, number] {
  const k = Math.floor(total / 3)
  const r = total % 3
  if (r === 0) return [k, k, k]
  if (r === 1) return [k, k, k + 1]
  return [k, k + 1, k + 1]
}
```

*(LƯU Ý: KHÔNG dùng `[k, k, total - 2k]` — công thức đó gom cả dư về phần cuối và sai với r=2: total 11 sinh [3,3,5] thay vì [3,4,4].)* Floor-10 rule riêng: `waves = [total]` (khớp literal mortal_dong_10 [19], foundation_floor_10 [19]).

- [ ] **Step 4: Run — PASS parity toàn bộ 30 stage.**

Run: `npx.cmd vitest run src/data/stage/ChapterStages.test.ts`

- [ ] **Step 5: Commit:**

```
git add src/data/stage/ChapterStages.ts src/data/stage/ChapterStages.test.ts
git commit -m "feat(stage): defineChapterStages builder - one owner for all floor rules (D5)"
```

---

## Task 3 — Spawn qua tag path + retire legacy variant functions

**Files:**
- Modify: `src/core/game/StageWaveSystem.ts:136-180` (`pickEnemyForSpawn`), `src/core/enemy/Enemy.ts` (xóa 2 hàm cuối task), `src/core/game/GameManager.bossRepeatCycle.test.ts` (append test)
- Kiểm tra thêm 1 consumer đã rà: auto-farm `rollAutoFarmCycleReward` dùng `pickEnemyForTurnSpawn` wrapper — tự theo. *(LƯU Ý: file test spawn cũ `StageWaveSystem.spawnTelegraph.test.ts` đã bị xóa trong C1 retire legacy 2026-09-08 — test mới append vào `GameManager.bossRepeatCycle.test.ts`, nơi test spawn hiện sống.)*

**Interfaces:**
- Consumes: `applyEnemyTags`, `ENEMY_TAGS` (Task 1).
- Produces: spawn behavior KHÔNG ĐỔI (elite roll 0.1 như cũ, boss floor-10 như cũ) — chỉ đổi đường gọi.

- [ ] **Step 1: Failing seeded test** — append `GameManager.bossRepeatCycle.test.ts` (nơi test spawn hiện sống):

```ts
// D3: elite roll goes through the tag path — with a seeded RNG forcing
// the 10% roll, the spawned enemy must be identical to the legacy
// createEliteVariant output (name prefix, isElite, eliteRewards).
it('eliteChance roll applies tinh_anh tag (parity with legacy variant)', () => {
  // Follow the existing harness/seed pattern in this file: force rollChance
  // success for one spawn of an elite-eligible pool entry, then assert:
  //   expect(spawned.name).toBe('Tinh Anh ' + baseName)
  //   expect(spawned.isElite).toBe(true)
  //   expect(spawned.rewards).toEqual(baseTemplate.eliteRewards)
})

// D3: boss floor-10 final spawn applies the boss tag.
it('floor-10 final spawn applies boss tag', () => { /* same harness, assert
//   spawned.isBoss === true, name prefix 'Đại Vương ', bossRewards chain */ })
```

*(Cụ thể hóa theo harness thật của file lúc implement — pattern seeded roll đã có trong các test cũ của `GameManager.bossRepeatCycle.test.ts`.)*

- [ ] **Step 2: Run — FAIL** (spawn vẫn đi `createEliteVariant` trực tiếp; test mới pass luôn nếu hành vi tương đương — nếu PASS ngay thì test chưa khóa được tag path: thêm assert gián tiếp qua spy/thứ tự gọi HOẶC chấp nhận parity-lock là đủ vì Task 3 Step 4 xóa hàm legacy sẽ khiến test đỏ nếu spawn chưa đi tag. Ghi chú cách chọn vào commit.)*

- [ ] **Step 3: Implement** — trong `pickEnemyForSpawn`:

```ts
    if (entry.eliteChance && rollChance(entry.eliteChance)) {
      return applyStageRealm(applyEnemyTags(template, ['tinh_anh'], ENEMY_TAGS))
    }

    if (isFinalSpawn && floor === 10 && stage.bossEnemyId) {
      const bossTemplate = this.deps.enemyTemplates.get(stage.bossEnemyId)
      if (bossTemplate) {
        return applyStageRealm(applyEnemyTags(bossTemplate, ['boss'], ENEMY_TAGS))
      }
    }
```

- [ ] **Step 4: Run full spawn suite** — PASS:

Run: `npx.cmd vitest run src/core/game/GameManager.bossRepeatCycle.test.ts src/core/enemy src/core/game/GameManager.autoFarm.test.ts src/core/game/GameManager.autoFarmAdversarial.test.ts`

- [ ] **Step 5: XÓA `createEliteVariant`/`createBossVariant`** khỏi `Enemy.ts` (sau khi grep 0 consumer ngoài test characterization — Task 1 Step 1 test đối chiếu đổi thành so với giá trị lock cứng từng field thay vì gọi hàm legacy, HOẶC giữ lại test file snapshot đối chiếu; chọn cách: đổi characterization test thành snapshot theo giá trị tính tay từ multiplier — ghi rõ trong commit). Grep xác nhận: `Select-String -Pattern 'createEliteVariant|createBossVariant'` chỉ còn lại trong `EnemyTag`/docs.

- [ ] **Step 6: `npm.cmd run type-check`** — sạch (bằng chứng retire hoàn chỉnh).

- [ ] **Step 7: Commit:**

```
git add src/core/game/StageWaveSystem.ts src/core/enemy/Enemy.ts src/core/game/GameManager.bossRepeatCycle.test.ts src/core/enemy/EnemyTag.test.ts
git commit -m "feat(spawn): roll variants through the tag system; retire legacy createEliteVariant/createBossVariant (D3)"
```

---

## Task 4 — Predicate Hoàn Mỹ alive-for-all (D1)

**Files:**
- Modify: `src/core/game/GameManagerTurnBattleOps.ts` (`recordPerfectClearIfEligible`)
- Test: `src/core/game/GameManager.perfectClear.test.ts`

**Interfaces:** signature `recordPerfectClearIfEligible(turnBattle: TurnBattle)` KHÔNG ĐỔI. Consumes `turnBattle.players[].entity.alive`, `stage.perfectClearTurnLimit`.

- [ ] **Step 1: Failing tests** — append vào `GameManager.perfectClear.test.ts`:

```ts
// D1 (spec v2 2026-09-11): alive-for-all predicate.
describe('GameManager — Hoan My alive-for-all condition (D1)', () => {
  // Harness: dummy enemy attack=0; stage with perfectClearTurnLimit.
  it('records perfect clear when every party member is alive under the limit', () => {
    // ... drive to victory with players[0] alive; expect perfectClearStageIds contains stage id
  })

  it('does NOT record when a party member is dead at victory (old 75% rule would have)', () => {
    // ... inject second player entity { alive: false, currentHp: 0 } into
    // turnBattle.players; drive to victory; expect NOT contains stage id
  })
})
```

*(Cụ thể hóa harness theo 3 test cũ cùng file — pattern `harness(stage({perfectClearTurnLimit}))` + loop `gameManager.update(0.05)` đã có sẵn, tái dùng nguyên văn.)*

- [ ] **Step 2: Run — FAIL** test 2 (điều kiện cũ chỉ check players[0] → vẫn ghi).

- [ ] **Step 3: Implement** — thân `recordPerfectClearIfEligible` mới:

```ts
  /**
   * Perfect clear (spec v2 2026-09-11 D1): every party member must still be
   * alive at the victory tick AND the battle must end under
   * stage.perfectClearTurnLimit. HP-loss percentage is no longer consulted.
   * Records perfectClearStageIds + perfectClearSeconds ONCE.
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

- [ ] **Step 4: Run — PASS** toàn file (3 test cũ + 2 mới):

Run: `npx.cmd vitest run src/core/game/GameManager.perfectClear.test.ts`

- [ ] **Step 5: Commit:**

```
git add src/core/game/GameManagerTurnBattleOps.ts src/core/game/GameManager.perfectClear.test.ts
git commit -m "feat(pc): perfect clear requires whole party alive at victory (D1)"
```

---

## Task 5 — Swap Stages.ts sang builder (D5)

**Files:**
- Modify: `src/data/stage/Stages.ts` (toàn bộ → 3 config + builder call), `src/data/stage/Stages.test.ts`

**Interfaces:** Consumes `defineChapterStages` (Task 2). `STAGES` export KHÔNG ĐỔI shape/thứ tự (Zones.stageIds + mọi consumer đọc nguyên vẹn).

- [ ] **Step 1: Update Stages.test.ts** — giữ test "tăng tuyến tính" (vẫn đúng: 10+index), THÊM:

```ts
describe('builder swap (spec v2 2026-09-11)', () => {
  it('every stage has perfectClearTurnLimit: normal 2x total, boss 14', () => {
    for (const stage of STAGES) {
      if (stage.floor === 10) expect(stage.perfectClearTurnLimit).toBe(14)
      else expect(stage.perfectTurnLimit /* perfectClearTurnLimit */).toBe(2 * stage.totalEnemyCount)
    }
  })

  it('bossEnemyId exists only on floor 10 (fixes 27-node false badge)', () => {
    for (const stage of STAGES) {
      if (stage.floor === 10) expect(stage.bossEnemyId).toBeDefined()
      else expect(stage.bossEnemyId).toBeUndefined()
    }
  })

  it('eliteChance entries intact on all 30 stages (D2 keep)', () => {
    let count = 0
    for (const stage of STAGES) {
      for (const entry of stage.enemyPool) {
        if (entry.eliteChance !== undefined) { expect(entry.eliteChance).toBe(0.1); count++ }
      }
    }
    expect(count).toBe(30)
  })

  it('waves sum invariant holds for all 30 stages', () => { /* sum === totalEnemyCount */ })
})
```

*(Sửa typo `perfectTurnLimit` → `perfectClearTurnLimit` khi viết thật.)*

- [ ] **Step 2: Run — FAIL** (X chưa có, bossEnemyId floor 1-9 vẫn còn).

- [ ] **Step 3: Swap** — `Stages.ts` thành 3 `ChapterConfig` (copy nguyên văn id/name/description/cặp loài từ literal cũ) + `export const STAGES = [...defineChapterStages(mortalConfig), ...defineChapterStages(qiConfig), ...defineChapterStages(foundationConfig)]`. Xóa `normalizedStages` hack.

- [ ] **Step 4: Run — PASS** data suites + parity builder (Task 2 test vẫn xanh trên STAGES thật):

Run: `npx.cmd vitest run src/data/stage src/core/stage`
Expected: PASS toàn bộ (kể cả `EffectiveWaves.test.ts` — floor-10 guard vẫn khớp).

- [ ] **Step 5: Commit:**

```
git add src/data/stage/Stages.ts src/data/stage/Stages.test.ts
git commit -m "feat(stage): STAGES now built by defineChapterStages - one rules owner, real X, truthful boss metadata (D4/D5)"
```

---

## Task 6 — UI: ẩn spawnIntervalSeconds + badge boss tự đúng (10.4)

**Files:**
- Modify: `src/components/panels/StageSelectPanel.vue` (dòng ~284: xóa span spawnIntervalPrefix), locale files nếu key orphan

**Interfaces:** Consumes data Task 5 (bossEnemyId chỉ floor 10 → badge `v-if="node.stage.bossEnemyId"` tự đúng 3 node — KHÔNG cần code badge mới).

- [ ] **Step 1:** Xóa khối hiển thị `spawnIntervalSeconds` trong `.stage-select__encounter-summary` (giữ lại totalEnemyCount + boss name). Nếu key i18n `spawnIntervalPrefix` không còn consumer nào → xóa key khỏi vi.json + en.json (parity test khóa).
- [ ] **Step 2:** Run: `npx.cmd vitest run src/components/panels src/i18n` — PASS.
- [ ] **Step 3:** P14 spot-check lồng Task 7 (không mở browser riêng ở task này).

- [ ] **Step 4: Commit:**

```
git add src/components/panels/StageSelectPanel.vue src/locales/vi.json src/locales/en.json
git commit -m "feat(ui): hide spawnIntervalSeconds display - field unused by turn-based waves (10.4)"
```

---

## Task 7 — Full verification + QA + docs

**Files:**
- Modify: `game/docs/roadmap.md` (9.5 #4 cutover + D7 note factory tier 4+), `game/docs/qa/2026-09-11-pc-tag-system-quick.md` (create)

- [ ] **Step 1: P3 full** — `npm.cmd run type-check` + `npm.cmd run build` + `npx.cmd vitest run` (no filter). Stop on first failure; chỉ fix task-caused (P12).
- [ ] **Step 2: E3 code-simplifier** trên diff toàn mission → **Step 3: P5 code-review** (post-simplify), fix findings ≥80.
- [ ] **Step 4: P4 adversarial QA quick** — report `game/docs/qa/2026-09-11-pc-tag-system-quick.md`. Hypotheses bắt buộc: (a) once-only PC qua save/reload giữa 2 victory; (b) seeded elite roll 0.1 phân phối đúng qua tag path; (c) auto-farm roll elite reward như cũ qua tag; (d) stack boss+tinh_anh nhân liên tiếp không double-prefix sai thứ tự; (e) bossEnemyId floor 1-9 xóa không phá EffectiveWaves/EnemyCount guard (chúng yêu cầu CẢ HAI điều kiện — verify).
- [ ] **Step 5: P14 real-browser** (main checkout, KHÔNG worktree): guest → tạo nhân vật → StageSelect: badge Boss chỉ node 10; vào Động 1 thắng dưới X=20 (dummy dễ) với toàn đội sống → chip Hoàn Mỹ ENABLED cho Động 1; console 0 errors. Ghi evidence vào QA doc.
- [ ] **Step 6: Roadmap** — 9.5 #4 ✅ evidence; note D7 (factory tier 4+), note tag system là cơ chế mở cho tag tương lai.
- [ ] **Step 7: Commit docs:**

```
git add game/docs/roadmap.md game/docs/qa/2026-09-11-pc-tag-system-quick.md
git commit -m "docs: PC + tag system QA evidence + roadmap cutover"
```

---

## Self-Review (đã chạy)

1. **Spec coverage:** D1→T4; D2 (eliteChance giữ)→T1/T3/T5 assert giữ; D3→T1/T3; D4→T2/T5; D5→T2/T5; D6 (idle giữ)→chỉ verify không đổi (T7 QA hypothesis c); D7 (stat giữ + note)→spec §5. UI 10.4→T6. Đủ.
2. **Placeholder scan:** các khối "(Cụ thể hóa theo harness thật...)" là chỉ dẫn điều chỉnh theo pattern test có sẵn trong từng file — không TBD sản phẩm. Không TODO treo.
3. **Type consistency:** `applyEnemyTags(enemy, tagIds, registry)` nhất quán T1→T3; `defineChapterStages(config)` nhất quán T2→T5; `perfectClearTurnLimit` đúng chính tả (đã note typo ở T5 Step 1).
