# Combat Simulation — BattleSimulation (P4)

> **Trạng thái:** Live. Headless deterministic battle driver cho balance
> baseline (P5) + regression checks. Tooling-only — gameplay path không
> được import module này.

## Vị trí trong chuỗi authority

`src/core/simulation/` là **orchestrator, không sở hữu rule**: dựng một
`GameManager` thật mỗi run, đăng ký catalog thật (SKILLS / TECHNIQUES /
nodes / ENEMIES / STAGES), restore build snapshot qua canonical M1 seam,
gắn `ManualClockSource` + `SeededCombatRng` qua seam hiện có
(`setCombatClockSource`, `setBattleRngFactory`), drive clock tới
terminal, đọc chỉ public surfaces (eventBus, `turnBattleOps`,
`getBattleBuffs`, `trace.records`).

```
BattleSimulationInput { seed, build: SimBuildSnapshot, ritual?, encounter, maxSteps?, advanceChunkSeconds? }
        ↓
GameManager headless + seeded RNG + manual clock
        ↓
Canonical surfaces: eventBus events + turn_battle_entity_snapshot + trace.records
        ↓
BattleSimulationResult { outcome, steps, fightingSteps, metrics, fingerprint, diagnostics }
```

## Hợp đồng input

- **`SimBuildSnapshot { player, skills, techniques }`** — detached build
  identity. `PlayerData` một mình KHÔNG đủ: `skillManager.has()` feed
  path capabilities, kit resolution + scaled passives đọc SkillSystem,
  equipped-technique combat modifiers đọc TechniqueManager. Restore per
  run: `skillManager.restore(clone)` / `techniqueManager.restore(clone)`
  / `setActivePlayer(clone)` — caller snapshot không bao giờ mutate.
- **`ritual?: { pathId, wayId }`** — cặp bắt buộc cùng nhau; chạy
  `chooseCultivationPath` thật; player phải pre-ritual (post-ritual →
  throw — ritual owner legitimately rejects).
- **`SimEncounter`** discriminated union: `{kind:'stage', stageId}` /
  `{kind:'customStage', stage, enemies}` (enemy templates đi kèm stage
  — nội dung unregistered) / `{kind:'enemy', enemy}` (singular raw path
  — không có multi-enemy raw seam trong production).
- **Timed effects bị strip** khỏi player clone — wall-clock consumables,
  không phải deterministic build identity; đếm vào
  `diagnostics.timedEffectsStripped`, không silently drop.

## Determinism

- Mọi combat roll đi qua `SeededCombatRng` (commitCycleRng seam).
- Spawn ids là `crypto.randomUUID()` → metrics/fingerprint normalize theo
  role key: `player`, `companion:<definitionId>`,
  `enemy:<templateId>:<spawnOrdinal>`.
- Step boundary = `turn_battle_entity_snapshot` (1 emit per CONSUMED
  step, mang `phase` = post-step state). `getElapsedCombatSteps()` đếm
  emitted batch — không dùng. `steps` = toàn bộ lifecycle;
  `fightingSteps` = steps consumed under fighting — attribution theo
  PRE-step phase (transition step mang label post-step: countdown→fighting
  tính countdown, fighting→terminal tính fighting) →
  `combatDurationSeconds` là time base cho
  DPS/TTK/rate (intro/countdown là presentation time cố định).
- `fingerprint` = FNV-1a trên digest normalized (outcome, steps,
  rounded per-role totals, sorted reaction/cast/uptime, deaths) —
  witness cho same-seed equality + FPS-independence.

## Metric provenance (canonical surfaces only)

| Metric | Surface | Lưu ý |
|---|---|---|
| damage/DPS/bySource/byType | `damage` events | DPS dùng combatDurationSeconds |
| absorption | `wardAbsorbed + manaShieldAbsorbed` | `externalWardAbsorbed` đã nằm trong wardAbsorbed — breakdown only. Full mitigation (armor/resist/block) KHÔNG observable → recorded gap |
| healing | vitals `hpDelta>0` trên healing/leech/regen | `heal` events chỉ phủ healing/leech; regen hp chỉ qua vitals |
| overheal | `amount − hpDelta` trên healing/leech | regen `amount` = post-clamp applied → regen overheal unobservable → recorded gap |
| resources | **ward = vitals-complete**: mọi ward mutation emit vitals (spendWard/grantWard → `ward_spend`/`ward_grant`, damage drain qua `damage` before-snapshot, regen) — ledger đọc deltas trên mọi reason, trace KHÔNG đếm ward/apply_shield (double-count). Engine-lane spend (consume-ward burst, không có op) vẫn được capture | **mana = trace lane**: `consume_resource`/`gain_resource` với `resourceId: 'mana'` → `result.result?.applied` — raw field write, không vitals; vitals mp deltas (mana-shield drain trên `damage`, regen) cộng thêm, không overlap. **'the' = trace-ops + residual (P5)**: hit-income/proc transactions route qua `gain_resource`/`consume_resource` ops → exact totals qua `result.result?.applied`; raw writes (`grantTheFromCast`, empowerment burn `currentThe = 0`) không emit gì → residual lane `(netObserved − traceNet)` per participant bắt phần còn lại đúng một lần |
| casts | `attack` events by skillId | committed casts |
| uptime | per-snapshot `getBattleBuffs` | denominator = entity alive trong fighting steps |
| reactions | `reaction_resolved`/`reaction_skipped` | perMinute trên combatDurationSeconds |
| deaths/outcome | `death`/`kill` + terminal state | `maxSteps` cap → `timeout` |

Recorded gaps đi kèm mọi result qua `diagnostics.gaps` — observability
được khai báo, không claim lặng:

- `full_mitigation_unobservable` — armor/resist/block giảm trước
  `damage.value`, không có canonical surface.
- `regen_overheal_unobservable` — regen vitals `amount` là post-clamp
  applied, request không observable.

Lưu ý: cast-cost resource trên production path KHÔNG phải gap — routed
casts map `plan.cost` → `consume_resource` op qua scheduler (trace đọc
được). `commitAction → consumeResourceFor` chỉ chạy trên engine-unit
lane (không scheduler), không phải production path.

## Boundaries

- Không combat content mới, không combat-rule changes — engine
  non-determinism phát hiện là defect để REPORT, không normalize phía
  harness (ngoài entity-id normalization đã khai báo).
- Không được import bởi presentation/UI/gameplay — cùng class boundary
  với `CombatTraceExporter`.
- Economy/drop rolls (`Math.random`) nằm ngoài scope metrics — by design.
- `runBattles` = fresh GameManager per run — isolation by construction.

## Balance matrix (P5)

`benchmark/` = baseline recipes + benchmark fixtures + report runner —
công cụ đo cân bằng entry-level trên harness P4.

- `BalanceBaselines.ts` — `mortalSourcePlayer()` (mortal Lv12,
  tram/huy_quyen Lv3 + linh_bao castLv3 → mọi offer-gate đều mở),
  `BALANCE_SEEDS` (K=8 chung cho mọi cell), `BASELINE_RECIPES`
  (3 gate rows) + `ALTERNATE_RECIPES` (3 reported-only). Mỗi recipe =
  ritual pair + `postRitual` canonical writes + kit skill ids +
  `expectedEconomy` (phase-aware: `mustGenerate`/`mustSpend`/
  `notActiveAtThisPowerPoint`/`mustCast`; `none` hợp lệ).
- `BenchmarkEncounters.ts` — 5 fixture synthetic (single_target,
  multi_enemy swarm stage, durable_target, burst_pressure, attrition),
  stats tuned để scalar discriminate, KHÔNG phải real content.
- `BalanceReport.ts` — `runBalanceMatrix()` chạy recipe × benchmark ×
  seed, aggregate per cell (outcome-first: victoryRate → defeatRate →
  scenario scalar, ε=5%; TTK = median victory-only), gates:
  dominance / strength+weakness / stalemate / deadlock (phase-aware,
  all-defeat cells → `economyNoEvidence` chứ không tính deadlock) /
  secondary-dominance tri-state (PASS | REVIEW_REQUIRED |
  INCONCLUSIVE).
- `BalanceMatrix.test.ts` — committed `EXPECTED_FINGERPRINTS` (240
  per-seed fingerprints) + gate assertions = regression oracle; update
  bảng chỉ cùng commit với balance/content change gây drift.
- Baseline đo được + rationale:
  `docs/balance/2026-09-23-three-path-baseline.md`.
