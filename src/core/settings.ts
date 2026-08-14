/**
 * Player settings, persisted through the storage adapter.
 *
 * `intensity` is the accessibility scaler: it multiplies camera shake, flash
 * alpha, particle counts and haptic strength. At 0 the game must remain fully
 * playable with identical timings and hitboxes.
 */

import Phaser from 'phaser'

import { storage } from '../platform/storage'
import { haptics } from '../platform/haptics'

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export const settings = {
  /** 0..1 visual intensity. Defaults to 0.4 when the OS asks for less motion. */
  intensity: 1,
  sfx: true,
  music: true,
  haptics: true,
  /** Holding a fire button while steering with one thumb is worse than it sounds. */
  autoFire: true,
  highScore: 0,
  bestWave: 0,

  load(): void {
    const defaultIntensity = prefersReducedMotion() ? 0.4 : 1
    this.intensity = Phaser.Math.Clamp(storage.getNumber('intensity', defaultIntensity), 0, 1)
    this.sfx = storage.getBool('sfx', true)
    this.music = storage.getBool('music', true)
    this.haptics = storage.getBool('haptics', true)
    this.autoFire = storage.getBool('autoFire', true)
    this.highScore = storage.getNumber('highScore', 0)
    this.bestWave = storage.getNumber('bestWave', 0)
    haptics.setEnabled(this.haptics)
  },

  save(): void {
    storage.set('intensity', String(this.intensity))
    storage.set('sfx', this.sfx ? '1' : '0')
    storage.set('music', this.music ? '1' : '0')
    storage.set('haptics', this.haptics ? '1' : '0')
    storage.set('autoFire', this.autoFire ? '1' : '0')
    storage.set('highScore', String(this.highScore))
    storage.set('bestWave', String(this.bestWave))
    haptics.setEnabled(this.haptics)
  },

  recordRun(score: number, wave: number): boolean {
    let record = false
    if (score > this.highScore) {
      this.highScore = score
      record = true
    }
    if (wave > this.bestWave) this.bestWave = wave
    this.save()
    return record
  },
}
