/**
 * Menu widget shared by every overlay scene.
 *
 * Every touch target is at least 44 game units tall, with generous invisible
 * padding, and the whole list is keyboard navigable.
 */

import Phaser from 'phaser'

import { COLORS, FONT, GAME_WIDTH } from '../core/layout'
import { synth } from '../core/synth'

export interface MenuItem {
  id: string
  label: string
  sub?: string
  /** highlighted — used for the primary action and for behavioural upgrades */
  primary?: boolean
  height?: number
}

const MIN_TOUCH = 50

export class Menu {
  private readonly buttons: {
    item: MenuItem
    box: Phaser.GameObjects.Rectangle
    label: Phaser.GameObjects.Text
    sub?: Phaser.GameObjects.Text
  }[] = []

  private cursor = 0

  constructor(
    private readonly scene: Phaser.Scene,
    items: MenuItem[],
    startY: number,
    private readonly onSelect: (id: string) => void,
    opts?: { width?: number; gap?: number; depth?: number }
  ) {
    const width = opts?.width ?? Math.min(268, GAME_WIDTH - 64)
    const gap = opts?.gap ?? 12
    const depth = opts?.depth ?? 1000

    let y = startY
    for (const item of items) {
      const h = item.height ?? MIN_TOUCH
      const x = (GAME_WIDTH - width) / 2

      const box = scene.add
        .rectangle(x, y, width, h, item.primary ? 0x8ef0ff : 0xffffff, item.primary ? 0.14 : 0.05)
        .setOrigin(0, 0)
        .setStrokeStyle(1, item.primary ? COLORS.player : 0xffffff, item.primary ? 0.55 : 0.22)
        .setDepth(depth)
        .setInteractive({ useHandCursor: true })

      const labelY = item.sub ? y + h * 0.34 : y + h / 2
      const label = scene.add
        .text(GAME_WIDTH / 2, labelY, item.label, {
          fontFamily: FONT,
          fontSize: '14px',
          color: item.primary ? '#d8fbff' : '#e8f4ff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(depth + 1)

      let sub: Phaser.GameObjects.Text | undefined
      if (item.sub) {
        sub = scene.add
          .text(GAME_WIDTH / 2, y + h * 0.68, item.sub, {
            fontFamily: FONT,
            fontSize: '10px',
            color: '#b8c6d6',
            align: 'center',
            wordWrap: { width: width - 20 },
          })
          .setOrigin(0.5)
          .setDepth(depth + 1)
      }

      const entry = { item, box, label, sub }
      this.buttons.push(entry)

      const index = this.buttons.length - 1
      box.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.focus(index))
      box.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        this.focus(index)
        this.activate(index)
      })

      y += h + gap
    }

    this.bindKeys()
    this.focus(0)
  }

  private bindKeys(): void {
    const kb = this.scene.input.keyboard
    if (!kb) return
    kb.on('keydown-UP', this.onUp, this)
    kb.on('keydown-W', this.onUp, this)
    kb.on('keydown-DOWN', this.onDown, this)
    kb.on('keydown-S', this.onDown, this)
    kb.on('keydown-ENTER', this.onEnter, this)
    kb.on('keydown-SPACE', this.onEnter, this)
    kb.on('keydown-ONE', () => this.activate(0), this)
    kb.on('keydown-TWO', () => this.activate(1), this)
    kb.on('keydown-THREE', () => this.activate(2), this)

    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.off('keydown-UP', this.onUp, this)
      kb.off('keydown-W', this.onUp, this)
      kb.off('keydown-DOWN', this.onDown, this)
      kb.off('keydown-S', this.onDown, this)
      kb.off('keydown-ENTER', this.onEnter, this)
      kb.off('keydown-SPACE', this.onEnter, this)
    })
  }

  private onUp = () => this.move(-1)
  private onDown = () => this.move(1)
  private onEnter = () => this.activate(this.cursor)

  private move(delta: number): void {
    if (this.buttons.length === 0) return
    this.focus((this.cursor + delta + this.buttons.length) % this.buttons.length)
  }

  private focus(index: number): void {
    this.cursor = index
    this.buttons.forEach((b, i) => {
      const focused = i === index
      b.box.setStrokeStyle(
        focused ? 2 : 1,
        focused ? COLORS.player : b.item.primary ? COLORS.player : 0xffffff,
        focused ? 1 : b.item.primary ? 0.55 : 0.22
      )
    })
  }

  private activate(index: number): void {
    const entry = this.buttons[index]
    if (!entry) return
    synth.ui()
    this.onSelect(entry.item.id)
  }
}
