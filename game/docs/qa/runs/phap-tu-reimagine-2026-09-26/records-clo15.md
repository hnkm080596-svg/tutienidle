# CLO-15 Closure Report — SEALED

**QA run:** phap-tu-reimagine-2026-09-26 · repo hnkm080596-svg/tutienidle · branch devin/1790423750-phap-tu-reimagine
**Ledger HEAD:** f7aec8eb · **Fix pins:** 42fbadd7 (clean-K batch) + 9eb96edb (CLO-14 residual)
**Reviewer worktree:** `.agent-worktrees/pt-reim-rev-clo15` @ f7aec8eb (detached). Repo writes: `*.test.ts` repros only — one file added (`game/src/core/battle/turn/TurnBattleSystem.clo15Repro.qa.test.ts`).

## Verdict: SEALED — all 7 claims @42fbadd7 + the @9eb96edb residual verified in code AND at runtime. No failing claims, no new residuals.

## Verification gate (mandated command)
- `npm ci` clean · `npm run type-check` (vue-tsc) clean
- `npx vitest run src/core/battle src/core/skilldef src/core/combat src/presentation/bridges tests/architecture/asciiComments` → **131 files / 1129 tests, all pass** (1124 shipped + 5 new closure repros)

## @9eb96edb — subcasts × chargeTurns whole-field forbid — VERIFIED
- `SkillDefinitionRegistry.ts` ~463-474: `subcasts !== undefined && cadence?.chargeTurns !== undefined` → unconditional `fault('invalid_field_value','subcasts', …)`. The old variant-shaped gate (`count>0 || multicast`) is gone; `compositePool`, `compositeCount`, even a bare `subcasts:{}` all fault.
- Mechanism confirmed: deferred charge resolve runs `payloadOnly: true` (`TurnSkillPlanRuntime.ts` ~271-272) → resolver strips `rootSubcasts` **and** `preResolved` wholesale (`SkillResolver.ts` 189-191). Every subcasts shape is dead authoring on a charged def — the forbid is the correct envelope.
- No smuggle path: `SkillDefinition.variants` carries only `empowerment` (empowerment×chargeTurns already forbidden at ~448); `compositePool` ref-resolution faults are collected in a separate post-pass and can't mask the mutual-exclusion message (aggregate throw at :1387-1389).
- Test rows present (`SkillDefinitionRegistry.test.ts` ~104-126): `count`, `multicast`, `compositePool:['pool_base']`, `compositeCount:2` all asserted to throw the mutual-exclusion fault. PASS.

## @42fbadd7 — claim-by-claim

**1. Charge-resolve whiff/dangling split (~2018-2043) — VERIFIED + repro'd.**
`armedCharged` (:2030-2034) mirrors the declare-time lookup exactly (`actor.special?.skill.id === declared.skillId || actor.ultimate?.skill.id === declared.skillId`); `declared.skillId` carries `chargedId` on this lane (:1926-1931). Whiff → silent (no warn, no `castBlocked`); dangling → `castBlocked=true` + `reportUnroutedCast(…, declined=true)` labelled by `chargedSkill?.id ?? skillId`.
Runtime repro: whiffed resolve (enemy dead at resolve) produced `chargedSkill=null`, `castBlocked` unset, zero UNROUTED warns; dangling resolve (special slot cleared mid-charge) produced `castBlocked===true` + exactly one warn naming `player_special`.
Reachability audit: adapter-unsupported charged defs are disarmed+reported at **init** (:2127-2156); both disarm sites clear `pendingChargedSkillId` AND `chargingTurnsRemaining` together — no desync arm. Only shipped `chargeTurns` carrier is the companion ultimate `van_du_kiem_khach_ultimate`, so the special/ultimate discriminant covers every reachable arm. PASS.

**2. Pre-gate probe (~2164-2178) — VERIFIED + repro'd.**
`runtime!==undefined && affected.length===0 && action.skill!=null && unsupportedFor(skill).length>0` → `castBlocked=true`, after the coverage `reportUnroutedCast`. Closes the real hole: a zero-target unrouted cast skipped the apply lane and reached the shared tail ally-window call (:2423-2426) looking completed. Repro: unsupported def + dead enemy → `castBlocked===true` + one warn; covered-def zero-target control → silent whiff, no stamp. `action.skill===null` is unreachable on non-null actions (NULL_ACTION maps skillId ''→action:null). PASS.

**3. Self-extra landed gate (~2741-2750) — VERIFIED + repro'd.**
`extraScope==='self' && (runtime===undefined || routed!==null)` gates `landedIds.push(actor.id)`. Repro: unrouted self extra (consume-pair without damage → catalog-unsupported) → `landedTargetIds` excludes 'player' + warn fired; covered self extra → 'player' present (parity preserved). Side-note verified: a zero-op self def is registry-rejected ("need at least one operation") → same loud unrouted lane. PASS.

**4. `percentCostIsManaApplicable` (~257-259) — VERIFIED.**
`'none'` removed; non-mana + `resourceCostPercentOfMax` reports (flat-cost or resolves-free variants). Parity confirmed with `requiredResourceFor`/`hasResourceFor`/`consumeResourceFor` which already treat `'none'` as free (`TurnSkillAction.ts` 410-437) — the fix removes a genuine adapter/legacy divergence. No authored def carries 'none'+percentOfMax: the sole producer stamps it on `resourceType:'mana'` Phap Tu specials (`CultivationPathRegistry.ts` :419). No regression. PASS.

**5. `drainAllThe` route (EntityResourceAdapter ~144-148) — VERIFIED.**
Consume-'all' for 'the' now calls `drainAllThe(entity)` (TheEconomy:43-45 = `entity.currentThe = 0`) — identical mutation through the canonical authority. Residual sweep of `currentThe` writes: remaining direct writes are the bounded-spend path (adapter :156, expected) and `resetBattleScopedResources` (Player.ts:644 — battle-boundary reset, a different documented semantic, not a consume). Channel-resource 'all' path (channel.drain ?? spend) unchanged. PASS.

**6. Docblocks — all four present:** SkillResolver dual-gate latent note (:211-219) · CombatEntity `maxThe` divergence consequence (:62-66) · `theBurned` corrected (:485-491 — producer live at applyCast, dormant by data not dead machinery) · `resolveAllyActionWindow` latent-ambiguity paragraph (:3089-3098). PASS.

**7. `lastOpResult` backward scan (TurnSkillPlanRuntime :668-679) — VERIFIED.** Index walk from `records.length-1`, first match returns — identical latest-record semantics to `[…records].reverse().find()` with no reversed-copy allocation; `record!==undefined` guards sparse slots. PASS.

## Residual/regression hunt (same surfaces)
- No path left where an armed resolve routes silently-wrong: init disarm pairs verified, tick turns carry `action=undefined` (probe can't misfire), and a swapped-slot resolve lands on the dangling arm (loud) — observed in repro.
- Observation (not a finding): a whiffed charge-resolve still opens the shared tail `resolveAllyActionWindow` with `landedTargets=[]` (non-damaging roll over all enemies) while a whiffed normal cast skips it via the `affected===0` gate. Pre-existing asymmetry, not introduced by this batch, and dormant per the new docblock — no shipped proc carries `firesOnNonDamagingAction`. Flagging for the record only.
- `git status`: clean tree except the one QA repro test file; HEAD = f7aec8eb.

## records-clo15.json (drop-in)
```json
{
  "reviewer": "devin-9640167b060241ffabd5b44d907e29d8",
  "verdict": "SEALED",
  "evidence": "npm ci + type-check clean; npx vitest run battle+skilldef+combat+bridges+asciiComments = 131 files / 1129 tests PASS (incl. 5 closure repros in TurnBattleSystem.clo15Repro.qa.test.ts)",
  "fixesVerified": [
    "@9eb96edb: whole-subcasts x chargeTurns forbid; compositePool/compositeCount test rows present; payloadOnly strips rootSubcasts+preResolved at deferred resolve",
    "1 whiff/dangling split: armedCharged discriminant mirrors declare lookup; repro'd silent whiff + loud dangling (warn+castBlocked)",
    "2 pre-gate probe: zero-target unrouted cast stamps castBlocked; repro'd warn+stamp vs covered-def silent control",
    "3 self-extra push gated on executed lane; repro'd unrouted extra excludes actor.id, routed self extra retains it",
    "4 percentCostIsManaApplicable: 'none' reports like other non-mana; only producer stamps on mana defs -- no regression",
    "5 consume-all 'the' routes drainAllThe; sibling direct writes are bounded-spend + battle-reset (different semantics)",
    "6 four docblocks present; 7 lastOpResult backward index scan, allocation-free, same semantics",
    "residual: none; dormant observation noted re whiffed resolve opening ally window (pre-existing, no shipped firesOnNonDamagingAction proc)"
  ]
}
```
