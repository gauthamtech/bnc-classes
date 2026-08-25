# BNC Classes — Android shell

The native wrapper. It exists for **one reason**: `FLAG_SECURE`. A website
cannot stop a student screen recording a lesson; an Android activity can, at the
operating-system level, and the recording comes out black. Everything else here
serves that one activity behaving like a real app.

---

## Build

Java is **not** on PATH and does not need to be — Android Studio ships a JDK.

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
cd "D:\BNC App\android"
.\gradlew.bat assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk`

Install on a plugged-in phone with USB debugging on:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r app\build\outputs\apk\debug\app-debug.apk
```

Or just open `D:\BNC App\android` in Android Studio and press Run.

**Versions, and why:** AGP 8.13.2 with Gradle 8.14, compileSdk/targetSdk 36,
minSdk 24, Java 17 source level. AGP 9.x needs a newer Gradle than is installed
and buys this project nothing. Written in **Java, not Kotlin** — the shell is
~300 lines and Java removes an entire axis of version-compatibility risk.

---

## Where it loads from — BUNDLED

The web build ships **inside the APK**. There is no hosted page, no URL, nothing
anyone could be given a link to. The app talks to Supabase's API and nothing
else. This is the client's requirement, and it is the shipping configuration.

`app/build.gradle.kts`:

```kotlin
buildConfigField("boolean", "LOAD_BUNDLED", "true")
```

Assets are served through `WebViewAssetLoader` at
`https://appassets.androidplatform.net`, **not** `file://`, because the Supabase
session lives in `localStorage` and that needs a secure origin to persist.

### The copy is automatic — do not do it by hand

`app/build.gradle.kts` defines a `syncWebBuild` task wired into `preBuild`. Every
Android build mirrors `web/dist` into `app/src/main/assets/app/`. It uses `Sync`,
not `Copy`, so files deleted from `dist` disappear here too.

It fails the build with a clear message if `web/dist` is missing. So the routine is:

```powershell
cd "D:\BNC App\web"; npm run build
cd "D:\BNC App\android"; .\gradlew.bat assembleDebug
```

Skipping the first step ships yesterday's screens with no error anywhere — which
is exactly why this is a task and not a documented manual step.

### What needs a new release, and what does not

| Change | New Play release? |
| --- | --- |
| New lessons, new courses, enrolments | **No.** Videos are data, fetched at runtime. Upload weekly; a two-year-old APK still sees them |
| Hiding a video, renaming a course | **No** |
| Any React/CSS change | **Yes** |
| Anything in `android/` | **Yes** |

### Remote mode

Setting `LOAD_BUNDLED` to `false` loads `REMOTE_URL` instead. Kept working for
debugging against a deployed build. Not the shipping mode.

---

## Google sign-in

Google refuses OAuth inside a plain WebView, so it cannot happen in the app's
own view. The flow:

1. WebView tries to open the Supabase authorize URL
2. `MainActivity.shouldOverrideUrlLoading` catches it and opens a **Chrome
   Custom Tab** instead
3. Google authenticates, Supabase redirects to **`bncapp://auth-callback#<tokens>`**
4. The manifest intent-filter routes that straight back into `MainActivity`
5. `MainActivity` calls `window.__bncAuth(fragment)` in the WebView
6. `web/src/lib/shell.ts` hands the tokens to `supabase.auth.setSession`

A private scheme is used rather than an https address because the app is not
hosted anywhere — there is no web URL for Google or Supabase to return to. The
web side detects the shell from the `BNCApp/` suffix appended to the user agent.

**Password reset uses the same route.** The email link opens in the phone's
browser, which cannot reach the APK's internal origin, so Supabase redirects to
`bncapp://auth-callback` and Android hands it back to the app. Because
`setSession` raises `SIGNED_IN` rather than `PASSWORD_RECOVERY`, `shell.ts`
inspects the `type=recovery` parameter and dispatches a `bnc:recovery` event that
`useAuth` listens for — without that the student would land on their classes and
the reset would silently do nothing.

### Required Supabase setting

Authentication → URL Configuration → **Redirect URLs** must include:

```
bncapp://auth-callback
```

**Without it Google sign-in fails inside the app**, while continuing to work
fine in a browser — which makes it look like an app bug rather than a
configuration one.

---

## What the shell does

| | |
| --- | --- |
| `FLAG_SECURE` | Set before any content exists, so no frame can be captured. **Verified**: window flags show `SECURE`, and `adb screencap` returns pure black |
| Downloads | Swallowed. `setDownloadListener` deliberately does nothing |
| Long-press | Disabled, so no image/video save callout |
| File picker | `onShowFileChooser` implemented — **without it the admin uploader silently does nothing**, because `<input type="file">` is dead in a WebView by default |
| Back button | Goes back through WebView history, then exits |
| Offline | Native retry screen. A blank white WebView is the worst possible failure |
| External links | Handed to the system browser, so nobody is trapped in an app with no address bar |
| Root check | A **warning**, not a lock — see below |

### Seeing the screens during development

`FLAG_SECURE` blocks **your** screenshots too. Every capture, screen recording
and Android Studio preview comes out black, which makes visual QA impossible.

For that, and only that:

```powershell
.\gradlew.bat assembleDebug -PallowCapture=true
```

The build prints a warning when it does this. It is a Gradle property rather than
a debug/release split so that disabling protection is always a deliberate act on
one build — and the `release` block hard-codes `SECURE_SCREEN = true`, so an
unprotected APK cannot reach Play even by accident.

Confirm protection at any time:

```powershell
adb shell "dumpsys window windows | grep -A 12 bncphysics"
```

`SECURE` must appear in the `fl=` line.

### Root check is deliberately not a block

Detection is heuristic. A false positive means a paying student cannot open the
app at all, which is a support call BNC has to field. Anyone determined enough
to root a phone will also defeat a native check, so the honest value is
deterrence, not prevention.

To make it a hard block, replace the dismiss button in
`MainActivity.warnIfRooted()` with `finish()`.

---

## Still to do

1. **Add `bncapp://auth-callback` to Supabase redirect URLs** — sign-in fails in
   the app until this is done
2. **Test on a real handset.** The emulator does not prove `FLAG_SECURE`; record
   the screen on a physical phone and confirm the video is black
3. **Release keystore.** Needed for a signed APK/AAB. Generate once, back it up
   somewhere permanent — losing it means never being able to update the app on
   Play again, with no recovery path
4. **Play listing** requires a privacy policy URL (item I in `HANDOFF.md`)
