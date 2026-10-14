// Diagnóstico e instalação assistida do acesso USB ao POD HD500, por plataforma (sem tocar no pedal).
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Classifica a mensagem de erro de conexão para a interface escolher o passo certo. */
export function classifyError(message) {
  const m = String(message ?? '');
  if (/WinUSB driver/i.test(m)) return 'driver';
  if (/No permission/i.test(m)) return 'permission';
  if (/in use|BUSY/i.test(m)) return 'busy';
  if (/not found/i.test(m)) return 'notfound';
  return m ? 'other' : null;
}

const run = (file, args, timeout = 6000) => new Promise(res =>
  execFile(file, args, { timeout, windowsHide: true }, (err, stdout) => res({ err, out: String(stdout ?? '').trim() })));

/** Windows: qual driver controla o pedal? 'winusb' | 'other' (+service) | 'absent' | 'unknown' */
let winCache = null; // o assistente consulta a cada 2 s: um PowerShell por consulta pesa; reaproveita o resultado por 4 s e junta chamadas simultâneas
export function windowsDriverState() {
  if (winCache && Date.now() - winCache.at < 4000) return winCache.p;
  const p = queryWindowsDriver(); winCache = { at: Date.now(), p };
  return p;
}
export const resetDriverCache = () => { winCache = null; };
/** Linhas "DeviceID|Service" do pedal (dispositivo inteiro e/ou interfaces MI_xx) -> estado. Com o driver de áudio da Line 6 o pedal vira UM dispositivo só (sem MI_01), por isso não basta olhar a interface 1. */
export function parseWindowsDrivers(out) {
  const rows = String(out ?? '').split(/\r?\n/).map(l => l.trim()).filter(l => /^USB\\VID_0E41/i.test(l)).map(l => { const [id, svc = ''] = l.split('|'); return { id, service: svc.trim() }; });
  if (!rows.length) return { state: 'absent' };
  if (rows.some(r => /^winusb$/i.test(r.service))) return { state: 'winusb' };
  const owner = rows.map(r => r.service).find(s => s && !/^usbccgp$/i.test(s)) ?? rows[0].service;
  return { state: 'other', service: owner };
}
async function queryWindowsDriver() {
  const script = "Get-CimInstance Win32_PnPEntity | Where-Object { $_.PNPDeviceID -like 'USB\\VID_0E41&PID_414D*' } | ForEach-Object { $_.PNPDeviceID + '|' + $_.Service }";
  const { err, out } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  if (err && !out) return { state: 'unknown' };
  return parseWindowsDrivers(out);
}

/** Caminho do Zadig empacotado (instalador) ou do clone do repositório. */
export function zadigPath() {
  const cands = [process.resourcesPath && join(process.resourcesPath, 'zadig.exe'), fileURLToPath(new URL('../build/win/zadig.exe', import.meta.url))].filter(Boolean);
  return cands.find(existsSync) ?? null;
}

/** Windows: abre o Zadig com pedido de administrador (UAC). Comando fixo, sem entrada do usuário. */
export async function launchZadig() {
  const p = zadigPath(); if (!p) throw new Error('Zadig was not found in this installation. Download it from zadig.akeo.ie.');
  const { err } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process -FilePath '${p.replace(/'/g, "''")}' -Verb RunAs`], 15000);
  if (err) throw new Error('Could not open Zadig (administrator permission denied?).');
  resetDriverCache(); // o estado muda logo depois da troca de driver
  return { started: true };
}

export const UDEV_RULE = 'SUBSYSTEM=="usb", ATTR{idVendor}=="0e41", ATTR{idProduct}=="414d", MODE="0666", TAG+="uaccess"';
export const udevInstalled = () => ['/etc/udev/rules.d/99-line6-hd500.rules', '/lib/udev/rules.d/99-line6-hd500.rules', '/usr/lib/udev/rules.d/99-line6-hd500.rules'].some(existsSync);

/** Linux: instala a regra udev pedindo a senha pelo polkit (pkexec). Conteúdo constante. */
export async function installUdevRule() {
  if (!existsSync('/usr/bin/pkexec')) throw new Error('pkexec is not available. Install the rule manually (see the README).');
  const script = `printf '%s\\n' '${UDEV_RULE}' > /etc/udev/rules.d/99-line6-hd500.rules && udevadm control --reload-rules && udevadm trigger --subsystem-match=usb --attr-match=idVendor=0e41`;
  const { err } = await run('/usr/bin/pkexec', ['/bin/sh', '-c', script], 120000);
  if (err) throw new Error('The permission rule was not installed (cancelled or denied).');
  return { installed: udevInstalled() };
}

export const canAssist = () => process.platform === 'win32' ? !!zadigPath() : process.platform === 'linux' ? existsSync('/usr/bin/pkexec') : false;
