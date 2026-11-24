const MOVE_KEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

function isTextField(target) {
  if (!target) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

function isActivatable(target) {
  return target && /^(BUTTON|A|SUMMARY)$/.test(target.tagName);
}

/**
 * Keyboard + virtual-joystick input. Emits discrete actions (interact, jump, escape)
 * and exposes a continuous movement axis in camera space (x = right, y = forward).
 */
export class Input {
  constructor() {
    this.down = new Set();
    this.touchAxis = { x: 0, y: 0 };
    this.blocked = false;
    this.listeners = { interact: [], jump: [], escape: [], any: [] };

    window.addEventListener('keydown', this.#onKeyDown);
    window.addEventListener('keyup', this.#onKeyUp);
    window.addEventListener('blur', () => this.down.clear());
    document.addEventListener('visibilitychange', () => this.down.clear());
  }

  on(evt, fn) {
    this.listeners[evt].push(fn);
    return () => (this.listeners[evt] = this.listeners[evt].filter((f) => f !== fn));
  }

  #emit(evt, payload) {
    for (const fn of this.listeners[evt]) fn(payload);
  }

  #onKeyDown = (e) => {
    this.#emit('any', e);
    if (e.key === 'Escape') {
      this.#emit('escape', e);
      return;
    }
    if (this.blocked || isTextField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;

    // Let Space/Enter activate a focused button or link instead of jumping.
    if ((e.code === 'Space' || e.code === 'Enter') && isActivatable(e.target)) return;

    if (MOVE_KEYS[e.code] || e.code === 'Space') e.preventDefault();
    this.down.add(e.code);
    if (e.repeat) return;
    if (e.code === 'KeyE') this.#emit('interact', e);
    if (e.code === 'Space') this.#emit('jump', e);
  };

  #onKeyUp = (e) => {
    this.down.delete(e.code);
  };

  setBlocked(blocked) {
    this.blocked = blocked;
    if (blocked) {
      this.down.clear();
      this.touchAxis.x = this.touchAxis.y = 0;
    }
  }

  setTouchAxis(x, y) {
    this.touchAxis.x = x;
    this.touchAxis.y = y;
  }

  /** Movement intent, length ≤ 1. */
  get axis() {
    if (this.blocked) return { x: 0, y: 0 };
    let x = this.touchAxis.x;
    let y = this.touchAxis.y;
    for (const code of this.down) {
      const k = MOVE_KEYS[code];
      if (k) {
        x += k[0];
        y += k[1];
      }
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  get running() {
    return this.down.has('ShiftLeft') || this.down.has('ShiftRight');
  }
}
