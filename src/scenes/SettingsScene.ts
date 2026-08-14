import Phaser from 'phaser'

import { FONT, GAME_HEIGHT, GAME_WIDTH, getInsets } from '../core/layout'
import { settings } from '../core/settings'
import { synth } from '../core/synth'
import { Menu } from '../ui/menu'

interface SettingsData {
  from?: 'title' | 'pause'
}

function intensityLabel(v: number): string {
  if (v <= 0.05) return 'OFF'
  if (v <= 0.5) return 'REDUCED'
  return 'FULL'
}

export class SettingsScene extends Phaser.Scene {
  private from: 'title' | 'pause' = 'title'

  constructor() {
    super({ key: 'settings', active: false })
  }

  init(data: SettingsData): void {
    this.from = data?.from ?? 'title'
  }

  create(): void {
    this.build()
  }

  /** Rebuilt after each toggle so the labels always show the live values. */
  private build(): void {
    this.children.removeAll()
    this.tweens.killAll()

    const insets = getInsets(this)
    const centre = GAME_WIDTH / 2

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05060d, 0.86).setOrigin(0, 0)

    this.add
      .text(centre, insets.top + 90, 'OPTIONS', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    const y0 = insets.top + 130

    new Menu(
      this,
      [
        {
          id: 'intensity',
          label: 'EFFECTS',
          sub: `SHAKE / FLASH / PARTICLES — ${intensityLabel(settings.intensity)}`,
          height: 50,
        },
        {
          id: 'autoFire',
          label: 'AUTO-FIRE',
          sub: settings.autoFire ? 'ON — RECOMMENDED ON TOUCH' : 'OFF — HOLD TO FIRE',
          height: 50,
        },
        { id: 'sfx', label: 'SOUND EFFECTS', sub: settings.sfx ? 'ON' : 'OFF', height: 50 },
        { id: 'music', label: 'MUSIC', sub: settings.music ? 'ON' : 'OFF', height: 50 },
        { id: 'haptics', label: 'VIBRATION', sub: settings.haptics ? 'ON' : 'OFF', height: 50 },
        { id: 'back', label: 'BACK', primary: true },
      ],
      y0,
      (id) => this.onSelect(id),
      { gap: 8 }
    )

    this.add
      .text(centre, GAME_HEIGHT - insets.bottom - 40, 'EFFECTS OFF KEEPS EVERY GAMEPLAY TIMING IDENTICAL', {
        fontFamily: FONT,
        fontSize: '9px',
        color: '#6d7788',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 60 },
      })
      .setOrigin(0.5)
  }

  private onSelect(id: string): void {
    switch (id) {
      case 'intensity':
        // Cycles FULL -> REDUCED -> OFF.
        settings.intensity = settings.intensity > 0.5 ? 0.4 : settings.intensity > 0.05 ? 0 : 1
        break
      case 'autoFire':
        settings.autoFire = !settings.autoFire
        break
      case 'sfx':
        settings.sfx = !settings.sfx
        break
      case 'music':
        settings.music = !settings.music
        if (settings.music) synth.startMusic()
        else synth.stopMusic()
        break
      case 'haptics':
        settings.haptics = !settings.haptics
        break
      case 'back':
        settings.save()
        this.scene.stop()
        this.scene.resume(this.from === 'pause' ? 'pause' : 'title')
        return
    }

    settings.save()
    this.build()
  }
}
