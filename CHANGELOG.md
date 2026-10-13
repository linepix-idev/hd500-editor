# Changelog

## 0.2.6
- "Based on …" for effect models too (e.g. Screamer → Ibanez Tube Screamer, Script Phase → MXR Phase 90), from Line 6's public POD HD Model Gallery; shown in picker, inspector, tooltips and search.

## 0.2.5
- "Based on …" for every amp model (e.g. Mandarin 80 → Orange OR80), shown in the model picker, the inspector and tooltips; the model search also matches the original name (try "twin" or "orange").
- Controllers panel, multi-block footswitches, automatic EXP assignment for Wah/Volume, move/swap/copy of presets and multi-select in the library, rename from anywhere.

## 0.2.1
- Mixer panel (levels, pans, Trails) with live feedback from the pedal; mixer/Trails settings documented.
- 31 extra amp models and 4 cabs from the model packs added to the catalog.
- Original illustrations of amps, cabs, microphones and pedals per model.
- Robustness: truncated pedal messages are discarded and queries retried.

## 0.2.0
- Liquid Glass UI: library sidebar, node graph with pointer drag-and-drop, local icon set, light/dark.

## 0.1.0 — first public release
- Signal-chain editor with paths A/B, drag-and-drop, live editing of all amp/cab/effect models and parameters.
- Footswitch and expression-pedal assignments, input routing, Dynamic Tone, cab microphone/E.R.
- Library manager (8 sets × 64 presets): copy, swap, clear, rename sets, bundle export/import, `.h5e` import/export, CSV list, automatic backups.
- Undo/redo, unsaved-changes tracking, English and Portuguese UI, light/dark themes.
- Demo mode without hardware: `HD500_DEMO=1 npm start`.
- Documented USB protocol and preset format (`docs/`).
