# Stat System Reimagined Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-architect the stat system for ATB turn-based combat — domain-gated StatTypes, path-owned resources, closed DoT economy, hit outcome semantics, and a fully audited inventory (D1–D21, INV-1–15).

**Architecture:** One `StatType` union / one `Stats` record / one `calculateStats` authority, with a `domain` field on `StatModifier` + a `STAT_DOMAIN` registry delivering isolation. Path stats gate by domain; meta stats gate to their domain owner; dead/bespoke/stat-of-stat keys retire. Enemies keep base-value authoring only.

**Tech Stack:** TypeScript, Vitest, Vue 3 (labels/UI only).

**Spec:** `game/docs/superpowers/specs/2026-09-14-stat-system-reimagined-design.md` — read it first; every task cites its decisions (D#) and invariants (INV-#).

## Global Constraints

- Worktree required (P2): create `.agent-worktrees/stat-system-reimagined` via `using-git-worktrees` BEFORE any production edit. Docs-only edits were already allowed in main; all code now moves to the worktree.
- Verification per task: `npm run type-check` + `npx vitest run <task scope>` (P3 quick). Full mode only at the final task.
- Dev/test gate behavior: THROW on domain violation. Production: reject + report — never silent.
- Save compatibility: persisted `baseStats` records carry OLD key names — every rename task must extend the key-migration helper (Task 2), never leave stale keys.
- No new `any` (P8). English ASCII comments (P15). No content-ID special cases in generic systems (A8).
- Do NOT commit — the user alone authorizes commits (P7). "Commit" steps below mean stage-only + report; skip them if the environment forbids committing.

---

### Task 1: Domain gate infrastructure (D10)

**Files:**
- Create: `src/core/stats/StatDomain.ts`
- Modify: `src/core/stats/StatCalculator.ts` (StatModifier interface + gate call sites)
- Test: `src/core/stats/StatDomain.test.ts` (new)

**Interfaces:**
- Produces:
  ```ts
  export type StatDomain = 'universal' | 'phap_tu' | 'the_tu' | 'kiem_tu' | 'hoa_tu'
    | 'production' | 'cultivation' | 'equipment_meta' | 'artifact' | 'realm'
  export const STAT_DOMAIN: Partial<Record<StatType, StatDomain>>
  export const DOMAIN_SOURCE_WHITELIST: Record<string, Array<{ file: string; stats?: StatType[] }>>
  export function applyDomainGate(modifiers: StatModifier[]): StatModifier[]
  ```
- `StatModifier` gains `domain?: StatDomain` (absent = universal intent).
- Gate rule (D10): universal stat + any domain = accept; gated stat + matching domain = accept; gated stat + wrong/absent domain = reject loudly. `applyDomainGate` runs at the top of BOTH `calculateStats` and `calculateEffectiveStats`: dev/test throws on first violation; production filters it out and reports via console.error + a collected `domainViolations` list.
- Registries start EMPTY for `STAT_DOMAIN` (nothing gated yet — later tasks populate per-domain so in-flight content never breaks) and WHITELIST gets populated alongside.

- [ ] **Step 1: Failing test** — `StatDomain.test.ts`: register a temporary test domain entry, assert (a) universal stat + `domain:'phap_tu'` modifier applies (INV-9), (b) gated stat + wrong/absent domain throws in test env (INV-1).

- [ ] **Step 2:** Run `npx vitest run src/core/stats/StatDomain.test.ts` — expect FAIL (module missing).

- [ ] **Step 3:** Implement `StatDomain.ts` + `domain` field + `applyDomainGate` wired into `calculateStats`/`calculateEffectiveStats`. `STAT_DOMAIN = {}`, `DOMAIN_SOURCE_WHITELIST = {}`.

- [ ] **Step 4:** Re-run test — PASS. Run `npm run type-check` + `npx vitest run src/core/stats` — no regressions (empty registry = no behavioral change).

- [ ] **Step 5:** Stage files (`git add`), report.

---

### Task 2: Rename pass + save-key migration (D14, §3.5, §6)

**Files:**
- Modify: `src/core/stats/StatTypes.ts`, `src/core/stats/StatBlock.ts`, `src/core/stats/StatMetadata.ts`, `src/core/stats/StatLabels.ts`
- Modify: all `attack`/`manaRegenPerSecond`/`wardRegenPerSecond`/`speedMultiplier`/`timeSinceLastHitTaken`/`baseAttackPlusPower` consumers (grep-enumerated)
- Create: `src/core/stats/statKeyMigration.ts`
- Modify: `src/stores/player.ts` (restore path calls the migrator)

**Interfaces:**
- Renames: `attack`→`might`, `manaRegenPerSecond`→`manaRegenPerTurn`, `wardRegenPerSecond`→`wardRegenPerTurn`, `speedMultiplier`→`productionSpeedMultiplier`, `timeSinceLastHitTaken`→`turnsSinceLastHitLanded`, `baseAttackPlusPower`→`baseMightPlusPower`.
- Produces: `migrateStatRecordKeys(record: Record<string, number>): Stats` — remaps old keys to new, drops keys with no successor (`attackRange`, `maxMpPercent`, `manaRegenPercent`, `poisonRecoveryPercent` — those retire in Task 3 but the drop-list lands here so saves are safe in either order). Called from the restore path before normalization.

- [ ] **Step 1: Failing test** — `statKeyMigration.test.ts`: a record with `attack:10, attackRange:5, maxMpPercent:0.2` returns `{might:10}`-shaped output (old keys gone, retired keys dropped).

- [ ] **Step 2:** Run — FAIL.

- [ ] **Step 3:** Write `migrateStatRecordKeys`; perform the renames project-wide (`grep -rl "attack\b"` etc. under `src/`); wire migrator into `stores/player.ts` restore normalization.

- [ ] **Step 4:** `npm run type-check` — must be clean (compiler catches every missed rename). `npx vitest run src/core/stats src/core/combat` — PASS.

- [ ] **Step 5:** Stage, report.

---

### Task 3: Retire dead/redundant/bespoke stats (D16, D17, D18-retire part)

**Files:**
- Modify: `src/core/stats/StatTypes.ts` (remove `attackRange`, `maxMpPercent`, `manaRegenPercent`, `poisonRecoveryPercent`)
- Modify: `src/core/stats/StatBlock.ts` (`PLAYER_BASE_RANGE_RANKS`, base entries), `StatMetadata.ts`, `StatLabels.ts`
- Modify: `src/core/enemy/EnemyStatInput.ts` (`attackRangeRanks` input + `MAX_ENEMY_ATTACK_RANGE_RANKS`), `src/stores/player.ts` (attackRange normalization)
- Modify: `src/core/battle/ActionTargetingSystem.ts` (delete dormant range helpers), `src/core/battle/Battle.ts` (stale comments)
- Modify: `data/enemy/MortalEnemies.ts` (drop `attackRangeRanks` fields), `data/technique/Techniques.ts` (~8 MP-tier rows), `data/buff/ThuanHeBuffs.ts` (`linh_tai`), `src/core/technique/Technique.ts`, `src/composables/useTechniqueSections.ts`, `src/core/game/GameManagerPersistentEffectOps.ts`

**Interfaces:**
- Consumes: `StatModifier.domain` (Task 1).
- MP-stat sources re-author NOW with `domain:'phap_tu'` tags (inert until Task 7 populates `STAT_DOMAIN`): `Techniques.ts` MP tiers + `ThuanHeBuffs.linh_tai` become `{stat:'maxMp'|'manaRegenPerTurn', percent:X, domain:'phap_tu'}` (D17 — percent ops on the stat itself).
- Đại Ngũ Hành Chân Quyết +2 attackRange: drop the modifier (no skill-targeting modifier system exists yet — record the loss in the task report).
- `poisonRecoveryPercent` read site: `CombatSystem.applyDotDamage` — replace the stat read with a buff-effect query (Task 4 adds the trigger; this task removes the stat read and leaves the hook call).

- [ ] **Step 1: Failing test** — `EnemyStatInput.test.ts` case: input with `attackRangeRanks` is rejected/ignored; `createBaseStats()` output has no `attackRange` key.

- [ ] **Step 2:** Run — FAIL (keys still exist).

- [ ] **Step 3:** Remove the 4 stat keys everywhere; delete dormant helpers; re-author the MP sources with `domain:'phap_tu'` percent modifiers; strip `attackRangeRanks` from all authored enemies; replace the `poisonRecoveryPercent` read with a call to `dotRecoveryTriggers(source)` (stub returning 0 until Task 4).

- [ ] **Step 4:** `npm run type-check` + `npx vitest run src/core/enemy src/core/stats src/core/combat data` — PASS.

- [ ] **Step 5:** Stage, report (note ĐNHCQ range loss).

---

### Task 4: `healingEffectivenessPercent` + Doc Can authored trigger (D18)

**Files:**
- Modify: `src/core/stats/StatTypes.ts` (add stat), `StatBlock.ts` (base 0), `StatMetadata.ts` (`{unit:'percent', min:0}`), `StatLabels.ts` (label "Hiệu quả hồi phục")
- Modify: `src/core/combat/CombatSystem.ts` (heal application + `dotRecoveryTriggers`)
- Modify: `data/buff/ThuanHeBuffs.ts` or `data/buff/buffs.ts` (Độc Căn re-author — locate its real file via grep `poisonRecoveryPercent|Độc Căn`)
- Test: `src/core/combat/CombatSystem.healing.test.ts` (new)

**Interfaces:**
- Produces: `healingEffectivenessPercent` — heal pipeline: `authored heal -> receiver.healingEffectivenessPercent -> HP`. Applies to `hpRegenPerTurn` ticks, direct heal skill effects, authored recovery triggers. NEVER leech/ward/MP regen/shields (INV-13).
- `dotRecoveryTriggers(source): number` reads an authored buff effect (e.g. `effects:[{type:'dotRecovery', element:'wood', healPercent:0.02}]` on Độc Căn) — the recovered HP then scales with `healingEffectivenessPercent`. No content-ID checks (A8): the DoT path reads a generic effect type.

- [ ] **Step 1: Failing test** — INV-13: entity with `healingEffectivenessPercent:0.5` gets +50% hpRegen tick and +50% authored-recovery heal; leech output bitwise unchanged; `manaRegenPerTurn`/`wardRegenPerTurn`/ward absorb unchanged.

- [ ] **Step 2:** Run — FAIL (stat missing).

- [ ] **Step 3:** Add the stat + heal-pipeline hook; implement `dotRecoveryTriggers` reading the new buff effect type; re-author Độc Căn to `{type:'dotRecovery', element:'wood', healPercent:0.02}`.

- [ ] **Step 4:** `npm run type-check` + `npx vitest run src/core/combat src/core/stats` — PASS.

- [ ] **Step 5:** Stage, report.

---

### Task 5: Hit outcome semantics — landed/absorbed/taken (D5, D6, D11)

**Files:**
- Modify: `src/core/combat/CombatSystem.ts` (`resolveHit`/`resolveAttack`)
- Modify: `src/core/battle/turn/TurnBattleSystem.ts` if it mirrors the same logic
- Test: `src/core/combat/CombatSystem.hitOutcomes.test.ts` (new or extend `TurnBattleSystem.hitResolution.qa.test.ts`)

**Interfaces:**
- Produces the trigger contract (§4): attacker `on-hit` → landed; attacker `on-damage-dealt` + defender `on-hit-taken` → `hpDamage > 0`.
- `thornsPercent`/`leechPercent` read `hpDamage` (post-absorb HP loss), not `finalDamage` (current bug D11).
- `turnsSinceLastHitLanded` resets on LANDED hits (absorbed OR taken); DoT never touches it.
- Same-target on-hit damage procs fold into the parent hit pre-absorb; cross-target procs = separate hits, no recursion (INV-12).

- [ ] **Step 1: Failing tests** — INV-3: full-ward hit → no thorns, no leech heal, `turnsSinceLastHitLanded` resets; partial absorb → thorns/leech on `hpDamage` only.

- [ ] **Step 2:** Run — FAIL (current code uses `finalDamage`).

- [ ] **Step 3:** Rework `resolveHit`: compute `hpDamage` after absorb layers; gate thorns/leech/on-taken triggers on `hpDamage > 0`; keep attacker `on-hit` + ailment rolls on landed.

- [ ] **Step 4:** `npx vitest run src/core/combat src/core/battle/turn` — PASS.

- [ ] **Step 5:** Stage, report.

---

### Task 6: DoT closed economy (D13)

**Files:**
- Modify: `src/core/combat/CombatSystem.ts` (`applyDotDamage`, `applyModifiedDirectDamage`)
- Test: extend the DoT tests in `src/core/combat/`

**Interfaces:**
- `applyDotDamage` = `rawDamage -> dotResistancePercent (with penetration) -> HP` — `finalDamageMultiplier` removed (D13). No ward/MP-shield/leech/thorns/on-taken/turnsSinceLastHitLanded interaction.
- On-hit proc rules from Task 5 apply here too (procs are hits, not ticks).

- [ ] **Step 1: Failing test** — attacker with `finalDamagePercent:0.5` deals identical DoT ticks as without; defender `finalDamageReductionPercent` does not reduce ticks; `dotResistancePercent` does.

- [ ] **Step 2:** Run — FAIL (multiplier still applied).

- [ ] **Step 3:** Strip `finalDamageMultiplier` from the DoT path; confirm leech/thorns/landed-timer untouched (tests already exist from Task 5/§4.1).

- [ ] **Step 4:** `npx vitest run src/core/combat` — PASS.

- [ ] **Step 5:** Stage, report.

---

### Task 7: Pháp Tu gate ON + attribute→MP ordering (D10, D12, D19)

**Files:**
- Modify: `src/core/stats/StatDomain.ts` — `STAT_DOMAIN` += `{maxMp, manaRegenPerTurn, manaShieldPercent, reactionEffectPercent: 'phap_tu'}`; `DOMAIN_SOURCE_WHITELIST['phap_tu']` = the §2.1 predicate list (PhapTu*.ts, RealmPassives[MP stats], Techniques[MP stats], BossBuffs[reactionEffectPercent])
- Create: `tests/architecture/statDomainWhitelist.test.ts` (lint harness — INV-11)
- Modify: `src/core/stats/StatCalculator.ts` — `resolveAttributeTotals()` export + `deriveDomainModifiers` registry in `calculateEffectiveStats`
- Modify: `src/core/player/` or `src/core/assembly/` (PlayerStatAssembly + PhapTuSystem emission — locate via grep `PlayerStatAssembly|PhapTuSystem`)

**Interfaces:**
- Produces:
  ```ts
  export function resolveAttributeTotals(base: Stats, mods: StatModifier[]): Record<MainStatKey, number>
  export function registerDomainDeltaDeriver(domain: StatDomain, fn: (d: Record<MainStatKey, number>) => StatModifier[]): void
  ```
- Lint test scans authored `StatModifier`s in `data/**`: per modifier, `WHITELIST[modifier.domain]` must contain a matching `{file, stats?}` predicate (INV-11).
- PhapTuSystem registers its `deltaDeriver` (attunement→`maxMp`/`manaRegenPerTurn` gated modifiers) — `calculateEffectiveStats` invokes registered derivers after universal deltas (D12).
- `resolveAttributeTotals` runs ONE `runPipeline` over base+persistent and returns the 5 attributes; assembly emits phap_tu modifiers BEFORE `calculateStats` (INV-6/INV-10).

- [ ] **Step 1: Failing tests** — (a) whitelist lint: fixture modifier `{stat:'maxMp', domain:'phap_tu'}` in a non-whitelisted file fails (INV-11); (b) delta deriver: attunement delta emits MP delta exactly once (INV-10).

- [ ] **Step 2:** Run — FAIL.

- [ ] **Step 3:** Populate `STAT_DOMAIN`/`DOMAIN_SOURCE_WHITELIST`; write the lint test (architecture-test family, CI-failing); implement `resolveAttributeTotals` + deriver registry; wire PhapTuSystem emission at assembly.

- [ ] **Step 4:** `npm run type-check` + `npx vitest run src/core/stats src/core/player tests/architecture` — PASS (Task 3's re-authored content keeps MP flowing through the gate).

- [ ] **Step 5:** Stage, report.

---

### Task 8: Attribute re-map (D7, D8)

**Files:**
- Modify: `src/core/stats/StatCalculator.ts` (`deriveAttributeModifiers` constants)
- Test: `src/core/stats/StatCalculator.test.ts` (extend)

**Interfaces:**
- dexterity → `accuracyRating` + `evasionRate` + `criticalRate` (**remove `speed`** — INV-2); intelligence → `criticalDamage` + `ailmentResistPercent` + `ailmentPotencyPercent` (**new output**); others unchanged.

- [ ] **Step 1: Failing tests** — INV-2: derive with dex=100 → zero `speed` modifier emitted; int=100 → `ailmentPotencyPercent` modifier present.

- [ ] **Step 2:** Run — FAIL.

- [ ] **Step 3:** Update `deriveAttributeModifiers` (delete speed line, add potency constant — value per existing conventions, flagged for balance pass per spec residual).

- [ ] **Step 4:** `npx vitest run src/core/stats src/core/combat` — PASS.

- [ ] **Step 5:** Stage, report.

---

### Task 9: Meta domain gates (D15)

**Files:**
- Modify: `src/core/stats/StatDomain.ts` — `STAT_DOMAIN` += `{productionSpeedMultiplier:'production', cultivationPercent:'cultivation', affixDeltaPercent:'equipment_meta', artifactGradeMultiplier:'artifact', realmPassivePercent:'realm'}` + whitelist entries per domain
- Modify: each domain emitter to tag `domain` on its modifiers — `src/core/production/ProductionSystem.ts`, `src/core/pill/PillSystem.ts`/`PillEffect.ts`, `src/core/game/GameManagerBuildingOps.ts`/`GameManagerPillOps.ts`, artifact + realm emitters (locate via grep on each stat name)

**Interfaces:**
- Consumes: Task 1 gate, Task 2 renamed `productionSpeedMultiplier`.
- Each emitter's modifiers get `domain:'<own domain>'`; whitelist entries map domain→emitter files.

- [ ] **Step 1: Failing test** — lint: a meta-domain modifier outside its domain's whitelist fails; runtime: production modifier WITH `domain:'production'` still delivers `productionSpeedMultiplier`.

- [ ] **Step 2:** Run — FAIL.

- [ ] **Step 3:** Populate entries; tag emitters' modifiers.

- [ ] **Step 4:** `npm run type-check` + `npx vitest run src/core/production src/core/pill tests/architecture` — PASS.

- [ ] **Step 5:** Stage, report.

---

### Task 10: Enemy input gate (D9, D21)

**Files:**
- Modify: `src/core/enemy/EnemyStatInput.ts`
- Test: `src/core/enemy/EnemyStatInput.test.ts` (extend)

**Interfaces:**
- `EnemyStatInput` rejects: (a) modifier-channel entries for gated stats, (b) authored `reactionEffectPercent` (zero-fill line already dropped in Task 3 — now reject if authored), (c) reaction-tagged skill/buff ids (`/reaction/i` or data tag). Authored BASE values stay ungated (enemy Phap Tu boss bakes `maxMp` legitimately — D9/§5).
- INV-8 (base vs modifier distinction) + INV-14.

- [ ] **Step 1: Failing tests** — base `maxMp` accepted; a modifier-channel gated stat rejected; `reactionEffectPercent` input rejected; `phap_tu_reaction_*` skill id on an enemy rejected (INV-8/14).

- [ ] **Step 2:** Run — FAIL.

- [ ] **Step 3:** Implement the rejection rules in `EnemyStatInput` normalization.

- [ ] **Step 4:** `npx vitest run src/core/enemy` — PASS.

- [ ] **Step 5:** Stage, report.

---

### Task 11: Speed pool validation + leftover scrubs (D1, INV-15)

**Files:**
- Modify: `src/core/equipment/EquipmentStatPolicy.ts` (if pool structure needs it)
- Test: `tests/architecture/` or `src/core/equipment/` data-validation test

**Interfaces:**
- Validation test: every affix pool containing `speed` also contains >=2 stats from {offense amps, crit stats, defense stats} (INV-15).
- Sweep leftovers: `attackRange`/`poisonRecoveryPercent`/old key names = zero hits project-wide outside `statKeyMigration.ts`'s mapping table and historical docs.

- [ ] **Step 1: Failing test** — write the pool-composition assertion; run — FAIL if any pool violates (fix pools if so).

- [ ] **Step 2–3:** Implement/adjust pools until PASS.

- [ ] **Step 4:** `npx vitest run tests/architecture src/core/equipment` + project-wide grep sweep (zero stale keys).

- [ ] **Step 5:** Stage, report.

---

### Task 12: Final sweep — labels, docs, full verification

**Files:**
- Modify: `src/core/stats/StatLabels.ts` (might label = "Sức mạnh", productionSpeedMultiplier label, healingEffectivenessPercent label)
- Modify: spec status header (`DRAFT` → `APPROVED/IMPLEMENTED` per project convention)
- Verify: `npm run type-check` + `npm run build` + `npx vitest run` (P3 FULL — major architecture change)

**Interfaces:**
- Consumes everything. This is the release-gate task.

- [ ] **Step 1:** Update labels + any stale doc references (`attack`→`might` in StatLabels comments, `PLAYER_BASE_RANGE_RANKS` references).

- [ ] **Step 2:** Full verification — type-check + build + whole suite green.

- [ ] **Step 3:** Run `tutienidle-adversarial-qa` (quick) per P4 — combat/stat changes require it before done.

- [ ] **Step 4:** Run `code-review` per P5 (non-trivial change).

- [ ] **Step 5:** Report G5-style summary: decisions implemented, invariants covered by which test, remaining residuals (ĐNHCQ range loss, the_tu earmark, BossBuffs filename, coefficient balance pass).

---

## Self-Review Notes

- **Spec coverage:** D1→Task 8+11, D2/D14→Task 2, D5/D6/D11→Task 5, D13→Task 6, D10→Tasks 1/7/9, D12→Task 7, D15→Task 9, D16/D17→Task 3, D18→Tasks 3/4, D19→Task 7, D20→residual only (documented), D21→Task 10. INV-1/9→Task 1, INV-2→Task 8, INV-3→Task 5, INV-6/10→Task 7, INV-8/14→Task 10, INV-11→Task 7, INV-12→Task 5, INV-13→Task 4, INV-15→Task 11. INV-4/5/7 verify through the combat test suite in Tasks 5–6.
- **Ordering rationale:** gate machinery ships empty (Task 1) so re-authored content (Task 3) can carry inert `domain` tags before the gate activates (Task 7/9) — no task leaves the build broken.
- **Known residuals handed to the report:** ĐNHCQ +2 attackRange loss (no skill-targeting modifier system yet); `the_tu` earmark is a future migration spec; `BossBuffs.ts` filename; derivation coefficients deferred to a balance spec; D20 block/endurance stay universal until `the_tu` exists.
