import { qs } from '../core/env.ts';
import type { SmoothScroll } from '../scroll/smooth.ts';

const HOVERABLE = 'a, button, [data-pill], [data-project]';

/**
 * Optional sound, off until the visitor asks for it: a soft tick when the
 * pointer reaches something interactive, and a low drone whose level follows
 * the scroll speed. Everything is synthesised; there are no audio files.
 */
export function createSound(scroll: SmoothScroll) {
  const button = qs<HTMLButtonElement>('[data-sound-toggle]');
  if (!button) return null;

  let context: AudioContext | null = null;
  let droneGain: GainNode | null = null;
  let on = false;
  let lastTick = 0;
  let lastTarget: Element | null = null;

  function build() {
    context = new AudioContext();
    droneGain = context.createGain();
    droneGain.gain.value = 0;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    // Two slightly detuned sines a fifth apart: a quiet, steady hum.
    for (const frequency of [55, 82.6, 110.4]) {
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      osc.connect(filter);
      osc.start();
    }
    filter.connect(droneGain).connect(context.destination);
  }

  function tick() {
    if (!context || !on) return;
    const now = context.currentTime;
    if (now - lastTick < 0.05) return;
    lastTick = now;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1900, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.035);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(gain).connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  function paint() {
    button!.setAttribute('aria-pressed', String(on));
    button!.toggleAttribute('data-off', !on);
    button!.title = on ? 'Sound is on' : 'Turn sound on';
  }

  button.addEventListener('click', () => {
    on = !on;
    if (on && !context) build();
    if (on) void context?.resume();
    else void context?.suspend();
    paint();
    if (on) tick();
  });

  document.addEventListener(
    'pointerover',
    (event) => {
      if (!on) return;
      const target = (event.target as Element | null)?.closest(HOVERABLE) ?? null;
      if (target && target !== lastTarget) tick();
      lastTarget = target;
    },
    { passive: true }
  );

  paint();
  return {
    /** Call once per frame: the drone follows the scroll. */
    update() {
      if (!on || !context || !droneGain) return;
      const level = Math.min(Math.abs(scroll.velocity) / 40, 1) * 0.07;
      droneGain.gain.setTargetAtTime(level, context.currentTime, 0.25);
    },
  };
}
