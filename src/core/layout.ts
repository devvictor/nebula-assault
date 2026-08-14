/**
 * Logical resolution and safe-area insets.
 *
 * Phaser's Scale Manager handles the fit and the letterbox, but it knows nothing
 * about notches or gesture bars. This converts CSS `env(safe-area-inset-*)`
 * values into GAME units so the HUD can be anchored clear of them.
 */

import Phaser from 'phaser'

/** Phaser 4 removed Phaser.Math.PI2. */
export const TAU = Math.PI * 2

export const GAME_WIDTH = 480
export const GAME_HEIGHT = 854

/** Depth bands. This ordering is a readability rule, not a preference:
 *  background -> enemies -> ALIEN BARS -> projectiles -> player -> particles.
 *  Alien bars sit UNDER projectiles so a bar can never hide a bullet. */
export const DEPTH = {
  background: 0,
  warning: 5,
  enemy: 10,
  telegraph: 15,
  alienBar: 20,
  bullet: 30,
  pickup: 32,
  player: 40,
  particle: 50,
  bossBar: 60,
} as const

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

let probe: HTMLDivElement | null = null

function createProbe(): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:0',
    'height:0',
    'visibility:hidden',
    'pointer-events:none',
    'padding-top:env(safe-area-inset-top,0px)',
    'padding-right:env(safe-area-inset-right,0px)',
    'padding-bottom:env(safe-area-inset-bottom,0px)',
    'padding-left:env(safe-area-inset-left,0px)',
  ].join(';')
  document.body.appendChild(el)
  return el
}

/**
 * Safe-area insets in game units. An inset only eats into the play field where
 * the letterbox bar does not already absorb it.
 */
export function getInsets(scene: Phaser.Scene): Insets {
  if (!probe) probe = createProbe()
  const cs = getComputedStyle(probe)
  const cssTop = parseFloat(cs.paddingTop) || 0
  const cssRight = parseFloat(cs.paddingRight) || 0
  const cssBottom = parseFloat(cs.paddingBottom) || 0
  const cssLeft = parseFloat(cs.paddingLeft) || 0

  const bounds = scene.scale.canvasBounds
  const scale = scene.scale.displayScale
  // displayScale is game-units-per-CSS-pixel, so multiply CSS px by it.
  const barTop = Math.max(0, bounds.top)
  const barLeft = Math.max(0, bounds.left)
  const barBottom = Math.max(0, window.innerHeight - bounds.bottom)
  const barRight = Math.max(0, window.innerWidth - bounds.right)

  return {
    top: Math.max(0, cssTop - barTop) * scale.y,
    right: Math.max(0, cssRight - barRight) * scale.x,
    bottom: Math.max(0, cssBottom - barBottom) * scale.y,
    left: Math.max(0, cssLeft - barLeft) * scale.x,
  }
}

/** Palette, kept in one place so sprites, bars and UI cannot drift apart. */
export const COLORS = {
  bg: 0x05060d,
  player: 0x8ef0ff,
  playerDark: 0x0f3b4d,
  playerWing: 0x2b6f88,
  thrust: 0xffb347,
  hostileBullet: 0xff5c7a,
  gold: 0xffd166,
  healthy: 0x5ad48a,
  warning: 0xffb347,
  critical: 0xff5c7a,
  white: 0xffffff,
  frame: 0x0b0f18,
  bossSpent: 0x2a1620,
} as const

export const FONT = 'ui-monospace, Menlo, Consolas, monospace'
