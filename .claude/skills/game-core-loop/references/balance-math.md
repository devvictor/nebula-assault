# Balance Math — Nebula Assault

Concrete formulas and starting numbers. Read the section you need; do not read end to end.

- [Time-to-kill and DPS budgeting](#time-to-kill-and-dps-budgeting)
- [Threat budgeting (player survivability)](#threat-budgeting-player-survivability)
- [Difficulty ramp curve shapes](#difficulty-ramp-curve-shapes)
- [Spawn-budget point system](#spawn-budget-point-system)
- [Upgrade economy scaling](#upgrade-economy-scaling)
- [Score and combo](#score-and-combo)
- [Sanity checks before shipping a tuning pass](#sanity-checks-before-shipping-a-tuning-pass)

## Time-to-kill and DPS budgeting

TTK is the number you tune, not health. Derive health from the TTK you want.

```
playerDPS = damagePerShot × shotsPerSecond × averageShotsOnTarget
enemyHP   = targetTTK × playerDPS
```

`averageShotsOnTarget` is below 1.0 for anything that moves — assume 0.7 for drifting enemies, 0.5 for erratic ones, 0.9 for a boss that fills the screen.

Target TTK bands for an arcade shooter at base weapon power:

| Enemy class | Target TTK | Why |
|---|---|---|
| Chaff / swarm | 0.1–0.2 s | Dies to a single tap; exists to be mowed down |
| Standard alien | 0.4–0.8 s | Two to four hits; the bread-and-butter rhythm |
| Armoured / turret | 1.5–2.5 s | Long enough that the player must hold position under fire |
| Elite / mini-boss | 4–7 s | A short fight with one behaviour to learn |
| Boss | 45–90 s total, 15–25 s per phase | Long enough to learn phases, short enough to retry |

If a fully-upgraded player trivialises a class, that is correct — power fantasy is the point. Compensate with density (see spawn budget), not with HP.

## Threat budgeting (player survivability)

Decide how long a *careless* player survives, then derive enemy damage.

```
enemyDamage = playerMaxHP / hitsToKillPlayer
```

Starting point: player has 3 HP (or a 3-hit shield), so any single alien shot costs 1. Contact with an enemy body costs 1. Boss heavy attacks may cost 2 — but only if they are telegraphed for ≥0.5 s.

Rule of thumb: the player should be able to lose the run to about **8–12 seconds of sustained inattention**, never to a single unavoidable hit.

## Difficulty ramp curve shapes

| Shape | Feel | Use |
|---|---|---|
| Linear | Predictable, gets dull | Avoid as the only curve |
| Exponential | Fine early, unplayable by wave 12 | Avoid |
| Stepped | Clear "new chapter" beats | Good for enemy-type introductions |
| **Sawtooth** | Tension builds, releases, builds higher | **Default for Nebula Assault** |

Sawtooth: each wave set ramps pressure over 3–4 waves, drops sharply on a breather wave, and each set's peak is higher than the last.

```
setPeak(n)   = basePressure × (1 + 0.35 × n)      // n = wave-set index, 0-based
wavePressure = setPeak(n) × (0.55 + 0.15 × k)     // k = wave index within the set, 0..3
breather     = setPeak(n) × 0.3
```

Keep the growth **additive-linear per set** (0.35 factor), not multiplicative — multiplicative ramps break past wave 10 and force HP inflation to hide the problem.

## Spawn-budget point system

Give each wave a point budget; price enemies in points. This is the shared currency between this skill and `wave-design`.

| Enemy | Points | Notes |
|---|---|---|
| Chaff drone | 1 | Sold in groups of 5+ |
| Standard alien | 3 | |
| Weaver (erratic path) | 4 | Costs more for being hard to hit |
| Shooter (aimed fire) | 5 | Pressure, not bulk |
| Armoured | 7 | Denies screen space |
| Turret / stationary | 6 | Forces the player to come to it |
| Elite | 12 | Max one per wave outside boss sets |

```
waveBudget = round(wavePressure)        // from the ramp formula above
```

Constraints that stop budgets producing unfair walls:

- **On-screen cap**: never more than ~18 hostile entities, or ~24 including projectiles, on a phone screen. Spend surplus budget over time, not all at once.
- **Aimed-fire cap**: at most 3 enemies firing *aimed* shots simultaneously before wave set 3.
- **Escape space**: at least 35% of the play field must be free of hostiles and bullets at any instant. If a spawn would break this, delay it.
- **Variety floor**: at least 2 enemy types per wave after the introduction wave; at most 4, or the wave reads as noise.

## Upgrade economy scaling

Additive stacks stay predictable; multiplicative stacks explode. Use multiplicative only for things that cannot compound with themselves.

```
additive:       value = base + (bonus × stacks)                  // safe default
diminishing:    value = base + bonus × (1 - 0.75^stacks) / 0.25  // for fire rate, speed
multiplicative: value = base × (1 + bonus)^stacks                // avoid beyond 2 stacks
```

Never let these compound multiplicatively with each other: fire rate × damage × projectile count. Pick one axis per upgrade and cap the total. Hard caps to hold:

- Fire rate: no lower than 0.06 s between shots (beyond that it is a laser, and it kills performance on phones).
- Projectile count: max **5 per volley** (centre plus two symmetric pairs). Beyond that, buy power with piercing, wider hitboxes or damage — not with more bullets. Note this is a per-volley cap, not a concurrent-bullets cap: at 8 shots/sec with a ~1.4 s flight time the screen legitimately holds ~11 player bullets at base, so size the pool for volley-rate x flight-time x projectiles and cap the volley instead.
- Move speed: max 1.8× base, or the player outruns the readability of the screen.

Prefer offering **3 choices from a pool, one of which is behavioural**, over a linear upgrade track. Behavioural examples worth writing:

- Piercing shots, −30% fire rate.
- Rear-facing shot at 50% damage.
- Dash gains invulnerability frames, cooldown +40%.
- Shots home weakly, −20% damage.
- Kills drop a small explosion, self-damage possible.

## Score and combo

Score exists to make the player take risks. Tie it to aggression:

```
score += enemyValue × comboMultiplier
comboMultiplier = 1 + floor(chain / 10) × 0.5      // cap at 4.0
chain resets on taking damage, or after 2.5 s without a kill
```

Resetting the chain on damage (not just on time) is what makes the score system a *decision* — greed versus safety.

## Sanity checks before shipping a tuning pass

1. Can a first-time player survive wave 1 without instruction? Test with no HUD hints.
2. Is any enemy killable while the player stands still and ignores it? If yes, it has no pressure role.
3. Does the wave-5 pressure value fit the on-screen cap and the 35% escape-space rule?
4. Does a fully-upgraded player still have to move? If not, add density, not HP.
5. Change one knob per pass, and write the expected felt effect before testing.
