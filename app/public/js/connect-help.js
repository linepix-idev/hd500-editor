// First-connection assistant: shows what is missing (cable, permission, driver), offers the fix, and connects by itself once it is done.
import { h, api, toast, fail } from './util.js';
import { icon } from './icons.js';

const RULE = 'sudo cp 99-line6-hd500.rules /etc/udev/rules.d/ && sudo udevadm control --reload';
const step = (ok, title, detail, action) => h('div', { class: `row cstep ${ok === true ? 'ok' : ok === false ? 'bad' : 'idle'}` },
  h('span', { class: 'cstep-mark', 'aria-hidden': 'true' }, ok === true ? icon('check') : ok === false ? icon('close') : '•'),
  h('label', {}, h('b', {}, title), detail ? h('small', { class: 'dim' }, detail) : null), action ?? null);

/** What the machine still needs, from /api/diagnose. `ready` = nothing platform-specific is missing. */
export function readiness(d) {
  if (d.platform === 'win32') return d.driver === 'winusb';
  if (d.platform === 'linux') return !!d.udev;
  return true;
}

export async function connectHelp(error, retry) {
  const root = h('div', { class: 'connect-help' });
  let working = false, wasReady = null;
  const install = async () => {
    working = true; paint(); 
    try { await api('driver/install', {}); toast(d.platform === 'win32' ? 'Zadig opened. Follow the steps, then come back here.' : 'Permission installed. Re-plug the pedal if it does not connect.'); }
    catch (e) { fail(e); }
    working = false; await refresh();
  };
  let d = {};
  const paint = () => {
    const linux = d.platform === 'linux', win = d.platform === 'win32', mac = d.platform === 'darwin';
    const action = label => h('button', { class: 'tap-btn', type: 'button', disabled: working, onClick: install }, working ? 'Working…' : label);
    const kind = d.kind ?? null;
    const steps = [
      step(!!d.visible, 'POD HD500 found on USB', d.visible ? null : 'Plug the pedal into the computer with the USB cable and switch it on.'),
      linux ? step(d.udev ?? null, 'USB permission (udev rule)', d.udev ? null : 'Needed once. Re-plug the pedal after installing.', !d.udev && d.canAssist ? action('Install permission') : null) : null,
      win ? step(d.driver === 'winusb' ? true : d.driver === 'unknown' ? null : false, 'WinUSB driver on the control interface',
        d.driver === 'winusb' ? null : 'In Zadig: Options › List All Devices, pick “POD HD500 (Interface 1)”, choose WinUSB, click Replace Driver.', d.driver !== 'winusb' && d.canAssist ? action('Open Zadig') : null) : null,
      mac ? step(d.daemon ? true : null, d.daemon ? 'Audio driver running' : 'Nothing to install', d.daemon ? null : 'If it still fails, close other programs that use the pedal.') : null,
      step(kind === 'busy' ? false : null, 'No other program using the pedal', 'Close the official Line 6 editor or any other MIDI/USB tool.'),
    ].filter(Boolean);
    const cmd = linux && !d.udev && !d.canAssist ? h('div', { class: 'ios-group' }, h('div', { class: 'row' }, h('code', { class: 'cmd' }, RULE),
      h('button', { class: 'tap-btn', type: 'button', onClick: async () => { try { await navigator.clipboard.writeText(RULE); toast('Copied.'); } catch { toast(RULE); } } }, 'Copy'))) : null;
    root.replaceChildren(
      h('h2', {}, 'Connect your POD HD500'),
      h('p', { class: 'ios-footer' }, 'The editor connects by itself as soon as the pedal is ready.'),
      h('div', { class: 'ios-group' }, steps), cmd,
      error && !d.connected ? h('p', { class: 'ios-footer connect-error' }, error) : null,
      h('div', { class: 'ios-action' }, h('button', { class: 'primary', type: 'button', onClick: retry }, 'Try again')));
  };
  const refresh = async () => {
    try { d = await api('diagnose'); } catch { return; }
    paint();
    const ready = readiness(d);
    if (wasReady === false && ready && d.visible) retry(); // the missing requirement was just fixed: connect without another click
    wasReady = ready;
  };
  await refresh();
  const timer = setInterval(() => { if (!root.isConnected) { clearInterval(timer); return; } if (!working) refresh(); }, 2000);
  return root;
}
