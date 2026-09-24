# Coordinator census: mortalBasicSkillId pick surface @44abadfb

## rg mortalBasicSkillId|preferredBasicSkill|isMortalPrecursorSkillId|MORTAL_PRECURSOR|MORTAL_DEFAULT_BASIC (src+tests, excl docs/qa)

```
src/core/skill/MortalPrecursors.ts:7:export const MORTAL_PRECURSOR_SKILL_IDS = ['tram', 'linh_bao', 'huy_quyen'] as const
src/core/skill/MortalPrecursors.ts:9:export const MORTAL_DEFAULT_BASIC_ID = 'tram'
src/core/skill/MortalPrecursors.ts:11:export function isMortalPrecursorSkillId(id: string): boolean {
src/core/skill/MortalPrecursors.ts:12:  return (MORTAL_PRECURSOR_SKILL_IDS as readonly string[]).includes(id)
src/core/skill/MortalPrecursors.test.ts:3:  isMortalPrecursorSkillId,
src/core/skill/MortalPrecursors.test.ts:4:  MORTAL_DEFAULT_BASIC_ID,
src/core/skill/MortalPrecursors.test.ts:5:  MORTAL_PRECURSOR_SKILL_IDS,
src/core/skill/MortalPrecursors.test.ts:15:    expect([...MORTAL_PRECURSOR_SKILL_IDS].sort()).toEqual(
src/core/skill/MortalPrecursors.test.ts:20:  it('isMortalPrecursorSkillId accepts members and rejects non-members', () => {
src/core/skill/MortalPrecursors.test.ts:21:    for (const id of MORTAL_PRECURSOR_SKILL_IDS) {
src/core/skill/MortalPrecursors.test.ts:22:      expect(isMortalPrecursorSkillId(id)).toBe(true)
src/core/skill/MortalPrecursors.test.ts:25:    expect(isMortalPrecursorSkillId('hoa_cau_thuat')).toBe(false)
src/core/skill/MortalPrecursors.test.ts:26:    expect(isMortalPrecursorSkillId('')).toBe(false)
src/core/skill/MortalPrecursors.test.ts:30:    expect(isMortalPrecursorSkillId(MORTAL_DEFAULT_BASIC_ID)).toBe(true)
src/core/skill/MortalPrecursors.test.ts:31:    expect(MORTAL_DEFAULT_BASIC_ID).toBe('tram')
src/core/kiem-tu/KiemTuPath.ts:180:  // ritual clears mortalBasicSkillId inside the commit block and the
src/core/kiem-tu/invariants.test.ts:11:import { MORTAL_PRECURSOR_SKILL_IDS } from '../skill/MortalPrecursors'
src/core/kiem-tu/invariants.test.ts:694:  it.each(MORTAL_PRECURSOR_SKILL_IDS)(
src/core/kiem-tu/KiemTuState.ts:53:// P7-M4 - MORTAL_PRECURSOR_SKILL_IDS moved to core/skill/MortalPrecursors.ts
src/core/skilldef/LegacySkillCoverage.test.ts:242:    { label: 'picked_basic', player: censusPlayer((p) => { p.mortalBasicSkillId = 'huy_quyen' }) },
src/core/player/CultivationPathContract.test.ts:33:import { isMortalPrecursorSkillId } from '../skill/MortalPrecursors'
src/core/player/CultivationPathContract.test.ts:126:      isMortalPrecursorSkillId(way.starterBasicSkillId),
src/core/player/CultivationPathRegistry.ts:27:import { isMortalPrecursorSkillId, MORTAL_DEFAULT_BASIC_ID } from '../skill/MortalPrecursors'
src/core/player/CultivationPathRegistry.ts:325: * Mortal / pham_nhan — the persisted mortalBasicSkillId pick is the
src/core/player/CultivationPathRegistry.ts:338:      const pick = player.mortalBasicSkillId
src/core/player/CultivationPathRegistry.ts:340:        pick !== undefined && isMortalPrecursorSkillId(pick) && deps.skillManager.has(pick)
src/core/player/CultivationPathRegistry.ts:342:          : MORTAL_DEFAULT_BASIC_ID
src/core/player/Player.ts:132:  mortalBasicSkillId?: string
src/core/player/Player.ts:418:    mortalBasicSkillId: undefined,
src/core/player/CultivationPathRuntime.test.ts:71:  it('mortal runtime resolves the persisted mortalBasicSkillId pick', () => {
src/core/player/CultivationPathRuntime.test.ts:82:    picked.mortalBasicSkillId = 'linh_bao'
src/core/player/CultivationPathRuntime.test.ts:86:    fist.mortalBasicSkillId = 'huy_quyen'
src/core/player/CultivationPathRuntime.test.ts:102:    illegal.mortalBasicSkillId = 'hoa_cau_thuat'
src/core/player/CultivationPathRuntime.test.ts:106:    unlearned.mortalBasicSkillId = 'huy_quyen'
src/core/the-tu/TheTuPath.ts:216:  // ritual clears mortalBasicSkillId inside the commit block and the
src/components/panels/skill-path/SkillRoleStrip.vue:19:import { MORTAL_DEFAULT_BASIC_ID, MORTAL_PRECURSOR_SKILL_IDS } from '@/core/skill/MortalPrecursors'
src/components/panels/skill-path/SkillRoleStrip.vue:49:  return MORTAL_PRECURSOR_SKILL_IDS
src/components/panels/skill-path/SkillRoleStrip.vue:123:  return (player.mortalBasicSkillId ?? MORTAL_DEFAULT_BASIC_ID) === skillId
src/App.vue:553:      // a fresh mortal carries no mortalBasicSkillId.
src/core/game/GameManagerSaveRestore.boundary.test.ts:1014:// P7-M4 (v71) - mortalBasicSkillId preflight: absent = tram default;
src/core/game/GameManagerSaveRestore.boundary.test.ts:1019:describe('v71 mortalBasicSkillId preflight', () => {
src/core/game/GameManagerSaveRestore.boundary.test.ts:1025:      player.mortalBasicSkillId = skillId
src/core/game/GameManagerSaveRestore.boundary.test.ts:1042:      player.mortalBasicSkillId = value as string
src/core/game/GameManagerSaveRestore.boundary.test.ts:1045:      expect(() => manager.saveOps.restoreFromSave(save)).toThrow(/Invalid mortalBasicSkillId/i)
src/core/game/GameManagerSaveRestore.boundary.test.ts:1055:    player.mortalBasicSkillId = 'huy_quyen'
src/core/game/GameManagerSaveRestore.boundary.test.ts:1061:    expect(() => manager.saveOps.restoreFromSave(save)).toThrow(/mortalBasicSkillId persisted post-path/i)
src/core/game/GameManagerProgressionOps.ts:28:import { isMortalPrecursorSkillId } from '../skill/MortalPrecursors'
src/core/game/GameManagerProgressionOps.ts:644:    if (!isMortalPrecursorSkillId(skillId)) {
src/core/game/GameManagerProgressionOps.ts:652:    player.mortalBasicSkillId = skillId
src/core/game/GameManager.mortalBasicSkill.test.ts:12:// (mortalBasicSkillId) written through the ONE role-write op. The
src/core/game/GameManager.mortalBasicSkill.test.ts:44:    expect(player.mortalBasicSkillId).toBe('linh_bao')
src/core/game/GameManager.mortalBasicSkill.test.ts:65:    expect(player.mortalBasicSkillId).toBeUndefined()
src/core/game/GameManager.mortalBasicSkill.test.ts:73:    expect(player.mortalBasicSkillId).toBeUndefined()
src/core/game/GameManager.mortalBasicSkill.test.ts:141:    player.mortalBasicSkillId = 'tram'
src/core/game/GameManager.mortalBasicSkill.test.ts:147:    expect(player.mortalBasicSkillId).toBe('tram')
src/core/game/GameManager.kiemTuState.test.ts:8:import { MORTAL_PRECURSOR_SKILL_IDS } from '../skill/MortalPrecursors'
src/core/game/GameManager.kiemTuState.test.ts:105:  it.each(MORTAL_PRECURSOR_SKILL_IDS)(
src/core/game/GameManagerSaveRestore.ts:17:import { isMortalPrecursorSkillId } from '../skill/MortalPrecursors'
src/core/game/GameManagerSaveRestore.ts:265:    // P7-M4 (v71) - mortalBasicSkillId is the MORTAL-ONLY basic pick:
src/core/game/GameManagerSaveRestore.ts:271:    const mortalPick = save.player.mortalBasicSkillId
src/core/game/GameManagerSaveRestore.ts:274:      if (!isMortalPrecursorSkillId(mortalPick)) {
src/core/game/GameManagerSaveRestore.ts:275:        throw new Error(`Invalid mortalBasicSkillId in save: ${String(mortalPick)}`)
src/core/game/GameManagerSaveRestore.ts:280:          `mortalBasicSkillId persisted post-path in save: '${mortalPick}' on path '${save.player.cultivationPath}'`,
src/core/game/EarlyGameBootstrap.ts:52:  // mortalBasicSkillId pick as tram; boot writes no slot/pick.
src/core/game/GameManager.theTuRitual.test.ts:131:    expect(player.mortalBasicSkillId).toBeUndefined()
src/core/game/GameManager.theTuRitual.test.ts:198:    player.mortalBasicSkillId = 'tram'
src/core/game/GameManager.theTuRitual.test.ts:217:    player.mortalBasicSkillId = 'tram'
src/core/game/GameManagerRealmAdvanceOps.ts:315:    delete player.mortalBasicSkillId
src/services/save/SaveSystem.bootRestore.test.ts:84:      'non-precursor mortalBasicSkillId',
src/services/save/SaveSystem.bootRestore.test.ts:85:      (save: GameSave) => { save.player.mortalBasicSkillId = 'hoa_cau_thuat' },
src/services/save/SaveSystem.bootRestore.test.ts:86:      'Invalid mortalBasicSkillId in save: hoa_cau_thuat',
src/services/save/saveVersion.ts:91:// mortalBasicSkillId (mortal-only precursor pick; post-path presence is
src/services/save/saveShapeValidation.test.ts:2260:// mortalBasicSkillId precursor/mortal-only contract lives at the
src/services/save/saveShapeValidation.test.ts:2300:    'chấp nhận mortalBasicSkillId = %s trên player chưa chọn path',
src/services/save/saveShapeValidation.test.ts:2303:      playerOf(save).mortalBasicSkillId = skillId
src/services/save/saveShapeValidation.test.ts:2309:  it('player mặc định không mang mortalBasicSkillId (absent = tram default)', () => {
src/services/save/saveShapeValidation.test.ts:2312:    expect(playerOf(save).mortalBasicSkillId).toBeUndefined()
src/services/save/saveShapeValidation.ts:731:  // P7-M4 (v71) - mortalBasicSkillId's precursor/mortal-only contract
```
