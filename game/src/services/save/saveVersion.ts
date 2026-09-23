// Nguon su that duy nhat cua version schema save - tach rieng de
// saveShapeValidation.ts import duoc ma KHONG tao vong circular voi
// SaveSystem.ts (SaveSystem re-export lai cho moi consumer cu).
// v54 (2026-08-29, dot-pha-loi-kiep spec): 4 field PlayerData moi -
// openedMeridianIds (Bat Mach da thong), luyenKhiKillsSinceBeast (cua
// so quai an 1000 kill), mortalPerfectionAchieved (snapshot hoan hao
// Pham Nhan chot luc Quan Khi), greatDaoOpportunityLost (thua kiep Dai
// Dao mat vinh vien). Go Dot Pha Lenh (token materials) + quai Kiep +
// TribulationSystem cu (thay TribulationDirector chuong kiep).
// v55 (2026-09-02, chi-hien-quan spec): XOA building spirit_spring
// (chuc nang linh mach chuyen vao gathering_outpost), THEM building
// chi_hien_quan (nguon nhan cong duy nhat, capacity 1+levelx2), them
// field productionSiteStates[].assignedWorkers (phan bo nhan cong
// manual). Save v54 bi tu choi (dev phase, khong migration).
// (2026-09-16 correction: assignedWorkers was DECLARED at v55 but the
// buildGameSave serializer never emitted it - the field only became
// actually persisted by the Mission A2 fix; no version bump, the field
// is optional and absent means AUTO.)
// v56 (2026-09-04, stage-auto-farm spec): 3 field PlayerData moi -
// perfectClearStageIds (stage da dat dieu kien Hoan My),
// perfectClearSeconds (wall-clock giay lan dat dau tien, dung lam co
// so cycleSeconds cho auto-farm), autoFarmStage (slot auto-farm dang
// chay, null neu khong co). Save v55 bi tu choi (dev phase, khong
// migration).
// v57 (2026-09-05, companion-roster spec): 1 field moi - companions
// (CompanionInstance[] so huu, definitionId/level/exp). Save v56 bi tu
// choi (dev phase, khong migration).
// v58 (2026-09-05, tran-phap spec): 1 field moi - formationLoadout
// (FormationLoadout | null, Tran Phap dang active + vi tri tung
// combatant). Save v57 bi tu choi (dev phase, khong migration).
// v59 (2026-09-06, gp123 6E task C2 - unification of the age axes):
// material wood/ore doi id sang truc tuoi thong nhat -
// `<realm>_wood_<age>` / `<realm>_ore_<age>` (age decade..thuong_co);
// plain `<realm>_wood` va hau to pham cu hoang..tien KHONG TON TAI nua
// (meta profession.quality -> profession.age). Save v58 bi tu choi (dev
// phase, khong migration).
// v60: companion gacha (instanceId/realmId/constellationRank, pity counter, duyenPhan)
// v61 (2026-09-14, B4 talent v4 M2): cultivationOvercharge,
// tribulationBonusStacks, nodeFreePurchaseRecord, phaGiapCarryStacks,
// phaGiapCarryRealmId. Save v60 bi tu choi (dev phase, khong migration).
// v62 (phap-tu-reimagined): Phap Tu path/state/combat rework -
// PlayerData loses unlockedElements/equippedElements (element authority
// is now player.spellPath.element), CombatEntity loses skillStats +
// currentHoaThe/ThoThe/KimThe pools, reaction-path skills/buffs/nodes
// retired. Save v61 bi tu choi (dev phase, khong migration).
// v63 (2026-09-15, kiem-tu-reimagined spec): PlayerData.swordPath replaces
// swordPathRoute + the sword-intent ecosystem (canonical state model:
// mode/preset/kiemY/kiemDaoCount/kiemDaoBase). Save v62 bi tu choi
// (dev phase, khong migration).
// v64 (2026-09-15, the-tu-reimagined spec T1): CultivationPathId mo rong
// 'the_tu' + 'the_tu_an' - save cu chua path id la bi tu choi (dev phase,
// khong migration).
// v65 (2026-09-16, cultivation-path-framework M2): PlayerData them field
// TUY CHON `cultivationWay?: CultivationWayId` (way da chon trong path, ghi
// boi CultivationPathSystem.applyPathChoice trong Nghi Le Nhap Mon).
// `cultivationPath` van mang union 5 id legacy trong thoi ky chuyen
// tiep - gio duoc kiem tra enum membership khi hien dien. Save v64 bi
// tu choi (dev phase, khong migration).
// v66 (2026-09-16, cultivation-path-framework M7): CultivationPathId
// thu con 3 base id ('kiem_tu' | 'phap_tu' | 'the_tu') - 'phap_tu_an' /
// 'the_tu_an' tro thanh WAYS tren cultivationWay, cac adapter
// LEGACY_PATH_TO_WAY / resolveBasePathId / getLegacyPathIdForWay bi
// xoa. Save v65 (va save mang path id '_an') bi tu choi (dev phase,
// khong migration).
// v67 (2026-09-17, worker-economy Mission D): ProductionSiteStateSave
// lost `activeCycle` - workers-as-fuel (spec D3); workerCycles is the
// only cycle kind. Save v66 is rejected (dev phase, no migration); a
// stale `activeCycle` in an old payload is tolerated + whitelisted out.
// v68 (2026-09-17, P7-M1 identity-spine cut): CultivationPathId values
// kiem_tu/phap_tu/the_tu -> sword/spell/body; CultivationWayId becomes
// the strict six-value union (sword_pathway/hidden_sword_pathway/
// spell_pathway/hidden_spell_pathway/body_pathway/hidden_body_pathway);
// PlayerData.phapTu -> spellPath, PlayerData.kiemTu -> swordPath. Save
// v67 is rejected (dev phase, no migration, no compat translator).
// v69 (2026-09-21, P7-M2 realm-passive ownership): Technique snapshot
// drops passiveSkillIdsByRealm + innateSkillId - the realm-entry
// passive ladder moves to the committed way's realmRewards (composed
// from data/progression/RealmPassiveLadder) and initiation passives to
// PathWayDefinition.passiveSkillIds. Save v68 is rejected (dev phase,
// no migration, no compat translator).
// v70 (2026-09-21, P7-M3 canonical technique): Technique snapshot is the
// rank/mastery/grade/quality model (insight/insightMultiplier/
// tierEffects/requiredRealm*/unlocked/equipped gone; gradeEffects in).
// The holder is 0-or-1 and must equal the committed way's techniqueId
// (mortal = empty) - enforced by the restore preflight. Save v69 is
// rejected (dev phase, no migration, no compat translator).
// v71 (2026-09-21, P7-M4 combat-role contract): the generic skill
// loadout is retired - Skill entries carry NO loadoutSlot/loadoutSlots/
// equipped/unlocked keys (learned = SkillManager membership; combat
// roles resolve from the committed way kit). PlayerData gains optional
// mortalBasicSkillId (mortal-only precursor pick; post-path presence is
// corrupt). Save v70 is rejected (dev phase, no migration, no compat
// translator).
// v72 (2026-09-21, P7-M5 unified body progression): the three flat body
// fields (bodyRefinementCompletedTiers /
// bodyRefinementCurrentTierProgress / openedMeridianIds) fold into ONE
// chapter-keyed record, player.bodyProgression = { body_refinement:
// {completedTiers, currentTierProgress}, meridian: {openedIds} } -
// shape validation delegates to the BodyProgression authority and the
// restore preflight asserts chapter integrity before any owner mutation.
// Save v71 is rejected (dev phase, no migration, no compat translator).
// v73 (2026-09-26, M-QI-05 canonical Core Node level): the retired
// dual authority player.skillLevels is removed outright - presence is
// rejected. nodeLevels gains core_<skillId> entries validated against
// the registered SKILL_CORE_NODES catalog (integer range + purchased
// mirror + coverage of learned levelled skills, way coreSkillIds, and
// owned-node grantsSkillCoreIds). Save v72 is rejected (dev phase, no
// migration, no compat translator).
// v74 (2026-09-23, M-QI-07 physique transformation authority):
// PlayerData.physiqueGrade (Pham -> ... -> Tien ladder id) is required;
// semantic coherence (persisted grade must equal the grade derived from
// the authored physique-advancement chain) is enforced by the
// BodyProgression integrity preflight. Save v73 is rejected (dev phase,
// no migration, no compat translator).
// v75 (2026-09-23, M-F-TECHNIQUE frozen-cycle model): Technique gains
// required `gradeHistory` (per-grade sealed cycle outcomes {finalRank,
// completionState}); the rank ladder is 0..18 with a realm-level-scaled
// ceiling; restore preflight enforces canonical key-set coherence
// ({1..grade-1} sealed, {grade} iff the live grade lags the realm).
// Save v74 is rejected (dev phase, no migration, no compat translator).
// v76 (2026-09-23, M-F-TALENT mandatory breakthrough talent transaction):
// PlayerData gains talentLevels (required sparse level map, {} = all
// level 1) + optional pendingTalentEntitlement ({realmId,
// offeredTalentIds} - the persisted mandatory UPGRADE/NEW decision that
// locks a settled breakthrough until resolved). Save v75 is rejected
// (dev phase, no migration, no compat translator).
// v77 (2026-09-23, M-F-COMPANION-GIFT mail/gift acquisition): PlayerData
// gains required companionGifts (CompanionGiftRecord[] - authored
// claimable-gift records {id, definitionId, claimed}; written by
// issueCompanionGifts on authored trigger moments, claimed through
// claimCompanionGift). Save v76 is rejected (dev phase, no migration,
// no compat translator).
// v78 (2026-09-23, M-F-CHU-THIEN Truc Co Chu Thien chapter):
// player.bodyProgression gains the zhou_tian slice ({circulation} -
// the Truc Co normal-Body track, Tieu 180 / Dai 360). Sequential
// chapter prerequisites (meridian -> body_refinement, zhou_tian ->
// meridian) are authored on the chapter registry and pinned as a
// restore-preflight coherence invariant. Save v77 is rejected
// (dev phase, no migration, no compat translator).
// v79 (2026-09-23, M-F-ARTIFACT-DEFER artifact domain deferred to Kim
// Dan+, coordinator-mandated bump - spec A8 originally specified no
// bump, superseded by the Phase-2 directive; the parallel v77
// COMPANION-GIFT and v78 CHU-THIEN bumps landed first, so this takes
// the next): the artifact domain's unlock gate retargets to
// ARTIFACT_UNLOCK_REALM_ID ('golden_core'); a persisted artifact below
// the gate is preserved (never stripped) but saves written under the
// Truc Co-era grant model must not load under the deferred model.
// Save v78 is rejected (dev phase, no migration, no compat translator).
export const CURRENT_SAVE_VERSION = 79 as const
