import { PROJECTS } from '../data/content.ts';
import type { Project } from '../data/content.ts';
import { el, qs } from '../core/env.ts';
import { motion } from '../core/motion.ts';
import type { SmoothScroll } from '../scroll/smooth.ts';
import { createVisualRunner } from '../visuals/index.ts';

const ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg>`;

const pad2 = (n: number) => String(n + 1).padStart(2, '0');

/**
 * The full-screen project view. It opens from a work row with the project's
 * title travelling from the row to the heading (View Transitions, where the
 * browser has them), and closes with Esc, the close button, the browser's
 * back button, or a downward swipe.
 *
 * It behaves as a modal dialog: the page behind is made inert, focus moves in
 * and is returned to the row that opened it.
 */
export function createOverlay(scroll: SmoothScroll) {
  const root = el('div', 'overlay', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'overlay-title' });
  root.innerHTML = `
    <div class="overlay-inner">
      <div class="overlay-bar">
        <span class="mono" data-o-count></span>
        <button class="overlay-close" type="button" data-o-close data-cursor="link">Close <kbd>Esc</kbd></button>
      </div>
      <div class="overlay-text">
        <p class="mono" data-o-year></p>
        <h2 class="overlay-title" id="overlay-title" tabindex="-1" data-o-title></h2>
        <p class="lead overlay-note" data-o-note></p>
        <dl class="overlay-facts" data-o-facts></dl>
        <div class="overlay-links" data-o-links></div>
      </div>
      <div class="overlay-visual"><canvas aria-hidden="true"></canvas></div>
      <div class="overlay-foot">
        <button class="overlay-step" type="button" data-o-prev data-cursor="link"><span class="mono">Previous</span><span data-o-prev-name></span></button>
        <button class="overlay-step" type="button" data-o-next data-cursor="link"><span data-o-next-name></span><span class="mono">Next</span></button>
      </div>
    </div>`;
  document.body.append(root);

  const part = (name: string) => qs(`[data-o-${name}]`, root)!;
  const titleEl = part('title');
  const runner = createVisualRunner(qs<HTMLCanvasElement>('canvas', root)!);
  const page = [qs('.page'), qs('.chrome')];

  let index = -1;
  let opener: HTMLElement | null = null;
  let onClose: (() => void) | null = null;

  function fill(project: Project, i: number) {
    part('count').textContent = `${pad2(i)} / ${String(PROJECTS.length).padStart(2, '0')}`;
    part('year').textContent = project.year;
    titleEl.textContent = project.title;
    part('note').textContent = project.note;

    const facts = part('facts');
    facts.replaceChildren();
    const fact = (term: string, body: Node | string) => {
      const row = el('div');
      const dt = Object.assign(el('dt', 'mono'), { textContent: term });
      const dd = el('dd');
      dd.append(body);
      row.append(dt, dd);
      facts.append(row);
    };
    if (project.context) fact('Context', project.context);
    if (project.tech.length) {
      const list = el('ul', 'overlay-chips');
      project.tech.forEach((name) => list.append(Object.assign(el('li'), { textContent: name })));
      fact('Built with', list);
    }

    const links = part('links');
    links.replaceChildren();
    const link = (text: string, href: string | null) => {
      if (!href) return; // a TODO in content.ts: nothing to show yet
      const a = el('a', 'overlay-link', { href, 'data-cursor': 'link' });
      if (/^https?:/.test(href)) a.rel = 'noreferrer';
      a.innerHTML = `<span></span>${ARROW}`;
      a.firstElementChild!.textContent = text;
      links.append(a);
    };
    link('Read the write-up', project.writeUp);
    link('Visit', project.live);
    link('Source', project.repo);

    const prev = PROJECTS[(i - 1 + PROJECTS.length) % PROJECTS.length];
    const next = PROJECTS[(i + 1) % PROJECTS.length];
    part('prev-name').textContent = prev.title;
    part('next-name').textContent = next.title;

    runner.set(project.visual);
    root.scrollTop = 0;
  }

  /** Run a DOM change inside a view transition when one is available. */
  function transition(change: () => void, shared: HTMLElement | null) {
    const html = document.documentElement;
    if (motion.reduced || typeof document.startViewTransition !== 'function') {
      change();
      return;
    }
    // The row's title and the overlay's heading take turns holding the name.
    if (shared) shared.style.viewTransitionName = 'project-title';
    html.dataset.vt = 'overlay';
    const vt = document.startViewTransition(() => {
      if (shared) shared.style.viewTransitionName = '';
      change();
    });
    vt.finished.finally(() => {
      if (html.dataset.vt === 'overlay') delete html.dataset.vt;
      titleEl.style.viewTransitionName = '';
      if (shared) shared.style.viewTransitionName = '';
    });
  }

  function open(i: number, from: HTMLElement | null, closed?: () => void) {
    if (index >= 0) return;
    opener = from;
    onClose = closed ?? null;
    const rowTitle = from?.querySelector<HTMLElement>('.work-name') ?? null;

    transition(() => {
      index = i;
      fill(PROJECTS[i], i);
      titleEl.style.viewTransitionName = 'project-title';
      root.classList.add('is-open');
      page.forEach((node) => node?.setAttribute('inert', ''));
    }, rowTitle);

    scroll.lock(true);
    runner.start();
    history.pushState({ overlay: PROJECTS[i].slug }, '');
    titleEl.focus({ preventScroll: true });
  }

  function close(fromHistory = false) {
    if (index < 0) return;
    const rowTitle = opener?.querySelector<HTMLElement>('.work-name') ?? null;
    titleEl.style.viewTransitionName = 'project-title';

    transition(() => {
      titleEl.style.viewTransitionName = '';
      if (rowTitle) rowTitle.style.viewTransitionName = 'project-title';
      root.classList.remove('is-open');
      page.forEach((node) => node?.removeAttribute('inert'));
      index = -1;
    }, null);
    // The shared name is handed back to the row for the return trip.
    setTimeout(() => rowTitle && (rowTitle.style.viewTransitionName = ''), 900);

    scroll.lock(false);
    runner.stop();
    if (!fromHistory && history.state?.overlay) history.back();
    opener?.focus({ preventScroll: true });
    onClose?.();
    opener = null;
  }

  function step(delta: number) {
    if (index < 0) return;
    const next = (index + delta + PROJECTS.length) % PROJECTS.length;
    const change = () => {
      index = next;
      fill(PROJECTS[next], next);
    };
    if (motion.reduced || typeof document.startViewTransition !== 'function') change();
    else {
      document.documentElement.dataset.vt = 'overlay';
      document.startViewTransition(change).finished.finally(() => delete document.documentElement.dataset.vt);
    }
  }

  part('close').addEventListener('click', () => close());
  part('prev').addEventListener('click', () => step(-1));
  part('next').addEventListener('click', () => step(1));
  window.addEventListener('popstate', () => close(true));

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowRight') step(1);
    else if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'Tab') {
      // Keep focus inside the dialog.
      const focusable = Array.from(root.querySelectorAll<HTMLElement>('a[href], button')).filter((n) => n.offsetParent);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === titleEl)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  // Swipe down from the top of the sheet to close, on touch screens.
  let touchY: number | null = null;
  root.addEventListener('touchstart', (e) => (touchY = root.scrollTop <= 0 ? e.touches[0].clientY : null), { passive: true });
  root.addEventListener(
    'touchend',
    (e) => {
      if (touchY !== null && e.changedTouches[0].clientY - touchY > 110) close();
      touchY = null;
    },
    { passive: true }
  );

  return { open, close, get isOpen() { return index >= 0; }, refresh: () => runner.refresh() };
}

export type Overlay = ReturnType<typeof createOverlay>;
