import { DemoPod as BaseDemoPod } from '../core/demo.mjs';
// The editor's demo adapter mirrors expression ranges; the core demo stub has
// no implementation for this command. No transport or protocol changes.
export class DemoPod extends BaseDemoPod {
  async paramRange(item, id, lo, hi) {
    const p = this.buffer.items.find(it => it.id === item)?.params.find(p => p.id === id);
    if (p) this.buffer.setParamRange(item, p.index, lo, hi);
  }
}
