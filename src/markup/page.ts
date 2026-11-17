/**
 * Static markup for the home page, generated from src/data/content.ts.
 *
 * These are plain string templates with no DOM access, because they run inside
 * the Vite config at build time. The result is injected into index.html, so the
 * shipped page has all of its text before any script runs. Behaviour is added
 * afterwards by the modules in src/sections/ and src/ui/.
 */
import {
  CERTIFICATIONS,
  CONTACT,
  EDUCATION,
  EXPERIENCE_TITLE,
  INTRO,
  LINKS,
  MARQUEE,
  META,
  PROJECTS,
  ROLES,
  SECTIONS,
  SKILLS,
  STACK_TITLE,
  WORK_TITLE,
} from '../data/content.ts';
import type { Project } from '../data/content.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pad2 = (n: number) => String(n).padStart(2, '0');

const ARROW = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg>`;

// A check inside a ring. Drawn on hover via stroke-dashoffset (see layout.css).
const SEAL = `<svg class="seal" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true"><circle class="seal-ring" cx="16" cy="16" r="13" pathLength="1"/><circle class="seal-dash" cx="16" cy="16" r="10" stroke-dasharray="1.2 3.2"/><path class="seal-check" d="m11 16.5 3.4 3.4L21.5 12.5" pathLength="1"/></svg>`;

const STAR = `<svg class="star" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M8 0c.5 4.6 3.4 7.5 8 8-4.6.5-7.5 3.4-8 8-.5-4.6-3.4-7.5-8-8 4.6-.5 7.5-3.4 8-8Z"/></svg>`;

const title = (text: string, attrs = '') =>
  `<div class="bleed"><h2 class="title" data-reveal${attrs}><span class="title-inner">${esc(text)}</span></h2></div>`;

const rule = `<span class="rule" aria-hidden="true"></span>`;

function chrome(): string {
  const links = SECTIONS.map(
    (s, i) => `<li><a href="#${s.id}" data-nav="${s.id}" data-count="${pad2(i + 1)}">${esc(s.label)}</a></li>`
  ).join('');
  return `
    <header class="chrome">
      <a class="wordmark" href="#intro" data-magnetic>${esc(META.name)}</a>
      <div class="chrome-right">
        <nav class="nav" aria-label="Sections" data-nav-root>
          <button class="nav-current" type="button" aria-expanded="false" aria-controls="nav-list" data-nav-current>
            <span class="visually-hidden">Sections. Current: </span>
            <span class="nav-roll" data-nav-roll><span>${esc(SECTIONS[0].label)}</span></span>
          </button>
          <ul class="nav-list" id="nav-list">${links}</ul>
        </nav>
        <button class="pref mono" type="button" data-motion-toggle aria-pressed="false" aria-label="Reduce motion">Motion</button>
        <button class="pref mono" type="button" data-sound-toggle aria-pressed="false" aria-label="Sound" data-off>Sound</button>
        <button class="toggle" type="button" data-theme-toggle data-magnetic aria-pressed="false">
          <span data-theme-label>Dark</span>
        </button>
      </div>
    </header>`;
}

function intro(): string {
  const tags = INTRO.tags.map((t) => `<li class="chip" data-fade>${esc(t)}</li>`).join('');
  return `
      <section class="section section--intro" id="intro" data-section="Intro" aria-labelledby="intro-title">
        <div class="bleed bleed--hero">
          <h1 class="display" id="intro-title" data-hero-name>${esc(INTRO.name)}</h1>
        </div>
        <div class="intro-body">
          <p class="lead" data-hero-lead>${esc(INTRO.lead)}</p>
          <ul class="chips" aria-label="At a glance" data-hero-tags>${tags}</ul>
          <p class="intro-scroll mono" data-hero-cue data-fade>
            <span>${esc(INTRO.cue)}</span>
            <span class="intro-scroll-line" aria-hidden="true"></span>
          </p>
        </div>
      </section>`;
}

/** Without JavaScript a row goes to the best page that exists for it. */
function projectHref(p: Project): string | null {
  return p.writeUp ?? p.repo ?? p.live;
}

function work(): string {
  const rows = PROJECTS.map((p, i) => {
    const href = projectHref(p);
    const external = href !== null && /^https?:/.test(href);
    const open = href
      ? `<a class="work-link" href="${esc(href)}"${external ? ' rel="noreferrer"' : ''}`
      : `<button class="work-link" type="button"`;
    const close = href ? '</a>' : '</button>';
    return `
          <li class="work-item" data-fade>
            ${open} data-project="${p.slug}" data-cursor="view">
              <span class="work-index mono" aria-hidden="true">${pad2(i + 1)}</span>
              <span class="work-name">${esc(p.title)}</span>
              <span class="work-note">${esc(p.note)}</span>
              <span class="work-year mono">${esc(p.year)}</span>
              <span class="work-arrow">${ARROW}</span>
            ${close}
            ${rule}
          </li>`;
  }).join('');

  return `
      <section class="section" id="work" data-section="Work" aria-labelledby="work-title">
        ${title(WORK_TITLE, ' id="work-title"')}
        <ol class="work-list" data-work-list>
          <li class="work-head" aria-hidden="true">${rule}</li>${rows}
        </ol>
      </section>`;
}

function marquee(): string {
  const run = MARQUEE.map((w) => `<span class="marquee-word">${esc(w)}</span><span class="marquee-x">×</span>`).join('');
  // Two identical runs so the track can loop without a visible seam.
  return `
      <div class="marquee" data-marquee aria-hidden="true">
        <div class="marquee-track" data-marquee-track>
          <div class="marquee-run">${run}</div>
          <div class="marquee-run">${run}</div>
        </div>
      </div>`;
}

function experience(): string {
  const roles = ROLES.map((r, i) => {
    const skills = r.skills.length
      ? `<p class="role-skills mono"><span class="visually-hidden">Skills used: </span>${r.skills
          .map(esc)
          .join('<span aria-hidden="true"> / </span><span class="visually-hidden">, </span>')}</p>`
      : '';
    return `
          <li class="role" data-role="${i}"${r.skills.length ? ' tabindex="0"' : ''}>
            ${rule}
            <p class="role-date mono" data-role-date data-fade>${esc(r.dates)}</p>
            <div class="role-main">
              <h3 class="role-title" data-lines>${esc(r.title)}</h3>
              <p class="role-body" data-lines>${esc(r.body)}</p>
              ${skills}
            </div>
          </li>`;
  }).join('');

  return `
      <section class="section" id="experience" data-section="Experience" aria-labelledby="experience-title">
        ${title(EXPERIENCE_TITLE, ' id="experience-title"')}
        <ol class="roles">${roles}
        </ol>
      </section>`;
}

function stack(): string {
  const groups = SKILLS.map((g, gi) => {
    const items = g.items
      .map((item) => `<li class="pill" data-pill data-cursor="drag"><span>${esc(item)}</span></li>`)
      .join('');
    return `
            <div class="group" data-group="${gi}" data-fade>
              <h3 class="group-name" id="group-${gi}">
                <button type="button" data-group-toggle aria-pressed="false">${esc(g.name)}</button>
              </h3>
              ${rule}
              <ul class="group-list" aria-labelledby="group-${gi}">${items}</ul>
            </div>`;
  }).join('');

  const education = EDUCATION.map(
    (e) =>
      `<li>${esc(e.text)}${
        e.honour ? `<span class="honour">${STAR}<span>${esc(e.honour)}</span></span>` : ''
      }</li>`
  ).join('');

  const certs = CERTIFICATIONS.map(
    (c) =>
      `<li class="cert">${SEAL}<span class="cert-name">${esc(c.name)}</span><span class="cert-issuer mono">${esc(c.issuer)}</span></li>`
  ).join('');

  return `
      <section class="section" id="stack" data-section="Stack" aria-labelledby="stack-title">
        ${title(STACK_TITLE, ' id="stack-title"')}
        <div class="field" data-field>
          <div class="field-bar" data-fade>
            <p class="field-hint mono" data-field-hint hidden>Drag a word. It finds its way back.</p>
            <button class="field-toggle mono" type="button" data-field-toggle aria-pressed="false" hidden>Scatter</button>
          </div>
          <div class="groups">${groups}
          </div>
        </div>
        <div class="credentials">
          <div class="credential" data-fade>
            <h3 class="group-name">Education</h3>
            ${rule}
            <ul class="cred-list">${education}</ul>
          </div>
          <div class="credential" data-fade>
            <h3 class="group-name">Certifications</h3>
            ${rule}
            <ul class="cred-list cred-list--certs">${certs}</ul>
          </div>
        </div>
      </section>`;
}

function contact(): string {
  const links = CONTACT.links
    .map((l) => {
      const external = l.kind === 'external' ? ' rel="noreferrer"' : '';
      return `<li data-fade><a class="contact-link" href="${esc(l.href)}"${external} data-kind="${l.kind}" data-magnetic data-cursor="link"><span>${esc(l.label)}</span></a></li>`;
    })
    .join('');

  return `
      <section class="section section--contact" id="contact" data-section="Contact" aria-labelledby="contact-title">
        ${title(CONTACT.title, ' id="contact-title" data-scramble')}
        <div class="contact-body">
          <p class="body" data-lines>${esc(CONTACT.body)}</p>
          <ul class="contact-links">${links}</ul>
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
    <canvas class="scene" data-scene aria-hidden="true"></canvas>
    <canvas class="dotgrid" data-dotgrid aria-hidden="true"></canvas>
    <div class="shade" aria-hidden="true"></div>
    ${chrome()}
    <main class="page" id="main">${intro()}${work()}${experience()}${marquee()}${stack()}${contact()}
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
    <link rel="preload" href="/fonts/archivo-var.woff2" as="font" type="font/woff2" crossorigin />`;
