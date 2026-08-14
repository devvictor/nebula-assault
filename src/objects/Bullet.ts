/**
 * Bullets, pooled by Arcade physics Groups.
 *
 * Group.get() recycles a dead member instead of allocating, so nothing is created
 * during play — GC pauses read as stutter on a phone.
 */

import Phaser from 'phaser'

import { DEPTH } from '../core/layout'
import { TEX } from '../systems/textures'

export class Bullet extends Phaser.Physics.Arcade.Sprite {
  /** weak homing strength in radians/sec; 0 = straight */
  homing = 0
  damage = 1
  pierce = false
  /** stops a piercing shot re-hitting the same target every frame */
  lastHit: Phaser.GameObjects.GameObject | null = null
  /** true once this bullet has awarded a graze, so it only pays out once */
  grazed = false

  private life = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEX.bulletPlayer)
    this.setDepth(DEPTH.bullet)
  }

  fire(opts: {
    x: number
    y: number
    vx: number
    vy: number
    damage: number
    radius: number
    texture: string
    homing?: number
    pierce?: boolean
    rotateToVelocity?: boolean
  }): void {
    this.enableBody(true, opts.x, opts.y, true, true)
    this.setTexture(opts.texture)
    this.setVelocity(opts.vx, opts.vy)
    this.damage = opts.damage
    this.homing = opts.homing ?? 0
    this.pierce = opts.pierce ?? false
    this.lastHit = null
    this.grazed = false
    this.life = 4000

    // A circular hitbox that is smaller than the sprite keeps near-misses fair.
    this.setCircle(opts.radius, this.width / 2 - opts.radius, this.height / 2 - opts.radius)

    if (opts.rotateToVelocity !== false) {
      this.setRotation(Math.atan2(opts.vy, opts.vx))
    }
  }

  kill(): void {
    this.disableBody(true, true)
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta)

    this.life -= delta
    if (this.life <= 0) {
      this.kill()
      return
    }

    const b = this.body as Phaser.Physics.Arcade.Body | null
    if (!b) return

    // Cull off-field. Bounds are checked here rather than via world bounds so a
    // bullet leaving the screen costs nothing.
    if (this.y < -30 || this.y > this.scene.scale.height + 30 || this.x < -30 || this.x > this.scene.scale.width + 30) {
      this.kill()
    }
  }

  /** Steers toward a target — Seeker Tips. Called by the scene, which owns the
   * enemy list. */
  steerToward(tx: number, ty: number, deltaMs: number): void {
    const b = this.body as Phaser.Physics.Arcade.Body | null
    if (!b || this.homing <= 0) return

    const want = Math.atan2(ty - this.y, tx - this.x)
    const current = Math.atan2(b.velocity.y, b.velocity.x)
    const maxTurn = this.homing * (deltaMs / 1000)
    const next = current + Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - current), -maxTurn, maxTurn)

    const speed = b.velocity.length()
    b.velocity.setToPolar(next, speed)
    this.setRotation(next)
  }
}
