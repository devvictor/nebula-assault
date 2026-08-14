/**
 * Every tunable number in Nebula Assault lives here. No magic numbers in
 * behaviour code, ever. Each knob is commented with its INTENT, not its value.
 *
 * Change one knob per tuning pass, and write down the expected felt effect
 * before testing — otherwise you will not know which change mattered.
 */

export const BALANCE = {
  player: {
    /** how many careless mistakes a run survives */
    maxHp: 3,
    /** how fast the player can outrun a threat */
    speed: 380,
    /** hitbox — deliberately smaller than the sprite, so near-misses feel fair */
    radius: 8,
    /** sprite half-extent, for drawing only */
    drawRadius: 13,
    /** rate of fire: 8 shots/s => base DPS 8 */
    fireInterval: 0.125,
    /** hard floor: below this it is a laser, and it costs phone frames */
    minFireInterval: 0.06,
    bulletSpeed: 620,
    bulletDamage: 1,
    /** how long a mistake protects you afterwards */
    invulnAfterHit: 1.3,
    /** how far the ship trails behind the finger (thumb must not cover the ship) */
    touchFollowRate: 22,
    dash: {
      duration: 0.16,
      speedMul: 3.2,
      cooldown: 1.05,
    },
  },

  /** Freeze the attacker and target. Never the HUD, particles, or input. */
  hitstop: {
    chaff: 0,
    light: 2 / 60,
    heavy: 4 / 60,
    playerHit: 6 / 60,
    phaseBreak: 10 / 60,
    bossDeath: 18 / 60,
  },

  /** Trauma added per event. Simultaneous events take the max, never the sum. */
  trauma: {
    playerFire: 0,
    enemyDeath: 0.08,
    heavyDeath: 0.18,
    playerHit: 0.35,
    phaseBreak: 0.45,
    bossDeath: 0.7,
  },

  /** Sawtooth difficulty ramp: pressure builds over a set, drops, peaks higher. */
  wave: {
    basePressure: 12,
    /** additive per wave set — multiplicative ramps break past wave 10 */
    setGrowth: 0.35,
    /** pressure fraction per slot within a set */
    slotScale: [0.55, 0.7, 0.85, 1.0, 0.3],
    /** seconds of calm between waves */
    interWaveDelay: 1.4,
    /** every Nth set ends in a boss */
    bossEverySets: 3,
  },

  /** Score exists to make the player take risks. */
  combo: {
    /** chain kills needed per multiplier step */
    perStep: 10,
    stepValue: 0.5,
    max: 4,
    /** chain dies from inaction... */
    idleTimeout: 2.5,
    /** ...and from getting hit. That is what makes it a decision. */
    resetOnDamage: true,
  },

  /** Fairness and performance caps. Breaking these is what makes a wave unfair. */
  caps: {
    /** hostiles alive at once on a phone screen */
    onScreenEnemies: 18,
    /** enemies allowed to fire AIMED shots simultaneously, before set 3 */
    aimedShooters: 3,
    /** fraction of the field that must stay free of hostiles and bullets */
    escapeSpace: 0.35,
    /** projectiles per player volley (prefer piercing over more bullets) */
    projectilesPerVolley: 5,
    /** simultaneously visible alien health bars */
    alienBars: 12,
    particlesDesktop: 250,
    particlesMobile: 120,
  },

  /** Pool sizes — nothing is allocated during play. */
  pools: {
    playerBullets: 96,
    enemyBullets: 220,
    enemies: 48,
    particles: 260,
    pickups: 16,
    damageNumbers: 20,
  },

  pickups: {
    /** chance a standard-or-better kill drops something */
    dropChance: 0.14,
    /** breather waves guarantee this many */
    breatherDrops: 3,
    fallSpeed: 90,
    magnetRadius: 42,
    magnetRadiusUpgraded: 130,
    lifetime: 9,
  },

  boss: {
    /** total HP; one third per phase, one bar segment per phase */
    hp: 360,
    phases: 3,
    /** invulnerable beat between phases, so the player can reposition */
    transitionTime: 0.6,
    entryTime: 2.2,
  },
} as const

export type Balance = typeof BALANCE
