# Portfolio

A loud, chunky portfolio: flat colour, heavy type, hard 3px edges, and nearly
everything on it moves. The name inflates from a hairline to full black, the
project slabs slam in and lean toward the pointer, the years roll up like a
counter, and the toolkit runs in bands that speed up as you scroll.

**Live:** <https://alexius-lee.vercel.app> · **Repo:** <https://github.com/axlxius/portfolio>

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check, then static output in dist/
npm run preview    # serve the build locally
npm test           # unit tests for the content file and the palettes
```

Built with Vite, TypeScript, GSAP and Lenis. There is no framework and no
WebGL: the content is static and the motion is imperative, so React would add
a hydration step and nothing else.

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
| Name, intro line, tags, sticker | `INTRO` (`short` is the line under the name) |
| The strip along the top | `TICKER` |
| Projects | `PROJECTS` |
| Roles | `ROLES` |
| Skill groups | `SKILLS` |
| Education, certifications | `EDUCATION`, `CERTIFICATIONS` |
| Contact copy and links | `CONTACT` |
| Section headings (Experience, Toolkit) | `LABELS` |

A link that does not exist yet is written as `TODO` (which is `null`). Nothing
is rendered for it, so a missing live URL never shows as a dead button. Search
the file for `TODO` to see what is still open.

Role and project copy mirrors the resume. Keep the two in step.

The page is deliberately brief: each project is a title, one line and its
tools; each role a title, its dates and its skills. `ROLES[].body` is kept for
the resume but not shown.

`PROJECTS[].tech` and `.context` come from each project's write-up and appear
on the project's slab. `pay2live` has no write-up, so it claims neither.

### Adding a project

Add an entry to `PROJECTS`. That is all: the slab, its number and colour, and
the count beside "Selected work" all follow from the list. A slab links to the
write-up if there is one, else the repo, else the live site; with none it says
"Write-up coming".

### Project write-ups

Four projects have a long-form page under `work/`. These are still hand-written
HTML, built with `src/case.ts` and `src/styles/case.css`. To add one, copy an
existing `work/<slug>/index.html`, add the slug to `pages` in `vite.config.ts`
and to `public/sitemap.xml`, and set the project's `writeUp` in the content
file. Its slab then links there.

## The page

| Section | What moves |
| --- | --- |
| Top | The ticker runs along the top and pauses under the pointer. The bar marks the section on screen. |
| Intro | The name drops in letter by letter, tumbling, while it inflates from weight 100 and 55% width to 900 and 112%. Then the letters bob in a slow wave, and each one wobbles like jelly when the pointer touches it (or a finger taps it). The sticker spins in last. |
| Work | "Selected work" slams in from the right and overshoots. The count rolls up from 00. Each slab slams in from its own side, tilted, then leans toward the pointer and turns to ink on hover. Clicking one throws a burst of shapes before the page changes. |
| Experience | Each year rolls up from 1999 like a tape counter. |
| Toolkit | Each skill group is a band of huge type running sideways, alternate bands in opposite directions. Scrolling speeds them up, and scrolling up runs them backwards. |
| Contact | "Get in touch" slams in; the link blocks and credits pop up. Every chunky button lifts onto a hard shadow on hover, squishes on press and throws a burst. |

Things play again if you scroll back above them and down again. Typing the
Konami code throws confetti.

The **Colour** button cycles three palettes, Tangerine, Lilac and Night,
flooding the new one out from the button as a circle. The choice is remembered;
until a visitor picks, a device in dark mode gets Night.

## Where things live

```
src/
  data/content.ts     all copy and links
  markup/page.ts      the page as string templates, run at build time
  fx/
    hero.ts           sizing the name to the width, the inflate intro, jelly letters
    entrances.ts      slam-ins, pop-ups, rolling numbers, the bar's current section
    odometer.ts       rolling digits
    marquee.ts        the ticker and the toolkit bands, and their scroll speed
    touch.ts          slabs leaning, bursts of shapes on click
    palette.ts        the Colour button
    toast.ts          the small message at the bottom
  scroll/smooth.ts    Lenis smooth scrolling and in-page anchors
  core/               motion preference, easing, small helpers
  styles/             base.css (tokens, palettes, blocks), home.css, case.css
  main.ts, case.ts    entry points for the home page and the write-ups
tests/                unit tests (run by Node directly, no test framework)
video/                the showcase film pipeline, cut for the old design
```

### Tuning

| Knob | File |
| --- | --- |
| Palettes | `:root[data-palette=…]` in `src/styles/base.css`, and `PALETTES` in `src/fx/palette.ts` |
| Weight and width of the heavy type | `--heavy` / `--heavy-wdth` in `src/styles/base.css` |
| Type sizes, gutter, border | the other tokens in `src/styles/base.css` |
| The overshoot curve on hovers and presses | `--pop` in `src/styles/base.css` |
| How far things slam from, and how hard | `src/fx/entrances.ts` |
| Ticker and band speed, and how much scrolling adds | `TICKER_SPEED`, `BAND_SPEED` and `update()` in `src/fx/marquee.ts` |
| The intro's start weight and width | `createHero` in `src/fx/hero.ts` |

Adding a palette: add a block to `base.css` and an entry to `PALETTES`, in the
order the button should cycle, and add its id to the check in the pre-paint
script in `src/markup/page.ts`. `npm test` checks every text pairing in every
palette for contrast.

## Accessibility and fallbacks

- All content is real markup in the shipped HTML. With JavaScript off it is
  a plain page: the bands are wrapped lists and the numbers are just numbers.
  Content is only hidden before an entrance when a script is there to show it;
  if the main script never boots, a failsafe un-hides it.
- **Reduced motion** is respected from the OS setting and from the Motion
  button, which persists. With it off there is no intro, no slam, no rolling,
  no ticker or band movement, no bursts and no smooth scroll. The switch takes
  effect without a reload.
- Every text and background pairing in all three palettes reaches 4.5:1
  (`tests/palette.test.ts`).
- The name is split into letters for the animation, with the heading keeping
  its accessible name. The ticker, the sticker, the count and the years are
  decoration and hidden from screen readers; the same facts are in the text.
  Copies made for the moving bands are hidden too, so each skill is read once.
- Controls are at least 44px tall. Hover effects have a press equivalent on
  touch.

## Taste notes

**Why loud.** The old site was a quiet black-and-white film. This one is meant
to feel like a poster you can poke: big flat colour, the heaviest weight of the
typeface, hard edges and hard shadows, and motion that overshoots and snaps
back, so it reads as a hit rather than a slide.

**Why the same typeface.** Anybody has a width axis from 50% to 150% and a
weight axis from 100 to 900, so it can go from the old site's hairline to a
slab without a new font. The intro does exactly that, a nod to the old design
on the way to the new one.

**Why not Dayzine's colours.** The style borrows from Dayzine, the calendar
app, but the palette is the portfolio's own, so the two do not read as the
same product.

**No outlined numbers.** Outlines (`text-stroke`) draw the variable font's
overlapping contours inside the 5 and the 6, so the big numbers use a hard
shadow instead.

## Known gaps

- **Write-ups are not in the content file.** The four pages under `work/` are
  still hand-written HTML.
- **Project links.** Only this site has a live URL and a repo. The others are
  `TODO` in the content file.
- **Tested in Chromium only**, at 1440px and 390px wide, with and without
  reduced motion. Safari and Firefox have not been run. The palette flood uses
  the View Transitions API and falls back to a plain switch where it is
  missing.
- **The showcase film** in `video/` was cut for the old design and needs
  re-cutting. See `video/README.md`.
