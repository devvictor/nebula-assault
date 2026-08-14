/**
 * Procedural audio, running on Phaser's own AudioContext.
 *
 * Phaser's loader and sound manager expect asset files; this game has none by
 * design, so every sound is synthesised. Borrowing `scene.sound.context` means
 * Phaser still owns the context lifecycle — including the iOS unlock gesture and
 * suspend/resume on interruption — while the waveforms stay ours.
 *
 * Every impact layers a transient plus a body, with pitch randomised +/-8% and
 * volume +/-10%, or repeated shots turn into a drone. Voices are capped at 4.
 */

import Phaser from 'phaser'

import { settings } from './settings'

type VoiceKey =
  | 'shoot'
  | 'hit'
  | 'explode'
  | 'playerHit'
  | 'pickup'
  | 'phase'
  | 'ui'
  | 'wave'
  | 'dash'

const VOICE_CAP = 4

// Music bed: A minor-ish, 96 BPM, eighth notes.
const BEAT = 60 / 96 / 2
const BASS = [55, 55, 82.4, 55, 65.4, 65.4, 49, 49]
const ARP = [440, 523.3, 659.3, 523.3, 587.3, 440, 659.3, 587.3]

class Synth {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private voices = new Map<VoiceKey, number>()
  private musicOn = false
  private nextNoteTime = 0
  private step = 0

  /**
   * Binds to Phaser's Web Audio context. Safe to call from every scene's
   * create() — it only wires up once.
   */
  attach(scene: Phaser.Scene): void {
    if (this.ctx) return
    const manager = scene.sound
    if (!(manager instanceof Phaser.Sound.WebAudioSoundManager)) return
    const ctx = manager.context
    if (!ctx) return

    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(ctx.destination)

    this.sfxBus = ctx.createGain()
    this.sfxBus.gain.value = 1
    this.sfxBus.connect(this.master)

    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = 0.32
    this.musicBus.connect(this.master)

    // One second of white noise, reused by every noise-based sound.
    const len = Math.floor(ctx.sampleRate)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuf = buf

    this.nextNoteTime = ctx.currentTime
  }

  private get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  private claim(key: VoiceKey, dur: number): boolean {
    if (!settings.sfx || !this.ready) return false
    const n = this.voices.get(key) ?? 0
    if (n >= VOICE_CAP) return false
    this.voices.set(key, n + 1)
    window.setTimeout(
      () => this.voices.set(key, Math.max(0, (this.voices.get(key) ?? 1) - 1)),
      dur * 1000
    )
    return true
  }

  private tone(opts: {
    freq: number
    type?: OscillatorType
    dur: number
    gain: number
    sweepTo?: number
    delay?: number
  }): void {
    const ctx = this.ctx
    const bus = this.sfxBus
    if (!ctx || !bus) return

    const t0 = ctx.currentTime + (opts.delay ?? 0)
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = opts.type ?? 'square'

    const f = opts.freq * Phaser.Math.FloatBetween(0.92, 1.08)
    osc.frequency.setValueAtTime(f, t0)
    if (opts.sweepTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.sweepTo), t0 + opts.dur)
    }

    const peak = opts.gain * Phaser.Math.FloatBetween(0.9, 1.1)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur)

    osc.connect(g)
    g.connect(bus)
    osc.start(t0)
    osc.stop(t0 + opts.dur + 0.02)
  }

  private noise(opts: {
    dur: number
    gain: number
    freq: number
    sweepTo?: number
    q?: number
    delay?: number
  }): void {
    const ctx = this.ctx
    const bus = this.sfxBus
    if (!ctx || !bus || !this.noiseBuf) return

    const t0 = ctx.currentTime + (opts.delay ?? 0)
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(opts.freq, t0)
    filter.Q.value = opts.q ?? 1
    if (opts.sweepTo !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.sweepTo), t0 + opts.dur)
    }

    const g = ctx.createGain()
    g.gain.setValueAtTime(opts.gain * Phaser.Math.FloatBetween(0.9, 1.1), t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur)

    src.connect(filter)
    filter.connect(g)
    g.connect(bus)
    src.start(t0)
    src.stop(t0 + opts.dur + 0.02)
  }

  /** Ducks the music bed — used on phase breaks and player death. */
  duck(amount = 0.5, dur = 0.2): void {
    const ctx = this.ctx
    const bus = this.musicBus
    if (!ctx || !bus) return
    const t = ctx.currentTime
    const base = settings.music ? 0.32 : 0
    bus.gain.cancelScheduledValues(t)
    bus.gain.setValueAtTime(base * (1 - amount), t)
    bus.gain.linearRampToValueAtTime(base, t + dur + 0.15)
  }

  // --- Sound effects --------------------------------------------------------
  // Player fire is deliberately the quietest frequent sound in the mix.

  shoot(): void {
    if (!this.claim('shoot', 0.1)) return
    this.tone({ freq: 900, type: 'square', dur: 0.05, gain: 0.045, sweepTo: 420 })
    this.noise({ dur: 0.04, gain: 0.02, freq: 2600 })
  }

  hit(weight: 'light' | 'heavy' = 'light'): void {
    if (!this.claim('hit', 0.12)) return
    if (weight === 'light') {
      this.tone({ freq: 320, type: 'triangle', dur: 0.05, gain: 0.08, sweepTo: 160 })
      this.noise({ dur: 0.05, gain: 0.06, freq: 3200, sweepTo: 900 })
    } else {
      this.tone({ freq: 180, type: 'sawtooth', dur: 0.09, gain: 0.1, sweepTo: 90 })
      this.noise({ dur: 0.1, gain: 0.09, freq: 1800, sweepTo: 400 })
    }
  }

  explode(size: 'small' | 'medium' | 'large' = 'small'): void {
    if (!this.claim('explode', 0.5)) return
    if (size === 'small') {
      this.noise({ dur: 0.22, gain: 0.12, freq: 1400, sweepTo: 180 })
      this.tone({ freq: 220, type: 'triangle', dur: 0.16, gain: 0.07, sweepTo: 70 })
    } else if (size === 'medium') {
      this.noise({ dur: 0.4, gain: 0.18, freq: 1100, sweepTo: 110 })
      this.tone({ freq: 150, type: 'sawtooth', dur: 0.3, gain: 0.1, sweepTo: 45 })
    } else {
      this.noise({ dur: 1.1, gain: 0.26, freq: 900, sweepTo: 60 })
      this.tone({ freq: 90, type: 'sawtooth', dur: 0.8, gain: 0.14, sweepTo: 28 })
      this.noise({ dur: 0.5, gain: 0.16, freq: 1400, sweepTo: 120, delay: 0.22 })
      this.noise({ dur: 0.5, gain: 0.13, freq: 1200, sweepTo: 100, delay: 0.48 })
    }
  }

  playerHit(): void {
    if (!this.claim('playerHit', 0.4)) return
    this.duck(0.35, 0.2)
    this.tone({ freq: 260, type: 'sawtooth', dur: 0.3, gain: 0.16, sweepTo: 60 })
    this.noise({ dur: 0.3, gain: 0.12, freq: 900, sweepTo: 140 })
  }

  dash(): void {
    if (!this.claim('dash', 0.2)) return
    this.noise({ dur: 0.18, gain: 0.07, freq: 700, sweepTo: 2800, q: 2 })
  }

  pickup(): void {
    if (!this.claim('pickup', 0.2)) return
    this.tone({ freq: 780, type: 'triangle', dur: 0.07, gain: 0.07 })
    this.tone({ freq: 1170, type: 'triangle', dur: 0.09, gain: 0.06, delay: 0.06 })
  }

  phaseBreak(): void {
    if (!this.claim('phase', 0.8)) return
    this.duck(0.45, 0.25)
    this.tone({ freq: 520, type: 'square', dur: 0.5, gain: 0.13, sweepTo: 130 })
    this.noise({ dur: 0.6, gain: 0.16, freq: 1600, sweepTo: 90 })
  }

  bossDeath(): void {
    this.duck(0.7, 0.6)
    this.explode('large')
  }

  waveStart(): void {
    if (!this.claim('wave', 0.3)) return
    this.tone({ freq: 330, type: 'square', dur: 0.09, gain: 0.06 })
    this.tone({ freq: 494, type: 'square', dur: 0.12, gain: 0.06, delay: 0.09 })
  }

  ui(): void {
    if (!this.claim('ui', 0.12)) return
    this.tone({ freq: 660, type: 'square', dur: 0.05, gain: 0.06 })
  }

  // --- Music bed -----------------------------------------------------------

  startMusic(): void {
    this.musicOn = true
    if (this.ctx) this.nextNoteTime = Math.max(this.nextNoteTime, this.ctx.currentTime)
  }

  stopMusic(): void {
    this.musicOn = false
  }

  /** Schedules the music bed ahead of the audio clock. Call once per frame. */
  tick(): void {
    const ctx = this.ctx
    const bus = this.musicBus
    if (!ctx || !bus || !this.musicOn || !settings.music || ctx.state !== 'running') return

    const lookahead = 0.25
    while (this.nextNoteTime < ctx.currentTime + lookahead) {
      const t = Math.max(this.nextNoteTime, ctx.currentTime)
      const i = this.step % 8

      const bass = ctx.createOscillator()
      const bg = ctx.createGain()
      bass.type = 'sawtooth'
      bass.frequency.setValueAtTime(BASS[i], t)
      bg.gain.setValueAtTime(0.0001, t)
      bg.gain.exponentialRampToValueAtTime(0.5, t + 0.01)
      bg.gain.exponentialRampToValueAtTime(0.0001, t + BEAT * 0.9)
      bass.connect(bg)
      bg.connect(bus)
      bass.start(t)
      bass.stop(t + BEAT)

      // Sparse arp on odd steps, so the bed stays out of the way.
      if (i % 2 === 1) {
        const arp = ctx.createOscillator()
        const ag = ctx.createGain()
        arp.type = 'triangle'
        arp.frequency.setValueAtTime(ARP[i], t)
        ag.gain.setValueAtTime(0.0001, t)
        ag.gain.exponentialRampToValueAtTime(0.14, t + 0.02)
        ag.gain.exponentialRampToValueAtTime(0.0001, t + BEAT * 1.6)
        arp.connect(ag)
        ag.connect(bus)
        arp.start(t)
        arp.stop(t + BEAT * 2)
      }

      this.nextNoteTime = t + BEAT
      this.step++
    }
  }
}

export const synth = new Synth()
