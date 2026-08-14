/**
 * The arena. Owns the simulation, the run state, and combat resolution.
 *
 * Response order for a hit is deliberate:
 *   frame 0      register, sound, spark, white flash
 *   frames 0..N  hit-stop on the TARGET only — freezing the player on their own
 *                hit reads as input lag
 *   after that   shake
 *   then         damage number, health bar's delayed drain
 *
 * Global hit-stop (player damage, phase break, boss death) pauses the Arcade
 * world, so combat freezes while particles, tweens and the HUD keep running.
 *
 * Regular enemies are pooled in one group; the boss lives in its own group of
 * one, because a pool with `classType: Enemy` cannot hand back a Boss.
 */

import Phaser from 'phaser'

import {
  COLORS,
  DEPTH,
  GAME_HEIGHT,
  GAME_WIDTH,
  getInsets,
  TAU,
  type Insets,
} from '../core/layout'
import { settings } from '../core/settings'
import { synth } from '../core/synth'
import { BALANCE } from '../data/balance'
import { type EnemyId, type MovementId } from '../data/enemies'
import { offerUpgrades, type Upgrade, type UpgradeId } from '../data/upgrades'
import { haptics } from '../platform/haptics'
import { Boss, CORE_OPEN_MULT } from '../objects/Boss'
import { Bullet } from '../objects/Bullet'
import { Enemy } from '../objects/Enemy'
import { Pickup, type PickupKind } from '../objects/Pickup'
import { Player } from '../objects/Player'
import { Juice } from '../systems/Juice'
import {
  makeHostileSpawner,
  wallGapIndex,
  WALL_SLOTS,
  type BulletSpawner,
} from '../systems/patterns'
import { TEX } from '../systems/textures'
import { WaveDirector } from '../systems/WaveDirector'

const GRAZE_MARGIN = 15
const DOUBLE_TAP_MS = 280
const TAP_MOVE_MAX = 12
const DEATH_HOLD = 1250

interface TrackedPointer {
  id: number
  startX: number
  startY: number
  startT: number
}

export class GameScene extends Phaser.Scene {
  ship!: Player
  juice!: Juice
  director!: WaveDirector

  enemies!: Phaser.Physics.Arcade.Group
  bosses!: Phaser.Physics.Arcade.Group
  playerBullets!: Phaser.Physics.Arcade.Group
  hostileBullets!: Phaser.Physics.Arcade.Group
  pickups!: Phaser.Physics.Arcade.Group

  hostileSpawner!: BulletSpawner
  boss: Boss | null = null

  // --- Run state ------------------------------------------------------------
  score = 0
  chain = 0
  kills = 0
  newRecord = false
  takenUpgrades = new Set<UpgradeId>()
  offers: Upgrade[] = []

  insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

  private chainT = 0
  private deathHold = 0
  private killerRing?: Phaser.GameObjects.Image

  private stars: Phaser.GameObjects.TileSprite[] = []
  private telegraphGfx!: Phaser.GameObjects.Graphics
  private dashGfx!: Phaser.GameObjects.Graphics
  private warnings: { img: Phaser.GameObjects.Image; t: number }[] = []

  // --- Input ---------------------------------------------------------------
  private pointers: TrackedPointer[] = []
  private primaryX = 0
  private primaryY = 0
  private pointerJustPressed = false
  private lastTapT = -Infinity
  private keys?: Record<string, Phaser.Input.Keyboard.Key>

  constructor() {
    super('game')
  }

  create(): void {
    synth.attach(this)

    // --- Background: three parallax layers as scrolling TileSprites ---------
    this.stars = TEX.stars.map((key, i) =>
      this.add
        .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, key)
        .setOrigin(0, 0)
        .setDepth(DEPTH.background + i)
        .setScrollFactor(0)
    )

    this.juice = new Juice(this)
    this.telegraphGfx = this.add.graphics().setDepth(DEPTH.telegraph)
    this.dashGfx = this.add.graphics().setDepth(DEPTH.player - 1)

    // --- Pools: Arcade groups recycle, so nothing allocates during play -----
    this.enemies = this.physics.add.group({
      classType: Enemy,
      maxSize: BALANCE.pools.enemies,
      runChildUpdate: true,
    })
    this.bosses = this.physics.add.group({
      classType: Boss,
      maxSize: 1,
      runChildUpdate: true,
    })
    this.playerBullets = this.physics.add.group({
      classType: Bullet,
      maxSize: BALANCE.pools.playerBullets,
      runChildUpdate: true,
    })
    this.hostileBullets = this.physics.add.group({
      classType: Bullet,
      maxSize: BALANCE.pools.enemyBullets,
      runChildUpdate: true,
    })
    this.pickups = this.physics.add.group({
      classType: Pickup,
      maxSize: BALANCE.pools.pickups,
      runChildUpdate: true,
    })

    this.hostileSpawner = makeHostileSpawner(this.hostileBullets)
    this.ship = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT * 0.78)

    // --- Collision ----------------------------------------------------------
    for (const group of [this.enemies, this.bosses]) {
      this.physics.add.overlap(this.playerBullets, group, (a, b) => {
        const bullet = (a instanceof Bullet ? a : b) as Bullet
        const enemy = (a instanceof Bullet ? b : a) as Enemy
        this.onBulletHitEnemy(bullet, enemy)
      })
      this.physics.add.overlap(group, this.ship, (a, b) => {
        const enemy = (a instanceof Enemy ? a : b) as Enemy
        this.onEnemyTouchPlayer(enemy)
      })
    }

    this.physics.add.overlap(this.hostileBullets, this.ship, (a, b) => {
      this.onHostileBulletHitPlayer((a instanceof Bullet ? a : b) as Bullet)
    })
    this.physics.add.overlap(this.pickups, this.ship, (a, b) => {
      this.collectPickup((a instanceof Pickup ? a : b) as Pickup)
    })

    this.bindInput()

    // Safe-area insets are a layout read, so they are cached rather than
    // recomputed every frame.
    this.refreshInsets()
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.refreshInsets())

    this.director = new WaveDirector(this)
    this.resetRun()

    this.scene.launch('hud')
    if (settings.music) synth.startMusic()

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => synth.stopMusic())
  }

  private refreshInsets(): void {
    this.insets = getInsets(this)
  }

  get waveIndex(): number {
    return this.director?.index ?? 0
  }

  // --- Run lifecycle --------------------------------------------------------

  private resetRun(): void {
    this.score = 0
    this.chain = 0
    this.chainT = 0
    this.kills = 0
    this.newRecord = false
    this.deathHold = 0
    this.takenUpgrades.clear()
    this.offers = []
    this.boss = null

    this.enemies.clear(true, true)
    this.bosses.clear(true, true)
    this.playerBullets.clear(true, true)
    this.hostileBullets.clear(true, true)
    this.pickups.clear(true, true)

    this.ship.reset()
    this.juice.reset()
    this.director.reset()
    this.director.start(0)
  }

  // --- Input ----------------------------------------------------------------

  private bindInput(): void {
    this.input.addPointer(2)

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      // A second concurrent pointer is the mobile dash gesture — no on-screen
      // button, so it never occupies screen space.
      if (this.pointers.length > 0) this.ship.requestDash(this.time.now)

      this.pointers.push({ id: p.id, startX: p.worldX, startY: p.worldY, startT: this.time.now })

      if (this.pointers.length === 1) {
        this.primaryX = p.worldX
        this.primaryY = p.worldY
        this.pointerJustPressed = true
      }
    })

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (this.pointers.length > 0 && this.pointers[0].id === p.id) {
        this.primaryX = p.worldX
        this.primaryY = p.worldY
      }
    })

    const release = (p: Phaser.Input.Pointer) => {
      const i = this.pointers.findIndex((q) => q.id === p.id)
      if (i < 0) return
      const tracked = this.pointers[i]
      const wasPrimary = i === 0
      this.pointers.splice(i, 1)

      const held = this.time.now - tracked.startT
      const travel = Phaser.Math.Distance.Between(
        tracked.startX,
        tracked.startY,
        p.worldX,
        p.worldY
      )
      if (held <= 250 && travel <= TAP_MOVE_MAX) {
        // Double tap is the alternate dash gesture, for one-thumb play.
        if (this.time.now - this.lastTapT <= DOUBLE_TAP_MS) {
          this.ship.requestDash(this.time.now)
          this.lastTapT = -Infinity
        } else {
          this.lastTapT = this.time.now
        }
      }

      // Handing control to another finger must re-anchor the drag, or the ship
      // jumps by the difference between the two offsets.
      if (wasPrimary && this.pointers.length > 0) this.pointerJustPressed = true
    }

    this.input.on(Phaser.Input.Events.POINTER_UP, release)
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release)

    const kb = this.input.keyboard
    if (kb) {
      this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,Z,X,P,ESC') as Record<
        string,
        Phaser.Input.Keyboard.Key
      >
      kb.on('keydown-SHIFT', () => this.ship.requestDash(this.time.now))
      kb.on('keydown-Z', () => this.ship.requestDash(this.time.now))
      kb.on('keydown-P', () => this.pause())
      kb.on('keydown-ESC', () => this.pause())
    }
  }

  private get moveAxis(): { x: number; y: number } {
    const k = this.keys
    if (!k) return { x: 0, y: 0 }
    const left = k.A?.isDown || k.LEFT?.isDown
    const right = k.D?.isDown || k.RIGHT?.isDown
    const up = k.W?.isDown || k.UP?.isDown
    const down = k.S?.isDown || k.DOWN?.isDown
    return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) }
  }

  // --- Frame ---------------------------------------------------------------

  override update(_time: number, delta: number): void {
    synth.tick()
    this.juice.update(delta)
    this.scrollStars(delta)
    this.tickWarnings(delta)
    this.drawTelegraphs()
    this.drawDashRing()

    // Hit-stop: combat is frozen, presentation is not.
    if (this.juice.frozen > 0) {
      this.pointerJustPressed = false
      return
    }

    // Death beat: hold on whatever killed the player, then transition.
    if (!this.ship.alive) {
      this.deathHold -= delta
      if (this.deathHold <= 0) this.gameOver()
      this.pointerJustPressed = false
      return
    }

    const axis = this.moveAxis
    const wantsFire =
      settings.autoFire ||
      Boolean(this.keys?.SPACE?.isDown) ||
      Boolean(this.keys?.X?.isDown) ||
      this.pointers.length > 0

    this.ship.drive(
      {
        pointerActive: this.pointers.length > 0,
        pointerJustPressed: this.pointerJustPressed,
        pointerX: this.primaryX,
        pointerY: this.primaryY,
        moveX: axis.x,
        moveY: axis.y,
        wantsFire,
      },
      this.time.now,
      delta
    )
    this.pointerJustPressed = false

    this.ship.clampToField(
      this.insets.top,
      this.insets.bottom,
      this.insets.left,
      this.insets.right
    )

    this.steerHomingBullets(delta)
    this.updatePickups(delta)
    this.checkGraze()
    this.director.update(delta)

    // The chain decays from inaction as well as from damage.
    if (this.chain > 0) {
      this.chainT -= delta
      if (this.chainT <= 0) this.breakChain()
    }

    if (this.director.awaitingUpgrade) this.openUpgrade()
  }

  private scrollStars(delta: number): void {
    // The starfield keeps moving in every state — a still background reads as a
    // frozen game. It speeds up for a boss.
    const speed = (this.boss ? 1.5 : 1) * (delta / 16.6)
    const rates = [0.44, 0.97, 1.73]
    this.stars.forEach((layer, i) => {
      layer.tilePositionY += rates[i] * speed
    })
  }

  /**
   * Dash readiness, as a small arc under the ship. Diegetic on purpose: it keeps
   * the HUD out of the bottom corners, which a thumb covers on a phone.
   */
  private drawDashRing(): void {
    const g = this.dashGfx
    g.clear()
    if (!this.ship.alive) return

    const frac = Phaser.Math.Clamp(this.ship.dashCooldownFraction, 0, 1)
    const ready = frac >= 1
    const y = this.ship.y + BALANCE.player.drawRadius + 9

    g.lineStyle(2, COLORS.player, ready ? 0.7 : 0.28)
    g.beginPath()
    g.arc(this.ship.x, y, 5, -Math.PI / 2, -Math.PI / 2 + TAU * frac)
    g.strokePath()
  }

  /** Iterates every hostile, pooled or boss. */
  private forEachEnemy(fn: (e: Enemy) => void): void {
    for (const obj of this.enemies.getChildren()) fn(obj as Enemy)
    for (const obj of this.bosses.getChildren()) fn(obj as Enemy)
  }

  private steerHomingBullets(delta: number): void {
    for (const obj of this.playerBullets.getChildren()) {
      const b = obj as Bullet
      if (!b.active || b.homing <= 0) continue
      const target = this.nearestEnemy(b.x, b.y, 240)
      if (target) b.steerToward(target.x, target.y, delta)
    }
  }

  private updatePickups(delta: number): void {
    const radius = this.ship.stats.magnet
      ? BALANCE.pickups.magnetRadiusUpgraded
      : BALANCE.pickups.magnetRadius
    for (const obj of this.pickups.getChildren()) {
      const p = obj as Pickup
      if (p.active) p.pullToward(this.ship.x, this.ship.y, radius, delta)
    }
  }

  /** Risk Sensors: near-misses build the chain. Rewards flying close. */
  private checkGraze(): void {
    if (!this.ship.stats.graze) return
    const reach = BALANCE.player.radius + 5 + GRAZE_MARGIN
    for (const obj of this.hostileBullets.getChildren()) {
      const b = obj as Bullet
      if (!b.active || b.grazed) continue
      if (Phaser.Math.Distance.Between(b.x, b.y, this.ship.x, this.ship.y) <= reach) {
        b.grazed = true
        this.addChain(1)
        this.juice.spark(
          b.x,
          b.y,
          Math.atan2(this.ship.y - b.y, this.ship.x - b.x),
          COLORS.player,
          2
        )
      }
    }
  }

  // --- Telegraphs and warnings ---------------------------------------------

  warnAt(x: number, y: number, ms: number): void {
    const img = this.add.image(x, y, TEX.warning).setDepth(DEPTH.warning)
    this.warnings.push({ img, t: ms })
  }

  private tickWarnings(delta: number): void {
    for (let i = this.warnings.length - 1; i >= 0; i--) {
      const w = this.warnings[i]
      w.t -= delta
      w.img.setAlpha(0.35 + 0.45 * Math.abs(Math.sin(w.t / 70)))
      if (w.t <= 0) {
        w.img.destroy()
        this.warnings.splice(i, 1)
      }
    }
  }

  /**
   * One Graphics object redrawn per frame for every enemy currently telegraphing.
   * Drawn under the sprites, so the sprite stays the clearest thing on screen.
   */
  private drawTelegraphs(): void {
    const g = this.telegraphGfx
    g.clear()

    this.forEachEnemy((e) => {
      if (!e.active || e.windup <= 0) return

      // Ease-in: the tell grows as the shot approaches.
      const p = Math.pow(Phaser.Math.Clamp(e.charge, 0, 1), 3)
      const alpha = 0.18 + 0.55 * p

      switch (e.pattern) {
        case 'aimed':
        case 'spread3':
        case 'spread5': {
          // Shows where the shot is going. The aim was locked when the wind-up
          // started, so this tells the truth.
          const len = 210 * p
          g.lineStyle(1.5, COLORS.hostileBullet, alpha)
          g.lineBetween(
            e.x,
            e.y,
            e.x + Math.cos(e.aimAngle) * len,
            e.y + Math.sin(e.aimAngle) * len
          )
          break
        }

        case 'ring':
        case 'spiral':
          g.lineStyle(1.5, COLORS.hostileBullet, alpha)
          g.strokeCircle(e.x, e.y, e.def.drawRadius + 40 * p)
          break

        case 'wallGap': {
          // Tick marks for the incoming wall, with the gap missing. Showing the
          // gap IS the design — the player is meant to read it and move.
          const gap = wallGapIndex(e)
          const step = GAME_WIDTH / (WALL_SLOTS + 1)
          g.lineStyle(2, COLORS.hostileBullet, alpha)
          for (let i = 0; i < WALL_SLOTS; i++) {
            if (i === gap) continue
            const x = step * (i + 1)
            g.lineBetween(x, e.y + e.def.drawRadius, x, e.y + e.def.drawRadius + 18 * p)
          }
          break
        }
      }
    })
  }

  // --- Spawning ------------------------------------------------------------

  spawnEnemy(id: EnemyId, x: number, y: number, movement?: MovementId): Enemy | null {
    const e = this.enemies.get(x, y) as Enemy | null
    if (!e) return null
    e.spawn(id, x, y, movement)
    return e
  }

  spawnBoss(): void {
    const boss = this.bosses.get(GAME_WIDTH / 2, -80) as Boss | null
    if (!boss) return
    boss.spawnBoss()
    this.boss = boss
    this.events.emit('boss-spawned', boss)
  }

  firePlayerBullet(opts: {
    x: number
    y: number
    vx: number
    vy: number
    damage: number
    texture: string
    pierce: boolean
    homing: number
  }): void {
    const b = this.playerBullets.get(opts.x, opts.y) as Bullet | null
    if (!b) return
    b.fire({ ...opts, radius: opts.pierce ? 4 : 3.5 })
  }

  dropPickup(kind: PickupKind, x: number, y: number): void {
    const p = this.pickups.get(x, y) as Pickup | null
    if (!p) return
    p.drop(kind, x, y)
  }

  // --- Combat --------------------------------------------------------------

  private onBulletHitEnemy(bullet: Bullet, enemy: Enemy): void {
    if (!bullet.active || !enemy.active || enemy.dying) return
    if (bullet.pierce && bullet.lastHit === enemy) return

    const body = bullet.body as Phaser.Physics.Arcade.Body | null
    const angle = body ? Math.atan2(body.velocity.y, body.velocity.x) : Math.PI / 2

    this.damageEnemy(enemy, bullet.damage, angle)

    if (bullet.pierce) bullet.lastHit = enemy
    else bullet.kill()
  }

  private onHostileBulletHitPlayer(bullet: Bullet): void {
    if (!bullet.active || !this.ship.alive || this.ship.invuln > 0) return
    bullet.kill()
    this.damagePlayer(bullet.damage, bullet.x, bullet.y)
  }

  private onEnemyTouchPlayer(enemy: Enemy): void {
    if (!enemy.active || enemy.dying || !this.ship.alive || this.ship.invuln > 0) return
    this.damagePlayer(enemy.def.contact, enemy.x, enemy.y)
    // Chaff dies on contact, so ramming is a trade rather than a wall.
    if (enemy.def.weight === 'chaff') this.killEnemy(enemy, false)
  }

  damageEnemy(enemy: Enemy, amount: number, hitAngle: number, fromBlast = false): void {
    if (enemy.invuln > 0 || enemy.dying) return

    // The boss takes bonus damage while its core is open — that is the fight's
    // rhythm of patience and aggression.
    const isBossOpen = enemy instanceof Boss && enemy.coreOpen
    const dealt = amount * (isBossOpen ? CORE_OPEN_MULT : 1)
    enemy.hp -= dealt

    // Frame 0: sound, spark, white flash. Two channels minimum, always.
    synth.hit(enemy.def.weight === 'heavy' ? 'heavy' : 'light')
    this.juice.spark(
      enemy.x - Math.cos(hitAngle) * 6,
      enemy.y - Math.sin(hitAngle) * 6,
      hitAngle + Math.PI,
      enemy.def.accent,
      enemy.def.weight === 'chaff' ? 3 : 5
    )
    enemy.flash()
    enemy.bar?.damage()
    if (enemy instanceof Boss) this.events.emit('boss-damage')

    if (enemy.def.showDamageNumbers) {
      this.juice.damageNumber(enemy.x, enemy.y - enemy.def.drawRadius, dealt, isBossOpen)
    }

    // Hit-stop on the TARGET only.
    if (!fromBlast) {
      const hs =
        enemy.def.weight === 'chaff'
          ? BALANCE.hitstop.chaff
          : enemy.def.weight === 'heavy'
            ? BALANCE.hitstop.heavy
            : BALANCE.hitstop.light
      enemy.freeze(hs * 1000)
    }

    if (enemy.hp <= 0) this.killEnemy(enemy, fromBlast)
  }

  killEnemy(enemy: Enemy, fromBlast: boolean): void {
    if (enemy.dying) return

    const def = enemy.def
    this.kills++
    this.addScore(def.score)
    this.addChain(1)

    if (enemy instanceof Boss) {
      this.killBoss(enemy)
      return
    }

    enemy.kill()
    synth.explode(def.explode)
    this.juice.explosion(enemy.x, enemy.y, def.explode, def.color)
    this.juice.shake(
      def.weight === 'heavy' ? BALANCE.trauma.heavyDeath : BALANCE.trauma.enemyDeath
    )

    // Chain Detonation: a kill sets off a small blast. Blast kills do not chain
    // further — that keeps it a crowd tool, not an infinite cascade.
    if (this.ship.stats.killBlast && !fromBlast) this.blast(enemy.x, enemy.y, 46, 2)

    if (def.role !== 'chaff' && Math.random() < BALANCE.pickups.dropChance) {
      this.dropPickup(Math.random() < 0.45 ? 'repair' : 'bounty', enemy.x, enemy.y)
    }
  }

  private killBoss(boss: Boss): void {
    const { x, y } = boss
    boss.kill()
    this.boss = null
    this.events.emit('boss-defeated')

    synth.bossDeath()
    this.juice.explosion(x, y, 'large', boss.def.accent)
    this.juice.shake(BALANCE.trauma.bossDeath)
    this.juice.freeze(BALANCE.hitstop.bossDeath)
    this.juice.flash(0.6, COLORS.gold)
    haptics.impact('heavy')
    this.showBanner('HIVECORE DOWN', `+${boss.def.score}`)

    // Guaranteed reward for a long fight.
    for (let i = 0; i < 3; i++) {
      this.dropPickup(
        i === 0 ? 'repair' : 'bounty',
        x + Phaser.Math.Between(-30, 30),
        y + Phaser.Math.Between(-20, 20)
      )
    }
  }

  private blast(x: number, y: number, radius: number, damage: number): void {
    this.juice.explosion(x, y, 'small', COLORS.gold)
    this.forEachEnemy((other) => {
      if (!other.active || other.dying) return
      if (Phaser.Math.Distance.Between(x, y, other.x, other.y) <= radius + other.def.radius) {
        this.damageEnemy(other, damage, Math.atan2(other.y - y, other.x - x), true)
      }
    })
  }

  damagePlayer(amount: number, srcX: number, srcY: number): void {
    const p = this.ship
    if (!p.alive || p.invuln > 0) return

    p.hp -= amount
    p.invuln = BALANCE.player.invulnAfterHit * 1000

    // This is about the player, so it earns the global hit-stop and a flash.
    this.juice.freeze(BALANCE.hitstop.playerHit)
    this.juice.shake(BALANCE.trauma.playerHit)
    this.juice.flash(0.35, 0xff3355)
    synth.playerHit()
    this.juice.explosion(p.x, p.y, 'small', COLORS.player)
    haptics.impact('medium')

    // Getting hit costs the chain. That is what makes greed a decision.
    if (BALANCE.combo.resetOnDamage) this.breakChain()

    this.juice.setDanger(p.hp === 1)

    if (p.hp <= 0) {
      p.hp = 0
      p.alive = false
      this.deathHold = DEATH_HOLD

      // Death clarity: whatever killed the player stays visible and highlighted
      // for a beat before the game-over transition.
      this.killerRing = this.add
        .image(srcX, srcY, TEX.ring)
        .setDepth(DEPTH.particle)
        .setTint(COLORS.hostileBullet)
        .setScale(0.8)
      this.tweens.add({
        targets: this.killerRing,
        scale: 1.6,
        alpha: 0.2,
        duration: 620,
        yoyo: true,
        repeat: 1,
      })

      synth.explode('large')
      synth.stopMusic()
      this.juice.explosion(p.x, p.y, 'large', COLORS.player)
      this.juice.shake(BALANCE.trauma.bossDeath)
      this.juice.freeze(0.5)
      this.juice.flash(0.5, COLORS.white)
      haptics.impact('heavy')
      p.setVisible(false)
      ;(p.body as Phaser.Physics.Arcade.Body | null)?.setEnable(false)
    }
  }

  /** Called by the boss when a bar segment breaks. */
  onBossPhaseBreak(boss: Boss, phase: number, hint: string): void {
    this.juice.freeze(BALANCE.hitstop.phaseBreak)
    this.juice.shake(BALANCE.trauma.phaseBreak)
    this.juice.flash(0.5, COLORS.gold)
    synth.phaseBreak()
    haptics.impact('heavy')
    this.juice.explosion(boss.x, boss.y, 'medium', boss.def.accent)
    this.showBanner(`PHASE ${phase + 1}`, hint)
    this.events.emit('boss-phase', phase)
  }

  private collectPickup(pickup: Pickup): void {
    if (!pickup.active || !this.ship.alive) return
    const kind = pickup.kind
    pickup.kill()

    synth.pickup()
    haptics.impact('light')
    this.juice.spark(this.ship.x, this.ship.y, -Math.PI / 2, COLORS.gold, 4)

    if (kind === 'repair') {
      if (this.ship.hp < this.ship.stats.maxHp) {
        this.ship.hp += 1
        this.juice.setDanger(this.ship.hp === 1)
      } else {
        this.addScore(150) // already full: pay out rather than waste the drop
      }
    } else {
      this.addScore(200)
      this.addChain(1)
    }
  }

  // --- Score ---------------------------------------------------------------

  get multiplier(): number {
    const c = BALANCE.combo
    return Math.min(c.max, 1 + Math.floor(this.chain / c.perStep) * c.stepValue)
  }

  addScore(base: number): void {
    this.score += Math.round(base * this.multiplier)
  }

  addChain(n = 1): void {
    this.chain += n
    this.chainT = BALANCE.combo.idleTimeout * 1000
  }

  breakChain(): void {
    this.chain = 0
    this.chainT = 0
  }

  // --- Queries used by objects and the director ----------------------------

  countEnemies(): number {
    return this.enemies.countActive(true) + this.bosses.countActive(true)
  }

  countChaff(): number {
    return this.enemies.countActive(true)
  }

  countAiming(): number {
    let n = 0
    this.forEachEnemy((e) => {
      if (e.active && e.windup > 0 && e.def.fire?.aimed) n++
    })
    return n
  }

  private nearestEnemy(x: number, y: number, maxRange: number): Enemy | null {
    let best: Enemy | null = null
    let bestD = maxRange * maxRange
    this.forEachEnemy((e) => {
      if (!e.active || e.dying) return
      const d = (e.x - x) ** 2 + (e.y - y) ** 2
      if (d < bestD) {
        bestD = d
        best = e
      }
    })
    return best
  }

  showBanner(text: string, sub = ''): void {
    this.events.emit('banner', text, sub)
  }

  // --- Transitions ---------------------------------------------------------

  pause(): void {
    if (this.scene.isPaused() || !this.ship.alive) return
    this.pointers.length = 0
    this.scene.pause()
    this.scene.launch('pause')
  }

  private openUpgrade(): void {
    this.offers = offerUpgrades(this.ship.stats, this.takenUpgrades)
    if (this.offers.length === 0) {
      // Nothing left to offer: move on rather than showing an empty screen.
      this.director.start(this.director.index + 1)
      return
    }
    this.pointers.length = 0
    this.scene.pause()
    this.scene.launch('upgrade')
  }

  /** Called by UpgradeScene once a choice has been applied. */
  resumeAfterUpgrade(label: string): void {
    this.director.start(this.director.index + 1)
    this.showBanner(`WAVE ${this.director.wave.id}`, `${label.toUpperCase()} ONLINE`)
  }

  private gameOver(): void {
    this.newRecord = settings.recordRun(this.score, this.director.index + 1)
    this.killerRing?.destroy()
    this.killerRing = undefined
    this.scene.pause()
    this.scene.launch('gameover')
  }
}
