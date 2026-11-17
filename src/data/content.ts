/**
 * Everything a visitor reads, in one typed file.
 *
 * The page markup is generated from this at build time (see vite.config.ts and
 * src/markup/page.ts), so the HTML that ships already contains the text and
 * reads fine with JavaScript or WebGL switched off. Edit copy here and nowhere
 * else. Role and project copy mirrors the resume: keep the two in step.
 */

// --- Links -------------------------------------------------------------------

/** Placeholder for a link that does not exist yet. Nothing renders for it. */
export const TODO = null;

export const LINKS = {
  site: 'https://alexius-lee.vercel.app/',
  email: 'alex888ius@gmail.com',
  github: 'https://github.com/axlxius',
  linkedin: 'https://www.linkedin.com/in/alexius-lee-79461b307/',
  // public/resume.pdf is the web copy with the phone number removed.
  resume: './resume.pdf',
} as const;

// --- Types -------------------------------------------------------------------

/** The generative visual a project uses; see src/visuals/. */
export type VisualId = 'site' | 'dashboard' | 'copilot' | 'growcery' | 'housing' | 'clinic';

export interface Project {
  slug: string;
  title: string;
  note: string;
  year: string;
  visual: VisualId;
  /** Where the project came from, if stated in its write-up. */
  context?: string;
  /** Tools named in the project's write-up. Leave empty rather than guess. */
  tech: string[];
  /** Path of the long-form page under /work/, if one exists. */
  writeUp: string | null;
  live: string | null;
  repo: string | null;
}

export interface Role {
  dates: string;
  title: string;
  body: string;
  /** Skills used, drawn only from the Stack lists below. */
  skills: string[];
}

export interface SkillGroup {
  name: string;
  items: string[];
}

// --- Meta --------------------------------------------------------------------

export const META = {
  title: 'Alexius Lee — Business and Financial Technology',
  name: 'Alexius Lee',
  locale: 'en_SG',
  ogImage: 'https://alexius-lee.vercel.app/og-image.png',
  jobTitle: 'Product Management Intern',
} as const;

// --- Intro -------------------------------------------------------------------

export const INTRO = {
  name: 'Alexius Lee',
  lead:
    'Business and financial technology student at Nanyang Polytechnic, currently interning at GovTech. I build data dashboards and full-stack tools, and I enjoy tinkering with new ways to solve old problems.',
  /** The one line that survives on the title card. */
  short: 'I build data dashboards and full-stack tools, and I enjoy tinkering with new ways to solve old problems.',
  tags: ['Business and financial technology', 'Based in Singapore', 'Open to work'],
  cue: 'Scroll to play',
} as const;

// --- Selected work -----------------------------------------------------------

export const WORK_TITLE = 'Selected work';

export const PROJECTS: Project[] = [
  {
    slug: 'this-site',
    title: 'This Site',
    note: 'The site you are on. One Three.js object that reforms into a different shape for every section.',
    year: '2026',
    visual: 'site',
    context: 'Personal project',
    tech: ['Three.js', 'GLSL', 'TypeScript', 'GSAP', 'Lenis', 'Vite'],
    writeUp: null,
    live: LINKS.site,
    repo: 'https://github.com/axlxius/portfolio',
  },
  {
    slug: 'portfolio-dashboard',
    title: 'Portfolio Dashboard',
    note: 'Streamlit dashboard tracking a Singapore multi-asset book, with live broker pricing and labelled fallbacks.',
    year: '2026',
    visual: 'dashboard',
    context: 'Personal project',
    tech: ['Python', 'Streamlit', 'pandas', 'Moomoo OpenD API'],
    writeUp: './work/portfolio-dashboard/',
    live: TODO,
    repo: TODO,
  },
  {
    slug: 'sci-copilot',
    title: 'SCI Copilot',
    note: 'Copilot for insurance agents: knowledge retrieval, compliance checks and document drift detection, as an installable PWA.',
    year: '2026',
    visual: 'copilot',
    context: 'Business Innovation Project, Nanyang Polytechnic',
    tech: ['React', 'Vite', 'Supabase', 'Capacitor'],
    writeUp: './work/sci-copilot/',
    live: TODO,
    repo: TODO,
  },
  {
    slug: 'growcerysg',
    title: 'GrowcerySG',
    note: 'Urban farming marketplace with produce trading, carbon footprint tracking and gamified sustainability tasks.',
    year: '2026',
    visual: 'growcery',
    context: 'Business Application Development, Nanyang Polytechnic (team project)',
    tech: ['C#', 'ASP.NET Web Forms', 'SQL Server', 'JavaScript', 'WebSockets'],
    writeUp: './work/growcerysg/',
    live: TODO,
    repo: TODO,
  },
  {
    slug: 'housing-and-fertility',
    title: 'Housing and Fertility',
    note: "Tableau study linking HDB resale prices and median income to Singapore's falling fertility rate.",
    year: '2025',
    visual: 'housing',
    context: 'Business Analytics Project, Nanyang Polytechnic',
    tech: ['Tableau'],
    writeUp: './work/housing-and-fertility/',
    live: TODO,
    repo: TODO,
  },
  {
    slug: 'pay2live',
    title: 'pay2live',
    note: 'Modular web app for clinic operations, with scheduling, WhatsApp OTP and real-time notifications.',
    year: '2025',
    visual: 'clinic',
    // No write-up yet, so nothing is claimed about its context or tools.
    tech: [],
    writeUp: null,
    live: TODO,
    repo: TODO,
  },
];

// --- Experience ----------------------------------------------------------------

export const EXPERIENCE_TITLE = 'Experience';

export const ROLES: Role[] = [
  {
    dates: '2026 to now',
    title: 'Product Management Intern, GovTech',
    body: 'Carry out IT audit and compliance checks across internal systems. Design screens in Figma, build the front-end features, and run user acceptance testing, passing findings back to engineering.',
    skills: ['IT audit and compliance', 'Figma', 'User acceptance testing'],
  },
  {
    dates: '2025 to 2026',
    title: 'Sales Account Manager, SME Sales, Veritas Organisation',
    body: 'Owned a portfolio of SME energy clients from first call to renewal, with consistently high conversion. Ran a heavy calendar of residential roadshows and cold outreach campaigns to keep the pipeline full.',
    skills: ['Key account management', 'Lead sourcing', 'Sales presentations'],
  },
  {
    dates: '2023 to 2024',
    title: 'Receptionist, FriendsGolf Singapore. Usher, National Gallery Singapore',
    body: 'Front desk, payments, visitor guidance and event setup, worked alongside full-time study.',
    // Nothing in the Stack lists maps to these roles, so no tag line shows.
    skills: [],
  },
];

// --- Stack ---------------------------------------------------------------------

export const STACK_TITLE = 'What I work in';

export const SKILLS: SkillGroup[] = [
  {
    name: 'Build',
    items: ['Python', 'JavaScript', 'React', 'C# and ASP.NET', 'Flask and Streamlit', 'HTML, CSS and SQL'],
  },
  {
    name: 'Data',
    items: ['Tableau', 'pandas', 'Business statistics', 'Data analysis', 'Data visualisation'],
  },
  {
    name: 'Tools',
    items: ['Figma', 'Git', 'Supabase', 'MongoDB and SQL Server', 'Vite and Capacitor', 'Tailwind CSS'],
  },
  {
    name: 'Product and business',
    items: [
      'User acceptance testing',
      'IT audit and compliance',
      'Key account management',
      'Lead sourcing',
      'Sales presentations',
    ],
  },
];

export const EDUCATION = [
  {
    text: 'Diploma in Business and Financial Technology, Nanyang Polytechnic',
    honour: "Director's List, Year 3 Semester 1",
  },
  { text: 'Common ICT Programme, Nanyang Polytechnic', honour: null },
  { text: 'O Levels, Beatty Secondary School', honour: null },
] as const;

export const CERTIFICATIONS = [
  { name: 'JavaScript and Python', issuer: 'HackerRank' },
  { name: 'Cybersecurity Fundamentals', issuer: 'IBM' },
  { name: 'Web Development Fundamentals', issuer: 'IBM' },
] as const;

// --- Contact -------------------------------------------------------------------

export const CONTACT = {
  title: 'Get in touch',
  body: 'I am open to work and I read everything that arrives. Email reaches me fastest.',
  links: [
    { label: 'Email', href: `mailto:${LINKS.email}`, kind: 'email' },
    { label: 'GitHub', href: LINKS.github, kind: 'external' },
    { label: 'LinkedIn', href: LINKS.linkedin, kind: 'external' },
    { label: 'Resume', href: LINKS.resume, kind: 'file' },
  ],
  built: 'Built with Three.js and Vite',
  place: 'Singapore',
} as const;

// --- Marquee -------------------------------------------------------------------

export const MARQUEE = ['Business', 'Technology', 'Finance', 'Data'] as const;

// --- Scene labels ----------------------------------------------------------------

/** Small headings for the scenes that have no display title of their own. */
export const LABELS = {
  experience: 'Experience',
  stack: 'Toolkit',
  credits: 'Credits',
} as const;

// --- Sections ------------------------------------------------------------------

/** Section ids and header labels, in page order. One morph state each. */
export const SECTIONS = [
  { id: 'intro', label: 'Intro' },
  { id: 'work', label: 'Work' },
  { id: 'experience', label: 'Experience' },
  { id: 'stack', label: 'Toolkit' },
  { id: 'contact', label: 'Contact' },
] as const;
