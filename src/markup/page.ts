/**
 * Static markup for the home page, generated from src/data/content.ts.
 *
 * These are plain string templates with no DOM access, because they run inside
 * the Vite config at build time. The result is injected into index.html, so the
 * shipped page has all of its text before any script runs.
 *
 * The page is written as five scenes. Without JavaScript, or with reduced
 * motion, they are ordinary stacked sections that read top to bottom. With
 * motion, src/scenes/ pins them and scrubs their choreography with the scroll.
 */
import {
  CERTIFICATIONS,
  CONTACT,
  EDUCATION,
  INTRO,
  LABELS,
  LINKS,
  META,
  PROJECTS,
  ROLES,
  SECTIONS,
  SKILLS,
  WORK_TITLE,
} from '../data/content.ts';
import type { Project } from '../data/content.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pad2 = (n: number) => String(n).padStart(2, '0');

const ARROW = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg>`;

const rule = `<span class="rule" aria-hidden="true"></span>`;

/** The first four-digit year in a date range, for the timeline keyframes. */
const yearOf = (dates: string) => dates.match(/\d{4}/)?.[0] ?? dates;

/**
 * The fixed layer: a heads-up display like an editing timeline. Wordmark and
 * controls on top, a scene label and running timecode, and a scrubber along
 * the bottom whose marks are the section links.
 */
function hud(): string {
  const marks = SECTIONS.map(
    (s, i) =>
      `<li><a class="mark" href="#${s.id}" data-mark="${s.id}"><span class="mark-tick" aria-hidden="true"></span><span class="mark-label">${pad2(i + 1)}<span class="mark-name"> ${esc(s.label)}</span></span></a></li>`
  ).join('');

  return `
    <header class="hud">
      <a class="wordmark" href="#intro" data-magnetic>${esc(META.name)}</a>
      <p class="hud-scene mono" aria-hidden="true"><span class="hud-dot"></span><span class="hud-roll" data-hud-roll><span>01 ${esc(SECTIONS[0].label)}</span></span></p>
      <div class="hud-right">
        <span class="hud-tc mono" data-timecode aria-hidden="true">00:00:00:00</span>
        <button class="pref mono" type="button" data-motion-toggle aria-pressed="false" aria-label="Reduce motion">Motion</button>
        <button class="pref mono" type="button" data-sound-toggle aria-pressed="false" aria-label="Sound" data-off>Sound</button>
        <button class="toggle" type="button" data-theme-toggle data-magnetic aria-pressed="false">
          <span data-theme-label>Dark</span>
        </button>
      </div>
    </header>
    <nav class="scrubber" aria-label="Scenes">
      <div class="scrubber-track" aria-hidden="true"><span class="scrubber-fill" data-scrub-fill></span></div>
      <ol class="scrubber-marks">${marks}</ol>
    </nav>
    <span class="playhead" data-playhead aria-hidden="true"></span>`;
}

// --- Scene 1: title card --------------------------------------------------------

function intro(): string {
  return `
      <section class="scene scene--title" id="intro" data-section="Intro" aria-labelledby="intro-title">
        <div class="title-stage">
          <div class="title-top" data-title-fade>
            <p class="title-meta mono" data-fade>${INTRO.tags.map(esc).join('<span aria-hidden="true"> / </span><span class="visually-hidden">, </span>')}</p>
          </div>
          <h1 class="display" id="intro-title" data-hero-name>${esc(INTRO.name)}</h1>
          <div class="title-foot" data-title-fade>
            <p class="lead title-line" data-hero-lead>${esc(INTRO.short)}</p>
            <p class="title-cue mono" data-hero-cue data-fade><span>${esc(INTRO.cue)}</span><span class="title-cue-line" aria-hidden="true"></span></p>
          </div>
        </div>
      </section>`;
}

// --- Scene 2: the work reel --------------------------------------------------------

/** Without JavaScript a title goes to the best page that exists for it. */
function projectHref(p: Project): string | null {
  return p.writeUp ?? p.repo ?? p.live;
}

function work(): string {
  const items = PROJECTS.map((p, i) => {
    const href = projectHref(p);
    const external = href !== null && /^https?:/.test(href);
    const open = href
      ? `<a class="reel-link" href="${esc(href)}"${external ? ' rel="noreferrer"' : ''}`
      : `<button class="reel-link" type="button"`;
    const close = href ? '</a>' : '</button>';
    return `
          <li class="reel-item" data-reel="${i}">
            ${open} data-project="${p.slug}" data-cursor="view">
              <span class="reel-index mono">${pad2(i + 1)} / ${pad2(PROJECTS.length)}</span>
              <span class="reel-title" data-title>${esc(p.title)}</span>
              <span class="reel-note">${esc(p.note)}</span>
              <span class="reel-meta mono"><span>${esc(p.year)}</span><span class="reel-open">Open ${ARROW}</span></span>
            ${close}
          </li>`;
  }).join('');

  return `
      <section class="scene scene--work" id="work" data-section="Work" aria-labelledby="work-title">
        <div class="reel-stage">
          <div class="reel-head">
            <h2 class="scene-label mono" id="work-title">${esc(WORK_TITLE)}</h2>
            <p class="reel-count mono" aria-hidden="true"><span class="reel-count-roll" data-reel-count><span>00</span></span> / ${pad2(PROJECTS.length)}</p>
          </div>
          <ol class="reel">${items}
          </ol>
        </div>
      </section>`;
}

// --- Scene 3: the timeline ------------------------------------------------------------

function experience(): string {
  // Oldest on the left, as on any timeline.
  const roles = [...ROLES].reverse();
  const keys = roles
    .map(
      (r, i) =>
        `<li class="tl-key" data-key="${i}"><span class="tl-diamond" aria-hidden="true"></span><span class="tl-year">${esc(yearOf(r.dates))}</span></li>`
    )
    .join('');
  const cards = roles
    .map(
      (r, i) => `
          <li class="tl-role" data-role="${i}">
            <p class="tl-dates mono">${esc(r.dates)}</p>
            <h3 class="tl-title" data-title>${esc(r.title)}</h3>
          </li>`
    )
    .join('');

  return `
      <section class="scene scene--timeline" id="experience" data-section="Experience" aria-labelledby="experience-title">
        <div class="tl-stage">
          <h2 class="scene-label mono" id="experience-title">${esc(LABELS.experience)}</h2>
          <div class="tl-rail" aria-hidden="true">
            <span class="tl-line" data-tl-line></span>
            <span class="tl-playhead" data-tl-playhead></span>
          </div>
          <ol class="tl-keys" aria-hidden="true">${keys}</ol>
          <ol class="tl-roles">${cards}
          </ol>
        </div>
      </section>`;
}

// --- Scene 4: the toolkit -------------------------------------------------------------

function stack(): string {
  const rows = SKILLS.map(
    (g, gi) => `
          <div class="kit-row" data-kit-row="${gi}">
            <h3 class="kit-group mono">${esc(g.name)}</h3>
            <ul class="kit-words">${g.items.map((item) => `<li class="kit-word">${esc(item)}</li>`).join('')}</ul>
          </div>`
  ).join('');

  return `
      <section class="scene scene--kit" id="stack" data-section="Toolkit" aria-labelledby="stack-title">
        <h2 class="scene-label mono" id="stack-title">${esc(LABELS.stack)}</h2>
        <div class="kit" data-skew>${rows}
        </div>
      </section>`;
}

// --- Scene 5: credits and contact -----------------------------------------------------

function contact(): string {
  const education = EDUCATION.map(
    (e) => `<dd>${esc(e.text)}${e.honour ? `<span class="credit-note">${esc(e.honour)}</span>` : ''}</dd>`
  ).join('');
  const certs = CERTIFICATIONS.map(
    (c) => `<dd>${esc(c.name)}<span class="credit-note">${esc(c.issuer)}</span></dd>`
  ).join('');

  const links = CONTACT.links
    .map((l) => {
      const external = l.kind === 'external' ? ' rel="noreferrer"' : '';
      return `<li data-fade><a class="contact-link" href="${esc(l.href)}"${external} data-kind="${l.kind}" data-magnetic data-cursor="link"><span>${esc(l.label)}</span></a></li>`;
    })
    .join('');

  return `
      <section class="scene scene--end" id="contact" data-section="Contact" aria-labelledby="contact-title">
        <div class="credits">
          <h2 class="scene-label mono" data-fade>${esc(LABELS.credits)}</h2>
          <dl class="credit-list">
            <div class="credit" data-fade><dt class="mono">Education</dt>${education}</div>
            <div class="credit" data-fade><dt class="mono">Certifications</dt>${certs}</div>
            <div class="credit" data-fade><dt class="mono">Built with</dt><dd>Three.js, GSAP, Lenis and Vite</dd></div>
          </dl>
        </div>
        <div class="contact">
          <div class="bleed"><h2 class="title" id="contact-title" data-reveal data-scramble><span class="title-inner">${esc(CONTACT.title)}</span></h2></div>
          <div class="contact-body">
            <p class="body" data-lines>${esc(CONTACT.body)}</p>
            <ul class="contact-links">${links}</ul>
          </div>
        </div>
        <footer class="colophon">
          ${rule}
          <span class="mono" data-fade>${esc(CONTACT.built)}</span>
          <a class="to-top mono" href="#intro" data-to-top data-cursor="link" data-fade>Back to top<span class="to-top-line" aria-hidden="true"></span></a>
          <span class="mono colophon-place" data-fade>${esc(CONTACT.place)}<span data-clock></span></span>
        </footer>
      </section>`;
}

/** Everything inside <body> except the module script. */
export function renderBody(): string {
  return `
    <a class="skip" href="#main">Skip to content</a>
    <canvas class="scene-canvas" data-scene aria-hidden="true"></canvas>
    <div class="shade" aria-hidden="true"></div>
    ${hud()}
    <main class="page" id="main">${intro()}${work()}${experience()}${stack()}${contact()}
    </main>`;
}

/** <title>, description, Open Graph and structured data. */
export function renderMeta(): string {
  const description = INTRO.lead;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: META.name,
    url: LINKS.site,
    image: META.ogImage,
    jobTitle: META.jobTitle,
    worksFor: {
      '@type': 'GovernmentOrganization',
      name: 'GovTech Singapore',
      url: 'https://www.tech.gov.sg/',
    },
    alumniOf: {
      '@type': 'CollegeOrUniversity',
      name: 'Nanyang Polytechnic',
      url: 'https://www.nyp.edu.sg/',
    },
    address: { '@type': 'PostalAddress', addressCountry: 'SG' },
    knowsAbout: SKILLS.flatMap((g) => g.items),
    sameAs: [LINKS.github, LINKS.linkedin],
  };

  return `
    <title>${esc(META.title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${LINKS.site}" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="${esc(META.name)}" />
    <meta property="og:title" content="${esc(META.title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${LINKS.site}" />
    <meta property="og:image" content="${META.ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(META.name)}, set in wide type over a monochrome point cloud" />
    <meta property="og:locale" content="${META.locale}" />
    <meta property="profile:first_name" content="Alexius" />
    <meta property="profile:last_name" content="Lee" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(META.title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${META.ogImage}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
}

/**
 * Runs before first paint on every page: resolves the theme and the motion
 * preference so nothing flashes, and marks the document as scripted so the
 * reveal styles only ever hide content when a script is there to show it.
 * If the main module never boots, the failsafe un-hides everything.
 */
export const BOOT_SCRIPT = `
    <script>
      (function () {
        var root = document.documentElement;
        var theme = null, motion = null;
        try {
          theme = localStorage.getItem('portfolio-theme');
          motion = localStorage.getItem('portfolio-motion');
        } catch (e) {}
        var dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
        root.dataset.theme = dark ? 'dark' : 'light';
        var reduce = motion === 'reduce' || (motion !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);
        root.dataset.motion = reduce ? 'reduce' : 'full';
        root.classList.add('js');
        setTimeout(function () {
          if (!root.hasAttribute('data-booted')) root.classList.remove('js');
        }, 5000);
      })();
    </script>`;

export const FONT_PRELOAD = `
    <link rel="preload" href="/fonts/anybody-var.woff2" as="font" type="font/woff2" crossorigin />`;
