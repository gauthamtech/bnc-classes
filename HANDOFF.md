# BNC Classes — app handoff

Everything about the **student app**. Read this top to bottom and you can pick up
exactly where the last session stopped.

> The marketing website is a separate project in `D:\BNC Website` and is not
> covered here. It is finished and live.

---

## 1. What the app is for

Bineesh K runs BNC Physics Tuition Centre in Chevayoor, Calicut. He wants to sell
**recorded physics courses** on top of his in-person batches.

Students buy access from him directly — cash or UPI, offline. He then enrols them
by hand. The app is where they watch.

- Grades **9, 10, 11, 12**
- NEET, JEE, KEAM to be added later
- Fee reference: **₹30,000 per student per year**
- Roughly **400 hours** of video expected
- His hard requirement: **videos must not be downloadable**

---

## 2. Live addresses and accounts

| | |
| --- | --- |
| App live at | `https://bncphysics.com/app/` — ⚠️ **being retired**, see below |
| Supabase project ref | `kuikafwwkxhmcpokefnf` |
| Supabase URL | `https://kuikafwwkxhmcpokefnf.supabase.co` |
| Firebase project | `bnc-classes` |
| Firebase fallback URL | `https://bnc-classes.web.app/app/` |

The **anon key** is in `D:\BNC App\web\.env.local` and is compiled into builds.
That is correct and safe — row level security decides what it can read.

**The `service_role` key must never appear in the app, in git, or in chat.** It
belongs only in Supabase Edge Function secrets. Verified absent from all builds.

`.env.local` is gitignored. A fresh clone needs it recreated from `.env.example`,
or the build silently produces an app that says *"Not connected yet"*.

### Delivery decision — the app is leaving the website

Client wants **no web presence for the app at all**: no link, no domain, nothing
shareable. The web build will be **bundled inside the APK** rather than loaded
from a hosted URL, so the Android app is fully self-contained and talks only to
Supabase's API.

This is safe for content, and that was the deciding question: **new lessons never
require an app release.** Videos are data — the lesson list is fetched fresh on
every open and the file URL is signed at play time. Upload weekly, a two-year-old
APK still sees them. Only *code* changes need a new release.

The accepted trade-off: any bug fix waits on Google Play review. Client was told
this plainly and chose it anyway.

**✅ IMPLEMENTED.** `LOAD_BUNDLED = true` in `android/app/build.gradle.kts`. The
APK contains the whole web build — HTML, JS, CSS, both fonts, brand images —
served from `https://appassets.androidplatform.net` via `WebViewAssetLoader`.
A secure origin, not `file://`, because the Supabase session lives in
`localStorage`. Verified: `assets/app/*` is present inside the built APK.

A Gradle `syncWebBuild` task mirrors `web/dist` into the APK on every build, so
the bundle cannot silently go stale. It fails the build if `web/dist` is missing.

Consequences:
- **Nothing about the app depends on a web address any more.** Sign-up and
  password reset are emailed codes, not links (see 8C)
- `bncphysics.com/app/` is now redundant and should be removed from the
  website's `stage-deploy.py`. It is still being published today
- ⚠️ `D:\BNC App\firebase.json` + `.firebaserc` are **dead config**. They target a
  hosting site `bnc-app` that was never created — Firebase rejects that name as
  reserved by another project. Safe to delete both files now that the app is
  bundled and needs no hosting at all.
- `web/public/robots.txt` blocks indexing of any such test build

---

## 3. Folder layout

```
D:\BNC App\
  web/                      the app itself
    src/
      routes/               SignIn, Home, Course, Lesson, Profile, Gates
      routes/admin/         Students, Courses
      components/           Splash, Uploader
      lib/                  supabase, useAuth, assets
    public/brand/           logo, favicons, PWA icons, fonts
    .env.local              Supabase URL + anon key   (gitignored)
    dist/                   build output
  supabase/                 SQL migrations + Edge Functions
  compress-videos.ps1       720p batch compressor
  VIDEO-SETUP.md            how to move video to Cloudflare R2
  DESIGN.md                 design system — written to be fed to Google Stitch
  DESIGN-NOTES.md           engineering companion: platform limits, build order
  HANDOFF.md                this file
```

**Stack:** React 19 + TypeScript + Vite · Supabase (Postgres, Auth, Storage) ·
deployed as static files to Firebase Hosting.

---

## 4. What the app does today

### Students
- Sign in with **email + password**. No Google sign-in — removed by choice, see 8C
- Create an account, confirm it with an emailed **code**, reset a password with a **code**. No links anywhere: the app is bundled in the APK and has no web address a link could return to
- Before enrolment, they see a **student code** (`BNC-0001`) to give BNC
- Browse enrolled courses; videos grouped automatically by name prefix
- Watch, with progress saved every 15 seconds and **resume where they stopped**
- Progress bar per course; tick on finished videos
- Edit their own name and phone

### Admins
- **Cannot be self-assigned.** Created only by hand in SQL
- Search students by name, code, email or phone — **server-side**, 50 per page
- Enrol / un-enrol with a tick
- **Reset a student's devices** when they change phone
- Create courses, add videos, upload files, hide/show each, delete

### Screens
`Splash → SignIn → Home → Course → Lesson`, plus `Profile`, and two gate screens:
`DeviceBlocked` and `SetPassword`.

---

## 5. Design decisions and why

| Decision | Reason |
| --- | --- |
| Payment collected manually, permanently | His choice. Also means **Google Play takes no commission**, because there is no in-app purchase |
| **Zero commerce inside the app** | No prices, no buy buttons, no payment links. Adding one puts the app under Play billing and hands Google a cut |
| Enrolment expiry by hand | His choice. `expires_at` column exists, unused, ready |
| No chapters — videos named `Motion - 1` | One level less admin work across 400 files. The app groups by the text before the dash. Anything without a dash falls into "Other lessons" |
| Hash routing + relative asset paths | The same build works at a domain root or any subfolder, with no server config, no `.htaccess` |
| Device limit of 2 | Cheapest anti-piracy measure in the project. One login shared with eight friends loses more money than downloading ever will |
| Android only | `FLAG_SECURE` only works there |
| `grade` stored as text | NEET / JEE / KEAM slot in later with no migration |

---

## 6. Database

Security lives in **Postgres**, not in the app. A UI bug cannot leak content.
Verified from outside the app: an anonymous caller reading any table gets `[]`,
and writing gets `401`.

| Table | Holds |
| --- | --- |
| `profiles` | One row per person. Student code, name, phone, `role` |
| `courses` | One per grade. `grade` is text |
| `lessons` | The videos |
| `lesson_sources` | Where the file lives. **Admin only** — never readable by a student |
| `enrollments` | Who may watch what |
| `devices` | Which phones an account is signed in on |
| `progress` | Where each student stopped |

The rule everything rests on:

```sql
create policy "read lessons of enrolled courses"
  on lessons for select
  using (is_admin() or is_free_preview or has_course_access(course_id));
```

Make the first admin, after that person has signed in once:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

### SQL files — run in this order

| File | Status |
| --- | --- |
| `supabase/00_run_this_first.sql` | ✅ run |
| `supabase/03_flatten_to_videos.sql` | ✅ run |
| `supabase/04_storage_for_testing.sql` | ✅ run |
| `supabase/05_scale_indexes.sql` | ✅ run |
| `supabase/06_prevent_duplicate_courses.sql` | ⬜ **NOT RUN — clear existing duplicates first** |
| `supabase/07_hide_unready_lessons.sql` | ✅ run |
| `supabase/08_fix_video_storage_access.sql` | ✅ run |

`04` was edited to `drop policy if exists` before each `create policy`, because
Postgres has no `create policy if not exists` and re-running it used to fail with
*"policy already exists"*. Both files are now safe to run again at any time.

To confirm storage is set up (SQL editor, role dropdown on `postgres`):

```sql
select
  (select count(*) from storage.buckets where id = 'videos')            as videos_bucket,
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname in ('admins upload videos','admins replace videos',
                          'admins delete videos','read videos when enrolled')) as policies;
```

Expect `1` and `4`.

---

## 7. Commands

Run locally:
```
cd "D:\BNC App\web"; npm run dev
```

Build:
```
cd "D:\BNC App\web"; npm run build
```

Publish. Note the coupling: the deploy script currently lives in the website
project and publishes both together, app landing at `/app/`.
```
cd "D:\BNC App\web"; npm run build; cd "D:\BNC Website"; python stage-deploy.py; firebase deploy --only hosting
```

Compress lesson videos to 720p using the RTX 5070:
```
cd "D:\BNC App"; .\compress-videos.ps1
```
Raw files go in `raw-videos\`, compressed appear in `ready-to-upload\`.

**PowerShell has no `&&`. Use `;`.**

---

## 8. PENDING — priority order

Order is **D → F → E**, then G–I. E is deliberately last: it costs money, and the
client wants it only once he has tested the finished app and is satisfied.

### A. Run two SQL files — ✅ DONE
Both `04_storage_for_testing.sql` and `05_scale_indexes.sql` are run. Video upload
works. Verification query in section 6.

### B. Supabase URL configuration — ✅ DONE
Authentication → URL Configuration.

When the Android shell is built, add the custom scheme to the redirect list:
```
bncapp://auth-callback
```
Keep `http://localhost:5173/**` for local development.

> Note for future debugging: Supabase falls back to the **Site URL** when a
> `redirect_to` is not on the allowlist. Sign-in can therefore look like it works
> while the list is actually incomplete. Check the list itself, not the symptom.

### C. Sign-in — ✅ DONE. Email and password only.

**Google sign-in was built, then deliberately removed.** It worked in a browser,
but inside the shell it needed Chrome Custom Tabs plus a `bncapp://auth-callback`
deep link — four handoffs, a Google Cloud dependency, and an OAuth consent
screen to maintain. Client chose email only. Disable the Google provider in
Supabase → Authentication → Providers if it is still enabled.

The OAuth plumbing is left in place but dormant and clearly marked: `shell.ts`,
`MainActivity`'s Custom Tab interception, and the manifest intent-filter.
Re-enabling Google is otherwise a multi-file change across web and native.

**Every email flow is a CODE, never a link.** This is forced by the app being
bundled into the APK: there is no web address for a link to return to, and a
reset email can be opened on a different device from the one that asked for it.
This was learned the hard way — reset links pointed at `bncapp://auth-callback`
and Safari reported "the address is invalid".

Both templates must contain `{{ .Token }}` and **no `{{ .ConfirmationURL }}`**:
- Authentication → Emails → Templates → **Reset Password**
- Authentication → Emails → Templates → **Confirm signup**

⚠️ **Supabase's OTP length is a project setting, not 6.** This project sent 8
digits at first. `SignIn.tsx` accepts 6–10 rather than pinning a number the
dashboard can change underneath it.

Flows now handled: sign up → code → signed in; forgot password → code → choose
new password; and signing in with an unconfirmed account auto-sends a fresh code
rather than dead-ending on "email not confirmed".

### D. Custom SMTP — ✅ DONE, verified
**Resend**, sending from `noreply@bncphysics.com`, wired into Supabase →
Authentication → SMTP Settings. Host `smtp.resend.com`, port 465, username the
literal word `resend`, password is the Resend API key.

DNS lives at **Hostinger** (`dns-parking.com` nameservers). SPF/DKIM/MX records
for Resend are in place there. The domain had no MX records beforehand, so
nothing conflicted. Leave the `hosting-site=bnc-classes` TXT record alone — that
is Firebase's verification for the app.

Two things that are easy to get wrong if this ever needs redoing:
- **Hostinger auto-appends the domain** in the DNS Name field. A record named
  `send.bncphysics.com` must be entered as just `send`, or it silently never
  verifies.
- **Supabase's email rate limit stays low even after custom SMTP is added.**
  Authentication → Rate Limits has to be raised separately, or resets still fail
  at volume having done all the DNS work.

Resend offers no Mumbai region — the four are N. Virginia, Ireland, São Paulo and
Tokyo. Tokyo was chosen as nearest, but the region only affects API latency, not
delivery speed to a student's inbox.

### E. Cloudflare R2 — SEQUENCED LAST. Costs money, needs a card
**Client's decision: do this only after the app is finished, tested, and he is
satisfied.** Until then the app stays on Supabase Storage, which is enough for
demo clips but not for real lessons.
Currently on Supabase Storage: **50 MB per file, 1 GB total.** Fine for demo
clips, useless for real lessons.

R2: 10 GB free, then $0.015/GB/month, **egress always free** — so 1,000 students
watching costs the same as 10.

- 400 hours compressed to 720p ≈ 160 GB ≈ **₹195/month**
- Uncompressed ≈ 600 GB ≈ **₹760/month**

Full steps in `VIDEO-SETUP.md`. **Both Edge Functions are already written** —
`supabase/functions/play` and `supabase/functions/sign-upload`. Switching over is
a change to two function calls, in `Lesson.tsx` and `Uploader.tsx`.

### F. Android shell — ✅ BUILT AND RUNNING. Verified on an emulator.

**`FLAG_SECURE` is confirmed working.** Window flags report `SECURE`, and
`adb shell screencap` returns pure black while the app is in front. The bundled
web build loads from inside the APK and the sign-in screen renders correctly.
Still worth repeating on a physical handset before release, but the mechanism is
proven.

Note that this blocks *your* screenshots too. Build with
`-PallowCapture=true` for visual QA; release builds force protection back on.

Lives in `D:\BNC App\android`. Full detail in `android/README.md`.

**Java does not need installing** — Android Studio ships a JDK at
`C:\Program Files\Android\Android Studio\jbr`. Set `JAVA_HOME` to it and
`gradlew.bat assembleDebug` works. AGP 8.13.2 / Gradle 8.14 / compileSdk 36 /
minSdk 24, written in Java rather than Kotlin to cut version-compatibility risk.

Debug APK builds clean: `com.bncphysics.classes`, 3.3 MB.

Done: `FLAG_SECURE`, Chrome Custom Tabs sign-in with a `bncapp://auth-callback`
deep link, root warning, offline retry screen, downloads swallowed, long-press
disabled, back-button history, external links handed to the browser, and
`onShowFileChooser` — without which the admin uploader silently does nothing.

**Before it can be tested:** add `bncapp://auth-callback` to Supabase →
Authentication → URL Configuration → Redirect URLs — **no longer required**,
since Google sign-in was removed and every email flow is a code. Add it only if
OAuth is ever switched back on.

Still to do: test on a real handset (an emulator does not prove `FLAG_SECURE`),
and generate a release keystore. **Back that keystore up permanently — losing it
means never being able to update the app on Play again.**

A native shell with the **web build bundled inside the APK** (see section 2 —
no hosted URL, the app is self-contained and calls only Supabase's API):
- **`FLAG_SECURE`** on the player activity → screen recordings come out **black**
- ~~Chrome Custom Tabs for Google sign-in~~ — built, now dormant. Google sign-in
  was removed in favour of email only
- Rooted-device check
- Splash with the BNC logo

**This is the whole reason for the app.** Screen recording is only blocked once it
exists. Roughly a day or two of work.

---

## G–I are NOT part of the app's completion figure

Everything below is either the **client's own work** or waiting on **Google's
queue**. None of it is development, none of it is inside your control, and none
of it is counted in the percentages in section 9. It happens after E, after the
app is tested, and after Bineesh sir is satisfied.

Track it, quote calendar time for it, but never let it drag the build status
down — that has been the source of every "why is it not done yet" conversation
on projects like this.

### G. Google Play — client's task, longest lead time
~₹2,200 one-time, registered in **Bineesh sir's name**, not the developer's. He
then adds you as a user with release permission.

Personal developer accounts may require **12 testers for 14 continuous days**
before a production release is allowed. Organisation accounts are exempt but need
a D-U-N-S number, which takes a couple of weeks to obtain.

**He should start this on day one.** It is the longest pole in the project, and it
is calendar time, not effort.

### H. Content — client's task
400 hours: record, compress, name (`Motion - 1`), upload, verify. Realistically a
week of someone's time. Cannot start properly until R2 is up.

### I. Legal pages
Privacy policy and terms. Required by Google Play and by the OAuth consent screen.

---

## 9. Honest status

Scope of this figure: **items A–F only.** G, H and I are the client's work and
Google's queue, and are excluded by decision — see the note above section G.

| Piece | State |
| --- | --- |
| Web app — student side | ✅ **done and verified on a real student account** — enrol → course → lesson → playback |
| Web app — admin side | ✅ done, plus course delete and duplicate guard |
| Database, RLS, indexes | ✅ done — `00`, `03`, `04`, `05`, `06`, `07`, `08` all run |
| Auth config, email-only sign-in, code-based signup and reset | ✅ done (B, C) |
| Correctness pass | ✅ done — see the gotchas in section 11 |
| Custom SMTP | ✅ done (D) — Resend on `bncphysics.com`, verified |
| Redesign — core screens | ✅ done — tab bar, Continue watching, Profile, both admin screens |
| Redesign — remainder | ◐ skeletons, next/prev lesson, per-group progress, offline state, splash timing |
| **Android shell** | ⬜ **F — not started, the real remaining build** |
| R2 storage swap | ⬜ E — deferred by client until after testing |

**≈ 80% of the original A–F scope.**
**≈ 72% including the redesign.**

A, B, C and D are all done and verified. The web app is finished and looks the
way it is meant to. Everything remaining is the Android shell, an R2 swap the
client has deferred, and redesign polish that does not block anything.

**F is now the only thing standing between this project and a testable product.**

### Why the figure moved so little

A day of work went into finding and fixing defects, not adding features. That
work was worth doing — one of the bugs meant **no student could play any video**,
and it would have surfaced on launch day looking like "the uploads are broken" —
but hardening what exists does not move a completion percentage much. It moves
the *risk*, which is not the same number.

Writing `DESIGN.md` moved the figure by **zero**. A specification is not shipped
work. It is only counted when the screens are built.

If live 1:1 classes are commissioned (roughly 2–3 days as a web page opened via
Chrome Custom Tabs), that is again new scope and the percentage drops again.
**The denominator keeps growing. That is normal, and it is worth saying out loud
to the client rather than quietly re-baselining.**

What that number is made of: the web app is essentially finished and the whole
backend is configured. What remains is one afternoon of email setup, the Android
shell at roughly a day or two, and an R2 switchover the client has parked until
he has tested the app — and that switchover is small, because both Edge Functions
are already written and it touches only two function calls.

Nothing left is research or unknowns. It is all known work of known size.

---

## 10. What protection actually exists

Be straight with the client about this. It will be asked repeatedly.

**Blocked today:** downloading, right-click saving, link sharing (signed URLs
expire in 2 hours), one account used on many devices.

**Not blocked today:** screen recording, and a camera pointed at the screen.

**Once the Android app exists:** screen recording is blocked by `FLAG_SECURE` at
the operating-system level — the recording comes out black. That is stronger than
a website can manage even with paid DRM, and it is free.

**Nothing stops a camera pointed at a screen.** Not DRM, not anything, at any
price. Anyone claiming otherwise is selling something.

Also true: without paid DRM, a rooted Android phone running a proxy can intercept
a signed URL and pull the file. That is the accepted trade-off of skipping DRM,
and it is roughly one student in a hundred.

---

## 11. Gotchas already found — do not rediscover these

- **PowerShell has no `&&`.** Use `;`.
- **`or is_admin()` in an RLS policy means admin sessions see EVERYONE's rows.**
  This is correct security, and it silently breaks any query that leaned on RLS
  to do the filtering. Signed in as an admin, the home screen showed the same
  course once per enrolled student, and `Lesson.tsx` would have thrown outright
  because `maybeSingle()` errors on more than one row. Fixed in `Home.tsx`,
  `Course.tsx` and `Lesson.tsx` by filtering `user_id` explicitly.
  **Rule: RLS is the security boundary, never the query.** Any table whose
  policy contains `or is_admin()` — `enrollments`, `progress`, `devices` — must
  still be filtered by hand in the client.
  Symptom to recognise: everything looks right on a student account and wrong
  only on yours.
- **React effect cleanup can cancel its own timer.** Setting state inside an effect
  that lists that state as a dependency re-runs it, and the cleanup killed the
  `setTimeout` meant to dismiss the splash. It hung on the logo forever.
- **Vite only rewrites asset paths in HTML and CSS, never in components.** Absolute
  `/brand/…` paths in JSX broke the app when served from a subfolder. Everything
  now goes through `src/lib/assets.ts`.
- **Google blocks OAuth inside plain WebViews.** The Android shell must use Chrome
  Custom Tabs or sign-in will fail.
- **Free Supabase projects sleep** after a few days idle and take seconds to wake.
  Every auth call now has a 15-second timeout and the splash an 8-second failsafe,
  because buttons used to hang on *"Please wait…"* with no way back.
- **Supabase's dashboard has a role impersonation dropdown.** If set to
  "unauthenticated" the tables look empty and edits fail. Set it to `postgres`.
- **RLS applies INSIDE another table's policy expression.** The storage policy
  decided video access with `exists (select 1 from lesson_sources …)`, but
  `lesson_sources` is admin-only — so for students the subquery matched nothing
  and no video would play at all. Admins never saw it, because `is_admin()`
  short-circuits first. Any lookup inside a policy must go through a
  `security definer` function, which is why `is_admin()` and
  `has_course_access()` are declared that way. Fixed in `08`.
  **Test RLS with a student account. An admin session proves nothing.**
- **A 0×0 element never fires IntersectionObserver.**
- **Firebase matches `headers` against the REQUESTED path, not the rewritten
  one.** `/app/**` rewrites to `/app/index.html`, but a student requests `/app/`,
  which never matched the `**/*.html` no-cache rule — so the HTML shell was
  served with `max-age=3600`. Every student then ran **hour-old code** after a
  deploy, loading the previous JS hash. It looked exactly like a code bug that
  only affected other people's accounts. Fixed with an explicit `/app{,/**}`
  no-cache rule placed before the immutable-assets rule in the website's
  `firebase.json`. Verify after any hosting change:
  `curl -sI https://bncphysics.com/app/ | grep -i cache-control`
- **Browser console buffers persist across reloads**, so old errors look current.
  Check the ordering before chasing a ghost.
- **Loading every row and filtering in the browser** was how admin search worked
  originally. Fine at 10 students, ~5,000 rows at 1,000. Now server-side.

---

## 12. Commercial notes

- The app is a **separate project from the website, with its own budget.** Do not
  fold it into the ₹45,000 website invoice.
- Suggested milestones: **40%** on signing · **30%** when login and a real lesson
  play · **30%** on delivery of a **signed APK** — *not* on Play Store approval,
  which is Google's timeline, not yours.
- Put in writing before taking money:
  - Screen recording is blocked **in the Android app, not on the website**
  - Video is not copy-proof against a camera pointed at the screen
  - Timeline **excludes** Google Play review and approval
  - Out of scope for v1: online payments, enrolment expiry, iOS, entrance courses
- A **60-day free bug-fix window** is a stronger and more honest promise than
  "zero bugs", which nobody can deliver.
- Running costs are the client's, not yours: R2 storage, Play registration, domain.
