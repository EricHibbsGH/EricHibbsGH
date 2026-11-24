import * as THREE from 'three';
import { clamp, damp, smoothstep } from '../core/math.js';
import { createBlobShadowTexture } from '../scene/textures.js';

/*
 * The hand-drawn stick figure (circle head, line body, V arms, inverted-V legs),
 * built from flat vector meshes on a camera-facing billboard: a white halo stroke
 * behind a black ink stroke. Joints are moved every frame — no texture uploads —
 * so it stays razor sharp at any distance and animates at full frame rate.
 *
 * Shadows come from the room's real lights. Every frame each light's contribution
 * at the figure is estimated (power / distance², spotlights only inside their cone),
 * the strongest few each cast a shadow, and each shadow's darkness is that light's
 * share of the total. A shadow is a copy of the strokes, turned to face its light
 * and flattened onto the floor with a planar projection — the outline a ray from
 * that light would trace — at the cost of a few small draw calls. A soft contact
 * shadow sits under the feet for grounding.
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
const FIGURE_H = 1.75;
const FLOOR_Y = 0.006;
const MAX_SHADOWS = 3;
const SHADOW_STRENGTH = 0.8; // darkest a single shadow can get
const AMBIENT = 0.55; // fill light that no single shadow blocks

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

    const makeLayer = (mat, width, z, order, parent) => {
      const mk = (geo) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.z = z;
        m.renderOrder = order;
        m.frustumCulled = false;
        parent.add(m);
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

    this.layers = [
      makeLayer(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), HALO_W, 0, 2, this.billboard),
      makeLayer(new THREE.MeshBasicMaterial({ color: '#141210', toneMapped: false }), INK_W, 0.004, 3, this.billboard),
    ];

    // Shadow pool, in world space (main.js adds `shadowRig` to the scene).
    this.shadowRig = new THREE.Group();
    this.shadows = [];
    for (let i = 0; i < MAX_SHADOWS; i++) {
      const rig = new THREE.Group();
      rig.matrixAutoUpdate = false;
      rig.visible = false;
      // Each shadow has its own stencil value: strokes within one shadow darken the
      // floor once, while two shadows that overlap still darken each other.
      const mat = new THREE.MeshBasicMaterial({
        color: '#000000',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        stencilWrite: true,
        stencilRef: i + 1,
        stencilFunc: THREE.NotEqualStencilFunc,
        stencilZPass: THREE.ReplaceStencilOp,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      this.layers.push(makeLayer(mat, INK_W * 1.25, 0, 1, rig));
      this.shadowRig.add(rig);
      this.shadows.push({ rig, mat });
    }
    this.lights = [];
    this.weights = [];
    this.caster = new THREE.Matrix4();
    this.projection = new THREE.Matrix4();
    this.quat = new THREE.Quaternion();
    this.up = new THREE.Vector3(0, 1, 0);
    this.one = new THREE.Vector3(1, 1, 1);

    this.contact = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.7),
      new THREE.MeshBasicMaterial({ map: createBlobShadowTexture(), transparent: true, depthWrite: false }),
    );
    this.contact.rotation.x = -Math.PI / 2;
    this.contact.renderOrder = 1;
    this.root.add(this.contact);

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

  /**
   * Lights that cast the figure's shadows.
   * { kind: 'point', pos, power } | { kind: 'spot', pos, dir, cosOuter, cosInner, power } | { kind: 'dir', dir, power }
   * `dir` for 'dir' lights points toward the light; for spots it is the beam direction.
   */
  setShadowLights(lights) {
    this.lights = lights;
    this.weights = lights.map(() => 0);
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

    // Contact shadow tightens and fades as the figure leaves the floor.
    const h = this.root.position.y;
    this.contact.position.y = -h + 0.012;
    const sc = 1 - Math.min(0.45, h * 0.35);
    this.contact.scale.set(sc, sc, sc);
    this.contact.material.opacity = 1 - Math.min(0.7, h * 0.6);

    this.#apply();
  }

  /** Turn the drawing toward the camera, then recast its shadows from the room's lights. */
  faceCamera(camera, dt = 1 / 60) {
    const p = this.root.position;
    this.billboard.rotation.y = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
    this.#castShadows(dt);
  }

  #castShadows(dt) {
    const p = this.root.position;
    const centreY = p.y + FIGURE_H / 2;
    const topY = p.y + FIGURE_H;

    // How much each light reaches the figure, smoothed so shadows fade instead of popping.
    let total = AMBIENT;
    this.lights.forEach((L, i) => {
      let c;
      if (L.kind === 'dir') {
        c = L.power;
      } else {
        const dx = L.pos.x - p.x;
        const dy = L.pos.y - centreY;
        const dz = L.pos.z - p.z;
        c = L.power / Math.max(dx * dx + dy * dy + dz * dz, 0.6);
        if (L.kind === 'spot') {
          const len = Math.hypot(dx, dy, dz) || 1;
          const cos = -(dx * L.dir.x + dy * L.dir.y + dz * L.dir.z) / len;
          c *= smoothstep(L.cosOuter, L.cosInner, cos);
        }
      }
      this.weights[i] = damp(this.weights[i], c, 6, dt);
      total += this.weights[i];
    });

    const order = this.weights.map((w, i) => i).sort((a, b) => this.weights[b] - this.weights[a]);
    this.shadows.forEach(({ rig, mat }, k) => {
      const i = order[k];
      const opacity = i == null ? 0 : (SHADOW_STRENGTH * this.weights[i]) / total;
      if (opacity < 0.015) {
        rig.visible = false;
        return;
      }
      const L = this.lights[i];
      let lx, ly, lz, lw, facing;
      if (L.kind === 'dir') {
        [lx, ly, lz, lw] = [L.dir.x, L.dir.y, L.dir.z, 0];
        facing = Math.atan2(L.dir.x, L.dir.z);
      } else {
        // A light below the head can't project onto the floor; lift it just above.
        [lx, ly, lz, lw] = [L.pos.x, Math.max(L.pos.y, topY + 0.8), L.pos.z, 1];
        facing = Math.atan2(L.pos.x - p.x, L.pos.z - p.z);
      }
      // The caster is the drawing turned to face this light, standing where the figure is.
      this.quat.setFromAxisAngle(this.up, facing);
      this.caster.compose(p, this.quat, this.one);
      // Planar projection onto y = FLOOR_Y:  M = (P·L) I − L Pᵀ,  P = (0, 1, 0, −h)
      const hgt = FLOOR_Y;
      const d = ly - hgt * lw;
      this.projection.set(
        d, -lx, 0, lx * hgt,
        0, d - ly, 0, ly * hgt,
        0, -lz, d, lz * hgt,
        0, -lw, 0, d + lw * hgt,
      );
      rig.matrix.multiplyMatrices(this.projection, this.caster);
      rig.matrixWorldNeedsUpdate = true;
      rig.visible = true;
      mat.opacity = opacity * (1 - Math.min(0.5, p.y * 0.25));
    });
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
        const ddx = bx - ax;
        const ddy = by - ay;
        m.position.set(ax, ay, layer.z);
        m.rotation.z = Math.atan2(-ddx, ddy);
        m.scale.set(layer.width, Math.hypot(ddx, ddy), 1);
      });
      capKeys.forEach((k, i) => {
        const m = layer.caps[i];
        m.position.set(pts[k][0], pts[k][1], layer.z);
        m.scale.set(layer.width, layer.width, 1);
      });
    }
  }
}
