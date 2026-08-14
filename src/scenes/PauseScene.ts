import Phaser from 'phaser'

import { FONT, GAME_HEIGHT, GAME_WIDTH } from '../core/layout'
import { waveLabel } from '../data/waves'
import { Menu } from '../ui/menu'
import type { GameScene } from './GameScene'

export class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'pause', active: false })
  }

  create(): void {
    const game = this.scene.get('game') as GameScene
    const centre = GAME_WIDTH / 2

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05060d, 0.72).setOrigin(0, 0)

    this.add
      .text(centre, GAME_HEIGHT * 0.3, 'PAUSED', {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.add
      .text(
        centre,
        GAME_HEIGHT * 0.3 + 30,
        `WAVE ${waveLabel(game.waveIndex)}  ·  ${String(game.score).padStart(6, '0')}`,
        { fontFamily: FONT, fontSize: '11px', color: '#8090a4' }
      )
      .setOrigin(0.5)

    const resume = () => {
      this.scene.stop()
      this.scene.resume('game')
    }

    new Menu(
      this,
      [
        { id: 'resume', label: 'RESUME', primary: true },
        { id: 'settings', label: 'OPTIONS' },
        { id: 'quit', label: 'ABANDON RUN' },
      ],
      GAME_HEIGHT * 0.42,
      (id) => {
        if (id === 'resume') {
          resume()
        } else if (id === 'settings') {
          this.scene.launch('settings', { from: 'pause' })
          this.scene.pause()
        } else {
          this.scene.stop()
          this.scene.stop('hud')
          this.scene.stop('game')
          this.scene.start('title')
        }
      }
    )

    const kb = this.input.keyboard
    kb?.on('keydown-P', resume)
    kb?.on('keydown-ESC', resume)
  }
}
