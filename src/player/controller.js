import * as THREE from 'three';
import { damp, dampAngle, easeInOutCubic, wrapAngle } from '../core/math.js';

const WALK_SPEED = 4.6;
const RUN_SPEED = 7.6;
const GRAVITY = -19;
const JUMP_VELOCITY = 5.8;
const RADIUS = 0.35;
const STEP = 0.06; // how far below a surface's top you can still be and move onto it
const SIT_TIME = 0.32;

/**
 * Kinematic character controller: screen-relative movement + click-to-walk, AABB collision
 * against room bounds + obstacles (resolved per axis so you slide along walls),
 * a jump arc, scripted "quick travel" glides, surfaces you can land on (colliders
 * with a `top`), and sitting down on seats.
 */
export class PlayerController {
  constructor(figure, { bounds, colliders }) {
    this.figure = figure;
    this.position = figure.root.position;
    this.velocity = new THREE.Vector3();
    this.vy = 0;
    this.grounded = true;
    this.yaw = Math.PI; // facing -Z (toward the back wall)
    this.bounds = bounds;
    this.colliders = colliders;
    this.radius = RADIUS;
    this.travel = null;
    this.maxSpeed = WALK_SPEED;
    this.speed = 0;
    this.faceTarget = null;
    this.groundY = 0;
    this.seat = null;
    this.tween = null; // easing into or out of a seat
  }

  get isSeated() {
    return !!this.seat;
  }

  get isTraveling() {
    return !!this.travel;
  }

  jump() {
    if (this.seat) {
      this.standUp();
      return false;
    }
    if (this.grounded && !this.travel && !this.tween) {
      this.vy = JUMP_VELOCITY;
      this.grounded = false;
      return true;
    }
    return false;
  }

  stop() {
    this.velocity.set(0, 0, 0);
  }

  /** Glide to a point, then face `faceYaw`. Returns a promise resolved on arrival. */
  travelTo(point, faceYaw, { duration } = {}) {
    this.goal = null;
    if (this.seat) this.standUp({ instant: true });
    const from = this.position.clone().setY(0);
    const to = point.clone().setY(0);
    const dist = from.distanceTo(to);
    const dur = duration ?? THREE.MathUtils.clamp(dist / 9, 0.6, 2.2);
    return new Promise((resolve) => {
      if (this.travel) this.travel.resolve(false);
      this.travel = { from, to, t: 0, dur, faceYaw, resolve, dist };
    });
  }

  cancelTravel() {
    if (this.travel) {
      this.travel.resolve(false);
      this.travel = null;
    }
  }

  #blocked(x, z, y = this.position.y) {
    const r = this.radius;
    const b = this.bounds;
    if (x < b.minX + r || x > b.maxX - r || z < b.minZ + r || z > b.maxZ - r) return true;
    for (const c of this.colliders) {
      if (c.top != null && y >= c.top - STEP) continue; // high enough to step onto it
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
    }
    return false;
  }

  /** Height of whatever you would stand on at (x, z): a surface's top, or the floor. */
  #groundAt(x, z) {
    const r = this.radius;
    let g = 0;
    for (const c of this.colliders) {
      if (c.top == null || c.top <= g) continue;
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) g = c.top;
    }
    return g;
  }

  /** Sit on a seat: { pos, yaw, rootY }. pos is where the figure sits, rootY its feet height. */
  sit(seat) {
    if (this.seat || this.travel) return;
    this.goal = null;
    this.velocity.set(0, 0, 0);
    this.vy = 0;
    this.grounded = true;
    this.seat = seat;
    this.faceTarget = null;
    this.tween = {
      from: this.position.clone(),
      to: new THREE.Vector3(seat.pos.x, seat.rootY, seat.pos.z),
      t: 0,
      dur: SIT_TIME,
    };
  }

  /** Get up and step out in front of the seat, to the first clear spot. */
  standUp({ instant = false } = {}) {
    const seat = this.seat;
    if (!seat) return;
    this.seat = null;
    const fx = Math.sin(seat.yaw);
    const fz = Math.cos(seat.yaw);
    let exit = null;
    search: for (const d of [0.55, 0.8, 1.1, 1.5]) {
      for (const a of [0, 0.6, -0.6, 1.2, -1.2, 1.7, -1.7]) {
        const x = seat.pos.x + (fx * Math.cos(a) - fz * Math.sin(a)) * d;
        const z = seat.pos.z + (fz * Math.cos(a) + fx * Math.sin(a)) * d;
        if (!this.#blocked(x, z, 0)) {
          exit = new THREE.Vector3(x, this.#groundAt(x, z), z);
          break search;
        }
      }
    }
    exit ??= new THREE.Vector3(seat.pos.x + fx * 0.6, 0, seat.pos.z + fz * 0.6);
    if (instant) {
      this.tween = null;
      this.position.copy(exit);
    } else {
      this.tween = { from: this.position.clone(), to: exit, t: 0, dur: SIT_TIME };
    }
    this.grounded = true;
    this.vy = 0;
  }

  #clampToBounds() {
    const r = this.radius;
    const b = this.bounds;
    this.position.x = THREE.MathUtils.clamp(this.position.x, b.minX + r, b.maxX - r);
    this.position.z = THREE.MathUtils.clamp(this.position.z, b.minZ + r, b.maxZ - r);
  }

  /** Click-to-walk: head for a floor point using normal movement + collisions. */
  walkTo(point) {
    this.cancelTravel();
    if (this.seat) this.standUp({ instant: true });
    this.goal = new THREE.Vector3(point.x, 0, point.z);
    this.goalStuck = 0;
  }

  get isWalkingToGoal() {
    return !!this.goal;
  }

  /**
   * @param {number} dt
   * @param {{x:number,y:number}} axis  screen-relative input: x = right, y = up/away from camera
   * @param {boolean} running
   * @param {number} basisYaw  camera yaw that maps screen directions into the world
   */
  update(dt, axis, running, basisYaw = 0) {
    const pos = this.position;
    this.maxSpeed = WALK_SPEED;

    if (this.tween) {
      // Easing into or out of a seat.
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      pos.lerpVectors(tw.from, tw.to, easeInOutCubic(tw.t));
      if (tw.t >= 1) this.tween = null;
      this.speed = 0;
      this.velocity.set(0, 0, 0);
      if (this.seat) this.yaw = dampAngle(this.yaw, this.seat.yaw, 12, dt);
    } else if (this.seat) {
      this.speed = 0;
      this.yaw = dampAngle(this.yaw, this.seat.yaw, 12, dt);
    } else if (this.travel) {
      const tr = this.travel;
      tr.t = Math.min(1, tr.t + dt / tr.dur);
      const e = easeInOutCubic(tr.t);
      const prevX = pos.x;
      const prevZ = pos.z;
      pos.x = tr.from.x + (tr.to.x - tr.from.x) * e;
      pos.z = tr.from.z + (tr.to.z - tr.from.z) * e;
      const dx = pos.x - prevX;
      const dz = pos.z - prevZ;
      this.speed = Math.hypot(dx, dz) / Math.max(dt, 1e-4);
      this.velocity.set(dx / Math.max(dt, 1e-4), 0, dz / Math.max(dt, 1e-4));
      const remaining = tr.dist * (1 - e);
      if (this.speed > 0.3 && remaining > 0.6) this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 10, dt);
      else this.yaw = dampAngle(this.yaw, tr.faceYaw, 8, dt);
      if (tr.t >= 1) {
        this.travel = null;
        this.speed = 0;
        this.velocity.set(0, 0, 0);
        tr.resolve(true);
      }
    } else {
      // Screen-relative movement: "up" is always away from the camera, "right" is screen-right.
      const hasKeys = Math.abs(axis.x) > 0.01 || Math.abs(axis.y) > 0.01;
      if (hasKeys) this.goal = null; // keys always win over click-to-walk
      const top = running ? RUN_SPEED : WALK_SPEED;
      let tx = 0;
      let tz = 0;
      if (hasKeys) {
        const fx = -Math.sin(basisYaw);
        const fz = -Math.cos(basisYaw);
        const rx = Math.cos(basisYaw);
        const rz = -Math.sin(basisYaw);
        tx = (fx * axis.y + rx * axis.x) * top;
        tz = (fz * axis.y + rz * axis.x) * top;
      } else if (this.goal) {
        const gx = this.goal.x - pos.x;
        const gz = this.goal.z - pos.z;
        const dist = Math.hypot(gx, gz);
        if (dist < 0.12) {
          this.goal = null;
        } else {
          const s = WALK_SPEED * Math.min(1, dist / 0.7); // ease into the stop
          tx = (gx / dist) * s;
          tz = (gz / dist) * s;
        }
      }
      // Snappy: quick to reach speed, near-instant stop when input ends.
      const moving = Math.abs(tx) + Math.abs(tz) > 0.01;
      const accel = !this.grounded ? 3 : moving ? 16 : 45;
      this.velocity.x = damp(this.velocity.x, tx, accel, dt);
      this.velocity.z = damp(this.velocity.z, tz, accel, dt);
      const beforeX = pos.x;
      const beforeZ = pos.z;

      // Per-axis movement so the player slides along obstacles.
      const nx = pos.x + this.velocity.x * dt;
      if (!this.#blocked(nx, pos.z)) pos.x = nx;
      else this.velocity.x = 0;
      const nz = pos.z + this.velocity.z * dt;
      if (!this.#blocked(pos.x, nz)) pos.z = nz;
      else this.velocity.z = 0;
      this.#clampToBounds();

      this.speed = Math.hypot(this.velocity.x, this.velocity.z);
      // Give up on a click-to-walk goal if furniture blocks the way.
      if (this.goal) {
        const progressed = Math.hypot(pos.x - beforeX, pos.z - beforeZ);
        this.goalStuck = progressed < 0.25 * dt ? this.goalStuck + dt : 0;
        if (this.goalStuck > 0.35) this.goal = null;
      }
      // Face the direction of travel.
      if (moving) {
        this.faceTarget = null;
        if (this.speed > 0.2) this.yaw = dampAngle(this.yaw, Math.atan2(this.velocity.x, this.velocity.z), 14, dt);
      } else if (this.faceTarget != null) {
        this.yaw = dampAngle(this.yaw, this.faceTarget, 9, dt);
        if (Math.abs(wrapAngle(this.faceTarget - this.yaw)) < 0.01) this.faceTarget = null;
      }
    }

    // Vertical: simple ballistic arc onto the floor or any surface below.
    let landingVy = 0;
    if (!this.seat && !this.tween) {
      const ground = this.#groundAt(pos.x, pos.z);
      this.groundY = ground;
      if (this.grounded && pos.y > ground + 0.001) {
        this.grounded = false; // walked off an edge
        this.vy = 0;
      }
      if (!this.grounded) {
        this.vy += GRAVITY * dt;
        pos.y += this.vy * dt;
        if (pos.y <= ground && this.vy <= 0) {
          pos.y = ground;
          landingVy = this.vy;
          this.vy = 0;
          this.grounded = true;
        }
      }
    }

    this.figure.update(dt, {
      speed: this.speed,
      maxSpeed: WALK_SPEED,
      grounded: this.grounded,
      vy: this.grounded ? landingVy : this.vy,
      groundY: this.seat || this.tween ? null : this.groundY,
      seat: this.seat,
    });
  }

  /** Turn to face a yaw once idle (used when interacting with a frame). */
  faceTowards(yaw) {
    this.faceTarget = yaw;
  }
}
