/**
 * The feel layer: hit-stop, shake, flash, particles, damage numbers.
 *
 * Response order matters, and getting it wrong is why juice sometimes reads as
 * lag:
 *   frame 0      register the hit, play the sound, spawn the spark, flash white
 *   frames 0..N  hit-stop on the TARGET (never the player on their own hit)
 *   after that   knockback, then screen shake
 *   then         damage number rises, health bar begins its delayed drain
 *
 * Shake keeps the trauma model rather than using Phaser's raw duration+intensity
 * directly: offset scales with trauma^2, so small shakes stay subtle and big ones
 * land hard, and simultaneous events take the MAX, never the sum.
 *
 * Global hit-stop pauses the Arcade world, which freezes combat while tweens,
 * particles and the HUD keep running — exactly the split the spec asks for.
 */

import Phaser from 'phaser'

import { COLORS, DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, TAU } from '../core/layout'
import { settings } from '../core/settings'
import { TEX } from './textures'

/** Maximum shake offset as a fraction of the viewport (12px at 480 wide). */
const SHAKE_SCALE = 0.026
const PARTICLE_CAP_MOBILE = 120
const PARTICLE_CAP_DESKTOP = 250

const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false

export class Juice {
  private readonly scene: Phaser.Scene
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter
  private readonly shards: Phaser.GameObjects.Particles.ParticleEmitter
  private readonly trailEmitter: Phaser.GameObjects.Particles.ParticleEmitter
  private readonly flashRect: Phaser.GameObjects.Rectangle
  private readonly vignette: Phaser.GameObjects.Rectangle
  private readonly numbers: Phaser.GameObjects.Text[] = []

  /** ms of global hit-stop remaining */
  frozen = 0

  private trauma = 0
  private readonly particleCap = coarsePointer ? PARTICLE_CAP_MOBILE : PARTICLE_CAP_DESKTOP

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    const common = {
      emitting: false,
      blendMode: 'ADD' as const,
    }

    this.sparks = scene.add
      .particles(0, 0, TEX.dot, {
        ...common,
        lifespan: 120,
        speed: { min: 90, max: 240 },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 1, end: 0.2 },
      })
      .setDepth(DEPTH.particle)

    this.smoke = scene.add
      .particles(0, 0, TEX.dot, {
        ...common,
        lifespan: { min: 280, max: 620 },
        speed: { min: 40, max: 250 },
        scale: { start: 1.1, end: 0 },
        alpha: { start: 0.95, end: 0 },
      })
      .setDepth(DEPTH.particle)

    this.shards = scene.add
      .particles(0, 0, TEX.shard, {
        ...common,
        lifespan: { min: 260, max: 560 },
        speed: { min: 60, max: 260 },
        rotate: { start: 0, end: 360 },
        scale: { start: 1, end: 0.2 },
        alpha: { start: 1, end: 0 },
      })
      .setDepth(DEPTH.particle)

    this.trailEmitter = scene.add
      .particles(0, 0, TEX.dot, {
        ...common,
        lifespan: 300,
        speedY: { min: 40, max: 90 },
        speedX: { min: -12, max: 12 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.7, end: 0 },
      })
      .setDepth(DEPTH.particle - 1)

    // Own the flash rather than using camera.flash: this gives exact alpha
    // control, and a routine hit must never wash the screen white.
    this.flashRect = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.white)
      .setOrigin(0, 0)
      .setDepth(DEPTH.particle + 5)
      .setAlpha(0)
      .setScrollFactor(0)

    this.vignette = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xff2850)
      .setOrigin(0, 0)
      .setDepth(DEPTH.particle + 4)
      .setAlpha(0)
      .setScrollFactor(0)
  }

  // --- Hit-stop -------------------------------------------------------------

  /** Global hit-stop. Reserved for events about the PLAYER: damage, phase break,
   * boss death. Never for the player's own successful hit. */
  freeze(seconds: number): void {
    const ms = seconds * 1000
    if (ms <= this.frozen) return
    this.frozen = ms
    this.scene.physics.world.isPaused = true
  }

  // --- Shake and flash -------------------------------------------------------

  /** Requests shake. Within a frame the largest request wins; never summed. */
  shake(amount: number): void {
    if (amount > this.trauma) this.trauma = Math.min(1, amount)
  }

  /** Full-screen flash. Reserved for player damage and boss phase breaks. */
  flash(alpha: number, color: number = COLORS.white): void {
    const a = alpha * settings.intensity
    if (a <= 0.01) return
    this.flashRect.setFillStyle(color)
    this.scene.tweens.killTweensOf(this.flashRect)
    this.flashRect.setAlpha(Math.min(0.7, a))
    this.scene.tweens.add({
      targets: this.flashRect,
      alpha: 0,
      duration: 250,
      ease: 'Quad.easeOut',
    })
  }

  /** Low-hull warning pulse. */
  setDanger(on: boolean): void {
    const target = on ? 0.3 * settings.intensity : 0
    this.scene.tweens.killTweensOf(this.vignette)
    if (!on) {
      this.vignette.setAlpha(0)
      return
    }
    this.scene.tweens.add({
      targets: this.vignette,
      alpha: { from: target * 0.5, to: target },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  update(delta: number): void {
    // Release global hit-stop.
    if (this.frozen > 0) {
      this.frozen -= delta
      if (this.frozen <= 0) {
        this.frozen = 0
        this.scene.physics.world.isPaused = false
      }
    }

    // Trauma decay, then apply as a camera offset. Squaring keeps small shakes
    // subtle and makes big ones violent.
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - 1.6 * (delta / 1000))
      const t = this.trauma * this.trauma * settings.intensity
      const cam = this.scene.cameras.main
      if (t > 0.0001) {
        const a = Phaser.Math.FloatBetween(0, TAU)
        const mag = SHAKE_SCALE * GAME_WIDTH * t
        cam.setScroll(Math.cos(a) * mag, Math.sin(a) * mag)
        // Rotational shake hurts readability on small screens — off for touch.
        cam.setRotation(coarsePointer ? 0 : Phaser.Math.FloatBetween(-1, 1) * 0.026 * t)
      } else {
        cam.setScroll(0, 0)
        cam.setRotation(0)
      }
    }
  }

  // --- Particles ------------------------------------------------------------

  private get budget(): number {
    return 0.25 + 0.75 * settings.intensity
  }

  private atCap(): boolean {
    return (
      this.sparks.getAliveParticleCount() +
        this.smoke.getAliveParticleCount() +
        this.shards.getAliveParticleCount() >=
      this.particleCap
    )
  }

  /** Impact spark: a small cone pointing back along the hit. */
  spark(x: number, y: number, angle: number, colour: number, count = 5): void {
    if (this.atCap()) return
    const n = Math.max(1, Math.round(count * this.budget))
    this.sparks.setParticleTint(colour)
    // +/-25 degree cone, back along the incoming shot.
    const deg = Phaser.Math.RadToDeg(angle)
    this.sparks.setEmitterAngle({ min: deg - 25, max: deg + 25 })
    this.sparks.explode(n, x, y)
  }

  explosion(x: number, y: number, size: 'small' | 'medium' | 'large', colour: number): void {
    const spec =
      size === 'small'
        ? { smoke: 10, shard: 4, ring: 24 }
        : size === 'medium'
          ? { smoke: 16, shard: 8, ring: 38 }
          : { smoke: 38, shard: 22, ring: 68 }

    const scale = this.budget
    this.smoke.setParticleTint(colour)
    this.shards.setParticleTint(0xffffff)
    this.smoke.explode(Math.max(2, Math.round(spec.smoke * scale)), x, y)
    this.shards.explode(Math.max(1, Math.round(spec.shard * scale)), x, y)
    this.ring(x, y, spec.ring, colour, size === 'large' ? 500 : 300)

    if (size === 'large') {
      // Staged secondary bursts.
      for (let k = 1; k <= 2; k++) {
        this.scene.time.delayedCall(220 * k, () => {
          const ox = Phaser.Math.Between(-24, 24)
          const oy = Phaser.Math.Between(-24, 24)
          this.smoke.setParticleTint(colour)
          this.smoke.explode(Math.max(2, Math.round(8 * scale)), x + ox, y + oy)
        })
      }
    }
  }

  /** One expanding ring reads the size of a blast instantly. */
  ring(x: number, y: number, radius: number, colour: number, duration: number): void {
    const img = this.scene.add
      .image(x, y, TEX.ring)
      .setDepth(DEPTH.particle)
      .setTint(colour)
      .setScale(0.15)
      .setAlpha(0.9)
    this.scene.tweens.add({
      targets: img,
      scale: radius / 28,
      alpha: 0,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => img.destroy(),
    })
  }

  trail(x: number, y: number, dashing: boolean): void {
    if (this.atCap()) return
    this.trailEmitter.setParticleTint(dashing ? 0xffffff : 0x3ba7c9)
    this.trailEmitter.explode(1, x, y)
  }

  debris(x: number, y: number, count: number): void {
    if (this.atCap()) return
    this.shards.setParticleTint(COLORS.player)
    this.shards.explode(Math.max(1, Math.round(count * this.budget)), x, y)
  }

  // --- Damage numbers -------------------------------------------------------

  /**
   * Only shown where the player needs the information (armoured, turret, boss).
   * Pooled, and never drawn over the boss bar.
   */
  damageNumber(x: number, y: number, value: number, crit: boolean): void {
    // A multishot volley lands several hits on a wide target in the same frame.
    // Spawning one number each turns into an unreadable smear, so a nearby live
    // number absorbs the hit instead and shows the running total.
    for (const existing of this.numbers) {
      if (!existing.active) continue
      if (Math.abs(existing.x - x) < 20 && Math.abs(existing.y - y) < 22) {
        const total = (existing.getData('total') as number) + value
        existing.setData('total', total)
        existing.setText(String(Math.round(total * 10) / 10))
        return
      }
    }

    let text = this.numbers.find((t) => !t.active)
    if (!text) {
      if (this.numbers.length >= 20) return
      text = this.scene.add.text(0, 0, '', { fontFamily: FONT }).setDepth(DEPTH.particle + 1)
      this.numbers.push(text)
    }

    text.setActive(true).setVisible(true)
    text.setData('total', value)
    text.setText(String(Math.round(value * 10) / 10))
    text.setStyle({
      fontFamily: FONT,
      fontSize: crit ? '13px' : '11px',
      color: crit ? '#ffd166' : '#ffffff',
      fontStyle: crit ? 'bold' : 'normal',
    })
    // Random x-offset so stacked hits do not blob into one unreadable smear.
    text.setPosition(x + Phaser.Math.Between(-6, 6), y)
    text.setOrigin(0.5, 0.5)
    text.setAlpha(1)

    this.scene.tweens.add({
      targets: text,
      y: y - 24,
      alpha: { from: 1, to: 0, delay: 300 },
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => text?.setActive(false).setVisible(false),
    })
  }

  /** Clears transient visuals between runs. */
  reset(): void {
    this.frozen = 0
    this.trauma = 0
    this.scene.physics.world.isPaused = false
    this.scene.cameras.main.setScroll(0, 0)
    this.scene.cameras.main.setRotation(0)
    this.flashRect.setAlpha(0)
    this.setDanger(false)
    for (const t of this.numbers) t.setActive(false).setVisible(false)
  }
}
