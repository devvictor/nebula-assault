/**
 * Enemy bullet patterns.
 *
 * A pattern must be readable as a SHAPE — spreads, walls with a gap, spirals with
 * a rhythm. Random scatter is the hallmark of a pattern nobody designed.
 *
 * Every hostile bullet uses the same texture whatever fired it: danger has to be
 * readable at a glance.
 */

import Phaser from 'phaser'

import { GAME_WIDTH, TAU } from '../core/layout'
import type { PatternId } from '../data/enemies'
import type { Bullet } from '../objects/Bullet'
import type { Enemy } from '../objects/Enemy'
import { TEX } from './textures'

/** Enemy bullets stay slow enough to react to: the player moves at 380 px/s. */
const SPEED_MIN = 140
const SPEED_MAX = 220

/** How many slots a bullet wall has. The gap IS the design. */
export const WALL_SLOTS = 7

export type BulletSpawner = (
  x: number,
  y: number,
  angle: number,
  speed: number,
  damage: number
) => Bullet | null

export function makeHostileSpawner(group: Phaser.Physics.Arcade.Group): BulletSpawner {
  return (x, y, angle, speed, damage) => {
    const b = group.get(x, y) as Bullet | null
    if (!b) return null
    const s = Phaser.Math.Clamp(speed, SPEED_MIN, SPEED_MAX)
    b.fire({
      x,
      y,
      vx: Math.cos(angle) * s,
      vy: Math.sin(angle) * s,
      damage,
      radius: 5,
      texture: TEX.bulletHostile,
      rotateToVelocity: false,
    })
    return b
  }
}

export function firePattern(e: Enemy, pattern: PatternId, spawn: BulletSpawner): void {
  const fire = e.def.fire
  const speed = fire?.speed ?? 165
  const damage = fire?.damage ?? 1
  const x = e.x
  const y = e.y + e.def.drawRadius * 0.4

  switch (pattern) {
    case 'aimed': {
      spawn(x, y, e.aimAngle, speed, damage)
      break
    }

    case 'spread3': {
      for (let i = -1; i <= 1; i++) spawn(x, y, e.aimAngle + i * 0.26, speed, damage) // +/-15 deg
      break
    }

    case 'spread5': {
      for (let i = -2; i <= 2; i++) spawn(x, y, e.aimAngle + i * 0.26, speed, damage) // +/-30 deg
      break
    }

    case 'wallGap': {
      // A wall across the field with one slot empty, and the gap walks each volley
      // so the player must keep reading it.
      const gap = wallGapIndex(e)
      const step = GAME_WIDTH / (WALL_SLOTS + 1)
      for (let i = 0; i < WALL_SLOTS; i++) {
        if (i === gap) continue
        spawn(step * (i + 1), y, Math.PI / 2, speed * 0.9, damage)
      }
      e.patternRot += 3
      break
    }

    case 'ring': {
      const n = 10
      for (let i = 0; i < n; i++) {
        spawn(x, y, (i / n) * TAU + e.patternRot, speed * 0.85, damage)
      }
      break
    }

    case 'spiral': {
      const n = 8
      for (let i = 0; i < n; i++) {
        spawn(x, y, (i / n) * TAU + e.patternRot, speed * 0.85, damage)
      }
      e.patternRot += Phaser.Math.DegToRad(12)
      break
    }
  }
}

/** Shared by the pattern and its telegraph, so the tell never lies. */
export function wallGapIndex(e: Enemy): number {
  return Math.floor(e.patternRot) % WALL_SLOTS
}
