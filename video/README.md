# Showcase video

A 50-second walkthrough of the site for people who will not scroll it
themselves. It is rendered from the real site, frame by frame, so it stays
true to what the site does and can be re-rendered whenever the site changes.

```bash
# 1. Serve a production build of the site
cd .. && npm run build && npx vite preview --port 4173 --strictPort &

# 2. Capture and render (in video/)
npm install
npm run capture:qa && npm run render:qa   # 13 QA stills + contact sheet in out/qa/
npm run capture && npm run render         # the film, about 1 hour on software GL
```

The output goes to `out/` (gitignored):

| File | What |
| --- | --- |
| `showcase-1080p.mp4` | 1920×1080, 30 fps, H.264 yuv420p, CRF 16, faststart |
| `showcase-720p.mp4` | 1280×720 two-pass web cut, under 8 MB, for embedding |
| `poster.png` | the held end card, for the `<video poster>` |

On a machine without Playwright's Chromium, run `npx playwright install chromium`
first.

## How it works

There are two stages. Both read their timings from `timeline.mjs`.

**`capture.mjs`** drives the site in headless Chromium. An init script replaces
`requestAnimationFrame` and `performance.now` before any site code runs, so the
scene, Lenis and the corner dots only move when the script steps the clock.
CSS transitions (heading reveals, theme swap, row hover, the fade-in) are
frozen through the DevTools Animation domain and seeked to the same virtual
time. Every run produces the same frames however slow the machine is.

Scroll position, the pointer and the theme click are set from `t`. Section
stops are measured from the DOM, so content edits do not break the timing.
When the scroll moves faster than 40 px per frame, four sub-frames are
captured across a 180-degree shutter, and the compositor averages them into
real motion blur. The fixed header stays sharp because it does not move
between sub-frames.

**`compositor.html`** is a `render(t)` page with no CSS animation. It frames
the captures, draws the cursor ring, sets the captions and the end card, and
blurs the page-to-page slide. `render.mjs` screenshots it frame by frame and
pipes the PNGs into ffmpeg.

## Style lock

Taken from the site itself.

| | |
| --- | --- |
| Canvas | 1920×1080, 30 fps, 50.0 s = 1500 frames |
| Palette | `#000000` / `#FFFFFF` only. Greys are ink at 0.70 / 0.45 / 0.20 / 0.10. Opens dark, inverts once at 32.0 s (0.5 s) |
| Type | Archivo Variable. Display: wght 200, wdth 125, 200 px. Captions: wght 400, 30 px. Index: 30 px, ink at 0.45, tabular figures |
| Grid | 72 px gutter. Site window framed at 0.80 (1536×864 at 192, 48) with a 1 px ink-20 hairline. Caption rail centred on y = 988: caption left at x = 192, index right-aligned to x = 1728 |
| Easing | `cubic-bezier(0.22, 1, 0.36, 1)` for every editorial move. Scrolls use Lenis' `1 − 2^(−10t)`. The scene keeps its own damping |
| Text | Clip reveal only: the line rises 110 % inside its mask over 1.05 s, staggered 80 ms. Exit: 0.5 s fade with an 8 px rise |
| Camera | Scroll is the camera. Pull-out from full-bleed to framed at 2.8 s, push-in for the Work to Experience morph, then back out |
| Blur | Captured sub-frames on fast scrolls. Six-sample blur on the page slide |
| Avoid | Colour, gradients, glow, shadows, glitch, zoom-punch, centred title cards, music |

## Shots

| # | Time | On screen | Caption |
| --- | --- | --- | --- |
| 1 | 0.0–4.0 | Intro, full-bleed: the site fades in, the knot weaves, the name reveals. Pull-out to framed | — |
| 2 | 4.0–7.0 | Intro, framed | One Three.js object, five forms. |
| 3 | 7.0–9.5 | Scroll to Work: knot reforms into hoops | Scroll drives the morph. |
| 4 | 9.5–18.5 | Work: cursor hovers This Site, SCI Copilot, Housing and Fertility | Six projects, six hoops. / Hover a project and its hoop lights. |
| 5 | 18.5–21.5 | Push-in, scroll to Experience: hoops stretch into the braid | — |
| 6 | 21.5–26.5 | Experience, framed | Experience, braided. / Product Management Intern, GovTech. |
| 7 | 26.5–29.0 | Scroll to Stack: braid breaks into spheres | — |
| 8 | 29.0–34.0 | Stack. The cursor clicks the theme toggle at 32.0 s | Stack, as seven wireframe spheres. / One toggle inverts everything. |
| 9 | 34.0–36.5 | Scroll to Contact, light | — |
| 10 | 36.5–40.5 | Contact, slow 2 % push | Everything converges to one axis. |
| 11 | 40.5–45.0 | The SCI Copilot write-up slides in, then scrolls | Every project has its own write-up. |
| 12 | 45.0–50.0 | End card: name, site and GitHub | — |

## Voiceover (optional)

About 45 words at 130 wpm. The film is cut to read without it.

| In | Line |
| --- | --- |
| 1.5 s | "I'm Alexius, a business and financial technology student, interning at GovTech." |
| 7.0 s | "My site is one 3D object that reshapes as you scroll." |
| 10.5 s | "Each project owns a hoop. Hover a project, and its hoop lights." |
| 21.5 s | "Experience becomes a braid, and my skills, seven spheres." |
| 36.5 s | "Everything converges to one point: get in touch." |
| 46.0 s | "alexius-lee dot vercel dot app." |
