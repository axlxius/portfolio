import gsap from 'gsap';

import { clamp, finePointer, qs, qsa } from '../core/env.ts';
import { motion } from '../core/motion.ts';
import type { Cursor } from '../ui/cursor.ts';

const SPRING = 95; // pull toward the target
const DRAG = 13; // velocity damping
const PERSONAL_SPACE = 12; // px of clear air between scattered words

interface Pill {
  node: HTMLElement;
  group: number;
  // Offset from the word's place in the list, and its velocity.
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Where it floats when scattered (also an offset from its list place).
  sx: number;
  sy: number;
  // Its box in the list, relative to the field.
  left: number;
  top: number;
  w: number;
  h: number;
  phase: number;
}

/**
 * The skills as a field of springy words.
 *
 * Every word is a real list item that stays in the DOM in list order; the
 * physics only ever adds a transform. Sorted, the words sit in their columns
 * and spring back when dragged. Scattered, they float as a loose cloud, keep
 * out of each other's way, and can be flicked around. Focusing a category
 * gathers its words and quietens the rest.
 */
export function createStackField(cursor: Cursor | null) {
  const field = qs('[data-field]');
  const toggle = qs<HTMLButtonElement>('[data-field-toggle]');
  const hint = qs('[data-field-hint]');
  const groupsBox = qs('.groups', field ?? document);
  if (!field || !toggle || !groupsBox) return;

  const groups = qsa('[data-group]', field);
  const pills: Pill[] = qsa('[data-pill]', field).map((node, i) => ({
    node,
    group: Number(node.closest<HTMLElement>('[data-group]')?.dataset.group ?? 0),
    x: 0, y: 0, vx: 0, vy: 0, sx: 0, sy: 0, left: 0, top: 0, w: 0, h: 0,
    phase: i * 1.7,
  }));

  let scattered = false;
  let focus = -1;
  let held: Pill | null = null;
  let grab = { x: 0, y: 0 };
  let last = { x: 0, y: 0, t: 0 };
  let visible = false;
  let asleep = true;
  let bounds = { w: 0, h: 0 };

  function measure() {
    const box = groupsBox!.getBoundingClientRect();
    bounds = { w: box.width, h: box.height };
    for (const p of pills) {
      // Measure the list position, not the transformed one.
      const r = p.node.getBoundingClientRect();
      p.left = r.left - p.x - box.left;
      p.top = r.top - p.y - box.top;
      p.w = r.width;
      p.h = r.height;
    }
  }

  /** Give every word a place to float: a loose grid with some jitter. */
  function scatter() {
    const order = pills.map((_, i) => i).sort((a, b) => Math.sin(a * 12.9898) - Math.sin(b * 78.233));
    const cols = Math.max(2, Math.round(bounds.w / 210));
    const rows = Math.ceil(pills.length / cols);
    order.forEach((index, slot) => {
      const p = pills[index];
      const cx = ((slot % cols) + 0.5 + (Math.random() - 0.5) * 0.5) / cols;
      const cy = (Math.floor(slot / cols) + 0.5 + (Math.random() - 0.5) * 0.5) / rows;
      p.sx = clamp(cx * bounds.w - p.w / 2, 0, bounds.w - p.w) - p.left;
      p.sy = clamp(cy * bounds.h - p.h / 2, 0, bounds.h - p.h) - p.top;
    });
  }

  function wake() {
    asleep = false;
  }

  function setLive(live: boolean) {
    field!.classList.toggle('is-live', live);
    toggle!.hidden = !live;
    if (hint) {
      hint.hidden = !live;
      hint.textContent = finePointer ? 'Drag a word. It finds its way back.' : 'Scatter them, then flick.';
    }
    if (!live) {
      setScattered(false);
      pills.forEach((p) => {
        p.x = p.y = p.vx = p.vy = 0;
        p.node.style.transform = '';
      });
    }
  }

  function setScattered(next: boolean) {
    scattered = next;
    field!.classList.toggle('is-scattered', next);
    toggle!.setAttribute('aria-pressed', String(next));
    toggle!.textContent = next ? 'Sort' : 'Scatter';
    if (next) {
      measure();
      scatter();
    }
    wake();
  }

  function setFocus(next: number) {
    focus = next;
    field!.classList.toggle('has-focus', next >= 0);
    groups.forEach((g, i) => {
      g.classList.toggle('is-focus', i === next);
      g.querySelector('button')?.setAttribute('aria-pressed', String(i === next));
    });
    wake();
  }

  toggle.addEventListener('click', () => setScattered(!scattered));

  groups.forEach((group, i) => {
    const button = group.querySelector<HTMLButtonElement>('[data-group-toggle]');
    if (!button) return;
    if (finePointer) {
      button.addEventListener('pointerenter', () => setFocus(i));
      button.addEventListener('pointerleave', () => setFocus(-1));
    }
    // Keyboard and touch toggle, so the focus is reachable without hover. A
    // mouse click is ignored: hovering has already done the job.
    button.addEventListener('click', (event) => {
      if (finePointer && event.detail > 0) return;
      setFocus(focus === i ? -1 : i);
    });
    button.addEventListener('blur', () => finePointer && setFocus(-1));
  });

  // --- Dragging ------------------------------------------------------------------
  for (const p of pills) {
    p.node.addEventListener('pointerdown', (event) => {
      if (motion.reduced || event.button !== 0) return;
      // On touch, the sorted list must stay scrollable: drag only when scattered.
      if (event.pointerType !== 'mouse' && !scattered) return;
      event.preventDefault();
      held = p;
      grab = { x: event.clientX - p.x, y: event.clientY - p.y };
      last = { x: event.clientX, y: event.clientY, t: performance.now() };
      p.vx = p.vy = 0;
      p.node.classList.add('is-held');
      p.node.setPointerCapture(event.pointerId);
      cursor?.setOverride('held');
      wake();
    });

    p.node.addEventListener('pointermove', (event) => {
      if (held !== p) return;
      const now = performance.now();
      const dt = Math.max(1, now - last.t) / 1000;
      // Velocity is tracked while dragging so a release becomes a throw.
      p.vx = p.vx * 0.6 + ((event.clientX - last.x) / dt) * 0.4;
      p.vy = p.vy * 0.6 + ((event.clientY - last.y) / dt) * 0.4;
      last = { x: event.clientX, y: event.clientY, t: now };
      p.x = event.clientX - grab.x;
      p.y = event.clientY - grab.y;
    });

    const release = () => {
      if (held !== p) return;
      held = null;
      p.node.classList.remove('is-held');
      cursor?.setOverride(null);
      p.vx = clamp(p.vx, -1600, 1600);
      p.vy = clamp(p.vy, -1600, 1600);
      if (scattered) {
        // A scattered word stays roughly where it is thrown.
        p.sx = clamp(p.left + p.x + p.vx * 0.18, 0, bounds.w - p.w) - p.left;
        p.sy = clamp(p.top + p.y + p.vy * 0.18, 0, bounds.h - p.h) - p.top;
      }
      wake();
    };
    p.node.addEventListener('pointerup', release);
    p.node.addEventListener('pointercancel', release);
    p.node.addEventListener('lostpointercapture', release);
  }

  // --- Simulation ------------------------------------------------------------------
  gsap.ticker.add((time, deltaMs) => {
    if (!visible || asleep || motion.reduced) return;
    const dt = Math.min(deltaMs / 1000, 0.032);
    let energy = 0;

    // The centre of the focused category, to gather its words toward.
    let fx = 0, fy = 0, fn = 0;
    if (focus >= 0) {
      for (const p of pills) {
        if (p.group !== focus) continue;
        fx += p.left + (scattered ? p.sx : 0) + p.w / 2;
        fy += p.top + (scattered ? p.sy : 0) + p.h / 2;
        fn++;
      }
      fx /= fn || 1;
      fy /= fn || 1;
    }

    for (const p of pills) {
      if (p === held) {
        energy += 1;
        p.node.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) rotate(${clamp(p.vx * 0.004, -6, 6).toFixed(2)}deg)`;
        continue;
      }

      let tx = scattered ? p.sx : 0;
      let ty = scattered ? p.sy : 0;
      if (scattered) {
        // A slow bob, so the cloud never quite sits still.
        tx += Math.sin(time * 0.5 + p.phase) * 7;
        ty += Math.cos(time * 0.42 + p.phase * 1.3) * 7;
      }
      if (focus >= 0 && p.group === focus) {
        const pull = scattered ? 0.72 : 0.14;
        tx += (fx - (p.left + tx + p.w / 2)) * pull;
        ty += (fy - (p.top + ty + p.h / 2)) * pull;
      }

      let ax = (tx - p.x) * SPRING - p.vx * DRAG;
      let ay = (ty - p.y) * SPRING - p.vy * DRAG;

      // Scattered words keep out of each other's way.
      if (scattered) {
        for (const q of pills) {
          if (q === p) continue;
          const dx = p.left + p.x + p.w / 2 - (q.left + q.x + q.w / 2);
          const dy = p.top + p.y + p.h / 2 - (q.top + q.y + q.h / 2);
          const overlapX = (p.w + q.w) / 2 + PERSONAL_SPACE - Math.abs(dx);
          const overlapY = (p.h + q.h) / 2 + PERSONAL_SPACE - Math.abs(dy);
          if (overlapX > 0 && overlapY > 0) {
            // Push apart along the axis of least overlap.
            if (overlapY < overlapX) ay += Math.sign(dy || 1) * overlapY * 60;
            else ax += Math.sign(dx || 1) * overlapX * 60;
          }
        }
      }

      p.vx += ax * dt;
      p.vy += ay * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      energy += Math.abs(p.vx) + Math.abs(p.vy) + Math.abs(tx - p.x) + Math.abs(ty - p.y);

      const lean = clamp(p.vx * 0.004, -6, 6);
      p.node.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) rotate(${lean.toFixed(2)}deg)`;
    }

    // Sorted and at rest: clear the transforms and stop simulating.
    if (!scattered && focus < 0 && !held && energy < 0.6) {
      pills.forEach((p) => {
        p.x = p.y = p.vx = p.vy = 0;
        p.node.style.transform = '';
      });
      asleep = true;
    }
  });

  new IntersectionObserver((entries) => (visible = entries[0].isIntersecting)).observe(field);
  window.addEventListener('resize', () => {
    measure();
    if (scattered) scatter();
    wake();
  }, { passive: true });
  document.fonts.ready.then(measure);

  measure();
  setLive(!motion.reduced);
  motion.onChange((reduced) => setLive(!reduced));
}
