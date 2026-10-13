#!/usr/bin/env python3
"""Gera catalog/catalog.json a partir das tabelas do lpedit-lib (LGPL-3.0).
uso: gen-catalog.py <pasta model/pod do lpedit-lib>"""
import json, re, sys
src = sys.argv[1]
CONST = {'CabLowCutID': 0, 'CabResLevelID': 1, 'CabThumpID': 2, 'CabDecayID': 3, 'CabERID': 4, 'CabMicID': 5,
         'ampDisabled': 0x7FFFF, 'noCab': 0x7FFFF, 'nonePedal': 0x20DFFFF}
def num(s):
    s = s.strip()
    return CONST[s] if s in CONST else int(s, 0)
KIND = {'PerCentParam': 'percent', 'FreqParam': 'freq', 'FreqKParam': 'freqk', 'ListParam': 'list',
        'RangeParam': 'range', 'TempoFollowerParam': 'tempo', 'TimeParam': 'time', 'TempoParam': 'tempo2'}
def parse(path, tkey):
    txt = open(f'{src}/{path}', encoding='utf-8').read()
    txt = txt[txt.index(f'var '):]
    parts = re.split(rf'\n\t\{{(?={tkey}:)', txt)[1:]
    out = []
    for blk in parts:
        h = re.match(rf'{tkey}: ([\w]+),(.*?)(?:params:|\n)', blk, re.S)
        e = {'type': num(re.match(rf'{tkey}: ([\w]+)', blk).group(1)),
             'name': re.search(r'\bname: "([^"]*)"', blk.split('params:')[0]).group(1)}
        st = re.search(r'stype: "([^"]*)"', blk.split('params:')[0])
        if st: e['group'] = st.group(1)
        if 'hideParams: true' in blk.split('params:')[0]: e['hideParams'] = True
        e['params'] = []
        body = blk.split('params:', 1)[1] if 'params:' in blk else ''
        for m in re.finditer(r'&(\w+)\{GenericParameter: GenericParameter\{id: (\w+), name: "([^"]*)"\}(.*?)\}(?=,\n\s*(?:&|\}\}))', body, re.S):
            kind, pid, pname, extra = m.groups()
            p = {'id': num(pid), 'name': pname, 'kind': KIND.get(kind, kind)}
            for k in ('min', 'max', 'maxMs'):
                mm = re.search(rf'\b{k}: (-?[\d.]+)', extra)
                if mm: p[k] = float(mm.group(1))
            lm = re.search(r'list: \[\]string\{(.*?)\}', extra, re.S)
            if lm: p['options'] = re.findall(r'"([^"]*)"', lm.group(1))
            bv = re.search(r'binValueType: (\w+)', extra)
            if bv: p['int'] = bv.group(1) == 'Int32Type'
            e['params'].append(p)
        out.append(e)
    return out
cat = {'amps': parse('amp.go', 'atype'), 'cabs': parse('cab.go', 'ctype'), 'pedals': parse('pedal.go', 'ptype')}
json.dump(cat, open('catalog/catalog.json', 'w'), ensure_ascii=False, indent=1)
for k, v in cat.items():
    print(k, len(v), 'entradas,', sum(len(x['params']) for x in v), 'parâmetros')
