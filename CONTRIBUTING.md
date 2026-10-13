# Contributing

Thank you for helping keep the POD HD500 alive! You don't need to be a programmer: a pedal, a USB cable and curiosity are enough.

## Run it

```sh
npm install
npm test            # unit tests, no pedal needed
npm start           # web UI at http://127.0.0.1:5230 (needs a pedal)
npm run test:ui     # browser smoke checks against the demo on port 5231 (Chrome required)
```

Linux needs the udev rule (`99-line6-hd500.rules`) and the pedal re-plugged once.

For UI work without hardware, use the demo workflow and browser checks in [README](README.md#ui-development). All new UI text needs a `[Portuguese, English]` pair in `tools/i18n/pairs.json`; finish with `python3 tools/i18n/apply.py`.

## Safe-hacking rules

1. **Back up first** — *Library sidebar → … → Export all* (or `node tools/backup-all.mjs`).
2. Experiment on the **edit buffer** (nothing is saved until you press *Save*) or on an empty slot (set 7 is empty on many pedals).
3. Never include Line 6 binaries, firmware, images or decompiler output in a pull request.

## Ways to help

### Name the unknown settings (easiest, most valuable)
Open **Advanced → Learn**, then move a control on the pedal (Mixer, Setup, Inputs, Variax, L6 Link…). The setting id and its new value appear. Type a name in the table and press *Export names*; send us the JSON, or add the entry yourself to `core/setting_names.json` (`"<decimal id>": "meaning"`). Please also say which pedal menu you used and what the values mean (0/127 = off/on? dB? …).

### Decode the MIDI assignment records
14 records × 6 bytes at preset-body offset `0xD84` (Advanced → MIDI). Set an assignment on the pedal (or the official editor), diff the bytes, document the fields in `docs/preset-format.md`.

### Global settings
`STATUS` ids `0x0B…0x25` (Advanced → Global). Change an option in the pedal's *Global* menu and tell us which id moved.

### Other platforms and firmwares
Tell us what works on Windows/macOS and which firmware versions you tested (open an issue with the *Hardware report* template).

### Code
Core logic lives in `core/` (pure Node, tested), the server in `app/server.mjs`, the UI in `app/public/` (plain ES modules, no build step). Keep changes small and add a test in `tests/` when you touch the protocol or the preset model.

## Commit / PR checklist

- [ ] `npm test` passes
- [ ] new protocol facts are in `docs/`
- [ ] no proprietary files
