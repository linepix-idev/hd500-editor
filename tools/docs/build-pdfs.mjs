#!/usr/bin/env node
// Gera os PDFs de instalação e uso (um por sistema e idioma) em docs/pdf/. Uso: node tools/docs/build-pdfs.mjs
// Precisa do Chrome/Chromium (CHROME=/caminho se não estiver no lugar padrão) e de puppeteer-core.
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('../../', import.meta.url));
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
const shot = 'data:image/png;base64,' + readFileSync(resolve(root, 'docs/img/editor.png')).toString('base64');
const chrome = process.env.CHROME ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
if (!chrome) throw new Error('Chrome/Chromium not found (set CHROME=...)');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const ul = a => `<ul>${a.map(i => `<li>${i}</li>`).join('')}</ul>`;
const ol = a => `<ol>${a.map(i => `<li>${i}</li>`).join('')}</ol>`;

const T = {
  'pt-BR': {
    doc: 'Guia de instalação e uso', ver: 'Versão', beta: 'beta', os: { linux: 'Linux (Ubuntu/Debian)', win: 'Windows', mac: 'macOS' },
    h: { what: 'O que é', install: 'Instalação', limits: 'Limitações', usage: 'Como usar', safety: 'Segurança dos seus presets', trouble: 'Problemas comuns', notaff: 'Não afiliado' },
    what: 'O HD500 Editor é um editor gratuito e aberto para o Line 6 POD HD500, com conexão direta por USB. Edita amps, cabs, efeitos, mixer, footswitches e pedais de expressão ao vivo, e organiza as 8 bibliotecas de 64 presets.',
    usage: [
      ['Conectar', 'Ligue o pedal, conecte o cabo USB e abra o programa. Ele conecta sozinho; se faltar algo, o assistente de conexão mostra o passo e o botão para resolver.'],
      ['Escolher e editar', 'Escolha o preset na barra lateral (atalho <b>B</b> abre a biblioteca, <b>L</b> busca em todos). Clique num bloco da cadeia para editar parâmetros; arraste blocos entre antes e depois do amp e entre os caminhos A e B (<b>Alt + setas</b> move pelo teclado).'],
      ['Edição ao vivo', 'Com <b>Edição ao vivo</b> ligada, cada ajuste soa no pedal na hora. Nada é gravado na memória do pedal até você tocar em <b>Salvar no pedal</b>.'],
      ['Comparar e desfazer', '<b>Comparar</b> alterna entre a versão salva e as suas edições. Desfazer e refazer estão na barra superior.'],
      ['Andamento', 'O botão <b>Tap</b> (ou a tecla <b>T</b>) define o tempo do preset; mudar o tempo no pedal atualiza o editor.'],
      ['Biblioteca', 'No menu <b>…</b> da barra lateral: renomear sets, copiar, trocar, limpar, arrastar entre posições, exportar e importar a biblioteca inteira e presets <b>.h5e</b> oficiais.'],
      ['Backups', 'Antes de qualquer gravação o conteúdo anterior da posição é guardado. Arquivo ▸ Backups restaura.'],
      ['IA (opcional)', 'Em Configurações do pedal há um interruptor para o assistente de IA (MCP). Desligado por padrão para quem não usa.'],
    ],
    safetyT: ['As edições só mexem no buffer de edição; a memória do pedal só muda quando você salva.', 'Trocar de preset com edições não salvas pede confirmação.', 'Cada gravação faz backup automático do que havia na posição.'],
    trouble: [
      ['“POD HD500 não encontrado”', 'Cabo USB, pedal ligado, outro programa usando o pedal (feche o editor oficial da Line 6).'],
      ['“Sem permissão” (Linux)', 'Instale a regra udev (botão no assistente ou ver Instalação) e reconecte o cabo.'],
      ['“Driver WinUSB” (Windows)', 'Rode o Zadig como descrito na Instalação. Se o driver de áudio da Line 6 estiver instalado, ele ocupa o pedal e o editor não conecta.'],
      ['O app diz conectado mas nada responde', 'Desconecte e reconecte o cabo; o app recupera a conexão sozinho.'],
    ],
    notaff: 'Programa independente, sem vínculo com a Line 6 ou a Yamaha Guitar Group. Nomes de marcas pertencem aos seus donos.',
    p: {
      linux: {
        install: [ol(['Baixe o <b>.deb</b> (recomendado em Ubuntu/Debian) ou o <b>.AppImage</b> na página de versões do projeto.', 'Com o .deb: <code>sudo apt install ./HD500-Editor-&lt;versão&gt;.deb</code>. A regra de acesso ao pedal (udev) já é instalada.', 'Com o AppImage (precisa de <code>libfuse2</code>/<code>libfuse2t64</code>): instale a regra uma vez — o assistente do app faz isso com a sua senha, ou rode <code>sudo cp 99-line6-hd500.rules /etc/udev/rules.d/ &amp;&amp; sudo udevadm control --reload</code>.', 'Desligue e ligue o cabo USB do pedal, abra o HD500 Editor.']), '<p>Desinstalar o .deb remove a regra udev.</p>'],
        limits: ['<b>Áudio:</b> o pedal funciona como placa de som pelo driver do kernel, inclusive com o editor aberto. Para gravar a entrada, abra a reprodução ao mesmo tempo (as DAWs fazem isso sozinhas); só capturar, sem reprodução aberta, dá erro de I/O.', '<b>Regra udev:</b> libera o acesso USB ao pedal para os usuários locais.', 'Testado em Ubuntu com um POD HD500 real. Outras distribuições devem funcionar, sem garantia.'],
      },
      win: {
        install: [ol(['Baixe o <b>Setup</b> (<code>HD500-Editor-Setup-&lt;versão&gt;.exe</code>) ou o <b>portable</b>.', 'O Windows pode mostrar “editor desconhecido” (SmartScreen), porque o instalador ainda não é assinado: <b>Mais informações ▸ Executar assim mesmo</b>.', 'No fim, o instalador oferece o <b>Zadig</b> (incluso). No Zadig: <b>Options ▸ List All Devices</b>, escolha <b>POD HD500</b> (ou “Interface 1”, se aparecer), driver <b>WinUSB</b>, <b>Replace Driver</b>. O Windows pede permissão de administrador.', 'Abra o HD500 Editor. Se ainda faltar algo, o assistente de conexão mostra o passo e tem o botão <b>Abrir o Zadig</b>.']), '<p>Também dá para fazer o passo do Zadig depois, pelo assistente do app.</p>'],
        limits: ['<b>Áudio OU editor:</b> no Windows o pedal é placa de som (driver oficial da Line 6) <i>ou</i> é editável no HD500 Editor (WinUSB), nunca os dois ao mesmo tempo. Com o WinUSB o editor conecta, mas o pedal deixa de ser placa de som. Com o driver da Line 6 o pedal vira placa de som, mas o editor não conecta.', 'Para voltar ao áudio: reinstale o driver da Line 6 em <b>line6.com/software</b> (versão <b>4.2.7.6</b> recomendada; a 4.2.7.7 tem problema reportado pelo suporte da Line 6). O botão “Baixar o driver de áudio da Line 6” do assistente abre a página.', 'Para voltar a editar: rode o Zadig de novo (Abrir o Zadig no assistente).', '<b>Sem assinatura de código:</b> o SmartScreen avisa na instalação.', 'Testado no Windows 10 (máquina virtual) com um POD HD500 real; Windows 11 não testado.'],
      },
      mac: {
        install: [ol(['Baixe o <b>.dmg</b>: <code>-mac-arm64</code> (Apple Silicon) ou <code>-mac-x64</code> (Intel).', 'Abra o .dmg e arraste o app para <b>Aplicativos</b>.', 'Na primeira abertura, o macOS bloqueia (o app não é assinado): <b>clique com o botão direito no app ▸ Abrir ▸ Abrir</b>.', 'Se disser que o app está “danificado”, rode uma vez no Terminal: <code>xattr -cr "/Applications/HD500 Editor.app"</code>.', 'Conecte o pedal e abra o HD500 Editor.']), '<p>Para ouvir o som do Mac no pedal existe um pacote separado, o <b>hd500-audio</b> (veja Limitações).</p>'],
        limits: ['<b>Sem assinatura da Apple:</b> a confirmação “clique direito ▸ Abrir” pode se repetir a cada atualização.', '<b>Áudio:</b> o driver oficial da Line 6 não carrega no macOS atual. O pacote separado <b>hd500-audio</b> toca o som do computador no pedal (só saída), e o macOS pede permissão de captura de áudio na primeira vez.', '<b>Entrada de áudio e o pedal em Ajustes ▸ Som</b> (gravar a guitarra na DAW) ainda não funcionam: dependem de um certificado Apple Developer ID.', 'Com o hd500-audio instalado, o editor e o áudio funcionam ao mesmo tempo.', 'Testado em macOS (Apple Silicon) com um POD HD500 real.'],
      },
    },
  },
  en: {
    doc: 'Installation and user guide', ver: 'Version', beta: 'beta', os: { linux: 'Linux (Ubuntu/Debian)', win: 'Windows', mac: 'macOS' },
    h: { what: 'What it is', install: 'Installation', limits: 'Limitations', usage: 'How to use it', safety: 'Your presets are safe', trouble: 'Common problems', notaff: 'Not affiliated' },
    what: 'HD500 Editor is a free, open editor for the Line 6 POD HD500 that talks to the pedal directly over USB. It edits amps, cabs, effects, mixer, footswitches and expression pedals live, and manages the 8 libraries of 64 presets.',
    usage: [
      ['Connect', 'Switch the pedal on, plug in the USB cable and open the program. It connects by itself; if something is missing, the connection assistant shows the step and a button to fix it.'],
      ['Pick and edit', 'Choose a preset in the sidebar (<b>B</b> opens the library, <b>L</b> searches all presets). Click a block in the chain to edit its parameters; drag blocks before/after the amp and between paths A and B (<b>Alt + arrows</b> moves by keyboard).'],
      ['Live editing', 'With <b>Live editing</b> on, every change is heard on the pedal at once. Nothing is written to the pedal’s memory until you press <b>Save to pedal</b>.'],
      ['Compare and undo', '<b>Compare</b> switches between the saved version and your edits. Undo and redo are in the top bar.'],
      ['Tempo', 'The <b>Tap</b> button (or the <b>T</b> key) sets the preset tempo; changing the tempo on the pedal updates the editor.'],
      ['Library', 'In the sidebar’s <b>…</b> menu: rename sets, copy, swap, clear, drag between slots, export and import the whole library and official <b>.h5e</b> presets.'],
      ['Backups', 'Before every write the slot’s previous content is stored. File ▸ Backups restores it.'],
      ['AI (optional)', 'Pedal settings has a switch for the AI assistant (MCP). Leave it off if you do not use it.'],
    ],
    safetyT: ['Edits only touch the edit buffer; the pedal’s memory changes only when you save.', 'Switching presets with unsaved edits asks first.', 'Every write backs up what was in the slot.'],
    trouble: [
      ['“POD HD500 not found”', 'USB cable, pedal switched on, another program using the pedal (close Line 6’s official editor).'],
      ['“No permission” (Linux)', 'Install the udev rule (assistant button, or see Installation) and re-plug the cable.'],
      ['“WinUSB driver” (Windows)', 'Run Zadig as described under Installation. If Line 6’s audio driver is installed it owns the pedal and the editor cannot connect.'],
      ['The app says connected but nothing answers', 'Unplug and re-plug the cable; the app recovers the connection by itself.'],
    ],
    notaff: 'Independent program, not affiliated with Line 6 or Yamaha Guitar Group. Brand names belong to their owners.',
    p: {
      linux: {
        install: [ol(['Download the <b>.deb</b> (recommended on Ubuntu/Debian) or the <b>.AppImage</b> from the project’s releases page.', 'With the .deb: <code>sudo apt install ./HD500-Editor-&lt;version&gt;.deb</code>. The udev rule that gives access to the pedal is installed for you.', 'With the AppImage (needs <code>libfuse2</code>/<code>libfuse2t64</code>): install the rule once — the app’s assistant does it with your password, or run <code>sudo cp 99-line6-hd500.rules /etc/udev/rules.d/ &amp;&amp; sudo udevadm control --reload</code>.', 'Unplug and re-plug the pedal’s USB cable, then open HD500 Editor.']), '<p>Uninstalling the .deb removes the udev rule.</p>'],
        limits: ['<b>Audio:</b> the pedal works as a sound card through the kernel driver, including while the editor is open. To record the input, open playback at the same time (DAWs do this on their own); capturing alone, with no playback open, gives an I/O error.', '<b>udev rule:</b> it grants local users USB access to the pedal.', 'Tested on Ubuntu with a real POD HD500. Other distributions should work, with no guarantee.'],
      },
      win: {
        install: [ol(['Download the <b>Setup</b> (<code>HD500-Editor-Setup-&lt;version&gt;.exe</code>) or the <b>portable</b> build.', 'Windows may show “unknown publisher” (SmartScreen) because the installer is not signed yet: <b>More info ▸ Run anyway</b>.', 'At the end the installer offers <b>Zadig</b> (bundled). In Zadig: <b>Options ▸ List All Devices</b>, pick <b>POD HD500</b> (or “Interface 1” if listed), driver <b>WinUSB</b>, <b>Replace Driver</b>. Windows asks for administrator permission.', 'Open HD500 Editor. If something is still missing, the connection assistant shows the step and has an <b>Open Zadig</b> button.']), '<p>You can also do the Zadig step later from the app’s assistant.</p>'],
        limits: ['<b>Audio OR editor:</b> on Windows the pedal is either a sound card (Line 6’s official driver) <i>or</i> editable in HD500 Editor (WinUSB), never both at once. With WinUSB the editor connects but the pedal stops being a sound card. With Line 6’s driver the pedal is a sound card but the editor cannot connect.', 'To get audio back: reinstall Line 6’s driver from <b>line6.com/software</b> (version <b>4.2.7.6</b> recommended; 4.2.7.7 has an issue reported by Line 6 support). The assistant’s “Get the Line 6 audio driver” button opens the page.', 'To edit again: run Zadig again (Open Zadig in the assistant).', '<b>No code signing:</b> SmartScreen warns during installation.', 'Tested on Windows 10 (virtual machine) with a real POD HD500; Windows 11 not tested.'],
      },
      mac: {
        install: [ol(['Download the <b>.dmg</b>: <code>-mac-arm64</code> (Apple Silicon) or <code>-mac-x64</code> (Intel).', 'Open the .dmg and drag the app to <b>Applications</b>.', 'The first time, macOS blocks it (the app is not signed): <b>right-click the app ▸ Open ▸ Open</b>.', 'If it says the app is “damaged”, run once in Terminal: <code>xattr -cr "/Applications/HD500 Editor.app"</code>.', 'Plug in the pedal and open HD500 Editor.']), '<p>To hear the Mac’s sound through the pedal there is a separate package, <b>hd500-audio</b> (see Limitations).</p>'],
        limits: ['<b>Not signed by Apple:</b> the “right-click ▸ Open” confirmation may repeat after each update.', '<b>Audio:</b> Line 6’s official driver does not load on current macOS. The separate <b>hd500-audio</b> package plays the computer’s sound through the pedal (output only), and macOS asks for audio-capture permission the first time.', '<b>Audio input and the pedal under System Settings ▸ Sound</b> (recording the guitar in a DAW) do not work yet: they need an Apple Developer ID certificate.', 'With hd500-audio installed, the editor and the audio work at the same time.', 'Tested on macOS (Apple Silicon) with a real POD HD500.'],
      },
    },
  },
};

const css = `@page{size:A4;margin:18mm 16mm}*{box-sizing:border-box}body{font:10.5pt/1.5 -apple-system,"Helvetica Neue",Arial,sans-serif;color:#1d1d1f;margin:0}
h1{font-size:23pt;margin:0 0 2pt;letter-spacing:-.02em}h2{font-size:13.5pt;margin:16pt 0 5pt;padding-top:8pt;border-top:1px solid #d2d2d7;break-after:avoid}
.sub{color:#6e6e73;margin:0 0 10pt}.tag{display:inline-block;background:#0071e3;color:#fff;border-radius:99px;padding:1pt 8pt;font-size:9pt;margin-left:6pt;vertical-align:middle}
img{width:72%;display:block;border-radius:8px;border:1px solid #d2d2d7;margin:6pt 0}ul,ol{margin:4pt 0 4pt 16pt;padding:0}li{margin:3pt 0}code{background:#f2f2f5;padding:1pt 4pt;border-radius:4px;font:9pt ui-monospace,Menlo,monospace;word-break:break-all}
.warn{background:#fff6e5;border:1px solid #ffcc66;border-radius:10px;padding:2pt 12pt;break-inside:avoid}.warn h2{border:0;margin:8pt 0 2pt;padding:0}
table{width:100%;border-collapse:collapse;font-size:10pt}td{border-top:1px solid #e5e5ea;padding:5pt 6pt;vertical-align:top}td:first-child{width:34%;font-weight:600}
dl{margin:0}dt{font-weight:600;margin-top:5pt}dd{margin:0 0 0 0}.foot{color:#6e6e73;font-size:9pt;margin-top:14pt}`;

const html = (lang, os) => {
  const t = T[lang], p = t.p[os];
  return `<!doctype html><html lang="${lang}"><meta charset="utf-8"><style>${css}</style><body>
<h1>HD500 Editor<span class="tag">${esc(t.os[os])}</span></h1><p class="sub">${t.doc} · ${t.ver} ${version} (${t.beta})</p>
<p>${t.what}</p><img src="${shot}" alt="">
<div class="warn"><h2>${t.h.limits}</h2>${ul(p.limits)}</div>
<h2>${t.h.install}</h2>${p.install.join('')}
<h2>${t.h.usage}</h2><dl>${t.usage.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>
<h2>${t.h.safety}</h2>${ul(t.safetyT)}
<h2>${t.h.trouble}</h2><table>${t.trouble.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>
<p class="foot">${t.notaff}</p></body></html>`;
};

mkdirSync(resolve(root, 'docs/pdf'), { recursive: true });
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
try {
  for (const lang of Object.keys(T)) for (const os of ['linux', 'win', 'mac']) {
    const page = await browser.newPage();
    await page.setContent(html(lang, os), { waitUntil: 'load' });
    const name = `HD500-Editor-${{ linux: 'Linux', win: 'Windows', mac: 'macOS' }[os]}-${lang}.pdf`;
    await page.pdf({ path: resolve(root, 'docs/pdf', name), format: 'A4', printBackground: true, preferCSSPageSize: true });
    await page.close(); console.log('docs/pdf/' + name);
  }
} finally { await browser.close(); }
