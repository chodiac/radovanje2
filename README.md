# Sala Radovanje

Cinematic single-page site for **Sala Radovanje** — a wedding and event
venue in Cerovac, Kragujevac. All public copy is in Serbian and comes
from the existing site at vilaradovanje.rs; the art direction and
interaction language are adapted from era-residence.com.

Static HTML/CSS/JS. No build step. GSAP 3.13 (ScrollTrigger,
CustomEase) and Lenis 1.3.21 load from CDN.

## Run

```bash
python tools_serve.py 5183
```

Open <http://127.0.0.1:5183>. Any free port works; 5183 just avoids
colliding with the editor's own preview server.

### A note on preview servers

Start the server yourself, as above. Don't rely on one started by the
editor's preview command:
that process is loopback-isolated to the editor's sandbox. It shows up
in the host process list and its listener appears in the host TCP
table, but every connection from outside — Chrome, PowerShell, curl,
even a raw TCP connect — is refused. Only the in-app preview pane can
reach it.

### Dev flags

`?motion=full` / `?motion=reduce` override the OS motion preference
(also read from `localStorage['sr-motion']`). The override exists
because some machines — and some in-app preview browsers — report
`prefers-reduced-motion: reduce` permanently, which otherwise replaces
every pinned scene with its flat fallback.

`window.SR` is a small handle for debugging: `SR.jumpTo(y)`,
`SR.settle()`, `SR.refresh()`, `SR.scrollTo(el)`, `SR.motion`.

## Adding the photographs

Every image is a named placeholder — 30 of them, listed in
`js/images.js` under `SLUGS`. Nothing else needs editing:

1. Drop files into `images/`, named after the slug
   (`hero-image.webp`, `gallery-01.webp`, …). Optional `@2x`
   variants are folded into a `srcset` automatically.
2. Run `python tools/build-manifest.py`.

That writes `images/manifest.json`; the page reads it on next load and
fills each placeholder. Until then the grey placeholder shows the slug
and its intended dimensions.

`sky-object` expects a **transparent** PNG/WebP — it is composed over
the sky, contained rather than cropped, with the display type running
behind it.

For hand-tuned paths or art direction, add entries to
`SR_IMAGES.MAP` in `js/images.js` (`{ src, srcset, sizes, position }`);
`MAP` always wins over the manifest. `SR_IMAGES.PROBE = true` skips the
build step entirely at the cost of one failed request per miss.

## Files

```
index.html              14 scenes, chapter-numbered 01–14
css/main.css            tokens → reset → type → placeholders → nav
                        → scenes → responsive → flat build
js/main.js              scroll engine
js/images.js            image registry + docs
tools/build-manifest.py scans images/ → images/manifest.json
tools_serve.py          static dev server
```

## How the scroll engine is put together

One Lenis instance, driven by `gsap.ticker` so scrolling and animation
share a single frame; one ScrollTrigger system.

**Pinned scenes** — statistics (470 → 15+ → 19), the events
horizontal, the sala panorama pan, the details horizontal. Each gets a
descending `refreshPriority` from `pinPriority()`, because a pin pushes
everything below it down the page and must be measured before any
trigger whose position depends on it. `initNav()` therefore runs last.

**Horizontal sections** translate a track by `-(scrollWidth - innerWidth)`
against scroll. Reveals and per-panel parallax inside them use
`containerAnimation`, so they track horizontal position rather than
page position.

**One owner per element.** CSS reveals only ever touch
`[data-split-lines]`; blocks marked `[data-gsap-lines]` belong to the
engine. Animating `transform` on the same node from both CSS and GSAP
was the source of a real bug — don't reintroduce it.

**Percentage transforms** are cached as pixels by GSAP, and the display
webfont lands after the first measurement and changes the line height.
Anything using `xPercent`/`yPercent` on type carries
`invalidateOnRefresh: true`, and `document.fonts.ready` triggers a
`ScrollTrigger.refresh(true)`.

**Theme switching** — each scene declares `data-theme` (what the nav
needs over the *top* of that scene) and optionally `data-theme-foot`
(what the corner counter needs over the *bottom*). The sky scene uses
both: white over the saturated top, ink over the pale horizon.

## Wide screens

Above roughly 1800px the old caps froze every scale while the viewport
kept growing, so on a 2560px monitor the compositions huddled into the
left third — "470" took 28% of the width instead of filling half.
The upper bounds of the fluid scale are now set so the `vw` term still
governs up to ~2500px. Nothing below ~1600px changed: the viewport
term rules there either way.

Horizontal panel widths are capped by the same reasoning but in the
other axis — each panel's aspect ratio has to keep it clear of the
section label above and the progress bar below, with a `max-height:
68svh` safety net for short windows.

## Performance

Measured in Chrome at 2560×1295, driving 240 scroll positions across
the whole page and rendering every scrub animation at each one:

| | |
|---|---|
| Scroll update, mean | 1.0 ms (~6% of a 60fps frame) |
| p95 | 2.1 ms |
| Worst single update | 19 ms — a pin engaging, one-off |
| ScrollTriggers | 94, four of them pinning |
| DOM | 639 elements |

No blur filters, no animated box-shadows, everything on transform,
opacity and clip-path. `will-change` is applied to 38 elements, and
only while they have something pending: the 30 placeholder media
layers are left unpromoted (GSAP's `force3D` promotes whichever one is
being scrubbed), and heading lines release the hint once revealed.

This covers the main-thread cost, not GPU raster — that will change
once real 2400px photographs replace the placeholders, so it is worth
re-checking then.

## Three builds, all verified

| | Desktop / tablet | Phone (≤720) | Reduced motion or no JS |
|---|---|---|---|
| Pins | 4 | none | none |
| Horizontal | scroll-driven | native swipe + snap | stacked column |
| Statistics | pinned crossfade | three stacked scenes | three stacked scenes |
| Sala | scroll-driven pan | swipeable panorama | static panorama |

The flat build is `:where(.rm, html:not(.js))` — reduced motion and
"scripting never ran" need the same layout, and `:where()` keeps it at
zero specificity so the mobile block can still override it. The `.js`
class is set by an inline head script rather than hardcoded on
`<html>`, so nothing is hidden when scripting is unavailable.

Checked at 2560×1295, 1345×1316, 768×1024 and 375×812: no horizontal
overflow, no clipped display type, no overlapping content, no
unreachable sections, and a clean console.

## Content

Preserved from the existing site: capacity 470, 15+ years, 19 rooms
(~50 beds), the four accommodation options, all five event types, the
"Elegancija koja nadahnjuje" and "Ambijent koji pretvara svaku
proslavu…" lines, the address, all three phone numbers and the e-mail.
Short connecting copy was rewritten to suit the editorial layout; no
services were invented.

## Legibility of type over photography

The venue photographs are bright — a white render under a sunlit sky,
lit interiors, white linen — which is the hardest case for white
display type. Three things carry it:

1. **Display weight 600.** Bodoni is a Didone; at 400 its hairlines
   disappeared at display sizes both over a photograph and on the
   ivory ground. 600 keeps the high-contrast character with enough
   body to survive. Set once, as `--display-weight`.
2. **Two-axis scrims.** A single bottom-up gradient left headlines
   sitting on near-white. Each scrim now pairs a gradient for the
   band the type occupies with one biased toward the edge it is set
   against, so the photograph stays open on the opposite side.
   `.scene--right` mirrors it; `.scrim--base` darkens only a caption
   band, for the detail close-ups that need to stay visible.
3. **`--media-shadow`**, declared on each photographic scene so it
   inherits to the headline, labels and copy inside it.

The nav gets its own top gradient, but only while it is white —
over a light section that would darken the ground behind ink text.

## Brand assets

`images/logo.svg` is the full lockup — gold plate, deep green clover,
brown wordmark. Those are mid-tone brand colours, and over
photography the brown and green disappear while only the gold plate
survives, so there are two variants:

- `logo.svg` — brand colours, used wherever the ground is ivory.
- `logo-mono.svg` — generated from it: the plate becomes white and
  the lettering inside it flips to ink, so "ВИЛА" stays readable
  instead of merging into the band; everything else goes white. Used
  on photography and on the ink sections.

The nav holds both and cross-fades them with its own light/dark
switch, so the mark is always legible. The mobile menu and the footer
sit on ink and use the monochrome version. The original `logo.svg` is
untouched — re-run the substitution in this README's history if the
brand file is ever replaced.

`images/loading.png` is the brand plate as raster artwork, and it is
what the preloader shows. Its ground was sampled (`#F8F4F0`) and the
loading screen is painted that exact colour, so the image sits on it
without a visible edge. No blend mode: `multiply` was tried first and
darkened the plate into a visible rectangle.

## The 07 → 08 handover

Section 07's sky is a flat gradient; section 08 opens on a photograph
that has real sky in it. The two are joined rather than butted
together:

- The gradient runs straight down (180deg, not tilted) so its final
  stop meets the next section edge-to-edge — measured at a 1px seam.
- `.hall__dissolve` carries section 07's closing tone (`#CFE3EE`) into
  the top of the hall frame and clears over about a third of it, so
  the photographed sky emerges out of the flat one. `.scrim--even`
  fades to nothing at its own top edge so it does not muddy that.
  The canvas is fixed while the section is pinned, so the dissolve is
  itself scrubbed away once the handover is done — otherwise the pale
  band would sit at the top of the screen for the whole scene.
- The hall holds **two frames that pan together**: `hall-intro` (the
  exterior, the same photograph as the hero, which is what makes the
  sky continue) over `hall-main` (the interior). The exterior holds
  for the first fifth, cross-fades across the middle, and is gone by
  about two thirds through, leaving the rest of the pan inside the
  hall.
- The frame's width is computed from whichever of the two photographs
  can carry the least magnification, so neither is stretched further
  than the other.

In the flat build the exterior layer and the dissolve are hidden and
only the interior is shown.

## Images

The photographs arrived as PNG: 19 files, **39.4MB**, about 2MB each.
That was the real reason the scroll-driven sections were still
showing placeholders when they arrived. `python tools/to-webp.py`
converts them to WebP at quality 82 — **2.5MB total, 94% smaller** —
and leaves every original `.png` in place. `js/images.js` points at
the `.webp` files.

Lazy loading alone could not serve these sections: a horizontal
track's panels genuinely sit off-screen until their transform brings
them in, and the pinned panorama is wider than the viewport, so the
browser deferred them. `initLoadAhead()` promotes each section's
images to eager one full viewport before it is reached — ahead of
need, without fetching all thirty at once.

`tools/to-webp.py` also caps the long edge at 2400px — nothing on the
page is displayed wider than about 1600px, so anything beyond that is
payload nobody sees. That took `dekoracija3.jpg` from 2.1MB at
3200×4800 to 0.43MB at 1600×2400.

Two things worth knowing about the current set:

- The sources are around 1500px on the long edge. Full-bleed sections
  on a 2560px screen therefore magnify them; the hall panorama sizes
  its own canvas from the image's natural dimensions rather than a
  fixed 196vw, which keeps the magnification near 1.8x instead of
  3.4x, but larger exports would be sharper.
- `sky-object` is designed for a **cut-out PNG on transparency**.
  Given an ordinary rectangular photograph it read as a stray
  rectangle over the type, so it is masked into an arch
  (`.ph--arch`). Remove that class once a true cut-out exists.

## Typography, verified in Chrome

All three families load, and the Serbian diacritics (č ć š ž đ / Č Ć Š
Ž Đ) render correctly in Bodoni Moda — including Đ, whose crossbar is
a hairline at display sizes but is present.

Archivo's width axis genuinely applies: the micro-labels at
`font-stretch: 125%` measure ~23% wider than at 100%. That extended
grotesque is the signature of the whole label system, so it is worth
re-checking if the font loading ever changes.

One trap: the subset loaded for **Pinyon Script covers ć and š but not
đ/Đ**. No script accent currently needs it ("trenutke", "koja
nadahnjuje", "i prenoćište", "Naš prostor." …), but a future script
line containing đ would silently fall back to a serif. Keep đ out of
the Pinyon lines, or add the glyph to the request.

## Known limitation

No photographs yet — every scene is in its placeholder state. The
compositions are built around real images (scrims, parallax wrappers
and aspect ratios are already in place), so they will read very
differently once the photography is dropped in.
