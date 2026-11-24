import * as THREE from 'three';
import { clamp, damp } from '../core/math.js';
import { createBlobShadowTexture } from '../scene/textures.js';

/*
 * The hand-drawn stick figure (circle head, line body, V arms, inverted-V legs),
 * built from flat vector meshes on a camera-facing billboard: a white halo stroke
 * behind a black ink stroke. Joints are moved every frame — no texture uploads —
 * so it stays razor sharp at any distance and animates at full frame rate.
 *
 * Shadows: a third copy of the strokes is flattened onto the floor every frame with
 * a planar projection matrix from a key light above the figure. That is the shadow a
 * ray traced from that light would produce, at the cost of a few extra triangles.
 * A soft contact shadow sits under the feet for grounding.
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
const SHADOW_OPACITY = 0.38;
const FLOOR_Y = 0.006;

const X = (px) => (px - CX) * K;
const Y = (py) => (FOOT_Y - py) * K;

export class StickFigure {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'player';
    this.billboard = new THREE.Group();
    this.root.add(this.billboard);

    // Projected shadow lives in world space; main.js adds it to the scene.
    this.shadowRig = new THREE.Group();
    this.shadowRig.matrixAutoUpdate = false;
    this.shadowMatrix = new THREE.Matrix4();
    this.keyLight = new THREE.Vector3();

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

    // Stencil makes overlapping strokes darken the floor exactly once.
    this.shadowMat = new THREE.MeshBasicMaterial({
      color: '#000000',
      transparent: true,
      opacity: SHADOW_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.NotEqualStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    this.layers = [
      makeLayer(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), HALO_W, 0, 2, this.billboard),
      makeLayer(new THREE.MeshBasicMaterial({ color: '#141210', toneMapped: false }), INK_W, 0.004, 3, this.billboard),
      makeLayer(this.shadowMat, INK_W * 1.25, 0, 1, this.shadowRig),
    ];

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
    this.shadowMat.opacity = SHADOW_OPACITY * (1 - Math.min(0.5, h * 0.25));

    this.#apply();
  }

  /**
   * Keep the drawing turned toward the camera, then cast its shadow. The key light
   * sits above the figure, slightly toward the camera and to one side, so the
   * shadow falls behind the figure where it reads clearly.
   */
  faceCamera(camera) {
    const p = this.root.position;
    const dx = camera.position.x - p.x;
    const dz = camera.position.z - p.z;
    this.billboard.rotation.y = Math.atan2(dx, dz);
    this.root.updateMatrixWorld(true);

    const len = Math.hypot(dx, dz) || 1;
    const fx = dx / len;
    const fz = dz / len;
    this.keyLight.set(p.x + fx * 1.0 - fz * 1.5, 4.2, p.z + fz * 1.0 + fx * 1.5);
    this.#projectShadow();
  }

  /** Planar projection of the strokes onto the floor plane y = FLOOR_Y from the key light. */
  #projectShadow() {
    const { x, y, z } = this.keyLight;
    const h = FLOOR_Y;
    const d = y - h; // plane · light
    // M = (P·L) I − L Pᵀ, with P = (0, 1, 0, −h) and L = (x, y, z, 1)
    this.shadowMatrix.set(
      d, -x, 0, x * h,
      0, d - y, 0, y * h,
      0, -z, d, z * h,
      0, -1, 0, d + h,
    );
    this.shadowRig.matrix.multiplyMatrices(this.shadowMatrix, this.billboard.matrixWorld);
    this.shadowRig.matrixWorldNeedsUpdate = true;
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
