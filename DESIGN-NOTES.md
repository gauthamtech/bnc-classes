# Design implementation notes

Engineering companion to `DESIGN.md`.

`DESIGN.md` is written to be fed to **Google Stitch** as a design system, so it
contains only visual language and screen briefs. Everything an implementer needs
and Stitch does not — platform constraints, build order, CSS tokens — lives here.

**Do not paste this file into Stitch.** It will dilute the prompt.

---

## 1. What Stitch cannot know

Stitch produces screens. It has no knowledge of the runtime these screens live
in, and three constraints of that runtime override anything it generates.

**This runs in an Android WebView, not a browser.**
- `backdrop-filter` is expensive on low-end Android. It is justified exactly once,
  on the sticky top bar, at `blur(12px)` or below. Never on a scrolling element
- `overscroll-behavior: none` so the view does not rubber-band like a document
- `-webkit-tap-highlight-color: transparent`, with real press feedback instead
- `min-height: 100dvh`, never `100vh`
- `env(safe-area-inset-*)` respected top and bottom
- Images need `-webkit-touch-callout: none` and `-webkit-user-drag: none`

**`FLAG_SECURE` is on the player activity.**
Screenshots and recordings come out black. Do not build any UI that depends on a
captured frame of the video — no generated poster images, no thumbnail grid, no
"recently watched" strip showing stills. A cached thumbnail elsewhere in the app
would be a copy of the content the OS is specifically protecting.

**Google sign-in must use Chrome Custom Tabs.**
Google refuses OAuth inside a plain WebView. This is a shell requirement, not a
design one, but it shapes the sign-in screen: the Google button leaves the app
and returns.

**Asset paths must stay relative.**
Vite only rewrites paths in HTML and CSS, never in components. Everything goes
through `src/lib/assets.ts`. An absolute `/brand/...` path in JSX breaks the app
when served from a subfolder.

---

## 2. What already works — keep it

The current build is not a blank slate. These predate the redesign and are
correct:

- The palette and both typefaces
- Border-based depth on a dark ground
- 48px touch targets and the 97% press scale
- `prefers-reduced-motion` handling on the splash
- Safe-area insets and disabled overscroll
- Relative asset paths via `src/lib/assets.ts`
- The tone of the copy, particularly on the two gate screens — it explains
  without accusing, and should not be rewritten

The redesign is **additive**. None of it requires discarding the existing CSS
architecture.

---

## 3. Order of work

Ranked by student-visible impact per hour spent.

1. **Continue watching on Home** — removes a tap and a hunt from the single most
   repeated action in the product. A student with one course currently has to
   tap in and find their place manually
2. **Skeletons everywhere** — the largest perceived-speed win available, and it
   costs no network. Replaces every "Loading…" string
3. **Progress on course cards and lesson groups** — turns a flat list into a
   sense of momentum
4. **Next / previous lesson on the player** — currently only "back to all
   lessons", forcing a round-trip through the course page after every video
5. **Student-code screen** — the first thing every new student sees, and the one
   screen read aloud over a phone
6. **Splash minimum down to 600–800ms** — currently 1500ms on every launch. For
   a daily-use app that is hours per student per year spent looking at a logo.
   `MIN_MS` in `components/Splash.tsx`
7. **Offline state** — patchy mobile data is normal in Calicut, not an exception.
   It needs its own state, distinct from an error
8. **Type scale and spacing tokens** — mechanical and low risk. Apply while
   touching each screen rather than as one sweep
9. **Admin polish** — last. One person uses it

---

## 4. Error handling

Three distinct treatments. Do not collapse them into one red box.

1. **Field error** — inline, below the input, in Alert Rose
2. **Action failed** — a notice at the top of the screen with a retry
3. **Offline** — its own state, not an error: "You are offline. Your progress is
   saved and will sync"

**Never show a raw Postgres or Supabase message to a student.** Map codes to
sentences a fourteen-year-old understands. `routes/admin/Courses.tsx` already
does this for unique-violation `23505` — follow that pattern everywhere.

---

## 5. Accessibility checklist

- Minimum 48×48px touch target on everything interactive
- Contrast is already met by the palette; do not introduce a colour without
  checking it. Signal Cyan on Midnight Ground measures 7.8:1, Dim Slate on Panel
  Navy 6.4:1 — both pass AA
- Visible focus ring on every focusable element: 2px Signal Cyan, 3px offset
- Every icon-only control carries an `aria-label`
- Every input has a real `<label>`; a placeholder is never a substitute
- Loading regions carry `role="status"`
- `prefers-reduced-motion` honoured on every new animation
- Meaning is never carried by colour alone — the completion tick is a shape as
  well as a colour

---

## 6. Tokens to add

Paste into `:root` in `web/src/styles.css` alongside the existing tokens. These
are additive — nothing here replaces an existing value.

```css
:root {
  /* type scale */
  --t-title: clamp(1.5rem, 5.5vw, 1.9rem);
  --t-h2:    clamp(1.15rem, 4vw, 1.35rem);
  --t-h3:    1.05rem;
  --t-body:  1rem;
  --t-sm:    .9rem;
  --t-meta:  .82rem;
  --t-label: .72rem;

  /* spacing — 4px base */
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px;
  --s-4: 16px; --s-5: 20px; --s-6: 24px;
  --s-7: 32px; --s-8: 40px; --s-9: 56px;

  /* motion */
  --d-1: 120ms; --d-2: 180ms; --d-3: 320ms; --d-4: 420ms;
  --ease-in-out: cubic-bezier(.4, 0, .2, 1);

  /* functional signals */
  --danger:      #FF9FAA;
  --danger-line: rgba(255,126,141,.4);
  --warn:        #FFC48A;
}
```

Existing tokens already in `styles.css` and referenced by name in `DESIGN.md`:

| `DESIGN.md` name | CSS token | Value |
| --- | --- | --- |
| Midnight Ground | `--bg` | `#060814` |
| Recessed Night | `--bg-2` | `#090C1D` |
| Panel Navy | `--surface` | `#0D1128` |
| Raised Navy | `--surface-2` | `#131836` |
| Hairline | `--line` | `rgba(255,255,255,.075)` |
| Edge Line | `--line-2` | `rgba(255,255,255,.14)` |
| Signal Cyan | `--cyan` | `#00ADEF` |
| Cyan Lift | `--cyan-hi` | `#4FC8FF` |
| Deep Ink | `--on-cyan` | `#041224` |
| Logo Indigo | `--indigo` | `#2E3094` |
| Bright Ice | `--text` | `#F1F4FF` |
| Muted Periwinkle | `--text-2` | `#A2ACCB` |
| Dim Slate | `--text-3` | `#8791B0` |
