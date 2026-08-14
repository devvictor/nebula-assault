/**
 * Wave director.
 *
 * Wave data says WHAT and WHEN. This enforces the fairness rules that data cannot
 * be trusted to hold:
 *
 *  - a group WAITS if spawning it would break the on-screen cap or push free space
 *    below the escape-space floor (a wall is unfair; a rhythm is legible)
 *  - every entry is telegraphed 0.5s ahead at the edge it comes from
 *  - nothing spawns inside the player's zone
 */

import Phaser from 'phaser'

import { GAME_HEIGHT, GAME_WIDTH } from '../core/layout'
import { synth } from '../core/synth'
import { BALANCE } from '../data/balance'
import { ENEMIES, type MovementId } from '../data/enemies'
import { waveAt, waveLabel, type FormationId, type SpawnGroup, type Wave } from '../data/waves'
import type { GameScene } from '../scenes/GameScene'

const TELEGRAPH = 500
const TOP_SPAWN_Y = -24
const MARGIN = 44

type Phase = 'idle' | 'running' | 'clearing' | 'gap'

interface Slot {
  x: number
  y: number
  movement?: MovementId
}

export class WaveDirector {
  wave: Wave = waveAt(0)
  phase: Phase = 'idle'
  index = 0
  /** ms since the wave started */
  waveT = 0
  /** set when a wave finishes and the game should offer an upgrade */
  pendingUpgrade = false

  private gapT = 0
  private warned: boolean[] = []
  private spawned: boolean[] = []

  constructor(private readonly scene: GameScene) {}

  reset(): void {
    this.phase = 'idle'
    this.index = 0
    this.waveT = 0
    this.gapT = 0
    this.pendingUpgrade = false
  }

  start(index: number): void {
    this.index = index
    this.wave = waveAt(index)
    this.waveT = 0
    this.phase = 'running'
    this.pendingUpgrade = false

    const n = this.wave.groups.length
    this.warned = new Array<boolean>(n).fill(false)
    this.spawned = new Array<boolean>(n).fill(false)

    synth.waveStart()

    if (this.wave.boss) {
      this.scene.showBanner('WARNING', 'HIVECORE INBOUND')
      this.scene.spawnBoss()
    } else {
      this.scene.showBanner(`WAVE ${waveLabel(index)}`, axisWord(this.wave))
    }

    // Breathers guarantee drops — they are where the player feels powerful.
    const drops = this.wave.drops ?? 0
    for (let i = 0; i < drops; i++) {
      this.scene.dropPickup(
        i === 0 ? 'repair' : 'bounty',
        Phaser.Math.Between(60, GAME_WIDTH - 60),
        Phaser.Math.Between(-120, -20)
      )
    }
  }

  update(delta: number): void {
    switch (this.phase) {
      case 'idle':
        return

      case 'running': {
        this.waveT += delta
        let allSpawned = true

        for (let i = 0; i < this.wave.groups.length; i++) {
          if (this.spawned[i]) continue
          allSpawned = false
          const g = this.wave.groups[i]
          const at = g.at * 1000

          // Telegraph first, then spawn TELEGRAPH ms later. Nothing ever
          // materialises on top of the player.
          if (!this.warned[i] && this.waveT >= at) {
            this.warned[i] = true
            for (let k = 0; k < g.count; k++) {
              this.scene.warnAt(slotPosition(g.formation, k, g.count).x, 10, TELEGRAPH)
            }
          }

          if (this.warned[i] && this.waveT >= at + TELEGRAPH) {
            if (this.canSpawn(g)) {
              this.spawnGroup(g)
              this.spawned[i] = true
            }
            // else: hold. Surplus budget is spent over time, never all at once.
          }
        }

        if (allSpawned) this.phase = 'clearing'
        return
      }

      case 'clearing': {
        this.waveT += delta
        if (this.scene.countEnemies() === 0) {
          this.phase = 'gap'
          this.gapT = BALANCE.wave.interWaveDelay * 1000
          // Upgrades are banked on breathers and after a boss.
          this.pendingUpgrade = this.wave.role === 'breather' || this.wave.role === 'boss'
        }
        return
      }

      case 'gap': {
        this.gapT -= delta
        if (this.gapT <= 0) {
          if (this.pendingUpgrade) {
            // The scene shows the upgrade screen, then calls start() again.
            this.phase = 'idle'
          } else {
            this.start(this.index + 1)
          }
        }
        return
      }
    }
  }

  get awaitingUpgrade(): boolean {
    return this.phase === 'idle' && this.pendingUpgrade
  }

  /**
   * Occupancy check. The escape-space floor is what stops a legal budget from
   * producing an unfair wall.
   */
  private freeSpace(incoming = 0): number {
    const field = GAME_WIDTH * GAME_HEIGHT
    let occupied = incoming

    for (const e of this.scene.enemies.getChildren()) {
      const s = e as Phaser.Physics.Arcade.Sprite & { def?: { radius: number } }
      if (!s.active || !s.def) continue
      const r = s.def.radius * 2.6 // threat footprint, not just the hitbox
      occupied += Math.PI * r * r
    }
    for (const b of this.scene.hostileBullets.getChildren()) {
      const s = b as Phaser.Physics.Arcade.Sprite
      if (!s.active) continue
      const r = 15
      occupied += Math.PI * r * r
    }

    return Phaser.Math.Clamp(1 - occupied / field, 0, 1)
  }

  private canSpawn(g: SpawnGroup): boolean {
    const def = ENEMIES[g.enemy]
    if (this.scene.countEnemies() + g.count > BALANCE.caps.onScreenEnemies) return false
    const r = def.radius * 2.6
    const incoming = g.count * Math.PI * r * r
    return this.freeSpace(incoming) >= BALANCE.caps.escapeSpace
  }

  private spawnGroup(g: SpawnGroup): void {
    for (let i = 0; i < g.count; i++) {
      const slot = slotPosition(g.formation, i, g.count)
      const movement: MovementId | undefined = g.movement ?? slot.movement
      const e = this.scene.spawnEnemy(
        g.enemy,
        Phaser.Math.Clamp(slot.x, 12, GAME_WIDTH - 12),
        slot.y,
        movement
      )
      if (!e) return
      e.homeX = e.x
      // Turrets and hovering enemies take fixed bands, well clear of the player's
      // zone. Everything else gets a randomised hold height.
      if (movement === 'hover' || movement === 'orbit') {
        e.targetY = GAME_HEIGHT * (0.16 + 0.08 * (i % 3))
      }
    }
  }
}

function axisWord(wave: Wave): string {
  switch (wave.threatAxis) {
    case 'density':
      return 'SWARM'
    case 'aimed':
      return 'INCOMING FIRE'
    case 'denial':
      return 'HOLD THE LANE'
    case 'time':
      return 'REGROUP'
  }
}

/** The entry position for slot `i` of a formation. */
export function slotPosition(formation: FormationId, i: number, count: number): Slot {
  const span = GAME_WIDTH - MARGIN * 2
  const centre = GAME_WIDTH / 2

  switch (formation) {
    case 'line': {
      const step = count > 1 ? span / (count - 1) : 0
      return { x: MARGIN + step * i, y: TOP_SPAWN_Y }
    }

    case 'vee': {
      // Wedge with the point leading: attack the point or flank it.
      const half = (count - 1) / 2
      const off = i - half
      return { x: centre + off * 40, y: TOP_SPAWN_Y - Math.abs(off) * 26 }
    }

    case 'column':
      return {
        x: Phaser.Math.Clamp(centre + Phaser.Math.Between(-90, 90), MARGIN, GAME_WIDTH - MARGIN),
        y: TOP_SPAWN_Y - i * 44,
      }

    case 'swarmDrip':
      // Staggered vertically so they drip in rather than arrive as a wall.
      return { x: MARGIN + Phaser.Math.Between(0, span), y: TOP_SPAWN_Y - i * 58 }

    case 'flanks': {
      // Two groups from the edges: the centre is not always safe.
      const left = i % 2 === 0
      return {
        x: left ? MARGIN - 10 : GAME_WIDTH - MARGIN + 10,
        y: TOP_SPAWN_Y - Math.floor(i / 2) * 40,
      }
    }

    case 'pincer': {
      if (i === 0) return { x: centre, y: TOP_SPAWN_Y }
      const left = i % 2 === 1
      return {
        x: left ? MARGIN : GAME_WIDTH - MARGIN,
        y: TOP_SPAWN_Y - Math.floor(i / 2) * 34,
      }
    }

    case 'escort': {
      // Leader plus a ring of chaff — teaches target priority.
      if (i === 0) return { x: centre, y: TOP_SPAWN_Y }
      const a = ((i - 1) / Math.max(1, count - 1)) * Math.PI - Math.PI / 2
      return { x: centre + Math.cos(a) * 52, y: TOP_SPAWN_Y - 30 - Math.sin(a) * 20 }
    }

    case 'turretWall': {
      // Fixed heights: the player must approach, then retreat.
      const step = count > 1 ? span / (count + 1) : 0
      return { x: MARGIN + step * (i + 1), y: TOP_SPAWN_Y - i * 20, movement: 'hover' }
    }

    case 'weaverPair': {
      // Crossing paths.
      const left = i % 2 === 0
      return {
        x: left ? centre - 70 : centre + 70,
        y: TOP_SPAWN_Y - i * 26,
        movement: 'dartPause',
      }
    }
  }
}
