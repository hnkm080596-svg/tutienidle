import Phaser from 'phaser'
import { i18n } from '@/i18n'
import type { CombatVfxPresetId } from '@/core/battle/CombatAction'
import type { ActorAnchorFact, SkillCastPresentation, SkillPresentationOutcome, SkillPresentationResolved } from '@/core/battle/turn/SkillPresentationFacts'
import { SkillPresentationRunner } from '@/presentation/skills/SkillPresentationRunner'
import { PhaserSkillVfxDriver } from '@/game/support/skill-vfx/PhaserSkillVfxDriver'
import { applyScreenShake } from '@/presentation/vfx/screenShakePolicy'
import { getSkillPresentationRecipe } from '@/data/vfx/SkillPresentationRecipes'
import { linhBaoCombatDescriptors } from '@/game/support/LinhBaoVfxAssets'
import { vfxSheetCombatDescriptors } from '@/data/vfx/VfxSheetManifest'
import { HoaCauLabPlayback } from './HoaCauLabPlayback'

// This HTML entry is not in the production build and never imports GameManager/save services.
if (!import.meta.env.DEV) throw new Error('Skill VFX lab is development-only')
const t = (key: string) => i18n.global.t(`skillVfxLab.${key}`)
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
for (const id of ['title', 'intro', 'back', 'play', 'cancel', 'note'])
  element(id).textContent = t(id)
for (const id of ['skill', 'outcome', 'speed']) element(id + '-label').textContent = t(id)
const presetInput = element<HTMLSelectElement>('preset')
const outcomeInput = element<HTMLSelectElement>('outcome')
const tamMuoiInput = element<HTMLInputElement>('tam-muoi-aura')
element('tam-muoi-label').textContent = i18n.global.t('skillVfxLab.tamMuoiAura')
const phapTheInput = element<HTMLSelectElement>('phap-the-stacks')
element('phap-the-label').textContent = i18n.global.t('skillVfxLab.phapTheStacks')
// Player-side skills first (ngu_kiem_flight stays the default option: the e2e
// suite drives the lab's initial play against its flight milestones), then the
// beta monster attacks keyed by their authored attackPresetId, then the
// remaining generic presets.
const MOB_ATTACKS: Record<string, CombatVfxPresetId> = {
  mob_wild_wolf: 'bite',
  mob_giant_earthworm: 'earth_shockwave',
  mob_flame_fox: 'fire_burst',
  mob_ferocious_flood_serpent: 'water_surge',
  mob_mortal_wild_boar: 'slash',
  mob_mortal_savage_tiger: 'claw',
  mob_mortal_water_wolf: 'bite',
  mob_mortal_ferocious_giant_crocodile: 'bite',
  mob_foundation_lava_hound: 'fire_burst',
  mob_foundation_sand_scorpion: 'claw',
  mob_foundation_mud_golem: 'boss_ground_slam',
}
const mobId = () => (presetInput.value.startsWith('mob_') ? presetInput.value : null)
const activePreset = (): CombatVfxPresetId => {
  const mob = mobId()
  return mob ? MOB_ATTACKS[mob]! : (presetInput.value as CombatVfxPresetId)
}
const skillGroup = document.createElement('optgroup')
skillGroup.label = i18n.global.t('skillVfxLab.groupSkill')
for (const id of ['ngu_kiem_flight', 'hoa_cau_comet', 'linh_bao_burst', 'holy_radiance'])
  skillGroup.append(new Option(t(id), id))
const mobGroup = document.createElement('optgroup')
mobGroup.label = i18n.global.t('skillVfxLab.groupMonsters')
for (const id of Object.keys(MOB_ATTACKS)) mobGroup.append(new Option(t(id), id))
const presetGroup = document.createElement('optgroup')
presetGroup.label = i18n.global.t('skillVfxLab.groupPresets')
for (const id of ['slash', 'claw', 'bite', 'arcane_impact', 'fire_burst', 'water_surge',
  'earth_shockwave', 'metal_slash', 'wood_spikes', 'lightning_strike', 'wind_blade',
  'shadow_burst', 'boss_ground_slam', 'tu_luc'])
  presetGroup.append(new Option(t(id), id))
presetInput.append(skillGroup, mobGroup, presetGroup)
for (const id of ['hit', 'miss', 'intercept', 'sourceDeath', 'multi', 'combo', 'empty'])
  outcomeInput.add(new Option(t(id), id))
const fireballMode = () => presetInput.value === 'hoa_cau_comet'
function paintSequence() {
  const steps = fireballMode()
    ? ['raise', 'portal', 'gather', 'projectile', 'explosion', 'finish']
    : ['release', 'cruise', 'acceleration', 'impact', 'recall']
  element('sequence').replaceChildren(...steps.map(id => {
    const item = document.createElement('li')
    item.textContent = t(id)
    return item
  }))
}
const query = new URLSearchParams(location.search)
tamMuoiInput.checked = query.get('tam_muoi') === '1'
phapTheInput.value = String(Math.max(0, Math.min(5, Number(query.get('phap_the')) || 0)))
if ([...presetInput.options].some(option => option.value === query.get('preset')))
  presetInput.value = query.get('preset')!
paintSequence()
const manual = query.get('manual') === '1'
let fireballAutoplay = false
const scrubInput = element<HTMLInputElement>('scrub')
const scrubWrap = element<HTMLLabelElement>('scrub-wrap')
element('scrub-label').textContent = i18n.global.t('skillVfxLab.scrub')
const paintScrub = () => { scrubWrap.hidden = !manual || !fireballMode() }
// Seal and aura persist through the buff window, so their controls stay live
// in every mode - not only while the fireball preview runs.
const paintAuraControl = () => { element('tam-muoi-wrap').hidden = false }
const paintPhapTheControl = () => { element('phap-the-wrap').hidden = false }
paintScrub()
paintAuraControl()
paintPhapTheControl()
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const quality = query.get('quality') === 'low' || reduced ? 'low' : 'standard'
// Monster entries attack right-to-left: the lab anchors swap so the cue layer
// previews the same direction real combat runs.
let source: ActorAnchorFact = { entityId: 'player', row: 1, column: 1 }
let target: ActorAnchorFact = { entityId: 'dummy', row: 1, column: 8 }
function applyDirection() {
  if (mobId()) {
    source = { entityId: mobId()!, row: 1, column: 8 }
    target = { entityId: 'player', row: 1, column: 1 }
  } else {
    source = { entityId: 'player', row: 1, column: 1 }
    target = { entityId: 'dummy', row: 1, column: 8 }
  }
}
applyDirection()
let sequence = 0
let impacts = 0
let completes = 0
let token: string | null = null
let runner: SkillPresentationRunner
let driver: PhaserSkillVfxDriver
let fireball: HoaCauLabPlayback
let casterFigure: Phaser.GameObjects.Graphics
function snapshot() {
  return { phase: runner.snapshot.phase, impacts, completes, faults: runner.snapshot.faultCount,
    ...driver.stats, spriteActive: driver.spriteStats.active }
}
// Live phase markers: the five sequence items stand in for the runner's
// coarse phases - cast spans the flight items, waiting is the impact beat,
// resolved/resume is the recall tail, idle lights nothing.
const PHASE_ITEMS: Record<string, readonly number[]> = {
  cast: [0, 1, 2],
  waiting: [3],
  resolved: [4],
  resume: [4],
}
function paintStats() {
  if (!runner) return
  if (fireballMode()) {
    const state = fireball.snapshot()
    phapTheInput.value = String(state.phapTheStacks)
    element('stats').textContent = `fireball: ${state.phase} · release ${(state.releaseMs / 1000).toFixed(2)} s · impact ${(state.impactMs / 1000).toFixed(2)} s · ${quality}`
    const index = { raise: 0, portal: 1, charge: 2, projectile: 3, impact: 4, complete: 5, idle: -1 }[state.phase]
    for (const [i, item] of [...element('sequence').children].entries())
      item.classList.toggle('is-active', i === index)
    return
  }
  const state = snapshot()
  element('stats').textContent = `${state.phase} · impact ${impacts} · complete ${completes} · pool ${state.active}/${state.allocated} · ${quality}`
  const lit = PHASE_ITEMS[state.phase] ?? []
  for (const [index, item] of [...element('sequence').children].entries())
    item.classList.toggle('is-active', lit.includes(index))
}
// Fixture outcomes: intercept exercises the skipped lane (no landed hit,
// so no camera shake), sourceDeath lands a killing hit on the source
// anchor itself, and the default mints `count` ordinary hits (misses for
// the 'miss' fixture).
function fixtureOutcomes(fixture: string, id: CombatVfxPresetId, count: number): SkillPresentationOutcome[] {
  if (fixture === 'empty') return [{ kind: 'no-effect', outcomeId: 'none', reason: 'preview' }]
  if (fixture === 'intercept')
    return [{ kind: 'skipped', outcomeId: 'skipped', target, reason: 'intercepted' }]
  if (fixture === 'sourceDeath')
    return [{ kind: 'hit', outcomeId: 'hit-source', target: source,
      hitOrdinal: 0, landed: true, hpDamage: 10, crit: false, killed: true }]
  if (id === 'holy_radiance') return [{ kind: 'heal', outcomeId: 'heal', target: source, healed: 20 }]
  return Array.from({ length: count }, (_, i) => ({ kind: 'hit' as const, outcomeId: 'hit-' + i,
    target, hitOrdinal: i, landed: fixture !== 'miss', hpDamage: fixture === 'miss' ? 0 : 10, crit: false, killed: false }))
}
function play(autoplay = false) {
  if (!runner) return
  fireballAutoplay = autoplay
  runner.cancel()
  fireball.cancel()
  if (fireballMode()) {
    scrubInput.value = '0'
    fireball.play(outcomeInput.value !== 'miss', autoplay)
    paintStats()
    return
  }
  const id = activePreset()
  const ref = { sessionId: 1, requestId: 'lab-' + ++sequence, token: 'lab-' + sequence }
  token = ref.token
  const fixture = outcomeInput.value
  const count = fixture === 'multi' ? 8 : 1
  const cast: SkillCastPresentation = {
    ref, rootSkillId: mobId() ?? id, resolvedSkillId: id, presetId: id, source,
    declaredTargets: [target], candidateInstanceCount: count, disposition: 'action',
    slotRole: 'basic',
  }
  const receipt: SkillPresentationResolved = { ref, sealed: true, groups: [{
    groupId: 'primary', role: 'primary', resolvedSkillId: id, presetId: id, source,
    actualTargets: id === 'holy_radiance' || fixture === 'sourceDeath' ? [source] : [target],
    footprint: { kind: 'cells', cells: [{ row: 1,
      column: id === 'holy_radiance' || fixture === 'sourceDeath' ? source.column : target.column }] },
    outcomes: fixtureOutcomes(fixture, id, count),
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
  preload() {
    HoaCauLabPlayback.preload(this)
    for (const asset of linhBaoCombatDescriptors()) {
      this.load.atlas(asset.key, asset.textureUrl, asset.atlasUrl)
    }
    // Sheet-bound presets (bite/claw/slash bursts etc.) need their atlases or
    // the cue layer silently falls back to the analytic primitives.
    for (const asset of vfxSheetCombatDescriptors()) {
      this.load.atlas(asset.key, asset.textureUrl, asset.atlasUrl)
    }
  }
  create() {
    const backdrop = this.add.graphics()
    backdrop.fillStyle(0x122733).fillRect(0, 0, 960, 440)
    backdrop.lineStyle(1, 0x385160, 0.3)
    for (let i = 0; i < 12; i++) backdrop.lineBetween(i * 90 - 80, 440, 480 + (i - 5) * 22, 125)
    for (let y = 170; y < 440; y += 48) backdrop.lineBetween(0, y, 960, y)
    backdrop.fillStyle(0x203c48).fillTriangle(0, 160, 240, 30, 460, 160)
    backdrop.fillStyle(0x192f3b).fillTriangle(400, 160, 710, 10, 960, 160)
    for (const [x, color] of [[210, 0x7daebd], [750, 0xa89b7d]] as const) {
      const figure = this.add.graphics()
      if (x === 210) {
        casterFigure = figure
        // The playback actor sprite is the caster figure in every mode now;
        // the drawn silhouette would double up underneath it.
        figure.setVisible(false)
      }
      figure.fillStyle(0x081721, 0.8).fillEllipse(x, 325, 110, 26)
      figure.lineStyle(1, color, 0.4).strokeEllipse(x, 325, 132, 38)
      const enemy = x === 750
      figure.fillStyle(color, 0.28).fillTriangle(x, enemy ? 128 : 218,
        x - (enemy ? 48 : 28), 318, x + (enemy ? 48 : 28), 318)
      figure.lineStyle(2, color, 0.7).lineBetween(x, enemy ? 145 : 238,
        x - (enemy ? 35 : 16), 300)
      figure.fillStyle(color, 0.8).fillCircle(x, enemy ? 110 : 213, enemy ? 18 : 10)
    }
    const point = (fact: Pick<ActorAnchorFact, 'column' | 'row'>) => ({
      x: fact.column < 4 ? 210 : 750, y: 260 + (fact.row - 1) * 42,
    })
    driver = new PhaserSkillVfxDriver({
      graphics: () => this.add.graphics(), anchor: point,
      sprite: key => this.add.image(0, 0, key),
      ground: fact => ({ ...point(fact), y: 325 }),
      uprightDepth: () => 600,
      // One-shot stubs so the cast-phase actor-impulse and the impact
      // camera-cue are exercised in preview: a marker disc slides toward
      // the target lane (real scenes tween the source sprite's offsetX).
      actorImpulse: (fact, durationMs, impulsePx) => {
        const origin = point(fact)
        const marker = this.add.graphics()
        marker.fillStyle(0xdcc98b, 0.9).fillCircle(0, 0, 10)
        marker.setPosition(origin.x, origin.y - 40)
        const direction = target.column > fact.column ? 1 : -1
        this.tweens.add({
          targets: marker, x: origin.x + direction * impulsePx * 3,
          duration: durationMs, yoyo: true, onComplete: () => marker.destroy(),
        })
      },
      // Same gate as production scenes - reducedShake must reach the dev
      // lab too, or the W10 policy is not the sole shake authority.
      cameraImpulse: (durationMs, intensity) => applyScreenShake(this.cameras.main, durationMs, intensity, false),
    }, quality, reduced)
    runner = new SkillPresentationRunner(driver, getSkillPresentationRecipe, error => console.error(error))
    fireball = new HoaCauLabPlayback(this)
    fireball.setTamMuoiActive(tamMuoiInput.checked)
    fireball.setPhapTheStacks(Number(phapTheInput.value))
    phapTheInput.onchange = () => { fireball.setPhapTheStacks(Number(phapTheInput.value)); paintStats() }
    tamMuoiInput.onchange = () => { fireball.setTamMuoiActive(tamMuoiInput.checked); paintStats() }
    scrubInput.oninput = () => {
      if (!manual || !fireballMode()) return
      fireballAutoplay = false
    fireball.play(outcomeInput.value !== 'miss')
      fireball.update(Number(scrubInput.value))
      paintStats()
    }
    element('play').onclick = () => play(true)
    element('cancel').onclick = () => {
      runner.cancel(); fireball.cancel(); fireball.setTamMuoiActive(false)
      tamMuoiInput.checked = false; fireballAutoplay = false; token = null; paintStats()
    }
    presetInput.onchange = () => {
      runner.cancel(); fireball.cancel(); token = null
      fireballAutoplay = false
      applyDirection()
      paintScrub()
      paintAuraControl()
      paintPhapTheControl()
      fireball.setTamMuoiActive(tamMuoiInput.checked)
      paintSequence(); paintStats()
    }
    const lab = {
      snapshot: () => fireballMode() ? fireball.snapshot() : snapshot(), play,
      advance: (ms: number) => { if (fireballMode()) fireball.update(ms); else runner.update(ms); paintStats() },
      cancel: () => {
        runner.cancel(); fireball.cancel(); fireball.setTamMuoiActive(false)
        tamMuoiInput.checked = false; token = null; paintStats()
      },
    }
    Object.assign(window, { __skillVfxLab: lab })
    this.events.once('shutdown', () => {
      runner.cancel()
      fireball.destroy()
      driver.destroy()
      element('play').onclick = null
      element('cancel').onclick = null
      presetInput.onchange = null
      tamMuoiInput.onchange = null
      phapTheInput.onchange = null
      Object.assign(window, { __skillVfxLab: undefined })
    })
    play()
  }
  update(_time: number, delta: number) {
    if (fireball) fireball.updateAura(delta)
    if (runner && (!manual || fireballAutoplay)) {
      const step = delta * Number(element<HTMLSelectElement>('speed').value)
      if (fireballMode()) fireball.update(step)
      else runner.update(step)
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
