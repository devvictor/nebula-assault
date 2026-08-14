---
name: wave-design
description: Design waves, enemy formations, encounter pacing and boss fights for Nebula Assault. Use this skill whenever creating or editing a wave, level, stage, enemy spawn table, formation, attack pattern, bullet pattern, or boss; whenever deciding what order enemies appear in or how a stage ramps up; and whenever the user says a wave or level is too hard, too easy, boring, unfair, chaotic, repetitive, a difficulty spike, or "I keep dying on wave N". Also use when planning the first playable sequence of waves for a new build.
---

# Wave, Encounter & Boss Design

You design the minute-to-minute experience of Nebula Assault: what appears, in what order, and how it makes the player move. A wave is not a bag of enemies — it is a question posed to the player.

## Every wave declares two things

Before writing a spawn table, write these down for the wave:

1. **Teaching goal** — what the player learns or practises here. ("Weavers can't be hit by standing still.")
2. **Threat axis** — the single pressure this wave applies: density, aimed fire, screen denial, verticality, or time.

A wave with no teaching goal is filler; a wave with three threat axes is noise. One axis, occasionally two once the player is experienced.

## Introduction protocol — non-negotiable

When a new enemy type appears for the first time:

1. **Solo debut.** One or two of them, nothing else on screen, in a wave with a low budget. The player gets to watch it behave.
2. **Paired.** Combine with one already-known type.
3. **In the mix.** Free use from then on.

Skipping the solo debut is the most common cause of "this wave is unfair" — the player never got to learn the thing that killed them.

## Wave-set rhythm

Waves come in **sets of five**, following the sawtooth in `game-core-loop/references/balance-math.md`:

| Slot | Role | Pressure |
|---|---|---|
| 1 | Introduce / re-establish | 55% of set peak |
| 2 | Build | 70% |
| 3 | Build harder | 85% |
| 4 | Peak — the set's real test | 100% |
| 5 | Breather: pickups, low threat, upgrade choice | 30% |

Every third set ends with a **boss** in place of the breather, and the breather moves to just before it. The player must never fight a boss on a low-health run with no chance to prepare.

Breathers are not wasted time. They are where the player feels powerful, banks their upgrade decision, and where tension resets so the next peak lands. Cutting breathers to "keep the action up" flattens the whole curve.

## Composition rules

- Spend the wave's point budget from `balance-math.md`; respect the on-screen cap, aimed-fire cap, escape-space floor and variety floor stated there.
- **Spend the budget over time.** Waves arrive in 2–4 sub-groups a beat apart, not as one wall. A wall is unreadable and unfair; a rhythm is legible.
- **Mix roles, not just types**: something that chases, something that denies space, something that shoots. Three of the same role is one idea repeated.
- **Leave a lane.** There is always a survivable path through the pattern. Design it deliberately, then check it exists in play.
- **Spawn telegraph**: warn 0.4–0.6 s before anything enters — an edge glow, a warning marker, an audio cue. Enemies never materialise on top of the player.
- **No off-screen aimed fire.** An enemy must be fully visible for at least 0.3 s before it may fire an aimed shot.

## Attack patterns and telegraphs

- Every attack has a **wind-up the player can read**: 0.3 s minimum for standard enemies, 0.5–0.8 s for anything that costs 2 HP or covers a large area.
- Telegraph with shape and motion, not just colour — a charging enemy should visibly gather itself. Timings live in `game-feel/references/juice-recipes.md` (anticipation squash, ease-in curves).
- Bullet patterns should be **readable as a shape**: spreads, walls with a gap, spirals with a rhythm. Random scatter is the hallmark of a pattern nobody designed.
- Bullet speed must let the player react: no enemy projectile crosses the screen faster than the player can traverse a third of it.

## Boss design

A boss is a multi-phase conversation, not a health sponge.

- **3 phases** (this maps to the segmented boss bar in `game-feel` — one segment per phase).
- **Each phase must change the player's optimal behaviour.** If the correct play is identical in all phases, it is one long phase with cosmetic changes. Phase 1 teaches a pattern, phase 2 adds a constraint (adds, screen denial), phase 3 raises tempo and combines.
- **Phase transitions**: brief invulnerable beat with a clear tell, plus the flash/shake/sting from the game-feel spec. Give the player a half-second to breathe and reposition.
- **Weak point or window**: a moment where damage is rewarded, so the fight has a rhythm of patience and aggression rather than constant DPS.
- **Fair failure**: no phase may open with an unavoidable hit. Test the transition from the worst plausible player position.
- Total fight 45–90 s, 15–25 s per phase (see the TTK table).
- Adds during a boss must never break the escape-space floor.

Use the phase template and formation catalogue in `references/wave-patterns.md`.

## Diagnosing "wave N is too hard"

Work the list in order and name the actual cause before changing numbers:

1. Was the enemy that kills them ever given a solo debut?
2. Is the escape space below the floor at any instant during the wave?
3. How many aimed shooters fire simultaneously?
4. Is anything spawning inside the player's reaction distance, or firing before it is visible?
5. Is the wave budget correct for its slot, or did it get the peak-slot budget in a build slot?
6. Is the failure actually a *readability* problem — a bullet lost against the background or hidden behind a health bar or particle? (Then it belongs to `game-feel`.)
7. Only after all of the above: reduce the budget.

Note that "too easy" gets the same treatment in reverse — add an axis or density, never HP.

## Related skills

- **game-core-loop** — owns the point budget, pressure curve and enemy roster.
- **game-feel** — telegraph timings, impact, and the boss/alien health bars.
- **web-to-mobile-game** — phone screens are small and a thumb covers part of them; check spawn zones against the thumb-occlusion rules before finalising a pattern.
