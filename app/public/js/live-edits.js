// Transport-independent scheduler: latest value per parameter, one request in flight.
export const editKey = b => b.op === 'range' ? `range:${b.item}:${b.index}` : b.op === 'param' ? `param:${b.item}:${b.id}` : b.op === 'cabParam' ? `cab:${b.item}:${b.index}` : b.op === 'tempo' ? 'setup:23' : b.op === 'active' ? `active:${b.item}` : `setup:${b.id}`;
export class LiveEdits {
  constructor(send, { frame = f => requestAnimationFrame(f), onError = () => {}, now = () => Date.now() } = {}) {
    this.send = send; this.frame = frame; this.onError = onError; this.now = now;
    this.live = true; this.controls = new Map(); this.recent = new Map(); this.waiters = [];
  }
  begin(op, args) {
    const key = editKey({ op, ...args });
    const state = this.controls.get(key) ?? { segments: [], busy: false, scheduled: false };
    this.controls.set(key, state);
    if (!state.segments.at(-1) || state.segments.at(-1).ended) state.segments.push({ pending: null, started: false, ended: false });
    return state;
  }
  move(op, args) {
    const state = this.begin(op, args), segment = state.segments.at(-1);
    segment.pending = { op, ...args }; segment.latest = segment.pending;
    if (this.live) this.schedule(state);
  }
  end(op, args) {
    const state = this.begin(op, args), segment = state.segments.at(-1);
    segment.pending = { op, ...args }; segment.latest = segment.pending; segment.ended = true;
    this.schedule(state);
  }
  schedule(state) {
    if (state.busy || state.scheduled) return;
    state.scheduled = true;
    this.frame(() => {
      state.scheduled = false;
      if (!state.segments[0]?.ended && this.now() - (state.lastSent ?? -Infinity) < 17) { this.schedule(state); return; }
      this.pump(state);
    });
  }
  pump(state) {
    const segment = state.segments[0];
    if (state.busy || !segment?.pending || (!this.live && !segment.ended)) return;
    const body = { ...segment.pending, gesture: segment.ended ? 'end' : segment.started ? 'move' : 'start' };
    segment.pending = null; segment.started = true; state.busy = true; state.lastSent = this.now();
    const key = editKey(body); this.recent.set(key, this.now() + 600);
    Promise.resolve().then(() => this.send(body)).catch(this.onError).finally(() => {
      state.busy = false; this.recent.set(key, this.now() + 600);
      if (body.gesture === 'end') state.segments.shift();
      if (state.segments.length) this.schedule(state);
      else { this.controls.delete(key); this.resolveWaiters(); }
    });
  }
  ignores(key) { return this.controls.has(key) || (this.recent.get(key) ?? 0) > this.now(); }
  get pending() { return this.controls.size > 0; }
  setLive(on) { this.live = on; if (on) for (const state of this.controls.values()) this.schedule(state); }
  flush() {
    for (const state of this.controls.values()) {
      const segment = state.segments.at(-1);
      if (segment.pending || segment.started) { segment.ended = true; segment.pending ??= segment.latest; }
      // An untouched pointer-down has nothing to send.
      if (!segment.started && !segment.pending) state.segments.pop();
      if (!state.segments.length && !state.busy) {
        for (const [key, entry] of this.controls) if (entry === state) this.controls.delete(key);
      } else this.schedule(state);
    }
    if (!this.pending) return Promise.resolve();
    return new Promise(resolve => this.waiters.push(resolve));
  }
  resolveWaiters() { if (!this.pending) this.waiters.splice(0).forEach(resolve => resolve()); }
}
