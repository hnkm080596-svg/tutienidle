import Phaser from 'phaser'
import type { ActorAnchorFact, SkillCastPresentation, SkillPresentationResolved } from '@/core/battle/turn/SkillPresentationFacts'
import { animatedArtFormFor } from '@/presentation/art/CombatPresentationCatalogue'
import { clipImpactMs } from '@/presentation/art/CombatEntityPresentation'
import { HOA_CAU_PHOENIX_PREVIEW_ASSET, HOA_CAU_TRIPLE_CIRCLE_PREVIEW_ASSET, HOA_CAU_VFX_ASSETS, HOA_THE_PREVIEW_ASSET, TAM_MUOI_AURA_FRONT_PREVIEW_ASSET, TAM_MUOI_AURA_PREVIEW_ASSET } from '@/game/support/HoaCauVfxAssets'
import { HoaCauFireballPresentation, hoaCauHandAnchor } from '@/game/support/skill-vfx/HoaCauFireballPresentation'
import { hoaCauTiming } from '@/game/support/skill-vfx/HoaCauFireballTimeline'

function requireCastClip() {
  const clip = animatedArtFormFor('phap_tu_shared')?.castClips?.hoa_cau_thuat
  if (!clip) throw new Error('Hỏa Cầu cast clip is missing from the character catalogue')
  return clip
}
const castClip = requireCastClip()
const impactMs = clipImpactMs(castClip)
const source: ActorAnchorFact = { entityId: 'lab-caster', row: 1, column: 1 }
const target: ActorAnchorFact = { entityId: 'lab-target', row: 1, column: 8 }
const frameName = (index: number) =>
  `${castClip.framePrefix}${String(index).padStart(castClip.zeroPad, '0')}${castClip.frameSuffix}`

type Phase = 'idle' | 'raise' | 'portal' | 'charge' | 'projectile' | 'impact' | 'complete'

/** Dev-only clock and fake hit receipt; all effect frames come from the production presenter. */
export class HoaCauLabPlayback {
  static preload(scene: Phaser.Scene): void {
    scene.load.atlas(castClip.sheetKey, `/${castClip.sheetUrl}`, `/${castClip.atlasUrl}`)
    for (const asset of Object.values(HOA_CAU_VFX_ASSETS)) {
      scene.load.atlas(asset.key, asset.textureUrl, asset.atlasUrl)
    }
    scene.load.atlas(HOA_CAU_PHOENIX_PREVIEW_ASSET.key,
      HOA_CAU_PHOENIX_PREVIEW_ASSET.textureUrl, HOA_CAU_PHOENIX_PREVIEW_ASSET.atlasUrl)
    scene.load.atlas(HOA_CAU_TRIPLE_CIRCLE_PREVIEW_ASSET.key,
      HOA_CAU_TRIPLE_CIRCLE_PREVIEW_ASSET.textureUrl, HOA_CAU_TRIPLE_CIRCLE_PREVIEW_ASSET.atlasUrl)
    scene.load.atlas(TAM_MUOI_AURA_PREVIEW_ASSET.key,
      TAM_MUOI_AURA_PREVIEW_ASSET.textureUrl, TAM_MUOI_AURA_PREVIEW_ASSET.atlasUrl)
    scene.load.atlas(TAM_MUOI_AURA_FRONT_PREVIEW_ASSET.key,
      TAM_MUOI_AURA_FRONT_PREVIEW_ASSET.textureUrl, TAM_MUOI_AURA_FRONT_PREVIEW_ASSET.atlasUrl)
    scene.load.atlas(HOA_THE_PREVIEW_ASSET.key,
      HOA_THE_PREVIEW_ASSET.textureUrl, HOA_THE_PREVIEW_ASSET.atlasUrl)
  }

  private readonly actor: Phaser.GameObjects.Sprite
  private readonly auraBack: Phaser.GameObjects.Sprite
  private readonly auraFront: Phaser.GameObjects.Sprite
  private readonly hoaThe: Phaser.GameObjects.Sprite
  private readonly presenter: HoaCauFireballPresentation
  private elapsedMs = 0
  private serial = 0
  private landed = true
  private resolved = false
  private phase: Phase = 'idle'
  private tamMuoiActive = false
  private auraElapsedMs = 0
  private hoaTheActive = false

  constructor(private readonly scene: Phaser.Scene) {
    this.actor = scene.add.sprite(210, 325, castClip.sheetKey, frameName(castClip.firstFrame))
      .setOrigin(0.5, 1).setScale(0.95).setDepth(590).setVisible(false)
    this.auraBack = scene.add.sprite(210, 325, TAM_MUOI_AURA_PREVIEW_ASSET.key, 'frame_0')
      .setOrigin(0.5, 1).setScale(0.95).setDepth(589.5)
      .setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
    this.auraFront = scene.add.sprite(210, 325, TAM_MUOI_AURA_FRONT_PREVIEW_ASSET.key, 'frame_0')
      .setOrigin(0.5, 1).setScale(0.95).setDepth(590.5)
      .setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
    this.hoaThe = scene.add.sprite(210, 235, HOA_THE_PREVIEW_ASSET.key, 'frame_0')
      .setOrigin(0.5, 0.5).setScale(0.85).setDepth(591)
      .setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
    this.presenter = new HoaCauFireballPresentation({
      anchor: fact => fact.entityId === source.entityId
        ? hoaCauHandAnchor(this.actor) : { x: 750, y: 205 },
      depth: () => 600,
      createSprite: (key, frame) => scene.add.sprite(0, 0, key, frame),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      artVariant: 'phoenix_projectile',
    })
  }

  play(landed = true): void {
    this.presenter.cancel()
    this.elapsedMs = 0
    this.resolved = false
    this.landed = landed
    this.phase = 'raise'
    this.actor.setVisible(true).setFrame(frameName(castClip.firstFrame))
    const id = ++this.serial
    const cast: SkillCastPresentation = {
      ref: { sessionId: 1, requestId: `lab-fireball-${id}`, token: `lab-fireball-${id}` },
      rootSkillId: 'hoa_cau_thuat', resolvedSkillId: 'hoa_cau_thuat',
      presetId: 'hoa_cau_comet', source, declaredTargets: [target],
      candidateInstanceCount: 1, disposition: 'action', slotRole: 'basic',
    }
    this.cast = cast
    this.presenter.start(cast, impactMs)
  }

  private cast?: SkillCastPresentation

  setTamMuoiActive(active: boolean): void {
    this.tamMuoiActive = active
    if (!active) this.auraElapsedMs = 0
    this.auraBack.setVisible(active && this.actor.visible)
    this.auraFront.setVisible(active && this.actor.visible)
  }

  setHoaTheActive(active: boolean): void {
    this.hoaTheActive = active
    if (!active) this.hoaThe.setVisible(false)
  }

  // The seal lights stroke-by-stroke over the charge window so the completed
  // character arrives exactly at the release beat; it holds through the flight
  // so the living-flame burn reads before the projectile lands.
  updateHoaThe(): void {
    if (!this.hoaTheActive || !this.actor.visible || !this.cast) { this.hoaThe.setVisible(false); return }
    const timing = hoaCauTiming(impactMs)
    const span = Math.max(1, timing.releaseMs - timing.chargeStartMs)
    const progress = (this.elapsedMs - timing.chargeStartMs) / span
    const show = progress > 0 && this.elapsedMs < impactMs
    this.hoaThe.setVisible(show)
    if (show) {
      const frame = Math.min(HOA_THE_PREVIEW_ASSET.lastFrame,
        Math.floor(progress * (HOA_THE_PREVIEW_ASSET.lastFrame + 1)))
      this.hoaThe.setFrame(`frame_${frame}`)
    }
  }

  updateAura(deltaMs: number): void {
    if (!this.tamMuoiActive || !this.actor.visible || !Number.isFinite(deltaMs) || deltaMs < 0) return
    this.auraElapsedMs = (this.auraElapsedMs + deltaMs) % 1200
    const frame = `frame_${Math.floor(this.auraElapsedMs / 1200 * 36)}`
    for (const aura of [this.auraBack, this.auraFront]) {
      aura.setFrame(frame)
      aura.setPosition(this.actor.x, this.actor.y).setScale(this.actor.scaleX, this.actor.scaleY)
      aura.setVisible(true)
    }
  }

  update(deltaMs: number): void {
    if (!this.cast || this.phase === 'complete' || !Number.isFinite(deltaMs) || deltaMs < 0) return
    let remaining = deltaMs
    if (!this.resolved && this.elapsedMs + remaining >= impactMs) {
      const toImpact = impactMs - this.elapsedMs
      this.presenter.update(toImpact)
      this.elapsedMs = impactMs
      remaining -= toImpact
      this.presenter.resolve(this.receipt(this.cast))
      this.resolved = true
    }
    this.presenter.update(remaining)
    this.elapsedMs += remaining
    this.updateHoaThe()
    // Drive the caster from the same preview clock as the VFX (including 0.25x).
    const frameIndex = Math.min((castClip.frameSequence?.length ?? castClip.lastFrame - castClip.firstFrame + 1) - 1,
      Math.floor(this.elapsedMs * castClip.frameRate / 1000))
    this.actor.setFrame(frameName(castClip.frameSequence?.[frameIndex] ?? castClip.firstFrame + frameIndex))
    const timing = hoaCauTiming(impactMs)
    this.phase = this.elapsedMs < timing.portalStartMs ? 'raise'
      : this.elapsedMs < timing.chargeStartMs ? 'portal'
      : this.elapsedMs < timing.releaseMs ? 'charge'
        : this.elapsedMs < impactMs ? 'projectile'
          : this.elapsedMs < impactMs + 900 ? 'impact' : 'complete'
  }

  snapshot() {
    return { phase: this.phase, elapsedMs: this.elapsedMs,
      tamMuoiActive: this.tamMuoiActive, auraFrame: Math.floor(this.auraElapsedMs / 1200 * 36),
      ...hoaCauTiming(impactMs) }
  }

  cancel(): void {
    this.presenter.cancel()
    this.actor.stop().setVisible(false)
    this.auraBack.setVisible(false)
    this.auraFront.setVisible(false)
    this.hoaThe.setVisible(false)
    this.cast = undefined
    this.phase = 'idle'
  }

  destroy(): void {
    this.cancel()
    this.actor.destroy()
    this.auraBack.destroy()
    this.auraFront.destroy()
    this.hoaThe.destroy()
  }

  private receipt(cast: SkillCastPresentation): SkillPresentationResolved {
    return { ref: cast.ref, sealed: true, groups: [{
      groupId: 'primary', role: 'primary', resolvedSkillId: 'hoa_cau_thuat',
      presetId: 'hoa_cau_comet', source, actualTargets: [target],
      footprint: { kind: 'entity-targets', entityIds: [target.entityId] },
      outcomes: [{ kind: 'hit', outcomeId: 'lab-hit', target, hitOrdinal: 0,
        landed: this.landed, crit: false, hpDamage: this.landed ? 1 : 0, killed: false }],
    }] }
  }
}
