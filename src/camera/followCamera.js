import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp } from '../core/math.js';

const BASE_PITCH = 0.2;
const DEFAULT_ZOOM = 5.4;

/**
 * Third-person follow camera. It tracks the stick figure's position at a steady
 * angle — it never spins with the figure — and only eases round to a new angle
 * when asked (to frame a painting). Drag (left or right button, or one finger) to
 * look around; the wheel, a touchpad swipe or a pinch zooms, and a sideways
 * two-finger swipe turns the view.
 *
 * Near an exhibit the shot eases in and lifts its target toward the artwork.
 * Inside the room the boom shortens instead of clipping through walls.
 */
export class FollowCamera {
  constructor(camera, dom, bounds, ceiling) {
    this.camera = camera;
    this.bounds = bounds;
    this.ceiling = ceiling;
    this.yaw = 0;
    this.yawOffset = 0; // used for the idle sway behind the intro card
    this.zoom = DEFAULT_ZOOM;
    this.distance = DEFAULT_ZOOM;
    this.target = new THREE.Vector3();
    this.desiredTarget = new THREE.Vector3();
    this.desiredPos = new THREE.Vector3();
    this.dir = new THREE.Vector3();
    this.initialized = false;

    // Manual look: drag with either mouse button (left suits touchpads), or one
    // finger on touch screens. A drag only starts after a few pixels, so clicks
    // and taps still walk and open paintings.
    this.pitchOffset = 0;
    this.dragging = false;
    this.manualSince = -Infinity;
    this.dom = dom;
    this.drag = null;

    dom.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const scale = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1; // lines / pages → pixels
        const dy = clamp(e.deltaY * scale, -120, 120);
        const dx = clamp(e.deltaX * scale, -120, 120);
        // Pinch on a touchpad arrives as ctrl+wheel; zoom faster so it tracks the fingers.
        this.zoom = clamp(this.zoom * Math.exp(dy * (e.ctrlKey ? 0.01 : 0.0012)), 2.6, 7.5);
        // A sideways two-finger swipe turns the view, like dragging.
        if (!e.ctrlKey && Math.abs(dx) > Math.abs(dy) * 0.5 && dx !== 0) {
          this.yaw += dx * 0.005;
          this.manualSince = performance.now();
        }
      },
      { passive: false },
    );
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', (e) => {
      const isRight = e.pointerType !== 'touch' && e.button === 2;
      const isLeft = e.pointerType !== 'touch' && e.button === 0;
      const isTouch = e.pointerType === 'touch';
      if (!isRight && !isLeft && !isTouch) return;
      // Right-drag looks straight away; left-drag and touch wait for real movement.
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, waits: !isRight };
      if (isRight) this.#beginLook(e.pointerId);
    });
    dom.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      d.moved += Math.abs(dx) + Math.abs(dy);
      if (d.waits && d.moved < 8) return;
      if (!this.dragging) this.#beginLook(e.pointerId);
      this.yaw -= dx * 0.006;
      this.pitchOffset = clamp(this.pitchOffset + dy * 0.004, -0.15, 0.75);
      this.manualSince = performance.now();
    });
    const end = (e) => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      this.drag = null;
      this.dragging = false;
      dom.classList.remove('is-looking');
    };
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', end);
  }

  #beginLook(pointerId) {
    try {
      this.dom.setPointerCapture(pointerId); // keep turning even if the cursor leaves the canvas
    } catch {
      /* pointer already released: the drag still works within the canvas */
    }
    this.dragging = true;
    this.dom.classList.add('is-looking');
  }

  /** True while the visitor is actively orbiting the camera. */
  get isLooking() {
    return this.dragging;
  }

  /** Whether the last pointer gesture was a look-drag (so it shouldn't count as a click). */
  get justLooked() {
    return performance.now() - this.manualSince < 120;
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} playerPos
   * @param {number} playerYaw  facing angle of the figure
   * @param {{ point: THREE.Vector3, weight: number } | null} focus
   */
  update(dt, playerPos, yawGoal, focus) {
    const w = focus ? focus.weight : 0;
    // The camera keeps its angle while you move; it only eases round when a new
    // viewing angle is requested (stopping at a painting, Quick Travel).
    // While dragging, the visitor owns the angle outright.
    const goal = yawGoal + this.yawOffset;
    if (!this.dragging) this.yaw = this.initialized ? dampAngle(this.yaw, goal, 2.6, dt) : goal;

    this.distance = damp(this.distance, lerp(this.zoom, Math.min(this.zoom, 3.6), w * 0.7), 4, dt);
    const pitch = clamp(lerp(BASE_PITCH, 0.1, w * 0.8) + this.pitchOffset, 0.02, 1.0);

    this.desiredTarget.set(playerPos.x, playerPos.y * 0.5 + 1.55, playerPos.z);
    if (focus && w > 0) this.desiredTarget.lerp(focus.point, 0.4 * w);
    if (!this.initialized) this.target.copy(this.desiredTarget);
    else this.target.lerp(this.desiredTarget, 1 - Math.exp(-14 * dt));

    // Boom direction from the target out to the camera.
    const cp = Math.cos(pitch);
    this.dir.set(Math.sin(this.yaw) * cp, Math.sin(pitch), Math.cos(this.yaw) * cp);

    // Shorten the boom so the camera stays inside the room.
    const m = 0.3;
    const b = this.bounds;
    let len = this.distance;
    const limit = (origin, d, min, max) => {
      if (d > 1e-5) len = Math.min(len, (max - origin) / d);
      else if (d < -1e-5) len = Math.min(len, (min - origin) / d);
    };
    limit(this.target.x, this.dir.x, b.minX + m, b.maxX - m);
    limit(this.target.z, this.dir.z, b.minZ + m, b.maxZ - m);
    limit(this.target.y, this.dir.y, 0.4, this.ceiling - 0.35);
    len = Math.max(0.8, len);
    this.desiredPos.copy(this.target).addScaledVector(this.dir, len);
    // When squeezed against a wall, rise up a little to look over the figure.
    if (len < this.distance * 0.7) this.desiredPos.y = Math.min(this.ceiling - 0.35, this.desiredPos.y + (this.distance * 0.7 - len) * 0.5);

    if (!this.initialized) {
      this.camera.position.copy(this.desiredPos);
      this.initialized = true;
    } else {
      this.camera.position.lerp(this.desiredPos, 1 - Math.exp(-14 * dt));
    }
    this.camera.lookAt(this.target);
  }
}
