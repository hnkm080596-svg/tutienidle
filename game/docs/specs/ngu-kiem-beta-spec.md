# Ngự Kiếm Beta — Spec + Audit + Plan

> Design authority: `NGỰ KIẾM — EVOLUTION SKILL DESIGN` (dispatch attachment).
> Beta window: Luyện Khí (`qi_refining`) → Trúc Cơ (`foundation_establishment`).
> Branch: `devin/1790284398-ngu-kiem-beta`. Written before any production edits.

## 1. Design essence (beta)

- Ngự Kiếm is ONE active skill that EVOLVES per realm — not a kit of skills.
  LQ = `Ngự Kiếm · Khởi`, TC = `Ngự Kiếm · Liên` (one-char suffix naming law;
  displayed name = newest unlocked evolution).
- Three separate progression axes: Core Level (per-sword power, sole
  skill-level authority), Kiếm Đạo (sword count, LQ cap 2 / TC cap 3),
  Evolution (mechanic layers, vertical accumulation — old evolutions stay).
- Khởi: each Kiếm Đạo spawns one phi kiếm — a REAL ordered damage instance
  through the normal pipeline (hit/miss/crit/armor standard, NO guaranteedHit).
  Sequential resolution; sword N reads live state after sword N-1. One cast
  locks one target; no retarget on mid-cast death.
- Kiếm Ý accrues per resolved cast (hit-or-miss alike); at forge threshold it
  auto-forges +1 Kiếm Đạo (consumed).
- Liên (TC): cast-local "Kiếm Thế" — each LANDED sword adds +1 stack; later
  swords in the same cast get bonus damage per existing stack. Miss adds none,
  never resets. Kiếm Thế is pure runtime state: not persisted, not a buff, not
  a player stat, resets at cast end.
- Breakthrough merge: live Kiếm Đạo fold into permanent `kiemDaoBase`, live
  count resets to 1, cap updates; the new realm's evolution node becomes
  Available (player spends Insight to lĩnh ngộ — not auto-active).
- Evolution nodes: single-level, granted (Khởi at ritual commit; Liên requires
  TC + Khởi + Insight), never modify character stats, vertical accumulation
  spine; future realms may show sealed `???` placeholders.
- NON-GOALS (verbatim): no guaranteed hit, no execute, no crit privilege, no
  armor privilege, no multi-target retarget, no sword-formation sub-build, no
  multiple active skills, no active Special, no active Ultimate, no Cửu Cung
  skill tree, no Roll Cascade, no generic player-stat nodes, no branch choice,
  no evolution node levels, no Kim Đan+ design.

## 2. Audit — §60 surface classification

Legend: **CURRENT+ALIGNS** = keep as-is; **CONFLICTS** = violates the design,
must change; **LEGACY** = remove; **REUSABLE** = existing mechanism reused;
**MISSING** = must be added.

### Combat — the skill + instance machinery

| Surface | Verdict | Detail |
|---|---|---|
| `NGU_KIEM_THUAT` def (single-target, cd 0, physical mult + levelScaling) | CURRENT+ALIGNS | Keep id `ngu_kiem_thuat`, cd 0, physical, `levelScaling 0.05`. `presetId 'slash'` → changed to `'metal_slash'` (phi kiếm, §46-48: no color change needed, distinct from Kiếm Phổ swing). |
| `instances.count = kiemDaoCount` ordered instances, sequential resolution, dies-with-target, no retarget | CURRENT+ALIGNS | `TurnBattleSystem` instance loop (L2210-2250) + plan-lane unrolled ops already implement ordered sequential hits; the plan lane is production authority. |
| `perInstanceOptions` emitting `guaranteedHit` + Roll Cascade rolls (execute/crit/pierce) | CONFLICTS | Design non-goals: no guaranteed hit, no execute, no crit privilege, no armor privilege, no Roll Cascade. All rolls removed; per-instance options become `{damageMultiplier}` (Liên momentum) via a new third arg `priorLandedInstances`. |
| `instances.each` declarative block (`guaranteedHit/execute/critChance/armorPierce`) | CONFLICTS | Khởi emits no `each` at all (plain standard hits). Liên extends `each` with `momentumPerLandedInstance` — a new generic declarative field (content-level contract seam, not new engine policy). |
| `each.momentumPerLandedInstance` (new) | MISSING | Declarative scalar: bonus coefficient per landed prior instance. Plan lane: `SkillResolver.translateDealDamage` emits `read` step `ops_result_sum{priorHitOpIds,'landed'}` → var + late coefficient binding `base*(1+rate*var)` (the `scaleBuff` pattern, L1036-1055 emit site, makePayload L1193-1238). Multiplier order (§55): `coefficient = authored(expr w/ levelScaling) × coefficientScale(input.scale×theScale) × per-instance multiplier × (1+rate×landedPrior)` — Liên folds multiplicatively into the SAME late binding → after base+Core scaling. |
| `perInstanceOptions` third arg `priorLandedInstances` (new) | MISSING | Engine-unit lane (runtime===undefined) can express momentum only via the closure; pass cast-local `landedCount` into the closure → `{damageMultiplier: 1+rate*landed}` composes into `HitResolveOptions.damageMultiplier` ("multiplied into the skill multiplier before crit", ActionImpactSystem L99-102) — same multiplier position as the plan-lane fold. Generic signature; any provider may read it. |
| `ops_result_sum` `field:'landed'` substrate (`SkillExecutor` L860-907) | REUSABLE | Exactly the "count landed ops among ids" primitive Kiếm Thế needs. Plan vars live in plan execution scope → cast-local by construction, never persisted (§53 compliant). |
| Sequential RNG order + presentation-timing independence (§54) | CURRENT+ALIGNS | Both lanes resolve instance ops in order; VFX is a presentation effect, not an ordering input. |
| Mid-cast target death → remaining swords stop, no retarget | CURRENT+ALIGNS | Engine lane `!target.entity.alive` break + plan-lane nested alive checks (T3-22b). |

### Combat — slots + emblem surface

| Surface | Verdict | Detail |
|---|---|---|
| `emblemSlots` on `CultivationPathRuntime` + `resolveCombatSkillRoles` emblem precedence | REUSABLE (contract kept) | The Tu shares the contract member. Only the hidden-way callback is removed. |
| `TU_KIEM_Y_EMBLEM` / `KIEM_DAO_CASCADE_EMBLEM` defs + display metas + `ownedContent` entries + hidden `emblemSlots` return | LEGACY | Design: no active Special, no active Ultimate → emblem pair removed. `emblemOnly` flag stays (The Tu uses it). |
| `resolveSpecialUltimate: () => undefined` for hidden way | CURRENT+ALIGNS | Already returns no real slots. |
| `describeDynamicBasic` name `'Ngự Kiếm Đạo'` | CONFLICTS | Rename to `'Ngự Kiếm'` (HUD label matches the skill's base name). |
| `TurnSkillDisplayMeta` for the 3 defs | CONFLICTS | `ngu_kiem_thuat` meta updated (name `'Ngự Kiếm'`, description rewritten for ordered-sword semantics); tu_kiem_y/kiem_dao_cascade metas removed with their defs. |
| `instances.each` adapter verbatim copy (`adaptInstances` L623-665) | REUSABLE | Extended to copy `momentumPerLandedInstance` — content-level seam, no engine change. |

### Progression — three axes

| Surface | Verdict | Detail |
|---|---|---|
| `core_ngu_kiem_thuat` in NATIVE_CORE_SKILL_IDS + NATIVE_DAMAGE_BEARING (maxLevel 10, levelScaling 0.05) | CURRENT+ALIGNS | Core Level stays the sole skill-level authority. |
| `swordPath` slice `{preset, kiemY, kiemDaoCount, kiemDaoBase}` + `freshSwordPathState` | CURRENT+ALIGNS | Count + merge state already persist; Kiếm Ý banked across breakthroughs. |
| `forgeCost(r)=ceil(9999*1.3^(r-1))`, `kiemDaoCap(r)=r+1` → LQ 2, TC 3 | CURRENT+ALIGNS | Exact design caps (provisional forge cost — balance deferred). |
| `gainKiemY` (bank→auto-forge→cap no-op), `grantKiemDao`, `loseKiemY`, `applyBreakthroughMerge` (base*=1+0.3*merged, count→1) | CURRENT+ALIGNS | Exact §50 merge semantics; triggered at real realm advances (TribulationOutcomeService → applySwordPathRealmTransition), never at initiation (M6). |
| `NGU_GROWTH_NODES` (ngu_kiem_sac/phong/sat statModifiers) | LEGACY | Non-goal: no generic player-stat nodes. |
| `NGU_CASCADE_NODES` (a/e/d cascadeUnlock) | LEGACY | Non-goal: no Roll Cascade. |
| `CUU_CUNG_NODES` (8 kiemYGrant + cuu_cung_trung kiemDaoGrant) | LEGACY | Non-goal: no Cửu Cung skill tree. Count axis = forge only. |
| `NodeEffect.kiemYGrant / kiemDaoGrant / cascadeUnlock` + `grantKiemDao/loseKiemY` purchase/clawback plumbing | LEGACY | Dead after node removal → fields, `purchaseNode` one-shot grants, clawback records for them removed. `loseKiemY`/`grantKiemDao` lose their only callers → removed with the grant machinery (forge path inside `gainKiemY` keeps its own internal count write). `NodeOneShotGrantRecord.kiemY/kiemDao` fields dropped (shape stays a record — old dev saves just carry dead fields, tolerated). |
| `kiemDaoBelowCap` prereq kind | LEGACY | Only CUU_CUNG used it → kind, evaluator, inspector formatter, i18n key removed. `nodeCount` stays (generic). |
| `grantSkillCore` generic 0→1 ownership write | REUSABLE | Drives the ritual evolution grant for ANY node, not just cores. |

### Progression — evolution spine (new)

| Surface | Verdict | Detail |
|---|---|---|
| `NGU_EVOLUTION_NODES` — `ngu_kiem_khoi` (LQ), `ngu_kiem_lien` (TC), `ngu_kiem_phong` (sealed `???` placeholder gated golden_core) | MISSING | Single-level `maxLevel 1`, `branchTag 'ngu_kiem'`, `requiredWay 'hidden_sword_pathway'`, `requiredCultivationPath 'sword'`, `effect.evolutionId` marking. Chained node-prereqs (`lien` requires `khoi`) → NodeTreePanel depth groups them vertically automatically = the spine (smallest coherent surface, §3). The `???` node carries prereq `realm golden_core` → unreachable inside beta ceiling → renders locked forever as the sealed future slot (§future-realms tease). |
| `effect.evolutionId?: string` on `NodeEffect` | MISSING | Generic/data-driven evolution marking (§52 — future realms reuse; provider collects owned ids, never checks nodeIds). |
| `grantedNodeIds?: readonly string[]` on `PathWayDefinition` | MISSING | Declares ritual-granted nodes. `HIDDEN_SWORD_PATHWAY.grantedNodeIds = ['ngu_kiem_khoi']`. Preflight `registry.has` + commit-loop `grantSkillCore` parallel to `coreSkillIds` (GameManagerRealmAdvanceOps ~L342). |
| Khởi purchase rejection | MISSING | Mirror element roots: `purchaseNode` + `canPurchaseNode` reject `grantedOnly` ids — add `NGU_KIEM_EVOLUTION_GRANTED_IDS` (Khởi only) check in `canPurchaseNode` so it can never be bought (it is granted, not bought). Liên stays purchasable. |
| Respec exemption | MISSING | `NGU_KIEM_EVOLUTION_NODE_IDS` appended to `RESPEC_PRESERVED_NODE_IDS` (element-root pattern, GameManagerProgressionOps L71) → evolution nodes exempt from every respec scope; devResetBranch does NOT preserve them (dev tool intentionally wipes). |
| `evolution` accumulation rule | CURRENT+ALIGNS via ownership | Owned evolution ids accumulate in `nodeLevels` — old evolutions stay active once owned; nothing revokes them. |

### UI / presentation

| Surface | Verdict | Detail |
|---|---|---|
| `NodeTreePanel` 'ngu_kiem' branch + way-gated rendering | REUSABLE | Chained prereqs render the spine vertically; `SWORD_PATH_VIEW_TAGS`/`viewBranchTags`/nodeWayApplies unchanged. |
| `NodeInspector` | REUSABLE + small fix | Description carries Trước/Sau text + `Cost: X Cảm Ngộ` + `[LĨNH NGỘ]` button already. Fix: hide the (disabled) "Nâng Cấp" button when `level >= maxLevel` so owned single-level nodes show just "Đã Lĩnh Ngộ" (Khởi: §41-42 "no purchase button"). |
| `SkillPathList` native entry | CURRENT+ALIGNS | ONE `Ngự Kiếm` entry (native core, Basic, `Core Lv. X`) — no extra list items (§43). |
| `NativeCoreDetail` / entry naming | MISSING (small) | Displayed name = newest unlocked evolution → `resolveNguKiemSkillName(player)` helper ('Ngự Kiếm · Khởi' / 'Ngự Kiếm · Liên'); native entry for `ngu_kiem_thuat` resolves name + an `Evolution: <name>` subtitle (§43 line "Evolution: Liên"). |
| `kiemBarBridge` mode `'ngu_kiem'` (`Kiếm Ý · N kiếm`, count, base, forge progress) | REUSABLE | Hero-state surface for Kiếm Ý progress + Kiếm Đạo count already exists; label stays. |
| `QuanKhiPanel` sword spec card | REUSABLE | specNameDisplay text updated ('Ngự Kiếm — phi kiếm từng đòn độc lập theo thứ tự; Kiếm Ý rèn Kiếm Đạo, cảnh giới mới mở tầng tiến hóa'). |
| VFX `presetId` | REUSABLE + bounded | `'slash'` → `'metal_slash'` (distinct metal phi kiếm feel). Per-instance stack-brightness trails NOT expressible (presentation lives at plan root only, operations.ts: no per-op presentation) — documented bound; per-cast presetId is the cheap variant. Ordered impacts already read as N separate fly-outs (sequential events). |
| `kiemDaoBelowCap` i18n reason + NodeInspector formatter branch | LEGACY | Removed with the prereq kind. |

### Way / ritual / save

| Surface | Verdict | Detail |
|---|---|---|
| `HIDDEN_SWORD_PATHWAY` (name, offerGate tram Lv3, capability `sword.sword_riding`, technique `myriad_swords_art`, `nodeTreeTag 'ngu_kiem'`) | CURRENT+ALIGNS | `ownedContent.skillIds` trimmed to `[NGU_KIEM_THUAT.id]`; `coreSkillIds` unchanged; new `grantedNodeIds`. |
| `chooseCultivationPath` commit (kit grant + realm promote + `coreSkillIds` loop) | REUSABLE | `grantedNodeIds` preflight + grant loop appended. |
| `applySwordPathRealmTransition` merge seam | CURRENT+ALIGNS | §50 satisfied: merge at real advances, evolution node availability via prereq. |
| Save shape (`CURRENT_SAVE_VERSION` 84, `validateSwordPathPersistedState`, strict `core_*` checks, coverage checks) | CURRENT+ALIGNS | **No version bump**: no PlayerData shape change — evolution state persists via canonical `nodeLevels`/`purchasedNodeIds` (non-core ids need only finite ≥0; removed node ids in old saves resolve to `undefined` in the registry and are skipped → inert). Kiếm Đạo count + `kiemDaoBase` merge state already persist. Kiếm Thế never persists. `grantsSkillCoreIds` is NOT used on evolution nodes (coverage rule honored). |
| Way isolation (`requiredWay` on all ngu nodes, hien cannot buy ngu / ngu cannot buy hien) | CURRENT+ALIGNS | Evolution nodes stamped identically. |

## 3. Target architecture

```text
Ritual (chooseCultivationPath)
  → way.grantedNodeIds → grantSkillCore(ngu_kiem_khoi)        [evolution axis starts]
Battle build (buildNguKiemDaoProvider)
  → collectOwnedEvolutionIds(player, registry)                [effect.evolutionId set]
  → resolveDef():
      instances.count   = swordPath.kiemDaoCount
      damage.multiplier = swordPath.kiemDaoBase
      (khoi)            → no `each`, no guaranteedHit — plain standard hits
      (+lien)           → each.momentumPerLandedInstance = LIEN_MOMENTUM_RATE
                          perInstanceOptions(idx,target,priorLanded) →
                            {damageMultiplier: 1 + rate*priorLanded}
Cast (plan lane — production)
  → per instance i (target locked, sequential):
      i>0 & lien → read ops_result_sum(priorHitOpIds,'landed') → var
                  hit coefficient late-binding ×(1 + rate*var)
      hit resolves through standard pipeline (hit/miss/crit/armor)
Cast (engine-unit lane — runtime===undefined only)
  → perInstanceOptions gets priorLandedInstances → damageMultiplier fold
Post-cast (both lanes)
  → onCastResolved → gainKiemY(player, +1) → forge loop in gainKiemY
Realm advance (TribulationOutcomeService)
  → applySwordPathRealmTransition → applyBreakthroughMerge
  → Liên node's realm prereq opens → player buys with Insight
```

Kiếm Thế = the plan-local var / `priorLandedInstances` counter — cast-local
by construction: zero persistence, no buff, no player stat (§53).

## 4. Implementation plan

Ordered, minimal-diff:

1. `KiemTuNodes.ts` — replace NGU_CASCADE + NGU_GROWTH + CUU_CUNG with
   `NGU_EVOLUTION_NODES` (khoi/lien/phong) + `NGU_KIEM_EVOLUTION_NODE_IDS`
   export. Keep ORB_NODES + stamping helper.
2. `ProgressionNode.ts` — `NodeEffect` + `evolutionId?: string`; drop
   `kiemYGrant`/`kiemDaoGrant`/`cascadeUnlock`; drop `kiemDaoBelowCap`
   prereq kind.
3. `NguKiemDao.ts` — keep forge/cap/merge economy; drop cascade constants +
   `grantKiemDao`/`loseKiemY`; add `LIEN_MOMENTUM_RATE` + `resolveNguKiemSkillName`.
4. `NguKiemDaoProvider.ts` — rewrite: `collectOwnedEvolutionIds` (replaces
   `collectKiemDaoCascadeUnlocks`); `resolveDef` composes khoi/lien shape;
   `perInstanceOptions` gains `priorLandedInstances` (signature bump);
   `onCastResolved` unchanged.
5. `TurnSkillAction.ts` — `instances.each` + `momentumPerLandedInstance`,
   `perInstanceOptions` signature `(index, target, priorLandedInstances)`.
6. `SkillDefinition.ts` (`SkillInstances.each`) + `LegacySkillAdapter`
   (copy field) + `SkillResolver` (momentum read+late binding in
   `translateDealDamage`) — the §53 generic mechanism, not ngu-specific.
7. `TurnBattleSystem.ts` — instance loop tracks `landedPriorInstances`
   per target, passes into `perInstanceOptions`.
8. `KiemTuPath.ts` — `ownedContent` trim; `grantedNodeIds` on the def;
   keep the rest.
9. `GameManagerRealmAdvanceOps.ts` — `grantedNodeIds` preflight + commit
   grant loop.
10. `GameManagerProgressionOps.ts` — `RESPEC_PRESERVED_NODE_IDS` +=
    NGU_KIEM_EVOLUTION_NODE_IDS; purchaseNode grantedOnly rejection; drop
    kiemY/kiemDao grant handling + clawback fields.
11. `NodeSystem.ts` — `canPurchaseNode` rejects granted-evolution ids;
    drop `kiemDaoBelowCap` case.
12. `KiemTuState/KiemTuPath` — no changes (slice already aligns).
13. `CultivationPathRegistry.ts` — drop `emblemSlots` on hidden runtime,
    `collectKiemDaoCascadeUnlocks` → `collectOwnedEvolutionIds`,
    describeDynamicBasic → 'Ngự Kiếm'.
14. `NguKiemDaoSkills.ts` — delete emblem defs; NGU_KIEM_THUAT preset
    → `metal_slash`.
15. `TurnSkillDisplayMeta.ts` — update ngu_kiem_thuat; drop emblem metas.
16. `NodeInspector.vue` — hide upgrade button when level ≥ maxLevel.
17. `SkillPathPanel.vue` — native entry evolution-aware name/subtitle
    for `ngu_kiem_thuat` (via domain helper — content stays in domain files).
18. `NguKiemDao.test.ts`, `NguKiemDaoProvider.test.ts`,
    `GameManager.nguKiemDao.test.ts`, `GameManager.kiemTuNguWay.test.ts`,
    `invariants`, `KiemTuNodes.test`, `kiemTuTree`, `deadIds`,
    `LegacySkillCoverage`, `NodeSystem.way`, `clawback`, `turnStatusVfx`,
    `TechniqueGateAuthored`, `KiemTuPath.way` — update pins to beta
    semantics; add new pins.
19. `locales` — drop kiemDaoCap reason; adjust any ngu strings.
20. `SkillDefinitionRegistry` — field validation for
    `each.momentumPerLandedInstance` if `each` fields are validated.

## 5. Pin tests (dispatch §5)

- Multi-instance ordering: N swords → N sequential impacts (existing pin kept;
  plan+engine lanes).
- Miss semantics: high-evasion dummy → all swords miss; chain doesn't
  collapse, +1 Kiếm Ý still accrues.
- No guaranteedHit: provider def emits no `guaranteedHit`/`each.guaranteedHit`;
  misses actually occur.
- Kiếm Thế: Liên owned → sword N>1 damage > sword 1 when prior landed
  (deterministic rng: evasion 0, crit 0); cast-local reset — next cast's
  sword 1 carries no bonus.
- Forge threshold: `gainKiemY` crossing `forgeCost(realm)` → count +1.
- Merge: breakthrough → base *= 1+0.3*merged, count → 1.
- Realm caps: LQ cap 2, TC cap 3 (existing pins kept).
- Evolution gating: Khởi auto-granted at ritual (free, `nodeLevels=1`,
  `purchasedNodeIds` member, not purchasable); Liên blocked below TC /
  without Khởi; purchasable at TC for Insight; respec preserves both.
- `instances.each.momentumPerLandedInstance` → plan ops read+late binding
  (resolver-level pin if feasible).

## 6. Deferred (design §56 + found bounds)

- Balance tuning: per-sword coefficient, Core scaling, Kiếm Ý/cast,
  forgeCost curve, merge multiplier, Liên rate, Liên Insight cost.
- Per-instance VFX trail/brightness growth (needs per-op presentation —
  contract extension deferred; per-evolution `presetId` is the shipped
  variant).
- Kim Đan+ evolution node design (only the sealed `???` placeholder ships).
- devResetBranch retains non-preserving semantics (dev tool; documented).
- Legacy lane (runtime===undefined): identical momentum semantics kept via
  `priorLandedInstances` — no degradation needed.

## 7. Open questions

- Liên Insight cost: provisional value (spec §56 defers tuning) — using
  3 Insight matching sibling single-level node scale.
- `ngu_kiem_phong` description: sealed placeholder text (no mechanic).
