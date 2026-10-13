#!/usr/bin/env python3
"""Gera catalog/fx-origins.json (efeito do POD -> equipamento original) a partir da "POD HD Model Gallery" da Line 6
(pdftotext -layout). uso: gen-fx-origins.py gallery.txt"""
import json, re, sys
cat = json.load(open('catalog/catalog.json'))
def norm(s):
    s = s.lower().replace('’', "'").replace('‘', "'")
    for a, b in (('distortion', 'dist'), ('delay', 'dly'), ('modulator', 'mod'), (' w/mod', ' wmod'), ('treble', 'treb')):
        s = s.replace(a, b)
    return re.sub(r'[^a-z0-9]', '', s)
by = {norm(p['name']): p['name'] for p in cat['pedals']}
lines = [l.rstrip('\n') for l in open(sys.argv[1], encoding='utf-8')]
KEY = re.compile(r'^(Based on|Inspired by|Modeled after|Our model|Recreation|Faithful|A model)', re.I)
def chunks(l):  # (inicio, texto) de blocos separados por 3+ espaços
    return [(m.start(), m.group(0).strip()) for m in re.finditer(r'\S.*?(?=\s{3,}|$)', l)]
found = {}
for n, l in enumerate(lines):
    ch = chunks(l)
    if not ch or n + 1 >= len(lines): continue
    nxt = chunks(lines[n + 1])
    if not nxt or not all(KEY.match(t) or True for _, t in nxt[:1]): continue
    names = [(x, t) for x, t in ch if norm(re.sub(r'\s+\d+$', '', t)) in by]
    if not names: continue
    starts = [x for x, _ in ch]
    for k, (x, nm) in enumerate(names):
        x2 = starts[starts.index(x) + 1] if starts.index(x) + 1 < len(starts) else 10**6
        desc = []
        for m in range(n + 1, min(n + 9, len(lines))):
            seg = lines[m][x:x2].strip() if len(lines[m]) > x else ''
            if not seg and desc: break
            if seg: desc.append(seg)
        text = ' '.join(desc)
        found[by[norm(nm)]] = text
PAT = re.compile(r'(?:[Bb]ased\s+on|[Ii]nspired\s+by|[Mm]odeled\s+after)\s+(?:the\s+|an?\s+)?(.+?)(?:[,.;:]\s|[.]$|\s+(?:which|that|delivering|designed|known|with|is|as|this|it|so|Our|and|in)\b|$)')
def clean(t):
    t = re.sub(r'(?<=[A-Za-z0-9])- (?=[A-Za-z0-9])', '-', t)      # "Electro- Harmonix" -> "Electro-Harmonix"
    t = re.sub(r'\s+', ' ', t).strip(' ,.;')
    return t
out = {}
for name, d in found.items():
    d = re.sub(r'[*®™]', '', d)
    m = PAT.search(d)
    out[name] = clean(m.group(1)) if m else None
# ajustes manuais: truncamentos do PDF, frases sem "baseado em" e variantes "Dry" (mesmo aparelho do modelo molhado)
manual = json.load(open('catalog/fx-origins.manual.json'))
for k, v in manual.items():
    if v is None: out.pop(k, None)
    else: out[k] = v
for k in list(out):
    if k.endswith(' Dry') or k.endswith(' Dry '): pass
for name in [p['name'] for p in cat['pedals']]:
    if name.endswith(' Dry') and out.get(name[:-4]) and not out.get(name): out[name] = out[name[:-4]] + ' (dry signal untouched)'
json.dump({k: v for k, v in out.items() if v}, open('catalog/fx-origins.json', 'w'), ensure_ascii=False, indent=1, sort_keys=True)
print(len(found), 'achados;', sum(1 for v in out.values() if v), 'com origem')
