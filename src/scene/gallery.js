import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  createFloorTexture,
  createPlasterTexture,
  createWainscotTexture,
  createRugTexture,
  createWindowTexture,
  createSmallArtTexture,
  createWallLetteringTexture,
  createFabricTexture,
  createWoodTexture,
} from './textures.js';
import { mulberry32 } from '../core/math.js';

/** Room dimensions in metres. x: width, z: depth, y: height. Origin at floor centre. */
export const ROOM = { width: 18, depth: 22, height: 4.6 };
const WAINSCOT_H = 1.0;

/**
 * A warm, lived-in salon gallery: oak floor, sage plaster over cream wainscoting,
 * timber ceiling beams, lamps, a rug, sofa, reading chair, bookshelf and plants.
 * Returns world bounds and AABB colliders used by the player controller.
 */
export function buildGallery(world, { renderer, site }) {
  // Everything static is built into this group, then merged into a handful of draw calls.
  const scene = new THREE.Group();
  const halfW = ROOM.width / 2;
  const halfD = ROOM.depth / 2;
  const H = ROOM.height;
  const colliders = [];
  const updaters = [];
  const rand = mulberry32(2024);

  world.background = new THREE.Color('#3a2e25');
  world.fog = null;

  const pmrem = new THREE.PMREMGenerator(renderer);
  world.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  world.environmentIntensity = 0.14;
  pmrem.dispose();

  /* ---------------------------------------------------------- materials */
  const std = (color, roughness = 0.8, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const fabric = createFabricTexture(renderer);
  const wood = createWoodTexture(renderer);
  const M = {
    walnut: std('#5b3a22', 0.5, 0, { map: wood }),
    oak: std('#b07c48', 0.55, 0, { map: wood }),
    beam: std('#4a3121', 0.75, 0, { map: wood }),
    cream: std('#f3f3f1', 0.75),
    trim: std('#f4f4f2', 0.55),
    brass: std('#b48a3e', 0.32, 0.8),
    iron: std('#2c2520', 0.5, 0.4),
    rust: std('#a24f2c', 0.95, 0, { map: fabric }),
    mustard: std('#c4923a', 0.95, 0, { map: fabric }),
    linen: std('#efe6d2', 0.95, 0, { map: fabric }),
    moss: std('#5f7550', 0.95, 0, { map: fabric }),
    terracotta: std('#b5603b', 0.85),
    soil: std('#3b2a1f', 1),
    leaf: std('#4f7a3a', 0.7, 0, { side: THREE.DoubleSide }),
    leafDark: std('#3b6030', 0.7, 0, { side: THREE.DoubleSide }),
    leafLight: std('#6d9549', 0.7, 0, { side: THREE.DoubleSide }),
    ceramic: std('#e7ddca', 0.35),
    door: std('#6b4528', 0.55, 0, { map: wood }),
  };

  const mesh = (geo, mat, { cast = true, receive = true } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  };
  const box = (parent, w, h, d, mat, x, y, z, opts = {}) => {
    const geo = opts.round ? new RoundedBoxGeometry(w, h, d, 3, Math.min(opts.round, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d);
    const m = mesh(geo, mat, opts);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const cyl = (parent, rt, rb, h, mat, x, y, z, segs = 24, opts) => {
    const m = mesh(new THREE.CylinderGeometry(rt, rb, h, segs), mat, opts);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const placed = (x, z, rotY = 0) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    return g;
  };
  const collide = (x, z, hx, hz, kind) => colliders.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, kind });

  /* -------------------------------------------------------------- floor */
  const floorTex = createFloorTexture(renderer);
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(ROOM.width / 2, ROOM.depth / 2);
  const floor = mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.5, metalness: 0, envMapIntensity: 1.2 }),
    { cast: false },
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  /* -------------------------------------------------------------- walls */
  const plasterFor = (len) => {
    const t = createPlasterTexture(renderer);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(len / 3, (H - WAINSCOT_H) / 3);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  };
  const wainscotFor = (len) => {
    const t = createWainscotTexture(renderer);
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(len / 1.2, 1);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
  };
  const walls = [
    { len: ROOM.width, x: 0, z: -halfD, ry: 0 },
    { len: ROOM.width, x: 0, z: halfD, ry: Math.PI },
    { len: ROOM.depth, x: -halfW, z: 0, ry: Math.PI / 2 },
    { len: ROOM.depth, x: halfW, z: 0, ry: -Math.PI / 2 },
  ];
  const wallMats = new Map();
  for (const w of walls) {
    if (!wallMats.has(w.len)) wallMats.set(w.len, { plaster: plasterFor(w.len), wainscot: wainscotFor(w.len) });
    const mats = wallMats.get(w.len);
    const g = placed(w.x, w.z, w.ry); // local +z points into the room
    const upper = mesh(new THREE.PlaneGeometry(w.len, H - WAINSCOT_H), mats.plaster, { cast: false });
    upper.position.set(0, WAINSCOT_H + (H - WAINSCOT_H) / 2, 0);
    g.add(upper);
    const lower = mesh(new THREE.PlaneGeometry(w.len, WAINSCOT_H), mats.wainscot, { cast: false });
    lower.position.set(0, WAINSCOT_H / 2, 0.03);
    g.add(lower);
    box(g, w.len, 0.07, 0.08, M.trim, 0, WAINSCOT_H, 0.04, { cast: false }); // dado rail
    box(g, w.len, 0.17, 0.05, M.walnut, 0, 0.085, 0.055, { cast: false }); // skirting
    box(g, w.len, 0.12, 0.1, M.trim, 0, H - 0.06, 0.05, { cast: false }); // crown
  }

  /* ------------------------------------------------- ceiling + beams */
  const ceiling = mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.depth), std('#f5f5f3', 1), { cast: false });
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  scene.add(ceiling);
  for (let z = -halfD + 1.6; z < halfD - 1; z += 2.4) {
    box(scene, ROOM.width, 0.24, 0.2, M.beam, 0, H - 0.12, z, { cast: false });
  }

  /* ------------------------------------------------- front wall: door + windows */
  {
    const g = placed(0, halfD, Math.PI);
    box(g, 1.3, 2.45, 0.06, M.trim, 0, 1.225, 0.06, { cast: false }); // casing
    const door = box(g, 1.1, 2.3, 0.06, M.door, 0, 1.15, 0.1, { cast: false });
    door.receiveShadow = true;
    for (const [y, h] of [[1.65, 0.85], [0.6, 0.75]]) {
      box(g, 0.82, h, 0.02, M.walnut, 0, y, 0.14, { cast: false });
    }
    const knob = mesh(new THREE.SphereGeometry(0.04, 16, 12), M.brass, { cast: false });
    knob.position.set(0.42, 1.05, 0.16);
    g.add(knob);

    const windowTex = createWindowTexture(renderer);
    const glassMat = new THREE.MeshBasicMaterial({ map: windowTex, toneMapped: false });
    for (const wx of [-5.2, 5.2]) {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.7), glassMat);
      glass.position.set(wx, 2.25, 0.02);
      g.add(glass);
      box(g, 1.56, 0.08, 0.12, M.trim, wx, 3.14, 0.06, { cast: false });
      box(g, 1.7, 0.07, 0.24, M.trim, wx, 1.36, 0.11, { cast: false }); // sill
      box(g, 0.08, 1.8, 0.12, M.trim, wx - 0.74, 2.25, 0.06, { cast: false });
      box(g, 0.08, 1.8, 0.12, M.trim, wx + 0.74, 2.25, 0.06, { cast: false });
      box(g, 0.04, 1.7, 0.06, M.trim, wx, 2.25, 0.05, { cast: false }); // mullions
      box(g, 1.4, 0.04, 0.06, M.trim, wx, 2.5, 0.05, { cast: false });
      // Curtain rod + linen curtains
      cyl(g, 0.018, 0.018, 2.4, M.brass, wx, 3.42, 0.2, 10, { cast: false }).rotation.z = Math.PI / 2;
      for (const side of [-1, 1]) {
        const curtain = box(g, 0.42, 2.9, 0.06, side < 0 ? M.linen : M.linen, wx + side * 1.0, 1.98, 0.2);
        curtain.castShadow = false;
      }
    }
  }

  /* ------------------------------------------------------------ rug */
  const rugMat = new THREE.MeshStandardMaterial({ map: createRugTexture(renderer), roughness: 1, transparent: true, alphaTest: 0.4 });
  const rug = mesh(new THREE.PlaneGeometry(3.4, 4.53), rugMat, { cast: false });
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(5.9, 0.006, 5.2);
  scene.add(rug);

  /* ------------------------------------------------------ furniture */
  function sofa(x, z, rotY, { length = 2.3, fabric = M.rust, pillows = [M.linen, M.moss] } = {}) {
    const g = placed(x, z, rotY);
    const D = 0.95;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.03, 0.025, 0.12, M.walnut, sx * (length / 2 - 0.12), 0.06, sz * (D / 2 - 0.12), 10);
    box(g, length, 0.26, D, fabric, 0, 0.25, 0, { round: 0.05 });
    const inner = length - 0.4;
    const seats = length > 1.4 ? 2 : 1;
    for (let i = 0; i < seats; i++) {
      const cw = inner / seats - 0.02;
      box(g, cw, 0.17, D - 0.3, fabric, -inner / 2 + cw / 2 + i * (cw + 0.02) + 0.01, 0.46, 0.08, { round: 0.07 });
      const back = box(g, cw, 0.42, 0.17, fabric, -inner / 2 + cw / 2 + i * (cw + 0.02) + 0.01, 0.72, -D / 2 + 0.3, { round: 0.07 });
      back.rotation.x = -0.14;
    }
    box(g, length, 0.52, 0.22, fabric, 0, 0.64, -D / 2 + 0.11, { round: 0.08 });
    for (const sx of [-1, 1]) box(g, 0.2, 0.36, D, fabric, sx * (length / 2 - 0.1), 0.56, 0, { round: 0.09 });
    pillows.slice(0, seats).forEach((mat, i) => {
      const p = box(g, 0.4, 0.36, 0.13, mat, (i ? 1 : -1) * (inner / 2 - 0.3), 0.74, -D / 2 + 0.44, { round: 0.06 });
      p.rotation.set(-0.25, 0, (i ? -1 : 1) * 0.12);
    });
    return g;
  }

  // Living corner: sofa against the right wall, coffee table on the rug.
  sofa(halfW - 0.6, 5.2, -Math.PI / 2);
  collide(halfW - 0.6, 5.2, 0.5, 1.2, 'sofa');
  {
    const g = placed(5.55, 5.2, Math.PI / 2);
    box(g, 1.25, 0.06, 0.65, M.walnut, 0, 0.42, 0, { round: 0.02 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.05, 0.39, 0.05, M.walnut, sx * 0.55, 0.195, sz * 0.26);
    box(g, 1.1, 0.03, 0.5, M.walnut, 0, 0.12, 0, { cast: false });
    const bookCols = [M.moss, M.rust, M.cream];
    bookCols.forEach((mat, i) => {
      const b = box(g, 0.34 - i * 0.04, 0.05, 0.24 - i * 0.02, mat, -0.3, 0.475 + i * 0.05, 0.02);
      b.rotation.y = (i - 1) * 0.18;
    });
    cyl(g, 0.045, 0.04, 0.1, M.ceramic, 0.25, 0.5, 0.08, 16); // mug
    cyl(g, 0.07, 0.05, 0.12, M.terracotta, 0.42, 0.51, -0.12, 16);
    const sprig = mesh(new THREE.SphereGeometry(0.11, 12, 10), M.leaf);
    sprig.scale.set(1, 0.8, 1);
    sprig.position.set(0.42, 0.66, -0.12);
    g.add(sprig);
    collide(5.55, 5.2, 0.38, 0.68, 'table');
  }
  // Mustard armchair facing the sofa
  sofa(3.7, 6.6, Math.PI / 2 + 0.35, { length: 1.05, fabric: M.mustard, pillows: [M.linen] });
  collide(3.7, 6.6, 0.55, 0.55, 'chair');

  // Floor lamp beside the sofa
  function floorLamp(x, z) {
    const g = placed(x, z);
    cyl(g, 0.17, 0.19, 0.04, M.iron, 0, 0.02, 0, 20);
    cyl(g, 0.014, 0.014, 1.5, M.brass, 0, 0.77, 0, 8);
    const shade = mesh(
      new THREE.CylinderGeometry(0.17, 0.26, 0.34, 28, 1, true),
      std('#f3e2c3', 0.9, 0, { side: THREE.DoubleSide, emissive: '#ffcf8f', emissiveIntensity: 0.65 }),
      { cast: false },
    );
    shade.position.y = 1.62;
    g.add(shade);
    const light = new THREE.PointLight('#ffc27a', 5, 7, 2);
    light.position.set(x, 1.52, z);
    world.add(light);
    collide(x, z, 0.22, 0.22, 'lamp');
  }
  floorLamp(halfW - 0.45, 7.0);

  // Reading nook: bookshelf on the left wall, armchair, side table + lamp.
  function bookshelf(x, z, rotY) {
    const g = placed(x, z, rotY);
    const L = 2.6;
    const Hs = 2.3;
    const Dp = 0.36;
    for (const sx of [-1, 1]) box(g, 0.05, Hs, Dp, M.walnut, sx * (L / 2), Hs / 2, 0);
    box(g, L + 0.1, 0.05, Dp + 0.04, M.walnut, 0, Hs, 0);
    box(g, L, Hs, 0.02, M.walnut, 0, Hs / 2, -Dp / 2 + 0.01);
    const shelfYs = [0.06, 0.6, 1.14, 1.68];
    for (const y of shelfYs) box(g, L, 0.04, Dp, M.walnut, 0, y, 0);
    const colors = ['#7d2e24', '#2f4a5c', '#c49a45', '#3f5b3a', '#8a5a3b', '#d8c8a8', '#5c3a52', '#a24f2c', '#24323f', '#b8a07a'];
    const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std('#ffffff', 0.85), 180);
    books.castShadow = true;
    books.receiveShadow = true;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const color = new THREE.Color();
    let n = 0;
    for (const y of shelfYs) {
      let cx = -L / 2 + 0.06;
      while (cx < L / 2 - 0.12 && n < 180) {
        if (rand() < 0.06) {
          cx += 0.12 + rand() * 0.15; // a gap for a few ornaments
          continue;
        }
        const w = 0.028 + rand() * 0.04;
        const h = 0.26 + rand() * 0.2;
        const d = 0.2 + rand() * 0.07;
        const lean = rand() < 0.08 ? 0.18 : 0;
        q.setFromEuler(new THREE.Euler(0, 0, -lean));
        m4.compose(new THREE.Vector3(cx + w / 2, y + 0.02 + h / 2, 0.02), q, new THREE.Vector3(w, h, d));
        books.setMatrixAt(n, m4);
        books.setColorAt(n, color.set(colors[Math.floor(rand() * colors.length)]));
        n++;
        cx += w + 0.004 + (lean ? 0.06 : 0);
      }
    }
    books.count = n;
    g.add(books);
    // Vase on top
    cyl(g, 0.06, 0.09, 0.26, M.ceramic, 0.8, Hs + 0.155, 0, 16);
  }
  bookshelf(-halfW + 0.22, 6.5, Math.PI / 2);
  collide(-halfW + 0.22, 6.5, 0.24, 1.35, 'shelf');

  sofa(-6.2, 3.6, 2.35, { length: 1.05, fabric: M.moss, pillows: [M.mustard] });
  collide(-6.2, 3.6, 0.6, 0.6, 'chair');
  {
    const g = placed(-7.55, 2.4);
    cyl(g, 0.3, 0.3, 0.04, M.walnut, 0, 0.58, 0, 28);
    cyl(g, 0.03, 0.03, 0.56, M.walnut, 0, 0.28, 0, 10);
    cyl(g, 0.2, 0.22, 0.03, M.walnut, 0, 0.015, 0, 20);
    cyl(g, 0.07, 0.09, 0.22, M.terracotta, 0.06, 0.71, 0, 16);
    const shade = mesh(
      new THREE.CylinderGeometry(0.1, 0.17, 0.2, 24, 1, true),
      std('#f3e2c3', 0.9, 0, { side: THREE.DoubleSide, emissive: '#ffcf8f', emissiveIntensity: 0.6 }),
      { cast: false },
    );
    shade.position.set(0.06, 0.92, 0);
    g.add(shade);
    const l = new THREE.PointLight('#ffc27a', 2.8, 4.5, 2);
    l.position.set(-7.49, 0.88, 2.4);
    world.add(l);
    collide(-7.55, 2.4, 0.32, 0.32, 'table');
  }

  // Central viewing bench (oak slats)
  {
    const g = placed(0, 0.5);
    for (const z of [-0.16, 0, 0.16]) box(g, 2.2, 0.045, 0.13, M.oak, 0, 0.44, z, { round: 0.015 });
    for (const sx of [-0.95, 0.95]) {
      box(g, 0.05, 0.42, 0.05, M.iron, sx, 0.21, -0.18);
      box(g, 0.05, 0.42, 0.05, M.iron, sx, 0.21, 0.18);
      box(g, 0.05, 0.05, 0.42, M.iron, sx, 0.1, 0);
    }
    collide(0, 0.5, 1.15, 0.28, 'bench');
  }

  // Potted plants
  function plant(x, z, scale = 1) {
    const g = placed(x, z, rand() * Math.PI);
    g.scale.setScalar(scale);
    cyl(g, 0.27, 0.2, 0.5, M.terracotta, 0, 0.25, 0, 28);
    cyl(g, 0.29, 0.29, 0.06, M.terracotta, 0, 0.5, 0, 28);
    cyl(g, 0.25, 0.25, 0.02, M.soil, 0, 0.5, 0, 20, { cast: false });
    const leafGeo = LEAF_GEO;
    const count = 16;
    for (let i = 0; i < count; i++) {
      const yaw = i * 2.399963 + rand() * 0.3;
      const tilt = 0.18 + rand() * 0.55;
      const len = 0.55 + rand() * 0.9;
      const pivot = new THREE.Group();
      pivot.position.y = 0.5;
      pivot.rotation.y = yaw;
      g.add(pivot);
      const arm = new THREE.Group();
      arm.rotation.x = tilt;
      pivot.add(arm);
      const stem = mesh(new THREE.CylinderGeometry(0.008, 0.012, len, 5), M.leafDark, { cast: false });
      stem.position.y = len / 2;
      arm.add(stem);
      const leaf = mesh(leafGeo, [M.leaf, M.leafDark, M.leafLight][i % 3]);
      leaf.scale.setScalar(0.85 + rand() * 0.5);
      leaf.position.y = len - 0.02;
      leaf.rotation.x = 0.5 + rand() * 0.5;
      leaf.rotation.y = (rand() - 0.5) * 0.6;
      arm.add(leaf);
    }
    collide(x, z, 0.32 * scale, 0.32 * scale, 'plant');
  }
  plant(-halfW + 0.7, -halfD + 0.7, 1.15);
  plant(halfW - 0.7, -halfD + 0.7, 1.05);
  plant(halfW - 0.7, halfD - 0.7, 1.2);
  plant(-halfW + 0.7, halfD - 0.7, 0.95);
  plant(-7.6, 1.6, 0.7);

  /* ---------------------------------------------------- salon-hang art */
  const smallFrameMats = [M.walnut, M.brass, std('#2f2622', 0.5)];
  function smallArt(x, y, z, rotY, w, h, seed) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    scene.add(g);
    const b = 0.05;
    const fm = smallFrameMats[seed % smallFrameMats.length];
    box(g, w + b * 2, b, 0.05, fm, 0, h / 2 + b / 2, 0.025);
    box(g, w + b * 2, b, 0.05, fm, 0, -h / 2 - b / 2, 0.025);
    box(g, b, h, 0.05, fm, -w / 2 - b / 2, 0, 0.025);
    box(g, b, h, 0.05, fm, w / 2 + b / 2, 0, 0.025);
    const art = mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: createSmallArtTexture(seed, w / h, renderer), roughness: 0.7 }),
      { cast: false },
    );
    art.position.z = 0.02;
    g.add(art);
  }
  // Above the sofa (right wall faces −x)
  const rw = halfW - 0.01;
  smallArt(rw, 2.35, 4.2, -Math.PI / 2, 0.55, 0.72, 0);
  smallArt(rw, 2.5, 5.25, -Math.PI / 2, 0.8, 0.6, 1);
  smallArt(rw, 2.2, 6.25, -Math.PI / 2, 0.5, 0.5, 2);
  smallArt(rw, 2.85, 6.25, -Math.PI / 2, 0.5, 0.38, 3);
  // Left wall, between the resume and the bookshelf
  const lw = -halfW + 0.01;
  smallArt(lw, 2.2, 1.6, Math.PI / 2, 0.6, 0.8, 5);
  smallArt(lw, 3.15, 6.5, Math.PI / 2, 0.9, 0.55, 6);
  // Front wall beside the door
  smallArt(-2.1, 1.95, halfD - 0.01, Math.PI, 0.55, 0.7, 7);
  smallArt(2.1, 1.95, halfD - 0.01, Math.PI, 0.55, 0.7, 4);

  /* -------------------------------------------------- wall lettering */
  const lettering = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 0.78),
    new THREE.MeshStandardMaterial({ map: createWallLetteringTexture(site, renderer), transparent: true, roughness: 0.9 }),
  );
  lettering.position.set(0.0, 2.45, -halfD + 0.02);
  scene.add(lettering);

  /* ------------------------------------------------------ pendants */
  function pendant(x, z) {
    const drop = 1.05;
    cyl(scene, 0.006, 0.006, drop, M.iron, x, H - drop / 2, z, 6, { cast: false });
    const shade = mesh(
      new THREE.SphereGeometry(0.24, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      std('#b48a3e', 0.35, 0.75, { side: THREE.DoubleSide }),
      { cast: false },
    );
    shade.position.set(x, H - drop - 0.02, z);
    scene.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffe2b0', toneMapped: false }));
    bulb.position.set(x, H - drop - 0.06, z);
    scene.add(bulb);
  }
  pendant(0, -5.5);
  pendant(0, 0.5);
  pendant(0, 6.5);

  /* --------------------------------------------------------- lights */
  world.add(new THREE.HemisphereLight('#ffe8cc', '#5b4030', 0.85));
  world.add(new THREE.AmbientLight('#ffd9b0', 0.08));

  // Low, warm "late afternoon" light from the windows — gives everything soft shadows.
  const sun = new THREE.DirectionalLight('#ffd2a1', 0.55);
  sun.position.set(-6, 9, 16);
  sun.target.position.set(0, 0, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -14;
  sc.right = 14;
  sc.top = 14;
  sc.bottom = -14;
  sc.near = 1;
  sc.far = 40;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 5;
  world.add(sun, sun.target);

  mergeStatic(scene, world);

  return {
    bounds: { minX: -halfW, maxX: halfW, minZ: -halfD, maxZ: halfD },
    colliders,
    update(dt, t) {
      for (const fn of updaters) fn(dt, t);
    },
  };
}

/** A curved, pointed leaf (ShapeGeometry bent along its length and folded at the midrib). */
const LEAF_GEO = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.13, 0.07, 0.12, 0.3, 0, 0.44);
  shape.bezierCurveTo(-0.12, 0.3, -0.13, 0.07, 0, 0);
  const geo = new THREE.ShapeGeometry(shape, 10);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, -0.55 * y * y - Math.abs(x) * 0.35);
  }
  geo.computeVertexNormals();
  return geo;
})();

/**
 * Merge every static mesh under `group` into one mesh per material (world transforms
 * baked in), cutting hundreds of draw calls to a handful. Instanced meshes are kept.
 */
function mergeStatic(group, world) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  const instanced = [];
  group.traverse((o) => {
    if (o.isInstancedMesh) {
      instanced.push(o);
      return;
    }
    if (!o.isMesh) return;
    const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}|${o.renderOrder}`;
    let geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (geo.index) geo = geo.toNonIndexed();
    for (const name of Object.keys(geo.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    }
    geo.morphAttributes = {};
    if (!buckets.has(key)) {
      buckets.set(key, { material: o.material, cast: o.castShadow, receive: o.receiveShadow, order: o.renderOrder, geos: [] });
    }
    buckets.get(key).geos.push(geo);
  });
  for (const m of instanced) world.attach(m);
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    b.geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.renderOrder = b.order;
    mesh.matrixAutoUpdate = false;
    world.add(mesh);
  }
}
