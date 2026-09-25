import Phaser from 'phaser'
import { i18n } from '@/i18n'
import type { CombatVfxPresetId } from '@/core/battle/CombatAction'
import type { ActorAnchorFact, SkillCastPresentation, SkillPresentationResolved } from '@/core/battle/turn/SkillPresentationFacts'
import { SkillPresentationRunner } from '@/presentation/skills/SkillPresentationRunner'
import { PhaserSkillVfxDriver } from '@/game/support/skill-vfx/PhaserSkillVfxDriver'
import { getSkillPresentationRecipe } from '@/data/vfx/SkillPresentationRecipes'

// This HTML entry is not in the production build and never imports GameManager/save services.
if (!import.meta.env.DEV) throw new Error('Skill VFX lab is development-only')
const t = (key: string) => i18n.global.t('skillVfxLab.' + key)
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
for (const id of ['title', 'intro', 'back', 'play', 'cancel', 'note'])
  element(id).textContent = t(id)
for (const id of ['skill', 'outcome', 'speed']) element(id + '-label').textContent = t(id)
const presetInput = element<HTMLSelectElement>('preset')
const outcomeInput = element<HTMLSelectElement>('outcome')
for (const id of ['ngu_kiem_flight', 'slash', 'earth_shockwave', 'holy_radiance'])
  presetInput.add(new Option(t(id), id))
for (const id of ['hit', 'miss', 'multi', 'combo', 'empty'])
  outcomeInput.add(new Option(t(id), id))
for (const id of ['release', 'cruise', 'acceleration', 'impact', 'recall']) {
  const item = document.createElement('li')
  item.textContent = t(id)
  element('sequence').append(item)
}
const query = new URLSearchParams(location.search)
if ([...presetInput.options].some(option => option.value === query.get('preset')))
  presetInput.value = query.get('preset')!
const manual = query.get('manual') === '1'
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const quality = query.get('quality') === 'low' || reduced ? 'low' : 'standard'
const source: ActorAnchorFact = { entityId: 'player', row: 1, column: 1 }
const target: ActorAnchorFact = { entityId: 'dummy', row: 1, column: 8 }
let sequence = 0
let impacts = 0
let completes = 0
let token: string | null = null
let runner: SkillPresentationRunner
let driver: PhaserSkillVfxDriver
function snapshot() {
  return { phase: runner.snapshot.phase, impacts, completes, faults: runner.snapshot.faultCount, ...driver.stats }
}
function paintStats() {
  if (!runner) return
  const state = snapshot()
  element('stats').textContent = `${state.phase} · impact ${impacts} · complete ${completes} · pool ${state.active}/${state.allocated} · ${quality}`
}
function play() {
  if (!runner) return
  runner.cancel()
  const id = presetInput.value as CombatVfxPresetId
  const ref = { sessionId: 1, requestId: 'lab-' + ++sequence, token: 'lab-' + sequence }
  token = ref.token
  const fixture = outcomeInput.value
  const count = fixture === 'multi' ? 8 : 1
  const cast: SkillCastPresentation = {
    ref, rootSkillId: id, resolvedSkillId: id, presetId: id, source,
    declaredTargets: [target], candidateInstanceCount: count, disposition: 'action',
  }
  const receipt: SkillPresentationResolved = { ref, sealed: true, groups: [{
    groupId: 'primary', role: 'primary', resolvedSkillId: id, presetId: id, source,
    actualTargets: id === 'holy_radiance' ? [source] : [target],
    footprint: { kind: 'cells', cells: [{ row: 1, column: 8 }] },
    outcomes: fixture === 'empty' ? [{ kind: 'no-effect', outcomeId: 'none', reason: 'preview' }]
      : id === 'holy_radiance' ? [{ kind: 'heal', outcomeId: 'heal', target: source, healed: 20 }]
      : Array.from({ length: count }, (_, i) => ({ kind: 'hit' as const, outcomeId: 'hit-' + i,
        target, hitOrdinal: i, landed: fixture !== 'miss', hpDamage: fixture === 'miss' ? 0 : 10, crit: false, killed: false })),
  }] }
  const result = fixture === 'combo' ? { ...receipt, groups: [...receipt.groups, {
    ...receipt.groups[0]!, groupId: 'combo', role: 'combo' as const, presetId: 'earth_shockwave' as const,
  }] } : receipt
  runner.start(cast, {
    getPendingPlaybackToken: () => token,
    acknowledgeActionImpact: received => {
      if (received !== token) return
      impacts++
      runner.resolve(result)
    },
    acknowledgeActionComplete: received => {
      if (received !== token) return
      completes++
      token = null
    },
  })
  paintStats()
}
class SkillLabScene extends Phaser.Scene {
  create() {
    const backdrop = this.add.graphics()
    backdrop.fillStyle(0x122733).fillRect(0, 0, 960, 440)
    backdrop.lineStyle(1, 0x385160, 0.3)
    for (let i = 0; i < 12; i++) backdrop.lineBetween(i * 90 - 80, 440, 480 + (i - 5) * 22, 125)
    for (let y = 170; y < 440; y += 48) backdrop.lineBetween(0, y, 960, y)
    backdrop.fillStyle(0x203c48).fillTriangle(0, 160, 240, 30, 460, 160)
    backdrop.fillStyle(0x192f3b).fillTriangle(400, 160, 710, 10, 960, 160)
    for (const [x, color] of [[210, 0x7daebd], [750, 0xa89b7d]] as const) {
      backdrop.fillStyle(0x081721, 0.8).fillEllipse(x, 325, 110, 26)
      backdrop.lineStyle(1, color, 0.4).strokeEllipse(x, 325, 132, 38)
      backdrop.fillStyle(color, 0.28).fillTriangle(x, 218, x - 28, 318, x + 28, 318)
      backdrop.lineStyle(2, color, 0.7).lineBetween(x, 238, x - 16, 300)
      backdrop.fillStyle(color, 0.8).fillCircle(x, 213, 10)
    }
    const point = (fact: Pick<ActorAnchorFact, 'column' | 'row'>) => ({
      x: fact.column < 4 ? 210 : 750, y: 260 + (fact.row - 1) * 42,
    })
    driver = new PhaserSkillVfxDriver({
      graphics: () => this.add.graphics(), anchor: point,
      ground: fact => ({ ...point(fact), y: 325 }),
      uprightDepth: () => 600,
      cameraImpulse: () => this.cameras.main.shake(45, 0.001, false),
    }, quality, reduced)
    runner = new SkillPresentationRunner(driver, getSkillPresentationRecipe, error => console.error(error))
    element('play').onclick = play
    element('cancel').onclick = () => { runner.cancel(); token = null; paintStats() }
    const lab = {
      snapshot, play,
      advance: (ms: number) => { runner.update(ms); paintStats() },
      cancel: () => { runner.cancel(); token = null; paintStats() },
    }
    Object.assign(window, { __skillVfxLab: lab })
    this.events.once('shutdown', () => {
      runner.cancel()
      driver.destroy()
      element('play').onclick = null
      element('cancel').onclick = null
      Object.assign(window, { __skillVfxLab: undefined })
    })
    play()
  }
  update(_time: number, delta: number) {
    if (runner && !manual) {
      runner.update(delta * Number(element<HTMLSelectElement>('speed').value))
      paintStats()
    }
  }
}
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'stage', width: 960, height: 440, backgroundColor: '#122733',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: SkillLabScene, audio: { noAudio: true },
})
if (import.meta.hot) import.meta.hot.dispose(() => game.destroy(true))
