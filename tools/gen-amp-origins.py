#!/usr/bin/env python3
"""Gera catalog/amp-origins.json (modelo do POD -> equipamento original) a partir da lista oficial "amps.pdf" da Line 6
(texto extraído com pdftotext -layout). uso: gen-amp-origins.py amps.txt"""
import json, re, sys
cat = json.load(open('catalog/catalog.json'))
def norm(s):
    s = s.lower().replace('‘', "'").replace('’', "'")
    for a, b in (('dbl', 'double'), ('nrm', 'normal'), ('brt', 'bright'), ('vib', 'vibrato'), ('pre', 'preamp'), ('overdrive', 'od')):
        s = re.sub(r'\b' + a + r'\b', b, s)
    s = re.sub(r'\bclass a (\d+)', r'class a-\1', s)
    return re.sub(r'[^a-z0-9]', '', s)
by = {norm(a['name']): a for a in cat['amps']}
out, miss = {}, []
for line in open(sys.argv[1], encoding='utf-8'):
    line = line.replace('✅', ' ').rstrip()
    m = re.match(r'^\s{2,}(.+?)\s{2,}(.+?)\s*$', line)
    if not m or m.group(1).startswith('Full Pack') or m.group(1) == 'Pod Name': continue
    pod, orig = m.group(1).strip(), re.sub(r'[®™]', '', m.group(2)).strip()
    a = by.get(norm(pod))
    if a: out[a['name']] = orig
    else: miss.append(pod)
json.dump(out, open('catalog/amp-origins.json', 'w'), ensure_ascii=False, indent=1)
print(len(out), 'modelos com origem; sem correspondência:', miss)
