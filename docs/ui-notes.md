# Liquid Glass UI

The source UI remains plain, local ES modules. No bundler, font, icon package, CDN, external image, API change or core change is required. The working branch is `codex/liquid-glass-ui`; changes are uncommitted.

## Design decisions

The library is now a persistent sidebar. It shows the current set's 64 slots in 16 banks, the loaded preset and an unsaved dot. Selecting a set browses its names; selecting a slot uses `nav.js` and its unsaved-change guard. Names are requested through the existing `library/slots` endpoint, cached by set, loaded sequentially for search and invalidated after writes, copies, swaps, clears and imports. Search loads other sets on demand. The sidebar's ellipsis menu keeps bundle import/export, set export/rename, CSV export and re-reading names. Slot context menus and confirmed slot/file drops reuse the library operations.

A mesh of diffuse orange, blue and violet gradients sits behind translucent layers. Sidebar, canvas, inspector, menus and sheets use increasingly elevated glass, saturation, hairline borders, internal highlights and layered shadows. Light surfaces use neutral text and darker variants of category strokes for legibility; the underlying category palette is unchanged. Dark and light themes share geometry and materials. Reduced transparency replaces glass with solid surfaces; reduced motion removes transitions, springs, flow and animations. Unsupported backdrop filters also fall back to solid surfaces.

The signal graph shows shared before/mix lanes and both parallel paths even when empty, so destinations stay discoverable. Local SVG Bézier cables take their destination's category color; bypass cables are dashed. Flow marks animate during a drag only. The graph scrolls inside its canvas rather than widening the page. The inspector uses a clickable model title, an enabled switch, a footswitch selector with an icon, thin parameter rings and centered values. Footswitch tiles mirror two rows of the pedal, with an expression tile and category-tinted assignment chips. Model sheets provide search, category chips and a grid.

Dragging uses pointer capture and a movement threshold. A lifted ghost follows the pointer, an exact-width gap previews insertion, surrounding nodes move with a short spring and edge movement scrolls the canvas. Effects (including empty slots) move between all six lanes. Any populated block can be dragged to the trash; effects can be dropped on footswitch tiles. Escape and pointer cancellation restore the layout without an edit. The existing `edit`/`chain` order contract and optimistic state update are preserved; a failed edit re-reads the authoritative state.

At 1200 px and above the sidebar is expanded; at 800–1199 px it becomes a preset-label rail with an expansion control; below 800 px it becomes a keyboard-accessible drawer. Inputs, Footswitches and Advanced use a segmented tablist with arrow-key navigation. Menus and modal sheets support keyboard focus, Escape and focus restoration; sheets make the background inert. UI strings live in English, with Portuguese generated from `tools/i18n/pairs.json` using `tools/i18n/apply.py`.

## Color map

| Meaning | Token | Palette |
| --- | --- | --- |
| Primary action / selection / unsaved | accent | `#ff7a2f` |
| Amp | amp | `#e3b341` |
| Cab | cab | `#5ea2ff` |
| Dynamics | g-dynamics | `#e07a5f` |
| Distortion | g-distortion | `#f0566a` |
| Modulation | g-modulation | `#3ec1a8` |
| Delay | g-delay | `#5b8def` |
| Reverb | g-reverb | `#9b6bff` |
| Filter | g-filter | `#f2b84b` |
| Pitch | g-pitch | `#f06ec2` |
| Preamp / EQ | g-preamp | `#7fd36b` |
| Volume / Pan | g-volume | `#a6adbb` |
| Wah | g-wah | `#ffa94d` |
| FX Loop | g-fx | `#7d8696` |
| Connected / enabled | good | `#46d18b` |
| Error / destructive | bad | dark `#ff7988`, light `#b7233e` |

Category class names normalize spaces and punctuation, so FX Loop, Preamp+EQ and Volume/Pan receive the same treatment as other categories. A Signal colors sheet explains selection, enabled state and bypass.

## Local icons

`app/public/js/icons.js` provides 20 × 20 SVGs with 1.6 px rounded strokes and `currentColor`: save, undo, redo, re-read, import, export, library folder, jack, guitar, microphone, output, footswitch, expression pedal, amp, cab, dynamics, distortion, modulation, delay, reverb, filter, pitch, EQ, volume, wah, loop, trash, copy, paste, settings, help, sun, moon, globe, eye, power, four arrows, sidebar, search, plus, close, ellipsis, check, swap and colors. Toolbar controls, tabs, blocks, model chips, assignment tiles and menus use local symbols. No emoji assets are used.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl/Cmd + S | Save to the current slot |
| Ctrl/Cmd + Z | Undo |
| Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y | Redo |
| Left / Right | Previous / next preset outside parameter controls |
| B | Expand / collapse library |
| L | Open library and focus search |
| Up / Down, Home / End in library | Focus a slot |
| Enter on slot | Load with the existing unsaved guard |
| Enter / Space on block | Select and focus its model control |
| Alt + Left / Right on effect | Reorder within lane |
| Alt + Up / Down on effect | Move to previous / next lane |
| Delete / Backspace on block | Clear |
| Shift + F10 on block | Open context menu |
| Escape | Cancel drag / close menu, sheet or drawer |
| Arrows / Home / End on knob | Adjust value |
| Shift + drag / wheel | Fine adjustment |
| Double-click knob | Enter a value |
| Double-click preset name, or Enter on its button | Rename inline; Enter commits, Escape cancels |
| ? | Help |

## Verification and pending work

Syntax checks of all UI ES modules passed. A lightweight DOM initialization review also exercised module startup, graph construction, 64 sidebar slots, bank groups, SVG wires, knobs, footswitch rendering, model search, the legend and cached cross-set search. A simulated pointer review additionally checked Escape without an edit, cross-lane order with eight slots, moving an empty slot, trash and footswitch API bodies. These were logic reviews, not browser, geometry or touch tests. `python3 tools/i18n/apply.py` completed, and the core test suite passed. `npm test` was attempted: its security tests could not listen on localhost (`listen EPERM`) in this sandbox. This is an environment block; the server and security suite were not changed to hide it.

The mandatory visual loop is **pending**, not certified. Starting `HD500_DEMO=1 PORT=5231 node app/server.mjs` failed with `listen EPERM`. Chrome also exited before CDP initialization: its crash handler reports `setsockopt: Operation not permitted`, and Puppeteer reports `Target closed`. Consequently no new screenshots were captured or inspected, `docs/img` still contains the previous captures, and `/tmp/hd500-ui/contact.png` has not been generated. The smoke and screenshot commands were attempted and failed at browser launch. The pointer test was attempted and failed with `connect EPERM` while reaching the demo server. Final material quality, actual AA contrast, hover/focus/drag appearance, responsive geometry and touch behavior still require real Chrome verification.

Prepared checks (run only with the simulated server):

```sh
HD500_DEMO=1 PORT=5231 node app/server.mjs
# In another terminal:
npm test
node tests/ui-smoke.mjs /tmp/hd500-ui
HD500_DEMO=1 node tests/ui-pointer-demo.mjs /tmp/hd500-ui
node tests/screenshots.mjs docs/img
python3 tools/i18n/apply.py
```

The browser scripts default to `http://127.0.0.1:5231` and `/usr/bin/google-chrome`; override with `HD500_UI_URL` and `CHROME` if needed. Screenshots cover both themes at 1440 × 900, 1100 × 800 and 390 × 800, plus footswitch, library, model-sheet and mobile-drawer states. `tests/contact-sheet.py` composes those real captures into `/tmp/hd500-ui/contact.png` using Pillow. The demo-only pointer script checks lane order, all lane destinations, an empty slot, Escape cancellation, footswitch assignment, trash and touch input, then restores the initial preset. Existing real-hardware scripts were neither run nor used.
