const COLORS = {
  floor: '#1c1c1c',
  grid: 'rgba(255,255,255,0.05)',
  wall: '#e6e6e6',
  obstacle: '#444444',
  frame: '#e6e6e6',
  accent: '#eaa7b1',
  text: 'rgba(245,245,245,0.8)',
  player: '#f5f5f5',
};

/**
 * Live top-down floor plan: walls, obstacles, the four exhibits, the player's
 * position + facing, and the camera's view cone. Clicking an exhibit marker
 * quick-travels to it.
 */
export class Minimap {
  constructor(canvas, { bounds, frames, colliders, onSelect }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bounds = bounds;
    this.frames = frames;
    this.obstacles = colliders.filter((c) => c.kind !== 'frame');
    this.onSelect = onSelect;
    this.pad = 12;
    this.markers = [];

    this.resize();
    if ('ResizeObserver' in window) new ResizeObserver(() => this.resize()).observe(canvas);
    canvas.addEventListener('click', this.#onClick);
    canvas.addEventListener('mousemove', (e) => {
      canvas.style.cursor = this.#hit(e) ? 'pointer' : 'default';
    });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const b = this.bounds;
    this.scale = Math.min((this.cssW - this.pad * 2) / (b.maxX - b.minX), (this.cssH - this.pad * 2) / (b.maxZ - b.minZ));
    this.offX = (this.cssW - (b.maxX - b.minX) * this.scale) / 2;
    this.offY = (this.cssH - (b.maxZ - b.minZ) * this.scale) / 2;
  }

  /** World (x, z) → canvas px. Back wall (−z) is at the top, like the wireframe. */
  toMap(x, z) {
    return [this.offX + (x - this.bounds.minX) * this.scale, this.offY + (z - this.bounds.minZ) * this.scale];
  }

  #hit(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    return this.markers.find((m) => Math.hypot(m.x - x, m.y - y) < 16);
  }

  /** Greedy word-wrap using the current canvas font. */
  #wrap(text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (line && this.ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  #onClick = (e) => {
    const m = this.#hit(e);
    if (m) this.onSelect?.(m.id);
  };

  draw({ player, playerYaw, cameraYaw, activeId, t }) {
    const { ctx } = this;
    const s = this.scale;
    ctx.clearRect(0, 0, this.cssW, this.cssH);

    const [x0, y0] = this.toMap(this.bounds.minX, this.bounds.minZ);
    const [x1, y1] = this.toMap(this.bounds.maxX, this.bounds.maxZ);

    // Floor + 2 m grid
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = this.bounds.minX + 2; x < this.bounds.maxX; x += 2) {
      const [px] = this.toMap(x, 0);
      ctx.moveTo(px + 0.5, y0);
      ctx.lineTo(px + 0.5, y1);
    }
    for (let z = this.bounds.minZ + 2; z < this.bounds.maxZ; z += 2) {
      const [, py] = this.toMap(0, z);
      ctx.moveTo(x0, py + 0.5);
      ctx.lineTo(x1, py + 0.5);
    }
    ctx.stroke();

    // Obstacles
    ctx.fillStyle = COLORS.obstacle;
    for (const o of this.obstacles) {
      const [ax, ay] = this.toMap(o.minX, o.minZ);
      const [bx, by] = this.toMap(o.maxX, o.maxZ);
      ctx.fillRect(ax, ay, bx - ax, by - ay);
    }

    // Walls with an entrance gap on the front wall
    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = 3;
    const [gapL] = this.toMap(-0.65, 0);
    const [gapR] = this.toMap(0.65, 0);
    ctx.beginPath();
    ctx.moveTo(gapL, y1);
    ctx.lineTo(x0, y1);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(gapR, y1);
    ctx.stroke();

    // Exhibits
    this.markers = [];
    ctx.font = '10px Georgia, serif';
    ctx.textBaseline = 'middle';
    for (const f of this.frames) {
      const active = f.id === activeId;
      const half = (f.exhibit.size.width / 2) * s;
      const [cx, cy] = this.toMap(f.center.x, f.center.z);
      // Frame segment on the wall
      ctx.strokeStyle = active ? COLORS.accent : COLORS.frame;
      ctx.lineWidth = 5;
      ctx.beginPath();
      if (Math.abs(f.normal.x) > 0.5) {
        ctx.moveTo(cx, cy - half);
        ctx.lineTo(cx, cy + half);
      } else {
        ctx.moveTo(cx - half, cy);
        ctx.lineTo(cx + half, cy);
      }
      ctx.stroke();

      // Numbered marker just inside the wall
      const [mx, my] = this.toMap(f.center.x + f.normal.x * 1.6, f.center.z + f.normal.z * 1.6);
      if (active) {
        const pr = 11 + Math.sin(t * 5) * 2;
        ctx.fillStyle = 'rgba(214,90,110,0.2)';
        ctx.beginPath();
        ctx.arc(mx, my, pr + 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = active ? COLORS.accent : COLORS.floor;
      ctx.strokeStyle = active ? COLORS.accent : COLORS.frame;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = active ? '#1a1512' : COLORS.frame;
      ctx.textAlign = 'center';
      ctx.fillText(String(Number(f.exhibit.number)), mx, my + 0.5);

      // Label
      ctx.fillStyle = active ? COLORS.accent : COLORS.text;
      const label = f.exhibit.navLabel;
      // Labels sit under their marker and wrap to fit their half of the map,
      // so side-wall labels can never run into each other.
      const side = Math.abs(f.normal.x) > 0.5;
      ctx.textAlign = side ? (f.normal.x > 0 ? 'left' : 'right') : 'center';
      const lx = side ? mx - f.normal.x * 7 : mx;
      const maxWidth = side ? Math.abs(this.cssW / 2 - lx) - 6 : 70;
      const lines = this.#wrap(label, Math.max(30, maxWidth));
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.floor;
      lines.forEach((line, li) => {
        const ly = my + 17 + li * 11;
        ctx.strokeText(line, lx, ly);
        ctx.fillText(line, lx, ly);
      });
      this.markers.push({ id: f.id, x: mx, y: my });
    }

    // Camera view cone
    const [px, py] = this.toMap(player.x, player.z);
    const lookX = -Math.sin(cameraYaw);
    const lookY = -Math.cos(cameraYaw);
    const ang = Math.atan2(lookY, lookX);
    const len = 46;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, len);
    grad.addColorStop(0, 'rgba(214,90,110,0.3)');
    grad.addColorStop(1, 'rgba(214,90,110,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, len, ang - 0.5, ang + 0.5);
    ctx.closePath();
    ctx.fill();

    // Player arrow (facing = (sin yaw, cos yaw) in x/z, which maps straight onto canvas x/y)
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.cos(playerYaw), Math.sin(playerYaw)));
    ctx.fillStyle = COLORS.player;
    ctx.strokeStyle = COLORS.floor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, 5.5);
    ctx.lineTo(-2.5, 0);
    ctx.lineTo(-5, -5.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
