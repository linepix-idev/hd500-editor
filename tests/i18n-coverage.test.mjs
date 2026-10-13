import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVisibleStrings, needsTranslation } from '../tools/i18n/check-coverage.mjs';

test('coverage scans visible text and dialog/menu labels without collecting implementation strings', () => {
  const source = `
    // h('p', {}, 'Comment is not visible')
    h('button', {class: 'css-class', title: 'Helpful title', 'aria-label': 'Accessible name',
      placeholder: 'Search here', onClick: () => api('internal-endpoint', {op: 'internal-op'})},
      icon('internal-icon'), enabled ? 'Turn on' : 'Turn off', h('span', {}, 'Nested text'));
    toast('Saved successfully.'); modal('Dialog title', h('p', {}, 'Dialog body'));
    menu(x, y, [['Menu label', () => api('internal-endpoint')],
      condition ? ['Other menu label', action] : null]);
    h('p', {}, ['First label', 'Second label'].map(t => h('span', {}, t)));
    const divided = (a + b) / 2; const pattern = /[(),{}]/;
    h('p', {}, 'Visible after division and regex');
  `;
  const text = extractVisibleStrings(source).map(x => x.text);
  for (const visible of ['Helpful title', 'Accessible name', 'Search here', 'Turn on', 'Turn off',
    'Nested text', 'Saved successfully.', 'Dialog title', 'Dialog body', 'Menu label',
    'Other menu label', 'First label', 'Second label', 'Visible after division and regex']) assert(text.includes(visible), visible);
  assert(!text.some(t => /internal|css-class|Comment is not visible/.test(t)));
});

test('coverage ignores technical tokens, URLs and punctuation but reports ordinary one-word labels', () => {
  for (const text of ['EXP 1', 'MIDI', 'dB', 'Echoplex', 'Boss', 'id', 'offset', 'https://example.com', '—', '${value}']) assert.equal(needsTranslation(text), false, text);
  for (const text of ['Close', 'Footswitch', 'Loading…', 'Save to the pedal', 'Path ${which} level']) assert.equal(needsTranslation(text), true, text);
});

test('coverage extracts template alternatives and skips comparisons in visible expressions', () => {
  const text = extractVisibleStrings("h('p', {}, kind === 'internal-kind' ? `Count ${count}: ${ok ? 'Ready' : 'Waiting'}` : 'No result');").map(x => x.text);
  assert(text.includes("Count ${count}: ${ok ? 'Ready' : 'Waiting'}"));
  assert(text.includes('Ready')); assert(text.includes('Waiting')); assert(text.includes('No result'));
  assert(!text.includes('internal-kind'));
});
