#!/usr/bin/env python3
"""Converte as strings da interface/servidor de português para inglês (fonte da verdade = pairs.json)
e gera app/public/js/i18n-pt.js (tabela inglês -> português usada em tempo de execução)."""
import json, re, glob, sys, os
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
pairs = json.load(open(f'{root}/tools/i18n/pairs.json'))
files = glob.glob(f'{root}/app/public/js/*.js') + [f'{root}/app/public/index.html', f'{root}/app/server.mjs'] + glob.glob(f'{root}/core/*.mjs')
files = [f for f in files if not f.endswith('i18n-pt.js') and not f.endswith('i18n.js')]
def esc(s, q): return s.replace('\\', '\\\\').replace(q, '\\' + q)
count = 0
for f in files:
    t = open(f, encoding='utf-8').read(); orig = t
    for pt, en in sorted(pairs, key=lambda p: -len(p[0])):
        if f.endswith('.html'):
            for pat in (f'>{pt}<', f'"{pt}"'):
                t = t.replace(pat, pat.replace(pt, en))
        else:
            for q in ("'", '"', '`'):
                t = t.replace(q + esc(pt, q) + q, q + esc(en, q) + q)
    if t != orig: open(f, 'w', encoding='utf-8').write(t); count += 1
print('arquivos alterados:', count)
# tabela EN -> PT para o modo português
js = '// Gerado por tools/i18n/apply.py — não editar à mão (edite tools/i18n/pairs.json).\nexport const PT = ' + json.dumps({en: pt for pt, en in pairs}, ensure_ascii=False, indent=1) + ';\n'
open(f'{root}/app/public/js/i18n-pt.js', 'w', encoding='utf-8').write(js)
