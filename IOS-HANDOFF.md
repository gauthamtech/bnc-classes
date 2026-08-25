# iOS build — handoff

**You are picking this up on a Mac. Read this file top to bottom before touching
anything.** It is written for someone with no prior context on this project.

Your job: **get the iOS app finished, on a real iPhone, and into TestFlight.**

---

## 1. What the product is

Bineesh K runs BNC Physics Tuition Centre in Chevayoor, Calicut. He sells
recorded physics courses to students in grades 9–12 — roughly **400 hours of
video**, at **₹30,000 per student per year**. Students pay him offline, cash or
UPI, and he enrols them by hand. The app is where they watch.

**His one hard requirement: videos must not be downloadable or recordable.**

That requirement is why this is a native app rather than a website. Keep it in
mind for every decision — it is what he is paying for.

---

## 2. What already exists — do not rebuild it

| Part | State |
| --- | --- |
| `web/` — React 19 + TypeScript + Vite | Finished, verified against real student accounts |
| `supabase/` — Postgres schema, RLS, 8 migrations | All run in production |
| `android/` — native Java shell | Finished, FLAG_SECURE verified, demo APK shipped |
| `web/ios/` — Capacitor project | **Scaffolded and code-complete. Never compiled.** |

**The iOS project is already generated and configured.** Do not run
`npx cap add ios` again — it exists, with custom Swift in it that a regenerate
would destroy.

### Do not touch

- **`android/`** — it works, FLAG_SECURE is verified on device, and it is not
  managed by Capacitor. Changing it risks the only proven protection in the
  product for no iOS benefit.
- **The RLS model in `supabase/`** — security lives in Postgres, not the client.
  A UI bug cannot leak paid content, and that property is load-bearing.
- **`web/src/`**, unless fixing something genuinely iOS-specific. It is shared
  with Android; a change here changes both.

---

## 3. Mac setup from zero

```bash
git clone https://github.com/gauthamtech/bnc-classes.git ~/bnc-classes
```

**Node** — install the macOS LTS `.pkg` from nodejs.org. Needs Node 20+.
Homebrew is not required and is a detour.

**Xcode** — from the Mac App Store, 10 GB+. Then run `xcode-select --install`.

**`web/.env.local` — this is the step people miss.** It is gitignored on purpose
and is **not in the repo**. Without it the app builds fine and shows *"Not
connected yet"*, with no other clue. Copy it from the Windows machine at
`D:\BNC App\web\.env.local`, or recreate it from `web/.env.example` using the
Supabase project URL and anon key.

The anon key is safe to embed — row-level security decides what it can read.
**The `service_role` key must never appear in the app, in git, or in a chat.**

Then:

```bash
cd ~/bnc-classes/web
npm install
npm run build
npx cap sync ios
open ios/App/App.xcodeproj
```

---

## 4. How the app is put together, and why

**The web build is bundled inside the app.** There is no hosted URL, on either
platform. The client explicitly does not want a web presence for the app — no
link, nothing shareable. `capacitor.config.ts` sets `webDir: 'dist'`, and
`cap sync` copies the built output into the iOS project.

**Consequence that matters:** new lessons do **not** need an app release. Videos
are data, fetched at runtime from Supabase, so content can be uploaded weekly and
a two-year-old build still sees it. Only code changes need a release.

**`server.iosScheme` is `capacitor`. Do not change it.** WKWebView needs a stable
secure origin or `localStorage` is unreliable — and the Supabase session lives in
`localStorage`. Get this wrong and students are silently signed out.

---

## 5. Capture protection — the entire point

Android uses FLAG_SECURE: the OS refuses to place the window in any screenshot or
recording. Verified working — recordings come out black.

**iOS has no equivalent** short of FairPlay DRM. `SecureViewController.swift`
does the closest achievable thing:

| Leak | Handling |
| --- | --- |
| Screen recording, AirPlay mirroring | `UIScreen.isCaptured` — content blanked, and **playback paused** so audio is not captured either |
| App-switcher snapshot | Covered on `willResignActive`. iOS photographs the app when backgrounding; a paused lesson frame would sit in the switcher and in backups |
| Screenshots | **Not preventable.** Detectable only after the shutter. A single frame is low value — which is why DRM is not worth it yet |

A recording already running when the app opens is caught too — state is checked
on load, not only on change.

**Say the difference plainly to the client: Android blocks, iOS reacts.** Do not
let anyone believe the two are equivalent.

`JailbreakCheck.swift` warns on jailbroken devices but does not block — detection
is heuristic and a false positive locks out a paying student. Skipped in the
simulator.

**WARNING: `UIScreen.isCaptured` does not behave correctly in the simulator.**
The protection can only be verified on a physical iPhone. This is the single most
important thing to test, and it cannot be done until the Apple account exists.

---

## 6. Auth — subtle, and easy to break

**Email and password only.** Google sign-in was built, then deliberately removed:
it needed Chrome Custom Tabs plus a deep link, a Google Cloud dependency, and an
OAuth consent screen to maintain. The plumbing is left in place but dormant and
marked as such in `web/src/lib/shell.ts`.

**Every email flow is a CODE, never a link. This is not a preference.** The app
is bundled inside the binary, so there is no web address for a link to return to
— and a reset email can be opened on a different device from the one that asked
for it. This was learned the hard way: reset links pointed at a custom scheme and
Safari reported *"the address is invalid"*.

Both Supabase email templates use `{{ .Token }}` and contain **no**
`{{ .ConfirmationURL }}`:

- Authentication → Emails → Templates → **Reset Password**
- Authentication → Emails → Templates → **Confirm signup**

**Do not reintroduce link-based flows.** They appear to work in a browser and
fail inside the app.

Supabase's OTP length is a project setting, not a constant — it was 8 digits
before being set to 6. `SignIn.tsx` accepts 6 to 10 rather than pinning a number
the dashboard can change underneath it.

---

## 7. Gotchas already paid for

- **`npx cap add ios` must not be re-run.** `SecureViewController.swift` and
  `JailbreakCheck.swift` are registered by hand in `project.pbxproj` — the
  project uses explicit file references, not synchronised folders, so any new
  Swift file needs registering in **four** places: `PBXBuildFile`,
  `PBXFileReference`, the group's `children`, and the `Sources` build phase.
- **Capacitor 8 uses Swift Package Manager, not CocoaPods.** There is no
  `.xcworkspace` and no `pod install`. Build `App.xcodeproj` directly.
- **The app icon must have no alpha channel.** Apple rejects it. The 1024 by 1024
  icon is pre-flattened onto `#060814`.
- **`ITSAppUsesNonExemptEncryption` is already `false`** in `Info.plist`, so the
  export-compliance question is answered once rather than on every upload.
- **Portrait is locked**, matching Android. Whether video should rotate for
  fullscreen is an open product question — for 400 hours of physics diagrams on a
  phone, landscape is a real readability win. Ask before changing.
- **App Store guideline 4.2** rejects thin web wrappers. The defence is that this
  app provides capability a website cannot: OS-level capture protection, offline
  session handling, device limits. Expect at least one rejection round. **Do not
  promise a launch date that assumes first-time approval.**

---

## 8. Blocked on the client — chase this first

**Apple Developer Program enrolment, in Bineesh sir's name.** 99 USD per year,
individual (organisation needs a D-U-N-S number and takes weeks).

Nothing reaches a real iPhone or TestFlight without it, and the capture
protection cannot be verified without a real iPhone. **Every remaining step sits
behind this.** Simulator work can proceed meanwhile.

---

## 9. What "done" looks like

- [ ] App builds and runs in the iOS simulator
- [ ] Sign in with email and password
- [ ] Home shows enrolled courses and Continue watching
- [ ] A lesson plays, inline and fullscreen
- [ ] Progress saves and resumes on reopen
- [ ] Sign-up by code, and password reset by code, both work end to end
- [ ] Admin panel loads; video upload works via the file picker
- [ ] **On a physical iPhone:** screen recording produces a black video
- [ ] **On a physical iPhone:** the app-switcher snapshot shows no lesson content
- [ ] Signed build uploaded to TestFlight and installed from it
- [ ] App Store listing, with a privacy policy URL — required, does not exist yet

---

## 10. Commands

```bash
cd ~/bnc-classes/web && npm run build && npx cap sync ios
```

```bash
open ~/bnc-classes/web/ios/App/App.xcodeproj
```

`codemagic.yaml` at the repo root builds and signs on a hosted Mac and ships to
TestFlight. Now that a real Mac exists it is optional, but it keeps releases
independent of one machine being switched on.

---

## 11. Further reading, in the repo

| File | What it covers |
| --- | --- |
| `HANDOFF.md` | The whole project: product, database, decisions, and a long list of gotchas |
| `IOS.md` | iOS specifics and the Codemagic route |
| `android/README.md` | The Android shell, for reference — do not modify |
| `DESIGN.md` | Design system, written to be fed to Google Stitch |
| `DESIGN-NOTES.md` | Engineering companion: platform limits, build order, tokens |
| `VIDEO-SETUP.md` | Cloudflare R2 migration, still pending |
