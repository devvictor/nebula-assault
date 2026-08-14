# Juice Recipes — Nebula Assault

Starting values, tuned for a 60 fps arcade shooter on a phone. Treat them as defaults to feel-test, not laws. All frame counts assume 60 fps; convert to seconds so a 120 Hz display behaves identically.

- [Hit-stop](#hit-stop)
- [Screen shake](#screen-shake)
- [Particles](#particles)
- [Easing curves](#easing-curves)
- [Scale punch and flash](#scale-punch-and-flash)
- [Damage numbers](#damage-numbers)
- [Health-bar constants](#health-bar-constants)
- [Audio](#audio)
- [Haptics](#haptics)
- [Accessibility scaling](#accessibility-scaling)
- [Performance caps](#performance-caps)

## Hit-stop

Freeze the attacker and target; never freeze the HUD, particles, or the player's own input reading.

| Event | Frames | Seconds |
|---|---|---|
| Bullet hits chaff | 0 | none — it just pops |
| Bullet hits standard alien | 2 | 0.033 |
| Bullet hits armoured | 4 | 0.066 |
| Player takes damage | 6 | 0.100 |
| Boss phase break | 10 | 0.166 |
| Boss death | 18 | 0.300 |

Never hit-stop the player on their *own* successful hit for more than 2 frames — it reads as input lag.

## Screen shake

Use a decaying trauma value, not a fixed duration: `trauma = min(1, trauma + amount)`, decays at `trauma -= 1.6 × dt`, offset = `maxOffset × trauma²`. Squaring makes small shakes subtle and big ones violent.

| Event | Trauma added | Feels like |
|---|---|---|
| Player fires | 0.00 | nothing (muzzle flash carries it) |
| Standard enemy dies | 0.08 | a tap |
| Armoured enemy dies | 0.18 | a thud |
| Player takes damage | 0.35 | alarming |
| Boss segment break | 0.45 | an event |
| Boss death | 0.70 | earned |

- `maxOffset` = 12 px at a 480×854 logical resolution (~2.5% of the short edge). Scale with resolution, not device pixels.
- Simultaneous events take the **max** trauma, never the sum.
- Rotational shake: max 1.5°, and skip it entirely on mobile — it hurts readability on small screens.
- Shake the *camera*, not the world objects, so hitboxes and the HUD stay put.

## Particles

| Event | Count (desktop) | Count (mobile cap) | Lifetime |
|---|---|---|---|
| Bullet impact spark | 4–6 | 3 | 0.12 s |
| Chaff pop | 6 | 4 | 0.25 s |
| Standard enemy explosion | 14 | 8 | 0.4 s |
| Armoured explosion | 24 | 12 | 0.6 s |
| Boss explosion | 60 + 3 staged bursts | 30 + 3 bursts | 1.2 s |
| Engine trail | 1 per 2 frames | 1 per 3 frames | 0.3 s |

- Pool every particle. Zero allocation during gameplay.
- Give particles a small random velocity cone (±25°) and per-particle scale variance (0.8–1.2×) — uniform particles read as a template.
- Fade *and* shrink over lifetime; fading alone looks like a bug on bright backgrounds.
- Global cap: 250 live particles on desktop, 120 on mobile. When at cap, drop the oldest — never skip the newest, because the newest is the one the player caused.

## Easing curves

| Interaction | Curve | Duration |
|---|---|---|
| Player-initiated (fire, dash, menu press) | ease-out (`1-(1-t)³`) | 80–140 ms |
| Incoming threat / telegraph | ease-in (`t³`) | 300–600 ms |
| Camera moves | ease-in-out | 200–400 ms |
| Pickup fly-to-HUD | ease-in-out with slight overshoot | 250 ms |
| UI panel in | back-out (overshoot 1.1×) | 200 ms |
| Anything continuous (bob, pulse) | sine | loop |

Linear easing is only ever correct for constant motion (scrolling starfield, conveyor). If something feels stiff, it is probably linear.

## Scale punch and flash

- **Muzzle**: player ship scales to 1.06× for 3 frames, ease-out back.
- **Enemy hit**: sprite tints to near-white for 2 frames, scales to 1.12× and settles over 6 frames.
- **Enemy death**: scale to 1.3× while alpha drops to 0 over 5 frames, then the explosion spawns.
- **Player damage**: full-screen red vignette pulse, 0.25 s, peak alpha 0.35; ship blinks at 12 Hz for the invulnerability window.
- Anticipation for heavy enemy attacks: 4-frame squash to 0.92× before the strike.

## Damage numbers

Optional for this game — enable only if the player needs the information (armoured enemies, boss). If enabled:

- Rise 24 px over 0.5 s, ease-out, fade out over the last 40%.
- Random x-offset ±6 px so stacked hits don't overlap into an unreadable blob.
- Larger and brighter for critical/weak-point hits; same colour family otherwise.
- Pooled, hard cap 20 concurrent, and never drawn over the boss bar.
- Skip entirely for chaff.

## Health-bar constants

Implements the mandatory spec in `SKILL.md`.

**Shared**
- Ghost (delayed) layer: waits 250 ms after the last damage, then drains at 40% of max per second. This is what makes big hits *look* big.
- Damage flash on the bar: 2 frames at 80% white.
- Fill uses a straight rectangle with a 1 px dark outline — rounded, gradient-heavy bars read as mobile-free-to-play; keep it crisp and arcade.

**Boss bar**
- Width 78% of logical screen width, height 10 px, centred, top offset = 12 px + `safe-area-inset-top`.
- One segment per phase, 2 px gaps between segments; spent segments keep a dim frame.
- Name label 8–10 px, small caps, letter-spaced, directly above the bar.
- Segment break: 10-frame hit-stop, 0.45 trauma, audio sting, bar flashes full white for 3 frames.
- Bar never moves or resizes mid-fight.

**Alien bars**
- Height 3 px; width = sprite width clamped to [16 px, 40 px]; vertical offset 6 px above the sprite's top edge.
- Hidden at 100% health. Fade in over 80 ms on first damage; fade out over 200 ms after 1.5 s of no damage.
- Health bands: >60% healthy, 25–60% warning, <25% critical. Fill length is the primary signal; colour only reinforces.
- Draw order: background → enemies → **alien bars** → projectiles → player → particles → HUD.
- Skip for any enemy whose max HP dies to one base-weapon shot (chaff).
- Cull off-screen; cap at 12 simultaneously visible alien bars on mobile — beyond that, show bars only for damaged enemies nearest the player.

## Audio

- Layer two samples per impact: a transient (click/snap) plus a body (thump/boom).
- Randomise pitch ±8% and volume ±10% per instance, or repeated shots become a machine-gun drone.
- Cap concurrent instances of any single sound at 4; retrigger by restarting the oldest voice.
- Duck the music bed by ~3 dB for 200 ms on boss phase breaks and player death.
- Player fire should be the quietest frequent sound in the mix — it plays the most often.

## Haptics

Mobile only, via the Capacitor haptics plugin (see `web-to-mobile-game`):

| Event | Style |
|---|---|
| Player takes damage | medium impact |
| Boss segment break | heavy impact |
| Pickup collected | light/selection |
| Player fire | none — never vibrate on a repeating action |

Always gate haptics behind a settings toggle, default on.

## Accessibility scaling

One `intensity` setting (0–1, default 1) multiplies: shake trauma, particle counts, flash alpha, and haptic strength. At 0 the game must remain fully playable with identical timings and hitboxes. Default the setting to 0.4 when `prefers-reduced-motion: reduce` is set. Never let this setting change gameplay-relevant durations such as hit-stop-driven invulnerability windows — decouple those from the visual layer.

## Performance caps

On a mid-tier phone, hold a 16.6 ms frame. Budget guidance: simulation ≤4 ms, rendering ≤8 ms, leaving headroom. If juice pushes past it, cut particle counts first, then trails, then bar count — never cut hit-stop or audio, which carry most of the felt impact for almost no cost.
