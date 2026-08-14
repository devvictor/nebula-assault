# Nebula Assault

A web-first arcade space shooter built on **Phaser 4**, architected to wrap as an
iOS and Android app. All art is baked from Graphics at boot and all audio is
synthesised, so there are no asset files and nothing to fetch at runtime.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run typecheck
```

## Controls

| Action | Touch | Keyboard |
|---|---|---|
| Move | Drag anywhere (relative drag — the ship keeps its offset, so your thumb never covers it) | WASD / arrows |
| Fire | Auto-fire, on by default | Space / X |
| Dash | Second finger, or double-tap | Shift / Z |
| Pause | Button, top-left | P / Escape |
| Menus | Tap | Arrows + Enter, or 1-3 to pick an upgrade |

## Stack

| Layer | Choice |
|---|---|
| Engine | Phaser 4.2 (WebGL renderer, Arcade physics, Web Audio) |
| Language | TypeScript (strict) |
| Build | Vite |
| Native wrap | Capacitor (`capacitor.config.json` is ready) |

Bundle is ~1.76 MB raw / ~405 KB gzipped, essentially all Phaser.

## How it is put together

```
src/
├── main.ts        Phaser.Game config — scale, physics, scenes
├── core/          layout (logical size, depth bands, safe-area insets),
│                  settings, synth (procedural audio on Phaser's AudioContext)
├── platform/      the ONLY files that know about the host: storage, haptics
├── data/          every tunable number: balance, enemies, waves, upgrades
├── objects/       Player, Enemy, Boss, Bullet, Pickup, HealthBar
├── systems/       textures (baked at boot), movement, patterns,
│                  WaveDirector, Juice (hit-stop / shake / flash / particles)
├── scenes/        Boot, Title, Game, Hud, Upgrade, Pause, GameOver, Settings
└── ui/            menu widget shared by the overlay scenes
```

Four project skills in `.claude/skills/` are the design authority for this repo —
read the relevant one before changing gameplay:

- **game-core-loop** — mechanics, progression, balance. HP is derived from a
  target time-to-kill; difficulty comes from composition and pressure, never HP
  inflation.
- **game-feel** — impact, juice, HUD readability, and the mandatory boss/alien
  health-bar spec.
- **wave-design** — wave grammar, the solo-debut protocol for new enemies, boss
  phase structure.
- **web-to-mobile-game** — the portability rules below, and the Capacitor port path.

### How the design rules map onto Phaser

- **Fixed timestep** — Arcade physics runs with `fixedStep: true` at 60 Hz, so the
  simulation is identical at 60, 90 and 120 Hz. Every tuned duration is in
  seconds or milliseconds, never frames.
- **Fixed logical resolution** — the Scale Manager owns 480x854 with
  `FIT` + `CENTER_BOTH`; all gameplay maths is in game units.
- **Safe areas** — Phaser knows nothing about notches, so `core/layout.ts` reads
  `env(safe-area-inset-*)` and converts to game units. Insets are cached and
  refreshed on resize, never read per frame.
- **Hit-stop** — global hit-stop pauses `physics.world`, which freezes combat
  while tweens, particles and the HUD keep running. Per-entity hit-stop zeroes
  and restores that body's velocity, so the player is never frozen on their own hit.
- **Shake** — the trauma model is kept rather than Phaser's raw duration+intensity:
  offset scales with `trauma²`, and simultaneous events take the max, never the sum.
- **Pooling** — every bullet, enemy, pickup and damage number comes from a Group
  or a pool. Nothing allocates during play.
- **Draw order is a readability rule** — see `DEPTH` in `core/layout.ts`. Alien
  bars sit *under* projectiles so a bar can never hide a bullet.
- **HUD is its own scene** — it keeps rendering while the arena is paused or
  frozen, and camera shake never touches it.
- **One `intensity` setting** scales shake, flash, particles and haptics to zero
  without changing a single gameplay timing or hitbox.

### Tuning

All knobs live in `src/data/`. `balance.ts` holds the numbers, `enemies.ts` the
roster and its spawn-budget point costs, `waves.ts` the authored waves (sets 1-3)
plus the procedural generator that continues past them, `upgrades.ts` the pool.
Change one knob per pass and write down the expected felt effect first.

Waves require a `teachingGoal` and a `threatAxis` as a matter of type, not
convention — a wave without one is filler.

## Shipping to iOS / Android

The web build is the app; Capacitor wraps it. `capacitor.config.json` is already
here, and `vite.config.ts` keeps `base: './'` so the WebView does not 404.

```bash
npm i @capacitor/core && npm i -D @capacitor/cli
npm i @capacitor/android && npx cap add android
npm i @capacitor/ios && npx cap add ios      # macOS + Xcode

npm run build && npx cap sync                # sync after EVERY web build
npx cap open android
```

Full checklist — orientation lock, icon/splash generation, haptics plugin, device
testing and store submission — is in
`.claude/skills/web-to-mobile-game/references/capacitor-port.md`.

## Dev notes

In dev builds only, `window.__game` and `window.__step(frames, deltaMs)` are
exposed. `__step` drives `game.step()` by hand, which is the only way to inspect
the game from an automated session — the browser pauses `requestAnimationFrame`
whenever the tab is hidden.

Phaser's input binds `mousedown`/`touchstart`, **not** `pointerdown`. Synthetic
`PointerEvent`s are ignored; dispatch `MouseEvent('mousedown')` or touch events
when scripting the game from the console.
