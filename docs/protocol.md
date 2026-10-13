# POD HD500 — USB control protocol (`0e41:414d`)

Reverse-engineered from the last official editor (POD HD500 Edit 2.27) and **verified on a real HD500**. Little-endian everywhere; a "word" is 32 bits.
Complements the public work of *lpedit-lib* (POD HD500X), which uses the same message layout.

## Transport

- USB interface **1**, bulk OUT `0x01` / bulk IN `0x81`, **64-byte packets**. (Interface 0 is the isochronous audio stream.)
- Every packet = `[n][0][t][0]` + up to **60 data bytes** (`t = 1` first packet of a message, `t = 4` continuation, `n` = number of data bytes).
- ⚠ Packets larger than 64 bytes (the 256-byte chunks that work on the HD500X) make the HD500 **silently drop** large messages. Small messages happen to work either way; a 4 KB `PresetSet` only works with 60-byte chunks.
- The pedal never talks first: send a query, read the reply. Afterwards it also pushes changes made on its front panel.
- Linux: the kernel's `snd-usb-podhd` claims both interfaces. Detach interface 1 with libusb while the editor runs and issue a USB *reset* when done — `attachKernelDriver` does not work for this device.

## Message

```
word0 = (size_in_words − 1) | 0x000A0000 | (0x40 << 24)
word1 = (CMD << 24) | (0x08 << 8) | 0x01          0x40 = pedal address, 0x08 = our id, 0x01 = client number
payload = N words   [+ 4096-byte preset body for CMD 0x02]
```

Replies swap the address bytes. Acknowledgements are 12 bytes: word 2 = status (`0` = ok).

## Commands

| CMD | dir | payload | meaning |
|---|---|---|---|
| `0x00` | → | `u32 (set<<16)\|preset` (`0xFFFFFFFF` = edit buffer) | **PresetQuery** → replies `0x01` |
| `0x01` | ← | body (4096 B) | **PresetLoad** (4104 B total) |
| `0x02` | → | `u32 dest` + body | **PresetSet**: `dest = (set<<16)\|preset` writes **flash**; `0xFFFFFFFF` replaces only the edit buffer. Ack `0x03` |
| `0x11` | ↔ | `0, item, type` | model change |
| `0x13` | ↔ | `0, item, on` | bypass |
| `0x16` | ↔ | `0, vtype, id, value` | preset setting by id (`vtype` 0 = int, 1 = float). See `preset-format.md` |
| `0x20` | → | `0, id, value` | write a **global pedal setting**. `id 8` = select preset, `id 9` = select set (the pedal really switches) |
| `0x21` → `0x22` | | `id` → `0, id, value` | read a global setting |
| `0x23`, `0x27`, `0x2C` | ← | | preset/set changed notifications |
| `0x28` → `0x29` | | `set` → `set` + name[16] | set name |
| `0x2A` → `0x2B` | → | `set, name[16]` | **rename set** |
| `0x2D` / `0x2E` / `0x2F` | ↔ | `0, item, vtype, param id, f32` | parameter value / heel / toe |

Items: `0` Amp A · `1` Cab A · `2` Amp B · `3` Cab B · `4…11` FX 1…8.

## Recipes

- **Read any slot**: `0x00` with `(set<<16)|preset` — no need to select it.
- **Save the edit buffer to slot S/P**: read the buffer with `0xFFFFFFFF`, send `0x02` with `(S<<16)|P` and the body, wait for ack `0x03`.
- **Apply a whole preset live** (reorder blocks, footswitch assignments, names…): `0x02` with `0xFFFFFFFF`.
- **Select a preset**: `0x20 [0, 9, set]` then `0x20 [0, 8, preset]`.

## Global settings (`0x20` / `0x21`)

Ids 0…0x25 respond. Known: `0x2` reference pitch (Hz, 440), `0x8`/`0x9` current preset/set, `0x26…0x29` four characters of the current name. The rest are unnamed — see CONTRIBUTING.md.
