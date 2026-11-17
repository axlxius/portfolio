import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PROJECTS, ROLES, SECTIONS, SKILLS } from '../src/data/content.ts';
import { renderBody, renderMeta } from '../src/markup/page.ts';
import { BANDS, ROLES as ROLE_SEGMENTS, STATE_COUNT } from '../src/scene/shapes.ts';

test('the scene has a band per project and a segment per role', () => {
  assert.equal(PROJECTS.length, BANDS, 'change BANDS in src/scene/shapes.ts to match the project list');
  assert.equal(ROLES.length, ROLE_SEGMENTS, 'change ROLES in src/scene/shapes.ts to match the role list');
});

test('one morph state per section, plus the closing line', () => {
  assert.equal(SECTIONS.length + 1, STATE_COUNT);
});

test('role skills come only from the Stack lists', () => {
  const known = new Set(SKILLS.flatMap((g) => g.items));
  for (const role of ROLES) {
    for (const skill of role.skills) assert.ok(known.has(skill), `"${skill}" is not in the Stack lists`);
  }
});

test('project slugs are unique', () => {
  assert.equal(new Set(PROJECTS.map((p) => p.slug)).size, PROJECTS.length);
});

test('the generated page contains every piece of copy', () => {
  const html = renderBody();
  const text = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  for (const project of PROJECTS) {
    assert.ok(html.includes(text(project.title)));
    assert.ok(html.includes(text(project.note)));
  }
  for (const role of ROLES) {
    assert.ok(html.includes(text(role.title)));
    assert.ok(html.includes(text(role.body)));
  }
  for (const group of SKILLS) for (const item of group.items) assert.ok(html.includes(text(item)));
  for (const section of SECTIONS) assert.ok(html.includes(`id="${section.id}"`));
});

test('headings are in order: one h1, then h2 per section, h3 beneath', () => {
  const levels = [...renderBody().matchAll(/<h([1-6])/g)].map((m) => Number(m[1]));
  assert.equal(levels.filter((l) => l === 1).length, 1);
  assert.equal(levels[0], 1);
  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i] - levels[i - 1] <= 1, 'a heading level is skipped');
  }
});

test('meta carries a title, a description and valid structured data', () => {
  const meta = renderMeta();
  assert.match(meta, /<title>Alexius Lee — Business and Financial Technology<\/title>/);
  assert.match(meta, /<meta name="description" content="[^"]{50,}"/);
  const json = meta.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  assert.ok(json);
  assert.equal(JSON.parse(json[1])['@type'], 'Person');
});
