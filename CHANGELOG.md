# Changelog

## 0.2.13 (beta)
- Windows: the connection assistant has a "Get the Line 6 audio driver" button, and the installer explains clearly that the pedal is either a sound card (Line 6 driver) or editable here (WinUSB), not both.
- Installation and user guides (PDF) for Linux, Windows and macOS, in English and Portuguese, with each system's limitations (docs/pdf).
- Releases are now created as a draft pre-release with the installers and the guides attached.

## 0.2.12 (beta)
- Driver assistant: shows what is missing per system (cable, udev rule, WinUSB driver), offers the fix (Zadig with administrator prompt on Windows, polkit on Linux) and connects by itself once it is done. It also appears when the cable is unplugged during use.
- Windows: the diagnosis now looks at the whole device. Line 6's official audio driver takes over the pedal and the editor cannot connect while it is active; the assistant says so. On Windows the pedal is either a sound card (Line 6 driver) or editable here (WinUSB), not both.
- Reconnection: recovers from a dead USB handle (reset or re-enumeration) instead of staying "connected" while every command fails; the library reloads after reconnecting.
- Linux: the .deb removes the udev rule when uninstalled; the rule is checked against the repository copy by a test.
- MCP on/off moved to Pedal settings; fixed stray "null" texts (new test scans the UI for leaks).
- The Windows driver check is cached for 4 s (the assistant polls every 2 s).
- CI now runs the tests on Linux, Windows and macOS; NOTICE credits the bundled Zadig (GPL-3.0).
- Known limits: Windows and macOS installers are not code-signed (SmartScreen / Gatekeeper warnings); USB audio input on macOS needs a signed driver (separate hd500-audio package, output only for now).

## 0.2.11
- macOS: when the HD500 Audio driver (hd500audiod) is installed it owns the USB device exclusively; the editor now talks to the pedal through the daemon's local socket (/var/run/hd500audiod.sock) and falls back to direct USB when the daemon is not running. Editor and audio work at the same time.

## 0.2.10
- macOS: the pedal arrives with no active USB configuration; the editor now activates it before opening interface 1 (verified on a real POD HD500, Apple Silicon).
- Installers: Windows setup bundles Zadig and offers the WinUSB step; icons for all systems; AppImage falls back to --no-sandbox.

## 0.2.9
- MCP server for AI editing (look, describe, edit, select, compare, save), with an "AI is editing" indicator in the app; edits from outside the UI now refresh the screen live.
- Central edit limits: every edit is validated/clamped before reaching the pedal.
- The Mixer is now a block of the signal chain: select the Mixer node (or press M) and it opens in the block inspector like any pedal. The Mixer tab and toolbar button are gone.
- Tempo pill with Tap in the chain toolbar (blinks at the tempo; T key); the chain now fits the window in two compact steps.
- Compare button: hear the saved version against your edits.
- Backups sheet (File ▸ Backups…) and Setlist sheet (File ▸ Print setlist…: print/PDF/CSV).
- First-connection assistant: checks the USB cable, the udev rule / WinUSB driver and other programs using the pedal.
- Controllers panel as grouped cards; footswitch panel with stomp keys and LEDs; Toe + EXP chips on blocks with both.
- DT amp controls explained (only used with DT50/DT25 over L6 LINK).
- Effect info sheets: maker/unit and sourced facts with Portuguese translations, friendly source labels; i18n coverage check.
- Save now reloads the slot afterwards so the pedal's "edited" asterisk clears.
- Cleaner UI: the Advanced tab (raw bytes, MIDI bytes, setting learner) moved to File ▸ Developer tools; footers removed; side-panel tab bar has four items.
- Motion pass: one easing and three durations, springy hover/press, sheets and tabs slide in, wires fade in; reduced-motion respected; cheaper scrolling for the preset list.
- Mixer: Pan is now a bipolar knob (arc grows to the side the sound moves to; double-click centres it).
- Pedal settings (global, outside the preset) moved to their own sheet (toolbar button) with a guided "Find a setting" tool: snapshot, change one setting on the pedal, compare, name it, export the names.
- Chain blocks show clear footswitch (FS) and expression-pedal (EXP) tags; the footswitch panel is ordered FS1–FS4 over FS5–FS8 like the official editor.
- Tap tempo: a Tap button (or the T key) in the Inputs tab sets the preset tempo from your taps (average of the last intervals) and sends it to the pedal live; tempo changed on the pedal updates the editor.
- Cleaner gear icon for the Advanced tab.
- Fix: importing (.h5e), copying, moving, swapping or clearing onto the preset currently open now reloads the editor; before, the screen kept showing the old preset.
- Fix: Save failed with ENOTDIR in the packaged app (backups were written inside the read-only app bundle). Backups now go to ~/.local/share/hd500-editor/backups (override with HD500_BACKUPS).

## 0.2.8
- Restored the detailed original gear icons (amps, cabs, pedals); bundled Inter (SIL OFL) as the SF Pro stand-in on Linux/Windows — macOS uses the real SF Pro; smaller on/off switches inside chain blocks.

## 0.2.7
- Minimal flat gear icons: real enclosure colors, one pedal feature, flat amp faceplates/grilles and at most five knob dots. Neutral content surfaces, quieter nodes and picker, inset settings groups, larger titles and disclosed routing/mixer/DT help.
- Live editing defaults on. Knobs, mixer, tempo and expression ranges update optimistically during drags, coalesced to about 60 sends/s with one request in flight per parameter and a guaranteed release value. The toolbar Live toggle applies drags on release when disabled; Save still writes flash.
- Serialized lightweight device edits, pending-move coalescing, gesture-level undo and short echo suppression. No preset reads/applies or whole-state redraws per parameter tick. Added DemoPod regressions and a demo browser live-edit check. Core files remain unchanged.

## 0.2.6
- "Based on …" for effect models too (e.g. Screamer → Ibanez Tube Screamer, Script Phase → MXR Phase 90), from [Line 6's public POD HD Model Gallery](https://line6.com/data/6/0a06434c883751e6fd5654eee/application/pdf/POD%20HD%20Series%20Model%20Gallery%20-%20English%20%28%20Rev%20E%20%29.pdf); shown in picker, inspector, tooltips and search.

- Shared on/off switch geometry with equal thumb insets, 44 px targets, accessible states, focus rings and reduced motion in both themes.
- SF Pro typography stack, readable type scale, tabular numbers, wrapping model labels, consistent spacing, delayed tooltips and improved 900 px layouts.
- Model Info sheets for amps, cabs, microphones and effects, with original gear metadata, reusable sound descriptions and parameter guides; explanatory text is searchable and translated into Portuguese.
- Refined pedal enclosures, colors and controls, amp faceplates, speaker configurations and microphone silhouettes; regenerated gear reference sheet.
- Expanded demo browser checks for model help, translations, switch endpoints and zoom; UI interaction tests now default to port 5231.

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
