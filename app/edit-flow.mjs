import { editKey } from './public/js/live-edits.js';
export const FAST_EDITS = new Set(['param', 'cabParam', 'setup', 'setupF', 'tempo', 'active', 'range']);

// One device operation at a time. Only pending moves may be replaced; ends and
// other commands are ordering barriers (save/undo/model/selection cannot overtake).
export class EditQueue {
  constructor() { this.jobs = []; this.running = false; this.moves = new Map(); }
  enqueue(run, edit) {
    const key = edit?.gesture === 'move' ? editKey(edit) : null;
    if (!key) this.moves.clear();
    return new Promise((resolve, reject) => {
      const pending = key && this.moves.get(key);
      if (pending) { pending.run = run; pending.waiters.push({ resolve, reject }); }
      else {
        const job = { run, key, waiters: [{ resolve, reject }] };
        this.jobs.push(job); if (key) this.moves.set(key, job);
      }
      this.pump();
    });
  }
  async pump() {
    if (this.running) return;
    this.running = true;
    while (this.jobs.length) {
      const job = this.jobs.shift();
      if (this.moves.get(job.key) === job) this.moves.delete(job.key);
      try { const result = await job.run(); job.waiters.forEach(w => w.resolve(result)); }
      catch (error) { job.waiters.forEach(w => w.reject(error)); }
    }
    this.running = false;
  }
  drain() { return this.enqueue(() => {}); }
}

// No copies or history pushes for move ticks. Commit the baseline once, then
// one final snapshot when all open gestures end.
export class GestureHistory {
  constructor(capture, changed = () => {}) { this.capture = capture; this.changed = changed; this.reset(); }
  reset() { this.list = []; this.idx = -1; this.gestures = new Set(); this.push(); }
  push() {
    const body = this.capture(); if (!body) return;
    if (this.idx >= 0 && Buffer.compare(this.list[this.idx], body) === 0) return;
    this.list = this.list.slice(0, this.idx + 1); this.list.push(Buffer.from(body));
    if (this.list.length > 200) this.list.shift();
    this.idx = this.list.length - 1;
  }
  before(edit) {
    if (edit.op === 'undo' || edit.op === 'redo') { this.gestures.clear(); this.push(); return; }
    if (edit.gesture) {
      const key = editKey(edit);
      if (!this.gestures.has(key)) { if (!this.gestures.size) this.push(); this.gestures.add(key); }
    } else this.push();
  }
  after(edit) {
    if (edit.gesture === 'end') this.gestures.delete(editKey(edit));
    if (!edit.gesture || (edit.gesture === 'end' && !this.gestures.size)) { this.push(); this.changed(); }
  }
  get canUndo() { return this.idx > 0; }
  get canRedo() { return this.idx < this.list.length - 1; }
}
