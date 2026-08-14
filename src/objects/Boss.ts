/**
 * The Hivecore: a three-phase conversation, not a health sponge.
 *
 * One bar segment per phase. Each phase must CHANGE the player's optimal
 * behaviour — if the correct play were identical in all three, it would be one
 * long phase with cosmetic changes.
 *
 *   Phase 1 "Arc Barrage" — learn the shape. Walls with a moving gap.
 *   Phase 2 "Siege"       — add a constraint. Rings plus a chaff drip, so the
 *                           player can no longer camp one safe lane.
 *   Phase 3 "Overload"    — tempo. Spirals and aimed spreads, shorter windows.
 *
 * Between volleys the core opens: that is the damage window, and it is what gives
 * the fight a rhythm of patience and aggression instead of constant DPS.
 */

import Phaser from 'phaser'

import { DEPTH, GAME_HEIGHT, GAME_WIDTH } from '../core/layout'
import { BALANCE } from '../data/balance'
import type { PatternId } from '../data/enemies'
import { firePattern } from '../systems/patterns'
import { TEX } from '../systems/textures'
import { Enemy } from './Enemy'

interface BossPhase {
  label: string
  hint: string
  patterns: PatternId[]
  /** ms the core stays open between volleys — the damage window */
  window: number
  /** telegraph length in ms; never below 400 */
  windup: number
  /** horizontal strafe frequency multiplier */
  strafe: number
  /** max chaff alive as adds */
  adds: number
}

export const PHASES: BossPhase[] = [
  {
    label: 'ARC BARRAGE',
    hint: 'Find the gap',
    patterns: ['wallGap'],
    window: 1600,
    windup: 600,
    strafe: 0.9,
    adds: 0,
  },
  {
    label: 'SIEGE',
    hint: 'No safe lane',
    patterns: ['ring', 'wallGap'],
    window: 1200,
    windup: 550,
    strafe: 1.5,
    adds: 4,
  },
  {
    label: 'OVERLOAD',
    hint: 'Out-tempo it',
    patterns: ['spiral', 'spread5', 'spiral'],
    window: 750,
    windup: 400,
    strafe: 2.2,
    adds: 0,
  },
]

/** Damage multiplier while the core is open. */
export const CORE_OPEN_MULT = 1.5

export class Boss extends Enemy {
  phase = 0
  private core?: Phaser.GameObjects.Image
  private addsT = 0

  /** True while the core is open and the boss is taking bonus damage. */
  get coreOpen(): boolean {
    return this.moveState === 0 && this.invuln <= 0 && this.age > BALANCE.boss.entryTime * 1000
  }

  spawnBoss(): this {
    this.spawn('boss', GAME_WIDTH / 2, -80)
    this.targetY = GAME_HEIGHT * 0.2
    this.homeX = GAME_WIDTH / 2
    this.phase = 0
    this.moveState = 0
    this.stateT = PHASES[0].window
    this.volley = 0
    this.addsT = 0
    // Invulnerable while it makes its entrance.
    this.invuln = BALANCE.boss.entryTime * 1000

    if (!this.core) {
      this.core = this.scene.add.image(this.x, this.y, TEX.bossCoreShut)
      this.core.setDepth(DEPTH.enemy + 1)
    }
    this.core.setVisible(true)
    return this
  }

  override kill(): void {
    this.core?.setVisible(false)
    super.kill()
  }

  protected override updateBoss(delta: number): void {
    const phase = PHASES[Phaser.Math.Clamp(this.phase, 0, PHASES.length - 1)]
    const body = this.body as Phaser.Physics.Arcade.Body | null
    if (!body) return

    // --- Entry: descend into position, invulnerable -------------------------
    if (this.age < BALANCE.boss.entryTime * 1000) {
      body.velocity.set(0, Math.max(30, (this.targetY - this.y) * 1.6))
      this.syncCore()
      return
    }

    // --- Phase transition --------------------------------------------------
    const frac = this.hp / this.maxHp
    const wantPhase = frac > 2 / 3 ? 0 : frac > 1 / 3 ? 1 : 2
    if (wantPhase > this.phase) {
      this.enterPhase(wantPhase)
      return
    }

    // --- Transition beat: invulnerable, so the player can reposition --------
    if (this.invuln > 0) {
      body.velocity.x = Phaser.Math.Linear(body.velocity.x, 0, 0.1)
      body.velocity.y = Phaser.Math.Linear(body.velocity.y, 0, 0.1)
      this.syncCore()
      return
    }

    // --- Movement -----------------------------------------------------------
    const t = this.age / 1000
    const speed = this.def.speed
    body.velocity.x = Math.cos(t * phase.strafe) * speed * 1.7
    // Phase 3 also bobs vertically and ranges wider — it may cross the field.
    const bandY = this.phase === 2 ? this.targetY + Math.sin(t * 1.3) * 46 : this.targetY
    body.velocity.y = (bandY - this.y) * 2

    const m = this.def.drawRadius + 4
    this.x = Phaser.Math.Clamp(this.x, m, GAME_WIDTH - m)

    // --- Attack cycle: open window -> telegraph -> volley -------------------
    if (this.moveState === 0) {
      this.stateT -= delta
      if (this.stateT <= 0) {
        this.moveState = 1
        this.pattern = phase.patterns[this.volley % phase.patterns.length]
        this.lockAim()
        this.windup = phase.windup
        this.windupMax = phase.windup
      }
    } else {
      this.windup -= delta
      if (this.windup <= 0) {
        firePattern(this, this.pattern, this.gs.hostileSpawner)
        this.volley++
        this.moveState = 0
        this.stateT = phase.window
      }
    }

    // --- Adds (phase 2 only) ------------------------------------------------
    if (phase.adds > 0) {
      this.addsT -= delta
      if (this.addsT <= 0) {
        this.addsT = 2600
        if (this.gs.countChaff() < phase.adds) {
          const side = this.volley % 2 === 0 ? 0.25 : 0.75
          this.gs.spawnEnemy('drone', GAME_WIDTH * side, -20, 'straightDown')
        }
      }
    }

    this.syncCore()
  }

  /** The core follows the hull and shows, unmistakably, which state it is in. */
  private syncCore(): void {
    const core = this.core
    if (!core) return
    core.setPosition(this.x, this.y)
    core.setTexture(this.coreOpen ? TEX.bossCoreOpen : TEX.bossCoreShut)
    core.setAlpha(this.alpha)
    if (this.coreOpen) {
      core.setScale(1 + Math.sin(this.age / 200) * 0.04)
    } else {
      core.setScale(1 + this.charge * 0.5)
    }
  }

  private enterPhase(next: number): void {
    this.phase = next
    this.invuln = BALANCE.boss.transitionTime * 1000
    this.moveState = 0
    this.stateT = PHASES[next].window + BALANCE.boss.transitionTime * 1000
    this.windup = 0
    this.patternRot = 0

    // A segment break is an EVENT: hit-stop, shake, flash, sting, bar flash.
    this.gs.onBossPhaseBreak(this, next, PHASES[next].hint)

    // Blink through the invulnerable beat so it is obvious.
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0.45 },
      duration: 90,
      yoyo: true,
      repeat: Math.floor((BALANCE.boss.transitionTime * 1000) / 180),
      onComplete: () => this.setAlpha(1),
    })
  }
}
