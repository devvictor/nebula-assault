/**
 * Enemy: an Arcade physics sprite, pooled by its Group.
 *
 * Fairness rules enforced here:
 *  - an enemy must be fully visible for 0.3s before it may fire an AIMED shot
 *  - at most N enemies telegraph aimed fire at once (the aimed-shooter cap)
 *  - every attack has a readable wind-up, and the aim is LOCKED when it starts so
 *    the telegraph tells the truth about where the shot is going
 */

import Phaser from 'phaser'

import { DEPTH, GAME_HEIGHT, GAME_WIDTH, TAU } from '../core/layout'
import { BALANCE } from '../data/balance'
import {
  ENEMIES,
  showsHealthBar,
  type EnemyDef,
  type EnemyId,
  type MovementId,
  type PatternId,
} from '../data/enemies'
import { applyMovement, HOLD_MAX_Y } from '../systems/movement'
import { firePattern } from '../systems/patterns'
import { enemyTexture } from '../systems/textures'
import type { GameScene } from '../scenes/GameScene'
import { BAR, HealthBar } from './HealthBar'

/** An enemy must be on screen this long before an aimed shot is allowed. */
const AIM_GRACE = 300

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  def: EnemyDef = ENEMIES.drone
  hp: number = 1
  maxHp: number = 1
  movement: MovementId = 'straightDown'

  /** age in ms */
  age = 0
  /** per-movement scratch */
  seed = 0
  homeX = 0
  targetY = 0
  /** named to avoid colliding with Phaser's GameObject.state */
  moveState = 0
  stateT = 0

  /** ms until the next volley */
  fireT = 0
  /** >0 while telegraphing an attack */
  windup = 0
  windupMax = 0
  aimAngle = Math.PI / 2
  patternRot = 0
  volley = 0
  /** the pattern the next volley will use — the boss varies this per phase */
  pattern: PatternId = 'aimed'

  /** ms fully on screen */
  visibleFor = 0
  /** per-entity hit-stop, ms remaining */
  frozen = 0

  isBoss = false
  /** invulnerable beat, e.g. between boss phases */
  invuln = 0
  dying = false

  bar?: HealthBar

  private flashLeft = 0
  private frozenVx = 0
  private frozenVy = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, enemyTexture('drone'))
    this.setDepth(DEPTH.enemy)
  }

  get gs(): GameScene {
    return this.scene as GameScene
  }

  spawn(id: EnemyId, x: number, y: number, movement?: MovementId): this {
    const def = ENEMIES[id]
    this.def = def
    this.isBoss = id === 'boss'

    this.enableBody(true, x, y, true, true)
    this.setTexture(enemyTexture(id))
    this.setScale(1)
    this.clearTint()
    this.setAlpha(1)
    this.setRotation(0)

    // Hitbox smaller than the sprite: near-misses should feel fair.
    this.setCircle(def.radius, this.width / 2 - def.radius, this.height / 2 - def.radius)

    this.hp = def.hp
    this.maxHp = def.hp
    this.movement = movement ?? def.defaultMovement
    this.age = 0
    this.seed = Phaser.Math.FloatBetween(0, TAU)
    this.homeX = x
    this.targetY = Phaser.Math.Clamp(
      Phaser.Math.FloatBetween(0.16, 0.42) * GAME_HEIGHT,
      60,
      HOLD_MAX_Y
    )
    this.moveState = 0
    this.stateT = 0
    this.fireT = def.fire ? def.fire.interval * 1000 * Phaser.Math.FloatBetween(0.5, 1) : 0
    this.windup = 0
    this.windupMax = 0
    this.aimAngle = Math.PI / 2
    this.patternRot = 0
    this.volley = 0
    this.pattern = def.fire?.pattern ?? 'aimed'
    this.visibleFor = 0
    this.frozen = 0
    this.invuln = 0
    this.dying = false
    this.flashLeft = 0

    this.attachBar()
    return this
  }

  private attachBar(): void {
    // A bar is pointless on something that dies to one base-weapon shot, and a bar
    // that appears and vanishes in 100ms is visual noise.
    const wants = showsHealthBar(this.def) && !this.isBoss
    if (!wants) {
      this.bar?.destroy()
      this.bar = undefined
      return
    }
    if (!this.bar) {
      const w = Phaser.Math.Clamp(this.def.drawRadius * 2, BAR.alien.minWidth, BAR.alien.maxWidth)
      this.bar = new HealthBar(this.scene, this.x, this.y, w, 'alien')
      this.bar.setDepth(DEPTH.alienBar)
    }
    this.bar.setAlpha(0)
    this.bar.setVisible(true)
  }

  /** White hit-flash. Two frames — any longer and it stops reading as an impact. */
  flash(): void {
    this.flashLeft = (2 / 60) * 1000
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
    // Scale punch with follow-through: overshoot, then settle.
    this.scene.tweens.add({
      targets: this,
      scale: 1.12,
      duration: 40,
      yoyo: true,
      ease: 'Quad.easeOut',
    })
  }

  /** Freezes this entity only. The player is never frozen on their own hit. */
  freeze(ms: number): void {
    if (ms <= this.frozen) return
    const body = this.body as Phaser.Physics.Arcade.Body | null
    if (body && this.frozen <= 0) {
      this.frozenVx = body.velocity.x
      this.frozenVy = body.velocity.y
    }
    this.frozen = ms
  }

  kill(): void {
    this.dying = true
    this.bar?.setVisible(false)
    this.disableBody(true, true)
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta)

    if (this.flashLeft > 0) {
      this.flashLeft -= delta
      if (this.flashLeft <= 0) {
        this.clearTint()
        this.setTintMode(Phaser.TintModes.MULTIPLY)
      }
    }

    // Hit-stop freezes the attacker and the target — but never the bars, the
    // particles or the HUD.
    if (this.frozen > 0) {
      this.frozen -= delta
      const body = this.body as Phaser.Physics.Arcade.Body | null
      if (body) {
        if (this.frozen > 0) body.velocity.set(0, 0)
        else body.velocity.set(this.frozenVx, this.frozenVy)
      }
      this.tickBar(delta)
      return
    }

    this.age += delta
    if (this.invuln > 0) this.invuln -= delta

    const onScreen = this.y > this.def.drawRadius && this.y < GAME_HEIGHT - 20
    if (onScreen) this.visibleFor += delta

    const player = this.gs.ship
    if (this.isBoss) {
      this.updateBoss(delta)
    } else {
      applyMovement(this, player.x, player.y, delta)
      this.tryFire(delta)
    }

    this.tickBar(delta)

    // Off-field cleanup. Leaving costs the player nothing — deliberately, so a
    // missed kill is not a punishment.
    if (!this.isBoss) {
      if (this.y > GAME_HEIGHT + 60 || this.x < -80 || this.x > GAME_WIDTH + 80) {
        this.kill()
      }
    }
  }

  /** Overridden by Boss. */
  protected updateBoss(_delta: number): void {}

  private tickBar(delta: number): void {
    const bar = this.bar
    if (!bar) return
    // Floats just above the sprite, clear of it.
    bar.setPosition(
      Math.round(this.x - bar.barWidth / 2),
      Math.round(this.y - this.def.drawRadius - BAR.alien.offset - BAR.alien.height)
    )
    bar.tick(this.hp / this.maxHp, delta)
  }

  private tryFire(delta: number): void {
    const fire = this.def.fire
    if (!fire) return

    // Wind-up in progress: the aim is already locked, so the telegraph is honest.
    if (this.windup > 0) {
      this.windup -= delta
      if (this.windup <= 0) {
        firePattern(this, this.pattern, this.gs.hostileSpawner)
        this.fireT = fire.interval * 1000
      }
      return
    }

    this.fireT -= delta
    if (this.fireT > 0) return

    // No off-screen aimed fire, and none before the player has had time to see
    // this enemy at all.
    if (fire.aimed && this.visibleFor < AIM_GRACE) {
      this.fireT = 150
      return
    }

    // Aimed-shooter cap: too many at once is unfair, not hard.
    if (fire.aimed && this.gs.countAiming() >= BALANCE.caps.aimedShooters) {
      this.fireT = 300
      return
    }

    this.lockAim()
    this.windup = fire.windup * 1000
    this.windupMax = this.windup
  }

  /**
   * Locks the aim at the START of the wind-up, with a small lead. Locking is what
   * makes the telegraph honest: the tell shows where the shot is actually going,
   * so dodging is a decision rather than a guess.
   */
  protected lockAim(): void {
    const lead = 0.18
    const p = this.gs.ship
    const body = p.body as Phaser.Physics.Arcade.Body | null
    const vx = body?.velocity.x ?? 0
    const vy = body?.velocity.y ?? 0
    this.aimAngle = Math.atan2(p.y + vy * lead - this.y, p.x + vx * lead - this.x)
  }

  /** 0..1 charge progress while telegraphing, for the tell and the squash. */
  get charge(): number {
    if (this.windupMax <= 0 || this.windup <= 0) return 0
    return 1 - this.windup / this.windupMax
  }
}
