import * as THREE from 'three';
import { clamp, damp } from '../core/math.js';
import { createBlobShadowTexture } from '../scene/textures.js';

/*
 * The hand-drawn stick figure (circle head, line body, V arms, inverted-V legs),
 * built from flat vector meshes on a camera-facing billboard: a cream halo stroke
 * behind a black ink stroke. Joints are moved every frame — no texture uploads —
 * so it stays razor sharp at any distance and animates smoothly at full frame rate.
 *
 * Layout values are in "drawing units" taken from the reference sketch
 * (feet at FOOT_Y, 1 unit = K metres → the figure stands ≈ 1.75 m tall).
 */
const K = 1.75 / 512;
const CX = 160;
const FOOT_Y = 548;
const HEAD_R = 64;
const NECK_Y = 202;
const HIP_Y = 433;
const ARM_LEN = 172;
const LEG_LEN = 160;
const INK_W = 9 * K;
const HALO_W = 20 * K;

const X = (px) => (px - CX) * K;
const Y = (py) => (FOOT_Y - py) * K;

export class StickFigure {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'player';
    this.billboard = new THREE.Group();
    this.root.add(this.billboard);

    const segGeo = new THREE.PlaneGeometry(1, 1);
    segGeo.translate(0, 0.5, 0); // unit stroke running from the origin along +Y
    const capGeo = new THREE.CircleGeometry(0.5, 20);

    const makeLayer = (color, width, z, order) => {
      const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      const mk = (geo) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.z = z;
        m.renderOrder = order;
        m.frustumCulled = false;
        this.billboard.add(m);
        return m;
      };
      const ringGeo = new THREE.RingGeometry(HEAD_R * K - width / 2, HEAD_R * K + width / 2, 72);
      return {
        width,
        z,
        head: mk(ringGeo),
        segs: Array.from({ length: 5 }, () => mk(segGeo)), // body, armL, armR, legL, legR
        caps: Array.from({ length: 6 }, () => mk(capGeo)), // neck, hip, handL, handR, footL, footR
      };
    };
    this.layers = [makeLayer('#fbf3e4', HALO_W, 0, 2), makeLayer('#141210', INK_W, 0.004, 3)];

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.95),
      new THREE.MeshBasicMaterial({ map: createBlobShadowTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
    this.root.add(this.shadow);

    this.phase = 0;
    this.time = 0;
    this.onStep = null;
    this.onLand = null;
    this._stepIndex = 0;
    this._wasGrounded = true;

    // Angles measured from straight down, positive = away from the body.
    this.pose = { armL: 0.66, armR: 0.66, legL: 0.77, legR: 0.77, lenL: 1, lenR: 1 };
    this.#apply();
  }

  update(dt, { speed, maxSpeed, grounded, vy }) {
    this.time += dt;
    const s = clamp(speed / maxSpeed, 0, 1.6);
    const moving = s > 0.06;
    if (moving && grounded) this.phase += dt * (7 + 5 * s);

    const stepIndex = Math.floor(this.phase / Math.PI);
    if (stepIndex !== this._stepIndex) {
      this._stepIndex = stepIndex;
      if (grounded && moving) this.onStep?.(s);
    }
    if (grounded && !this._wasGrounded) this.onLand?.(Math.min(1, Math.abs(vy) / 8));
    this._wasGrounded = grounded;

    const t = {};
    if (!grounded) {
      const rising = clamp(vy / 6, -1, 1);
      t.armL = t.armR = 2.25 + rising * 0.12; // arms up into a "Y"
      t.legL = t.legR = 0.38;
      t.lenL = t.lenR = 0.86;
    } else if (moving) {
      const a = Math.min(1.2, s);
      const sw = Math.sin(this.phase);
      t.legL = 0.6 + 0.26 * sw * a;
      t.legR = 0.6 - 0.26 * sw * a;
      t.lenL = 1 - 0.16 * Math.max(0, sw) * a; // the swinging leg lifts
      t.lenR = 1 - 0.16 * Math.max(0, -sw) * a;
      t.armL = 0.6 - 0.24 * sw * a;
      t.armR = 0.6 + 0.24 * sw * a;
    } else {
      const breath = Math.sin(this.time * 1.9) * 0.03;
      t.armL = 0.66 + breath;
      t.armR = 0.66 + breath;
      t.legL = t.legR = 0.77;
      t.lenL = t.lenR = 1;
    }
    // Fast settle so the figure plants its feet the moment you let go.
    for (const k of Object.keys(this.pose)) this.pose[k] = damp(this.pose[k], t[k], grounded ? 22 : 14, dt);

    const h = this.root.position.y;
    this.shadow.position.y = -h + 0.012;
    const sc = 1 - Math.min(0.45, h * 0.35);
    this.shadow.scale.set(sc, sc, sc);
    this.shadow.material.opacity = 1 - Math.min(0.6, h * 0.5);

    this.#apply();
  }

  /** Cylindrical billboard: keep the drawing turned toward the camera. */
  faceCamera(camera) {
    const p = this.root.position;
    this.billboard.rotation.y = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
  }

  #apply() {
    const P = this.pose;
    const footLx = CX - Math.sin(P.legL) * LEG_LEN * P.lenL;
    const footLy = HIP_Y + Math.cos(P.legL) * LEG_LEN * P.lenL;
    const footRx = CX + Math.sin(P.legR) * LEG_LEN * P.lenR;
    const footRy = HIP_Y + Math.cos(P.legR) * LEG_LEN * P.lenR;
    // The planted foot touches the floor: shift the drawing so the lowest foot sits on FOOT_Y.
    const dy = FOOT_Y - Math.max(footLy, footRy);

    const pts = {
      head: [X(CX), Y(NECK_Y - HEAD_R + dy)],
      neck: [X(CX), Y(NECK_Y + dy)],
      hip: [X(CX), Y(HIP_Y + dy)],
      handL: [X(CX - Math.sin(P.armL) * ARM_LEN), Y(NECK_Y + Math.cos(P.armL) * ARM_LEN + dy)],
      handR: [X(CX + Math.sin(P.armR) * ARM_LEN), Y(NECK_Y + Math.cos(P.armR) * ARM_LEN + dy)],
      footL: [X(footLx), Y(footLy + dy)],
      footR: [X(footRx), Y(footRy + dy)],
    };
    const segPairs = [
      ['neck', 'hip'],
      ['neck', 'handL'],
      ['neck', 'handR'],
      ['hip', 'footL'],
      ['hip', 'footR'],
    ];
    const capKeys = ['neck', 'hip', 'handL', 'handR', 'footL', 'footR'];

    for (const layer of this.layers) {
      layer.head.position.set(pts.head[0], pts.head[1], layer.z);
      segPairs.forEach(([a, b], i) => {
        const m = layer.segs[i];
        const [ax, ay] = pts[a];
        const [bx, by] = pts[b];
        const dx = bx - ax;
        const dyy = by - ay;
        m.position.set(ax, ay, layer.z);
        m.rotation.z = Math.atan2(-dx, dyy);
        m.scale.set(layer.width, Math.hypot(dx, dyy), 1);
      });
      capKeys.forEach((k, i) => {
        const m = layer.caps[i];
        m.position.set(pts[k][0], pts[k][1], layer.z);
        m.scale.set(layer.width, layer.width, 1);
      });
    }
  }
}
