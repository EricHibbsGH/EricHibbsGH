import { wrapAngle } from '../core/math.js';

const LEGACY_VISITED_KEY = 'gallery.visited'; // no longer stored: ticks reset every visit
const ONBOARD_KEY = 'gallery.onboarded';

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — guidance just restarts next visit */
  }
}

/** Avoid DOM writes when nothing changed (this runs every frame). */
function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

const COACH_STEPS = [
  { keys: ['W', 'A', 'S', 'D'], text: 'Walk around (arrow keys work too)' },
  { keys: ['Click'], text: 'Or click anywhere on the floor to walk there' },
  { keys: ['E'], text: 'Follow the arrow to a painting, then press E' },
];

/**
 * Wayfinding for first-time visitors:
 *  - a coach card that teaches keys → click-to-walk → open, advancing as the visitor does each,
 *  - a "Next: …" pill whose arrow points (in screen space) to the nearest unseen exhibit,
 *  - visited tracking (ticks in Quick Travel and on the mini-map).
 */
export class Guide {
  constructor({ exhibits, hud }) {
    this.exhibits = exhibits;
    this.hud = hud;
    // Ticks belong to this visit only, so a returning visitor starts fresh.
    this.visited = new Set();
    try {
      localStorage.removeItem(LEGACY_VISITED_KEY);
    } catch {
      /* storage unavailable */
    }
    this.step = load(ONBOARD_KEY, false) ? COACH_STEPS.length : 0;
    this.walked = 0;
    this.lastPos = null;
    this.doneTimer = 0;
    this.target = null;

    this.pill = document.getElementById('hud-guide');
    this.arrow = this.pill.querySelector('.guide-arrow');
    this.title = document.getElementById('guide-title');
    this.sub = document.getElementById('guide-sub');
    this.coach = document.getElementById('hud-coach');
    this.coachKeys = this.coach.querySelector('.coach-keys');
    this.coachText = this.coach.querySelector('.coach-text');
    this.coachStep = this.coach.querySelector('.coach-step');
    this.coach.querySelector('.coach-skip').addEventListener('click', () => this.#finishCoach());

    this.#renderCoach();
  }

  /** The visitor used click-to-walk: that coach tip is done. */
  notifyClickWalk() {
    if (this.step <= 1) {
      this.step = 2;
      this.#renderCoach();
    }
  }

  markVisited(id) {
    if (!this.visited.has(id)) {
      this.visited.add(id);
      this.hud.setVisited(id, true);
      if (this.visited.size === this.exhibits.length) this.doneTimer = 5;
    }
    if (this.step < COACH_STEPS.length) this.#finishCoach();
  }

  #finishCoach() {
    this.step = COACH_STEPS.length;
    save(ONBOARD_KEY, true);
    this.#renderCoach();
  }

  #renderCoach() {
    if (this.step >= COACH_STEPS.length) {
      this.coach.classList.remove('is-visible');
      return;
    }
    const s = COACH_STEPS[this.step];
    this.coachKeys.replaceChildren(
      ...s.keys.map((k, i) => {
        const frag = document.createDocumentFragment();
        if (i > 0) frag.append(Object.assign(document.createElement('span'), { className: 'coach-or', textContent: '/' }));
        frag.append(Object.assign(document.createElement('kbd'), { textContent: k }));
        return frag;
      }),
    );
    this.coachText.textContent = s.text;
    this.coachStep.textContent = `Step ${this.step + 1} of ${COACH_STEPS.length}`;
    this.coach.classList.remove('is-visible');
    void this.coach.offsetWidth;
    this.coach.classList.add('is-visible');
  }

  /**
   * @returns {{ id: string, frame: object, distance: number } | null} the current wayfinding target
   */
  update(dt, { started, pos, yaw, frames, activeId, modalOpen }) {
    // Coach progress
    if (started && this.step < 2) {
      if (this.lastPos) this.walked += Math.hypot(pos.x - this.lastPos.x, pos.z - this.lastPos.z);
      if (this.step === 0 && this.walked > 1.5) {
        this.step = 1;
        this.walked = 0;
        this.#renderCoach();
      } else if (this.step === 1 && this.walked > 8) {
        // Clearly comfortable with the keys — skip the click tip.
        this.step = 2;
        this.#renderCoach();
      }
    }
    this.lastPos = { x: pos.x, z: pos.z };

    // Target: nearest exhibit not yet opened.
    let target = null;
    for (const f of frames) {
      if (this.visited.has(f.id)) continue;
      const d = Math.hypot(f.standPoint.x - pos.x, f.standPoint.z - pos.z);
      if (!target || d < target.distance) target = { id: f.id, frame: f, distance: d };
    }
    this.target = target;

    this.doneTimer = Math.max(0, this.doneTimer - dt);
    const showDone = !target && this.doneTimer > 0;
    const show = started && !modalOpen && !activeId && (target || showDone);
    this.pill.classList.toggle('is-visible', !!show);
    if (!show) return target;

    if (showDone) {
      this.arrow.style.transform = 'none';
      this.pill.classList.add('is-done');
      setText(this.title, 'You have seen every exhibit');
      setText(this.sub, 'Thanks for visiting!');
      return target;
    }
    this.pill.classList.remove('is-done');
    const f = target.frame;
    const dx = f.standPoint.x - pos.x;
    const dz = f.standPoint.z - pos.z;
    const rel = wrapAngle(Math.atan2(dx, dz) - yaw); // + = to the figure's left
    const deg = Math.round((-rel * 180) / Math.PI);
    if (deg !== this.lastDeg) {
      this.lastDeg = deg;
      this.arrow.style.transform = `rotate(${deg}deg)`;
    }
    let dir;
    if (Math.abs(rel) < 0.4) dir = 'straight ahead';
    else if (Math.abs(rel) > 2.5) dir = 'behind you';
    else if (Math.abs(rel) < 1.15) dir = rel > 0 ? 'ahead, to the left' : 'ahead, to the right';
    else dir = rel > 0 ? 'to your left' : 'to your right';
    setText(this.title, `Next: ${f.exhibit.title}`);
    setText(this.sub, `${Math.max(1, Math.round(target.distance))} m · ${dir}`);
    return target;
  }
}
