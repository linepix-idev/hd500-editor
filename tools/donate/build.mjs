#!/usr/bin/env node
// Gera o Pix de apoio ao projeto: payload "copia e cola" (BR Code estático), QR em SVG, os dados do app e o site estático.
// A chave é pública por natureza (aparece no site e no app). Para trocar: edite PIX abaixo e rode `node tools/donate/build.mjs`.
// Saídas: app/public/js/donate-data.js, app/public/pix-qr.svg, site/{index,en}.html, site/pix-qr.svg, site/pdf/*.pdf
import { mkdirSync, writeFileSync, copyFileSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import QRCode from 'qrcode';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = (...p) => resolve(root, ...p);
const version = JSON.parse(readFileSync(out('package.json'), 'utf8')).version;

export const PIX = { key: '06ae28e6-4a7d-4a5b-9f24-140d47d9163e', name: 'Moises Lima Gomes', city: 'Guarai' }; // chave aleatória (EVP); nome ≤ 25 e cidade ≤ 15, sem acento
const REPO = 'https://github.com/linepix-idev/hd500-editor';

const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
export function crc16(s) { let c = 0xFFFF; for (const ch of Buffer.from(s, 'ascii')) { c ^= ch << 8; for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; } return c.toString(16).toUpperCase().padStart(4, '0'); }
export function pixPayload({ key, name, city }) {
  if (name.length > 25 || city.length > 15 || /[^\x20-\x7E]/.test(name + city)) throw new Error('nome/cidade fora do limite do BR Code');
  const body = tlv('00', '01') + tlv('01', '11') + tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', key)) + tlv('52', '0000') + tlv('53', '986') + tlv('58', 'BR') + tlv('59', name) + tlv('60', city) + tlv('62', tlv('05', '***')) + '6304';
  return body + crc16(body);
}

const payload = pixPayload(PIX);
const svg = await QRCode.toString(payload, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' });
await QRCode.toFile(out('docs/img/pix-qr.png'), payload, { margin: 2, scale: 8, errorCorrectionLevel: 'M' }); // só para conferir a leitura; não é publicado

writeFileSync(out('app/public/pix-qr.svg'), svg);
writeFileSync(out('app/public/js/donate-data.js'), `// Gerado por tools/donate/build.mjs — não edite à mão.\nexport const PIX = ${JSON.stringify({ ...PIX, payload }, null, 2)};\n`);

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const L = {
  'pt-BR': {
    file: 'index.html', other: ['en.html', 'English'], lang: 'pt-BR',
    title: 'HD500 Editor — editor gratuito para o Line 6 POD HD500',
    desc: 'Editor gratuito e aberto para o Line 6 POD HD500, para Linux, Windows e macOS.',
    lead: 'Editor gratuito e aberto para o <b>Line 6 POD HD500</b>, agora que o software oficial não é mais mantido. Funciona no Linux, Windows e macOS e fala direto com o pedal por USB.',
    dl: 'Baixar', dlText: 'As versões ficam na página de lançamentos do projeto.', dlBtn: 'Ver versões', beta: 'Versão atual: ' + version + ' (beta)',
    sys: 'Sistemas e limitações',
    rows: [
      ['Linux', 'Editor e áudio USB funcionam juntos. Pacote .deb ou AppImage.', 'Linux'],
      ['Windows', 'O pedal é placa de som (driver oficial da Line 6) <i>ou</i> editável no app (WinUSB), nunca os dois ao mesmo tempo. Instalador sem assinatura: o SmartScreen avisa.', 'Windows'],
      ['macOS', 'O editor funciona. Instalador sem assinatura da Apple (clique direito ▸ Abrir). Entrada de áudio e o pedal em Ajustes ▸ Som dependem de um certificado Apple e ainda não funcionam.', 'macOS'],
    ],
    guide: 'Guia em PDF', features: 'O que faz',
    feats: ['Grafo de sinal: arraste efeitos antes/depois do amp e entre os caminhos A e B.', 'Edição ao vivo de todos os amps, cabs e efeitos, mixer, footswitches e pedais de expressão.', '8 sets × 64 presets: renomear, copiar, trocar, exportar e importar (.h5e), com backup automático antes de cada gravação.', 'Nada é gravado na memória do pedal até você tocar em “Salvar no pedal”.'],
    don: 'Apoie o projeto', donText: 'O HD500 Editor é gratuito. Se ele te ajudou, uma doação por Pix ajuda a mantê-lo. É voluntária, não dá direito a nada e não cria vínculo.',
    scan: 'Aponte a câmera do app do seu banco para o QR code, ou copie a chave abaixo.', keyL: 'Chave Pix (aleatória)', codeL: 'Pix copia e cola', recv: 'Recebedor', check: 'Confira se o nome no app do seu banco é o do recebedor antes de confirmar.',
    foot: 'Projeto independente, sem vínculo com a Line 6 ou a Yamaha Guitar Group. Licença MIT.', code: 'Código-fonte',
  },
  en: {
    file: 'en.html', other: ['index.html', 'Português'], lang: 'en',
    title: 'HD500 Editor — free editor for the Line 6 POD HD500',
    desc: 'A free, open editor for the Line 6 POD HD500, for Linux, Windows and macOS.',
    lead: 'A free, open editor for the <b>Line 6 POD HD500</b>, now that the official software is no longer maintained. Runs on Linux, Windows and macOS and talks to the pedal directly over USB.',
    dl: 'Download', dlText: 'Releases live on the project’s releases page.', dlBtn: 'See releases', beta: 'Current version: ' + version + ' (beta)',
    sys: 'Systems and limitations',
    rows: [
      ['Linux', 'Editor and USB audio work together. .deb package or AppImage.', 'Linux'],
      ['Windows', 'The pedal is either a sound card (Line 6’s official driver) <i>or</i> editable in the app (WinUSB), never both at once. Unsigned installer: SmartScreen warns.', 'Windows'],
      ['macOS', 'The editor works. Installer not signed by Apple (right-click ▸ Open). Audio input and the pedal under System Settings ▸ Sound need an Apple certificate and do not work yet.', 'macOS'],
    ],
    guide: 'PDF guide', features: 'What it does',
    feats: ['Signal graph: drag effects before/after the amp and between paths A and B.', 'Live editing of every amp, cab and effect, mixer, footswitches and expression pedals.', '8 sets × 64 presets: rename, copy, swap, export and import (.h5e), with an automatic backup before every write.', 'Nothing is written to the pedal’s memory until you press “Save to pedal”.'],
    don: 'Support the project', donText: 'HD500 Editor is free. If it helped you, a Pix donation (Brazil) helps keep it maintained. It is voluntary, entitles you to nothing and creates no relationship.',
    scan: 'Point your banking app’s camera at the QR code, or copy the key below.', keyL: 'Pix key (random)', codeL: 'Pix copy and paste', recv: 'Receiver', check: 'Check that the name in your banking app matches the receiver before confirming.',
    foot: 'Independent project, not affiliated with Line 6 or Yamaha Guitar Group. MIT license.', code: 'Source code',
  },
};

const css = `:root{color-scheme:light dark;--bg:#fff;--fg:#1d1d1f;--mut:#6e6e73;--card:#f5f5f7;--line:#d2d2d7;--acc:#0071e3}
@media(prefers-color-scheme:dark){:root{--bg:#000;--fg:#f5f5f7;--mut:#a1a1a6;--card:#1c1c1e;--line:#38383a;--acc:#2997ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 20px 64px}header{display:flex;justify-content:space-between;align-items:center;gap:12px}
h1{font-size:40px;line-height:1.1;letter-spacing:-.02em;margin:28px 0 8px}h2{font-size:24px;margin:44px 0 8px;letter-spacing:-.01em}
p{margin:8px 0}.mut{color:var(--mut)}a{color:var(--acc)}.lang{font-size:15px}
.btn{display:inline-block;background:var(--acc);color:#fff;text-decoration:none;border-radius:980px;padding:11px 22px;margin-top:10px;font-weight:600}
.card{background:var(--card);border-radius:18px;padding:18px 20px;margin:12px 0}.card h3{margin:0 0 4px;font-size:18px}
ul{padding-left:20px}li{margin:6px 0}code,.key{font:14px ui-monospace,Menlo,Consolas,monospace;word-break:break-all}
.pix{display:grid;grid-template-columns:200px 1fr;gap:20px;align-items:center}.pix img{width:200px;height:200px;background:#fff;border-radius:14px;padding:8px}
.key{display:block;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:4px 0 12px;user-select:all}
@media(max-width:560px){h1{font-size:32px}.pix{grid-template-columns:1fr;justify-items:center}}

.os{display:flex;gap:28px;margin:18px 0 4px;align-items:center}.os span{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:14px;color:var(--mut)}.os svg{width:40px;height:40px;fill:var(--fg)}
footer{margin-top:48px;color:var(--mut);font-size:14px}`;

const icon = n => readFileSync(out('tools/donate/icons', n + '.svg'), 'utf8').replace(/<title>.*?<\/title>/, '').replace('<svg ', '<svg aria-hidden="true" ');
const osRow = `<div class="os">${[['linux', 'Linux'], ['windows', 'Windows'], ['apple', 'macOS']].map(([n, l]) => `<span>${icon(n)}${l}</span>`).join('')}</div>`;

const page = c => `<!doctype html>
<html lang="${c.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer"><title>${esc(c.title)}</title><meta name="description" content="${esc(c.desc)}"><style>${css}</style></head>
<body><main>
<header><b>HD500 Editor</b><a class="lang" href="${c.other[0]}" hreflang="${c.other[1] === 'English' ? 'en' : 'pt-BR'}">${c.other[1]}</a></header>
<h1>HD500 Editor</h1><p>${c.lead}</p>${osRow}
<h2>${c.dl}</h2><p>${c.dlText}</p><p class="mut">${c.beta}</p><a class="btn" href="${REPO}/releases/latest" rel="noopener noreferrer">${c.dlBtn}</a>
<h2>${c.features}</h2><ul>${c.feats.map(f => `<li>${f}</li>`).join('')}</ul>
<h2>${c.sys}</h2>${c.rows.map(([n, d, f]) => `<div class="card"><h3>${n}</h3><p>${d}</p><p><a href="pdf/HD500-Editor-${f}-${c.lang === 'en' ? 'en' : 'pt-BR'}.pdf">${c.guide} — ${n}</a></p></div>`).join('')}
<h2>${c.don}</h2><p>${c.donText}</p>
<div class="card pix"><img src="pix-qr.svg" alt="QR code Pix" width="200" height="200"><div>
<p>${c.scan}</p><p class="mut">${c.keyL}</p><span class="key">${esc(PIX.key)}</span><p class="mut">${c.codeL}</p><span class="key">${esc(payload)}</span><p class="mut">${c.recv}: <b>${esc(PIX.name)}</b></p></div></div>
<p class="mut">${c.check}</p>
<footer><p>${c.foot} <a href="${REPO}" rel="noopener noreferrer">${c.code}</a></p></footer>
</main></body></html>
`;

mkdirSync(out('site/pdf'), { recursive: true });
for (const c of Object.values(L)) writeFileSync(out('site', c.file), page(c));
writeFileSync(out('site/pix-qr.svg'), svg);
for (const f of readdirSync(out('docs/pdf'))) if (f.endsWith('.pdf')) copyFileSync(out('docs/pdf', f), out('site/pdf', f));
console.log('Pix payload:', payload);
