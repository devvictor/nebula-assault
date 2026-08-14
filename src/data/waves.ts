/**
 * Wave data. A wave is not a bag of enemies — it is a question posed to the
 * player, so `teachingGoal` and `threatAxis` are REQUIRED fields. That is
 * deliberate: it forces the design question into the data model.
 *
 * Sets of five follow the sawtooth: build, build, build, peak, breather.
 * Every third set ends in a boss, with the breather moved to just before it.
 *
 * Debut waves deliberately underspend their budget. A new enemy type appears
 * alone, with empty space around it, so the player gets to watch it behave.
 * Skipping that is the most common cause of "this wave is unfair".
 */

import { BALANCE } from './balance'
import type { EnemyId, MovementId } from './enemies'

export type FormationId =
  | 'line'
  | 'vee'
  | 'column'
  | 'flanks'
  | 'pincer'
  | 'escort'
  | 'turretWall'
  | 'swarmDrip'
  | 'weaverPair'

export type ThreatAxis = 'density' | 'aimed' | 'denial' | 'time'
export type WaveRole = 'intro' | 'build' | 'peak' | 'breather' | 'boss'

export interface SpawnGroup {
  /** seconds from wave start — this is how a budget spends over TIME, not all at once */
  at: number
  formation: FormationId
  enemy: EnemyId
  count: number
  movement?: MovementId
}

export interface Wave {
  id: string
  /** what the player learns or practises here. A wave without one is filler. */
  teachingGoal: string
  /** the ONE pressure this wave applies */
  threatAxis: ThreatAxis
  role: WaveRole
  budget: number
  groups: SpawnGroup[]
  boss?: boolean
  /** guaranteed pickups (breathers are where the player feels powerful) */
  drops?: number
}

// --- Pressure curve ---------------------------------------------------------

/** Peak pressure for wave set `n` (0-based). Additive growth, never multiplicative. */
export function setPeak(n: number): number {
  return BALANCE.wave.basePressure * (1 + BALANCE.wave.setGrowth * n)
}

/** Budget for slot `k` (0-based) of set `n`. */
export function slotBudget(n: number, k: number): number {
  return Math.round(setPeak(n) * BALANCE.wave.slotScale[k])
}

export function isBossSet(n: number): boolean {
  return (n + 1) % BALANCE.wave.bossEverySets === 0
}

// --- Authored waves: sets 1-3 ----------------------------------------------

export const AUTHORED: Wave[] = [
  // ---- Set 1: peak 12 -----------------------------------------------------
  {
    id: '1-1',
    teachingGoal: 'Shooting and sweeping horizontally.',
    threatAxis: 'density',
    role: 'intro',
    budget: slotBudget(0, 0),
    groups: [
      { at: 0.0, formation: 'line', enemy: 'drone', count: 4, movement: 'straightDown' },
      { at: 2.6, formation: 'column', enemy: 'alien', count: 1, movement: 'sineDrift' },
    ],
  },
  {
    id: '1-2',
    teachingGoal: 'Leading a target that does not fly straight.',
    threatAxis: 'density',
    role: 'build',
    budget: slotBudget(0, 1),
    groups: [
      { at: 0.0, formation: 'vee', enemy: 'alien', count: 2, movement: 'sineDrift' },
      { at: 2.2, formation: 'swarmDrip', enemy: 'drone', count: 2, movement: 'straightDown' },
    ],
  },
  {
    id: '1-3',
    // DEBUT: Lancer alone, nothing else on screen. Underspends on purpose.
    teachingGoal: 'Aimed fire exists — standing still gets you shot.',
    threatAxis: 'aimed',
    role: 'build',
    budget: slotBudget(0, 2),
    groups: [
      { at: 0.0, formation: 'column', enemy: 'shooter', count: 1, movement: 'swoopIn' },
      { at: 4.0, formation: 'column', enemy: 'shooter', count: 1, movement: 'swoopIn' },
    ],
  },
  {
    id: '1-4',
    teachingGoal: 'Target priority while under aimed fire.',
    threatAxis: 'density',
    role: 'peak',
    budget: slotBudget(0, 3),
    groups: [
      { at: 0.0, formation: 'escort', enemy: 'alien', count: 1, movement: 'straightDown' },
      { at: 0.2, formation: 'swarmDrip', enemy: 'drone', count: 3, movement: 'straightDown' },
      { at: 2.6, formation: 'column', enemy: 'shooter', count: 1, movement: 'swoopIn' },
    ],
  },
  {
    id: '1-5',
    teachingGoal: 'Breathe. Bank an upgrade. Feel powerful.',
    threatAxis: 'time',
    role: 'breather',
    budget: slotBudget(0, 4),
    drops: BALANCE.pickups.breatherDrops,
    groups: [{ at: 0.0, formation: 'line', enemy: 'drone', count: 3, movement: 'straightDown' }],
  },

  // ---- Set 2: peak 16.2 ---------------------------------------------------
  {
    id: '2-1',
    // DEBUT: Weaver alone.
    teachingGoal: 'Weavers cannot be hit by standing still and holding fire.',
    threatAxis: 'time',
    role: 'intro',
    budget: slotBudget(1, 0),
    groups: [
      { at: 0.0, formation: 'weaverPair', enemy: 'weaver', count: 2, movement: 'dartPause' },
    ],
  },
  {
    id: '2-2',
    teachingGoal: 'Tracking an erratic target while something else pressures you.',
    threatAxis: 'density',
    role: 'build',
    budget: slotBudget(1, 1),
    groups: [
      { at: 0.0, formation: 'weaverPair', enemy: 'weaver', count: 2, movement: 'dartPause' },
      { at: 1.8, formation: 'column', enemy: 'alien', count: 1, movement: 'sineDrift' },
    ],
  },
  {
    id: '2-3',
    // DEBUT: Sentinel alone.
    teachingGoal: 'Sentinels hold ground and fire rings — approach, then retreat.',
    threatAxis: 'denial',
    role: 'build',
    budget: slotBudget(1, 2),
    groups: [{ at: 0.0, formation: 'turretWall', enemy: 'turret', count: 2, movement: 'hover' }],
  },
  {
    id: '2-4',
    teachingGoal: 'Fighting for space while a ring pattern shrinks it.',
    threatAxis: 'denial',
    role: 'peak',
    budget: slotBudget(1, 3),
    groups: [
      { at: 0.0, formation: 'turretWall', enemy: 'turret', count: 1, movement: 'hover' },
      { at: 1.2, formation: 'weaverPair', enemy: 'weaver', count: 2, movement: 'dartPause' },
      { at: 3.4, formation: 'column', enemy: 'shooter', count: 1, movement: 'swoopIn' },
    ],
  },
  {
    id: '2-5',
    teachingGoal: 'Breathe. Bank an upgrade.',
    threatAxis: 'time',
    role: 'breather',
    budget: slotBudget(1, 4),
    drops: BALANCE.pickups.breatherDrops,
    groups: [{ at: 0.0, formation: 'line', enemy: 'drone', count: 4, movement: 'straightDown' }],
  },

  // ---- Set 3: peak 20.4, boss set ----------------------------------------
  {
    id: '3-1',
    // DEBUT: Bulwark alone.
    teachingGoal: 'Bulwarks soak damage and deny a lane — go around, not through.',
    threatAxis: 'denial',
    role: 'intro',
    budget: slotBudget(2, 0),
    groups: [
      { at: 0.0, formation: 'column', enemy: 'armoured', count: 1, movement: 'straightDown' },
    ],
  },
  {
    id: '3-2',
    teachingGoal: 'Committing to a slow kill while fast targets harass you.',
    threatAxis: 'density',
    role: 'build',
    budget: slotBudget(2, 1),
    groups: [
      { at: 0.0, formation: 'column', enemy: 'armoured', count: 1, movement: 'straightDown' },
      { at: 1.6, formation: 'weaverPair', enemy: 'weaver', count: 1, movement: 'dartPause' },
      { at: 3.0, formation: 'column', enemy: 'alien', count: 1, movement: 'sineDrift' },
    ],
  },
  {
    id: '3-3',
    teachingGoal: 'Everything at once — the set 3 exam.',
    threatAxis: 'denial',
    role: 'peak',
    budget: slotBudget(2, 2),
    groups: [
      { at: 0.0, formation: 'turretWall', enemy: 'turret', count: 1, movement: 'hover' },
      { at: 1.0, formation: 'flanks', enemy: 'weaver', count: 2, movement: 'dartPause' },
      { at: 3.2, formation: 'column', enemy: 'alien', count: 1, movement: 'sineDrift' },
      { at: 4.6, formation: 'column', enemy: 'shooter', count: 1, movement: 'swoopIn' },
    ],
  },
  {
    id: '3-4',
    // Breather moved BEFORE the boss: never fight a boss on a low-health run
    // with no chance to prepare.
    teachingGoal: 'Repair and choose a build before the Hivecore.',
    threatAxis: 'time',
    role: 'breather',
    budget: slotBudget(2, 4),
    drops: BALANCE.pickups.breatherDrops + 1,
    groups: [{ at: 0.0, formation: 'line', enemy: 'drone', count: 3, movement: 'straightDown' }],
  },
  {
    id: '3-5',
    teachingGoal: 'Read a pattern, survive a constraint, then out-tempo it.',
    threatAxis: 'aimed',
    role: 'boss',
    budget: 0,
    boss: true,
    groups: [],
  },
]

// --- Procedural continuation ------------------------------------------------

const POOL_EARLY: EnemyId[] = ['drone', 'alien', 'weaver', 'shooter']
const POOL_LATE: EnemyId[] = ['drone', 'alien', 'weaver', 'shooter', 'turret', 'armoured']

const FORMATIONS: Record<EnemyId, FormationId[]> = {
  drone: ['line', 'swarmDrip', 'vee'],
  alien: ['vee', 'line', 'column'],
  weaver: ['weaverPair', 'flanks'],
  shooter: ['column', 'flanks'],
  turret: ['turretWall'],
  armoured: ['column', 'vee'],
  elite: ['column'],
  boss: ['column'],
}

const POINTS: Record<EnemyId, number> = {
  drone: 1,
  alien: 3,
  weaver: 4,
  shooter: 5,
  turret: 6,
  armoured: 7,
  elite: 12,
  boss: 0,
}

function pickFormation(id: EnemyId, seed: number): FormationId {
  const opts = FORMATIONS[id]
  return opts[seed % opts.length]
}

/**
 * Generates a wave for set `n` slot `k` once the authored waves run out.
 * Keeps every structural rule: one primary axis, variety floor of 2 types,
 * budget spent across sub-groups over time, and one elite maximum.
 */
export function generateWave(n: number, k: number, waveNumber: number): Wave {
  const bossSet = isBossSet(n)

  if (bossSet && k === 4) {
    return {
      id: `${n + 1}-5`,
      teachingGoal: 'A harder Hivecore: same grammar, tighter windows.',
      threatAxis: 'aimed',
      role: 'boss',
      budget: 0,
      boss: true,
      groups: [],
    }
  }

  // Boss sets move the breather to slot 4; normal sets keep it at slot 5.
  const isBreather = bossSet ? k === 3 : k === 4
  if (isBreather) {
    return {
      id: `${n + 1}-${k + 1}`,
      teachingGoal: 'Breathe. Bank an upgrade.',
      threatAxis: 'time',
      role: 'breather',
      budget: slotBudget(n, 4),
      drops: BALANCE.pickups.breatherDrops,
      groups: [{ at: 0, formation: 'line', enemy: 'drone', count: 4, movement: 'straightDown' }],
    }
  }

  let budget = slotBudget(n, k)
  const pool = n >= 2 ? POOL_LATE : POOL_EARLY
  const groups: SpawnGroup[] = []

  // Elites debut at set 4 and stay capped at one per wave.
  const allowElite = n >= 3 && k === 3
  if (allowElite && budget >= POINTS.elite) {
    groups.push({ at: 0, formation: 'column', enemy: 'elite', count: 1 })
    budget -= POINTS.elite
  }

  // Spend what remains across 2-3 sub-groups, a beat apart. Never one wall.
  const types = new Set<EnemyId>()
  let at = groups.length > 0 ? 2.4 : 0
  let guard = 0
  while (budget > 0 && groups.length < 4 && guard++ < 12) {
    const id = pool[(waveNumber * 7 + groups.length * 3 + guard) % pool.length]
    const cost = POINTS[id]
    const max = Math.max(1, Math.floor(budget / cost))
    const count = Math.min(max, id === 'drone' ? 5 : id === 'turret' ? 1 : 2)
    if (count < 1) break
    groups.push({
      at,
      formation: pickFormation(id, waveNumber + groups.length),
      enemy: id,
      count,
    })
    types.add(id)
    budget -= cost * count
    at += 1.6 + (groups.length % 2) * 0.7
  }

  // Variety floor: at least two types per wave, or it reads as one repeated idea.
  if (types.size < 2 && budget >= 0) {
    groups.push({ at: at + 0.8, formation: 'line', enemy: 'drone', count: 3 })
  }

  return {
    id: `${n + 1}-${k + 1}`,
    teachingGoal: 'Combine everything learned so far under more pressure.',
    threatAxis: k === 3 ? 'density' : n % 2 === 0 ? 'denial' : 'aimed',
    role: k === 3 ? 'peak' : 'build',
    budget: slotBudget(n, k),
    groups,
  }
}

/** Wave 1 is index 0. Returns authored data where it exists, else generated. */
export function waveAt(index: number): Wave {
  if (index < AUTHORED.length) return AUTHORED[index]
  const n = Math.floor(index / 5)
  const k = index % 5
  return generateWave(n, k, index + 1)
}

export function waveLabel(index: number): string {
  const n = Math.floor(index / 5) + 1
  const k = (index % 5) + 1
  return `${n}-${k}`
}
