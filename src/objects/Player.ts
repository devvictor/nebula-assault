/**
 * Player ship.
 *
 * Input acts the same frame it is read — no action is ever gated behind an
 * animation. Movement is relative-drag on touch: the ship keeps the offset it had
 * when the finger went down, so a thumb never covers the ship and a tap never
 * teleports it.
 */

import Phaser from 'phaser'

import { DEPTH, GAME_HEIGHT, GAME_WIDTH } from '../core/layout'
import { settings } from '../core/settings'
import { synth } from '../core/synth'
import { BALANCE } from '../data/balance'
import { baseStats } from '../data/upgrades'
import type { PlayerStats } from '../data/types'
import { TEX } from '../systems/textures'
import type { GameScene } from '../scenes/GameScene'

/** Side-shot angles by pair index, in radians from straight up. */
const SIDE_ANGLES = [0.19, 0.38]
const DASH_BUFFER = 120

export class Player extends Phaser.Physics.Arcade.Sprite {
  stats: PlayerStats = baseStats()
  hp: number = BALANCE.player.maxHp
  /** ms of invulnerability remaining */
  invuln = 0
  alive = true

  private fireT = 0
  private dashLeft = 0
  private dashCd = 0
  private dashVec = new Phaser.Math.Vector2(0, -1)
  /** timestamp of the last dash request, for input buffering */
  private dashRequestedAt = -Infinity
  private grabX = 0
  private grabY = 0
  private blink = 0
  private trailT = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEX.player)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.setDepth(DEPTH.player)

    const r = BALANCE.player.radius
    this.setCircle(r, this.width / 2 - r, this.height / 2 - r)
  }

  get gs(): GameScene {
    return this.scene as GameScene
  }

  reset(): void {
    this.stats = baseStats()
    this.hp = this.stats.maxHp
    this.invuln = 0
    this.alive = true
    this.fireT = 0
    this.dashLeft = 0
    this.dashCd = 0
    this.dashRequestedAt = -Infinity
    this.blink = 0
    this.setPosition(GAME_WIDTH / 2, GAME_HEIGHT * 0.78)
    this.setActive(true)
    this.setVisible(true)
    this.setAlpha(1)
    this.setScale(1)
    const body = this.body as Phaser.Physics.Arcade.Body | null
    body?.setVelocity(0, 0)
    body?.setEnable(true)
  }

  /** Input buffering: a dash press still counts 120ms later. */
  requestDash(now: number): void {
    this.dashRequestedAt = now
  }

  private consumeDash(now: number): boolean {
    if (now - this.dashRequestedAt <= DASH_BUFFER) {
      this.dashRequestedAt = -Infinity
      return true
    }
    return false
  }

  get dashing(): boolean {
    return this.dashLeft > 0
  }

  get dashCooldownFraction(): number {
    const total = BALANCE.player.dash.cooldown * 1000 * (this.stats.dashInvuln ? 1.4 : 1)
    return this.dashCd <= 0 ? 1 : 1 - this.dashCd / total
  }

  /** Called by GameScene each frame with the resolved input intent. */
  drive(
    intent: {
      pointerActive: boolean
      pointerJustPressed: boolean
      pointerX: number
      pointerY: number
      moveX: number
      moveY: number
      wantsFire: boolean
    },
    time: number,
    delta: number
  ): void {
    if (!this.alive) return

    const body = this.body as Phaser.Physics.Arcade.Body | null
    if (!body) return

    const bal = BALANCE.player
    const st = this.stats
    const dt = delta / 1000

    if (this.dashCd > 0) this.dashCd -= delta
    if (this.dashLeft > 0) this.dashLeft -= delta

    // --- Dash --------------------------------------------------------------
    if (this.consumeDash(time) && this.dashCd <= 0 && this.dashLeft <= 0) {
      let dx = intent.moveX
      let dy = intent.moveY
      if (dx === 0 && dy === 0) {
        // No direction held: dash the way the ship is already travelling, or
        // forward if it is still.
        if (body.velocity.length() > 20) {
          dx = body.velocity.x
          dy = body.velocity.y
        } else {
          dx = 0
          dy = -1
        }
      }
      this.dashVec.set(dx, dy).normalize()
      this.dashLeft = bal.dash.duration * 1000
      this.dashCd = bal.dash.cooldown * 1000 * (st.dashInvuln ? 1.4 : 1)
      if (st.dashInvuln) this.invuln = Math.max(this.invuln, bal.dash.duration * 1000)
      synth.dash()
      this.gs.juice.debris(this.x, this.y, 4)
    }

    // --- Movement ----------------------------------------------------------
    if (this.dashing) {
      const s = st.speed * bal.dash.speedMul
      body.velocity.set(this.dashVec.x * s, this.dashVec.y * s)
    } else if (intent.pointerActive) {
      if (intent.pointerJustPressed) {
        // Relative drag: remember the finger-to-ship offset.
        this.grabX = this.x - intent.pointerX
        this.grabY = this.y - intent.pointerY
      }
      const tx = intent.pointerX + this.grabX
      const ty = intent.pointerY + this.grabY
      // Frame-rate independent approach toward the target.
      const k = 1 - Math.exp(-bal.touchFollowRate * dt)
      const nx = this.x + (tx - this.x) * k
      const ny = this.y + (ty - this.y) * k
      body.velocity.set((nx - this.x) / dt, (ny - this.y) / dt)
    } else {
      const v = new Phaser.Math.Vector2(intent.moveX, intent.moveY)
      if (v.lengthSq() > 0) v.normalize().scale(st.speed)
      body.velocity.set(v.x, v.y)
    }

    // --- Firing ------------------------------------------------------------
    if (this.fireT > 0) this.fireT -= delta
    if (intent.wantsFire && this.fireT <= 0) {
      this.fireVolley()
      this.fireT = st.fireInterval * 1000
    }

    // --- Timers and visuals -------------------------------------------------
    if (this.invuln > 0) {
      this.invuln -= delta
      // 12Hz blink while invulnerable.
      this.blink += delta / (1000 / 12)
      this.setAlpha(Math.floor(this.blink) % 2 === 1 ? 0.25 : 1)
    } else {
      this.blink = 0
      this.setAlpha(1)
    }

    this.trailT -= delta
    if (this.trailT <= 0) {
      this.trailT = settings.intensity > 0.5 ? 50 : 100
      this.gs.juice.trail(this.x, this.y + BALANCE.player.drawRadius * 0.7, this.dashing)
    }
  }

  /** Clamped to the field and clear of the safe-area insets. */
  clampToField(insetTop: number, insetBottom: number, insetLeft: number, insetRight: number): void {
    const m = BALANCE.player.drawRadius
    this.x = Phaser.Math.Clamp(this.x, m + insetLeft, GAME_WIDTH - m - insetRight)
    this.y = Phaser.Math.Clamp(this.y, m + insetTop + 28, GAME_HEIGHT - m - insetBottom - 8)
  }

  private fireVolley(): void {
    const st = this.stats
    const speed = st.bulletSpeed
    const nose = this.y - BALANCE.player.drawRadius
    const texture = st.pierce ? TEX.bulletPlayerPierce : TEX.bulletPlayer

    const shoot = (vx: number, vy: number, damage: number) => {
      this.gs.firePlayerBullet({
        x: this.x,
        y: nose,
        vx,
        vy,
        damage,
        texture,
        pierce: st.pierce,
        homing: st.homing,
      })
    }

    // Centre shot.
    shoot(0, -speed, st.damage)

    // Symmetric side pairs, capped at 2 pairs (5 projectiles per volley).
    for (let i = 0; i < st.sidePairs; i++) {
      const a = SIDE_ANGLES[i]
      shoot(Math.sin(a) * speed, -Math.cos(a) * speed, st.damage)
      shoot(-Math.sin(a) * speed, -Math.cos(a) * speed, st.damage)
    }

    // Rear gun at half damage — the trade is that you must watch behind you.
    if (st.rearShot) {
      this.gs.firePlayerBullet({
        x: this.x,
        y: this.y + BALANCE.player.drawRadius,
        vx: 0,
        vy: speed * 0.8,
        damage: st.damage * 0.5,
        texture,
        pierce: st.pierce,
        homing: st.homing,
      })
    }

    // Muzzle response: a scale punch and a sound. No shake — the flash carries it.
    this.scene.tweens.add({
      targets: this,
      scale: 1.06,
      duration: 50,
      yoyo: true,
      ease: 'Quad.easeOut',
    })
    synth.shoot()
  }
}
