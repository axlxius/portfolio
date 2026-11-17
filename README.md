# Portfolio

A portfolio built like a short film. Scrolling moves a playhead through five
scenes, each choreographed to the scroll and joined to the next by a match cut,
with one particle cloud as the thread that runs through all of them.

**Live:** <https://alexius-lee.vercel.app> · **Repo:** <https://github.com/axlxius/portfolio>

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check, then static output in dist/
npm run preview    # serve the build locally
npm test           # unit tests for the scene maths and the content file
```

Built with Vite, TypeScript, Three.js, GSAP and Lenis. There is no framework:
the content is static and the motion is imperative, so React would add a
hydration step and nothing else.

## Deploying

The Vercel project `alexius-lee` is connected to this GitHub repo, so pushing
to `main` builds and publishes automatically. `vercel.json` sets the build
command and long-lived cache headers for the hashed assets and the fonts. To
publish without a commit, `vercel --prod --yes` deploys the working tree.

Share the production alias, `alexius-lee.vercel.app`. The per-deployment URLs
that Vercel prints sit behind Vercel's login wall and will not open for anyone
else.

`vite.config.ts` sets `base: './'`, so the build also works from a subpath such
as GitHub Pages.

`resume/` is gitignored. It holds a personal document with a phone number in
it, which does not belong in a public repo. `public/resume.pdf` is the web copy
with the phone number removed.

## Editing your content

Everything a visitor reads on the home page lives in **`src/data/content.ts`**.
The page markup is generated from it at build time (`src/markup/page.ts`, wired
in by `vite.config.ts`), so the HTML that ships already contains the text.
Editing the file restarts the dev server and the page comes back with the new
copy.

| What | Export |
| --- | --- |
| Email, GitHub, LinkedIn, resume | `LINKS` |
| Page title, link-preview image | `META` |
| Name, title-card line, tags | `INTRO` (`short` is the line on the title card) |
| Projects | `PROJECTS` |
| Roles | `ROLES` |
| Skill groups | `SKILLS` |
| Education, certifications | `EDUCATION`, `CERTIFICATIONS` |
| Contact copy and links | `CONTACT` |
| Small scene headings (Experience, Toolkit, Credits) | `LABELS` |

A link that does not exist yet is written as `TODO` (which is `null`). Nothing
is rendered for it, so a missing live URL never shows as a dead button. Search
the file for `TODO` to see what is still open.

Role and project copy mirrors the resume. Keep the two in step.

The page is deliberately brief: each project is a title and one line, each
role a title and its dates. Fuller copy stays in the content file for the
project overlay and the meta description, and `ROLES[].body` is kept for the
resume but not shown.

`PROJECTS[].tech` and `.context` come from each project's write-up and appear
in the project overlay. `pay2live` has no write-up, so it claims neither.

### Adding a project

1. Add an entry to `PROJECTS`. Give it a `visual` (see below).
2. Set `BANDS` in `src/scene/shapes.ts` to the new project count. Each project
   owns one band of the vase, top to bottom in list order. `npm test` fails
   with a message telling you to do this if you forget.
3. If it needs a new visual, add one in `src/visuals/index.ts` (the drawing in
   the overlay) and a takeover shape in `src/scene/projects.ts` (what the
   cloud draws while the project's title card is up), then add the id to
   `VisualId` in the content file.

The work reel gives every project one beat of scroll, so a seventh project
simply makes the scene a beat longer.

### Project write-ups

Four projects have a long-form page under `work/`. These are still hand-written
HTML, built with `src/case.ts` and `src/styles/case.css`. To add one, copy an
existing `work/<slug>/index.html`, add the slug to `pages` in `vite.config.ts`
and to `public/sitemap.xml`, and set the project's `writeUp` in the content
file. The overlay then shows a "Read the write-up" button, and with JavaScript
off the project's title links straight to the page.

## The scenes

The page reads as a film: a HUD shows the scene and a running timecode, and a
scrubber along the bottom carries a playhead and one mark per scene (the marks
are the section links). Scenes one to three are pinned and their choreography
is scrubbed by the scroll, so scrolling back plays everything in reverse.

| Scene | File | What happens |
| --- | --- | --- |
| 01 Title | `src/scenes/title.ts` | The name pulls apart across the screen, condensing and thickening as it goes. Everything but the "i" drops away, and the dot of the "i" grows into a circle that fills the screen. |
| 02 Work | `src/scenes/reel.ts` | In negative. One title card per project: its letters rise in, its line follows, it holds, and it lifts away. The cloud draws each project's figure while its card is up. |
| 03 Experience | `src/scenes/timeline.ts` | A hairline draws across the screen and thickens until it fills it: back to positive. It becomes a timeline; a playhead runs along it, lighting each keyframe and bringing up that role. |
| 04 Toolkit | `src/scenes/kit.ts` | Each skill group is one line of outlined type; alternate lines slide in opposite directions with the scroll. |
| 05 Contact | page markup + `src/ui/reveal.ts` | Credits (education, certifications) roll up like end credits, then "Get in touch". The cloud tangles into a tree and resolves into a single line at the very end. |

The two match cuts live in `src/scenes/wipes.ts`. A wipe is drawn beneath the
particles in the colour the page is about to become; once it covers the
screen the colour tokens flip underneath it (`data-invert` on `<html>`) and it
is hidden, so the swap is never seen. To start the circle exactly on the dot of
the "i", the dot is found by drawing the letter twice on a canvas, dotted and
dotless, and keeping the pixels that differ.

`src/main.ts` is the director: it builds the scenes inside a GSAP context,
maps the scroll onto the cloud's morph (each pinned scene holds its form for
the length of its pin, and the cloud reforms in the scroll between scenes),
and tears it all down again if motion is reduced.

Scene lengths are the `end` values of each scene's ScrollTrigger: `+=190%` for
the title, one 95% beat per project for the reel, `+=320%` for the timeline.

## How the 3D works

The scene is one persistent object, not six. `src/scene/shapes.ts` builds a
set of *strands* (up to 1,500, of 48 points each), then writes six complete
sets of target positions for those same points:

| Scroll position | Form |
| --- | --- |
| Intro | a loose gyroscope of orbital rings |
| Work | a vase of stacked rings, one band per project |
| Experience | a tall column of stacked ellipses, one segment per role |
| Stack | a flowing, twisting ribbon |
| Contact | a tangled filament tree |
| End of page | a single vertical line |

Every target set is uploaded once as a vertex attribute. The vertex shader in
`src/scene/shaders.ts` blends between them with tent weights, which sum to
exactly 1 between any two consecutive states. Each point runs a little ahead
of or behind the scroll, by an amount that varies smoothly along its strand, so
a morph pours through the object rather than cross-fading. That offset fades
out as a section is centred, so a section at rest shows its form fully built.

Hairlines only ever join points *within* a strand, so no line can streak across
the scene mid-morph however far its ends travel. The vase and the column put
each strand at the same angle around the axis, so Work to Experience is a
vertical stretch rather than points crossing the shape.

With motion, the director in `src/main.ts` maps the scroll onto that timeline
from the scenes' pins. With reduced motion, `src/scroll/progress.ts` anchors
one stop per state where each section sits under the middle of the viewport.

**Project figures.** While a project's title card is up in the work reel, the
whole cloud reforms into a figure for it (`src/scene/projects.ts`): a knot, a
bar chart, a stack of ruled sheets, a sprout, two crossing lines, a calendar.
The figures live in two spare attribute slots that cross-fade, so moving from
one project to the next never pops. The camera also pushes into the cloud
through the title's wipe (`Scene.setZoom`).

**Pointer.** The shader pushes points away from the pointer and swirls them
sideways, drags the ones near where the pointer just was, and sends an
expanding ring through the cloud on a click.

**Theme.** Points are drawn premultiplied with their alpha scaled back by a
uniform: at one end they add light (dark theme), at the other they lay down ink
(light theme). The theme switch moves that uniform, so it never changes blend
mode and never flashes.

**Quality.** `Scene.ts` picks a tier from the device (72,000, 33,000 or 11,000
points), then times a run of frames. If the device cannot hold about 45fps it
draws fewer strands. Every builder is written so that any prefix of the strand
list is a fair sample of the whole shape, which is what makes that possible
without rebuilding anything.

### Adding a morph shape

1. Write a builder in `src/scene/shapes.ts`. It receives the output array, the
   strand count, the points per strand and a seeded random function, and
   writes an xyz for every point. Assign strands to groups with `s % n` or a
   fractional sequence, never by contiguous ranges, so that drawing fewer
   strands still shows the whole shape.
2. Add it to `BUILDERS` in the position you want it.
3. Add one value for it to every array in `src/scene/tracks.ts` (camera
   distance, screen offset, drift and so on).
4. Add a matching `<section>` in `src/markup/page.ts` and an entry in
   `SECTIONS` in the content file.

`npm test` checks that the tracks, sections and states all agree. The shader's
attributes and blend are generated from the builder list, so there is nothing
to edit there.

### Tuning

| Knob | File |
| --- | --- |
| Point counts, dot size and opacity per tier | `TIERS` in `src/scene/Scene.ts` |
| Which devices get which tier | `chooseTier` in `src/scene/Scene.ts` |
| Camera distance and height per section | `CAMERA_Z` / `CAMERA_Y` in `src/scene/tracks.ts` |
| Where the object sits on screen per section | `OFFSET_X` / `OFFSET_Y` in `src/scene/tracks.ts` |
| Morph spread, drift, weight per section | `STAGGER` / `NOISE` / `WEIGHT` in `src/scene/tracks.ts` |
| Which forms turn and which face the camera | `SPIN` in `src/scene/tracks.ts` |
| Width kept in frame on narrow screens | `FIT_WIDTH` in `src/scene/tracks.ts` |
| Vase, column, ribbon and tree proportions | `VASE` / `COLUMN` / `RIBBON` / `TREE` in `src/scene/shapes.ts` |
| Pointer push, swirl, shockwave | the vertex shader in `src/scene/shaders.ts` |
| Length and choreography of each scene | the timeline in each file under `src/scenes/` |
| Running time shown in the timecode | `RUNTIME` in `src/scenes/hud.ts` |
| The accent colour | `--accent` in `src/styles/base.css` |

Three URL parameters help while tuning:

- `?tier=high` (or `mid`, `low`) forces a quality tier.
- `?p=2.5` pins the morph at a position (0 is Intro, 5 is the closing line).
- `?alt=dashboard` forces a takeover shape (`site`, `dashboard`, `copilot`,
  `growcery`, `housing`, `clinic`, `island`).

## Where things live

```
src/
  data/content.ts     all copy and links
  markup/page.ts      the page as string templates, run at build time
  scene/              renderer, morph targets, takeover shapes, shaders, tracks
  scenes/             the five scenes, the wipes between them, and the HUD
  sections/           the title card's pointer effect and the contact block
  ui/                 cursor, loader, overlay, reveals, theme, sound, toast
  visuals/            the six generative project visuals
  scroll/             smooth scroll and the scroll-to-morph mapping
  core/               motion preference, easing, small helpers
  styles/             tokens and base, layout, floating UI, write-up pages
tests/                unit tests (run by Node directly, no test framework)
video/                the showcase film pipeline and the link-preview image script
```

## Accessibility and fallbacks

- All content is real markup in the shipped HTML. With JavaScript off the
  scenes are ordinary stacked sections, the scrubber is a row of links and
  project titles link to their write-ups. Content is only hidden for a reveal when a script is there
  to show it again; if the main script never boots, a failsafe un-hides it.
- **Reduced motion** is respected from the OS setting and from the Motion
  switch in the HUD, which persists. In that mode nothing is pinned or
  scrubbed: the scenes become plain sections, and there is no intro, no wipe,
  no smooth scroll, no custom cursor, no drift or pointer physics. The switch
  takes effect without a reload, in either direction.
- Focus is visible everywhere. Tabbing to a project's title card scrolls the
  reel to its beat, so keyboard users see what they focus. The project overlay
  is a modal dialog: focus moves in, is trapped, and returns to the card; Esc,
  the browser's back button and a downward swipe all close it.
- Hidden title cards and roles are faded, never removed, so a screen reader
  reads every project and role in order.
- Text greys are 10:1 and 5.3:1 on the background in both themes. An automated
  axe-core pass reports no violations on the home page (both themes, with and
  without motion), with the overlay open, or on a write-up.
- If WebGL is missing, the scene module is never downloaded and the page reads
  normally; the scenes and wipes still play.
- The custom cursor and hover effects are bound only for a mouse. On touch, a
  tap on a title card opens its overlay.
- Rendering parks while the tab is hidden; device pixel ratio is capped at 2.

## Performance

Measured with Lighthouse on the production build, desktop profile:
Performance 97, Accessibility 100, Best Practices 100, SEO 100, with LCP at
0.8s and layout shift at 0.011.

That run was on a machine with no GPU, where the scene falls back to its
lowest tier. The text paints first either way: the scene is a separate chunk
loaded after first paint, and the fonts are self-hosted and preloaded.

## Taste notes

The decisions behind the build, in the order someone is likely to ask.

**Why a film.** The brief was a site that shows creative range rather than one
that explains it. Film grammar does that without words: scenes, a running
timecode, a playhead, match cuts. The scroll is the playhead, so the visitor
directs the pace, and scrubbing back plays everything in reverse, which is the
quickest proof that none of it is a canned animation.

**Why match cuts.** A cut that carries something across (the dot of the "i"
becoming the circle that opens the next scene, the timeline's hairline
thickening into the wipe back) makes two scenes feel like one continuous piece.
It is the signature move of title design, and it costs the visitor nothing.

**Why the name comes apart.** A name set in a variable font has two axes to
play with. Pulling the letters across the screen while they condense and
thicken shows the typeface doing something only a variable font can, and it
turns the most static thing on any portfolio into the first piece of motion.

**Why one card at a time.** A list asks the reader to compare; a reel asks
them to watch. Each project gets the whole screen for a beat, with one line of
copy, which is all a first look needs. The detail is one click away.

**Why black and white, and one accent.** With no colour to lean on, hierarchy
comes from scale, weight and timing. The single accent marks only what is
live: the playhead and the keyframes it has passed. Anything more would compete
with the motion.

**Why the cloud stays.** The particle object is the one thing on screen in
every scene. Each scene reshapes it (orbit, vase, project figures, column,
ribbon, tree, line), so it works like a recurring character: the page changes
around it, and it changes with the page.

**What was deliberately left out.** No scroll-jacking beyond the pins: the
wheel always moves the page at its natural speed. No sound on by default. No
chromatic aberration, because it is a colour effect in a site with almost no
colour.

## Known gaps

- **Write-ups are not in the content file.** The four pages under `work/` are
  still hand-written HTML.
- **Project links.** Only this site has a live URL and a repo. The others are
  `TODO` in the content file and show no button until filled in.
- **Tested in Chromium only.** The checks here (57 scripted browser checks,
  axe-core) all ran in Chromium. Safari and Firefox have not been
  run. The theme wipe and the overlay's title transition use the View
  Transitions API and fall back to a plain switch where it is missing.
- **Frame rate on real hardware is unmeasured.** The build machine has no GPU,
  so the 60fps target and the tier thresholds are reasoned, not benchmarked.
  If a device struggles, lower its tier in `chooseTier`.
- **Device tilt** works where the browser reports orientation without asking
  (Android). On iOS the scene does not tilt.
- **Pinned scenes on phones.** Pins and scrubs run on touch screens too and
  were checked at 390px wide, but only in an emulator. Real iOS Safari, with
  its collapsing address bar, has not been tried.
- **The showcase film** in `video/` was cut for an earlier version of the
  site and needs re-cutting. See `video/README.md`.
