/**
 * Static markup for the home page, generated from src/data/content.ts.
 *
 * These are plain string templates with no DOM access, because they run inside
 * the Vite config at build time. The result is injected into index.html, so the
 * shipped page has all of its text before any script runs, and reads top to
 * bottom with no script at all. src/fx/ adds the motion on top.
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
  TICKER,
  WORK_TITLE,
} from '../data/content.ts';
import type { Project } from '../data/content.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pad2 = (n: number) => String(n).padStart(2, '0');

const ARROW = `<svg class="arrow" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" aria-hidden="true"><path d="M6 18 18 6M9 6h9v9"/></svg>`;
const DOWN = `<svg class="arrow" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" aria-hidden="true"><path d="M12 4v15M6 13l6 6 6-6"/></svg>`;

/** The first four-digit year in a date range. */
export const yearOf = (dates: string) => dates.match(/\d{4}/)?.[0] ?? dates;

const chips = (items: readonly string[]) =>
  items.length ? `<ul class="chips">${items.map((t) => `<li class="chip">${esc(t)}</li>`).join('')}</ul>` : '';

// --- Top: the ticker and the bar ---------------------------------------------------

function top(): string {
  const run = TICKER.map((t) => `<span class="ticker-item">${esc(t)}</span>`).join('');
  const nav = SECTIONS.slice(1)
    .map((s) => `<li><a class="bar-link" href="#${s.id}" data-nav="${s.id}">${esc(s.label)}</a></li>`)
    .join('');
  return `
    <header class="top">
      <div class="ticker" data-ticker aria-hidden="true"><div class="ticker-run">${run}</div></div>
      <nav class="bar" aria-label="Sections">
        <a class="wordmark" href="#intro"><span class="wordmark-mark" aria-hidden="true">AL</span><span class="wordmark-name">${esc(META.name)}</span></a>
        <ul class="bar-links">${nav}</ul>
        <div class="bar-prefs">
          <button class="block pref" type="button" data-palette-toggle><span class="swatch" aria-hidden="true"></span><span>Colour</span></button>
          <button class="block pref" type="button" data-motion-toggle aria-pressed="false">Motion</button>
        </div>
      </nav>
    </header>`;
}

// --- Intro -------------------------------------------------------------------------

function intro(): string {
  const [first, ...rest] = INTRO.name.split(' ');
  return `
      <section class="hero" id="intro" aria-labelledby="intro-title">
        <h1 class="hero-name heavy" id="intro-title" data-hero-name>
          <span class="hero-line" data-hero-line>${esc(first)}</span>
          <span class="hero-line" data-hero-line>${esc(rest.join(' '))}</span>
        </h1>
        <div class="hero-foot">
          <p class="lead" data-pop>${esc(INTRO.short)}</p>
          <div class="hero-side" data-pop>
            ${chips(INTRO.tags)}
            <p class="hero-ctas">
              <a class="block" href="#work">See the work ${DOWN}</a>
              <a class="block block--alt" href="#contact">Get in touch</a>
            </p>
          </div>
        </div>
      </section>`;
}

// --- Work ----------------------------------------------------------------------------

/** The best page that exists for a project, and how to label the way there. */
function projectLink(p: Project): { href: string; label: string } | null {
  if (p.writeUp) return { href: p.writeUp, label: 'Read the write-up' };
  if (p.repo) return { href: p.repo, label: 'See the code' };
  if (p.live) return { href: p.live, label: 'Visit' };
  return null;
}

function work(): string {
  const items = PROJECTS.map((p, i) => {
    const link = projectLink(p);
    const external = link !== null && /^https?:/.test(link.href);
    const title = link
      ? `<a class="slab-link" href="${esc(link.href)}"${external ? ' rel="noreferrer"' : ''}>${esc(p.title)}</a>`
      : esc(p.title);
    return `
          <li class="slab-item" data-slab="${i}">
           <div class="slab${link ? ' is-linked' : ''}">
            <p class="slab-top mono"><span>${pad2(i + 1)} / ${pad2(PROJECTS.length)}</span><span>${esc(p.year)}</span></p>
            <h3 class="slab-title heavy">${title}</h3>
            <p class="slab-note">${esc(p.note)}</p>
            ${chips(p.tech)}
            <p class="slab-foot mono">${p.context ? `<span>${esc(p.context)}</span>` : '<span></span>'}<span class="slab-go">${link ? `${esc(link.label)} ${ARROW}` : 'Write-up coming'}</span></p>
           </div>
          </li>`;
  }).join('');

  return `
      <section class="section" id="work" aria-labelledby="work-title">
        <div class="section-head">
          <h2 class="section-title heavy" id="work-title" data-slam>${esc(WORK_TITLE)}</h2>
          <p class="count heavy" aria-hidden="true"><span data-count="${pad2(PROJECTS.length)}">${pad2(PROJECTS.length)}</span></p>
        </div>
        <ol class="slabs">${items}
        </ol>
      </section>`;
}

// --- Experience --------------------------------------------------------------------------

function experience(): string {
  const rows = ROLES.map(
    (r) => `
          <li class="role" data-role>
            <p class="role-year heavy" aria-hidden="true"><span data-roll="${esc(yearOf(r.dates))}">${esc(yearOf(r.dates))}</span></p>
            <div class="role-body">
              <p class="mono role-dates">${esc(r.dates)}</p>
              <h3 class="role-title">${esc(r.title)}</h3>
              ${chips(r.skills)}
            </div>
          </li>`
  ).join('');

  return `
      <section class="section" id="experience" aria-labelledby="experience-title">
        <div class="section-head">
          <h2 class="section-title heavy" id="experience-title" data-slam>${esc(LABELS.experience)}</h2>
        </div>
        <ol class="roles">${rows}
        </ol>
      </section>`;
}

// --- Toolkit ------------------------------------------------------------------------------

function stack(): string {
  const bands = SKILLS.map(
    (g, i) => `
          <div class="band band--${i % 4}" data-band="${i % 2 ? -1 : 1}">
            <h3 class="band-name mono">${esc(g.name)}</h3>
            <div class="band-track"><ul class="band-list heavy">${g.items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>
          </div>`
  ).join('');

  return `
      <section class="section" id="stack" aria-labelledby="stack-title">
        <div class="section-head">
          <h2 class="section-title heavy" id="stack-title" data-slam>${esc(LABELS.stack)}</h2>
        </div>
        <div class="bands">${bands}
        </div>
      </section>`;
}

// --- Contact and credits ---------------------------------------------------------------------

function contact(): string {
  const links = CONTACT.links
    .map((l) => {
      const external = l.kind === 'external' ? ' rel="noreferrer"' : '';
      return `<li><a class="block block--big" href="${esc(l.href)}"${external} data-kind="${l.kind}">${esc(l.label)} ${ARROW}</a></li>`;
    })
    .join('');
  const education = EDUCATION.map(
    (e) => `<li>${esc(e.text)}${e.honour ? `<span class="credit-note">${esc(e.honour)}</span>` : ''}</li>`
  ).join('');
  const certs = CERTIFICATIONS.map((c) => `<li>${esc(c.name)}<span class="credit-note">${esc(c.issuer)}</span></li>`).join(
    ''
  );

  return `
      <section class="section contact" id="contact" aria-labelledby="contact-title">
        <h2 class="contact-title heavy" id="contact-title" data-slam>${esc(CONTACT.title)}</h2>
        <p class="lead contact-body" data-pop>${esc(CONTACT.body)}</p>
        <ul class="contact-links" data-pop>${links}</ul>
        <div class="credits">
          <div class="credit" data-pop><h3 class="mono credit-head">Education</h3><ul>${education}</ul></div>
          <div class="credit" data-pop><h3 class="mono credit-head">Certifications</h3><ul>${certs}</ul></div>
        </div>
      </section>
      <footer class="foot mono">
        <span>${esc(CONTACT.built)}</span>
        <span>${esc(CONTACT.place)} <span data-clock></span></span>
        <a class="foot-top" href="#intro">Back to top</a>
      </footer>`;
}

/** Everything inside <body> except the module script. */
export function renderBody(): string {
  return `
    <a class="skip" href="#main">Skip to content</a>
    ${top()}
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
    <meta property="og:image:alt" content="${esc(META.name)}, set in heavy type on cream" />
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
 * Runs before first paint on every page: resolves the palette and the motion
 * preference so nothing flashes, and marks the document as scripted so the
 * reveal styles only ever hide content when a script is there to show it.
 * If the main module never boots, the failsafe un-hides everything.
 */
export const BOOT_SCRIPT = `
    <script>
      (function () {
        var root = document.documentElement;
        var palette = null, motion = null;
        try {
          palette = localStorage.getItem('portfolio-palette');
          motion = localStorage.getItem('portfolio-motion');
        } catch (e) {}
        if (palette !== 'cream' && palette !== 'night' && palette !== 'lilac') {
          palette = matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'cream';
        }
        root.dataset.palette = palette;
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
