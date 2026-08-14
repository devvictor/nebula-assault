/**
 * HUD, as a parallel scene above the arena.
 *
 * A separate scene means the HUD keeps rendering while the arena is paused for a
 * menu or frozen by hit-stop — and it is never touched by the camera shake, so
 * the readout stays legible exactly when the screen is at its most violent.
 *
 * The top strip is RESERVED for the boss bar whether or not a boss is present, so
 * no HUD element ever moves when one appears. Nothing critical goes in the bottom
 * corners: on a phone they are under the player's thumbs and the gesture bar.
 */

import Phaser from 'phaser'

import { COLORS, DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, getInsets } from '../core/layout'
import { BALANCE } from '../data/balance'
import { waveLabel } from '../data/waves'
import { BAR, HealthBar } from '../objects/HealthBar'
import type { GameScene } from './GameScene'

const PAUSE_SIZE = 30

export class HudScene extends Phaser.Scene {
  private game_!: GameScene
  private pips: Phaser.GameObjects.Rectangle[] = []
  private scoreText!: Phaser.GameObjects.Text
  private multText!: Phaser.GameObjects.Text
  private waveText!: Phaser.GameObjects.Text
  private bannerText!: Phaser.GameObjects.Text
  private bannerSub!: Phaser.GameObjects.Text
  private bossBar?: HealthBar
  private lastScore = -1
  private lastHp = -1
  private lastMult = -1
  private lastChain = -1
  private lastWave = -1

  constructor() {
    super({ key: 'hud', active: false })
  }

  create(): void {
    this.game_ = this.scene.get('game') as GameScene
    const insets = getInsets(this)
    // Below the reserved boss-bar strip.
    const top = insets.top + 44

    // --- Hull pips (left) ----------------------------------------------------
    this.rebuildPips(insets.left + 12, top)

    // --- Score and multiplier (right) ---------------------------------------
    const right = GAME_WIDTH - insets.right - 12
    this.scoreText = this.add
      .text(right, top - 2, '000000', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#e8f4ff',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(DEPTH.bossBar)

    this.multText = this.add
      .text(right, top + 17, '', {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#ffd166',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(DEPTH.bossBar)

    // --- Wave label (centre) -------------------------------------------------
    this.waveText = this.add
      .text(GAME_WIDTH / 2, top + 1, 'WAVE 1-1', {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#8090a4',
      })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.bossBar)

    // --- Pause button --------------------------------------------------------
    this.buildPauseButton(insets.left + 8, insets.top + 6)

    // --- Banner --------------------------------------------------------------
    // Mid-field, not up top: at the top it lands on the boss and on incoming
    // waves, and readability outranks presentation.
    this.bannerText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.42, '', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.bossBar)
      .setAlpha(0)

    this.bannerSub = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.42 + 22, '', {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#ffd166',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.bossBar)
      .setAlpha(0)

    // --- Arena events --------------------------------------------------------
    const ev = this.game_.events
    ev.on('banner', this.showBanner, this)
    ev.on('boss-spawned', this.attachBossBar, this)
    ev.on('boss-damage', this.onBossDamage, this)
    ev.on('boss-phase', this.onBossPhase, this)
    ev.on('boss-defeated', this.detachBossBar, this)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      ev.off('banner', this.showBanner, this)
      ev.off('boss-spawned', this.attachBossBar, this)
      ev.off('boss-damage', this.onBossDamage, this)
      ev.off('boss-phase', this.onBossPhase, this)
      ev.off('boss-defeated', this.detachBossBar, this)
    })
  }

  private rebuildPips(x: number, y: number): void {
    for (const p of this.pips) p.destroy()
    this.pips = []
    const max = this.game_.ship?.stats.maxHp ?? BALANCE.player.maxHp
    for (let i = 0; i < max; i++) {
      const pip = this.add
        .rectangle(x + i * 13, y, 9, 12, COLORS.player)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0xffffff, 0.25)
        .setDepth(DEPTH.bossBar)
      this.pips.push(pip)
    }
  }

  private buildPauseButton(x: number, y: number): void {
    const box = this.add
      .rectangle(x, y, PAUSE_SIZE, PAUSE_SIZE, 0x000000, 0)
      .setOrigin(0, 0)
      .setStrokeStyle(1, COLORS.player, 0.45)
      .setDepth(DEPTH.bossBar)
      // Generous invisible padding: touch targets need it.
      .setInteractive(
        new Phaser.Geom.Rectangle(-10, -10, PAUSE_SIZE + 20, PAUSE_SIZE + 20),
        Phaser.Geom.Rectangle.Contains
      )

    this.add
      .rectangle(x + 10, y + 9, 3, 12, COLORS.player, 0.45)
      .setOrigin(0, 0)
      .setDepth(DEPTH.bossBar)
    this.add
      .rectangle(x + 17, y + 9, 3, 12, COLORS.player, 0.45)
      .setOrigin(0, 0)
      .setDepth(DEPTH.bossBar)

    box.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.game_.pause())
  }

  // --- Boss bar --------------------------------------------------------------

  private attachBossBar(): void {
    this.detachBossBar()
    const insets = getInsets(this)
    const width = Math.round(GAME_WIDTH * 0.78)
    this.bossBar = new HealthBar(
      this,
      Math.round((GAME_WIDTH - width) / 2),
      Math.round(insets.top + 12 + BAR.boss.labelSize + 4),
      width,
      'boss',
      BALANCE.boss.phases,
      this.game_.boss?.def.label ?? 'HIVECORE'
    )
    this.bossBar.setDepth(DEPTH.bossBar)
  }

  private detachBossBar(): void {
    this.bossBar?.destroy()
    this.bossBar = undefined
  }

  private onBossDamage(): void {
    this.bossBar?.damage()
  }

  private onBossPhase(): void {
    this.bossBar?.flashWhite()
  }

  // --- Banner ----------------------------------------------------------------

  private showBanner(text: string, sub: string): void {
    this.bannerText.setText(text)
    this.bannerSub.setText(sub)

    for (const target of [this.bannerText, this.bannerSub]) {
      this.tweens.killTweensOf(target)
      target.setAlpha(0)
      this.tweens.add({
        targets: target,
        alpha: 1,
        duration: 140,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.tweens.add({ targets: target, alpha: 0, delay: 1300, duration: 500 })
        },
      })
    }
  }

  // --- Frame ---------------------------------------------------------------

  override update(_time: number, delta: number): void {
    const g = this.game_
    if (!g?.ship) return

    // Only touch the display objects when a value actually changed.
    if (g.score !== this.lastScore) {
      this.lastScore = g.score
      this.scoreText.setText(String(g.score).padStart(6, '0'))
    }

    const mult = g.multiplier
    if (mult !== this.lastMult || g.chain !== this.lastChain) {
      this.lastMult = mult
      this.lastChain = g.chain
      this.multText.setText(mult > 1 ? `x${mult.toFixed(1)}  ${g.chain}` : g.chain > 0 ? `${g.chain}` : '')
      this.multText.setColor(mult > 1 ? '#ffd166' : '#7d8898')
    }

    if (g.waveIndex !== this.lastWave) {
      this.lastWave = g.waveIndex
      this.waveText.setText(`WAVE ${waveLabel(g.waveIndex)}`)
    }

    const hp = g.ship.hp
    const maxHp = g.ship.stats.maxHp
    if (hp !== this.lastHp || this.pips.length !== maxHp) {
      this.lastHp = hp
      if (this.pips.length !== maxHp) {
        const insets = getInsets(this)
        this.rebuildPips(insets.left + 12, insets.top + 44)
      }
      this.pips.forEach((pip, i) => {
        const filled = i < hp
        pip.setFillStyle(filled ? (hp === 1 ? COLORS.critical : COLORS.player) : 0xffffff, filled ? 1 : 0.14)
      })
    }

    // The boss bar is persistent for the whole fight and never moves.
    if (this.bossBar && g.boss) {
      this.bossBar.tick(g.boss.hp / g.boss.maxHp, delta)
    }
  }
}
