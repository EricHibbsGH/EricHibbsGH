/**
 * On-screen joystick + jump button for touch devices. Tapping frames, the
 * "[E]" prompt and Quick Travel already cover interaction; this adds free walking.
 */
export function setupTouchControls({ root, input, onJump }) {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (!coarse || !root) return { enabled: false };

  document.documentElement.classList.add('is-touch');
  root.hidden = false;

  const base = root.querySelector('.joystick');
  const knob = root.querySelector('.joystick-knob');
  const jump = root.querySelector('.touch-jump');
  const RADIUS = 44;
  let activeId = null;
  let cx = 0;
  let cy = 0;

  const reset = () => {
    activeId = null;
    knob.style.transform = 'translate(-50%, -50%)';
    input.setTouchAxis(0, 0);
    base.classList.remove('is-active');
  };

  base.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    activeId = e.pointerId;
    base.setPointerCapture(e.pointerId);
    const r = base.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    base.classList.add('is-active');
    move(e);
  });

  const move = (e) => {
    if (e.pointerId !== activeId) return;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      dx = (dx / d) * RADIUS;
      dy = (dy / d) * RADIUS;
    }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    input.setTouchAxis(dx / RADIUS, -dy / RADIUS);
  };

  base.addEventListener('pointermove', move);
  base.addEventListener('pointerup', reset);
  base.addEventListener('pointercancel', reset);
  jump.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    onJump();
  });

  return { enabled: true, reset };
}
