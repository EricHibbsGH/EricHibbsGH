import './styles.css';
import * as THREE from 'three';
import { site, exhibits, resume, wallArt } from './portfolioData.js';
import { Input } from './core/input.js';
import { smoothstep, prefersReducedMotion } from './core/math.js';
import { waitForFonts, createGuideArrowTexture } from './scene/textures.js';
import { buildGallery, ROOM } from './scene/gallery.js';
import { buildFrames } from './scene/frames.js';
import { StickFigure } from './player/stickFigure.js';
import { PlayerController } from './player/controller.js';
import { FollowCamera } from './camera/followCamera.js';
import { Hud } from './ui/hud.js';
import { setupSoundPanel } from './ui/soundPanel.js';
import { Minimap } from './ui/minimap.js';
import { ModalManager } from './ui/modals.js';
import { setupTouchControls } from './ui/touchControls.js';
import { GalleryAudio } from './audio/galleryAudio.js';
import { Guide } from './ui/guide.js';

const INTERACT_DISTANCE = 3.0; // metres — shows the "[E] VIEW …" prompt
const FOCUS_DISTANCE = 4.6; // metres — camera starts framing the artwork
const VIEW_DISTANCE = 3.4; // metres — stop this close to a painting and the camera turns to face it
const SPAWN = new THREE.Vector3(0, 0, 8);
const SEAT_DISTANCE = 1.4; // metres — shows the "Sit down" prompt

const canvas = document.getElementById('scene');
const input = new Input();
const audio = new GalleryAudio();
const state = {
  started: false,
  activeId: null,
  seat: null, // nearest seat in reach, when no painting is
  pendingSeat: null, // clicked seat the figure is walking over to
  hoverSeat: null, // seat under the mouse pointer
  modalCooldown: 0,
  travelFocus: null,
  camYawGoal: 0, // the camera holds this angle; it changes on arrival at a painting or a look-drag
  framed: false, // already auto-framed during this stop
  moveYaw: 0, // movement basis, latched while keys are held
  idle: 0,
};
let world = null;

// Dev-only inspection handle (stripped from production builds).
if (import.meta.env.DEV) {
  window.__gallery = { state, input, audio, get world() { return world; } };
}

/* ------------------------------------------------------------------ HUD */

document.title = `${site.owner} · ${site.role}`;
document.getElementById('intro-title').textContent = site.owner;
document.getElementById('intro-owner').textContent = site.role;
document.getElementById('intro-copy').textContent = site.intro;

const hud = new Hud({
  site,
  exhibits,
  contactHref: resume.contact.find((c) => c.href.startsWith('mailto:'))?.href ?? '',
  resumeUrl: resume.pdfUrl,
  onTravel: (id) => travelTo(id),
  onInteract: () => interact(),
});

setupSoundPanel({ button: document.getElementById('btn-mute'), panel: document.getElementById('sound-panel'), audio });

const guide = new Guide({ exhibits, hud });

const modals = new ModalManager(document.getElementById('modal-root'), {
  exhibits,
  fallbackFocus: canvas,
  onOpen(id) {
    input.setBlocked(true);
    hud.setPrompt(null);
    hud.setActive(id);
    audio.chime();
    guide.markVisited(id);
    document.documentElement.classList.add('has-modal');
    setHash(id);
  },
  onClose() {
    input.setBlocked(false);
    state.modalCooldown = 0.3;
    state.activeId = null; // re-evaluate proximity → prompt reappears
    hud.setActive(null);
    document.documentElement.classList.remove('has-modal');
    setHash('');
  },
});

function setHash(id) {
  const url = id ? `#${id}` : `${location.pathname}${location.search}`;
  history.replaceState(null, '', url);
}

/* -------------------------------------------------------------- actions */

function travelTo(id) {
  audio.unlock();
  if (modals.isOpen) modals.close();
  if (!world) {
    modals.open(id); // WebGL unavailable: the HUD still opens every exhibit
    return Promise.resolve(false);
  }
  const frame = world.frames.find((f) => f.id === id);
  if (!frame) return Promise.resolve(false);
  hud.setActive(id);
  state.travelFocus = frame;
  const opts = prefersReducedMotion() ? { duration: 0.35 } : {};
  return world.controller.travelTo(frame.standPoint, frame.faceYaw, opts).then((arrived) => {
    if (state.travelFocus === frame) state.travelFocus = null;
    if (!modals.isOpen) hud.setActive(null);
    if (arrived) hud.pulsePrompt();
    return arrived;
  });
}

function interact(id = state.activeId) {
  if (modals.isOpen || state.modalCooldown > 0) return;
  if (world?.controller.isSeated) {
    world.controller.standUp();
    return;
  }
  if (!id) {
    if (state.seat) sitOn(state.seat);
    return;
  }
  audio.unlock();
  if (world) {
    const frame = world.frames.find((f) => f.id === id);
    world.controller.cancelTravel();
    world.controller.stop();
    if (frame) world.controller.faceTowards(frame.faceYaw);
  }
  modals.open(id);
}

function sitOn(seat) {
  if (!world) return;
  audio.unlock();
  state.pendingSeat = null;
  world.controller.sit(seat);
  // Swing round to look at the figure from the front of the seat.
  state.camYawGoal = seat.yaw;
  state.framed = true;
}

input.on('any', () => audio.unlock());
input.on('interact', () => interact());
input.on('jump', () => world?.controller.jump());
input.on('escape', () => {
  if (modals.isOpen) modals.close();
  else world?.controller.standUp();
});

/* ---------------------------------------------------------------- intro */

const intro = document.getElementById('intro');
const enterBtn = document.getElementById('enter-btn');

/** "Drag to move camera" notice: shown once after entering, gone after the first drag. */
/**
 * Seat tag: a small marker that hangs in the air beside a seat (projected from the
 * 3D scene every frame), the way games mark something you can interact with.
 */
const seatTag = {
  el: document.getElementById('seat-tag'),
  text: document.querySelector('#seat-tag .seat-tag-text'),
  seat: null,
  label: '',
  anchor: new THREE.Vector3(),
  show(seat, label, withKey, camera) {
    this.seat = seat;
    if (label !== this.label) {
      this.label = label;
      this.text.textContent = label;
      this.el.classList.toggle('has-key', withKey);
      this.el.setAttribute('aria-label', withKey ? `${label} (press E)` : label);
    }
    // Beside the cushion; when sitting, just above the head (over the hips, which sit
    // back from the front edge of the seat).
    const seated = label === 'Stand up';
    if (seated) {
      const back = 0.14;
      this.anchor.set(seat.pos.x - Math.sin(seat.yaw) * back, seat.top + 1.42, seat.pos.z - Math.cos(seat.yaw) * back);
    } else {
      this.anchor.set(seat.pos.x, seat.top + 0.3, seat.pos.z);
    }
    this.anchor.project(camera);
    const onScreen = this.anchor.z < 1 && Math.abs(this.anchor.x) < 1.1 && Math.abs(this.anchor.y) < 1.1;
    this.el.hidden = !onScreen;
    if (!onScreen) return;
    const x = (this.anchor.x * 0.5 + 0.5) * window.innerWidth + (seated ? 0 : 26);
    const y = (-this.anchor.y * 0.5 + 0.5) * window.innerHeight;
    const shift = seated ? 'translate(-50%, -100%)' : 'translateY(-50%)';
    this.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) ${shift}`;
  },
  hide() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.seat = null;
    this.label = '';
  },
};

const lookToast = {
  el: document.getElementById('hud-look-toast'),
  timer: 0,
  done: false,
  show() {
    if (this.done || !world || modals.isOpen) return;
    // On touch screens the coach card already teaches looking around.
    if (document.documentElement.classList.contains('is-touch')) {
      this.done = true;
      return;
    }
    this.el.classList.add('is-visible');
    this.timer = setTimeout(() => this.hide(), 14000);
  },
  hide() {
    this.done = true;
    clearTimeout(this.timer);
    this.el.classList.remove('is-visible');
  },
};

function enterGallery() {
  if (state.started) return;
  state.started = true;
  audio.unlock();
  intro.classList.add('is-leaving');
  setTimeout(() => intro.remove(), 700);
  document.documentElement.classList.add('is-started');
  canvas.focus({ preventScroll: true });
  setTimeout(() => lookToast.show(), 1400);

  const deepLink = location.hash.slice(1);
  if (exhibits.some((e) => e.id === deepLink)) {
    travelTo(deepLink).then((arrived) => arrived && interact(deepLink));
  }
}
enterBtn.addEventListener('click', enterGallery);

/* ---------------------------------------------------------------- world */

async function createWorld() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(quality.ratio());
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  // Nothing that casts a shadow ever moves, so render shadow maps once instead of every frame.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 120);
  fitCamera(camera);
  await waitForFonts();

  const gallery = buildGallery(scene, { renderer, site, wallArt });
  const frames = buildFrames(scene, exhibits, { renderer });
  const colliders = [...gallery.colliders, ...frames.map((f) => f.collider)];

  const figure = new StickFigure();
  figure.root.position.copy(SPAWN);
  scene.add(figure.root);
  figure.onStep = (s) => audio.footstep(s);
  figure.onLand = (s) => audio.land(s);

  const controller = new PlayerController(figure, { bounds: gallery.bounds, colliders });
  // Seated, the feet stay on the floor; the pose lifts the hips onto the cushion.
  const seats = gallery.seats.map((s) => ({ ...s, rootY: 0 }));

  // Floor compass under the figure, pointing to the next exhibit.
  const compass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.MeshBasicMaterial({ map: createGuideArrowTexture(renderer), transparent: true, depthWrite: false, opacity: 0, toneMapped: false }),
  );
  compass.rotation.x = -Math.PI / 2;
  compass.renderOrder = 1;
  const compassPivot = new THREE.Group();
  compassPivot.add(compass);
  scene.add(compassPivot);
  const cam = new FollowCamera(camera, canvas, gallery.bounds, ROOM.height);

  const minimap = new Minimap(document.getElementById('minimap'), {
    bounds: gallery.bounds,
    frames,
    colliders,
    onSelect: (id) => travelTo(id),
  });

  // Click a painting to open it directly; hover shows a pointer cursor.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickables = frames.flatMap((f) => f.pickables);
  const pick = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    return hit && hit.distance < 30 ? hit.object.userData.exhibitId : null;
  };
  // Seats under the pointer (call right after pick(), which aims the ray).
  const seatHit = new THREE.Vector3();
  const pickSeat = () => {
    let best = null;
    let bestD = 30;
    for (const s of seats) {
      const hit = raycaster.ray.intersectBox(s.box, seatHit);
      if (!hit) continue;
      const d = hit.distanceTo(raycaster.ray.origin);
      // Several seats share one bench or sofa: take the one nearest the hit point.
      const score = d + Math.hypot(hit.x - s.pos.x, hit.z - s.pos.z) * 0.01;
      if (score < bestD) {
        bestD = score;
        best = s;
      }
    }
    return best;
  };
  let hoverQueued = null;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || hoverQueued) return;
    hoverQueued = requestAnimationFrame(() => {
      hoverQueued = null;
      const painting = pick(e);
      const seat = !painting && state.started && !modals.isOpen && !controller.isSeated ? pickSeat() : null;
      state.hoverSeat = cam.isLooking ? null : seat;
      canvas.classList.toggle('is-pickable', (!!painting || !!seat) && !modals.isOpen);
    });
  });
  canvas.addEventListener('pointerleave', () => {
    state.hoverSeat = null;
  });

  // The floating seat tag: tap or click it to sit (or stand).
  seatTag.el.addEventListener('click', () => {
    if (controller.isSeated || state.seat) interact();
    else if (seatTag.seat) walkToSeat(seatTag.seat);
  });
  const walkToSeat = (seat) => {
    const d = Math.hypot(controller.position.x - seat.pos.x, controller.position.z - seat.pos.z);
    if (d < SEAT_DISTANCE) {
      sitOn(seat);
    } else {
      audio.unlock();
      controller.walkTo(seat.pos);
      state.pendingSeat = seat;
    }
  };
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    const isClick = downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 8;
    downAt = null;
    if (!state.started || modals.isOpen || !isClick || e.button !== 0) return;
    const id = pick(e);
    if (id) {
      interact(id);
      return;
    }
    // Click a seat: walk over and sit down.
    const seat = controller.isSeated ? null : pickSeat();
    if (seat) {
      walkToSeat(seat);
      return;
    }
    // Click-to-walk: head for the clicked spot on the floor.
    state.pendingSeat = null;
    const hit = raycaster.ray.intersectPlane(floorPlane, floorHit);
    const b = gallery.bounds;
    if (!hit || hit.x < b.minX || hit.x > b.maxX || hit.z < b.minZ || hit.z > b.maxZ) return;
    audio.unlock();
    controller.walkTo(hit);
    marker.position.set(hit.x, 0.015, hit.z);
    marker.userData.t = 0;
    marker.visible = true;
    guide.notifyClickWalk();
  });

  // Click-to-walk target marker (expanding ring).
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const floorHit = new THREE.Vector3();
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.3, 40),
    new THREE.MeshBasicMaterial({ color: '#b23a4e', transparent: true, depthWrite: false, toneMapped: false }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  marker.renderOrder = 1;
  marker.userData.t = 1;
  scene.add(marker);

  setupTouchControls({
    root: document.getElementById('touch-controls'),
    input,
    onJump: () => {
      audio.unlock();
      controller.jump();
    },
  });

  window.addEventListener('resize', () => {
    fitCamera(camera);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setPixelRatio(quality.ratio());
    minimap.resize();
  });

  return { renderer, scene, camera, gallery, frames, figure, controller, cam, minimap, compass, compassPivot, marker, seats };
}

/**
 * Field of view that suits the screen shape. Landscape keeps the 58° framing; a
 * portrait phone widens the vertical angle so the sides of the room stay in view,
 * capped before it turns fish-eye, and shifts the lens to show more wall.
 */
function fitCamera(camera) {
  const aspect = window.innerWidth / window.innerHeight;
  const portraitFov = (2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(31)) / aspect) * 180) / Math.PI;
  camera.aspect = aspect;
  camera.fov = aspect < 1 ? Math.min(70, Math.max(58, portraitFov)) : 58;
  // A tall screen would centre the figure and fill the bottom half with floor.
  // Shift the lens up instead (no extra distortion): the figure sits low and the
  // walls and paintings get the top of the screen.
  if (aspect < 0.9) {
    const h = window.innerHeight;
    camera.setViewOffset(window.innerWidth, h, 0, -h * 0.1, window.innerWidth, h);
  } else {
    camera.clearViewOffset();
  }
  camera.updateProjectionMatrix();
}

/* ----------------------------------------------------------------- loop */

function startLoop(w) {
  const clock = new THREE.Clock();
  let t = 0;
  let mapTick = 0;
  const zeroAxis = { x: 0, y: 0 };
  const pos = w.figure.root.position;

  w.renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    t += dt;
    state.modalCooldown = Math.max(0, state.modalCooldown - dt);

    // Before entering: slow attract-mode sway of the camera behind the intro card.
    w.cam.yawOffset = state.started ? w.cam.yawOffset * Math.exp(-3 * dt) : Math.sin(t * 0.18) * 0.32;

    const axis = state.started ? input.axis : zeroAxis;
    const moving = Math.hypot(axis.x, axis.y) > 0.01;
    if (moving && w.controller.isSeated) w.controller.standUp(); // walking off gets you up
    if (moving) state.pendingSeat = null;
    // Walking to a clicked seat: sit once close enough, or give up if the walk ended short.
    if (state.pendingSeat) {
      const s = state.pendingSeat;
      const d = Math.hypot(pos.x - s.pos.x, pos.z - s.pos.z);
      if (d < 0.6 || (!w.controller.isWalkingToGoal && d < SEAT_DISTANCE)) sitOn(s);
      else if (!w.controller.isWalkingToGoal) state.pendingSeat = null;
    }
    if (moving && w.controller.isTraveling) {
      w.controller.cancelTravel(); // the player takes over mid-glide
      state.travelFocus = null;
    }
    // Screen-relative controls: lock the direction mapping while keys are held so
    // a camera ease never bends the path you are walking.
    // (While drag-looking, directions follow the view live.)
    if (!moving || w.cam.isLooking) state.moveYaw = w.cam.yaw;

    w.controller.update(dt, axis, input.running, state.moveYaw);
    const busy = moving || w.controller.isWalkingToGoal || w.controller.isTraveling || w.controller.speed > 0.3;
    state.idle = busy ? 0 : state.idle + dt;
    if (busy && !w.controller.isTraveling) state.framed = false; // next stop may frame again

    // Click marker animation
    if (w.marker.visible) {
      const mt = (w.marker.userData.t += dt);
      const s = 0.6 + Math.min(1, mt / 0.5) * 0.7;
      w.marker.scale.set(s, s, s);
      w.marker.material.opacity = Math.max(0, 1 - mt / 0.7);
      if (mt > 0.7) w.marker.visible = false;
    }
    w.gallery.update(dt, t);

    // Proximity detection
    let nearest = null;
    let nearestDist = Infinity;
    for (const f of w.frames) {
      const d = Math.hypot(pos.x - f.center.x, pos.z - f.center.z);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = f;
      }
    }
    const openId = modals.current?.id ?? null;
    const active = state.started && !openId && nearestDist < INTERACT_DISTANCE ? nearest : null;
    for (const f of w.frames) f.update(dt, f === active || f.id === openId, t);
    const activeId = active?.id ?? null;
    state.activeId = activeId;
    // No painting in reach: offer the nearest seat, or getting up from one.
    state.seat = null;
    if (state.started && !openId && !active && !w.controller.isSeated) {
      let best = SEAT_DISTANCE;
      for (const s of w.seats) {
        const d = Math.hypot(pos.x - s.pos.x, pos.z - s.pos.z);
        if (d < best) {
          best = d;
          state.seat = s;
        }
      }
    }
    hud.setPrompt(active ? active.exhibit : null);
    if (state.started && !openId) {
      if (w.controller.isSeated) seatTag.show(w.controller.seat, 'Stand up', true, w.camera);
      else if (state.seat) seatTag.show(state.seat, 'Sit', true, w.camera);
      else if (state.hoverSeat) seatTag.show(state.hoverSeat, 'Click to sit', false, w.camera);
      else seatTag.hide();
    } else {
      seatTag.hide();
    }

    // Camera angle: hold steady while walking; turn to face a painting once, on arrival
    // (stopping in front of it or quick-travelling to it). A look-drag always wins
    // and its angle sticks.
    if (w.cam.isLooking || w.cam.justLooked) {
      if (!lookToast.done) lookToast.hide(); // they found it
      state.camYawGoal = w.cam.yaw;
      state.framed = true;
    } else if (state.travelFocus) {
      state.camYawGoal = state.travelFocus.viewYaw;
    } else if (state.started && !state.framed && state.idle > 0.35 && nearestDist < VIEW_DISTANCE) {
      state.camYawGoal = nearest.viewYaw;
      state.framed = true;
    }

    // Camera framing: ease in toward artwork that is in front of the camera.
    let focus = null;
    const focusFrame = state.travelFocus ?? (state.started && nearestDist < FOCUS_DISTANCE ? nearest : null);
    if (focusFrame) {
      const dx = focusFrame.center.x - pos.x;
      const dz = focusFrame.center.z - pos.z;
      const d = Math.hypot(dx, dz);
      const viewYaw = w.cam.yaw + Math.PI; // direction the camera looks
      const inView = (Math.sin(viewYaw) * dx + Math.cos(viewYaw) * dz) / Math.max(d, 1e-3);
      const near = state.travelFocus ? smoothstep(8, 2.4, d) : smoothstep(FOCUS_DISTANCE, 1.8, d);
      focus = { point: focusFrame.center, weight: near * smoothstep(0.3, 0.85, inView) };
    }
    w.cam.update(dt, pos, state.camYawGoal, focus);
    w.figure.faceCamera(w.camera);

    // Directional help: HUD pill + floor compass toward the nearest unseen exhibit.
    // Directions are given relative to the screen ("ahead" = away from the camera).
    const target = guide.update(dt, { started: state.started, pos, yaw: w.cam.yaw + Math.PI, frames: w.frames, activeId, modalOpen: !!openId });
    const showCompass = state.started && !openId && target && target.distance > 2.6 && pos.y < 0.05;
    const cm = w.compass.material;
    cm.opacity += ((showCompass ? 0.9 : 0) - cm.opacity) * Math.min(1, dt * 8);
    w.compassPivot.visible = cm.opacity > 0.01;
    if (target) {
      w.compassPivot.position.set(pos.x, 0.02, pos.z);
      const ty = Math.atan2(target.frame.standPoint.x - pos.x, target.frame.standPoint.z - pos.z);
      w.compassPivot.rotation.y = ty + Math.PI;
    }

    // Mini-map at ~30 fps is plenty.
    if ((mapTick = (mapTick + 1) % 2) === 0) {
      w.minimap.draw({ player: pos, playerYaw: w.controller.yaw, cameraYaw: w.cam.yaw, activeId: openId ?? activeId, t });
    }

    w.renderer.render(w.scene, w.camera);
    quality.sample(dt, w.renderer);
  });
}

/**
 * Adaptive resolution: if the frame rate drops, render fewer pixels; if there is
 * headroom, climb back toward the display's native sharpness.
 */
const quality = {
  scale: 1,
  frames: 0,
  time: 0,
  ratio() {
    return Math.max(0.6, Math.min(window.devicePixelRatio || 1, 2) * this.scale);
  },
  sample(dt, renderer) {
    if (document.hidden) return;
    this.frames++;
    this.time += dt;
    if (this.time < 1.5) return;
    const fps = this.frames / this.time;
    this.frames = 0;
    this.time = 0;
    const before = this.scale;
    if (fps < 50) this.scale = Math.max(0.55, this.scale - 0.15);
    else if (fps > 58 && this.scale < 1) this.scale = Math.min(1, this.scale + 0.1);
    if (this.scale !== before) renderer.setPixelRatio(this.ratio());
  },
};

function showWebGLFallback(err) {
  console.error('[gallery] WebGL initialisation failed:', err);
  document.documentElement.classList.add('no-webgl');
  document.getElementById('intro-copy').textContent =
    'Your browser could not start the 3D view, but every exhibit is still available from the Quick Travel bar.';
}

(async () => {
  try {
    world = await createWorld();
    startLoop(world);
  } catch (err) {
    world = null;
    showWebGLFallback(err);
  }
  enterBtn.disabled = false;
  enterBtn.querySelector('.label').textContent = world ? 'Enter the gallery' : 'Browse exhibits';
  enterBtn.focus({ preventScroll: true });
})();
