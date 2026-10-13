import { LiveEdits } from './live-edits.js';
import { api, fail, setApiBarrier } from './util.js';
import { S } from './store.js';
export const liveEdits = new LiveEdits(body => api('edit', body), { onError: fail });
setApiBarrier(() => liveEdits.flush());
export function optimistic() {
  if (S.st) { S.st.dirty = true; document.dispatchEvent(new Event('local-edit')); }
}
export function bindLiveInput(input, op, args, paint) {
  let dragging = false;
  input.addEventListener('pointerdown', e => { if (e.button !== 0) return; dragging = true; input.setPointerCapture(e.pointerId); liveEdits.begin(op, args()); });
  input.addEventListener('input', () => { if (!input.checkValidity()) return; paint(); optimistic(); dragging ? liveEdits.move(op, args()) : liveEdits.end(op, args()); });
  const end = () => { if (!dragging) return; dragging = false; if (!input.checkValidity()) { liveEdits.flush(); return; } paint(); liveEdits.end(op, args()); };
  input.addEventListener('pointerup', end);
  input.addEventListener('pointercancel', end);
  input.addEventListener('lostpointercapture', end);
  input.addEventListener('blur', end);
  return () => { paint(); optimistic(); liveEdits.end(op, args()); };
}
