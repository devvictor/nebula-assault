/**
 * Enemy roster. HP is DERIVED from a target time-to-kill, never picked by feel:
 *
 *   playerDPS = damage x shotsPerSecond x avgShotsOnTarget   (1 x 8 x ~0.7 = 5.6)
 *   enemyHP   = targetTTK x playerDPS
 *
 * Points are the spawn-budget currency that wave design spends.
 * Difficulty comes from composition and pressure — never from HP inflation.
 */

export type EnemyId =
  | 'drone'
  | 'alien'
  | 'weaver'
  | 'shooter'
  | 'turret'
  | 'armoured'
  | 'elite'
  | 'boss'

export type MovementId =
  | 'straightDown'
  | 'sineDrift'
  | 'swoopIn'
  | 'chase'
  | 'dartPause'
  | 'hover'
  | 'orbit'

export type PatternId = 'aimed' | 'spread3' | 'spread5' | 'wallGap' | 'ring' | 'spiral'

export type Role = 'chaff' | 'pressure' | 'denial' | 'priority' | 'boss'

export interface FireDef {
  pattern: PatternId
  /** seconds between volleys */
  interval: number
  /** readable wind-up before the shot. 0.3s minimum, 0.5s+ for heavy hits. */
  windup: number
  speed: number
  damage: number
  /** aimed shots count against the simultaneous-aimed-shooter cap */
  aimed: boolean
}

export interface EnemyDef {
  id: EnemyId
  label: string
  /** spawn-budget cost */
  points: number
  hp: number
  /** collision radius */
  radius: number
  /** sprite half-extent */
  drawRadius: number
  speed: number
  score: number
  role: Role
  /** Phaser-native colour, baked into the generated texture */
  color: number
  accent: number
  /** drives hit sound and hit-stop class */
  weight: 'chaff' | 'light' | 'heavy'
  explode: 'small' | 'medium' | 'large'
  /** damage dealt by touching the player's ship */
  contact: number
  defaultMovement: MovementId
  fire?: FireDef
  /** show floating damage numbers — only where the player needs the info */
  showDamageNumbers?: boolean
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  // TTK ~0.15s — dies to a single tap. Exists to be mowed down.
  drone: {
    id: 'drone',
    label: 'Drone',
    points: 1,
    hp: 1,
    radius: 9,
    drawRadius: 10,
    speed: 132,
    score: 10,
    role: 'chaff',
    color: 0x7b8ea8,
    accent: 0xaebdd1,
    weight: 'chaff',
    explode: 'small',
    contact: 1,
    defaultMovement: 'straightDown',
  },

  // TTK ~0.5s — two to four hits. The bread-and-butter rhythm.
  alien: {
    id: 'alien',
    label: 'Alien',
    points: 3,
    hp: 3,
    radius: 12,
    drawRadius: 14,
    speed: 108,
    score: 25,
    role: 'pressure',
    color: 0x5ad48a,
    accent: 0xb6f2cf,
    weight: 'light',
    explode: 'small',
    contact: 1,
    defaultMovement: 'sineDrift',
  },

  // Costs more than its HP suggests: it is hard to hit, not hard to kill.
  weaver: {
    id: 'weaver',
    label: 'Weaver',
    points: 4,
    hp: 3,
    radius: 11,
    drawRadius: 14,
    speed: 152,
    score: 40,
    role: 'pressure',
    color: 0x8f7bff,
    accent: 0xcfc4ff,
    weight: 'light',
    explode: 'small',
    contact: 1,
    defaultMovement: 'dartPause',
  },

  // Pressure, not bulk. Aimed fire with a generous tell.
  shooter: {
    id: 'shooter',
    label: 'Lancer',
    points: 5,
    hp: 4,
    radius: 13,
    drawRadius: 16,
    speed: 96,
    score: 50,
    role: 'pressure',
    color: 0xffb347,
    accent: 0xffe2b0,
    weight: 'light',
    explode: 'small',
    contact: 1,
    defaultMovement: 'swoopIn',
    fire: { pattern: 'aimed', interval: 1.85, windup: 0.5, speed: 170, damage: 1, aimed: true },
  },

  // Forces the player to come to it, then punishes standing still.
  turret: {
    id: 'turret',
    label: 'Sentinel',
    points: 6,
    hp: 9,
    radius: 15,
    drawRadius: 18,
    speed: 46,
    score: 70,
    role: 'denial',
    color: 0x4fc4d8,
    accent: 0xc2f0f8,
    weight: 'heavy',
    explode: 'medium',
    contact: 1,
    defaultMovement: 'hover',
    fire: { pattern: 'ring', interval: 2.6, windup: 0.6, speed: 150, damage: 1, aimed: false },
    showDamageNumbers: true,
  },

  // Denies screen space. Long enough TTK that the player must hold position.
  armoured: {
    id: 'armoured',
    label: 'Bulwark',
    points: 7,
    hp: 12,
    radius: 18,
    drawRadius: 22,
    speed: 74,
    score: 90,
    role: 'denial',
    color: 0xd8556b,
    accent: 0xffb3c0,
    weight: 'heavy',
    explode: 'medium',
    contact: 1,
    defaultMovement: 'straightDown',
    fire: { pattern: 'spread3', interval: 2.2, windup: 0.55, speed: 160, damage: 1, aimed: false },
    showDamageNumbers: true,
  },

  // Max one per wave outside boss sets. A short fight with one behaviour to learn.
  elite: {
    id: 'elite',
    label: 'Vanguard',
    points: 12,
    hp: 34,
    radius: 22,
    drawRadius: 26,
    speed: 86,
    score: 220,
    role: 'priority',
    color: 0xff7043,
    accent: 0xffd0bf,
    weight: 'heavy',
    explode: 'large',
    contact: 1,
    defaultMovement: 'dartPause',
    fire: { pattern: 'spread5', interval: 1.9, windup: 0.5, speed: 175, damage: 1, aimed: true },
    showDamageNumbers: true,
  },

  // A multi-phase conversation, not a health sponge. See boss.ts for phases.
  boss: {
    id: 'boss',
    label: 'Hivecore',
    points: 0,
    hp: 360,
    radius: 44,
    drawRadius: 54,
    speed: 78,
    score: 2500,
    role: 'boss',
    color: 0xe0446b,
    accent: 0xffd166,
    weight: 'heavy',
    explode: 'large',
    contact: 2,
    defaultMovement: 'hover',
    showDamageNumbers: true,
  },
}

/** A bar is pointless on something that dies to one base-weapon shot. */
export function showsHealthBar(def: EnemyDef): boolean {
  return def.hp > 1
}
