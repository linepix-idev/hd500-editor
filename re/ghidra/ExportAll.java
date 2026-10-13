// Exporta: funções (endereço, nome, tamanho), strings definidas e a decompilação de todas as funções.
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.listing.*;
import ghidra.program.model.data.StringDataInstance;
import ghidra.program.util.DefinedStringIterator;
import java.io.*;

public class ExportAll extends GhidraScript {
  @Override public void run() throws Exception {
    String out = getScriptArgs().length > 0 ? getScriptArgs()[0] : System.getProperty("user.home") + "/hd500-re/out";
    new File(out).mkdirs();
    try (PrintWriter fl = new PrintWriter(out + "/functions.txt")) {
      for (Function f : currentProgram.getFunctionManager().getFunctions(true))
        fl.printf("%s\t%s\t%d%n", f.getEntryPoint(), f.getName(), f.getBody().getNumAddresses());
    }
    try (PrintWriter sw = new PrintWriter(out + "/strings.txt")) {
      for (Data d : DefinedStringIterator.forProgram(currentProgram)) {
        StringDataInstance s = StringDataInstance.getStringDataInstance(d);
        sw.printf("%s\t%s%n", d.getAddress(), String.valueOf(s.getStringValue()).replace("\n", "\\n"));
      }
    }
    DecompInterface di = new DecompInterface();
    di.openProgram(currentProgram);
    int n = 0;
    try (PrintWriter dw = new PrintWriter(out + "/decomp.c")) {
      for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
        if (monitor.isCancelled()) break;
        DecompileResults r = di.decompileFunction(f, 20, monitor);
        dw.printf("%n// ==== %s %s ====%n", f.getEntryPoint(), f.getName());
        if (r.decompileCompleted()) dw.println(r.getDecompiledFunction().getC());
        else dw.println("// (falhou: " + r.getErrorMessage() + ")");
        n++;
      }
    }
    println("decompiladas " + n);
  }
}
