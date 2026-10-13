# Liquid Glass UI

The source UI remains plain, local ES modules. No bundler, font, icon package, CDN, external image, API change or core change is required. Changes remain uncommitted in the working tree. Core and protocol files are unchanged.

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

## 0.2.6 refinements

On/off buttons share one track and one pseudo-element thumb. The inspector and Trails track is 48 × 28 px with a 22 px thumb and 3 px inset; the chain track is 36 × 20 px with a 16 px thumb and 2 px inset. Travel is calculated from track width, thumb size and both insets. The transparent hit area is at least 44 × 44 px. State comes from `aria-checked`, with slate off and green on colors, visible keyboard focus and motion preferences. Footswitch tiles keep their pressed-button semantics because one tile may invert several blocks independently. Controller assignment remains a three-way choice (Off / EXP 1 / EXP 2).

The text stack is `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", Inter, system-ui, "Segoe UI", Roboto, sans-serif`; large headings prefer SF Pro Display. CSS tokens define 11 px captions, 12 px supporting text, 14 px body text, 20 px titles and 28 px large titles. Numeric controls use tabular figures. Model and parameter labels wrap, chain nodes have more room, and layout becomes a single column at 900 px. Content spacing uses 4 / 8 / 12 / 16 / 24 px tokens. Controls, range inputs and icon buttons have larger touch areas. Tooltips wait 500 ms, support focus and dismiss on scrolling or Escape. Scrollbars follow the theme.

An Info button beside each picker model and in the inspector opens a read-only sheet with a larger gear illustration, name, group, available “Based on” metadata, sound/use description and parameter explanations. Back to models preserves the search and category. Cab sheets and cab pickers offer all eight microphones; the cab microphone parameter has an Info button for the current choice. Help navigation never changes the model or parameter values. Original gear names are shown where supplied by `amp-origins.json` and `fx-origins.json`; cab and mic entries explicitly say that original gear is not specified, rather than inventing an attribution.

`catalog/descriptions.json` holds original wording by effect group, amp family, cabinet configuration, microphone type and parameter name. It covers all 229 merged catalog models and every catalog parameter; unknown future parameters receive a generic explanation. Search matches descriptions and parameter guides in English and Portuguese. `tools/gen-descriptions.mjs` generates an offline ES module, and `tools/i18n/pairs.json` supplies Portuguese. The i18n generator excludes `core/` by default; `--include-core` is reserved for explicit core maintenance. The legacy core microphone label is normalized for display in the UI.

Gear illustrations now use original control counts, a single Big Muff footswitch, a wide Rat enclosure, a green Screamer with a rubber pad, an orange script-style Phase 90, tape reels for Echoplex models, a metal-front Rectifier head, family-specific amp controls, speaker layouts including 1×8 and 8×10, and distinct ribbon/condenser silhouettes. This is original SVG artwork; no manufacturer logos or manual illustrations are copied. Origins were checked against the public [Line 6 POD HD Model Gallery](https://line6.com/data/6/0a06434c883751e6fd5654eee/application/pdf/POD%20HD%20Series%20Model%20Gallery%20-%20English%20%28%20Rev%20E%20%29.pdf).

The regenerated [complete gear sheet](img/gear-sheet.svg) includes 237 illustrations (catalog plus microphones). The [featured gear sheet](img/gear-featured.png) was rasterized with local librsvg/Cairo and visually inspected. That review prompted enclosure, switch-pad, faceplate and microphone refinements. This is an artwork review, not a browser screenshot.

## Verification and pending work

Passed: syntax checks of every UI and test ES module; catalog description coverage for all 229 models; named parameter coverage including extra cab parameters; Portuguese coverage of descriptions and guides; generated description-module equality with JSON; attached Screamer origin; i18n generation; SVG XML parsing; and `git diff --check`. Direct core tests pass six tests and skip the optional real `.h5e` fixture. No hardware integration tests were run, and `core/` has no diff.

`HD500_DEMO=1 PORT=5231 npm test` was attempted. The two security tests cannot bind localhost (`listen EPERM`), so the full suite is **not green in this environment**. Starting the demo server on 5231 fails for the same reason. All eight `tests/ui-*.mjs` scripts were attempted with demo mode enabled: seven fail when Chrome closes before page initialization (`TargetCloseError`), and the pointer test fails fetching the demo state (`connect EPERM`). `tests/screenshots.mjs` also fails at Chrome launch. These are environment failures; security tests were not weakened or skipped.

No new browser captures were produced. Existing editor screenshots in `docs/img` remain previous captures; only the gear sheets are new. Browser geometry, focus/hover/pressed states, touch and drag behavior, full contrast AA, and clipping at zoom still need visual certification. In particular, enlarged targets and wrapping labels must be checked at 900 px and on the smaller drawer layout. No claim of complete AA or browser verification is made.

Prepared checks, using only a simulated pedal:

```sh
HD500_DEMO=1 PORT=5231 node app/server.mjs
# In another terminal:
HD500_DEMO=1 PORT=5231 npm test
HD500_DEMO=1 node tests/ui-smoke.mjs /tmp/hd500-ui
HD500_DEMO=1 node tests/ui-model-info.mjs /tmp/hd500-ui
HD500_DEMO=1 node tests/ui-pointer-demo.mjs /tmp/hd500-ui
HD500_DEMO=1 node tests/ui-interact.mjs
HD500_DEMO=1 node tests/ui-controllers.mjs 5231
HD500_DEMO=1 node tests/ui-mixer.mjs 5231
HD500_DEMO=1 node tests/ui-drag.mjs 5231
HD500_DEMO=1 node tests/ui-rename.mjs 5231
HD500_DEMO=1 node tests/screenshots.mjs docs/img
node tools/gen-descriptions.mjs
node tools/gen-gear-styles.mjs
node tools/gear-sheet.mjs
python3 tools/i18n/apply.py
```

Restart the demo server before each mutating script to restore its fixture; model help and smoke checks are read-only. The browser launcher defaults to `http://127.0.0.1:5231` and `/usr/bin/google-chrome`; `HD500_UI_URL` and `CHROME` are available for controlled demo setups. `tests/ui-model-info.mjs` covers both switch endpoints at 50 / 67 / 75 / 80 / 90 / 100 / 110 / 125 / 150 / 175 / 200 percent CSS zoom in light and dark, saves zoom captures, checks 1440 / 1100 / 900 / 390 px layouts, reduced motion, Info focus restoration, search, Portuguese and unchanged preset state. `tests/screenshots.mjs` adds 900 px and a model Info capture to the existing theme, footswitch, library, picker and drawer captures. The contact sheet uses actual Chrome captures when those are available.
