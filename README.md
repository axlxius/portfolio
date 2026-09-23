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
| Roles | the two `.role` entries in `#experience` |
| Skills | the four groups in `#stack` |
| Education, certifications | `.credentials` in `#stack` |
| Email and profile links | `.contact-links` in `#contact` |

Keep to roughly the existing lengths: a project note of about 10–14 words and
a role summary of about 25–35 words sit correctly without reflowing.

The GovTech role is deliberately title-only. The `.role` grid renders fine
without a `.role-body`, so add one later if you want to describe the work.

### Publishing your resume

The resume link in `#contact` is commented out. To enable it, save your PDF as
`public/resume.pdf` and uncomment the link. The copy at
`Downloads/PDFs/Alexius_Lee_Resume.pdf` was not copied in: it predates the
GovTech internship, and it carries your phone number, which would become
public on deploy. Use an updated copy and decide about the phone number first.

### Adding a project

Copy a `.work-item` block and give it a `data-strand` value between `0` and
`1`. That number picks which band of strands in the 3D scene lights up when
the row is hovered or focused — space the values out so each project lights a
visibly different part of the structure.

## How the 3D works

The scene is one persistent object, not five. `src/scene/shapes.js` builds
220 *strands* of 28 points each, then writes five complete sets of target
positions for those same points:

| Section | Form |
| --- | --- |
| Intro | strands woven around a (2,3) torus knot |
| Work | a mesh plane receding to a horizon |
| Experience | a twisted helical column |
| Stack | seven discrete clusters |
| Contact | convergence onto a single quiet axis |

Every target set is uploaded once as a vertex attribute (`aPos0`–`aPos4`).
The vertex shader in `src/scene/shaders.js` blends between them with tent
weights, which sum to exactly 1 between any two consecutive states, so the
morph is a branch-free lerp with no dynamic array indexing. Each strand's
position on the timeline is nudged by its seed, so the object reforms as a
flowing wave rather than snapping in lockstep.

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
| Camera framing per section | `CAMERA_Z` / `CAMERA_Y` in `src/scene/Scene.js` |
| Dot size, line opacity | the two `ShaderMaterial` blocks in `src/scene/Scene.js` |
| Morph spread, drift amount | `uStagger`, `uNoise` in `src/scene/Scene.js` |
| The five forms themselves | the builder functions in `src/scene/shapes.js` |

Adding or removing a builder in `shapes.js` is enough to change the number of
states — `STATE_COUNT`, the shader attributes and the blend are all generated
from that array. The section count in `index.html` must match it.

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
row lights its band of strands, which is motion answering an action rather than
ambient decoration.

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

## Known gaps

- `.work-link` hrefs all point at `#work`. Point them at real repos or
  write-ups, or drop the anchor if a project has nowhere to link.
- "Housing and Fertility" and "Portfolio Analytics" are descriptive titles
  invented here — neither project had a name of its own on disk (the folders
  were `Downloads/Tableau` and `Desktop/stocks`). Rename them if you prefer.
- Project years were taken from file timestamps on disk, not from a syllabus:
  Portfolio Analytics 2026, SCI Copilot 2026, GrowcerySG 2026, the Tableau
  study 2025, pay2live 2025.
- Five projects is what the hover highlight is spaced for. The `data-strand`
  values are set at 0.06 / 0.26 / 0.45 / 0.66 / 0.86; re-space them if you add
  or remove a row.
- The Veritas Organisation role reuses the energy-sales description from the
  resume, where the employer was written as Genco Energy. Confirm it still
  reads correctly under the Veritas name.
- No favicon, social preview image, or analytics.
