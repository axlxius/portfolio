# Portfolio

Minimal black-and-white portfolio with a scroll-driven WebGL scene.

**Live:** <https://alexius-lee.vercel.app> · **Repo:** <https://github.com/axlxius/portfolio>

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
npm run preview  # serve the build locally
```

## Deploying

The Vercel project `alexius-lee` is connected to this GitHub repo, so pushing
to `main` builds and publishes automatically:

```bash
git add -A && git commit -m "your message" && git push
```

To publish without a commit, `vercel --prod --yes` deploys the working tree.

Share the production alias, `alexius-lee.vercel.app`. The per-deployment URLs
that Vercel prints (`alexius-<hash>-axlxius-projects.vercel.app`) sit behind
Vercel's login wall and will not open for anyone else.

`vite.config.js` sets `base: './'`, so the build also works from a subpath such
as GitHub Pages if you ever move it.

`resume/` is gitignored. It holds a personal document with a phone number in
it, which does not belong in a public repo.

## Editing your content

Everything a visitor reads lives in `index.html`. There is no CMS and no
content file to keep in sync — edit the markup directly.

| What | Where |
| --- | --- |
| Name | `<title>`, `.wordmark`, the `h1` in `#intro` |
| Description meta tag | `<head>` |
| Projects | the six `.work-item` entries in `#work` |
| Project write-ups | `work/<slug>/index.html` |
| Roles | the three `.role` entries in `#experience` |
| Skills | the four groups in `#stack` |
| Education, certifications | `.credentials` in `#stack` |
| Email and profile links | `.contact-links` in `#contact` |

Keep to roughly the existing lengths: a project note of about 10–14 words and
a role summary of about 25–35 words sit correctly without reflowing.

Role and project copy is taken from the resume. Keep the two in step when
either changes.

### Project write-ups

Four projects have their own page under `work/`, built with `src/case.js`
(theme and heading reveal, no WebGL scene) and `src/styles/case.css`. To add
one:

1. Copy an existing `work/<slug>/index.html` into a new folder and rewrite it,
   including every URL in `<head>`.
2. Add the slug to `pages` in `vite.config.js`, or it will not be built.
3. Add the URL to `public/sitemap.xml`.
4. Point the project's `.work-link` at `./work/<slug>/`, and fix the "Next
   project" links so the chain still loops.

A project with no page and no public repo uses
`<div class="work-link work-link--static">` instead of an anchor. That is how
pay2live is set up now.

### Publishing your resume

The resume link in `#contact` is commented out. To enable it, save your PDF as
`public/resume.pdf` and uncomment the link. The copy at
`Downloads/PDFs/Alexius_Lee_Resume.pdf` was not copied in: it predates the
GovTech internship, and it carries your phone number, which would become
public on deploy. Use an updated copy and decide about the phone number first.

### Adding a project

Copy a `.work-item` block and give it a `data-strand` value between `0` and
`1`. Each row owns one hoop of the Work form, stacked in list order, and
hovering or focusing the row lights exactly that hoop: every strand carries
its hoop's index, so the lit set is the hoop whatever the spacing. The number
of hoops follows the number of rows, and the camera backs off so the whole
stack stays on screen. Strands join the hoop whose value is nearest their
seed, so spacing the values evenly (for six rows: 0.05 / 0.22 / 0.38 / 0.55 /
0.72 / 0.89) keeps the hoops similarly dense. Give every row a different
value: two rows with the same value share one hoop.

## How the 3D works

The scene is one persistent object, not five. `src/scene/shapes.js` builds
220 *strands* of 28 points each, then writes five complete sets of target
positions for those same points:

| Section | Form |
| --- | --- |
| Intro | strands woven around a (2,3) torus knot |
| Work | one hoop per project, stacked in list order |
| Experience | a braided column: identical helices, alternate strands twisting opposite ways |
| Stack | seven small wireframe spheres |
| Contact | convergence onto a single quiet axis |

Every target set is uploaded once as a vertex attribute (`aPos0`–`aPos4`).
The vertex shader in `src/scene/shaders.js` blends between them with tent
weights, which sum to exactly 1 between any two consecutive states, so the
morph is a branch-free lerp with no dynamic array indexing. Each strand's
position on the timeline is nudged by its seed, so the object reforms as a
flowing wave rather than snapping in lockstep.

That stagger fades out as each section is centred (`uSettle`), so a section at
rest shows its form fully built. The Intro is the exception: it keeps the full
stagger, which is what gives the knot its woven look. The Work hoops are laid
at exactly the angles their strands take in the Experience braid, so that
transition is a vertical stretch rather than points crossing the shape.

Line segments only ever connect points *within* a strand, so no segment can
streak across the scene mid-morph however far the endpoints travel.

`src/scroll/progress.js` maps scroll position onto that timeline. Sections
have very different heights, so instead of a `scrollTop / scrollHeight` ratio
it anchors one integer stop per section at the scroll offset where the section
sits under the middle of the viewport. State *N* is therefore fully formed
exactly when section *N* is centred, regardless of how tall the sections are.

### Tuning

| Knob | File |
| --- | --- |
| Point and strand counts | `DESKTOP` / `MOBILE` in `src/scene/Scene.js` |
| Dot size, hover dot growth | `DOT_SIZE` / `GLOW_SIZE` in `src/scene/Scene.js` |
| Line opacity | the lines `ShaderMaterial` in `src/scene/Scene.js` |
| Camera distance and height per section | `CAMERA_Z` / `CAMERA_Y` in `src/scene/tracks.js` |
| Morph spread, drift, settling per section | `STAGGER` / `NOISE` / `SETTLE` in `src/scene/tracks.js` |
| Width kept in frame on narrow screens | `FIT_WIDTH` in `src/scene/tracks.js` |
| Work hoop stack kept in frame vertically | `FIT_HEIGHT` in `src/scene/tracks.js` |
| Hoop and braid proportions | `HOOP` / `BRAID` in `src/scene/shapes.js` |
| The five forms themselves | the builder functions in `src/scene/shapes.js` |
| Corner dots | `src/scene/CornerDots.js`, placement in `src/styles/layout.css` |

`npm test` runs the Node tests in `tests/`. They check the forms (including
that the Intro and Contact forms have not changed), that each strand's hover
index matches the hoop it is drawn on, and that the camera fitting keeps the
hoops on screen.

Adding or removing a builder in `shapes.js` is enough to change the number of
states — `STATE_COUNT`, the shader attributes and the blend are all generated
from that array. The section count in `index.html` must match it, and every
array in `src/scene/tracks.js` needs one value per state (`npm test` checks
this).

## Design notes

The palette is a single ink/paper pair defined in `src/styles/base.css`. Light
and dark are a literal inversion of those two channel triples, and every other
tone on the page is that ink at reduced alpha, so nothing can drift
off-monochrome. `src/ui/theme.js` swaps the WebGL ink colour alongside the CSS.
The theme is resolved by an inline script in `<head>` before first paint, so
there is no flash of the wrong background.

Type is one family, Archivo Variable, used at both ends of its width and weight
axes: hairline and very wide (`wght` 200 / `wdth` 125) for display, normal and
regular for reading. Display lines are set flush left and deliberately allowed
to clip at the right viewport edge.

Motion is spent in one place — the scroll morph. Section headings get a single
clip reveal, once each; body copy and list rows get none. Hovering a project
row lights that project's hoop, which is motion answering an action rather than
ambient decoration. The one ambient exception is a small patch of stationary
dots in the top-right corner whose brightness breathes outward from the corner;
it never moves and freezes under reduced motion. Content scrolling under the
fixed header fades out behind it instead of colliding with the wordmark.

## Accessibility and fallbacks

- `prefers-reduced-motion` disables smooth scroll, freezes the drift animation
  and pointer interaction, and shows all headings without the reveal. The
  scroll-linked morph still tracks position, so the scene stays coherent.
- If WebGL is missing or fails to initialise, the canvas is removed and the
  page reads normally. All content is real markup, so it also works with
  JavaScript disabled.
- Pointer interaction is bound only under `(pointer: fine)`.
- Project rows are anchors and respond to keyboard focus the same way they
  respond to hover.
- Rendering parks while the tab is hidden; device pixel ratio is capped at 2.
- The corner dots are a plain 2D canvas: they still show if WebGL fails, are
  skipped silently if 2D canvas is unavailable, and are static under
  `prefers-reduced-motion`.

## Known gaps

- Only this site's repo is public, so the write-ups have no demo or code
  links. Add them when a project goes public (Tableau Public for the housing
  study, Streamlit Community Cloud for the dashboard).
- The write-ups have no screenshots and no measured results yet.
- Strand count (desktop 220, mobile 110) is chosen at load, so rotating a
  tablet across 720 px keeps the first count until refresh.
- No analytics.

## SEO and link previews

All in `<head>` of `index.html` plus `public/`:

| What | Where |
| --- | --- |
| Canonical URL, Open Graph / Twitter tags | `<head>` |
| `Person` structured data (JSON-LD) | `<head>` — update `jobTitle` / `worksFor` when your role changes |
| Favicon | `public/favicon.svg` (inverts in dark mode), `public/apple-touch-icon.png` |
| Social preview image | `public/og-image.png`, 1200×630 |
| Crawling | `public/robots.txt`, `public/sitemap.xml` |

Every absolute URL points at `https://alexius-lee.vercel.app/`. If you move to
a custom domain, search-and-replace that across `index.html`, `robots.txt` and
`sitemap.xml`. The preview image also shows the domain and your GovTech role,
so regenerate it when either changes.
