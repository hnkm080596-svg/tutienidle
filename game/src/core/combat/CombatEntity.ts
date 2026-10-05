import type { Stats } from '../stats/StatBlock'
import type { LaneIndex } from '../battle/BattleLane'
import type { EnemyArchetype } from '../enemy/EnemyArchetype'
import type { TribulationPhase, BossEnrage } from '../enemy/TribulationPhase'
import type { EnemySpecialAttack } from '../enemy/Enemy'

export type CombatEntityType =
  | 'player'
  | 'enemy'

export interface CombatEntity {
  id: string

  // Template id the enemy instance was spawned from (EnemySystem.spawn
  // stamps Enemy.templateId; enemyToCombatEntity carries it). Kill
  // consumers match template ids, not uuid-minted instance ids.
  templateId?: string

  name: string

  type: CombatEntityType

  // Stats truoc khi cong buff phat sinh trong tran (talisman, skill
  // buff/debuff...). `stats` la gia tri hieu luc hien tai, duoc
  // BattleSystem recompute moi tick tu baseStats + buff dang active
  // tren entity nay - xem Battle.playerBuffs/enemyBuffs.
  baseStats: Stats

  stats: Stats

  // Snapshot level cua cac skill da hoc luc bat dau tran. Skill van nhan XP
  // va level-up trong progression, nhung damage trong tran doc snapshot nay
  // de build moi chi co hieu luc tu tran ke tiep.
  skillLevels?: Readonly<Record<string, number>>

  currentHp: number

  maxHp: number

  // MP la state "song" giong currentHp - chi ton tai trong luc
  // battle, khong persist vao PlayerData (xem ghi chu trong
  // core/player/Player.ts).
  currentMp: number

  // Phap Tu Reimagined Task 8 - The pool, BATTLE-INSTANCE SCOPED
  // (breaking lifecycle change): resets to 0 at every fresh
  // participant build and every auto-repeat cycle
  // (resetBattleScopedResources), for every path sharing the pool
  // (Phap Tu, Bat Kiem). No PlayerData persistence, no cross-cycle
  // carry. Gains are skill-authored (TurnSkillDefinition.
  // theGainOnLandedCast - once per cast, never per
  // target). Optional - readers use `?? 0`.
  currentThe?: number
  // Battle snapshot of the The cap (undefined => MAX_THE). Derived once
  // at participant build - two disjoint producers, one per path:
  // spell via resolveMaxThe(player) (spell_pathway cap is a flat
  // SPELL_PATH_MAX_THE=5); ung_the via the kit-baked flat MAX_THE
  // (buildTheTuAnKit stamps maxThe: MAX_THE - there is no node-bonus
  // channel in the beta window). TheEconomy.theCap is the engine's
  // single read site (`entity.maxThe ?? MAX_THE`); kiemBarBridge
  // delegates to it, while theBarBridge uses THE_BAR_MAX (the
  // spell-domain cap) as its own fallback. Never persisted.
  // Divergence consequence (documented, test/dev-path only): a raw
  // primaryEntityOverride that skips resolveMaxThe AND leaves this
  // unset reads cap 100 in the engine (theCap) vs cap 5 on the HUD
  // (theBarBridge) -- the override path is expected to stamp its own
  // cap, not to rely on either fallback.
  maxThe?: number

  // The Tu Reimagined (spec 2026-09-15 D7/section 7.13) - momentum resource
  // retired: the hidden path fuels reactive checks from currentThe, and
  // the visible path has no pool resource at all.

  // Ward - bonus HP absorbing damage BEFORE currentHp (see
  // CombatSystem.resolveHit()). "Living" state like currentHp/currentMp,
  // reset to 0 when a new combatant is built for the battle.
  currentWard: number

  // The Tu Reimagined (plan Task 11, spec 2026-09-15 D3) - Son Nhac
  // external ward: a SEPARATE, protection-only absorb pool granted by an
  // external source. Distinct from currentWard on purpose: it is exempt
  // from wardMax/regen, absorbs BEFORE the native ward, never feeds
  // spendWard, and its existence is bound to the granting marker
  // instance (reconciled per-source - newest grant replaces wholesale).
  externalWard?: { sourceId: string; amount: number }

  // Phap Tu (Tho Tu, 2026-08-15) - holder turns elapsed since the last
  // LANDED hit on this entity (reset to 0 in CombatSystem.resolveAttack;
  // incremented once per declareActorAction - follow-up bypass declares
  // count too). Gates ward regen via WARD_REGEN_DELAY_TURNS in
  // TurnBattleSystem. Unit changed seconds -> holder-turns in M8
  // (ARCH-003); the legacy seconds-based gate lived in the retired
  // engine's updateRegen.
  turnsSinceLastHitLanded: number

  // Vi tri (0-based) trong REALMS - dung de tinh Realm Pressure giua
  // 2 ben combat (xem RealmPressure.ts). Cung y nghia voi
  // realmSystem.getRealmIndex(), tinh san luc convert sang CombatEntity
  // de CombatSystem khong phai biet ve PlayerData/Enemy.
  realmIndex: number

  // Bac Nhap Dao (1-6, xem core/player/Player.ts's breakthroughGrade) -
  // giam Realm Pressure chiu/gay ra (xem RealmPressure.ts). CHI player
  // co gia tri (enemyToCombatEntity() de undefined) - enemy khong co
  // khai niem "chat luong dot pha".
  breakthroughGrade?: number

  // Vi tri world-space tren truc X (don vi chung - xem
  // core/battle/BattleLane.ts) - dung cho ne/duoi that theo khoang
  // cach (BattleSystem.resolveMovement()) va va cham action impact
  // (ActionImpactSystem). Khong co truc Y - san dau chi 1 chieu ngang.
  x: number

  // Combat Grid Rework (2026-08-24) - `row` la LANE that tren grid
  // 10x16 (xem BattleGrid.ts): targeting/AOE query doc row + column
  // (column = lam tron `x`). Player dung o HERO_LANE_INDEX dai dien;
  // quai random moi lan spawn tru Boss luon HERO_LANE_INDEX.
  row: LaneIndex

  alive: boolean

  // Co Elite ("Tinh Anh") cho Combat HUD (thanh mau luon hien) - set
  // khi tag tinh_anh gan qua applyEnemyTags (core/enemy/EnemyTag.ts).
  // Player luon falsy (khong set trong playerToCombatEntity()).
  isElite?: boolean

  // Core Loop Foundation checklist (Muc BOSS) - tier RIENG, tach han
  // isElite (xem createBossVariant()). Combat HUD uu tien hien Boss
  // truoc Elite neu ca 2 cung co mat.
  isBoss?: boolean

  // Nhan hanh vi nhe (Muc MONSTER) - doc boi BattleSystem.
  // resolveMovement()/updateEnemyAttacks(). Khong set = 'melee'.
  archetype?: EnemyArchetype

  // Dot Pha Truc Co (Phase 4) - moc HP leo thang suc manh cua quai
  // Kiep, xem BattleSystem.updateTribulationPhases(). Combat Rework
  // Phase 4 generic hoa field nay cho Boss thuong luon (xem
  // TribulationPhase.ts).
  tribulationPhases?: TribulationPhase[]

  // Combat Rework Phase 4 (Boss Mechanics) - DPS check, xem
  // TribulationPhase.ts's BossEnrage, BattleSystem.updateEnrage().
  enrage?: BossEnrage

  // Turn-based boss enrage (Phase A2, 2026-09-07) - see Enemy.ts's
  // bossTrigger for the full comment; threaded here unchanged via
  // enemyToCombatEntity(), read by TurnBattleAdapter.toTurnBattleParticipant().
  bossTrigger?: { afterTurns: number; buffDefinitionId: string }

  // Combat Balance Pass (2026-08-29, plan sec3.6) - action dac biet data-
  // driven thay basic attack cung (xem core/enemy/Enemy.ts's
  // EnemySpecialAttack). Thread tu Enemy qua enemyToCombatEntity(), doc
  // tai TurnBattleSystem.declareActorAction() (everyNth counter).
  // undefined = quai chi basic attack.
  specialAttacks?: EnemySpecialAttack[]

  // Monster attack VFX sweep (2026-10-04) - authored VFX identity of the
  // enemy's basic attack, threaded from Enemy.attackPresetId via
  // enemyToCombatEntity(); the participant mint folds it into the basic
  // TurnSkillDefinition's presetId. undefined = generic fallback.
  attackPresetId?: import('../battle/CombatAction').CombatVfxPresetId

  // The Tu (Combat Rework Phase 7) - thanh mau phu CHONG PHA, tach
  // han currentHp: The Tu skill (Skill.breakDamagePerHit) tru rieng
  // thanh nay moi don trung, KHONG qua Damage Engine/mitigation (giong
  // tinh than Detonate - bo qua Armor/Resistance). Cham 0 thi Stagger
  // (ap ailment 'choang' co san) roi reset ve breakGaugeMax, xem
  // BattleSystem's missile-resolve callback. undefined = entity nay
  // khong co Break (quai thuong/player) - CHI Boss/quai lon khai.
  breakGaugeMax?: number

  currentBreakGauge?: number

  // Hidden Perfection Lineage (design 2026-09-23 sec.9) - semantic
  // immortality: CombatSystem.killIfDead() clamps a lethal hit to 1 HP
  // instead of writing alive=false. Authored on Enemy.undefeatable,
  // threaded via enemyToCombatEntity() (Ancient Beast trial).
  undefeatable?: boolean
}
