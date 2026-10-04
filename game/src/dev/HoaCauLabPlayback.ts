import Phaser from 'phaser'
import type { ActorAnchorFact, SkillCastPresentation, SkillPresentationResolved } from '@/core/battle/turn/SkillPresentationFacts'
import { animatedArtFormFor } from '@/presentation/art/CombatPresentationCatalogue'
import { clipImpactMs } from '@/presentation/art/CombatEntityPresentation'
import { HOA_CAU_PHOENIX_PREVIEW_ASSET, HOA_CAU_TRIPLE_CIRCLE_PREVIEW_ASSET, HOA_CAU_VFX_ASSETS, TAM_MUOI_AURA_FRONT_PREVIEW_ASSET, TAM_MUOI_AURA_PREVIEW_ASSET } from '@/game/support/HoaCauVfxAssets'
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
    for (let stack = 0; stack <= 5; stack++)
      scene.load.svg(`phap-the-${stack}`, `/assets/vfx/hoa-cau-thuat/phap-the/phap-the-${stack}.svg`)
  }

  private readonly actor: Phaser.GameObjects.Sprite
  private readonly auraBack: Phaser.GameObjects.Sprite
  private readonly auraFront: Phaser.GameObjects.Sprite
  private readonly phapTheGlyph: Phaser.GameObjects.Image
  private readonly phapTheGlow: Phaser.GameObjects.Image
  private readonly phapTheFlame: Phaser.GameObjects.Graphics
  private readonly presenter: HoaCauFireballPresentation
  private elapsedMs = 0
  private serial = 0
  private landed = true
  private resolved = false
  private phase: Phase = 'idle'
  private tamMuoiActive = false
  private auraElapsedMs = 0
  private phapTheStacks = 0
  private awardStackOnRelease = false
  private phapTheParticleMs = 0
  private readonly phapTheParticleCount = 18
  private readonly phapTheFlameTongueCount = 7
  private readonly phapTheFlameMaxHeight = 17

  constructor(private readonly scene: Phaser.Scene) {
    this.actor = scene.add.sprite(210, 325, castClip.sheetKey, frameName(castClip.firstFrame))
      .setOrigin(0.5, 1).setScale(0.95).setDepth(590).setVisible(false)
    this.auraBack = scene.add.sprite(210, 325, TAM_MUOI_AURA_PREVIEW_ASSET.key, 'frame_0')
      .setOrigin(0.5, 1).setScale(0.95).setDepth(589.5)
      .setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
    this.auraFront = scene.add.sprite(210, 325, TAM_MUOI_AURA_FRONT_PREVIEW_ASSET.key, 'frame_0')
      .setOrigin(0.5, 1).setScale(0.95).setDepth(590.5)
      .setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
    this.phapTheFlame = scene.add.graphics().setDepth(609.5).setVisible(false)
    this.phapTheGlow = scene.add.image(235, 85, 'phap-the-5')
      .setScale(0.23).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(609.75).setVisible(false)
    this.phapTheGlyph = scene.add.image(235, 85, 'phap-the-0')
      .setScale(0.21).setDepth(610).setVisible(false)
    this.presenter = new HoaCauFireballPresentation({
      anchor: fact => fact.entityId === source.entityId
        ? hoaCauHandAnchor(this.actor) : { x: 750, y: 205 },
      depth: () => 600,
      createSprite: (key, frame) => scene.add.sprite(0, 0, key, frame),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      artVariant: 'phoenix_projectile',
    })
  }

  play(landed = true, awardStackOnRelease = false): void {
    this.presenter.cancel()
    this.elapsedMs = 0
    this.resolved = false
    this.landed = landed
    this.phase = 'raise'
    this.awardStackOnRelease = awardStackOnRelease
    this.actor.setVisible(true).setFrame(frameName(castClip.firstFrame))
    this.paintPhapTheGlyph()
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

  setPhapTheStacks(stacks: number): void {
    this.phapTheStacks = Number.isFinite(stacks) ? Math.max(0, Math.min(5, Math.trunc(stacks))) : 0
    this.paintPhapTheGlyph()
  }

  private paintPhapTheGlyph(): void {
    this.phapTheGlyph.setTexture(`phap-the-${this.phapTheStacks}`)
      .setPosition(this.actor.x + 25, this.actor.y - 240)
      .setVisible(this.actor.visible)
    this.phapTheFlame.setPosition(this.phapTheGlyph.x, this.phapTheGlyph.y)
      .setVisible(this.actor.visible && this.phapTheStacks === 5)
    this.phapTheGlow.setPosition(this.phapTheGlyph.x, this.phapTheGlyph.y)
      .setVisible(this.phapTheFlame.visible)
    if (this.phapTheFlame.visible) this.paintPhapTheParticles()
  }

  private paintPhapTheParticles(): void {
    const graphics = this.phapTheFlame
    graphics.clear()
    const time = this.phapTheParticleMs
    // Birth points trace the visible brushwork instead of forming a crown.
    const flameRoots = [
      [-14, -4, 10], [-11, 11, 14], [-4, -10, 12],
      [2, 5, 14], [11, -5, 11], [14, 11, 13], [1, 16, 12],
    ] as const
    const tongue = (x: number, y: number, width: number, height: number, lean: number, color: number, alpha: number) => {
      const points = [
        [x - width * 0.5, y], [x - width * 0.62, y - height * 0.28],
        [x - width * 0.25 + lean * 0.2, y - height * 0.61],
        [x + lean, y - height],
        [x + width * 0.2 + lean * 0.4, y - height * 0.62],
        [x + width * 0.57, y - height * 0.27], [x + width * 0.5, y],
      ].map(([px, py]) => new Phaser.Math.Vector2(px!, py!))
      graphics.fillStyle(color, alpha).fillPoints(points, true)
    }
    for (let index = 0; index < this.phapTheFlameTongueCount; index++) {
      const [x, baseY, baseHeight] = flameRoots[index]!
      const flicker = Math.sin(time * 0.008 + index * 2.3)
      const height = baseHeight + flicker * 3
      const lean = Math.sin(time * 0.004 + index * 1.7) * 3
      tongue(x, baseY, 8, height, lean, 0xc62b10, 0.46)
      tongue(x, baseY, 5.5, height * 0.76, lean * 0.8, 0xff6d19, 0.62)
      tongue(x, baseY, 2.6, height * 0.46, lean * 0.5, 0xffd56c, 0.46)
    }
    for (let index = 0; index < this.phapTheParticleCount; index++) {
      const rise = (index * 0.618034 + time * 0.00048) % 1
      const x = (index % 7 - 3) * 7 + Math.sin(time * 0.003 + index * 1.6) * 4
      const y = 15 - rise * 34
      const opacity = (1 - rise) * 0.56
      graphics.fillStyle(index % 4 === 0 ? 0xffe6a4 : 0xff9b37, opacity)
        .fillCircle(x, y, index % 3 === 0 ? 1.5 : 1)
    }
  }

  setTamMuoiActive(active: boolean): void {
    this.tamMuoiActive = active
    if (!active) this.auraElapsedMs = 0
    this.auraBack.setVisible(active && this.actor.visible)
    this.auraFront.setVisible(active && this.actor.visible)
  }

  updateAura(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) return
    if (this.phapTheFlame.visible) {
      this.phapTheParticleMs += deltaMs
      this.paintPhapTheParticles()
      this.phapTheGlow.setAlpha(0.21 + 0.07 * Math.sin(this.phapTheParticleMs * 0.006))
    }
    if (!this.tamMuoiActive || !this.actor.visible) return
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
    const releaseMs = hoaCauTiming(impactMs).releaseMs
    if (this.awardStackOnRelease && this.elapsedMs < releaseMs && this.elapsedMs + deltaMs >= releaseMs) {
      this.setPhapTheStacks(this.phapTheStacks + 1)
      this.awardStackOnRelease = false
    }
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
      phapTheStacks: this.phapTheStacks, phapTheGlyphVisible: this.phapTheGlyph.visible,
      phapTheLitStrokes: Math.min(this.phapTheStacks, 4), phapTheFullGlow: this.phapTheStacks === 5,
      phapTheFlameVisible: this.phapTheFlame.visible, phapTheGlyphScale: this.phapTheGlyph.scaleX,
      phapTheParticleCount: this.phapTheFlame.visible ? this.phapTheParticleCount : 0,
      phapTheFlameTongueCount: this.phapTheFlame.visible ? this.phapTheFlameTongueCount : 0,
      phapTheGlowVisible: this.phapTheGlow.visible, phapTheFlameMaxHeight: this.phapTheFlameMaxHeight,
      phapTheGlyphOffsetX: this.phapTheGlyph.x - this.actor.x,
      phapTheGlyphOffsetY: this.phapTheGlyph.y - this.actor.y,
      ...hoaCauTiming(impactMs) }
  }

  cancel(): void {
    this.presenter.cancel()
    this.actor.stop().setVisible(false)
    this.auraBack.setVisible(false)
    this.auraFront.setVisible(false)
    this.phapTheGlyph.setVisible(false)
    this.phapTheFlame.setVisible(false)
    this.phapTheGlow.setVisible(false)
    this.cast = undefined
    this.phase = 'idle'
  }

  destroy(): void {
    this.cancel()
    this.actor.destroy()
    this.auraBack.destroy()
    this.auraFront.destroy()
    this.phapTheGlyph.destroy()
    this.phapTheFlame.destroy()
    this.phapTheGlow.destroy()
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
