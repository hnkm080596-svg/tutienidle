// Nguồn sự thật duy nhất của version schema save — tách riêng để
// saveShapeValidation.ts import được mà KHÔNG tạo vòng circular với
// SaveSystem.ts (SaveSystem re-export lại cho mọi consumer cũ).
// v54 (2026-08-29, dot-pha-loi-kiep spec): 4 field PlayerData mới —
// openedMeridianIds (Bát Mạch đã thông), luyenKhiKillsSinceBeast (cửa
// sổ quái ẩn 1000 kill), mortalPerfectionAchieved (snapshot hoàn hảo
// Phàm Nhân chốt lúc Quán Khí), greatDaoOpportunityLost (thua kiếp Đại
// Đạo mất vĩnh viễn). Gỡ Đột Phá Lệnh (token materials) + quái Kiếp +
// TribulationSystem cũ (thay TribulationDirector chương kiếp).
// v55 (2026-09-02, chi-hien-quan spec): XÓA building spirit_spring
// (chức năng linh mạch chuyển vào gathering_outpost), THÊM building
// chi_hien_quan (nguồn nhân công duy nhất, capacity 1+level×2), thêm
// field productionSiteStates[].assignedWorkers (phân bổ nhân công
// manual). Save v54 bị từ chối (dev phase, không migration).
// (2026-09-16 correction: assignedWorkers was DECLARED at v55 but the
// buildGameSave serializer never emitted it — the field only became
// actually persisted by the Mission A2 fix; no version bump, the field
// is optional and absent means AUTO.)
// v56 (2026-09-04, stage-auto-farm spec): 3 field PlayerData mới —
// perfectClearStageIds (stage đã đạt điều kiện Hoàn Mỹ),
// perfectClearSeconds (wall-clock giây lần đạt đầu tiên, dùng làm cơ
// sở cycleSeconds cho auto-farm), autoFarmStage (slot auto-farm đang
// chạy, null nếu không có). Save v55 bị từ chối (dev phase, không
// migration).
// v57 (2026-09-05, companion-roster spec): 1 field mới — companions
// (CompanionInstance[] sở hữu, definitionId/level/exp). Save v56 bị từ
// chối (dev phase, không migration).
// v58 (2026-09-05, tran-phap spec): 1 field mới — formationLoadout
// (FormationLoadout | null, Trận Pháp đang active + vị trí từng
// combatant). Save v57 bị từ chối (dev phase, không migration).
// v59 (2026-09-06, gp123 6E task C2 — unification of the age axes):
// material wood/ore đổi id sang trục tuổi thống nhất —
// `<realm>_wood_<age>` / `<realm>_ore_<age>` (age decade..thuong_co);
// plain `<realm>_wood` và hậu tố phẩm cũ hoang..tien KHÔNG TỒN TẠI nữa
// (meta profession.quality → profession.age). Save v58 bị từ chối (dev
// phase, không migration).
// v60: companion gacha (instanceId/realmId/constellationRank, pity counter, duyenPhan)
// v61 (2026-09-14, B4 talent v4 M2): cultivationOvercharge,
// tribulationBonusStacks, nodeFreePurchaseRecord, phaGiapCarryStacks,
// phaGiapCarryRealmId. Save v60 bị từ chối (dev phase, không migration).
// v62 (phap-tu-reimagined): Phap Tu path/state/combat rework —
// PlayerData loses unlockedElements/equippedElements (element authority
// is now player.spellPath.element), CombatEntity loses skillStats +
// currentHoaThe/ThoThe/KimThe pools, reaction-path skills/buffs/nodes
// retired. Save v61 bị từ chối (dev phase, không migration).
// v63 (2026-09-15, kiem-tu-reimagined spec): PlayerData.swordPath replaces
// swordPathRoute + the sword-intent ecosystem (canonical state model:
// mode/preset/kiemY/kiemDaoCount/kiemDaoBase). Save v62 bị từ chối
// (dev phase, không migration).
// v64 (2026-09-15, the-tu-reimagined spec T1): CultivationPathId mở rộng
// 'the_tu' + 'the_tu_an' — save cũ chứa path id lạ bị từ chối (dev phase,
// không migration).
// v65 (2026-09-16, cultivation-path-framework M2): PlayerData thêm field
// TUỸ CHỌN `cultivationWay?: CultivationWayId` (way đã chọn trong path, ghi
// bởi CultivationPathSystem.applyPathChoice trong Nghi Lễ Nhập Môn).
// `cultivationPath` vẫn mang union 5 id legacy trong thời kỳ chuyển
// tiếp — giờ được kiểm tra enum membership khi hiện diện. Save v64 bị
// từ chối (dev phase, không migration).
// v66 (2026-09-16, cultivation-path-framework M7): CultivationPathId
// thu còn 3 base id ('kiem_tu' | 'phap_tu' | 'the_tu') — 'phap_tu_an' /
// 'the_tu_an' trở thành WAYS trên cultivationWay, các adapter
// LEGACY_PATH_TO_WAY / resolveBasePathId / getLegacyPathIdForWay bị
// xoá. Save v65 (và save mang path id '_an') bị từ chối (dev phase,
// không migration).
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
export const CURRENT_SAVE_VERSION = 71 as const
