# QA Review: correctness-ux mission E

- Date: 2026-09-17
- Mode: deep (mandatory escalation: offline accrual ownership, paid
  economy ticket lifecycle, and Vue/Pinia lifecycle all materially
  changed)
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: the 18 commits on `fix/correctness-ux`
  (master..HEAD — 0025ab12..9ed1bb2f); task list and per-commit scope in
  `game/docs/superpowers/plans/2026-09-16-correctness-ux-mission-e.md`.
  No unrelated dirty paths were included.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-E-1 | washPendingSlot / EquipmentWash | commit attempt consumes ticket unconditionally | Conservation | Reorder: lock item between preview and commit | commit returns `locked`, slot cleared, local ticket nulled | Unit (WashTab.test, GameManager.washTransaction.test) | High — paid currency path |
| INV-E-2 | WashTab local ticket | unmount with armed paid ticket | Lifecycle | Interruption | `discardWashTicket` invoked, domain slot cleared | Unit | High — paid ticket leak |
| INV-E-3 | washAffixCompareRows | pending longer/shorter than current | Synchronization | Value mutation | all rolled lines render; zero-line roll shows removed, not notRolled | Unit | Medium — paid-preview honesty |
| INV-E-4 | quest claim / QuestSystem | reward grant throws | Atomicity | Degraded env | cost retained (grant precedes debit) | Unit | High — currency loss |
| INV-E-5 | quest collect debit | grant succeeds, debit follows | Exactly-once | Reorder | debit provable post-grant (resolveClaimable proved bag) | Inspection + Unit | High |
| INV-E-6 | offline result / player.restoreFromSave | realm cap binds | Correctness | Value mutation | modal + payload report post-cap gain | Unit (restoreFromSave.test) | High — reported value wrong |
| INV-E-7 | offlineSummary store | restore fires modal | Exactly-once | Repeat | single owner (useAppLifecycle only) | Inspection — `offlineSummary.show` only at useAppLifecycle:307 | Medium — double modal |
| INV-E-8 | tribulation regen / EntityVitalsSystem | 1s steps while ongoing | Boundedness | Timing | clamp at snapshotMaxHp, heal scaled, dead → no regen | Unit (TribulationDirector.test) | Medium |
| INV-E-9 | TribulationScene vitals handler | entity_vitals_changed | Lifecycle | Repeat mount/unmount | damage number = hpBefore−hpAfter, reasons filtered; symmetric off() | Unit (damageNumbers.test) + e2e tribulation-flow | Medium |
| INV-E-10 | director.getState | caller mutates returned state | Isolation | Value mutation | detached copy incl. nested currentQuestion | Unit | Medium |
| INV-E-11 | enemy templateId chain | kill → quest/hidden-beast | Correctness | Cross-system | templateId flows Enemy→CombatEntity→loot consumer | Unit (questHook, EnemySystem.test) | High — kills never matched before |
| INV-E-12 | pill ops material guard | drink material-type pill | Conservation | Value mutation | rejected `material_pill`, pill retained, cell non-clickable | Unit + component | Medium |
| INV-E-13 | building gate/icons staleness | material/building changes post-mount | Synchronization | Stale state | stateVersion read inside computed/render paths | Unit (BuildingConstructionGate, HomeBuildingIcons) | Medium |
| INV-E-14 | StageSelectPanel mode | select stage B while mode armed | Stale state | Reorder | mode resets to manual on selectedStageId change | Unit | Low |
| INV-E-15 | announcement layer | modal up while announcement fires | Synchronization | Concurrency (visual) | elementFromPoint hits modal; click works; Escape dismisses | Playwright (announcement-layering.spec) | Medium — real-browser verified |
| INV-E-16 | announcement store | show/hide/timer overlap | Lifecycle | Repeat/Concurrency | tracked handle cleared on show/hide; no stale callback | Unit | Low |
| INV-E-17 | weightedRandom | empty entries | Boundedness | Value mutation | descriptive throw, not TypeError | Unit (DropRoll.test) | Medium |
| INV-E-18 | NodeSystem realm prereq | unknown prerequisite realmId | Fail-closed | Corruption (content drift) | returns false + console.warn | Unit (NodeSystem.test) | Medium |
| INV-E-19 | the_tu visual profile | resolve + presentation entry | Correctness | Cross-system | resolver returns 'the_tu'; profile entry exists (mortal art) | Unit (PlayerVisualProfiles.test) + architecture guards | Low |
| INV-E-20 | skill-level notification | level-up push | Correctness | Locale | messageKey + params; fallback message has real diacritics | Unit (NotificationQueue.test) | Low |
| INV-E-21 | battle log names | entry render | Synchronization | Cross-system | participant.entity.name + meta name, never raw id | Component (BattleLogPanel.test) | Medium |
| INV-E-22 | alchemy canBrew | missing herb/fuel/stones/slots | Fail-closed | Value mutation | button disabled; failure surfaces localized reason | Unit (AlchemyView.test) | Medium |
| INV-E-23 | useTurnBattleInfo.participantNameOf | name lookup mid-render | Synchronization | Stale state | re-derives inside stateVersion-tracked render path | Inspection + component test | Low |
| INV-E-24 | enhance tooltip cap | slot enhanceLevel display | Correctness | — | `+45/100` from MAX_SLOT_ENHANCE_LEVEL | Unit (useEquipmentTooltip.test) | Low |

## Evidence

Conclusive checks tied to the high-risk hypotheses:

- INV-E-1/2/3 — `commitWashAffixes` sets the slot to null before any
  validation (`EquipmentWash.ts`), the UI clears `pendingWashTicket`
  unconditionally after `washCommit`, `onBeforeUnmount` calls the
  ticketId-scoped discard, and compare rows iterate
  `max(current, pending)` with added/removed/notRolled markers. Tests:
  WashTab.test.ts (4 new), GameManager.washTransaction.test.ts
  (min-range contract pin). Green.
- INV-E-4/5 — `QuestSystem.claim` grants before the collect debit;
  `resolveClaimable` already proved the bag holds the cost, and
  `RewardSystem.give` touches only receiver currencies (no bag, no
  reachable throw). Item drops run last so the debit frees bag space.
  QuestSystem.test.ts green.
- INV-E-6/7 — `player.restoreFromSave` computes the post-cap delta and
  both stores (`lastRestoredPayloads`) and returns the corrected
  `offlineResult`; `offlineSummary.show` exists only at
  `useAppLifecycle.ts:307` — App.vue's duplicate is gone.
- INV-E-8/9/10 — regen routes through `EntityVitalsSystem.applyTurnRegen`
  on the ghost (real player stats, maxHp clamp, healingEffectiveness
  scaling, dead-entity rejection); the scene renders `-N` from the
  authoritative hpBefore/hpAfter delta on `entity_vitals_changed` with
  symmetric on/off; `getState()` returns a detached snapshot including
  a copied `currentQuestion`. TribulationDirector.test.ts +
  TribulationScene.damageNumbers.test.ts green; tribulation-flow e2e
  green in-worktree.
- INV-E-11 — `EnemySystem.spawn` stamps `templateId`,
  `enemyToCombatEntity` carries it, and the loot path passes
  `entity.templateId ?? entity.id` to quest + hidden-beast consumers.
- INV-E-15/16 — announcement layer dropped to 1850 (< modal 1900);
  `elementFromPoint` inside a firing announcement hits the modal and
  the continue button works in a real browser (new
  `announcement-layering.spec.ts`, green in-worktree); auto-close is a
  tracked handle cleared on show/hide; unmount clears the typewriter
  interval and the document-level Escape listener.
- INV-E-17/18 — `weightedRandom([])` throws a descriptive error;
  `hasPrerequisite` fails closed with `console.warn` on an unknown
  prerequisite realm (player-side unknown already fails via `>=`).
- INV-E-19/20/21/22/23/24 — verified by their scoped suites plus the
  i18n-parity and overlay-layers architecture guards.

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | Pass | clean |
| `npm run build` | Pass | built cleanly before the suite ran (same && chain) |
| `npx vitest run` (full) | Pass | 626 files / 5251 tests, 4 expected-fail |
| `npx playwright test tests/e2e/announcement-layering.spec.ts --workers=1` | Pass | 1 test, ~18s — in-worktree P14 for the layer fix |
| `npx playwright test tests/e2e/tribulation-flow.spec.ts --workers=1` | Pass | earlier in mission — P13 for Task 6 |
| `npx playwright test` (full, 2 workers) | Pass | 27/27 ok in-worktree — includes announcement-layering and tribulation-flow |

## Findings

No Confirmed defects. Deferred Low/Nit observations:

- `vitalsDamageAmount` covers the six damage-shaped reasons; reasons
  outside the set that could lower HP (e.g. a future `stat_refresh`
  clamp mid-tribulation) render no number — cosmetic at worst, and the
  ghost's stats are snapshot-fixed so the path is unreachable today.
  Low.
- Pending-only wash rows label the before cell `status.added`
  ("dong moi") — reads naturally in a diff table; a bare em-dash would
  also be defensible. Nit.
- `show()`/`hide()` clear the module-scoped auto-close handle; two live
  Pinia instances in one page would share it — unreachable (one app,
  one pinia). Nit.

## New or Changed QA Tests

None added by this QA pass — every hypothesis resolved against the
task-shipped failing-first regression tests or direct runtime evidence.

## Gaps and Residual Risk

- No e2e asserts the zero-line wash preview row text in a real browser;
  component-level coverage is conclusive for the DOM contract.
- `messageParams` carries `gained` on the single-level variant too —
  unused interpolation param, harmless.

## Pre-existing Failures

None observed in the audited scope.
