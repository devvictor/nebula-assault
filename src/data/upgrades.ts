/**
 * Upgrade pool.
 *
 * "+10% damage" is filler. Upgrades must change BEHAVIOUR, not just numbers —
 * at least two thirds of this pool is behavioural, and every entry states the
 * trade it forces. Three are offered at a time; one is always behavioural.
 *
 * Hard caps live in applyUpgrade(): fire interval never drops below the floor,
 * side pairs cap at 2, move speed caps at 1.8x base.
 */

import Phaser from 'phaser'

import { BALANCE } from './balance'
import type { PlayerStats } from './types'

export type UpgradeId =
  | 'pierce'
  | 'spread'
  | 'rear'
  | 'homing'
  | 'dashInvuln'
  | 'killBlast'
  | 'magnet'
  | 'graze'
  | 'rapid'
  | 'power'
  | 'hull'
  | 'thrusters'

export interface Upgrade {
  id: UpgradeId
  label: string
  /** the choice it forces, in the player's words */
  desc: string
  behavioural: boolean
  /** true once taken it cannot be taken again */
  unique: boolean
  apply(s: PlayerStats): void
  /** hide the offer when it would do nothing */
  available?(s: PlayerStats): boolean
}

export const UPGRADES: Upgrade[] = [
  {
    id: 'pierce',
    label: 'Lance Rounds',
    desc: 'Shots pass through enemies. Fire rate -30%.',
    behavioural: true,
    unique: true,
    apply: (s) => {
      s.pierce = true
      s.fireInterval *= 1.3
    },
    available: (s) => !s.pierce,
  },
  {
    id: 'spread',
    label: 'Scatter Array',
    desc: 'Two extra angled shots. Damage -20%.',
    behavioural: true,
    unique: false,
    apply: (s) => {
      s.sidePairs += 1
      s.damage *= 0.8
    },
    available: (s) => s.sidePairs < 2,
  },
  {
    id: 'rear',
    label: 'Tail Gun',
    desc: 'A rear-facing shot at half damage. Watch behind you.',
    behavioural: true,
    unique: true,
    apply: (s) => {
      s.rearShot = true
    },
    available: (s) => !s.rearShot,
  },
  {
    id: 'homing',
    label: 'Seeker Tips',
    desc: 'Shots curve toward targets. Damage -20%.',
    behavioural: true,
    unique: true,
    apply: (s) => {
      s.homing = 2.6
      s.damage *= 0.8
    },
    available: (s) => s.homing === 0,
  },
  {
    id: 'dashInvuln',
    label: 'Phase Drive',
    desc: 'Dash passes through everything. Cooldown +40%.',
    behavioural: true,
    unique: true,
    apply: (s) => {
      s.dashInvuln = true
    },
    available: (s) => !s.dashInvuln,
  },
  {
    id: 'killBlast',
    label: 'Chain Detonation',
    desc: 'Kills release a small blast. Sets off crowds.',
    behavioural: true,
    unique: true,
    apply: (s) => {
      s.killBlast = true
    },
    available: (s) => !s.killBlast,
  },
  {
    id: 'magnet',
    label: 'Tractor Coil',
    desc: 'Pickups fly to you from across the screen.',
    behavioural: true,
    unique: true,
    apply: (s) => {
      s.magnet = true
    },
    available: (s) => !s.magnet,
  },
  {
    id: 'graze',
    label: 'Risk Sensors',
    desc: 'Near-misses build your combo. Fly close.',
    behavioural: true,
    unique: true,
    apply: (s) => {
      s.graze = true
    },
    available: (s) => !s.graze,
  },
  // --- Numeric fillers: a minority of the pool, on purpose ------------------
  {
    id: 'rapid',
    label: 'Overclock',
    desc: 'Fire 18% faster.',
    behavioural: false,
    unique: false,
    apply: (s) => {
      s.fireInterval *= 0.82
    },
    available: (s) => s.fireInterval > BALANCE.player.minFireInterval,
  },
  {
    id: 'power',
    label: 'Heavy Slugs',
    desc: '+1 damage per shot.',
    behavioural: false,
    unique: false,
    apply: (s) => {
      s.damage += 1
    },
  },
  {
    id: 'hull',
    label: 'Hull Plating',
    desc: '+1 max hull, and repair 1.',
    behavioural: false,
    unique: false,
    apply: (s) => {
      s.maxHp += 1
    },
  },
  {
    id: 'thrusters',
    label: 'Ion Thrusters',
    desc: 'Move 18% faster.',
    behavioural: false,
    unique: false,
    apply: (s) => {
      s.speed *= 1.18
    },
    available: (s) => s.speed < BALANCE.player.speed * 1.8,
  },
]

export function baseStats(): PlayerStats {
  const p = BALANCE.player
  return {
    fireInterval: p.fireInterval,
    damage: p.bulletDamage,
    bulletSpeed: p.bulletSpeed,
    speed: p.speed,
    sidePairs: 0,
    rearShot: false,
    pierce: false,
    homing: 0,
    dashInvuln: false,
    killBlast: false,
    magnet: false,
    graze: false,
    maxHp: p.maxHp,
  }
}

/** Applies an upgrade, then clamps every capped stat. */
export function applyUpgrade(stats: PlayerStats, u: Upgrade): void {
  u.apply(stats)
  const p = BALANCE.player
  stats.fireInterval = Math.max(p.minFireInterval, stats.fireInterval)
  stats.sidePairs = Math.min(2, stats.sidePairs)
  stats.speed = Math.min(p.speed * 1.8, stats.speed)
  stats.damage = Math.max(0.2, stats.damage)
}

/**
 * Offers three choices, guaranteeing at least one behavioural option so the
 * player is always making a real decision rather than picking a percentage.
 */
export function offerUpgrades(stats: PlayerStats, taken: Set<UpgradeId>, count = 3): Upgrade[] {
  const eligible = UPGRADES.filter(
    (u) => (!u.unique || !taken.has(u.id)) && (u.available ? u.available(stats) : true)
  )

  const behavioural = shuffle(eligible.filter((u) => u.behavioural))
  const numeric = shuffle(eligible.filter((u) => !u.behavioural))

  const out: Upgrade[] = []
  if (behavioural.length > 0) out.push(behavioural.shift() as Upgrade)

  const rest = shuffle([...behavioural, ...numeric])
  while (out.length < count && rest.length > 0) out.push(rest.shift() as Upgrade)

  return out
}

function shuffle<T>(items: T[]): T[] {
  return Phaser.Utils.Array.Shuffle(items)
}
