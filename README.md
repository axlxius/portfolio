# Portfolio

A black-and-white portfolio built around one particle cloud that reforms into a
different shape for every section.

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
| Name, intro paragraph, tags | `INTRO` |
| Projects | `PROJECTS` |
| Roles | `ROLES` |
| Skill groups | `SKILLS` |
| Education, certifications | `EDUCATION`, `CERTIFICATIONS` |
| Contact copy and links | `CONTACT` |
| The words in the big moving line | `MARQUEE` |

A link that does not exist yet is written as `TODO` (which is `null`). Nothing
is rendered for it, so a missing live URL never shows as a dead button. Search
the file for `TODO` to see what is still open.

Role and project copy mirrors the resume. Keep the two in step.

Two things in the content file are judgement calls worth checking:

- **`ROLES[].skills`** is the small tag line that appears when a role is
  hovered. It is drawn only from the Stack lists (a test enforces that), but
  which skills belong to which role is my reading of the role descriptions.
- **`PROJECTS[].tech` and `.context`** come from each project's write-up.
  `pay2live` has no write-up, so it claims neither.

### Adding a project

1. Add an entry to `PROJECTS`. Give it a `visual` (see below).
2. Set `BANDS` in `src/scene/shapes.ts` to the new project count. Each project
   owns one band of the vase, top to bottom in list order. `npm test` fails
   with a message telling you to do this if you forget.
3. If it needs a new visual, add one in `src/visuals/index.ts` (the drawing in
   the preview card and the overlay) and a takeover shape in
   `src/scene/projects.ts` (what the cloud becomes on hover), then add the id
   to `VisualId` in the content file.

### Project write-ups

Four projects have a long-form page under `work/`. These are still hand-written
HTML, built with `src/case.ts` and `src/styles/case.css`. To add one, copy an
existing `work/<slug>/index.html`, add the slug to `pages` in `vite.config.ts`
and to `public/sitemap.xml`, and set the project's `writeUp` in the content
file. The overlay then shows a "Read the write-up" button, and with JavaScript
off the project's row links straight to the page.

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

`src/scroll/progress.ts` maps scroll position onto that timeline. Sections have
very different heights, so it anchors one stop per state at the scroll offset
where that section sits under the middle of the viewport.

**Project takeover.** Hovering a project lights its band of the vase at once.
If the pointer stays for a quarter of a second, the whole cloud reforms into a
figure for that project (`src/scene/projects.ts`): a knot, a bar chart, a stack
of ruled sheets, a sprout, two crossing lines, a calendar. The figures live in
two spare attribute slots that cross-fade, so moving from one project to the
next never pops.

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
| How long a hover waits before the takeover | `DWELL` in `src/sections/work.ts` |
| Pointer push, swirl, shockwave | the vertex shader in `src/scene/shaders.ts` |
| Spring and damping of the skills field | the constants at the top of `src/sections/stack.ts` |

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
  sections/           behaviour for Intro, Work, Experience, Stack, Contact
  ui/                 cursor, header, loader, overlay, preview card, theme, sound
  visuals/            the six generative project visuals
  scroll/             smooth scroll and the scroll-to-morph mapping
  core/               motion preference, easing, small helpers
  styles/             tokens and base, layout, floating UI, write-up pages
tests/                unit tests (run by Node directly, no test framework)
video/                the showcase film pipeline and the link-preview image script
```

## Accessibility and fallbacks

- All content is real markup in the shipped HTML. With JavaScript off the page
  reads completely, the section nav is a row of links and project rows link to
  their write-ups. Content is only hidden for a reveal when a script is there
  to show it again; if the main script never boots, a failsafe un-hides it.
- **Reduced motion** is respected from the OS setting and from the Motion
  switch in the header, which persists. In that mode there is no intro, no
  smooth scroll, no custom cursor, no drift, parallax or pointer physics, and
  everything is visible from the start. The cloud still tracks the scroll, so
  the page stays coherent.
- Focus is visible everywhere. Project rows respond to keyboard focus as they
  do to hover, and the arrow keys move between them. The project overlay is a
  modal dialog: focus moves in, is trapped, and returns to the row; Esc, the
  browser's back button and a downward swipe all close it.
- Text greys are 10:1 and 5.3:1 on the background in both themes. An automated
  axe-core pass reports no violations on the home page (both themes, with and
  without motion), with the overlay open, or on a write-up.
- If WebGL is missing, the scene module is never downloaded and the page reads
  normally. The corner dot grid is plain 2D canvas and stays.
- The custom cursor, the preview card and hover effects are bound only for a
  mouse. On touch, the project row in view is the active one and a tap opens
  the overlay.
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

**Why keep it black and white.** One ink, one paper, and every other tone is
that ink at reduced alpha. With no colour to lean on, hierarchy has to come
from scale, weight and space, which is the harder and more honest way to do it.
It also means dark mode is a literal inversion rather than a second design.

**Why one object instead of five scenes.** The site's argument is continuity:
the same matter, rearranged. The gyroscope is energy with no structure. It
tightens into a vase that *is* the project list, stretches into a column that
*is* the timeline, unrolls into a ribbon behind the skills, and ends as a
tangle that resolves into a single line as the scroll runs out. Because the
points persist, every transition reads as reorganisation, never as a cut.

**Why the cloud sits to the right.** The first version put the object behind
the text, where it muddied the copy. Now the reading column keeps to the left
two thirds and the object owns the right third. Type and particles each get
clear air, and the page reads as a spread with an illustration rather than a
poster with a caption.

**Why a hover waits before the cloud reforms.** Activating a project does
three things in rising order of commitment: the row responds at once, its band
of the vase lights, and only after a quarter of a second does the whole cloud
reform. Skimming the list stays calm; lingering is rewarded.

**Why the project visuals are drawings, not screenshots.** Most of the
projects are not public, and a mocked screenshot implies a product that the
viewer cannot check. A generative drawing of the *idea* (two lines crossing, a
plant growing as a number falls) is honest about being an illustration, and it
is something built rather than captured.

**Why the theme wipes from the toggle.** The switch is an action with a
source, so the change spreads from where it was made. Underneath, the
particles move from adding light to laying down ink, which is the same idea
expressed in the renderer.

**Why the skills can be thrown around.** A skills list is the driest part of
any portfolio. Making each word a physical object says "I enjoy tinkering"
more convincingly than the sentence does. The real list never leaves the DOM,
so nothing is lost for a screen reader or with motion off.

**Why the name is exactly as wide as the page.** The display size is computed
from the viewport so "Alexius Lee" runs edge to edge at every width. It is the
largest the name can be without being cut, and it turns the name into the
page's top rule.

**What was deliberately left out.** No section snapping, because taking the
scroll away from the reader costs more than it gives. No chromatic aberration,
because it is a colour effect in a site with no colour. No permission prompt
for device tilt on iOS, because a background effect does not earn a prompt.

## Known gaps

- **Write-ups are not in the content file.** The four pages under `work/` are
  still hand-written HTML.
- **Project links.** Only this site has a live URL and a repo. The others are
  `TODO` in the content file and show no button until filled in.
- **Tested in Chromium only.** The checks here (72 scripted browser checks,
  axe-core, Lighthouse) all ran in Chromium. Safari and Firefox have not been
  run. The theme wipe and the overlay's title transition use the View
  Transitions API and fall back to a plain switch where it is missing.
- **Frame rate on real hardware is unmeasured.** The build machine has no GPU,
  so the 60fps target and the tier thresholds are reasoned, not benchmarked.
  If a device struggles, lower its tier in `chooseTier`.
- **Device tilt** works where the browser reports orientation without asking
  (Android). On iOS the scene does not tilt.
- **The showcase film** in `video/` was cut for the previous version of the
  site. Its capture script runs, but the timings and captions describe the old
  layout and need re-cutting. See `video/README.md`.
