import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// The runtime translator only needs these globals at initialization. No DOM observer
// or USB is started by these Node checks; browser behavior has its own DEMO test.
const saved = {};
for (const name of ['localStorage', 'navigator', 'document', 'MutationObserver', 'window']) saved[name] = Object.getOwnPropertyDescriptor(globalThis, name);
let language = 'pt';
Object.defineProperties(globalThis, {
  localStorage: { configurable: true, value: { getItem: () => language } },
  navigator: { configurable: true, value: { language: 'en' } },
  document: { configurable: true, value: { title: 'Editor', documentElement: { nodeType: 1, childNodes: [], hasAttribute: () => false } } },
  MutationObserver: { configurable: true, value: class { observe() {} disconnect() {} } },
  window: { configurable: true, value: { confirm() {}, prompt() {}, alert() {} } },
});
const pt = await import('../app/public/js/i18n.js?runtime-test-pt');
language = 'en';
const en = await import('../app/public/js/i18n.js?runtime-test-en');
for (const [name, descriptor] of Object.entries(saved)) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
}

test('runtime translates templates, whitespace fragments and English remains intact', () => {
  assert.equal(pt.tr('Path A level'), 'Nível do caminho A');
  assert.equal(pt.tr(' — controlled by EXP 1 (right-click to change)'), ' — controlado por EXP 1 (clique direito para mudar)');
  assert.equal(pt.tr(' — right-click: assign to an expression pedal'), ' — clique direito: atribuir a pedal de expressão');
  assert.equal(pt.tr('No footswitch: '), 'Sem footswitch: ');
  assert.equal(pt.tr('  Source  '), '  Fonte  ');
  assert.equal(pt.tr('You can only paste ' + pt.tr('effects into effect slots') + '.'), 'Só dá para colar efeitos em slots de efeito.');
  assert.equal(pt.tr('Model — ' + pt.tr('Effect')), 'Modelo — Efeito');
  assert.equal(en.tr('Path A level'), 'Path A level');
  assert.equal(en.tr('Source'), 'Source');
});

// Exercise the real sheet module with only its DOM/illustration boundary stubbed.
// This lets npm test validate all catalog sheets even in sandboxes without Chrome.
const sheetSource = readFileSync(new URL('../app/public/js/model-info.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace(/^export /gm, '') + '\n globalThis.show = showModelInfo;';
const details = JSON.parse(readFileSync(new URL('../catalog/fx-origins.details.json', import.meta.url), 'utf8'));
const textContent = node => typeof node === 'string' || typeof node === 'number' ? String(node) : node?.children?.map(textContent).join('') ?? '';
const find = (node, className) => {
  if (!node || typeof node !== 'object') return null;
  if (node.attrs?.class === className) return node;
  for (const child of node.children ?? []) { const result = find(child, className); if (result) return result; }
  return null;
};
function renderer(translator) {
  let sheet;
  const context = {
    lang: translator.lang, tr: translator.tr,
    h: (tag, attrs = {}, ...children) => ({ tag, attrs, children: children.flat().filter(c => c != null && c !== false) }),
    modal: (title, content) => { sheet = { title, content }; return () => {}; },
    gearEl: () => null, micEl: () => null, icon: () => null, micModels: [],
    modelName: m => m.name ?? m.model,
    modelDescription: () => ({ group: 'Delay', text: '' }), parameterDescription: () => '',
  };
  runInNewContext(sheetSource, context);
  return model => { context.show(model); return sheet.content; };
}

test('all 115 sheets select PT/EN notes and facts, hide redundant origins and group source numbers', () => {
  for (const translator of [pt, en]) {
    const render = renderer(translator);
    for (const [name, d] of Object.entries(details)) {
      // Preset items expose model, picker models expose name. Cover both shapes.
      for (const model of [{ name }, { model: name }]) {
        const sheet = render({ ...model, kind: 'fx', params: [], details: d });
        const notes = find(sheet, 'origin-notes');
        assert.equal(textContent(notes), (translator.lang === 'pt' ? d.notes_pt : d.notes) ?? '', name);
        const facts = find(sheet, 'origin-facts');
        const identity = [d.maker, d.unit].filter(Boolean).join(' ');
        const expected = d.facts.filter(f => f.text !== `${name} origin: ${identity}.`);
        assert.deepEqual(facts?.children.map(textContent) ?? [], expected.map(f => translator.lang === 'pt' ? f.text_pt : f.text), name);
        const source = find(sheet, 'origin-sources');
        if (!expected.length) {
          assert.equal(facts, null, name); assert.equal(source, null, name);
          assert(!textContent(sheet).includes(translator.tr('Documented facts')), name);
        } else {
          assert(!/catalog\/fx-origins\.json:\d|tools\/sources\/pod-hd-model-gallery\.txt:\d/.test(textContent(source)), name);
        }
      }
    }
    const tape = render({ name: 'Tape Echo', kind: 'fx', details: details['Tape Echo'] });
    assert.equal(textContent(find(tape, 'origin-sources')), translator.lang === 'pt'
      ? 'Fonte: Galeria de Modelos POD HD da Line 6 [1]' : 'Source: Line 6 POD HD Model Gallery [1]');
    const chrome = render({ name: 'Chrome Custom', kind: 'fx', details: details['Chrome Custom'] });
    assert.equal(textContent(find(chrome, 'origin-sources')), translator.lang === 'pt'
      ? 'Fonte: Galeria de Modelos POD HD da Line 6 (lista de origens) [1]; Galeria de Modelos POD HD da Line 6 [2][3]'
      : 'Source: Line 6 POD HD Model Gallery (origin list) [1]; Line 6 POD HD Model Gallery [2][3]');
  }
});

test('mixer traduz título e descrição em português', () => {
  assert.equal(pt.tr('Mix'), 'Mixagem');
  assert.equal(pt.tr('Level and pan of paths A and B, and Trails'), 'Nível e pan dos caminhos A e B, e Trails');
  assert.equal(en.tr('Mix'), 'Mix');
});

test('setlist ignora resposta antiga quando o usuário troca de set durante a leitura', async () => {
  const pending = []; let pick, sheet;
  const source = readFileSync(new URL('../app/public/js/setlist.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace(/^export /gm, '') + '\n globalThis.open = openSetlist;';
  const context = {
    S: { st: { setNames: ['PRIMEIRO', 'SEGUNDO'], selection: { set: 0 } } }, tr: s => s,
    api: (_, body) => new Promise(resolve => pending.push({ set: body.set, resolve })),
    h: (tag, attrs = {}, ...children) => {
      const node = { tag, attrs, children: children.flat(), replaceChildren(...kids) { this.children = kids.flat(); } };
      if (tag === 'select') pick = node;
      if (attrs.class === 'setlist-sheet') sheet = node;
      return node;
    },
    modal() {}, fail: e => { throw e; }, toast() {}, download() {}, presetLabel: i => String(i),
  };
  runInNewContext(source, context);
  const initial = context.open();
  pick.value = '1'; const next = pick.attrs.onChange();
  assert.deepEqual(pending.map(p => p.set), [0, 1]);
  pending[1].resolve(['NOVO']); await next;
  assert(textContent(sheet).includes('NOVO'));
  pending[0].resolve(['ANTIGO']); await initial;
  assert(textContent(sheet).includes('NOVO')); assert(!textContent(sheet).includes('ANTIGO'));
});

test('download libera URL temporária e seletor de arquivo resolve ao cancelar', async () => {
  const source = readFileSync(new URL('../app/public/js/util.js', import.meta.url), 'utf8');
  const fragment = source.slice(source.indexOf('export function download'), source.indexOf('/** Delayed'))
    .replace(/^export /gm, '') + '\n globalThis.helpers = { download, pickFile };';
  const timers = [], revoked = [], input = { files: [], click() {} };
  let clicks = 0, removed = 0;
  const context = {
    h: () => ({ click() { clicks++; }, remove() { removed++; } }),
    document: { body: { append() {} } }, $: () => input, Blob,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: url => revoked.push(url) },
    setTimeout: fn => timers.push(fn),
  };
  runInNewContext(fragment, context);
  context.helpers.download('test.csv', 'data');
  assert.equal(clicks, 1); assert.equal(removed, 1); assert.equal(timers.length, 1);
  timers[0](); assert.deepEqual(revoked, ['blob:test']);
  const cancelled = context.helpers.pickFile('.h5e'); input.oncancel();
  assert.equal(await cancelled, null); assert.equal(input.onchange, null); assert.equal(input.oncancel, null);
  const selected = context.helpers.pickFile('.h5e'); const file = { name: 'test.h5e' }; input.files = [file]; input.onchange();
  assert.equal(await selected, file); assert.equal(input.oncancel, null);
});
