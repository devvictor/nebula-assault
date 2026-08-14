import Phaser from 'phaser'

import { FONT, GAME_HEIGHT, GAME_WIDTH } from '../core/layout'
import { settings } from '../core/settings'
import { waveLabel } from '../data/waves'
import { Menu } from '../ui/menu'
import type { GameScene } from './GameScene'

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'gameover', active: false })
  }

  create(): void {
    const game = this.scene.get('game') as GameScene
    const centre = GAME_WIDTH / 2
    const y = GAME_HEIGHT * 0.26

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05060d, 0.8).setOrigin(0, 0)

    this.add
      .text(centre, y, game.newRecord ? 'NEW RECORD' : 'HULL BREACH', {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.add
      .text(centre, y + 44, 'SCORE', { fontFamily: FONT, fontSize: '10px', color: '#7d8898' })
      .setOrigin(0.5)

    this.add
      .text(centre, y + 68, String(game.score).padStart(6, '0'), {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#ffd166',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.add
      .text(
        centre,
        y + 98,
        `REACHED WAVE ${waveLabel(game.waveIndex)}  ·  ${game.kills} KILLS`,
        { fontFamily: FONT, fontSize: '11px', color: '#b8c6d6' }
      )
      .setOrigin(0.5)

    this.add
      .text(centre, y + 116, `BEST ${String(settings.highScore).padStart(6, '0')}`, {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#6d7788',
      })
      .setOrigin(0.5)

    new Menu(
      this,
      [
        { id: 'retry', label: 'LAUNCH AGAIN', primary: true },
        { id: 'menu', label: 'MAIN MENU' },
      ],
      GAME_HEIGHT * 0.56,
      (id) => {
        this.scene.stop()
        this.scene.stop('hud')
        this.scene.stop('game')
        this.scene.start(id === 'retry' ? 'game' : 'title')
      }
    )
  }
}
