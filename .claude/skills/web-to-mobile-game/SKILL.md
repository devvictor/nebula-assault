---
name: web-to-mobile-game
description: Architect Nebula Assault as a web/HTML5 game that ports cleanly to iOS and Android. Use this skill whenever setting up the project or build tooling, choosing an engine, renderer or library, writing the game loop, handling input (touch, pointer, keyboard, gamepad), setting canvas size, resolution, aspect ratio or scaling, positioning HUD elements, playing audio, adding vibration/haptics, saving progress, or investigating frame rate and performance; and whenever the user mentions phones, iPhone, iPad, Android, App Store, Google Play, Capacitor, Cordova, native wrapper, PWA, or "will this work on mobile". Read this before writing the first line of engine code — retrofitting these constraints later is expensive.
---

# Web-First, Mobile-Ready Architecture

Nebula Assault ships on the web first and then to iOS and Android as a wrapped native app. That works well — **if** the mobile constraints are designed in from the first commit. Almost every failed web→mobile game port failed for the same handful of reasons, all of which are cheap to prevent and expensive to retrofit. Enforce the rules below even when the current target is desktop browser.

## Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | Balance data and entity configs benefit enormously from types |
| Build | Vite | Fast HMR, trivial static output — which is exactly what a native wrapper needs |
| Rendering | **Phaser 3** if you want batteries included (sprites, atlases, audio, tweens, arcade physics). Plain **Canvas2D/WebGL** if you want full control and a tiny bundle. | Either ports fine; Phaser saves weeks on a shooter specifically |
| Native wrap | **Capacitor** | Wraps the same static build for iOS and Android, gives native plugins (haptics, status bar, safe area) without changing the game code |
| Audio | Web Audio (via the engine's layer) | Must handle the iOS unlock gesture |
| Persistence | One storage adapter over `localStorage` | Swap to Capacitor Preferences for native without touching game code |

Decide Phaser vs raw canvas once, early, and record the decision. Do not mix.

The port path itself — Capacitor init, platforms, icons, splash, store checklists — is in `references/capacitor-port.md`. Read it when actually building for a device.

## The non-negotiables

### 1. Touch is the primary input model

Design and implement for a thumb from day one; keyboard is the *alternate*, never the assumption.

- Route everything through **Pointer Events** (`pointerdown/move/up`), which covers mouse, touch and pen with one code path. Do not write separate mouse and touch handlers.
- Abstract input behind an **intent layer**: the game reads `intent.move`, `intent.fire`, `intent.dash` — never raw events. Adding a gamepad or on-screen stick later then costs nothing.
- No mechanic may require a key that has no thumb equivalent. If a design needs three simultaneous inputs, it fails on mobile — send it back to `game-core-loop`.
- Interactive targets ≥44 px (logical) with generous invisible hit padding.
- Set `touch-action: none` on the canvas and prevent default on pointer events, or the browser will scroll/zoom mid-fight.
- Assume the bottom corners are **occluded by thumbs** — nothing critical goes there (see `wave-design` spawn-zone rules).
- Ship an auto-fire option. Holding a fire button with one thumb while steering with the other is worse than it sounds; most mobile shooters auto-fire.

### 2. Fixed logical resolution, scaled to fit

- Pick one logical resolution (**480×854** portrait is a good arcade-shooter default) and do all gameplay maths in those units. Never in device pixels.
- Scale to the viewport with letterboxing, or fit-width with a tolerated vertical range. Decide which, and clamp the extremes — do not let the play field grow arbitrarily on a tablet, or the difficulty changes with the device.
- Handle device pixel ratio for crispness, but cap it at 2 — rendering at DPR 3 on a phone burns the frame budget for pixels nobody perceives.
- Test at the narrowest and widest ratios you support before calling any layout done.

### 3. Safe areas are part of the layout

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` plus `env(safe-area-inset-*)` for anything HUD.
- The boss health bar, score and pause button must clear the notch/status bar at the top and the gesture bar at the bottom. The boss bar's top offset already accounts for this in `game-feel`.
- Never place gameplay-critical information within 24 px of any screen edge.

### 4. Fixed-timestep simulation, decoupled render

Variable-timestep physics means the game plays differently at 60, 90 and 120 Hz, and phones vary. Use a fixed accumulator:

```ts
const STEP = 1 / 60
let acc = 0
function frame(now: number) {
  acc += Math.min((now - last) / 1000, 0.25)  // clamp to survive tab-switches
  while (acc >= STEP) { update(STEP); acc -= STEP }
  render(acc / STEP)                           // interpolate for smoothness
  requestAnimationFrame(frame)
}
```

Express every tuned duration in **seconds**, not frames, so the frame counts in the game-feel recipes hold at any refresh rate. Clamp the delta so a backgrounded tab doesn't resume with a physics explosion. Pause on `visibilitychange` — on mobile this fires constantly.

### 5. Audio must survive iOS

- Web Audio starts suspended until a user gesture. Resume the audio context on the first `pointerdown` and only then start music. Never assume autoplay.
- Preload and decode before gameplay; a decode mid-wave is a frame spike.
- Handle interruptions (calls, backgrounding) by suspending and resuming the context, not by recreating it.
- Respect the device silent switch behaviour rather than fighting it, and always ship independent music/SFX volume controls.

### 6. Budget for a mid-tier phone, not your Mac

The dev machine will happily run something a real device cannot. Hold a 16.6 ms frame on mid-tier hardware:

- **Pool everything** spawned during play: bullets, enemies, particles, damage numbers, health bars. Zero allocation in the game loop — GC pauses read as stutter.
- Never allocate per frame: no object/array literals, no closures, no string building in `update`/`render`. Reuse vectors.
- One texture atlas; batch draws. Every texture swap costs.
- Respect the caps in `game-feel/references/juice-recipes.md` (particles, visible health bars, concurrent audio voices).
- Avoid per-frame DOM/CSS work for HUD — draw the HUD in the canvas, or update DOM only on change.
- Profile on a real mid-range device before adding any more visual layers, and add a quality tier that scales particle and effect budgets down.

### 7. Nothing WebView-specific creeps in

- Keep persistence behind one storage adapter; iOS clears some web storage aggressively, and native uses a different backing store.
- Avoid APIs the wrapped WebView may lack or gate (fullscreen requests, orientation lock via web API, gamepad quirks, WebGL2-only features). Feature-detect, degrade gracefully.
- Do not depend on the URL bar, browser back, or window resizing conventions for game state.
- All assets local and relative-pathed. No CDN dependency at runtime — a wrapped app may open with no network.
- Lock orientation through the native config, not JavaScript.

## When asked to build a feature

Ask, in this order: does it work with one thumb, does it fit the logical resolution and safe areas, does it allocate during play, does it need audio or storage, and would it behave differently at 120 Hz. Address each before writing code.

## Related skills

- **game-core-loop** — control cost of a mechanic is a design constraint, not an implementation detail.
- **game-feel** — haptics, particle caps and the HUD safe-area anchoring live against these rules.
- **wave-design** — phone aspect ratio and thumb occlusion change what patterns are fair.
