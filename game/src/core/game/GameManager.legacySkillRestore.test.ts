import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { asBaseStats } from '../stats/StatBlock'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'
import { HERO_LANE_INDEX } from '../battle/BattleLane'
import type { GameSave } from '../../services/save/SaveSystem'
import type { Skill } from '../skill/Skill'
import { createDefaultBodyProgression } from '../realm/body/BodyChapter'
import { createDefaultHiddenPerfection } from '../realm/hidden/HiddenPerfection'

// Bug report 2026-08-26: "nhan vat khong gay sat thuong nua du van tele".
// Root cause - save nhan vat CU (development build, khong migration) luu
// skill object NGUYEN TRANG truoc khi co field `execution` bat buoc;
// scheduler thong nhat bo qua moi active thieu execution nen Player
// khong bao gio cast, trong khi teleport AI (khong can skill) van chay.
// Fix: restoreFromSave doi chieu template de hoi phuc authored data.
function buildLegacySave(skills: Skill[]): GameSave {
  return {
    player: {
      bodyProgression: createDefaultBodyProgression(),
      // M-QI-07 (v74) - the minimal legacy-skill fixture still declares
      // the required physique field at the current version.
      physiqueGrade: 'pham',
      // sec.19/v82 - hiddenPerfection is a required persisted slice; a
      // current-version fixture carries its default.
      hiddenPerfection: createDefaultHiddenPerfection(),
    },
    techniques: [],
    skills,
    materials: [],
    pills: [],
    talismans: [],
    formations: [],
    equipment: [],
    buildings: [],
    equipmentSlots: [],
  } as unknown as GameSave
}

describe('GameManager — restore skill legacy thiếu execution (bugfix 2026-08-26)', () => {
  it('backfill execution từ template cho skill save cũ', () => {
    const gameManager = new GameManager()

    gameManager.catalogOps.registerSkillTemplates(SKILLS)

    // Mo phong skill object trong save cu: progression state THAT cua
    // nhan vat da hoc (membership = learned), nhung KHONG co
    // field execution (field sinh ra sau nay).
    const legacyTram = JSON.parse(
      JSON.stringify(SKILLS.find((skill) => skill.id === 'tram')),
    ) as Skill

    delete legacyTram.execution

    gameManager.saveOps.restoreFromSave(buildLegacySave([legacyTram]))

    const restored = gameManager.skillManager.get('tram')!

    expect(gameManager.skillManager.has('tram')).toBe(true)
    expect(restored.execution?.kind).toBe('attack_speed')
  })

  it('end-to-end: sau restore, Trảm gây sát thương lại bình thường (symptom của bug report)', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    gameManager.catalogOps.registerSkillTemplates(SKILLS)

    const legacyTram = JSON.parse(
      JSON.stringify(SKILLS.find((skill) => skill.id === 'tram')),
    ) as Skill

    delete legacyTram.execution

    gameManager.saveOps.restoreFromSave(buildLegacySave([legacyTram]))

    const player = createDefaultPlayer()
    // (2026-09-04) pin speed 1 nhu attackSpeed cu - khong pin thi cadence
    // 100 don/s khien enemy chet het truoc khi assert.
    player.baseStats = asBaseStats({ ...player.baseStats, might: 100, speed: 100  })

    const enemy = defineEnemy({
      id: 'legacy_restore_dummy',
      name: 'Dummy',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 1000,
        might: 0,
        attackSpeed: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
      },
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    })

    gameManager.catalogOps.registerEnemyTemplates([enemy])
    gameManager.startBattleWithPlayer(player, enemy)
    combatSource.advance(3) // Bo qua countdown + telegraph spawn.

    const battle = gameManager.getTurnBattle()!

    battle.enemies[0]!.entity.x = 2
    battle.enemies[0]!.entity.row = HERO_LANE_INDEX

    for (let index = 0; index < 400; index++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(battle.enemies[0]!.entity.currentHp).toBeLessThan(1000)
  })
})
