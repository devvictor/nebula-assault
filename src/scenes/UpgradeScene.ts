import Phaser from 'phaser'

import { FONT, GAME_HEIGHT, GAME_WIDTH, getInsets } from '../core/layout'
import { applyUpgrade } from '../data/upgrades'
import { Menu, type MenuItem } from '../ui/menu'
import type { GameScene } from './GameScene'

/**
 * Upgrade choice, over the paused arena.
 *
 * Behavioural options are highlighted, and one is always present — the player
 * should be making a real decision, not picking a percentage.
 */
export class UpgradeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'upgrade', active: false })
  }

  create(): void {
    const game = this.scene.get('game') as GameScene
    const insets = getInsets(this)
    const centre = GAME_WIDTH / 2

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05060d, 0.78).setOrigin(0, 0)

    this.add
      .text(centre, insets.top + 92, 'SYSTEMS ONLINE', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.add
      .text(centre, insets.top + 118, 'CHOOSE ONE', {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#ffd166',
      })
      .setOrigin(0.5)

    const items: MenuItem[] = game.offers.map((u, i) => ({
      id: String(i),
      label: u.label,
      sub: u.desc,
      primary: u.behavioural,
      height: 72,
    }))

    const startY = insets.top + 152

    new Menu(this, items, startY, (id) => {
      const upgrade = game.offers[Number(id)]
      if (!upgrade) return

      applyUpgrade(game.ship.stats, upgrade)
      if (upgrade.unique) game.takenUpgrades.add(upgrade.id)
      // Hull Plating repairs as well as extending the bar.
      if (upgrade.id === 'hull') {
        game.ship.hp = Math.min(game.ship.stats.maxHp, game.ship.hp + 1)
      }

      game.offers = []
      this.scene.stop()
      this.scene.resume('game')
      game.resumeAfterUpgrade(upgrade.label)
    })

    this.add
      .text(centre, startY + items.length * 84 + 8, 'BEHAVIOURAL UPGRADES ARE HIGHLIGHTED', {
        fontFamily: FONT,
        fontSize: '9px',
        color: '#6d7788',
      })
      .setOrigin(0.5)
  }
}
