/**
 * THE shared health-bar component. Boss bars and alien bars are both instances of
 * this one class, so their behaviour cannot drift apart.
 *
 * Key behaviour: a delayed "ghost" layer lags the real fill, so the player SEES
 * the size of the chunk they just took off. That is what makes a big hit look big.
 *
 * Built from crisp Rectangles with a 1px frame — rounded, gradient-heavy bars read
 * as free-to-play. This is an arcade game.
 */

import Phaser from 'phaser'

import { COLORS, FONT } from '../core/layout'

export const BAR = {
  /** the ghost layer waits this long after the last hit before draining */
  ghostDelay: 250,
  /** then drains at this fraction of max per second */
  ghostDrain: 0.4,
  /** damage flash on the bar itself: 2 frames */
  flash: 2 / 60,

  alien: {
    height: 3,
    minWidth: 16,
    maxWidth: 40,
    /** above the sprite's top edge */
    offset: 6,
    fadeIn: 80,
    fadeOut: 200,
    /** ms of no damage before fading out */
    hold: 1500,
  },

  boss: {
    height: 10,
    segmentGap: 2,
    labelSize: 9,
  },
} as const

export type BarVariant = 'alien' | 'boss'

export class HealthBar extends Phaser.GameObjects.Container {
  private readonly track: Phaser.GameObjects.Rectangle
  private readonly ghostBar: Phaser.GameObjects.Rectangle
  private readonly fill: Phaser.GameObjects.Rectangle
  private readonly frame: Phaser.GameObjects.Rectangle
  private label?: Phaser.GameObjects.Text

  private readonly barW: number
  private readonly barH: number
  private readonly variant: BarVariant

  private value = 1
  private ghost = 1
  private ghostDelay = 0
  private flashLeft = 0
  private sinceDamage = 1e9
  private touched = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    variant: BarVariant,
    segments = 1,
    labelText?: string
  ) {
    super(scene, x, y)

    this.variant = variant
    this.barW = width
    this.barH = variant === 'boss' ? BAR.boss.height : BAR.alien.height

    const w = this.barW
    const h = this.barH

    this.frame = scene.add.rectangle(-1, -1, w + 2, h + 2, COLORS.frame).setOrigin(0, 0)
    this.track = scene.add
      .rectangle(0, 0, w, h, variant === 'boss' ? COLORS.bossSpent : COLORS.white, 0.12)
      .setOrigin(0, 0)
    this.ghostBar = scene.add.rectangle(0, 0, w, h, COLORS.white, 0.48).setOrigin(0, 0)
    this.fill = scene.add.rectangle(0, 0, w, h, COLORS.healthy).setOrigin(0, 0)

    this.add([this.frame, this.track, this.ghostBar, this.fill])

    // One segment per boss phase: the player must see how much fight is left AND
    // how far it is to the next phase change.
    if (variant === 'boss' && segments > 1) {
      for (let i = 1; i < segments; i++) {
        const sx = Math.round((w * i) / segments - BAR.boss.segmentGap / 2)
        const divider = scene.add
          .rectangle(sx, -1, BAR.boss.segmentGap, h + 2, COLORS.bg)
          .setOrigin(0, 0)
        this.add(divider)
      }
    }

    if (labelText) {
      this.label = scene.add
        .text(w / 2, -BAR.boss.labelSize - 5, labelText.toUpperCase(), {
          fontFamily: FONT,
          fontSize: `${BAR.boss.labelSize}px`,
          color: '#ffd166',
        })
        .setOrigin(0.5, 0)
      this.add(this.label)
    }

    // Alien bars are hidden at full health: a screen full of always-on bars is
    // unreadable and destroys the arcade look.
    this.setAlpha(variant === 'boss' ? 1 : 0)
    scene.add.existing(this)
  }

  /** Call when the owner takes damage. */
  damage(): void {
    this.flashLeft = BAR.flash * 1000
    this.ghostDelay = BAR.ghostDelay
    this.sinceDamage = 0
    this.touched = true
  }

  /** Advance the bar. `fraction` is the owner's current health fraction. */
  tick(fraction: number, deltaMs: number): void {
    this.value = Phaser.Math.Clamp(fraction, 0, 1)

    if (this.flashLeft > 0) this.flashLeft -= deltaMs
    this.sinceDamage += deltaMs

    // Ghost layer: hold, then chase the real fill at a fixed rate.
    if (this.ghostDelay > 0) {
      this.ghostDelay -= deltaMs
    } else if (this.ghost > this.value) {
      this.ghost = Math.max(this.value, this.ghost - BAR.ghostDrain * (deltaMs / 1000))
    }
    if (this.ghost < this.value) this.ghost = this.value

    this.fill.width = Math.max(0, this.barW * this.value)
    this.ghostBar.width = Math.max(0, this.barW * this.ghost)
    this.ghostBar.setVisible(this.ghost > this.value + 0.001)

    // Fill LENGTH is the primary signal; colour only reinforces it.
    const colour =
      this.flashLeft > 0
        ? COLORS.white
        : this.variant === 'boss'
          ? COLORS.critical
          : this.value > 0.6
            ? COLORS.healthy
            : this.value > 0.25
              ? COLORS.warning
              : COLORS.critical
    this.fill.setFillStyle(colour)

    if (this.variant === 'alien') {
      const wantVisible = this.touched && this.sinceDamage < BAR.alien.hold
      const rate = wantVisible ? deltaMs / BAR.alien.fadeIn : -deltaMs / BAR.alien.fadeOut
      this.setAlpha(Phaser.Math.Clamp(this.alpha + rate, 0, 1))
    }
  }

  /** Flash the whole bar white — used on a boss segment break. */
  flashWhite(): void {
    this.flashLeft = 3 / 60 * 1000
  }

  get faded(): boolean {
    return this.alpha <= 0.01
  }

  /** Named to avoid colliding with Container.width. */
  get barWidth(): number {
    return this.barW
  }
}
