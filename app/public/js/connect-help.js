// First-connection assistant: shows what is missing (cable, permission, driver) instead of a raw error.
import { h, api, toast } from './util.js';
import { icon } from './icons.js';

const RULE = 'sudo cp 99-line6-hd500.rules /etc/udev/rules.d/ && sudo udevadm control --reload';
const step = (ok, title, detail) => h('div', { class: `row cstep ${ok === true ? 'ok' : ok === false ? 'bad' : 'idle'}` },
  h('span', { class: 'cstep-mark', 'aria-hidden': 'true' }, ok === true ? icon('check') : ok === false ? icon('close') : '•'),
  h('label', {}, h('b', {}, title), detail ? h('small', { class: 'dim' }, detail) : null));

export async function connectHelp(error, retry) {
  let d = {}; try { d = await api('diagnose'); } catch {}
  const linux = d.platform === 'linux', win = d.platform === 'win32', mac = d.platform === 'darwin';
  const steps = [
    step(!!d.visible, 'POD HD500 found on USB', d.visible ? null : 'Plug the pedal into the computer with the USB cable and switch it on.'),
    linux ? step(d.udev ?? null, 'USB permission (udev rule)', d.udev ? null : 'Install the rule once, then unplug and plug the pedal again.') : null,
    win ? step(null, 'WinUSB driver on the control interface', 'Bind “POD HD500 (Interface 1)” to WinUSB with Zadig (see the README).') : null,
    mac ? step(null, 'Nothing to install', 'If it still fails, close other programs that use the pedal.') : null,
    step(/in use|BUSY/i.test(error ?? '') ? false : null, 'No other program using the pedal', 'Close the official Line 6 editor or any other MIDI/USB tool.'),
  ].filter(Boolean);
  const cmd = linux && !d.udev ? h('div', { class: 'ios-group' }, h('div', { class: 'row' }, h('code', { class: 'cmd' }, RULE),
    h('button', { class: 'tap-btn', type: 'button', onClick: async () => { try { await navigator.clipboard.writeText(RULE); toast('Copied.'); } catch { toast(RULE); } } }, 'Copy'))) : null;
  return h('div', { class: 'connect-help' },
    h('h2', {}, 'Connect your POD HD500'),
    h('p', { class: 'ios-footer' }, 'The editor connects by itself as soon as the pedal is ready.'),
    h('div', { class: 'ios-group' }, steps), cmd,
    error ? h('p', { class: 'ios-footer connect-error' }, error) : null,
    h('div', { class: 'ios-action' }, h('button', { class: 'primary', type: 'button', onClick: retry }, 'Try again')));
}
