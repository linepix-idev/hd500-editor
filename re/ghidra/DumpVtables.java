// Lista cada vftable com RTTI (classe -> endereços das funções virtuais).
import ghidra.app.script.GhidraScript;
import ghidra.program.model.symbol.*;
import ghidra.program.model.address.*;
import ghidra.program.model.listing.*;
import java.io.*;

public class DumpVtables extends GhidraScript {
  @Override public void run() throws Exception {
    try (PrintWriter w = new PrintWriter(System.getProperty("user.home") + "/hd500-re/out/vtables.txt")) {
      SymbolIterator it = currentProgram.getSymbolTable().getSymbols("vftable");
      for (Symbol s : currentProgram.getSymbolTable().getAllSymbols(true)) {
        if (!s.getName().equals("vftable")) continue;
        String cls = s.getParentNamespace().getName(true);
        Address a = s.getAddress();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 80; i++) {
          Address slot = a.add(i * 4L);
          Data d = getDataAt(slot);
          long v = getInt(slot) & 0xffffffffL;
          Address target = toAddr(v);
          Function f = target == null ? null : getFunctionAt(target);
          if (f == null) { if (i > 0 && getSymbolAt(slot) != null && i > 0) break; if (f == null) break; }
          sb.append(String.format(" %s", target));
        }
        w.printf("%s\t%s\t%s%n", a, cls, sb.toString().trim());
      }
    }
  }
}
