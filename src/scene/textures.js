import * as THREE from 'three';
import { mulberry32 } from '../core/math.js';

/**
 * Procedural canvas artwork. Every texture in the gallery is drawn here so the app
 * runs with zero external assets. Swap any frame to a real image via
 * `exhibits[i].preview.image` in portfolioData.js.
 */

export const PALETTE = {
  ink: '#2b231d',
  ink2: '#4a3f36',
  paper: '#ffffff',
  cream: '#f5f5f4',
  accent: '#c2603a',
  accentSoft: '#f0c9b3',
  blue: '#3d5a73',
  green: '#4f7a52',
  gold: '#c99a3e',
  muted: '#8f857a',
  line: '#e2d8c6',
};

const SERIF = 'Georgia, "Times New Roman", Times, serif';
const SANS = 'Georgia, "Times New Roman", Times, serif';
const MONO = '"JetBrains Mono", Consolas, ui-monospace, monospace';

/* ---------------------------------------------------------------- helpers */

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  return [c, c.getContext('2d')];
}

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillRR(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  rr(ctx, x, y, w, h, r);
  ctx.fill();
}

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Placeholder "text" as rounded bars. */
function textLines(ctx, rand, x, y, w, count, gap, thick, color, lastShort = true) {
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const lw = isLast && lastShort ? w * (0.3 + rand() * 0.35) : w * (0.78 + rand() * 0.22);
    fillRR(ctx, x, y + i * gap, lw, thick, thick / 2, color);
  }
}

function arrow(ctx, x1, y1, x2, y2, color, width, head = 14) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45));
  ctx.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}

function grain(ctx, W, H, rand, amount = 0.04, count = 9000) {
  for (let i = 0; i < count; i++) {
    const v = rand() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${rand() * amount})`;
    ctx.fillRect(rand() * W, rand() * H, 1.6, 1.6);
  }
}

export function toTexture(canvas, renderer, { srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer ? Math.min(16, renderer.capabilities.getMaxAnisotropy()) : 1;
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------ artwork */

function drawResume(ctx, W, H, rand) {
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, W, H);

  const m = W * 0.08;
  const bandH = H * 0.22;
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(0, 0, W, bandH);

  // Avatar with a person glyph clipped to a circle
  const ar = W * 0.1;
  const ax = m + ar;
  const ay = bandH / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = PALETTE.accent;
  ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
  circle(ctx, ax, ay - ar * 0.18, ar * 0.36, PALETTE.paper);
  ctx.beginPath();
  ctx.ellipse(ax, ay + ar * 0.85, ar * 0.66, ar * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = PALETTE.paper;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${W * 0.105}px ${SERIF}`;
  ctx.fillText('Resume', ax + ar + m * 0.6, ay + W * 0.012);
  ctx.font = `600 ${W * 0.026}px ${MONO}`;
  ctx.fillStyle = PALETTE.accentSoft;
  ctx.fillText('CURRICULUM VITAE', ax + ar + m * 0.62, ay + W * 0.065);

  // Left column — skills as bars
  const top = bandH + m;
  const leftW = W * 0.3;
  ctx.font = `700 ${W * 0.026}px ${MONO}`;
  ctx.fillStyle = PALETTE.accent;
  ctx.fillText('SKILLS', m, top);
  for (let i = 0; i < 6; i++) {
    const y = top + W * 0.045 + i * W * 0.075;
    fillRR(ctx, m, y, leftW * (0.45 + rand() * 0.3), W * 0.014, 6, PALETTE.ink2);
    fillRR(ctx, m, y + W * 0.028, leftW, W * 0.016, 8, PALETTE.line);
    fillRR(ctx, m, y + W * 0.028, leftW * (0.45 + rand() * 0.55), W * 0.016, 8, PALETTE.ink);
  }
  const eduY = top + W * 0.55;
  ctx.fillStyle = PALETTE.accent;
  ctx.fillText('EDUCATION', m, eduY);
  textLines(ctx, rand, m, eduY + W * 0.04, leftW, 4, W * 0.04, W * 0.016, PALETTE.muted);

  // Right column — experience timeline
  const rx = m + leftW + m * 0.9;
  const rw = W - rx - m;
  ctx.fillStyle = PALETTE.accent;
  ctx.fillText('EXPERIENCE', rx, top);
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(rx + 8, top + W * 0.05);
  ctx.lineTo(rx + 8, H - m * 1.4);
  ctx.stroke();
  const blocks = 4;
  const span = (H - m * 1.4 - (top + W * 0.05)) / blocks;
  for (let b = 0; b < blocks; b++) {
    const y = top + W * 0.06 + b * span;
    circle(ctx, rx + 8, y + 8, 11, b === 0 ? PALETTE.accent : PALETTE.ink);
    fillRR(ctx, rx + 36, y, rw * 0.6, W * 0.022, 8, PALETTE.ink);
    fillRR(ctx, rx + 36, y + W * 0.038, rw * 0.32, W * 0.014, 6, PALETTE.accent);
    textLines(ctx, rand, rx + 36, y + W * 0.075, rw - 40, 3, W * 0.035, W * 0.013, PALETTE.muted);
  }
  grain(ctx, W, H, rand, 0.035);
}

function drawGithub(ctx, W, H, rand) {
  ctx.fillStyle = '#121419';
  ctx.fillRect(0, 0, W, H);

  // Window chrome
  const bar = H * 0.075;
  ctx.fillStyle = '#1c1f27';
  ctx.fillRect(0, 0, W, bar);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => circle(ctx, bar * 0.6 + i * bar * 0.55, bar / 2, bar * 0.17, c));
  ctx.font = `500 ${bar * 0.36}px ${MONO}`;
  ctx.fillStyle = '#8a90a0';
  ctx.textAlign = 'center';
  ctx.fillText('~/projects — main', W / 2, bar * 0.62);
  ctx.textAlign = 'left';

  // File tree
  const treeW = W * 0.22;
  ctx.fillStyle = '#171a21';
  ctx.fillRect(0, bar, treeW, H - bar);
  const rows = ['src', 'core', 'scene', 'ui', 'tests', 'docs', 'README'];
  ctx.font = `500 ${H * 0.03}px ${MONO}`;
  rows.forEach((r, i) => {
    const y = bar + H * 0.08 + i * H * 0.065;
    const indent = i > 0 && i < 4 ? W * 0.025 : 0;
    fillRR(ctx, W * 0.03 + indent, y - H * 0.02, H * 0.022, H * 0.022, 3, i === 2 ? PALETTE.accent : '#4a5060');
    ctx.fillStyle = i === 2 ? '#f0f0f0' : '#8a90a0';
    ctx.fillText(r, W * 0.03 + indent + H * 0.04, y);
  });

  // Big </> mark
  const cx = treeW + (W - treeW) / 2;
  const cy = bar + (H - bar) * 0.36;
  ctx.font = `700 ${H * 0.3}px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.accent;
  ctx.fillText('</>', cx, cy);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Code lines
  const colors = ['#c678dd', '#61afef', '#98c379', '#e5c07b', '#abb2bf', '#56b6c2'];
  const codeX = treeW + W * 0.05;
  const codeTop = bar + (H - bar) * 0.6;
  for (let i = 0; i < 5; i++) {
    const y = codeTop + i * H * 0.045;
    ctx.fillStyle = '#4a5060';
    ctx.font = `500 ${H * 0.026}px ${MONO}`;
    ctx.fillText(String(i + 12), codeX - W * 0.035, y + H * 0.018);
    let x = codeX + (i % 3) * W * 0.03;
    const segs = 2 + Math.floor(rand() * 4);
    for (let s = 0; s < segs; s++) {
      const w = W * (0.04 + rand() * 0.12);
      if (x + w > W - W * 0.05) break;
      fillRR(ctx, x, y, w, H * 0.02, 6, colors[Math.floor(rand() * colors.length)]);
      x += w + W * 0.015;
    }
  }

  // Contribution graph strip
  const gx = treeW + W * 0.05;
  const gy = H - H * 0.13;
  const cell = (W - gx - W * 0.05) / 30;
  for (let c = 0; c < 30; c++) {
    for (let r = 0; r < 3; r++) {
      const v = rand();
      const color = v > 0.8 ? PALETTE.accent : v > 0.55 ? '#a8442f' : v > 0.3 ? '#5a2c24' : '#23262f';
      fillRR(ctx, gx + c * cell, gy + r * cell, cell * 0.78, cell * 0.78, 3, color);
    }
  }
}

function drawPaper(ctx, W, H, rand) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const m = W * 0.09;

  // Title block
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.font = `${W * 0.06}px ${SERIF}`;
  ctx.fillText('Research Paper', W / 2, m + W * 0.04);
  ctx.textAlign = 'left';
  fillRR(ctx, W * 0.2, m + W * 0.075, W * 0.6, W * 0.022, 8, PALETTE.ink);
  fillRR(ctx, W * 0.3, m + W * 0.115, W * 0.4, W * 0.014, 6, PALETTE.muted);
  fillRR(ctx, W * 0.36, m + W * 0.145, W * 0.28, W * 0.012, 6, PALETTE.line);

  // Abstract box
  const ay = m + W * 0.2;
  ctx.fillStyle = '#f6f4ef';
  ctx.fillRect(m, ay, W - m * 2, W * 0.27);
  ctx.font = `700 ${W * 0.024}px ${SANS}`;
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText('Abstract', m + W * 0.03, ay + W * 0.05);
  textLines(ctx, rand, m + W * 0.03, ay + W * 0.075, W - m * 2 - W * 0.06, 6, W * 0.03, W * 0.011, '#9b9fa8');

  // Two columns
  const colTop = ay + W * 0.32;
  const gap = W * 0.05;
  const colW = (W - m * 2 - gap) / 2;
  const leftX = m;
  const rightX = m + colW + gap;
  ctx.font = `700 ${W * 0.022}px ${SANS}`;
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText('1  Introduction', leftX, colTop);
  textLines(ctx, rand, leftX, colTop + W * 0.03, colW, 13, W * 0.028, W * 0.01, '#a4a8b0');
  const l2 = colTop + W * 0.03 + 13 * W * 0.028 + W * 0.04;
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText('2  Method', leftX, l2);
  textLines(ctx, rand, leftX, l2 + W * 0.03, colW, Math.max(3, Math.floor((H - m - l2 - W * 0.05) / (W * 0.028))), W * 0.028, W * 0.01, '#a4a8b0');

  // Figure with a chart in the right column
  const fh = colW * 0.75;
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = 3;
  ctx.strokeRect(rightX, colTop - W * 0.02, colW, fh);
  const px = rightX + colW * 0.12;
  const py = colTop - W * 0.02 + fh * 0.85;
  ctx.strokeStyle = PALETTE.ink2;
  ctx.beginPath();
  ctx.moveTo(px, colTop + W * 0.01);
  ctx.lineTo(px, py);
  ctx.lineTo(rightX + colW * 0.92, py);
  ctx.stroke();
  const series = [
    { color: PALETTE.accent, k: 1.0 },
    { color: PALETTE.blue, k: 0.62 },
  ];
  series.forEach(({ color, k }) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const x = px + (i / 10) * colW * 0.78;
      const y = py - (Math.log(1 + i * 1.6) / Math.log(17)) * fh * 0.62 * k - rand() * 6;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
  ctx.font = `${W * 0.02}px ${SERIF}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('Figure 1. Throughput vs. workers', rightX, colTop + fh + W * 0.01);
  const r2 = colTop + fh + W * 0.05;
  textLines(ctx, rand, rightX, r2, colW, Math.max(3, Math.floor((H - m - r2) / (W * 0.028))), W * 0.028, W * 0.01, '#a4a8b0');

  ctx.font = `500 ${W * 0.018}px ${MONO}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.textAlign = 'center';
  ctx.fillText('— 1 —', W / 2, H - m * 0.45);
  ctx.textAlign = 'left';
}

function drawSystem(ctx, W, H, rand) {
  ctx.fillStyle = PALETTE.cream;
  ctx.fillRect(0, 0, W, H);
  // Dot grid
  ctx.fillStyle = '#d6d0c2';
  const step = W / 32;
  for (let x = step; x < W; x += step) for (let y = step; y < H; y += step) ctx.fillRect(x - 1.5, y - 1.5, 3, 3);

  const nw = W * 0.17;
  const nh = H * 0.12;
  const node = (x, y, label, fill, text = PALETTE.paper) => {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    rr(ctx, x - nw / 2 + 6, y - nh / 2 + 8, nw, nh, 14);
    ctx.fill();
    fillRR(ctx, x - nw / 2, y - nh / 2, nw, nh, 14, fill);
    ctx.fillStyle = text;
    ctx.font = `600 ${H * 0.038}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  };

  const c1 = W * 0.12, c2 = W * 0.34, c3 = W * 0.58, c4 = W * 0.84;
  const mid = H * 0.5, up = H * 0.24, dn = H * 0.76;
  const e = (x1, y1, x2, y2, color = PALETTE.ink2, dashed = false) => {
    ctx.setLineDash(dashed ? [14, 12] : []);
    arrow(ctx, x1, y1, x2, y2, color, 5, 18);
    ctx.setLineDash([]);
  };
  e(c1 + nw / 2, mid, c2 - nw / 2 - 6, mid);
  e(c2 + nw / 2, mid, c3 - nw / 2 - 6, up);
  e(c2 + nw / 2, mid, c3 - nw / 2 - 6, mid);
  e(c2 + nw / 2, mid, c3 - nw / 2 - 6, dn);
  e(c3 + nw / 2, up, c4 - nw / 2 - 6, up);
  e(c3 + nw / 2, mid, c4 - nw / 2 - 6, mid, PALETTE.accent, true);
  e(c3 + nw / 2, dn, c4 - nw / 2 - 6, dn);
  e(c3 + nw / 2, up + nh * 0.3, c4 - nw / 2 - 6, mid - nh * 0.3, PALETTE.accent, true);

  node(c1, mid, 'PEOPLE', PALETTE.ink);
  node(c2, mid, 'DEFINE', PALETTE.accent);
  node(c3, up, 'SKETCH', PALETTE.ink2);
  node(c3, mid, 'PROTO', PALETTE.ink2);
  node(c3, dn, 'TEST', PALETTE.ink2);
  node(c4, up, 'MEASURE', PALETTE.blue);
  node(c4, mid, 'REFINE', PALETTE.gold, PALETTE.ink);
  node(c4, dn, 'SHIP', PALETTE.green);

  // Diamond decision marker
  ctx.save();
  ctx.translate(c2, H * 0.17);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 4;
  ctx.strokeRect(-H * 0.035, -H * 0.035, H * 0.07, H * 0.07);
  ctx.restore();

  ctx.font = `${H * 0.065}px ${SERIF}`;
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText('How I Build', W * 0.05, H * 0.11);
  ctx.font = `500 ${H * 0.028}px ${MONO}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('UNDERSTAND · TEST · REFINE', W * 0.05, H * 0.165);
  grain(ctx, W, H, rand, 0.03, 6000);
}

const ARTISTS = { resume: drawResume, github: drawGithub, paper: drawPaper, system: drawSystem };

/** Build the preview artwork for an exhibit at the given aspect ratio (width / height). */
export function createArtworkTexture(style, aspect, renderer, seed = 7) {
  const W = 2048;
  const H = Math.round(W / aspect);
  const [canvas, ctx] = makeCanvas(W, H);
  const rand = mulberry32(seed);
  (ARTISTS[style] || drawResume)(ctx, W, H, rand);
  return toTexture(canvas, renderer);
}

/* ------------------------------------------------------- environment */

/** Draw soft blobs that wrap at the edges so the texture tiles seamlessly. */
function mottle(ctx, S, rand, count, rMin, rMax, light, dark) {
  for (let i = 0; i < count; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = rMin + rand() * (rMax - rMin);
    const color = rand() < 0.5 ? dark : light;
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }
}

/** Warm oak planks; one texture repeat = 2 m × 2 m (10 boards of 20 cm). */
export function createFloorTexture(renderer) {
  const S = 1024;
  const [canvas, ctx] = makeCanvas(S, S);
  const rand = mulberry32(42);
  const boards = 10;
  const bw = S / boards;
  for (let i = 0; i < boards; i++) {
    const x0 = i * bw;
    let y = rand() * S;
    const end = y + S;
    while (y < end) {
      const len = S * (0.35 + rand() * 0.45);
      const segEnd = Math.min(y + len, end);
      const h = 27 + rand() * 6;
      const s = 30 + rand() * 8;
      const l = 41 + rand() * 7;
      const base = `hsl(${h} ${s}% ${l}%)`;
      // Draw the board segment, wrapping vertically.
      for (const oy of [0, -S]) {
        const top = y + oy;
        ctx.fillStyle = base;
        ctx.fillRect(x0, top, bw, segEnd - y);
        // Grain streaks
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, top, bw, segEnd - y);
        ctx.clip();
        for (let g = 0; g < 16; g++) {
          const gx = x0 + rand() * bw;
          ctx.strokeStyle = `hsla(${h - 4} 45% ${l - 14}% / ${0.12 + rand() * 0.18})`;
          ctx.lineWidth = 0.8 + rand() * 1.6;
          ctx.beginPath();
          ctx.moveTo(gx, top);
          const amp = 2 + rand() * 5;
          const freq = 40 + rand() * 80;
          for (let yy = 0; yy <= segEnd - y; yy += 12) ctx.lineTo(gx + Math.sin((yy + g * 17) / freq) * amp, top + yy);
          ctx.stroke();
        }
        if (rand() < 0.25) {
          const kx = x0 + bw * (0.3 + rand() * 0.4);
          const ky = top + (segEnd - y) * rand();
          ctx.fillStyle = `hsla(${h - 6} 50% ${l - 20}% / 0.55)`;
          ctx.beginPath();
          ctx.ellipse(kx, ky, 3 + rand() * 4, 7 + rand() * 8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        // End seam
        ctx.fillStyle = 'rgba(40,24,12,0.55)';
        ctx.fillRect(x0, top + (segEnd - y) - 1.5, bw, 3);
      }
      y = segEnd;
    }
    // Long seam between boards
    ctx.fillStyle = 'rgba(40,24,12,0.6)';
    ctx.fillRect(x0, 0, 2.5, S);
    ctx.fillStyle = 'rgba(255,230,200,0.08)';
    ctx.fillRect(x0 + 2.5, 0, 1.5, S);
  }
  grain(ctx, S, S, rand, 0.05, 20000);
  return toTexture(canvas, renderer);
}

/** Mottled lime-plaster wall in muted sage. Tileable, one repeat ≈ 3 m. */
export function createPlasterTexture(renderer, base = '#98a285') {
  const S = 512;
  const [canvas, ctx] = makeCanvas(S, S);
  const rand = mulberry32(91);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  mottle(ctx, S, rand, 90, 30, 110, 'rgba(255,248,230,0.05)', 'rgba(40,45,30,0.04)');
  mottle(ctx, S, rand, 160, 6, 26, 'rgba(255,248,230,0.035)', 'rgba(40,45,30,0.035)');
  grain(ctx, S, S, rand, 0.05, 9000);
  return toTexture(canvas, renderer);
}

/** Painted wainscot panel (one repeat = 1.2 m wide × 1.0 m tall). */
export function createWainscotTexture(renderer) {
  const W = 512;
  const H = 427;
  const [canvas, ctx] = makeCanvas(W, H);
  const rand = mulberry32(5);
  ctx.fillStyle = '#f2f2f0';
  ctx.fillRect(0, 0, W, H);
  const mx = 52;
  const my = 62;
  // Raised panel: highlight + shadow bevels
  ctx.fillStyle = '#ebebe8';
  ctx.fillRect(mx, my, W - mx * 2, H - my * 2);
  ctx.fillStyle = 'rgba(255,255,250,0.75)';
  ctx.fillRect(mx, H - my - 4, W - mx * 2, 4);
  ctx.fillRect(W - mx - 4, my, 4, H - my * 2);
  ctx.fillStyle = 'rgba(110,90,60,0.35)';
  ctx.fillRect(mx, my, W - mx * 2, 5);
  ctx.fillRect(mx, my, 5, H - my * 2);
  ctx.strokeStyle = 'rgba(110,90,60,0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(mx + 18, my + 18, W - (mx + 18) * 2, H - (my + 18) * 2);
  grain(ctx, W, H, rand, 0.035, 5000);
  return toTexture(canvas, renderer);
}

/** Hand-knotted style rug with border bands and a central medallion. */
export function createRugTexture(renderer) {
  const W = 768;
  const H = 1024;
  const [canvas, ctx] = makeCanvas(W, H);
  const rand = mulberry32(17);
  const fringe = 26;
  const C = { field: '#9a3f27', border: '#2f3d4f', band: '#e9d9b6', gold: '#c9973f', deep: '#5b2418' };

  // Fringe (transparent background beyond it)
  ctx.strokeStyle = '#efe4cc';
  ctx.lineWidth = 2;
  for (let x = 8; x < W - 8; x += 7) {
    for (const [y0, y1] of [[0, fringe], [H - fringe, H]]) {
      ctx.beginPath();
      ctx.moveTo(x, y0 + 2);
      ctx.lineTo(x + (rand() - 0.5) * 3, y1 - 2);
      ctx.stroke();
    }
  }
  const top = fringe;
  const h = H - fringe * 2;
  ctx.fillStyle = C.border;
  ctx.fillRect(0, top, W, h);
  ctx.fillStyle = C.band;
  ctx.fillRect(34, top + 34, W - 68, h - 68);
  // Repeating diamonds in the band
  ctx.fillStyle = C.field;
  const step = 34;
  const diamond = (cx, cy, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
  };
  for (let x = 51; x < W - 34; x += step) {
    diamond(x, top + 51, 9, C.field);
    diamond(x, top + h - 51, 9, C.field);
  }
  for (let y = top + 51 + step; y < top + h - 51; y += step) {
    diamond(51, y, 9, C.field);
    diamond(W - 51, y, 9, C.field);
  }
  // Field
  const fx = 74;
  const fy = top + 74;
  const fw = W - 148;
  const fh = h - 148;
  ctx.fillStyle = C.field;
  ctx.fillRect(fx, fy, fw, fh);
  // Lattice
  ctx.strokeStyle = 'rgba(91,36,24,0.55)';
  ctx.lineWidth = 3;
  for (let d = -fh; d < fw + fh; d += 46) {
    ctx.beginPath();
    ctx.moveTo(fx + d, fy);
    ctx.lineTo(fx + d + fh, fy + fh);
    ctx.moveTo(fx + d + fh, fy);
    ctx.lineTo(fx + d, fy + fh);
    ctx.stroke();
  }
  // Medallion
  const cx = W / 2;
  const cy = top + h / 2;
  diamond(cx, cy, 210, C.border);
  diamond(cx, cy, 180, C.band);
  diamond(cx, cy, 150, C.gold);
  diamond(cx, cy, 108, C.deep);
  diamond(cx, cy, 60, C.band);
  diamond(cx, cy, 26, C.field);
  // Corner quarter-medallions
  for (const [qx, qy] of [[fx, fy], [fx + fw, fy], [fx, fy + fh], [fx + fw, fy + fh]]) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(fx, fy, fw, fh);
    ctx.clip();
    diamond(qx, qy, 110, C.border);
    diamond(qx, qy, 84, C.band);
    diamond(qx, qy, 54, C.gold);
    ctx.restore();
  }
  // Wool texture + slight wear
  grain(ctx, W, H, rand, 0.09, 40000);
  mottle(ctx, 768, rand, 40, 40, 120, 'rgba(255,240,220,0.05)', 'rgba(30,10,5,0.06)');
  return toTexture(canvas, renderer);
}

/** Evening view for the windows: dusky gradient, hills and a few trees. */
export function createWindowTexture(renderer) {
  const W = 512;
  const H = 620;
  const [canvas, ctx] = makeCanvas(W, H);
  const rand = mulberry32(3);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#34466e');
  sky.addColorStop(0.45, '#9a6f86');
  sky.addColorStop(0.72, '#e79f72');
  sky.addColorStop(1, '#f6c98e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(255,250,235,${0.3 + rand() * 0.5})`;
    ctx.fillRect(rand() * W, rand() * H * 0.35, 2, 2);
  }
  circle(ctx, W * 0.72, H * 0.5, 34, 'rgba(255,236,200,0.9)');
  const hill = (base, amp, color, seed) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, base + Math.sin(x / 90 + seed) * amp + Math.sin(x / 31 + seed * 2) * amp * 0.25);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  };
  hill(H * 0.66, 22, '#7c5a6a', 1);
  hill(H * 0.76, 18, '#4e3b4b', 3);
  // Trees
  ctx.fillStyle = '#2e2430';
  for (let i = 0; i < 7; i++) {
    const tx = rand() * W;
    const ty = H * (0.78 + rand() * 0.05);
    const th = 50 + rand() * 60;
    ctx.beginPath();
    ctx.moveTo(tx, ty - th);
    ctx.lineTo(tx + th * 0.22, ty);
    ctx.lineTo(tx - th * 0.22, ty);
    ctx.closePath();
    ctx.fill();
  }
  hill(H * 0.86, 10, '#2a2129', 5);
  return toTexture(canvas, renderer);
}

/** Small decorative artworks for the salon-style hang (non-interactive). */
export function createSmallArtTexture(seed, aspect, renderer) {
  const W = 512;
  const H = Math.round(W / aspect);
  const [canvas, ctx] = makeCanvas(W, H);
  const rand = mulberry32(seed * 131 + 7);
  const papers = ['#f1e6cf', '#ead9bd', '#f4ede0'];
  ctx.fillStyle = papers[seed % papers.length];
  ctx.fillRect(0, 0, W, H);
  const style = seed % 4;
  if (style === 0) {
    // Sun over layered hills
    circle(ctx, W * 0.62, H * 0.38, W * 0.16, '#d9883f');
    ['#7f8f62', '#5e6e48', '#3f4b33'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, H * (0.55 + i * 0.12) + Math.sin(x / (70 + i * 30) + i * 2) * 18);
      ctx.lineTo(W, H);
      ctx.fill();
    });
  } else if (style === 1) {
    // Mid-century arches
    const cols = ['#c2603a', '#d9a441', '#3d5a73', '#7f8f62'];
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = cols[i];
      ctx.lineWidth = W * 0.07;
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.78, W * (0.12 + i * 0.09), Math.PI, 0);
      ctx.stroke();
    }
  } else if (style === 2) {
    // Botanical leaf
    ctx.save();
    ctx.translate(W / 2, H * 0.92);
    ctx.strokeStyle = '#4f6b3a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-10, -H * 0.4, 10, -H * 0.78);
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const y = -H * (0.12 + i * 0.09);
      const side = i % 2 ? 1 : -1;
      ctx.fillStyle = i % 3 ? '#6f8f4e' : '#55743c';
      ctx.beginPath();
      ctx.ellipse(side * W * 0.13, y, W * 0.15, W * 0.055, side * -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else {
    // Still life: vase and fruit
    fillRR(ctx, W * 0.36, H * 0.38, W * 0.22, H * 0.42, W * 0.08, '#3d5a73');
    circle(ctx, W * 0.47, H * 0.3, W * 0.09, '#c2603a');
    circle(ctx, W * 0.66, H * 0.74, W * 0.07, '#d9a441');
    circle(ctx, W * 0.26, H * 0.76, W * 0.06, '#9a3f27');
    ctx.fillStyle = 'rgba(60,40,25,0.25)';
    ctx.fillRect(0, H * 0.8, W, H * 0.2);
  }
  grain(ctx, W, H, rand, 0.06, 7000);
  return toTexture(canvas, renderer);
}

/** Soft round contact shadow (used under the stick figure). */
export function createBlobShadowTexture() {
  const [canvas, ctx] = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(30,18,10,0.55)');
  g.addColorStop(0.55, 'rgba(30,18,10,0.22)');
  g.addColorStop(1, 'rgba(30,18,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(canvas, null);
}

/** Small wall label beneath each frame (matches the wireframe "[E] VIEW …" captions). */
export function createPlaqueTexture(exhibit, renderer) {
  // High-contrast museum label: big title, dark subtitle, and an inverted action bar.
  const W = 1024;
  const H = 512;
  const [canvas, ctx] = makeCanvas(W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = PALETTE.accent;
  ctx.fillRect(0, 0, 14, H - 120);
  ctx.font = `52px ${SANS}`;
  ctx.fillText(`No. ${exhibit.number}`, 60, 92);

  ctx.fillStyle = '#1f1914';
  let size = 112;
  ctx.font = `${size}px ${SANS}`;
  while (ctx.measureText(exhibit.title).width > W - 110 && size > 56) {
    size -= 4;
    ctx.font = `${size}px ${SANS}`;
  }
  ctx.fillText(exhibit.title, 60, 214);

  ctx.fillStyle = '#4a3f36';
  ctx.font = `46px ${SANS}`;
  ctx.fillText(exhibit.subtitle, 60, 296);

  ctx.fillStyle = '#2b231d';
  ctx.fillRect(0, H - 120, W, 120);
  fillRR(ctx, 60, H - 92, 64, 64, 12, PALETTE.accent);
  ctx.fillStyle = '#ffffff';
  ctx.font = `44px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('E', 92, H - 44);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fbf6ec';
  ctx.font = `48px ${SANS}`;
  ctx.fillText(exhibit.prompt, 150, H - 42);
  return toTexture(canvas, renderer);
}

/** Painted wall lettering for the back wall. Transparent background. */
export function createWallLetteringTexture(site, renderer) {
  const [canvas, ctx] = makeCanvas(2048, 400);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2b231d';
  ctx.font = `210px ${SERIF}`;
  ctx.fillText(site.owner, 1024, 220);
  ctx.fillStyle = '#3e352c';
  ctx.font = `64px ${SERIF}`;
  ctx.fillText(site.wallTagline, 1024, 330);
  return toTexture(canvas, renderer);
}

/** Generated project thumbnail (data URL) used by the GitHub modal when no image is set. */
export function projectThumbnail(title, index) {
  const W = 640;
  const H = 360;
  const [canvas, ctx] = makeCanvas(W, H);
  const rand = mulberry32(index * 97 + title.length * 13 + 5);
  const schemes = [
    ['#17181c', PALETTE.accent, '#f3efe6'],
    ['#f3efe6', PALETTE.ink, PALETTE.accent],
    ['#1f2a44', '#7aa2ff', '#f3efe6'],
    ['#f6ede4', '#2f9e6b', PALETTE.ink],
    ['#201a1a', PALETTE.gold, '#f3efe6'],
    ['#eef1f6', PALETTE.blue, PALETTE.ink],
  ];
  const [bg, fg, ink] = schemes[index % schemes.length];
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const mode = index % 3;
  if (mode === 0) {
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = i % 4 === 0 ? fg : `${ink}33`;
      ctx.lineWidth = i % 4 === 0 ? 6 : 2;
      ctx.beginPath();
      ctx.arc(W * 0.72, H * 0.55, 30 + i * 22, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (mode === 1) {
    const cell = 40;
    for (let x = 0; x < W; x += cell) {
      for (let y = 0; y < H; y += cell) {
        const v = rand();
        if (v > 0.72) fillRR(ctx, x + 6, y + 6, cell - 12, cell - 12, 6, v > 0.9 ? fg : `${ink}22`);
      }
    }
  } else {
    ctx.strokeStyle = fg;
    ctx.lineWidth = 5;
    for (let s = 0; s < 3; s++) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 16) {
        const y = H * (0.45 + s * 0.12) + Math.sin(x / 60 + s * 1.7) * 30 + (rand() - 0.5) * 10;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 0.35;
    }
    ctx.globalAlpha = 1;
  }
  const initials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  ctx.fillStyle = ink;
  ctx.font = `120px ${SERIF}`;
  ctx.fillText(initials, 36, H - 44);
  return canvas.toDataURL('image/png');
}

/** Painted title above each painting: "01" in the accent colour + the exhibit title. */
export function createTitleSignTexture(exhibit, renderer) {
  const W = 2048;
  const H = 400;
  const [canvas, ctx] = makeCanvas(W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PALETTE.accent;
  ctx.font = `120px ${SANS}`;
  ctx.fillText(exhibit.number, W / 2, 130);
  ctx.fillStyle = '#2b231d';
  let size = 210;
  ctx.font = `${size}px ${SANS}`;
  while (ctx.measureText(exhibit.title).width > W - 120 && size > 90) {
    size -= 6;
    ctx.font = `${size}px ${SANS}`;
  }
  ctx.fillText(exhibit.title, W / 2, 340);
  return toTexture(canvas, renderer);
}

/** Tileable woven-fabric detail, near-white so it tints with the material colour. */
export function createFabricTexture(renderer) {
  const S = 256;
  const [canvas, ctx] = makeCanvas(S, S);
  const rand = mulberry32(77);
  ctx.fillStyle = '#e9e9e9';
  ctx.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 4) {
    ctx.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.05})`;
    ctx.fillRect(0, y, S, 2);
  }
  for (let x = 0; x < S; x += 4) {
    ctx.fillStyle = `rgba(255,255,255,${0.05 + rand() * 0.06})`;
    ctx.fillRect(x, 0, 2, S);
  }
  grain(ctx, S, S, rand, 0.08, 4000);
  const t = toTexture(canvas, renderer);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

/** Tileable straight wood grain, near-white so it tints with the material colour. */
export function createWoodTexture(renderer) {
  const W = 512;
  const H = 512;
  const [canvas, ctx] = makeCanvas(W, H);
  const rand = mulberry32(13);
  ctx.fillStyle = '#e4e4e4';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const y = rand() * H;
    ctx.strokeStyle = `rgba(60,35,15,${0.06 + rand() * 0.14})`;
    ctx.lineWidth = 0.6 + rand() * 2.2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, y + Math.sin(x / (50 + i) + i) * 3);
    ctx.stroke();
  }
  grain(ctx, W, H, rand, 0.05, 5000);
  const t = toTexture(canvas, renderer);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Floor compass: a ring with an arrowhead, used to point toward the next exhibit. */
export function createGuideArrowTexture(renderer) {
  const S = 512;
  const [canvas, ctx] = makeCanvas(S, S);
  const c = S / 2;
  ctx.strokeStyle = 'rgba(251,246,236,0.85)';
  ctx.lineWidth = 10;
  ctx.setLineDash([22, 18]);
  ctx.beginPath();
  ctx.arc(c, c, 150, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // Arrowhead pointing "up" in texture space (= forward along the plane's -Y → world direction).
  ctx.fillStyle = PALETTE.accent;
  ctx.strokeStyle = 'rgba(251,246,236,0.95)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(c, 18);
  ctx.lineTo(c + 70, 120);
  ctx.lineTo(c + 24, 112);
  ctx.lineTo(c, 128);
  ctx.lineTo(c - 24, 112);
  ctx.lineTo(c - 70, 120);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  return toTexture(canvas, renderer);
}

/** Resolve once web fonts used inside canvas textures are ready (or after a timeout). */
export function waitForFonts(timeout = 2500) {
  if (!document.fonts?.load) return Promise.resolve();
  const loads = [
    `64px Georgia`,
    `600 28px "JetBrains Mono"`,
    `700 28px "JetBrains Mono"`,
    `400 28px Inter`,
    `700 28px Inter`,
  ].map((f) => document.fonts.load(f).catch(() => null));
  return Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, timeout))]);
}
