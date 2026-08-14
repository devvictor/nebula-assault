/**
 * Procedural textures, baked once at boot.
 *
 * There are no image assets by design — every sprite is a Graphics path baked
 * into a GPU texture with generateTexture(). That keeps the build with nothing to
 * download and nothing to 404 inside a WebView, while still getting batched
 * sprite rendering instead of per-frame path drawing.
 *
 * Silhouette first: every enemy must be identifiable by SHAPE alone at phone
 * size, before colour or detail.
 */

import Phaser from 'phaser'

import { COLORS, GAME_WIDTH, TAU } from '../core/layout'
import { ENEMIES, type EnemyId } from '../data/enemies'

type Pt = Phaser.Math.Vector2

const v = (x: number, y: number): Pt => new Phaser.Math.Vector2(x, y)

export const TEX = {
  player: 'tex-player',
  bulletPlayer: 'tex-bullet-player',
  bulletPlayerPierce: 'tex-bullet-pierce',
  bulletHostile: 'tex-bullet-hostile',
  dot: 'tex-dot',
  shard: 'tex-shard',
  ring: 'tex-ring',
  warning: 'tex-warning',
  repair: 'tex-repair',
  bounty: 'tex-bounty',
  bossCoreOpen: 'tex-boss-core-open',
  bossCoreShut: 'tex-boss-core-shut',
  pixel: 'tex-pixel',
  stars: ['tex-stars-0', 'tex-stars-1', 'tex-stars-2'],
} as const

export function enemyTexture(id: EnemyId): string {
  return `tex-enemy-${id}`
}

function bake(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: Phaser.GameObjects.Graphics, cx: number, cy: number) => void
): void {
  if (scene.textures.exists(key)) return
  const g = scene.add.graphics()
  draw(g, w / 2, h / 2)
  g.generateTexture(key, w, h)
  g.destroy()
}

function shell(g: Phaser.GameObjects.Graphics, pts: Pt[], fill: number, stroke: number): void {
  g.fillStyle(fill, 1)
  g.fillPoints(pts, true)
  g.lineStyle(1.2, stroke, 1)
  g.strokePoints(pts, true)
}

/** Offsets a list of unit-space points into texture space. */
function at(cx: number, cy: number, coords: number[]): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < coords.length; i += 2) {
    out.push(v(cx + coords[i], cy + coords[i + 1]))
  }
  return out
}

export function generateAllTextures(scene: Phaser.Scene): void {
  bakePlayer(scene)
  bakeBullets(scene)
  bakeParticles(scene)
  bakePickups(scene)
  bakeWarning(scene)
  bakeStarLayers(scene)

  for (const id of Object.keys(ENEMIES) as EnemyId[]) {
    if (id === 'boss') bakeBoss(scene)
    else bakeEnemy(scene, id)
  }
}

// --- Player -----------------------------------------------------------------

function bakePlayer(scene: Phaser.Scene): void {
  const r = 13
  const size = Math.ceil(r * 2 + 8)
  bake(scene, TEX.player, size, size, (g, cx, cy) => {
    // Wings
    shell(
      g,
      at(cx, cy, [-r, r * 0.75, -r * 0.3, r * 0.1, -r * 0.3, -r * 0.2, -r * 0.62, r * 0.2]),
      COLORS.playerWing,
      COLORS.player
    )
    shell(
      g,
      at(cx, cy, [r, r * 0.75, r * 0.3, r * 0.1, r * 0.3, -r * 0.2, r * 0.62, r * 0.2]),
      COLORS.playerWing,
      COLORS.player
    )
    // Hull
    shell(
      g,
      at(cx, cy, [0, -r, r * 0.44, r * 0.5, 0, r * 0.28, -r * 0.44, r * 0.5]),
      COLORS.playerDark,
      COLORS.player
    )
    // Cockpit
    g.fillStyle(0xd8fbff, 1)
    g.fillEllipse(cx, cy - r * 0.18, r * 0.32, r * 0.6)
  })
}

// --- Enemies ----------------------------------------------------------------

function bakeEnemy(scene: Phaser.Scene, id: EnemyId): void {
  const def = ENEMIES[id]
  const r = def.drawRadius
  const size = Math.ceil(r * 2.8)
  const fill = def.color
  const line = def.accent

  bake(scene, enemyTexture(id), size, size, (g, cx, cy) => {
    switch (id) {
      case 'drone':
        // Small inverted triangle — the simplest silhouette in the game.
        shell(g, at(cx, cy, [0, r, -r * 0.85, -r * 0.7, r * 0.85, -r * 0.7]), fill, line)
        g.fillStyle(line, 1)
        g.fillCircle(cx, cy - r * 0.1, r * 0.22)
        break

      case 'alien':
        // Wide chevron.
        shell(
          g,
          at(cx, cy, [
            0, r * 0.9, -r, -r * 0.5, -r * 0.5, -r * 0.9, 0, -r * 0.2, r * 0.5, -r * 0.9, r,
            -r * 0.5,
          ]),
          fill,
          line
        )
        g.fillStyle(COLORS.frame, 1)
        g.fillCircle(cx, cy - r * 0.35, r * 0.2)
        break

      case 'weaver':
        // Diamond with swept wings.
        shell(g, at(cx, cy, [0, r, r * 0.7, 0, 0, -r, -r * 0.7, 0]), fill, line)
        shell(g, at(cx, cy, [r * 0.7, 0, r * 1.25, -r * 0.45, r * 0.55, -r * 0.15]), fill, line)
        shell(g, at(cx, cy, [-r * 0.7, 0, -r * 1.25, -r * 0.45, -r * 0.55, -r * 0.15]), fill, line)
        break

      case 'shooter':
        // Hex body with a forward barrel — you can see what it does.
        shell(
          g,
          at(cx, cy, [
            -r * 0.7, -r * 0.5, r * 0.7, -r * 0.5, r * 0.95, r * 0.2, 0, r * 0.7, -r * 0.95,
            r * 0.2,
          ]),
          fill,
          line
        )
        g.fillStyle(line, 1)
        g.fillRect(cx - r * 0.14, cy + r * 0.35, r * 0.28, r * 0.6)
        break

      case 'turret': {
        // Octagon with a dashed ring: stationary, area-denial.
        const oct: Pt[] = []
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + Math.PI / 8
          oct.push(v(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8))
        }
        shell(g, oct, fill, line)
        g.lineStyle(1, line, 0.8)
        g.strokeCircle(cx, cy, r * 1.05)
        break
      }

      case 'armoured':
        // Heavy, blocky, shoulders — reads as "this will take a while".
        shell(
          g,
          at(cx, cy, [-r * 0.9, -r * 0.6, r * 0.9, -r * 0.6, r * 0.75, r * 0.75, -r * 0.75, r * 0.75]),
          fill,
          line
        )
        g.fillStyle(line, 1)
        g.fillRect(cx - r * 1.05, cy - r * 0.35, r * 0.3, r * 0.85)
        g.fillRect(cx + r * 0.75, cy - r * 0.35, r * 0.3, r * 0.85)
        g.fillStyle(COLORS.frame, 1)
        g.fillRect(cx - r * 0.45, cy - r * 0.25, r * 0.9, r * 0.3)
        break

      case 'elite':
        // Big arrow with fins.
        shell(
          g,
          at(cx, cy, [0, r, r * 0.9, -r * 0.35, r * 0.45, -r, -r * 0.45, -r, -r * 0.9, -r * 0.35]),
          fill,
          line
        )
        g.fillStyle(line, 1)
        g.fillRect(cx - r * 0.12, cy - r * 0.9, r * 0.24, r * 1.5)
        g.fillStyle(COLORS.frame, 1)
        g.fillCircle(cx, cy + r * 0.1, r * 0.26)
        break

      default:
        break
    }
  })
}

/** The boss hull, plus its core in both states. Open = vulnerable. */
function bakeBoss(scene: Phaser.Scene): void {
  const def = ENEMIES.boss
  const r = def.drawRadius
  const size = Math.ceil(r * 2.6)

  bake(scene, enemyTexture('boss'), size, size, (g, cx, cy) => {
    // Side pods.
    for (const s of [-1, 1]) {
      const ox = cx + s * r * 0.82
      shell(
        g,
        at(ox, cy + r * 0.05, [
          -r * 0.3, -r * 0.45, r * 0.3, -r * 0.35, r * 0.22, r * 0.5, -r * 0.28, r * 0.42,
        ]),
        def.color,
        def.accent
      )
    }

    // Main hexagonal hull.
    const hex: Pt[] = []
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6
      hex.push(v(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.62))
    }
    g.fillStyle(def.color, 1)
    g.fillPoints(hex, true)
    g.lineStyle(1.6, def.accent, 1)
    g.strokePoints(hex, true)

    // Armour ribs.
    g.lineStyle(1, 0x000000, 0.35)
    for (let i = -2; i <= 2; i++) {
      g.lineBetween(cx + i * r * 0.24, cy - r * 0.5, cx + i * r * 0.24, cy + r * 0.5)
    }
  })

  // Core: two textures, swapped by the boss. Which state it is in must be obvious.
  bake(scene, TEX.bossCoreOpen, 40, 40, (g, cx, cy) => {
    g.fillStyle(COLORS.gold, 1)
    g.fillCircle(cx, cy, 15)
    g.lineStyle(2, 0xfff6d8, 1)
    g.strokeCircle(cx, cy, 15)
    g.lineStyle(1, COLORS.gold, 0.35)
    g.strokeCircle(cx, cy, 19)
  })

  bake(scene, TEX.bossCoreShut, 40, 40, (g, cx, cy) => {
    g.fillStyle(0x3a1220, 1)
    g.fillCircle(cx, cy, 9)
    g.lineStyle(2, def.accent, 1)
    g.strokeCircle(cx, cy, 9)
  })
}

// --- Projectiles ------------------------------------------------------------

function bakeBullets(scene: Phaser.Scene): void {
  // Player shots: elongated with a bright core.
  bake(scene, TEX.bulletPlayer, 12, 8, (g, cx, cy) => {
    g.fillStyle(COLORS.player, 1)
    g.fillRect(cx - 5, cy - 2, 10, 4)
    g.fillStyle(COLORS.white, 1)
    g.fillRect(cx - 2.5, cy - 1, 5, 2)
  })

  bake(scene, TEX.bulletPlayerPierce, 16, 10, (g, cx, cy) => {
    g.fillStyle(COLORS.player, 1)
    g.fillRect(cx - 7, cy - 2.5, 14, 5)
    g.fillStyle(COLORS.white, 1)
    g.fillRect(cx - 4, cy - 1.2, 8, 2.4)
  })

  // Hostile shots: round, white core, ONE colour whatever fired them. Danger has
  // to be readable at a glance — these are the most important pixels on screen.
  bake(scene, TEX.bulletHostile, 14, 14, (g, cx, cy) => {
    g.fillStyle(COLORS.hostileBullet, 1)
    g.fillCircle(cx, cy, 5.5)
    g.fillStyle(COLORS.white, 1)
    g.fillCircle(cx, cy, 2.4)
  })
}

// --- Particles --------------------------------------------------------------

function bakeParticles(scene: Phaser.Scene): void {
  bake(scene, TEX.dot, 8, 8, (g, cx, cy) => {
    g.fillStyle(COLORS.white, 1)
    g.fillCircle(cx, cy, 3.5)
  })

  bake(scene, TEX.shard, 10, 6, (g, cx, cy) => {
    g.fillStyle(COLORS.white, 1)
    g.fillRect(cx - 4, cy - 1.6, 8, 3.2)
  })

  // One expanding ring reads the size of a blast instantly.
  bake(scene, TEX.ring, 64, 64, (g, cx, cy) => {
    g.lineStyle(3, COLORS.white, 1)
    g.strokeCircle(cx, cy, 28)
  })

  bake(scene, TEX.pixel, 2, 2, (g) => {
    g.fillStyle(COLORS.white, 1)
    g.fillRect(0, 0, 2, 2)
  })
}

// --- Pickups ----------------------------------------------------------------

function bakePickups(scene: Phaser.Scene): void {
  bake(scene, TEX.repair, 24, 24, (g, cx, cy) => {
    const pts = at(cx, cy, [
      -3, -9, 3, -9, 3, -3, 9, -3, 9, 3, 3, 3, 3, 9, -3, 9, -3, 3, -9, 3, -9, -3, -3, -3,
    ])
    shell(g, pts, COLORS.healthy, 0xd8ffe8)
  })

  bake(scene, TEX.bounty, 24, 24, (g, cx, cy) => {
    shell(g, at(cx, cy, [0, -10, 9, 0, 0, 10, -9, 0]), COLORS.gold, 0xfff6d8)
  })
}

function bakeWarning(scene: Phaser.Scene): void {
  bake(scene, TEX.warning, 20, 14, (g, cx, cy) => {
    g.lineStyle(2, COLORS.hostileBullet, 1)
    g.beginPath()
    g.moveTo(cx - 7, cy - 5)
    g.lineTo(cx, cy + 4)
    g.lineTo(cx + 7, cy - 5)
    g.strokePath()
  })
}

// --- Starfield --------------------------------------------------------------

/**
 * Three tileable star layers, scrolled at different rates as TileSprites — the
 * cheapest possible parallax. Kept dim: a busy background is the fastest way to
 * lose a bullet against it.
 */
function bakeStarLayers(scene: Phaser.Scene): void {
  const layers = [
    { count: 46, size: 1, alpha: 0.35 },
    { count: 30, size: 1.4, alpha: 0.55 },
    { count: 16, size: 2, alpha: 0.85 },
  ]

  layers.forEach((layer, i) => {
    const h = 854
    bake(scene, TEX.stars[i], GAME_WIDTH, h, (g) => {
      g.fillStyle(0xc8dcff, layer.alpha)
      for (let k = 0; k < layer.count; k++) {
        const x = Phaser.Math.Between(0, GAME_WIDTH - 2)
        const y = Phaser.Math.Between(0, h - 2)
        g.fillRect(x, y, layer.size, layer.size * 1.6)
      }
    })
  })
}
