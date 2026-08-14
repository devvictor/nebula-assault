/**
 * Enemy movement behaviours, as named reusable functions so waves compose them
 * rather than reinventing motion.
 *
 * Fairness rules enforced here, not left to wave data:
 *  - nothing comes to rest in the player's zone (bottom of the field)
 *  - a chaser is always slower than the player, or it becomes unavoidable
 *  - anything that pauses, pauses long enough to be shot
 */

import Phaser from 'phaser'

import { GAME_HEIGHT, GAME_WIDTH, TAU } from '../core/layout'
import { BALANCE } from '../data/balance'
import type { Enemy } from '../objects/Enemy'

/** Enemies may not come to rest below this line. */
export const PLAYER_ZONE_Y = GAME_HEIGHT * 0.78
export const HOLD_MAX_Y = GAME_HEIGHT * 0.5

export function applyMovement(e: Enemy, px: number, py: number, deltaMs: number): void {
  const body = e.body as Phaser.Physics.Arcade.Body | null
  if (!body) return

  const dt = deltaMs / 1000
  const def = e.def
  const t = e.age / 1000

  switch (e.movement) {
    case 'straightDown': {
      body.velocity.set(0, def.speed)
      break
    }

    case 'sineDrift': {
      // Deterministic per-enemy amplitude and period, derived from its seed.
      const amp = 40 + ((e.seed * 7) % 40)
      const period = 1.2 + (e.seed % 0.8)
      const target = e.homeX + Math.sin((t / period) * TAU + e.seed) * amp
      body.velocity.set((target - e.x) / Math.max(dt, 1e-4), def.speed)
      break
    }

    case 'swoopIn': {
      // Ease in to a hold position, hold, then exit. The hold is what gives the
      // player a firing window.
      if (e.moveState === 0) {
        const remaining = e.targetY - e.y
        body.velocity.set(0, Phaser.Math.Clamp(remaining * 2.4, 24, def.speed * 2.2))
        if (remaining <= 2) {
          e.moveState = 1
          e.stateT = 2000
        }
      } else if (e.moveState === 1) {
        e.stateT -= deltaMs
        body.velocity.set(Math.sin(t * 1.6 + e.seed) * 60, 0)
        if (e.stateT <= 0) e.moveState = 2
      } else {
        body.velocity.set(0, Phaser.Math.Linear(body.velocity.y, def.speed * 1.6, 0.06))
      }
      break
    }

    case 'chase': {
      // A chaser must be slower than the player, with a capped turn rate.
      const maxSpeed = Math.min(def.speed, BALANCE.player.speed * 0.75)
      const want = Math.atan2(py - e.y, px - e.x)
      const current = Math.atan2(body.velocity.y, body.velocity.x) || Math.PI / 2
      const turn = Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - current), -2.2 * dt, 2.2 * dt)
      body.velocity.setToPolar(current + turn, maxSpeed)
      if (e.y > PLAYER_ZONE_Y) body.velocity.y = Math.abs(body.velocity.y)
      break
    }

    case 'dartPause': {
      // Fast dash, then a pause long enough to be shot (>= 0.4s).
      if (e.moveState === 0) {
        if (e.stateT <= 0) {
          e.stateT = 500
          const toward = Math.atan2(Math.abs(py - e.y) + 60, px - e.x)
          const a = toward + Phaser.Math.FloatBetween(-0.5, 0.5)
          body.velocity.set(Math.cos(a) * def.speed * 2.1, Math.abs(Math.sin(a)) * def.speed * 1.6)
        }
        e.stateT -= deltaMs
        if (e.stateT <= 0) {
          e.moveState = 1
          e.stateT = 550
        }
      } else {
        e.stateT -= deltaMs
        body.velocity.x = Phaser.Math.Linear(body.velocity.x, 0, 0.12)
        body.velocity.y = Phaser.Math.Linear(body.velocity.y, 18, 0.12)
        if (e.stateT <= 0) {
          e.moveState = 0
          e.stateT = 0
        }
      }
      if (e.y > PLAYER_ZONE_Y) body.velocity.y = Math.abs(body.velocity.y) + 40
      break
    }

    case 'hover': {
      // Holds a Y band and strafes. Denies space without chasing.
      if (e.y < e.targetY - 2) {
        body.velocity.set(0, def.speed)
      } else {
        body.velocity.set(
          Math.cos(t * 0.9 + e.seed) * def.speed * 1.4,
          Phaser.Math.Linear(body.velocity.y, 0, 0.1)
        )
      }
      break
    }

    case 'orbit': {
      if (e.y < e.targetY - 2) {
        body.velocity.set(0, def.speed)
      } else {
        const r = 62
        const a = t * 1.1 + e.seed
        const tx = e.homeX + Math.cos(a) * r
        const ty = e.targetY + Math.sin(a) * r * 0.5
        body.velocity.set((tx - e.x) / Math.max(dt, 1e-4), (ty - e.y) / Math.max(dt, 1e-4))
      }
      break
    }
  }

  // Keep hovering and swooping enemies on the field horizontally.
  if (e.movement === 'hover' || e.movement === 'orbit' || e.movement === 'swoopIn') {
    const m = e.def.drawRadius + 4
    if (e.x < m) {
      e.x = m
      body.velocity.x = Math.abs(body.velocity.x)
    } else if (e.x > GAME_WIDTH - m) {
      e.x = GAME_WIDTH - m
      body.velocity.x = -Math.abs(body.velocity.x)
    }
  }
}
