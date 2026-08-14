---
name: game-feel
description: Make Nebula Assault feel good to play — impact, feedback, juice, and HUD readability. Use this skill whenever implementing or tuning hits, explosions, deaths, screen shake, particles, trails, flashes, animation, easing, tweens, camera, haptics, or sound feedback; whenever building or changing any HUD element including health bars, boss bars, damage numbers, score, or pickups; and whenever the user says the game feels floaty, mushy, weak, stiff, laggy, unresponsive, unsatisfying, flat, or "the shooting doesn't feel good". This skill owns the mandatory boss and alien health-bar spec — read it before implementing any health display.
---

# Game Feel, Juice & HUD Readability

Arcade shooters live or die on feel. The mechanics can be perfect and the game still feels cheap without the response layer. Your job is that layer — and the readability that keeps it from becoming noise.

## The feedback contract

Every player action and every hit must produce a response **within 2 frames (~33 ms)** on **at least two channels**:

| Channel | Examples |
|---|---|
| Visual | Flash, scale punch, particle, trail, hit-spark, colour shift |
| Motion | Hit-stop, knockback, screen shake, camera nudge |
| Audio | Layered sound (a body + a transient), pitch variation |
| Haptic | Short vibration on mobile (see `web-to-mobile-game`) |

If any interaction fires on only one channel, it will feel weak. Fix it by adding a channel before touching the numbers.

## Response order matters

For an impact, sequence it exactly like this — getting the order wrong is why juice sometimes reads as lag:

1. **Frame 0** — register the hit in the simulation, play the sound, spawn the hit-spark, flash the target white.
2. **Frames 0–N** — hit-stop: freeze the *target and the attacker*, keep the UI and particles running.
3. **After hit-stop** — apply knockback, then screen shake.
4. **Then** — damage number rises, health bar begins its delayed drain.

Hit-stop before shake. Shake without hit-stop feels like a camera bug; hit-stop without shake feels like a frame drop.

## Input must never feel debated

- Read input every frame; act on it the same frame. Never gate a player action behind an animation.
- **Input buffering**: queue a fire/dash press for 120 ms so a press during a cooldown still fires the instant it expires.
- **Coyote time**: honour a dash/dodge press for 100 ms after the window technically closed.
- Animations follow state; state never waits for animation.
- Cancel-out of any recovery animation with a movement input.

If the user says controls feel laggy, check in this order: input polling location, animation gating, hit-stop applied to the player when it shouldn't be, then frame time.

## Mandatory HUD spec — health bars

**Nebula Assault must display health bars for the boss and for the aliens.** This is a project requirement, not an option. Implement both from one shared component so they cannot drift apart.

### Shared component

One `HealthBar` module drives every bar. It owns: current/max value, a **delayed ghost layer** (a second fill that lags the real one by 250 ms and drains at a fixed rate, so the player *sees* the size of the chunk they just took off), a damage flash, and a visibility state machine.

### Boss bar

- Anchored top-centre, persistent for the whole fight, respects mobile safe-area insets (never under a notch or the status bar — see `web-to-mobile-game`).
- **Segmented: one segment per phase.** The player must be able to see how much fight is left and how far to the next phase change.
- Boss name label above or beside the bar, in small caps; keep it short.
- On damage: real fill drops immediately, ghost layer chases it, bar flashes.
- On a segment break: bar flash + brief screen shake + audio sting, and the segment's frame stays visible as a spent slot.
- Never animate the bar's position; a moving HUD element steals attention from the fight.

### Alien bars

- Small bar floating just above the sprite, width matched to the sprite (clamped to a minimum readable width).
- **Hidden at full health.** Fades in on first damage, fades out after ~1.5 s with no further damage. A screen full of always-on bars is unreadable and destroys the arcade look.
- Colour shifts by health band (healthy → warning → critical); do not rely on colour alone — the fill length carries the information, colour only reinforces it.
- Draw *below* projectiles and above the background so a bar never hides a bullet the player must dodge.
- Skip entirely for chaff that dies in one hit — a bar that appears and vanishes in 100 ms is visual noise.
- Cull bars for off-screen enemies, and cap the number of simultaneously visible bars for phone performance.

Numbers for all of the above (durations, sizes, drain rates, caps) are in `references/juice-recipes.md`.

## Readability rules that override juice

Juice is subordinate to the player being able to see the game. When they conflict, readability wins.

1. **Bullets are the most important pixels on screen.** Player bullets, enemy bullets, everything else — in that order of visual priority. No particle, flash or bar may obscure enemy fire.
2. **Silhouette first.** Every enemy must be identifiable by shape alone at phone size, before colour or detail.
3. **Shake budget.** Total shake amplitude is capped no matter how many events fire at once; simultaneous shakes take the max, they do not sum.
4. **Flash budget.** Never full-screen white on a routine hit — reserve full-screen flashes for player damage and boss phase breaks.
5. **Death clarity.** When the player dies, the thing that killed them must still be visible and highlighted for a beat before the game-over transition.
6. **Accessibility toggle.** Ship a "reduced motion / reduced flashing" setting that scales shake and flash to zero without changing gameplay timings. Honour `prefers-reduced-motion` as its default.

## When asked to make something "feel better"

Diagnose, don't sprinkle. Ask which of these is actually missing:

- No response channel (add audio or a spark before adding shake).
- No hit-stop (the most common single fix for "weak" shooting).
- Linear easing (swap to an ease-out for anything the player initiates, ease-in-out for camera).
- No anticipation (a 3–5 frame wind-up makes a heavy attack feel heavy).
- No follow-through (scale punch that overshoots then settles).
- Constant-volume, constant-pitch audio (randomise pitch ±8%, layer two samples).
- Too much noise, so the real feedback is lost — sometimes the fix is removing juice.

Read `references/juice-recipes.md` for the concrete numbers: hit-stop frames by hit class, shake amplitudes and decay, particle counts with mobile caps, easing curves per interaction, damage-number behaviour, and the health-bar constants.

## Related skills

- **game-core-loop** — what a mechanic *does*; this skill covers how it *lands*.
- **wave-design** — telegraphs and wind-ups are specified there and implemented with the timings here.
- **web-to-mobile-game** — particle caps, haptics API, safe areas, frame budget.
