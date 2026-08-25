# Design System: BNC Classes

**Product type:** Mobile app · Android · Dark theme only
**Audience:** Physics students, ages 14–18, Kerala, India
**Purpose:** Watching recorded physics lessons that have already been paid for

This file is the single source of truth for generating screens. Every screen
produced must conform to it.

---

## 1. Visual Theme & Atmosphere

A calm, deep-night study interface. The room this belongs in is a bedroom at 9pm
with the lights off, where the phone is the only light source. Every decision
follows from that: a near-black blue ground, low overall luminance, one bright
element per screen, and no large light surfaces anywhere.

The feeling is a **well-made native Android app**, not a website rendered dark.
Confident, quiet, and slightly technical — closer to a precision instrument than
to a consumer entertainment app. Restraint reads as expensive here; decoration
reads as cheap.

**Density: Daily App Balanced (5/10).** Comfortable but efficient. Not gallery-airy —
airy layouts waste the vertical space of a six-inch phone and push the third
lesson below the fold.

**Variance: Predictable Symmetric (3/10).** Deliberately low. Left-aligned, single
column, consistent placement across screens. This app is opened daily by a tired
student; novel layouts impose a re-learning cost every session. **Predictability
is the premium quality in a tool that gets used every night.** Rhythm comes from
spacing, weight and colour — never from surprising structure.

**Motion: Fluid Restrained (4/10).** Brief and purposeful. Motion confirms a tap;
it never performs.

**This app has no hero section and no marketing surface.** The user has already
paid and signed in. The first screen exists to answer one question — *what do I
watch next* — in under a second.

---

## 2. Color Palette & Roles

A single accent over cool blue-black neutrals. Every neutral is the same
temperature; warm greys never appear.

**Grounds and surfaces**

- **Midnight Ground** (`#060814`) — the page background, darkest surface in the
  system. Never pure black: `#000000` on an OLED panel makes edges vibrate
  against lit content
- **Recessed Night** (`#090C1D`) — inset wells and sunken areas
- **Panel Navy** (`#0D1128`) — cards, panels and list rows, the workhorse surface
- **Raised Navy** (`#131836`) — elements raised inside a card: input fills,
  pressed rows, headers

**Structural lines**

- **Hairline** (`rgba(255,255,255,0.075)`) — default 1px border, almost invisible,
  purely structural
- **Edge Line** (`rgba(255,255,255,0.14)`) — interactive borders: outlined
  buttons, input fields, dividers

Depth is drawn with **1px borders, never shadows**. On a dark ground a drop
shadow is invisible, while a light hairline reads instantly.

**Accent — one only**

- **Signal Cyan** (`#00ADEF`) — the single accent, taken from the BNC logo. Used
  for exactly three meanings and nothing else: **the primary action**, **progress**,
  and **completion**
- **Cyan Lift** (`#4FC8FF`) — pressed and active state of an accent element only
- **Deep Ink** (`#041224`) — text placed on a filled cyan surface
- **Logo Indigo** (`#2E3094`) — depth only, as a large low-opacity wash. Never
  text, never a button

**One cyan moment per screen.** If the primary button is cyan, the label above it
is not. Two competing cyan elements mean neither is the answer to "what do I do
here". Cyan is never decorative.

**Text**

- **Bright Ice** (`#F1F4FF`) — primary text: titles, body, anything read
  carefully. 15.9:1 against Panel Navy
- **Muted Periwinkle** (`#A2ACCB`) — secondary text: descriptions, helper copy.
  8.7:1
- **Dim Slate** (`#8791B0`) — metadata only: counts, durations, timestamps. 6.4:1

Nothing dimmer than Dim Slate is permitted. If text needs to be fainter than
`#8791B0` to look right, it should not be on the screen.

**Functional signals — not accents**

These appear only when something is wrong or destructive, never as decoration:

- **Alert Rose** (`#FF9FAA`) — destructive actions and error text
- **Alert Rose Edge** (`rgba(255,126,141,0.4)`) — border of a destructive control
- **Caution Amber** (`#FFC48A`) — "this will not do what you expect" warnings

There is deliberately **no success green**. Completion is shown in Signal Cyan,
because completion is progress.

---

## 3. Typography Rules

Two families only. A third font is never added.

- **Display — Outfit.** Headings, buttons, labels, numbers, course titles.
  Track-tight at `-0.025em`, line-height 1.1, weight 600. Geometric with real
  character
- **Body — Schibsted Grotesk.** Paragraphs, descriptions, helper text.
  Line-height 1.55, maximum 60 characters per line
- **Numerals.** Durations, counts and codes use tabular figures so columns align.
  No monospace font is loaded

**Scale** — mobile-first, fluid:

- **Screen title** — 1.5rem to 1.9rem, once per screen
- **Card and group heading** — 1.15rem to 1.35rem
- **Row title** — 1.05rem
- **Body** — 1rem. Never smaller for anything that must actually be read
- **Helper text** — 0.9rem
- **Metadata** — 0.82rem, for counts and durations only
- **Eyebrow label** — 0.72rem, uppercase, letter-spacing 0.12em, weight 600

Hierarchy is built from **weight and colour before size**. Jumping two sizes to
signal importance flattens everything around it.

Paragraphs longer than two lines are never centred — centred text is reserved for
the student-code screen and the two gate screens.

**Banned:** Inter, any bare system-UI stack as a primary face, any serif, a third
family, body text below 16px, all-caps runs longer than two words.

---

## 4. Component Stylings

**Buttons** — minimum 48px tall, fully rounded pill, Outfit weight 600 at 1rem.
Primary is a solid Signal Cyan fill with Deep Ink text. Secondary is transparent
with an Edge Line border and Bright Ice text. Destructive is transparent with an
Alert Rose Edge border and Alert Rose text — **outlined, never filled**, so it
reads as available rather than as the obvious thing to press. Pressing any button
scales it to 97%. Disabled drops to 50% opacity with no movement. No glow, no
gradient, no shadow.

**One primary button per screen.** If two actions look equally important, neither
is.

**Cards** — Panel Navy fill, 1px Hairline border, 18px corner radius, 20px inner
padding, scaling to 99% on press. A card is used **only when it groups things
that are tapped together**. A paragraph never gets a card. **Cards are never
nested inside cards** — this is the most common tell of generated UI. Inner
elements step down to a 10px radius or go square; matching concentric radii make
an interface look soft and cheap.

**Inputs** — label sits above the field in Muted Periwinkle, never a placeholder
standing in for a label. Field is Raised Navy with an Edge Line border, 10px
radius, minimum 48px tall, 16px text. Focus draws a 2px Signal Cyan ring offset
by 3px. Error text appears below the field in Alert Rose — never as a tooltip,
never inside the placeholder.

**Progress bars** — 4px tall, fully rounded, Edge Line track with a Signal Cyan
fill. Progress appears on the course card, the course header and each lesson
group, and looks identical in all three.

**Loading states** — **skeletal placeholders, never circular spinners.** A
skeleton mirrors the exact shape of the content arriving: same heights, same
radii, same number of rows, with a single soft horizontal shimmer sweep of Raised
Navy over Panel Navy that stops the moment content lands. A spinner says
"something is happening"; a skeleton says "here is what you are about to get" —
and on patchy mobile data that difference is the entire perceived-speed story.

**Empty states** — never a bare sentence. A composed block: short heading, one
plain sentence, and the action that resolves it where one exists.

**Status pills** — small rounded capsules at 0.78rem in Outfit, used in the admin
area to show state. Outlined, never filled.

**Video player** — 16:9, Raised Navy behind it, full-bleed to the screen edges on
a phone. Native controls with download, playback-rate and picture-in-picture
disabled. Never render a poster frame or thumbnail extracted from the video.

---

## 5. Layout Principles

Single column, always. There is no tablet layout and no desktop layout — content
is constrained to a maximum width of 780px and simply centres on a wider screen.

Every element occupies its own clean spatial zone. Nothing overlaps anything else,
and nothing is absolutely positioned on top of other content.

Screen padding is 20px horizontally. Vertical rhythm uses a 4px base scale:
24px between major blocks, 12px between related rows, 8px between a label and its
value.

Full-height sections use dynamic viewport height, never fixed viewport height,
which jumps when mobile browser chrome hides.

**Horizontal scrolling anywhere on a screen is a critical failure.** Wide content
— a long title, a table — wraps or scrolls inside its own container.

Three elevation levels exist and no more: flat content directly on the ground;
bordered surfaces for anything groupable; and one sticky translucent top bar with
a hairline beneath it. Nothing floats.

Safe-area insets are respected at the top and bottom, since the app runs
full-bleed behind the Android status bar.

**Touch targets are minimum 48×48px, without exception.**

---

## 6. Motion & Interaction

Motion has a strict budget, because this runs inside an Android WebView on
inexpensive handsets and the user is trying to concentrate.

**Durations:** 120ms for a state change on press, 180ms for an element moving or
scaling, 320ms for a view entering, 420ms for the splash fade — the only thing
permitted to be that slow.

**Easing:** a soft decelerating curve for entrances and releases; a symmetrical
ease-in-out for elements that move and settle. Never linear.

**Only opacity and transform are animated.** Width, height, position, margin and
filter are never animated — they force layout on hardware with no headroom.

**Press feedback on everything tappable** — a 97% scale at 120ms. This single
detail accounts for most of what makes a web-based app feel native.

**Staggered entrances are capped** at five items, 30ms apart, 150ms total. A
ten-item cascade is a ten-item delay.

**No perpetual or infinite animation.** The one exception is the loading skeleton
shimmer, which stops as soon as content arrives. Looping animation on a study
screen competes with the material being studied and drains a battery the student
depends on.

**No scroll-linked animation** — no parallax, no pinned sections, no
reveal-on-scroll. Content that fades in as you scroll is content you cannot read
while scrolling.

Reduced-motion preferences remove all movement, keeping only opacity changes.

---

## 7. Screen Prompts

Generate these screens. Each has exactly one job.

**Splash** — Full-bleed Midnight Ground. Centred BNC logo with a small
uppercase wordmark beneath it in Dim Slate, letter-spaced. Nothing else. Brief
and calm.

**Sign In** — Centred single column, maximum 420px wide, vertically centred.
Logo, a short heading, one sentence in Muted Periwinkle. A white Google sign-in
button with the Google mark. A horizontal divider reading "or". Email and
password fields with labels above. One solid cyan primary button. Two small
underlined secondary links beneath. The whole form must clear the keyboard on a
5.5-inch screen.

**Home — most important screen** — Greeting line at the top with the student's
first name. Below it a single prominent **Continue watching** card: the lesson
title in Outfit, the course name beneath in Dim Slate, a cyan progress bar, the
time remaining, and one tap to resume. This card is the cyan moment of the
screen. Beneath it a section heading "Your classes", then a vertical stack of
course cards, each showing a small uppercase cyan grade eyebrow, the course title,
a progress bar, and "8 of 24 watched" in metadata. No grid — a single column of
full-width cards.

**Home — empty state** — Shown when a student has no enrolments. A centred
composed block on Panel Navy: a heading, one plain sentence explaining the
account is ready, and then **the student code presented at the largest type size
anywhere in the app** — tabular figures, generous letter-spacing, inside a dashed
Signal Cyan border — with a copy control. A short line beneath explaining it can
be read out over the phone. This screen exists to make a code legible over a
noisy phone line.

**Course** — Back link at the top. Course title, then a metadata line reading
grade, total videos and watched count. A full-width cyan progress bar. Below,
lessons grouped under headings, each group showing its own name and a completion
count like "4 of 7". Inside each group, numbered lesson rows: index, title,
duration on the right, and a cyan tick when complete. Rows are minimum 48px and
the whole row is tappable.

**Lesson** — Back link. The video player immediately below it, full-bleed 16:9
with native controls. Then the lesson title, then a metadata line with grade,
course and duration. At the bottom, **previous and next lesson controls** showing
the next lesson's actual title, so the student never has to return to the course
page between videos.

**Profile** — Heading and one line of explanation. A list of read-only rows:
student code in Signal Cyan, email, and joined date. Then editable fields for
full name and phone with labels above and helper text below. A primary Save
button and an outlined Sign out button.

**Device Blocked** — Centred, calm, not accusatory. Logo, a heading, one plain
paragraph explaining the account is in use on its allowed number of devices and
who can fix it, the student code in its bordered treatment, and a single outlined
button.

**Admin — Students** — Denser than the student screens; a tool, not an
experience. Search field at the top, a count line, then a vertical list of
collapsible student rows showing name, student code, phone and email, with an
enrolment count on the right. Expanding a row reveals course checkboxes — any
hidden course is labelled inline in Caution Amber — plus a device count and an
outlined destructive reset control.

**Admin — Courses** — Grade select and title field with an add button. Below, a
list of collapsible course rows showing grade, title, video count and group
count. Expanding reveals lesson groups, lesson rows with visible/hidden and
delete pills, an upload control with a progress bar, an add-video field, an
outlined hide/show button, and finally an outlined destructive delete button
placed last and visually separated.

---

## 8. Anti-Patterns — Banned

**Colour and surface**
- Pure black `#000000`
- Any second accent colour
- Gradient text, glowing or neon shadows, coloured outer glows
- Drop shadows on cards
- Nested cards
- Matching concentric corner radii
- Warm greys mixed into the cool neutrals

**Typography**
- Inter, or a bare system-UI stack, as a primary typeface
- Any serif face
- A third font family
- Body text below 16px
- Centred paragraphs longer than two lines

**Layout**
- Three equal cards in a horizontal row
- Any horizontal page scroll
- Fixed viewport height units
- Overlapping elements or absolutely positioned stacked content
- A hero section — this app has no marketing surface

**Motion**
- Infinite or perpetual loops, other than the loading skeleton shimmer
- Scroll-linked animation, parallax, pinning, reveal-on-scroll
- Animating anything other than opacity and transform
- Circular spinners anywhere a skeleton would fit

**Content**
- Emoji anywhere in the interface
- Raw database or API error messages shown to a student
- Placeholder or invented data — no "John Doe", no "Acme", no fake percentages
- Marketing voice: "Elevate", "Seamless", "Unleash", "Next-Gen"
- Filler interface text: "Scroll to explore", "Swipe down", bouncing chevrons,
  scroll arrows
- Custom mouse cursors
- **Any price, payment link, or buy button.** Commerce inside the app puts it
  under Google Play billing. This is a business rule, not a style preference
