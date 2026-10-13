# How this was reverse-engineered

You can repeat or extend all of this with your own copy of the official installer (*POD HD500 Edit v2.27*). **Do not** commit the installer, its binaries, or decompiler output to this repository.

## Tools

- `7z x installer.exe` — the installer is NSIS; extraction never executes anything.
- [Ghidra](https://ghidra-sre.org) (headless) with the scripts in `re/ghidra/`: `ExportAll.java` dumps functions, strings and decompilation; `DumpVtables.java` lists C++ classes recovered from RTTI (`L6X4E_*` GUI classes, `L6GBCIComm`, …).
- Python/Node for glue, `lsusb -v`, and the hardware itself.

## Method that worked

1. **Strings and RTTI** reveal the architecture: `L6X4E_MixerPanel`, `…FootSwitchPanel`, `…MIDIAssignPanel`, `L6GBCIComm` (device messages), `L6X4E_Memory` (preset image).
2. **The send primitive** (`FUN_00415190` in v2.27) builds the two header words from the number of payload words and a *command byte*; scanning every call site for `mov bl, imm` yields the complete command list.
3. **Write paths** (e.g. "send preset to slot") show which messages precede which — and constants such as `or eax, 0xFFFFFFFF` before `PresetSet` (= "current").
4. **File export code** exposes the preset layout: the endianness-swap routine for `.h5e` enumerates exactly which fields are 32-bit words.
5. **A giant `switch` (`FUN_00411a50`)** maps every "setup" id to a body offset.
6. **Data tables** in `.data` (value, string-id pairs) give enum meanings (footswitch ids, input sources, impedance…) once joined with the editor's `.lang` string file.
7. **Hardware experiments** confirm each claim. Always read before writing, keep backups, and test writes on an empty slot.

## Gotchas we hit

- The HD500 drops messages built from > 64-byte USB packets (see `protocol.md`).
- A preset write to `0xFFFFFFFF` changes only the edit buffer; the destination `(set<<16)|preset` writes flash.
- `0x2A` renames a **set**, not a preset (a preset's name lives in its body).

## Open questions

See CONTRIBUTING.md.
