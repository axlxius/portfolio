import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Reads the palettes straight from the stylesheet, so the check covers what ships.
const css = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');

function palettes(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const m of css.matchAll(/:root\[data-palette='([a-z]+)'\]\s*\{([^}]*)\}/g)) {
    const vars: Record<string, string> = {};
    for (const v of m[2].matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/g)) vars[v[1]] = v[2];
    out[m[1]] = vars;
  }
  return out;
}

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Text on each surface, and the ink on the page.
const PAIRS: Array<[string, string]> = [
  ['ink', 'bg'],
  ['on-accent', 'accent'],
  ['on-second', 'second'],
  ['on-cell', 'cell'],
  ['on-card', 'card'],
  ['bg', 'ink'], // inverted blocks and hovered slabs
];

test('there are three palettes, with Cream first as the default', () => {
  assert.deepEqual(Object.keys(palettes()), ['cream', 'night', 'lilac']);
  assert.match(css, /:root,\s*:root\[data-palette='cream'\]/);
});

test('every text pairing in every palette reaches WCAG AA (4.5:1)', () => {
  for (const [name, p] of Object.entries(palettes())) {
    for (const [fg, bg] of PAIRS) {
      assert.ok(p[fg] && p[bg], `${name} is missing --${fg} or --${bg}`);
      const r = ratio(p[fg], p[bg]);
      assert.ok(r >= 4.5, `${name}: --${fg} on --${bg} is ${r.toFixed(2)}:1`);
    }
  }
});
