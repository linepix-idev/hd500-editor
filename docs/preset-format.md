# Preset format

A preset is a **4096-byte body**. The pedal sends it as `PresetLoad` (8-byte header + body) and accepts it back in `PresetSet`. All numbers little-endian unless noted. Offsets are relative to the start of the body (add 8 for the on-wire message).

```
0x000  name              16 visible chars, space padded (32 bytes reserved)
0x028  items[12]         12 × 256 bytes, in the order  AmpA, AmpB, CabA, CabB, FX1 … FX8   (ids 0,2,1,3,4…11)
0xC28  settings region   bytes/dwords addressed through the "setup" table (below)
0xD58  tempo             float32 BPM
0xD84  MIDI assigns      14 records × 6 bytes (FS/EXP → MIDI message; semantics partly unknown)
0xFF8  cab mic models, 0xFFE/0xFFF input sources, …
0x1000 (not on the wire) the editor's "dirty" flag
```

## Item (256 bytes)

| offset | size | meaning |
|---|---|---|
| +0 | u32 | model type (see `catalog/catalog.json`). `0x0007FFFF` = empty amp/cab, `0x020DFFFF` = empty FX |
| +4 | u16 | position — order among the 8 FX (0…7) |
| +6 | u8 | lane: `0` before amp (shared), `1` path A before amp, `2` path B before amp, `3` A after cab, `4` B after cab, `5` after mix |
| +7 | u8 | unknown (always 5 in our library) |
| +8 | u8 | active (1 = on) |
| +9, +10, +13, +14, +15 | u8 | unknown |
| +11 | u8 | 1 when the slot holds a model |
| +12 | u8 | **footswitch**: 0 none, 1–8 = FS1…FS8, 9 = EXP toe switch |
| +16 | 12 × 20 B | parameters |

Parameter entry (20 bytes): `u32 id (0x3F1000nn)`, `f32 value`, `f32 heel`, `f32 toe`, then a 4-byte field whose first byte is the **controller** (0 none, 1 = EXP 1, 2 = EXP 2). Values are normalised 0…1; the display unit comes from the model table (`percent`, `freq`, `time`, …). For cabs the four entries are Low Cut, Res Level, Thump, Decay; E.R. and microphone live in the settings region.

## Settings ("setup") table

Command `0x16` writes one setting by id; the editor keeps an id → offset table (`core/setup_map.json`, extracted from the official editor). Examples: `0x36` input 1 (offset 0xFFE), `0x37` input 2 (0xFFF), `0x55` guitar In-Z (0xDD2), `0x17` tempo (0xD58, float), `0x26–0x2B` Dynamic Tone topology/mode/class for amp A/B, `0x32–0x35` cab E.R. and microphone, `0x57–0x5E` cab low cut/res/thump/decay (these point into the cab items).

Input sources (raw values): Input 1: 1 Guitar · 2 Mic · 3 Aux · 5 Guitar+Aux · 6 Guitar+Variax · 7 Guitar+Aux+Variax · 8 Variax · 9 Variax Mags. Input 2 additionally has 0 = Same. In-Z: 0 Auto, 1 22K, 2 32K, 3 70K, 4 90K, 5 136K, 6 230K, 7 1M, 8 3.5M.

Most settings are still unnamed — see the *Advanced → Learn* tab and CONTRIBUTING.md.

## `.h5e` (official editor export)

`'H5EP'` (4 bytes) + 36 bytes header (big-endian words) + the 4096-byte body in which **only some fields are big-endian**: the u32 words at body offsets `0x20`, `0x24`, `0xD48…0xD83` and, inside each item, the first two words (type, position/lane) and the first four words of each parameter entry. Names and single bytes are untouched. `core/h5e.mjs` implements the conversion (round-trip tested). Set exports use the magic `'H5ES'`.
