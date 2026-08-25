# BNC Classes — iOS

Built with **Capacitor**, wrapping the same `web/dist` the Android APK bundles.
No hosted URL on either platform.

The Android app in `D:\BNC App\android` is a hand-written native project and is
**not** managed by Capacitor. It works, `FLAG_SECURE` is verified, and sharing a
toolchain would risk the one thing that is proven. Only the web app is shared —
which is where the code actually lives.

---

## No Mac required

Xcode never runs locally. Capacitor 8 uses Swift Package Manager rather than
CocoaPods, so the iOS project generates fine on Windows — there is no
`pod install` to fail.

The loop is: **push to git → Codemagic builds on a hosted Mac → TestFlight puts
it on the iPhone.**

Expect 20–30 minutes per iteration, against seconds on Android. That is the real
cost of having no Mac, and it is worth planning around rather than discovering.

---

## Capture protection — how it differs from Android

This is the part to be honest with the client about.

**Android blocks. iOS reacts.**

`FLAG_SECURE` tells Android's compositor to refuse the window in any capture,
full stop. iOS has no equivalent short of FairPlay DRM. `SecureViewController`
does the closest achievable thing:

| Leak | Handling |
| --- | --- |
| Screen recording, AirPlay mirroring | `UIScreen.isCaptured` — content blanked while active, and playback paused so the audio is not captured either. Recording runs, but records black |
| App-switcher snapshot | Covered on `willResignActive`. iOS photographs the app when it backgrounds, and that image sits in the switcher and in backups — a paused lesson frame would be plainly visible |
| Screenshots | **Not preventable.** Detectable only after the shutter. A single frame of a lecture is low value, which is why this is accepted rather than paying for DRM |

A recording already running when the app opens is caught too — the state is
checked on load, not only on change.

Matching Android properly means **FairPlay DRM**: an Apple certificate you apply
for, a license server or paid service, and repackaging 400 hours as HLS. Weeks
of work and a recurring bill. Only worth it if piracy turns out to cost real
money.

---

## What is set up

- `web/capacitor.config.ts` — app id `com.bncphysics.classes`, `webDir: dist`,
  `iosScheme: capacitor` so `WKWebView` gets a stable secure origin. Without
  that the Supabase session in `localStorage` does not survive a relaunch
- `web/ios/App/App/SecureViewController.swift` — the protection above, wired in
  via `SceneDelegate` (registered in `project.pbxproj` in all four required
  places, since the project uses explicit file references)
- App icon at 1024×1024, flattened onto `#060814` — **Apple rejects any alpha
  channel** in the app icon
- Launch screen on the brand ground, so there is no white flash before first paint
- Portrait only, matching the Android manifest
- `ITSAppUsesNonExemptEncryption = false`, which answers Apple's export
  compliance question once instead of on every TestFlight upload

---

## Before the first build

1. **Apple Developer Program**, in Bineesh sir's name — $99/year. Individual
   enrolment clears in a day or two; organisation needs a D-U-N-S number and can
   take weeks. Individual is fine
2. **Push this project to a private git repo.** Codemagic builds from git; there
   is no upload-a-zip option. The root `.gitignore` already excludes `.env.local`,
   keystores, `node_modules` and all build output
3. **App Store Connect API key** → add it in Codemagic under
   Teams → Integrations → App Store Connect, named exactly
   **`BNC App Store Connect`** to match `codemagic.yaml`
4. Create the app record in App Store Connect with bundle id
   `com.bncphysics.classes`

Then push, and Codemagic runs `codemagic.yaml`.

---

## Local commands

```bash
cd "D:\BNC App\web"; npm run build; npx cap sync ios
```

`cap sync` copies `dist` into the iOS project. Codemagic does this itself on
every build, so committing `ios/App/App/public` is unnecessary — it is gitignored.

---

## Known risk: App Store guideline 4.2

Apple rejects thin web wrappers for "minimum functionality". This app is a web
wrapper, so the risk is real.

The defence is that it provides capability a website cannot: OS-level capture
protection, offline session handling, and device limits. That argument usually
succeeds when the native part is genuine, and here it is — `SecureViewController`
is not decoration.

**Do not promise a launch date that assumes first-time approval.** Budget at
least one rejection round.

---

## Still to do

- Verify on a physical iPhone via TestFlight — especially the capture protection,
  which cannot be tested any other way without a Mac
- Decide whether video should be allowed to play in landscape. Currently portrait
  only, matching Android. For 400 hours of physics diagrams on a phone, landscape
  fullscreen is a genuine readability win and worth revisiting as a product call
