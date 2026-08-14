import Phaser from 'phaser'

import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, getInsets } from '../core/layout'
import { settings } from '../core/settings'
import { synth } from '../core/synth'
import { waveLabel } from '../data/waves'
import { TEX } from '../systems/textures'
import { Menu } from '../ui/menu'

/** Title screen, over a live drifting starfield so the menu is not a still image. */
export class TitleScene extends Phaser.Scene {
  private stars: Phaser.GameObjects.TileSprite[] = []

  constructor() {
    super('title')
  }

  create(): void {
    synth.attach(this)

    this.stars = TEX.stars.map((key, i) =>
      this.add
        .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, key)
        .setOrigin(0, 0)
        .setDepth(DEPTH.background + i)
    )

    const insets = getInsets(this)
    const centre = GAME_WIDTH / 2

    this.add
      .text(centre, insets.top + 150, 'NEBULA', {
        fontFamily: FONT,
        fontSize: '40px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.add
      .text(centre, insets.top + 192, 'ASSAULT', {
        fontFamily: FONT,
        fontSize: '40px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.add
      .text(centre, insets.top + 224, 'ARCADE SHOOTER', {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#ffd166',
      })
      .setOrigin(0.5)

    if (settings.highScore > 0) {
      this.add
        .text(
          centre,
          insets.top + 262,
          `BEST ${String(settings.highScore).padStart(6, '0')}  ·  WAVE ${waveLabel(
            Math.max(0, settings.bestWave - 1)
          )}`,
          { fontFamily: FONT, fontSize: '11px', color: '#8090a4' }
        )
        .setOrigin(0.5)
    }

    // A parked ship, so the screen reads as a game rather than a form.
    this.add.image(centre, GAME_HEIGHT * 0.74, TEX.player).setScale(1.6)

    new Menu(
      this,
      [
        { id: 'play', label: 'LAUNCH', primary: true },
        { id: 'settings', label: 'OPTIONS' },
      ],
      GAME_HEIGHT * 0.52,
      (id) => {
        if (id === 'play') {
          this.scene.start('game')
        } else {
          this.scene.launch('settings', { from: 'title' })
          this.scene.pause()
        }
      }
    )

    const hintY = GAME_HEIGHT - insets.bottom - 74
    const hint = (text: string, y: number, alpha: number) =>
      this.add
        .text(centre, y, text, { fontFamily: FONT, fontSize: '10px', color: '#7d8898' })
        .setOrigin(0.5)
        .setAlpha(alpha)

    hint('DRAG ANYWHERE TO FLY', hintY, 0.9)
    hint('SECOND FINGER OR DOUBLE-TAP TO DASH', hintY + 15, 0.9)
    hint('AUTO-FIRE IS ON  ·  KEYBOARD: WASD / SHIFT', hintY + 30, 0.6)
  }

  override update(_time: number, delta: number): void {
    const rates = [0.3, 0.68, 1.2]
    this.stars.forEach((layer, i) => {
      layer.tilePositionY += rates[i] * (delta / 16.6)
    })
  }
}
