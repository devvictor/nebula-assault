/**
 * Pickups. Repair restores hull; bounty pays score.
 *
 * They drift down, get pulled in by the Tractor Coil upgrade, and blink out over
 * their last second so one never vanishes without warning.
 */

import Phaser from 'phaser'

import { DEPTH } from '../core/layout'
import { BALANCE } from '../data/balance'
import { TEX } from '../systems/textures'

export type PickupKind = 'repair' | 'bounty'

export class Pickup extends Phaser.Physics.Arcade.Sprite {
  kind: PickupKind = 'bounty'
  private life = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEX.bounty)
    this.setDepth(DEPTH.pickup)
  }

  drop(kind: PickupKind, x: number, y: number): void {
    this.kind = kind
    this.enableBody(true, x, y, true, true)
    this.setTexture(kind === 'repair' ? TEX.repair : TEX.bounty)
    this.setAlpha(1)
    this.setScale(1)
    this.life = BALANCE.pickups.lifetime * 1000
    this.setCircle(9, this.width / 2 - 9, this.height / 2 - 9)
    const body = this.body as Phaser.Physics.Arcade.Body | null
    body?.setVelocity(Phaser.Math.Between(-20, 20), BALANCE.pickups.fallSpeed)

    // Gentle pulse so it reads as collectable.
    this.scene.tweens.add({
      targets: this,
      scale: 1.12,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  kill(): void {
    this.scene.tweens.killTweensOf(this)
    this.disableBody(true, true)
  }

  /** Tractor pull toward the player, easing in as it closes. */
  pullToward(px: number, py: number, radius: number, delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null
    if (!body) return
    const d = Phaser.Math.Distance.Between(this.x, this.y, px, py)
    if (d > radius || d < 0.001) {
      body.velocity.y = Phaser.Math.Linear(body.velocity.y, BALANCE.pickups.fallSpeed, 0.05)
      body.velocity.x = Phaser.Math.Linear(body.velocity.x, 0, 0.05)
      return
    }
    const pull = (520 * (1 - d / radius) + 120) * (delta / 1000)
    body.velocity.x += ((px - this.x) / d) * pull
    body.velocity.y += ((py - this.y) / d) * pull
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta)
    this.life -= delta
    if (this.life <= 0 || this.y > this.scene.scale.height + 20) {
      this.kill()
      return
    }
    // Blink out the last second.
    if (this.life < 1200) {
      this.setAlpha(0.35 + 0.65 * Math.abs(Math.sin(this.life / 55)))
    }
  }
}
