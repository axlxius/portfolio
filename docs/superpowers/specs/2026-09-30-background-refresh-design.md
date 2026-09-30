# Background refresh: tidied strands and corner dots

Date: 2026-09-30
Status: awaiting approval
Prototype: branch `explore/backgrounds` (commits `a6ea4ca`..`f39b895`), preview
at `/?bg=tidy`

## Goal

Keep the scroll-driven strand scene that defines the home page, but make it
read as calm and deliberate at every section and on every screen size, and add
one small ambient detail.

What was decided while previewing, in the owner's words:

- "Dots as a style are a no go", but stationary pulsing dots in the top-right
  corner, with the strands preserved, are "lovely. this is our direction."
- Some sections "look a bit TOO messy, e.g. the work portion".
- The Work section's shape "looks incohesive", and hovering a project made the
  pattern change in a way that "looks awkward".
- The site must fit phones, tablets and desktops.

Success means: at rest, every section shows a clean, fully formed shape; the
Intro and Contact forms look as they do today; hovering a project visibly
answers that project; no horizontal scroll and no shape spilling across text
at 390, 768, 844-landscape, 1280 and 1920 px wide.

## Out of scope

- Dot rain, "mix per section", and the nervous-system variant. They were
  previewed and rejected; none of their code ships.
- The preview switcher (`?bg=`). Prototype-only.
- The project write-up pages under `/work/`. They have no scene and keep their
  own header (`case.css`).
- An automated device-screenshot check (needs Playwright as a dev dependency).
  Offered separately; not part of this change.

## Design

### 1. One scene, not variants

The prototype added a `variant` option (`strands` / `tidy` / `nerve`) to
`Scene`. The shipped version has no variants: the tidied behaviour becomes the
scene. The five builders live in `src/scene/shapes.js` as they do today.

| # | Section | Form | Change from today |
|---|---|---|---|
| 0 | Intro | (2,3) torus knot | none |
| 1 | Work | one hoop per project, stacked top to bottom in list order | replaces the receding plane |
| 2 | Experience | braided column: every strand the same helix, evenly phased, alternate strands twisting opposite ways, slight waist | replaces the random-radius helix |
| 3 | Stack | seven small wireframe spheres (latitude rings), each tilted differently, on the existing seven cluster centres | replaces random-walk clusters |
| 4 | Contact | convergence onto one axis | none |

**Work hoops.** Radius 1.4, tube 0.11, vertical gap 0.64. Each hoop is a bundle
of parallel arcs. Every strand is laid at exactly the angles it has in the
Experience braid (`braidAngle(s, strands, u)`), so Work → Experience is a
vertical stretch instead of points crossing the shape. Overlapping arcs close
each hoop.

**Hoop membership comes from the page.** `main.js` reads the `data-strand`
values of the project rows in document order and passes them to `Scene` as
`projectBands`. A strand belongs to the hoop whose band value is nearest its
seed (circular distance, matching the shader). The number of hoops therefore
follows the number of projects, and adding a project stays what the README
already says: add a row with a `data-strand` value. The README note about
re-spacing values when rows change still applies, and is now the only thing to
do.

### 2. Settling at rest

The per-strand stagger that makes the morph flow also meant no section was
ever fully formed; some strands always sat between two shapes. This is the
main source of the "messy" look.

The shader scales the stagger by `mix(1, sin(π · fract(progress)), uSettle)`:
full stagger mid-transition, zero when a section is centred. Four per-state
tracks, sampled with the existing `sampleTrack`, drive it:

| Track | Intro | Work | Experience | Stack | Contact |
|---|---|---|---|---|---|
| `SETTLE` | 0 | 1 | 1 | 1 | 1 |
| `STAGGER` | 0.55 | 0.32 | 0.32 | 0.32 | 0.32 |
| `NOISE` (drift) | 0.12 | 0.03 | 0.04 | 0.03 | 0.12 |
| `CAMERA_Y` | 0.0 | 0.45 | 0.0 | 0.1 | 0.0 |

Intro keeps today's exact values (settle 0, stagger 0.55, drift 0.12), which
is what keeps the knot looking as it does now. `CAMERA_Z` is unchanged.
`uStagger`, `uNoise` and the new `uSettle` are written every frame from these
tracks instead of being constants.

### 3. Hover

- Hovering or focusing a project row lights exactly that project's hoop.
- The glow edge becomes a near-hard band, `1 - smoothstep(inner, outer, d)` in
  seed space, replacing the soft `0 → 0.13` falloff that bled across several
  projects. `outer` is half the smallest circular gap between adjacent
  `projectBands` values and `inner = 0.82 · outer`, computed once in `Scene`.
  With today's six values that gives about 0.07 / 0.085, which is what the
  prototype used, and it stays correct if projects are added or removed.
- Lit dots grow by 0.45× instead of 1.6×, so a lit hoop reads as brighter, not
  heavier.
- Outside Work the hover has no visible target, as today, because only the
  project rows carry `data-strand`.

### 4. Corner dots

A new `src/scene/CornerDots.js`, driven like the scene (`setInk`, `setFocus`,
`update`, `dispose`; `setProgress` is a no-op).

- A 2D canvas fixed to the top-right corner, `min(440px, 70vw)` square, under
  the page content and under the header fade.
- An 18 px dot grid masked by a quarter-circle falloff from the corner, so the
  patch has no edge.
- Dots never move. Brightness and size pulse in a ripple from the corner,
  roughly every four seconds.
- Hovering a project lifts the patch slightly (+0.15 alpha).
- Ink follows the theme, like the scene.
- Reduced motion: time is frozen, so the patch is static.
- Independent of WebGL: if the 3D scene fails, the dots still render; if 2D
  canvas is unavailable, the dots are skipped and nothing else changes.

### 5. Fitting every screen

- **Width-fit camera.** A per-state `FIT_WIDTH` track (`[0, 1.65, 1.25, 0, 0]`)
  sets a half-width that must stay in frame. On narrow screens the camera
  backs off until it fits: `z = max(z, fit·1.08 / (tan(fov/2)·aspect) + fit·0.5)`.
  Intro, Stack and Contact are allowed to run off the edges as texture.
- **No extra fading from the pull-back.** The extra camera distance is passed
  to the shader as `uDepthShift` and subtracted before the depth fade, so
  hoops on a phone are as visible as on desktop.
- **Dot size follows viewport height.** `uSize = 3.2 · clamp(height / 900,
  0.6, 1.1)`, set in `resize()`, so landscape phones don't get chunky dots.
- **Header fade.** A full-bleed `.chrome::before` gradient (solid paper to 55%,
  clear at 100%, height `2 × top offset + 2.6rem`) so content scrolling under
  the fixed header dissolves instead of colliding with the wordmark. Home page
  only (`layout.css`).

### 6. Removed with the prototype

`src/dev/bgSwitcher.js`, `src/scene/DotRain.js`, `src/scene/nerveShapes.js`,
the `terrain` builder, the `variant` option, `setFade`, the pulse code
(`uPulse`, `aU`, `buildStrandU`) and the `?bg=` handling in `main.js`. Nothing
reaches the bundle that the page does not run. The main chunk should drop back
under Vite's 500 kB warning (it was 498 kB before the prototype); if it does
not, say so rather than raising the limit.

### 7. README

Update "How the 3D works" (the forms table, settling, the per-state tracks in
the Tuning table), "Adding a project" (a row adds a hoop) and "Design notes"
(corner dots, header fade). Update the hover sentence and the `data-strand`
known gap to match.

## Error handling and fallbacks

Unchanged in principle: WebGL failure removes the 3D canvas and the page reads
normally; JavaScript disabled shows the markup; reduced motion disables smooth
scroll and drift and freezes the corner dots; pointer effects stay behind
`(pointer: fine)`; rendering parks while the tab is hidden.

Known limit, accepted: strand count (desktop 220, mobile 110) is chosen at
load, so rotating a tablet across the 720 px breakpoint keeps the first count
until refresh. It does not affect layout.

## Testing

No unit-test harness exists for the scene; verification is visual plus a
build, the same way the prototype was checked.

1. `npm run build` succeeds; report the main chunk size.
2. With the dev server, at 390×844, 844×390, 768×1024, 1280×720 and
   1920×1080: screenshot each of the five sections at rest and one mid-scroll
   between Work and Experience. Check for no horizontal overflow
   (`scrollWidth - clientWidth === 0`) and no console errors.
3. At 1440×900, hover each of the six project rows: exactly one hoop lights,
   in list order.
4. Light and dark themes: corner dots and strands invert together.
5. Reduced motion (emulated): page renders, the scene tracks scroll, the corner
   dots are static.
6. WebGL disabled (canvas creation forced to fail): page reads, corner dots
   still show, no errors beyond the existing warning.
7. The owner opens the deployed site on a real phone (touch, address-bar
   resize and GPU are not covered by emulation).

## Rollout

Build it on a fresh branch from `main`, porting the settled prototype code and
leaving the rejected experiments behind. `explore/backgrounds` stays as a
reference until this merges, then can be deleted. Merging to `main` and
pushing deploys to production through Vercel, so that step waits for the
owner's go-ahead after they have seen the finished branch.
