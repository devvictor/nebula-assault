# Wave Patterns & Boss Templates — Nebula Assault

Reusable building blocks. Assumes a vertically-scrolling play field at a 480×854 logical resolution, enemies entering from the top.

- [Formation catalogue](#formation-catalogue)
- [Movement patterns](#movement-patterns)
- [Bullet patterns](#bullet-patterns)
- [Worked wave set (set 1)](#worked-wave-set-set-1)
- [Boss phase template](#boss-phase-template)
- [Wave data shape](#wave-data-shape)
- [Mobile spawn-zone rules](#mobile-spawn-zone-rules)
- [Difficulty-spike checklist](#difficulty-spike-checklist)

## Formation catalogue

| Formation | Shape | Threat axis | Teaches |
|---|---|---|---|
| Line | Row across the top, even spacing | Density | Horizontal sweeping |
| V / Arrow | Wedge, point leading | Density | Attack the point or flank |
| Column | Single file, staggered timing | Time | Rhythm, don't over-commit |
| Flanks | Two groups from left and right edges | Screen denial | Centre is not always safe |
| Pincer | Flanks plus one from top-centre | Screen denial | Forced vertical movement |
| Escort | One armoured leader, 4 chaff around it | Priority | Target selection |
| Turret wall | 3 stationary at fixed heights | Screen denial | Approach and retreat |
| Swarm drip | Chaff continuously, 1 every 0.3 s | Density over time | Sustained accuracy |
| Weaver pair | Two erratic movers, crossing paths | Aimed fire | Lead your shots |

Combine at most two formations per wave. Three reads as chaos.

## Movement patterns

Keep these as named, reusable functions so waves compose them rather than reinventing motion.

| Pattern | Description | Notes |
|---|---|---|
| `straightDown` | Constant velocity | The baseline; always readable |
| `sineDrift` | Down with horizontal sine (amplitude 40–80 px, period 1.2–2 s) | Standard alien default |
| `swoopIn` | Ease-in to a hold position, hold 2 s, exit | Good for shooters |
| `chase` | Steers toward the player, capped turn rate | Cap turn rate or it becomes unavoidable |
| `orbit` | Circles a screen point | Denies an area without a turret |
| `dartPause` | Fast dash, 0.5 s pause, repeat | Gives the player firing windows |
| `hover` | Holds a Y band, strafes horizontally | Turrets, mini-bosses |

Rules: a chaser must be slower than the player (max 0.75× player speed). Anything that pauses must pause long enough to be shot (≥0.4 s).

## Bullet patterns

| Pattern | Params | Readability |
|---|---|---|
| Single aimed | leads the player 0–30% | Easiest; use early |
| Spread 3 | ±15° | Easy |
| Spread 5 | ±30° | Medium — needs a gap in it |
| Wall with gap | 7 bullets, one slot empty, gap moves per volley | Medium; the gap *is* the design |
| Ring | 8–12 radial | Medium; must be dodged by moving out, not through |
| Spiral | ring + 12°/volley rotation | Hard; save for bosses |
| Cross-spiral | two spirals, opposing rotation | Hard; boss phase 3 only |

Constraints: enemy bullet speed 140–220 px/s (player traverses ~380 px/s). Never mix more than two active patterns on screen before wave set 3.

## Worked wave set (set 1)

Set peak pressure = 12 points (base). Illustrates the rhythm and the introduction protocol.

| Wave | Budget | Contents | Teaching goal | Axis |
|---|---|---|---|---|
| 1-1 | 7 | Line of 5 chaff (`straightDown`), then V of 2 standard | Shooting and sweeping | Density |
| 1-2 | 8 | 2 standard (`sineDrift`) + swarm drip 6 chaff | Moving targets | Density |
| 1-3 | 10 | **Solo debut: 1 Shooter** (`swoopIn`), single aimed shots, nothing else | Aimed fire exists; keep moving | Aimed fire |
| 1-4 | 12 | 1 Shooter + Escort (armoured + 4 chaff) | Target priority under fire | Density + aimed |
| 1-5 | 4 | 3 chaff, 2 pickups, upgrade choice | Breather; feel powerful | — |

Note wave 1-3 spends its budget on *one* enemy and empty space. That is correct — the debut is the point.

## Boss phase template

Fill this in for every boss before implementing. Three phases, one per health-bar segment.

```
Boss: <name>            Total HP: <derive from 45–90 s TTK>
Arena: <any screen constraints, e.g. bottom third only>

Phase 1 — "Learn the shape"        (segment 1, 15–25 s)
  Movement:   hover, slow horizontal strafe
  Attacks:    one pattern, generous wind-up (0.6 s)
  Adds:       none
  Window:     2 s pause after each volley
  Player must learn: <the pattern's safe position>

Phase 2 — "Add a constraint"       (segment 2, 15–25 s)
  Movement:   faster strafe, occasional dartPause
  Attacks:    phase-1 pattern + one new pattern
  Adds:       chaff drip (≤4 alive) OR one turret
  Window:     smaller — 1.2 s
  Player must change: <e.g. can no longer camp the centre>

Phase 3 — "Tempo"                  (segment 3, 15–25 s)
  Movement:   aggressive, may cross the field
  Attacks:    combined patterns, wind-up shortened to 0.4 s (never below)
  Adds:       none — the boss alone should be enough here
  Window:     brief, telegraphed vulnerability
  Player must combine: <both prior lessons>

Transitions: 0.5 s invulnerable beat, clear tell, flash + shake + sting
             (see game-feel/references/juice-recipes.md → health-bar constants)
Fairness check: from the worst plausible position at each transition,
                is the first attack of the next phase dodgeable? Verify in play.
```

## Wave data shape

Waves are data, not code. Keep them in one place (e.g. `src/data/waves.ts`) so they can be tuned without touching systems.

```ts
type SpawnGroup = {
  at: number            // seconds from wave start — this is how budget spends over time
  formation: FormationId
  enemy: EnemyId
  count: number
  movement: MovementId
  pattern?: BulletPatternId
}

type Wave = {
  id: string
  teachingGoal: string  // required — a wave without one is filler
  threatAxis: ThreatAxis
  budget: number        // must match its slot in the set
  groups: SpawnGroup[]
}
```

Making `teachingGoal` a required field is deliberate: it forces the design question into the data model.

## Mobile spawn-zone rules

On a phone the player's thumb covers real screen area, and the ship sits low.

- Treat the **bottom ~22% of the screen** as the player's zone: no enemy may stop or hover there, and nothing spawns there.
- Assume the bottom-left and bottom-right corners may be **visually occluded by thumbs**. Never place a critical telegraph, warning marker or pickup there.
- Keep essential HUD out of the top notch area and out of the bottom gesture bar (see `web-to-mobile-game`).
- Because the field is narrow, horizontal patterns are more punishing than on desktop — reduce spread widths by ~20% relative to what feels right on a large screen, and verify every pattern at phone aspect ratio.

## Difficulty-spike checklist

Run this before touching any number:

- [ ] Every enemy in the wave has had a solo debut in an earlier wave.
- [ ] Escape space stays above 35% at every instant (simulate the worst moment).
- [ ] At most 3 simultaneous aimed shooters (before set 3).
- [ ] Nothing spawns within the player's reaction distance; everything is visible ≥0.3 s before firing.
- [ ] Every attack has a wind-up ≥0.3 s (≥0.5 s if it costs 2 HP).
- [ ] There is a deliberate survivable lane, and it is reachable from where the player actually is.
- [ ] The budget matches the wave's slot in the set.
- [ ] The wave has exactly one primary threat axis.
- [ ] Bullets are visible against this stage's background at phone brightness.
- [ ] The wave was played at phone aspect ratio, not just in a desktop window.
