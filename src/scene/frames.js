import * as THREE from 'three';
import { ROOM } from './gallery.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createArtworkTexture, createPlaqueTexture, createTitleSignTexture, PALETTE } from './textures.js';
import { damp } from '../core/math.js';

const BORDER = 0.1;
const DEPTH = 0.09;
const MAT_PAD = 0.12;
const STAND_DISTANCE = 2.0;
const GLOW = new THREE.Color('#ffb36b');
const ACCENT = new THREE.Color(PALETTE.accent);
const INK = new THREE.Color('#6b5440');
const FRAME_FINISHES = [
  { color: '#5b3a22', roughness: 0.5, metalness: 0.05 }, // walnut
  { color: '#b08a45', roughness: 0.32, metalness: 0.75 }, // brass
];

/** Convert a wall placement from portfolioData into a world transform. */
function placementTransform({ wall, offset = 0, height = 3.1 }) {
  const halfW = ROOM.width / 2;
  const halfD = ROOM.depth / 2;
  const inset = 0.005;
  switch (wall) {
    case 'left':
      return { position: new THREE.Vector3(-halfW + inset, height, offset), normal: new THREE.Vector3(1, 0, 0), rotY: Math.PI / 2 };
    case 'right':
      return { position: new THREE.Vector3(halfW - inset, height, offset), normal: new THREE.Vector3(-1, 0, 0), rotY: -Math.PI / 2 };
    case 'front':
      return { position: new THREE.Vector3(offset, height, halfD - inset), normal: new THREE.Vector3(0, 0, -1), rotY: Math.PI };
    case 'back':
    default:
      return { position: new THREE.Vector3(offset, height, -halfD + inset), normal: new THREE.Vector3(0, 0, 1), rotY: 0 };
  }
}

/**
 * Builds the four framed exhibits: border, mat, artwork plane, plaque, a dedicated
 * shadow-casting spotlight with a visible track fixture, and a floor "stand here" pad.
 */
export function buildFrames(scene, exhibits, { renderer }) {
  const loader = new THREE.TextureLoader();

  return exhibits.map((exhibit, index) => {
    const { width: w, height: h } = exhibit.size;
    const { position, normal, rotY } = placementTransform(exhibit.placement);

    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = rotY;
    group.name = `frame-${exhibit.id}`;

    // Frame moulding (4 boxes) — its own material so it can glow on proximity.
    const finish = FRAME_FINISHES[index % FRAME_FINISHES.length];
    const borderMat = new THREE.MeshStandardMaterial({ ...finish, emissive: GLOW.clone(), emissiveIntensity: 0 });
    const pieces = [
      [w + BORDER * 2, BORDER, 0, h / 2 + BORDER / 2],
      [w + BORDER * 2, BORDER, 0, -h / 2 - BORDER / 2],
      [BORDER, h, -w / 2 - BORDER / 2, 0],
      [BORDER, h, w / 2 + BORDER / 2, 0],
    ];
    const pickables = [];
    for (const [bw, bh, x, y] of pieces) {
      const m = new THREE.Mesh(new RoundedBoxGeometry(bw, bh, DEPTH, 3, 0.022), borderMat);
      m.position.set(x, y, DEPTH / 2);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      pickables.push(m);
    }

    // Backing board + white mat (passe-partout)
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.02),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }),
    );
    backing.position.z = 0.03;
    backing.receiveShadow = true;
    group.add(backing);
    pickables.push(backing);

    // Artwork
    const artW = w - MAT_PAD * 2;
    const artH = h - MAT_PAD * 2;
    const artMat = new THREE.MeshStandardMaterial({
      map: createArtworkTexture(exhibit.preview?.style, artW / artH, renderer, 11 + index * 31),
      roughness: 0.55,
      metalness: 0,
    });
    const art = new THREE.Mesh(new THREE.PlaneGeometry(artW, artH), artMat);
    art.position.z = 0.045;
    art.receiveShadow = true;
    group.add(art);
    pickables.push(art);

    if (exhibit.preview?.image) {
      loader.load(
        exhibit.preview.image,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          artMat.map?.dispose();
          artMat.map = tex;
          artMat.needsUpdate = true;
        },
        undefined,
        () => console.warn(`[gallery] Could not load artwork for "${exhibit.id}", keeping procedural preview.`),
      );
    }

    // Plaque beneath the frame
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.5),
      (() => {
        const t = createPlaqueTexture(exhibit, renderer);
        return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.85 });
      })(),
    );
    const side = exhibit.placement.labelSide ?? 1;
    plaque.position.set(side * (w / 2 + BORDER + 0.66), -h / 2 + 0.3, 0.012);
    group.add(plaque);
    pickables.push(plaque);

    // Painted title above the painting, readable from across the room.
    const signTex = createTitleSignTexture(exhibit, renderer);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 0.488),
      new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: '#ffffff', emissiveIntensity: 0.22, transparent: true, roughness: 0.9 }),
    );
    sign.position.set(0, h / 2 + BORDER + 0.38, 0.012);
    group.add(sign);
    pickables.push(sign);

    for (const p of pickables) p.userData.exhibitId = exhibit.id;
    scene.add(group);

    /* --------------------------------------------- spotlight + fixture */
    const spotPos = position.clone().addScaledVector(normal, 1.8);
    spotPos.y = ROOM.height - 0.4;
    const spot = new THREE.SpotLight('#ffd9a8', 48, 0, 0.6, 0.55, 2);
    spot.position.copy(spotPos);
    spot.target.position.copy(position).add(new THREE.Vector3(0, -0.25, 0));
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.camera.near = 0.5;
    spot.shadow.camera.far = 8;
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.02;
    scene.add(spot, spot.target);

    const fixture = new THREE.Group();
    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 0.32, 18, 1, true),
      new THREE.MeshStandardMaterial({ color: '#1d1e22', roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide }),
    );
    can.rotation.x = Math.PI / 2;
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.1, 18),
      new THREE.MeshBasicMaterial({ color: '#fff4e0' }),
    );
    lens.position.z = 0.155;
    fixture.add(can, lens);
    fixture.position.copy(spotPos);
    fixture.lookAt(spot.target.position);
    scene.add(fixture);
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, ROOM.height - spotPos.y, 8),
      new THREE.MeshStandardMaterial({ color: '#2c2520', roughness: 0.5, metalness: 0.4 }),
    );
    rod.position.set(spotPos.x, (ROOM.height + spotPos.y) / 2, spotPos.z);
    scene.add(rod);

    /* ------------------------------------------------------ floor pad */
    const standPoint = position.clone().addScaledVector(normal, STAND_DISTANCE);
    standPoint.y = 0;
    const padFill = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 48),
      new THREE.MeshBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0.0, depthWrite: false }),
    );
    const padRing = new THREE.Mesh(
      new THREE.RingGeometry(0.58, 0.62, 64),
      new THREE.MeshBasicMaterial({ color: PALETTE.ink, transparent: true, opacity: 0.0, depthWrite: false }),
    );
    for (const pad of [padFill, padRing]) {
      pad.rotation.x = -Math.PI / 2;
      pad.position.copy(standPoint).setY(0.006);
      pad.renderOrder = 1;
      scene.add(pad);
    }

    /* -------------------------------------------------------- collider */
    const halfSpan = w / 2 + BORDER;
    const protrude = DEPTH + 0.06;
    let collider;
    if (exhibit.placement.wall === 'left' || exhibit.placement.wall === 'right') {
      const x0 = position.x;
      const x1 = position.x + normal.x * protrude;
      collider = { minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: position.z - halfSpan, maxZ: position.z + halfSpan, kind: 'frame' };
    } else {
      const z0 = position.z;
      const z1 = position.z + normal.z * protrude;
      collider = { minX: position.x - halfSpan, maxX: position.x + halfSpan, minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1), kind: 'frame' };
    }

    const baseSpot = spot.intensity;
    let glow = 0;

    return {
      id: exhibit.id,
      exhibit,
      group,
      center: position.clone(),
      normal: normal.clone(),
      /** Camera yaw that looks straight at the artwork. */
      viewYaw: Math.atan2(normal.x, normal.z),
      /** Player yaw that faces the artwork. */
      faceYaw: Math.atan2(-normal.x, -normal.z),
      standPoint,
      pickables,
      collider,
      spot,
      /** Animate highlight toward `active` (0..1). */
      update(dt, active, t) {
        glow = damp(glow, active ? 1 : 0, 8, dt);
        const pulse = active ? 0.75 + 0.25 * Math.sin(t * 4) : 1;
        borderMat.emissiveIntensity = glow * 0.18 * pulse;
        spot.intensity = baseSpot * (1 + glow * 0.35);
        padFill.material.opacity = glow * 0.12 * pulse;
        padRing.material.opacity = 0.12 + glow * 0.5;
        padRing.material.color.lerpColors(INK, ACCENT, glow);
        const s = 1 + glow * 0.06 * Math.sin(t * 3);
        padRing.scale.set(s, s, s);
      },
    };
  });
}
