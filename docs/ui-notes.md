# HD500 Editor UI — 0.2.7

The UI uses local ES modules, original SVG artwork and the system font stack. English is the source; Portuguese comes from `tools/i18n/pairs.json` and `python3 tools/i18n/apply.py`. Core files are unchanged. All development and tests use `HD500_DEMO=1 PORT=5231`; no real pedal or commit is involved.

## Minimal surfaces and gear

Gear uses a flat silhouette in the original unit's color plus one identifying feature: a large footswitch dot, up to three knob dots, or one treadle pad. There are no screws, lettering, LEDs, reel markings, grille patterns, gradients or tiny switches. Amp icons use a body, faceplate, flat grille color and at most five knob dots. Cabs retain a simple speaker arrangement; microphones use three shapes. Feature contrast follows enclosure/faceplate brightness. `catalog/gear-styles.json` is the editable source; `node tools/gen-gear-styles.mjs` regenerates the browser styles.

The canvas, inspector and settings panel sit on flat surfaces. Glass is reserved for toolbar, sidebar and sheets/menus. Category tints, duplicated node group labels, animated flow decoration, the background color mesh and canvas/footer slogans are removed. Nodes have one quiet selection outline. Titles are larger, spacing is generous, settings use inset groups, and routing/mixer help and Dynamic Tone are behind disclosure controls. Model Info retains detailed help and origins; search still includes descriptions and original gear names.

Blue is the action/selection accent (`#0a84ff` dark, `#007aff` light). Path A uses muted blue and path B muted violet. Gear color identifies the original equipment; UI category controls are neutral. Green indicates enabled/connected/Live; gray indicates off. Bypass also desaturates the gear and dashes its cable. Switch tracks are 51 × 31 px with a 27 px thumb and 2 px end insets; targets remain at least 44 px. Labels, accessible state, keyboard focus, motion and transparency preferences remain supported.

The library shows 64 slots in 16 banks, caches names by set, and searches other sets on demand. A preset-label rail replaces the sidebar at 800–1199 px; below 800 px it becomes a focus-managed drawer. The graph scrolls within the canvas. The lower panels stack at 900 px. Model sheets have searchable categories and a flat inset list of choices; origins and Info remain available.

## Live editing and undo

The toolbar's quiet Live pill defaults on. Turning it off changes continuous gestures to release-only application; discrete choices and toggles apply immediately. Save still backs up the previous slot and writes the edit buffer to flash.

`live-edits.js` coalesces by parameter key on animation frames, caps continuous sends near 60/s even on faster displays, and allows one HTTP request in flight per parameter. UI values paint before any network work. New moves replace the pending value; a release is an ordering boundary that retains its final value even while a request is pending. Subsequent gestures retain separate ends. Pointer cancel/lost capture finalize the current value. Save, select, model, undo and other structural actions flush pending client edits first.

Knobs, mixer faders/pans, tempo and expression range sliders use `gesture: 'start' | 'move' | 'end'`. Lists, model choices and toggles apply immediately without a Save. Setup and parameter changes use `Pod.param`, `Pod.setup`, `Pod.active`, or the existing `Pod.paramRange`. The model command sends immediately, then waits for the new parameter layout before refreshing the UI. Only structural operations (assignments, ordering, rename, undo/redo and file operations) use whole-preset commands.

`edit-flow.mjs` serializes device operations and coalesces queued moves per key. Start/end and structural actions are ordering barriers, so final edits precede save, selection and undo. Lightweight requests acknowledge acceptance immediately; async device errors arrive via the event stream. GET state waits behind accepted work. Parameter ticks do not re-read/re-apply a preset or push undo entries. History captures the baseline on the first changed gesture tick and one final body at its end. Overlapping gestures finish as one history group. Undo/redo restore complete bodies, as before.

Gesture completion emits only dirty/undo/redo metadata; moving knobs and mixer controls update in place. Echoes on recently sent keys are suppressed at server and client for a short 600 ms window to prevent stale values from fighting the drag. This window can also briefly suppress a physical adjustment to the same key; hardware timing remains unverified. Remote changes outside the window retain their original event behavior. `app/demo-device.mjs` extends the existing DemoPod to mirror its expression-range stub without changing core or protocol files.

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

## Verification

Direct core tests pass six checks and skip the optional real `.h5e` fixture. The ten direct DemoPod tests pass: 200 rapid parameter moves coalesce to two sends, the final value wins, one undo restores the whole drag, one in-flight request survives slow transport, Live off waits for release, queued server moves respect end/save ordering, separate gestures retain their ends, failed requests drain, echo suppression expires, high-refresh input stays near 60 sends/s, and mixer/setup/tempo/bypass/ranges use small commands. Tests throw if a parameter drag reads or applies a whole preset. An in-process HTTP test also exercises the actual routes: requests acknowledge while the DemoPod command is blocked, 200 pending moves become one command, and undo restores the baseline in one step.

The local SVG gear sheet was regenerated and a raster preview visually inspected. Icons were checked at 32 and 64 px; contrast of light-body footswitch dots and dark amp knob rows was increased after inspection. This is artwork review, not a browser rendering check.

`HD500_DEMO=1 PORT=5231 npm test` cannot pass in this sandbox: both security tests fail binding `127.0.0.1:5231` with `listen EPERM`. Security checks remain intact. Starting the demo server fails with the same error. All nine `tests/ui-*.mjs` checks were attempted: seven stop at Chrome startup (`TargetCloseError`), and the pointer/live scripts fail connecting to the demo (`connect EPERM`). `tests/screenshots.mjs` also fails at Chrome startup. No new browser screenshots were produced; existing PNG captures in `docs/img` are from the previous UI. Full layout, switch geometry at zoom, focus, touch and visual calm still require a browser pass in an unrestricted demo environment. No hardware latency claim is made.

Run the demo server and each browser test from a fresh demo fixture:

```sh
HD500_DEMO=1 PORT=5231 node app/server.mjs
# Another terminal, same demo-only configuration:
HD500_DEMO=1 PORT=5231 npm test
HD500_DEMO=1 PORT=5231 node tests/live-edit.test.mjs
HD500_DEMO=1 PORT=5231 node tests/ui-live.mjs
HD500_DEMO=1 PORT=5231 node tests/screenshots.mjs docs/img
# Run each remaining tests/ui-*.mjs against the fresh demo on 5231.
node tools/gen-gear-styles.mjs
node tools/gear-sheet.mjs
python3 tools/i18n/apply.py
```
