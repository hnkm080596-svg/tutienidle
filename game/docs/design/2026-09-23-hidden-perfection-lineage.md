Hidden Perfection Lineage & Body Progression

Status: FINAL / DESIGN LOCKED
Scope: Phàm Nhân → Luyện Khí → Trúc Cơ
Beta endpoint: End of Trúc Cơ

⸻

1. Realm Progression

Each major realm has a continuous minor-level progression:

Lv1 → ... → Lv12 → ... → Lv18

There is no separate post-Lv12 or “overcap cultivation” system.

Cultivation continues automatically through Lv13–18 using the same canonical cultivation pipeline. Lv13–18 should require substantially more time than earlier levels; the exact curve is BALANCE.

1.1 Normal Breakthrough

Normal Breakthrough becomes eligible at:

realmLevel >= 12

Lv12 is the Normal Breakthrough gate, not a forced endpoint.

At Lv12 the player may attempt Normal Breakthrough immediately or continue cultivating naturally toward Lv18.

Normal Breakthrough does not require:

* normal Body completion;
* Hidden Body;
* five main stats at cap;
* hidden progression;
* Technique max;
* Skill max;
* a hidden material.

Body progression provides combat power. It is not a mandatory Normal Breakthrough checkbox.

An underprepared player may therefore attempt breakthrough and fail the actual challenge/Tribulation.

1.2 Hidden Breakthrough

Hidden Breakthrough cannot become eligible before:

realmLevel >= 18

Lv18 is the Hidden Breakthrough gate.

Reaching Lv18 alone MUST NOT reveal a hidden route.

Hidden Breakthrough requires:

realmLevel >= 18
AND hiddenLineageActive
AND currentRealmHiddenBodyCompleted
AND allFiveMainStatsAtEffectiveCap
AND ordinary breakthrough requirements satisfied

⸻

2. Exactly Two Breakthrough Types

The canonical system contains exactly:

Normal Breakthrough
Hidden Breakthrough

Do not introduce intermediate qualities, partial hidden breakthroughs, recoverable hidden branches, or additional breakthrough tiers.

⸻

3. Hidden Lineage

Hidden progression is one continuous perfection lineage across the realm ladder.

Valid histories form a strict prefix:

[]
[Mortal]
[Mortal, Qi]
[Mortal, Qi, Foundation]
...

Invalid examples:

[Qi]
[Foundation]
[Mortal, Foundation]

A realm cannot be skipped and the hidden route recovered later.

3.1 Normal Breakthrough closes the lineage

When a Normal Breakthrough successfully commits the realm transition:

hiddenLineageActive = false

permanently.

The character can never access a later-realm Hidden Body or Hidden Breakthrough.

The lineage MUST NOT close merely because the player:

* becomes eligible for Normal Breakthrough;
* presses the breakthrough button;
* begins Tribulation;
* fails a Normal Breakthrough attempt.

No successful realm transition means no lineage closure.

3.2 Hidden Breakthrough preserves it

Successful Hidden Breakthrough:

hiddenLineageActive remains true

and advances the player into the next realm’s hidden lineage.

3.3 Historical rewards survive

Hidden Bodies already completed remain completed permanently.

Their rewards survive a later Normal Breakthrough.

Normal Breakthrough only destroys access to future hidden progression.

3.4 Unfinished hidden progression freezes

If the lineage closes while current-realm hidden progress is incomplete:

* preserve the historical state in the save;
* make it permanently inert;
* never resume it;
* never transfer its progress/pity into another realm;
* do not expose it as active progression.

Do not delete/reset historical progress merely to simplify runtime state.

⸻

4. Hidden Content Must Not Leak

A player who has not discovered a hidden mechanic must not be told that it exists.

Before the authored discovery condition, UI MUST NOT expose:

* hidden rows;
* disabled hidden buttons;
* ??? entries;
* hidden progress bars;
* silhouettes;
* hidden requirement lists;
* hidden breakthrough requirements;
* undiscovered hidden resources;
* tooltips implying another route exists.

Lv18 by itself does not constitute discovery.

After the hidden lineage has closed, later hidden content must remain undiscoverable.

Historical hidden content that the character previously discovered may be retained as historical information if required by the product surface, but MUST NOT appear actionable.

⸻

5. Stat Ownership

Two stat domains must remain distinct.

5.1 Five main stats

The five canonical character stats are:

Thể
Lực
Mẫn
Khí
Thần

Normal Body progression does not directly grant these five stats.

They remain owned by the character/stat progression system.

5.2 Raw Body combat stats

Normal Body progression grants flat/raw combat power such as:

maxHp
might
defense
hpRegenPerTurn

and other canonical raw combat stats where appropriate.

These are base/flat contributions, not generic percentage modifiers.

Body progression exists to establish the character’s physical combat foundation:

Body progression
→ raw combat power
→ survive stronger stages / Tribulation
→ progress further

It must therefore produce meaningful combat strength even though it is not a hard Normal Breakthrough prerequisite.

⸻

6. Global Hidden Body Reward

Each major realm has at most one canonical Hidden Body achievement in the continuous hidden lineage.

Each completed Hidden Body permanently adds:

+10 percentage points

to the cap of all five main stats.

The bonuses stack additively:

0 Hidden Bodies → ×1.0 normal cap
1 Hidden Body   → ×1.1
2 Hidden Bodies → ×1.2
3 Hidden Bodies → ×1.3
...

Conceptually:

effectiveMainStatCap
  = normalMainStatCap
  × (1 + 0.10 × completedHiddenBodyCount)

The implementation must use one canonical integer-rounding rule at the stat-cap boundary.

Hidden Body completion increases capacity only.

It does not automatically grant/fill the newly available stat points.

⸻

7. Hidden Body and Hidden Breakthrough Are Separate Gates

Canonical ordering:

realm-specific hidden mechanic
→ Hidden Body completed
→ +10pp five-main-stat cap
→ player earns/fills additional main stats
→ all five reach effective cap
→ Lv18
→ Hidden Breakthrough

Therefore:

“All five main stats at effective cap” is a Hidden Breakthrough requirement, never the mechanic that unlocks/completes Hidden Body.

Do not collapse these two progression layers.

⸻

8. Breakthrough Rewards

Normal Breakthrough grants:

next realm
+ normal Realm Entry Passive
+ permanent hidden-lineage closure

Hidden Breakthrough grants:

next realm
+ Enhanced Realm Entry Passive
+ hidden-lineage preservation

Enhanced Realm Entry Passives are authored per realm.

There is no required universal enhancement multiplier.

Do not substitute a generic realm-pressure modifier for this reward model.

For Mortal → Qi, Nhập Đạo should remain a universally useful combat passive, with its normal and enhanced versions differing in authored strength. Exact numbers are BALANCE.

⸻

9. Mortal — Phàm Cốt

9.1 Normal Body

Normal Mortal Body Refinement remains:

6 / 6

Phàm Cốt is a separate hidden extension.

Do not globally mutate normal Body completion from 6/6 to 7/7.

9.2 Discovery

After Mortal Body reaches 6/6, an eligible character with an active hidden lineage may encounter the hidden Ancient Beast trial.

Each eligible normal battle cycle receives the authored hidden encounter roll.

The hook must cover both:

* initial/manual battle start;
* continuous/repeat battle cycles.

Use a shared battle-cycle authority rather than implementing the trigger solely in a UI/start-stage path.

Encounter chance and any bounded encounter pity are BALANCE.

9.3 Ancient Beast trial

The Ancient Beast replaces the whole normal battle.

It is not an additional wave.

The Ancient Beast is semantically immortal/undefeatable during this trial. Do not simulate immortality using merely an enormous HP value.

Success:

survive X complete combat rounds

using the canonical combat round authority.

Death before X:

failure

Alive through X complete rounds:

success

X is BALANCE.

9.4 Settlement isolation

The trial must not accidentally produce:

* normal stage victory;
* next-stage unlock;
* normal stage loot;
* Perfect Clear;
* normal auto-farm clear progression;
* Ancient Beast kill credit;
* rewards requiring an actual kill.

After the encounter, continuous farming may resume the intended normal stage on a later battle cycle.

After Phàm Cốt completion, Ancient Beast rolls cease permanently.

9.5 Completion

Successful survival directly completes:

Phàm Cốt

No additional material, currency grind, damage threshold, signature hit, MP gate, or Great Dao Seed is required for Phàm Cốt.

Reward:

Hidden Body Mortal complete
→ +10pp five-main-stat cap

Possible discovered/completed presentation:

Luyện Thể · Bậc 7 — Phàm Cốt

Lore direction:

Lấy phàm cốt, chịu lực phi phàm.

⸻

10. Qi Refining — Thiên Địa Chi Kiều

10.1 Normal Meridian progression

Canonical normal completion is:

Bát Mạch 8 / 8

The historical ninth normal Meridian must not remain part of normal completion.

Thiên Địa Chi Kiều becomes a hidden body state/achievement, not an external transformation material.

Legacy material-gated requiresThienDiaChiKieu semantics are non-canonical.

10.2 Discovery

Only an active hidden-lineage character that satisfies the authored normal Meridian prerequisite may discover:

Lấy Khí Quán Thể

Normal-lineage characters never see this continuation.

10.3 Quán Thể

While Quán Thể is active, canonical final cultivation gain is diverted into persistent:

quanTheProgress

The routing boundary is:

raw cultivation sources
→ cultivation modifiers
→ final cultivation gain
→ Quán Thể OR normal realm cultivation

Do not divert pre-modifier cultivation.

Quán Thể requires:

* no MP;
* no external transformation material;
* no battle-only requirement;
* no daily gate;
* no RNG;
* no new resource-bag currency.

It persists through pause/save/reload.

Offline cultivation must settle through equivalent canonical routing.

10.4 Overflow

If one cultivation settlement exceeds the remaining Quán Thể requirement:

required remainder → Quán Thể
100% overflow       → normal cultivation

within the same settlement.

No final cultivation gain may disappear at the completion boundary.

10.5 Completion

At threshold:

quanTheProgress = requiredAmount
quanTheActive = false
thienDiaChiKieu = true
Qi Hidden Body = complete

Reward:

+10pp five-main-stat cap

No second confirmation or material transaction occurs.

The threshold is BALANCE.

⸻

11. Foundation — Chu Thiên

11.1 Canonical normal progression

Replace the gameplay authority based on continuous 0..360 circulation with:

Chu Thiên 0 / 36

Canonical normal completion:

36 / 36

Tiểu Chu Thiên / Đại Chu Thiên must not remain separate progression gates or reward authorities.

They may survive as non-authoritative lore terminology if desired.

11.2 Normal advancement

Normal Chu Thiên is deterministic.

When its normal requirements and cost are satisfied:

advance exactly +1

No RNG.

Each advancement consumes the authored amount of Foundation physique essence / Tinh Hoa Pháp Thể.

Exact costs are BALANCE.

11.3 Normal rewards

The 36 normal advancements grant authored raw/base combat stats.

Eligible reward vocabulary includes stats such as:

maxHp
might
defense
hpRegenPerTurn

Do not grant the five main stats directly.

Do not replace these rewards with a generic global percentage modifier.

The exact distribution and magnitude across 36 advancements are BALANCE/content authoring.

⸻

12. Foundation — Nghịch Chu Thiên

12.1 Discovery

After:

Chu Thiên == 36/36
AND hiddenLineageActive

the hidden continuation may become discoverable:

Nghịch Chu Thiên

Without an active lineage there must be no hint that this continuation exists.

12.2 Progression

Nghịch Chu Thiên is:

0 / 36 → 36 / 36

Each attempt consumes both:

Tinh Hoa Pháp Thể
+ Linh Thạch

Both costs increase as Nghịch level increases.

Exact cost curves are BALANCE.

12.3 Success probability

Success probability decreases monotonically across the 36 advancements.

Locked endpoints:

first advancement: 100%
final advancement: 1%

The exact intermediate curve is BALANCE.

Gameplay calculations must use canonical probability values, not rounded UI strings.

12.4 Failure

Failure:

consumes full Tinh Hoa cost
consumes full Linh Thạch cost
does not reduce Nghịch level
increments current-level pity

There is no:

* downgrade;
* checkpoint-floor mechanic;
* purchasable protection item.

12.5 Pity / “Bảo hiểm”

Bảo hiểm means pity, not an optional item/service.

Pity belongs to the current Nghịch advancement.

After reaching that advancement’s authored pity threshold:

next attempt = guaranteed success

The guaranteed attempt still consumes the normal full costs.

On success:

Nghịch level += 1
current-level pity = 0

Pity:

* persists through save/reload;
* does not transfer to the next Nghịch level;
* freezes with the rest of hidden progress if the lineage closes.

Exact pityLimit(level) values are BALANCE.

12.6 Completion

At:

Nghịch Chu Thiên 36/36

Foundation Hidden Body completes immediately.

No additional hidden material or secondary completion gate follows.

Reward:

+10pp five-main-stat cap

The player must still fill all five main stats to the resulting effective cap and reach Lv18 before Hidden Breakthrough can occur.

⸻

13. Global Lv12 / Lv18 Contract

Across the realm ladder covered by this specification:

Lv12 = earliest Normal Breakthrough
Lv18 = earliest Hidden Breakthrough

This does not mean normal Body progression must finish at Lv12.

It does not mean hidden mechanics universally begin at Lv12.

Those systems retain their authored prerequisites.

Lv12 is specifically the Normal Breakthrough boundary.

Lv18 is specifically the Hidden Breakthrough boundary.

Cultivation continues normally between them.

The intended tension is:

reach Lv12
│
├─ attempt Normal Breakthrough now
│
└─ remain in the realm
   → continue cultivating
   → improve combat/body/build
   → potentially discover/pursue hidden perfection
   → reach Lv18
   → potentially Hidden Breakthrough

Normal players are never told that remaining until Lv18 leads to a hidden route.

⸻

14. Realm-Specific Hidden Mechanics Remain Distinct

The first three Hidden Bodies intentionally use different gameplay:

Mortal
→ Ancient Beast survival
Qi Refining
→ cultivation diversion / Quán Thể
Foundation
→ Nghịch Chu Thiên enhancement + RNG + pity

Do not normalize them into a generic hidden-material progression system.

Shared infrastructure SHOULD own only genuinely shared invariants such as:

* lineage state;
* Hidden Body completion records;
* global +10pp cap calculation;
* save/restore integrity;
* hidden visibility/discovery state where appropriate;
* Hidden Breakthrough eligibility.

Realm mechanics remain independently authored.

⸻

15. Transformation Philosophy

Canonical principle:

External things may create the circumstance, but they never create the transformation.

Therefore Hidden Body transformation is not obtained by consuming a special “evolution material”.

For the Beta realms:

Ancient Beast
→ trial/catalyst
Quán Thể
→ internal cultivation transformation
Nghịch Chu Thiên
→ deliberate internal refinement process

Ordinary economy resources may be consumed by the process where appropriate. In particular, Nghịch Chu Thiên legitimately consumes Tinh Hoa Pháp Thể and Linh Thạch.

That is distinct from a special external item directly granting Hidden Body completion.

⸻

16. Core Invariants

Implementation must maintain:

normalBreakthroughEligible
  => realmLevel >= 12
hiddenBreakthroughEligible
  => realmLevel >= 18
  && hiddenLineageActive
  && currentRealmHiddenBodyCompleted
  && allFiveMainStatsAtEffectiveCap
  && ordinaryBreakthroughRequirementsSatisfied
successfulNormalBreakthrough
  => hiddenLineageActive becomes false permanently
failedNormalBreakthrough
  => hiddenLineageActive unchanged
successfulHiddenBreakthrough
  => hiddenLineageActive remains true
completedHiddenBodyCount never decreases
hiddenCapBonus = +10pp × completedHiddenBodyCount

Frozen hidden progress can never become active again.

Undiscovered hidden content cannot leak through normal UI.

⸻

17. Mandatory Verification

Tests must exercise production authorities/seams rather than merely reproducing formulas in mocks.

Breakthrough

Pin at minimum:

Lv11 → Normal unavailable
Lv12 → Normal eligible
Lv13–18 → cultivation continues normally
Lv17 → Hidden unavailable
Lv18 alone → Hidden still unavailable unless all hidden requirements hold

Also verify:

* failed Normal attempt preserves lineage;
* successful Normal realm transition closes it;
* successful Hidden transition preserves it;
* Normal does not require Body completion;
* historical Hidden Body bonuses survive lineage closure.

Lineage integrity

Verify:

* strict-prefix histories;
* skipped hidden histories fail closed;
* future hidden discovery impossible after closure;
* unfinished current hidden progress freezes;
* frozen progress/pity cannot resume or migrate to later realms.

Visibility

Verify absence—not merely disabled state—of undiscovered hidden UI.

Verify Lv18 does not itself leak Hidden Breakthrough.

Hidden Body cap

Verify:

0 → ×1.0
1 → ×1.1
2 → ×1.2
3 → ×1.3

under canonical rounding.

Verify completion raises cap without granting current stat points.

Mortal

Verify:

* normal Body remains 6/6;
* trial cannot occur before eligibility;
* manual and repeat cycles use the same trigger authority;
* whole-battle replacement;
* canonical round survival;
* failure and success settlement isolation;
* no fake kill;
* completion exactly once;
* no further encounter rolls afterward.

Qi

Verify:

* normal completion = 8/8;
* old ninth-normal-node authority removed;
* hidden action inaccessible without lineage;
* final cultivation gain is diverted;
* persistence/offline semantics;
* exact overflow conservation;
* completion exactly once.

Foundation normal

Verify:

* canonical progress is 0..36;
* deterministic +1 advancement;
* atomic cost debit;
* raw Body stat rewards;
* no authoritative 180/360 milestone behavior remains.

Foundation hidden

Verify:

* undiscovered Nghịch is absent;
* both costs debit atomically;
* probability uses canonical values;
* failure consumes cost but never downgrades;
* failure increments pity exactly once;
* pity survives save/restore;
* guaranteed attempt still pays full cost;
* success advances exactly one level and resets pity;
* 36/36 completes Hidden Body exactly once.

⸻

18. Balance-Deferred Values

The following are deliberately NOT design constants in this spec:

* cultivation requirements Lv12→18;
* Ancient Beast encounter probability;
* Ancient Beast encounter pity, if used;
* survival round count X;
* Quán Thể threshold;
* Chu Thiên 36-step Tinh Hoa costs;
* Chu Thiên raw-stat reward table/magnitudes;
* Nghịch intermediate success curve between 100% and 1%;
* Nghịch Tinh Hoa cost curve;
* Nghịch Linh Thạch cost curve;
* Nghịch pity thresholds;
* numerical normal/enhanced Realm Entry Passive values.

These require simulation/balance work.

Placeholder values used during implementation must be explicitly marked non-canonical.

⸻

19. Legacy/Migration Audit

Implementation must census and reconcile existing authorities for at least:

* old Lv18-only normal breakthrough assumptions;
* any Body-completion requirement on Normal Breakthrough;
* Meridian completion counting 9 nodes;
* requiresThienDiaChiKieu;
* thien_dia_chi_kieu external-material semantics;
* Zhou Tian 0..360;
* 180/360 Tiểu/Đại gameplay gates;
* old Zhou Tian capacity formulas;
* hidden-material registries claiming transformation authority;
* Great Dao Seed dependencies on these Hidden Bodies;
* hidden UI placeholders/leaks;
* save states permitting hidden-lineage re-entry;
* generic Body 6/6→7/7 assumptions;
* percentage Body rewards replacing required flat/base contributions.

Migration must establish one canonical authority.

Legacy fields may be read for migration, but MUST NOT survive as competing runtime authorities.

⸻

20. Final Canonical Flow

NORMAL
Realm Lv1
→ continuous cultivation
→ Lv12
→ Normal Breakthrough available
→ player may attempt now or continue leveling
→ successful Normal Breakthrough
→ next realm
→ Normal Realm Entry Passive
→ hidden lineage permanently closed
HIDDEN
hidden lineage active
→ pass Lv12 without taking successful Normal Breakthrough
→ continue normal cultivation
→ discover/complete realm-specific Hidden Body
→ +10pp cap to all five main stats
→ fill all five to effective cap
→ reach Lv18
→ Hidden Breakthrough
→ next realm
→ Enhanced Realm Entry Passive
→ hidden lineage preserved

Beta Hidden Bodies:

PHÀM NHÂN
Normal Body 6/6
→ Ancient Beast
→ survive X rounds
→ Phàm Cốt
LUYỆN KHÍ
Bát Mạch 8/8
→ Lấy Khí Quán Thể
→ complete internal cultivation threshold
→ Thiên Địa Chi Kiều
TRÚC CƠ
Chu Thiên 36/36
→ Nghịch Chu Thiên 0/36 → 36/36
→ Foundation Hidden Body

Canonical design principle

Lv12 offers advancement. Lv18 offers perfection.

Normal progression lets the player attempt advancement without forcing completion of every auxiliary system.

Body progression supplies the raw combat foundation that determines whether that ambition is actually survivable.

Hidden progression rewards the player who deliberately remains in the current realm, discovers its concealed transformation, pushes the character to the realm’s true limit, and preserves that perfection continuously across every subsequent breakthrough.