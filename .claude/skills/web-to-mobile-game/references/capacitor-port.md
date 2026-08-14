# Capacitor Port Path — Nebula Assault

The concrete steps to take the web build to iOS and Android. Read when actually targeting a device; the architectural rules in `SKILL.md` apply from day one regardless.

- [Prerequisites](#prerequisites)
- [Project layout](#project-layout)
- [Web setup that the wrapper depends on](#web-setup-that-the-wrapper-depends-on)
- [Adding Capacitor](#adding-capacitor)
- [Configuration](#configuration)
- [Plugins worth adding](#plugins-worth-adding)
- [Icons and splash screens](#icons-and-splash-screens)
- [Build and run loop](#build-and-run-loop)
- [Device testing checklist](#device-testing-checklist)
- [Store submission checklist](#store-submission-checklist)
- [Alternatives, and when they beat Capacitor](#alternatives-and-when-they-beat-capacitor)

## Prerequisites

| Target | Needs |
|---|---|
| Both | Node 18+ (this machine has Node 22), the web build producing a static `dist/` |
| iOS | macOS, Xcode, CocoaPods, an Apple Developer account ($99/yr) for App Store or device testing beyond a free provisioning profile |
| Android | Android Studio, JDK 17, a Google Play developer account ($25 one-off) |

Android is the easier first target — no yearly fee, faster iteration, and its WebView (Chromium) matches desktop Chrome behaviour closely. iOS WKWebView is where surprises live, so test it early even if you ship Android first.

## Project layout

```
Nebula-Assault/
├── index.html
├── src/                 # game code — no platform-specific code here
│   ├── data/            # balance.ts, waves.ts (tuning lives here)
│   ├── platform/        # thin adapters: storage, haptics, audio-unlock
│   └── ...
├── public/              # local assets only; no runtime CDN
├── dist/                # Vite output — this is what Capacitor wraps
├── capacitor.config.ts
├── ios/                 # generated; commit it
└── android/             # generated; commit it
```

The `src/platform/` adapters are the whole trick: game code calls `storage.save()` and `haptics.impact()`, and only those files know whether they're running in a browser or in a WebView.

## Web setup that the wrapper depends on

`index.html` — the viewport meta is what makes safe areas work:

```html
<meta name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1,
               user-scalable=no, viewport-fit=cover">
```

CSS baseline:

```css
html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }
body { overscroll-behavior: none; -webkit-user-select: none; user-select: none;
       -webkit-tap-highlight-color: transparent; }
canvas { display: block; touch-action: none; }
/* HUD overlay, if any lives in DOM */
.hud { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
```

Vite needs relative asset paths for the WebView:

```ts
// vite.config.ts
export default { base: './' }
```

An absolute `base` is the single most common reason a Capacitor build shows a black screen — assets 404 inside the WebView.

## Adding Capacitor

```bash
npm i @capacitor/core && npm i -D @capacitor/cli
npx cap init "Nebula Assault" com.example.nebulaassault --web-dir dist
npm run build

npm i @capacitor/android && npx cap add android
npm i @capacitor/ios     && npx cap add ios      # macOS only
```

Pick the bundle/application id carefully — changing it after a store release means a new app listing. Use a domain you control.

## Configuration

```ts
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.example.nebulaassault',
  appName: 'Nebula Assault',
  webDir: 'dist',
  android: { backgroundColor: '#000000' },
  ios: { contentInset: 'never', backgroundColor: '#000000' },
  plugins: {
    SplashScreen: { launchAutoHide: false, backgroundColor: '#000000' },
  },
}
export default config
```

Orientation lock goes in the native projects, not JavaScript:

- **iOS**: `ios/App/App/Info.plist` → `UISupportedInterfaceOrientations` limited to portrait.
- **Android**: `android/app/src/main/AndroidManifest.xml` → `android:screenOrientation="portrait"` on the main activity.

Hide the splash screen manually once assets have loaded, so the player never sees a black gap between splash and game.

## Plugins worth adding

| Plugin | Use |
|---|---|
| `@capacitor/haptics` | The vibration events in `game-feel/references/juice-recipes.md` |
| `@capacitor/status-bar` | Hide/style the status bar for a fullscreen arcade look |
| `@capacitor/preferences` | Durable save data — back the storage adapter with this on native |
| `@capacitor/splash-screen` | Manual splash control |
| `@capacitor/app` | Pause/resume events; wire these to the game's pause, alongside `visibilitychange` |

Wrap each behind an adapter in `src/platform/` with a web fallback, so the browser build keeps working unchanged.

## Icons and splash screens

Provide one high-resolution source each (1024×1024 icon, 2732×2732 splash, centred art with generous margin), then generate all sizes:

```bash
npm i -D @capacitor/assets
npx capacitor-assets generate
```

iOS icons must have no alpha channel and no rounded corners — the system applies the mask. Submitting a transparent icon gets rejected.

## Build and run loop

```bash
npm run build && npx cap sync      # sync = copy web build + update native deps
npx cap open android               # then Run in Android Studio
npx cap open ios                   # then Run in Xcode
```

`npx cap sync` after every web build, and after adding any plugin. Forgetting it means testing a stale bundle — a classic afternoon lost to a bug that was already fixed.

For fast iteration, point the WebView at the Vite dev server with a `server.url` in the Capacitor config (device and computer on the same network). Remove it before any release build, or you ship an app that loads nothing.

## Device testing checklist

Run this on a real mid-tier phone, not just a simulator — the simulator does not reproduce frame budget, haptics, or audio interruption behaviour.

- [ ] Frame rate holds ~60 fps during the densest wave and during a boss explosion.
- [ ] Audio starts after the first tap; no silent-game bug.
- [ ] Audio survives a phone call / notification and resumes correctly.
- [ ] Backgrounding and returning pauses cleanly; no physics jump, no lost run.
- [ ] Boss bar, score and pause button all clear the notch and the gesture bar.
- [ ] Nothing critical sits under either thumb during play.
- [ ] Save data survives an app kill and relaunch.
- [ ] Haptics fire on damage and phase break, and respect the settings toggle.
- [ ] Portrait lock holds; rotating the device does nothing.
- [ ] No text zoom, no rubber-band scroll, no accidental text selection.
- [ ] Play with no network — everything loads.
- [ ] Reduced-motion setting scales shake/flash without changing timings.
- [ ] Cold-start time to playable is acceptable, and the splash hides only when ready.

## Store submission checklist

Shared:
- Privacy policy URL (both stores require one, even for a game that collects nothing).
- Accurate data-collection disclosure — Apple's privacy nutrition labels and Google's Data Safety form. If the game truly collects nothing, say so and make sure no analytics SDK contradicts it.
- Age rating questionnaires (a shooter with no gore/blood typically lands low, but answer honestly).
- Screenshots at required device sizes, plus an app preview video if you want one.
- Support URL and contact email.

iOS specifics:
- Icon with no alpha; all required sizes present.
- Version and build number incremented per upload.
- Upload via Xcode or Transporter; expect TestFlight processing time.
- Apple rejects apps that are only a thin website wrapper — a real game with native feel, offline play and no visible browser chrome is fine, but do not leave URL-bar-like UI or web navigation visible.

Android specifics:
- Signed release **AAB** (not APK) for Play; keep the upload keystore safe and backed up — losing it is a serious problem.
- `targetSdk` at Play's current minimum requirement.
- Fill the Data Safety and content rating forms; internal testing track first.

Budget real time for review on both stores, and expect at least one round of feedback on a first submission.

## Alternatives, and when they beat Capacitor

| Option | When it wins |
|---|---|
| **PWA only** | Fastest path, no store fees or review; loses store discovery, and iOS PWA install is awkward |
| **Capacitor** (recommended) | Store presence with one shared codebase; native plugins available |
| Cordova | Legacy; Capacitor supersedes it — no reason to start here |
| Native rewrite (Swift/Kotlin) or Unity/Godot | Only if the game later needs heavy 3D, deep platform integration, or console targets. For a 2D arcade shooter this is not worth it |

Shipping the PWA first and adding the Capacitor wrap later is a perfectly good sequence — as long as the architectural rules in `SKILL.md` were followed from the start, the wrap is a day of work rather than a rewrite.
