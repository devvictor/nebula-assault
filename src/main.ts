/**
 * Phaser game configuration.
 *
 * The Scale Manager owns the fixed logical resolution and letterboxing that used
 * to be hand-rolled: FIT + CENTER_BOTH gives 480x854 game units on every device,
 * so all gameplay maths stays in logical units regardless of screen size.
 *
 * Arcade physics runs with fixedStep so the simulation is identical at 60, 90 and
 * 120 Hz — phones vary, and variable-timestep physics would change the game.
 */

import Phaser from 'phaser'

import { settings } from './core/settings'
import { GAME_HEIGHT, GAME_WIDTH } from './core/layout'
import { BootScene } from './scenes/BootScene'
import { GameOverScene } from './scenes/GameOverScene'
import { GameScene } from './scenes/GameScene'
import { HudScene } from './scenes/HudScene'
import { PauseScene } from './scenes/PauseScene'
import { SettingsScene } from './scenes/SettingsScene'
import { TitleScene } from './scenes/TitleScene'
import { UpgradeScene } from './scenes/UpgradeScene'

function boot(): Phaser.Game {
  settings.load()

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'app',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#05060d',

    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },

    // Cap the resolution: rendering at DPR 3 on a phone burns the frame budget
    // for pixels nobody perceives.
    render: {
      antialias: true,
      powerPreference: 'high-performance',
    },

    fps: {
      target: 60,
      min: 30,
    },

    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        // Identical simulation at any refresh rate.
        fixedStep: true,
        fps: 60,
        debug: false,
      },
    },

    input: {
      // Three pointers: one to fly, a second for the dash gesture, one spare.
      activePointers: 3,
    },

    audio: {
      // Web Audio, unlocked by Phaser on the first user gesture (iOS requirement).
      disableWebAudio: false,
    },

    scene: [
      BootScene,
      TitleScene,
      GameScene,
      HudScene,
      UpgradeScene,
      PauseScene,
      GameOverScene,
      SettingsScene,
    ],
  }

  return new Phaser.Game(config)
}

try {
  const game = boot()

  if (import.meta.env.DEV) {
    // Dev-only handles. Phaser's loop is driven by requestAnimationFrame, which
    // the browser pauses whenever the tab is hidden, so stepping the game by
    // hand is the only way to inspect it from an automated session.
    const dev = window as unknown as Record<string, unknown>
    dev.__game = game
    dev.__step = (frames = 1, deltaMs = 1000 / 60) => {
      for (let i = 0; i < frames; i++) {
        game.step(performance.now() + i * deltaMs, deltaMs)
      }
    }
  }
} catch (err) {
  console.error(err)
  const el = document.getElementById('boot-error')
  if (el) el.style.display = 'grid'
}
