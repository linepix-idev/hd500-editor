# MCP server: let an AI edit your sound

`mcp/hd500-mcp.mjs` is a dependency-free MCP (stdio) server. An AI assistant (Claude Code, etc.) reads and edits the preset in the **running** HD500 Editor through the same local API the app uses, so every change shows up live in the app and on the pedal.

```sh
claude mcp add hd500 -- node /path/to/hd500-edit/mcp/hd500-mcp.mjs
```

The editor must be open. It publishes its port in `~/.local/share/hd500-editor/server.json` (override with `HD500_URL`).

## Tools
| tool | what it does |
|---|---|
| `look` | summary (preset, inputs, mixer, flow, every block with parameter values in real units), blocks, models (catalog search incl. the real gear a model is based on), presets (names of a set), backups |
| `describe` | grounded facts about a model: based-on gear, maker/unit, sourced notes, parameters |
| `edit` | batch of ops on the edit buffer: `param`, `model`, `active`, `fs`, `controller`, `order`, `mixer`, `tempo`, `input`, `name`, `undo`, `redo` |
| `select` | switch preset (refuses with unsaved edits unless `discard:true`) |
| `compare` | A/B the saved version against the edits |
| `save` | write to the pedal memory — **only** with `confirm:true` (previous content is backed up) |

Values accept normalized numbers (0–1) or units: `"35%"`, `"250 ms"`, `"-6 dB"`, `"2.5 kHz"`, `"800 Hz"`, or an option name.

## Safety
* Edits only touch the **edit buffer**; nothing is written to the pedal's memory without `save`.
* Before the first edit of a preset, a **snapshot of the sound the user is hearing** is stored (Backups sheet, tag `ia`).
* An error stops the rest of a batch; every op reports what it did.
* Facts about real gear come from `describe` (sourced); the assistant is told never to invent them.
