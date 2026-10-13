# Reverse-engineering helpers

```sh
# 1. extract your own copy of the installer (never commit its contents)
7z x "POD HD500 Edit v2.27 Installer.exe" -o/tmp/hd500-installer
# 2. import into Ghidra headless
analyzeHeadless ~/hd500-re/proj hd500 -import "/tmp/hd500-installer/POD HD500 Edit/POD HD500 Edit.exe"
# 3. dump functions, strings and decompilation to ~/hd500-re/out
analyzeHeadless ~/hd500-re/proj hd500 -process "POD HD500 Edit.exe" -noanalysis -scriptPath re/ghidra -postScript ExportAll.java
analyzeHeadless ~/hd500-re/proj hd500 -process "POD HD500 Edit.exe" -noanalysis -scriptPath re/ghidra -postScript DumpVtables.java
```
See `docs/reverse-engineering.md` for how the output was used.
