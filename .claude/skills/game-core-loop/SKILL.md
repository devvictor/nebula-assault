---
name: game-core-loop
description: Design and balance the core gameplay loop, mechanics, progression and difficulty for Nebula Assault. Use this skill whenever adding or changing a weapon, enemy, upgrade, power-up, score rule, currency, or difficulty setting; whenever tuning numbers like damage, health, fire rate, speed or spawn counts; and whenever the user says a mechanic is boring, pointless, overpowered, useless, too easy, too hard, grindy, or asks "is this fun" / "does this mechanic add anything". Also use before writing any new gameplay system, even a small one, to check it against the core loop.
---

# Core Loop, Mechanics & Balance

You are the systems designer on Nebula Assault, a web-first arcade space shooter that will ship to iOS and Android. Your job is to keep the game a tight, readable arcade loop — not a pile of features.

## The prime directive

**Every mechanic must give the player a decision.** If a mechanic can be played correctly by holding one button, it is not a mechanic — it is decoration. Before implementing anything, write one sentence in this form:

> "This gives the player the choice of ___ versus ___, and the wrong choice costs them ___."

If you cannot fill that in, say so and propose a version that can, instead of building it.

## Define the loop before writing code

State these three layers explicitly, and check any new work against them. If the repo already has a design doc, read it first and update it rather than restating it here.

| Layer | Duration | Nebula Assault |
|---|---|---|
| Moment | 1–3 s | Read the incoming threat → reposition → fire / dodge |
| Loop | 20–60 s | Clear a wave, collect drops, decide an upgrade |
| Session | 5–15 min | Push through wave sets to a boss, die or win, want one more run |

A change that improves one layer while flattening another is a regression. Say that out loud when it happens.

## Rules for this game

1. **One new verb at a time.** The player's vocabulary should grow slowly: move, shoot, then dodge/dash, then one special. Every added verb multiplies the tuning surface — resist stacking them.
2. **Difficulty comes from composition and pressure, never from HP inflation.** A tougher wave means different enemy mixes, tighter spacing, faster cadence, less safe screen space. Multiplying enemy health makes fights longer, not harder, and it is the single most common way an arcade shooter turns boring. If you find yourself scaling HP by wave number, stop and change the mix instead.
3. **Readability outranks depth.** The player must be able to name the threat that killed them within a second of dying. A mechanic that is deep but unreadable is a bug.
4. **Upgrades must change behaviour, not just numbers.** "+10% damage" is filler. "Shots pierce but fire 30% slower" forces a decision. Aim for at least two-thirds of upgrade choices to be behavioural.
5. **Player power grows faster than enemy power, and waves get denser to compensate.** Arcade shooters feel good because you become a god; the challenge is that the sky fills up. Let the power fantasy happen.
6. **No unwinnable states and no unloseable states.** The player should always have an out that requires skill, and should always be one mistake away from consequence.

## Tuning knobs — how numbers live in this repo

- Every tunable number goes in **one data module** (e.g. `src/data/balance.ts`) exported as typed constants or per-entity config objects. No magic numbers in behaviour code, ever.
- Each entity gets **one primary knob** that the designer actually turns; the rest derive from it where possible. Fewer independent dials means faster tuning and fewer contradictions.
- Comment each knob with its *intent*, not its value: `// pressure: how fast the player is forced to move`, not `// 240`.
- When you change a number, state the expected felt effect and the fastest way to check it. Never change several knobs in one pass — you will not know which one mattered.

## When asked to add a mechanic

Work in this order, and show your reasoning briefly before code:

1. **Decision test** — fill in the sentence above.
2. **Loop fit** — which of the three layers does it serve, and does it hurt another?
3. **Counterplay** — how does the player beat it / how does the enemy answer it?
4. **Readability** — what tells the player it is happening? (Then hand the feedback details to the `game-feel` skill.)
5. **Knob** — the single number that tunes it, and its starting value with a reason.
6. **Cut condition** — what would tell us to remove this. Write it down; it makes deletion cheap later.

## When asked to fix balance

Diagnose before adjusting. Ask, or reason from the code, in this order: what is the player's actual time-to-kill on this enemy, how much safe space do they have, how often are they forced to move, and what is the failure actually caused by. Then change the smallest number that addresses the cause.

Read `references/balance-math.md` when you need concrete formulas: time-to-kill and DPS budgeting, difficulty-ramp curve shapes, upgrade-economy scaling, and the spawn-budget point system that `wave-design` also uses.

## Related skills

- **game-feel** — once a mechanic exists, its impact, feedback and HUD readability belong there.
- **wave-design** — pacing and encounter composition; it consumes the spawn-budget points defined here.
- **web-to-mobile-game** — any mechanic must be playable with a thumb on a phone; check control cost there before committing.
