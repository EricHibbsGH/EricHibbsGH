import { el, svgEl } from './dom.js';

/*
 * "How I Build" exhibit — a human-centered take on system design.
 * Five tabs, each something you can interact with rather than just read:
 *   1. The loop          — an animated design cycle; click a stage for questions, methods, evidence
 *   2. Principles        — usability heuristics × real projects, clickable cells
 *   3. Case study        — this gallery's playtest → diagnosis → change history, step by step
 *   4. Try it            — two live HCI experiments (control mapping, Fitts's law)
 *   5. Under the hood    — how this site is put together, as a clickable diagram
 * Every tab returns { node, cleanup } so timers/animation stop when you switch away.
 */

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function renderHowIBuild(data) {
  const tabs = [
    { id: 'loop', label: 'The loop', render: () => renderLoop(data.loop) },
    { id: 'principles', label: 'Principles in practice', render: () => renderPrinciples(data) },
    { id: 'case', label: 'Case study: this gallery', render: () => renderCaseStudy(data.caseStudy) },
    { id: 'lab', label: 'Try it', render: () => renderLab() },
    { id: 'arch', label: 'Under the hood', render: () => renderArchitecture(data.architecture) },
  ];

  const panel = el('div', { class: 'hib-panel', role: 'tabpanel', id: 'hib-panel' });
  let current = null;
  let cleanup = null;

  const buttons = tabs.map((t, i) =>
    el(
      'button',
      {
        type: 'button',
        role: 'tab',
        id: `hib-tab-${t.id}`,
        class: 'sd-tab hib-tab',
        'aria-controls': 'hib-panel',
        'aria-selected': 'false',
        tabindex: '-1',
        onclick: () => select(t.id),
      },
      el('span', { class: 'hib-tab-num', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')),
      t.label,
    ),
  );

  function select(id, focus = false) {
    if (id === current) return;
    current = id;
    cleanup?.();
    cleanup = null;
    tabs.forEach((t, i) => {
      const on = t.id === id;
      buttons[i].setAttribute('aria-selected', String(on));
      buttons[i].tabIndex = on ? 0 : -1;
      if (on && focus) buttons[i].focus();
    });
    const out = tabs.find((t) => t.id === id).render();
    panel.setAttribute('aria-labelledby', `hib-tab-${id}`);
    panel.replaceChildren(out.node);
    cleanup = out.cleanup ?? null;
    panel.classList.remove('is-entering');
    void panel.offsetWidth;
    panel.classList.add('is-entering');
  }

  const tablist = el('div', { class: 'sd-tabs hib-tabs', role: 'tablist', 'aria-label': 'How I build' }, buttons);
  tablist.addEventListener('keydown', (e) => {
    const i = tabs.findIndex((t) => t.id === current);
    const next = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
    if (next != null) {
      e.preventDefault();
      select(tabs[next].id, true);
    }
  });

  const header = el(
    'div',
    { class: 'hib-head' },
    el('p', { class: 'lede' }, data.intro),
    el(
      'ul',
      { class: 'hib-traits', 'aria-label': 'How I build, in four habits' },
      data.traits.map((t, i) =>
        el('li', { class: 'hib-trait' }, el('span', { class: 'hib-trait-num' }, String(i + 1)), el('strong', {}, t.label), el('span', {}, t.detail)),
      ),
    ),
  );

  select('loop');
  return el('div', { class: 'hib' }, header, tablist, panel);
}

/* ------------------------------------------------------------------ 1. The loop */

function renderLoop(stages) {
  const C = 210;
  const R = 150;
  const NODE_R = 42;
  const n = stages.length;
  const angle = (i) => -Math.PI / 2 + (i * Math.PI * 2) / n;
  const pt = (a, r = R) => [C + r * Math.cos(a), C + r * Math.sin(a)];
  let index = 0;
  let auto = false; // calm by default; visitors can start the tour
  let timer = 0;

  const arcs = stages.map((_, i) => {
    const gap = (NODE_R + 8) / R;
    const [x1, y1] = pt(angle(i) + gap);
    const [x2, y2] = pt(angle(i + 1) - gap);
    return svgEl('path', { class: 'hib-arc', d: `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`, 'marker-end': 'url(#hib-arrow)' });
  });

  const nodes = stages.map((s, i) => {
    const [x, y] = pt(angle(i));
    const g = svgEl(
      'g',
      { class: 'hib-node', transform: `translate(${x} ${y})`, tabindex: 0, role: 'button', 'aria-label': `Stage ${i + 1}: ${s.label}` },
      svgEl('circle', { r: NODE_R }),
      svgEl('text', { class: 'hib-node-num', y: -10 }, String(i + 1).padStart(2, '0')),
      svgEl('text', { class: 'hib-node-label', y: 10 }, s.label),
    );
    g.addEventListener('click', () => go(i, true));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go(i, true);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        go((index + 1) % n, true, true);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        go((index - 1 + n) % n, true, true);
      }
    });
    return g;
  });

  const centerVerb = svgEl('text', { class: 'hib-center-verb', x: C, y: C + 4 });
  const centerStep = svgEl('text', { class: 'hib-center-step', x: C, y: C + 30 });
  const traveler = reduceMotion()
    ? null
    : svgEl(
        'circle',
        { class: 'hib-traveler', r: 5 },
        svgEl('animateMotion', { dur: '14s', repeatCount: 'indefinite', path: `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z` }),
      );

  const svg = svgEl(
    'svg',
    { class: 'hib-ring', viewBox: '0 0 420 420', role: 'group', 'aria-label': 'The design loop. Select a stage.' },
    svgEl(
      'defs',
      {},
      svgEl(
        'marker',
        { id: 'hib-arrow', viewBox: '0 0 10 10', refX: 7, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
        svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'hib-arrowhead' }),
      ),
    ),
    svgEl('circle', { class: 'hib-track', cx: C, cy: C, r: R }),
    arcs,
    traveler,
    centerVerb,
    centerStep,
    nodes,
  );

  const detail = el('div', { class: 'hib-detail', 'aria-live': 'polite' });
  const autoBtn = el('button', { type: 'button', class: 'btn btn--small', 'aria-pressed': String(auto), onclick: () => setAuto(!auto) });
  const controls = el(
    'div',
    { class: 'hib-loop-controls' },
    el('button', { type: 'button', class: 'btn btn--small', onclick: () => go((index - 1 + n) % n, true) }, 'Previous'),
    el('button', { type: 'button', class: 'btn btn--small', onclick: () => go((index + 1) % n, true) }, 'Next'),
    autoBtn,
  );

  function renderDetail() {
    const s = stages[index];
    detail.replaceChildren(
      el('p', { class: 'eyebrow' }, `Stage ${index + 1} of ${n} · ${s.verb}`),
      el('h3', { class: 'hib-detail-title' }, s.label),
      el('p', { class: 'hib-detail-summary' }, s.summary),
      el(
        'div',
        { class: 'hib-detail-cols' },
        el('div', {}, el('h4', { class: 'hib-mini' }, 'Questions I ask'), el('ul', { class: 'hib-questions' }, s.questions.map((q) => el('li', {}, q)))),
        el('div', {}, el('h4', { class: 'hib-mini' }, 'Methods'), el('ul', { class: 'tags' }, s.methods.map((m) => el('li', { class: 'tag' }, m)))),
      ),
      el('h4', { class: 'hib-mini' }, 'Where I have done it'),
      el(
        'ul',
        { class: 'hib-evidence' },
        s.evidence.map((ev) => el('li', {}, el('strong', {}, ev.project), el('span', {}, ev.detail))),
      ),
      el('div', { class: 'hib-principle' }, el('span', { class: 'hib-principle-tag' }, 'HCI principle'), el('strong', {}, s.principle.name), el('span', {}, s.principle.note)),
    );
    detail.classList.remove('is-entering');
    void detail.offsetWidth;
    detail.classList.add('is-entering');
  }

  function go(i, user = false, focus = false) {
    index = i;
    if (user) setAuto(false);
    nodes.forEach((g, k) => g.classList.toggle('is-active', k === index));
    arcs.forEach((a, k) => a.classList.toggle('is-active', k === (index - 1 + n) % n));
    centerVerb.textContent = stages[index].verb;
    centerStep.textContent = `${String(index + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
    if (focus) nodes[index].focus();
    renderDetail();
  }

  function setAuto(on) {
    auto = on;
    autoBtn.setAttribute('aria-pressed', String(on));
    autoBtn.textContent = on ? 'Pause tour' : 'Play tour';
    clearInterval(timer);
    if (on) {
      timer = setInterval(() => {
        if (!svg.isConnected) return clearInterval(timer);
        go((index + 1) % n);
      }, 4500);
    }
  }

  go(0);
  setAuto(auto);

  const node = el(
    'div',
    { class: 'hib-loop' },
    el('div', { class: 'hib-ring-wrap' }, svg, controls, el('p', { class: 'hib-hint' }, 'Click a stage, or use the arrow keys.')),
    detail,
  );
  // Hovering the details pauses the tour so people can read.
  detail.addEventListener('pointerenter', () => auto && clearInterval(timer));
  detail.addEventListener('pointerleave', () => auto && setAuto(true));
  return { node, cleanup: () => clearInterval(timer) };
}

/* ------------------------------------------------------------ 2. Principles */

function renderPrinciples({ principles, projectsCols, matrix }) {
  const detail = el('div', { class: 'hib-detail hib-cell-detail', 'aria-live': 'polite' });
  const cells = [];
  let selectedCol = null;

  function show(p, col) {
    const text = matrix[p.id]?.[col.id];
    for (const c of cells) c.btn.classList.toggle('is-selected', c.p === p && c.col === col);
    detail.replaceChildren(
      el('p', { class: 'eyebrow' }, p.source),
      el('h3', { class: 'hib-detail-title' }, p.name),
      el('p', { class: 'hib-detail-summary' }, p.summary),
      el('div', { class: 'hib-principle' }, el('span', { class: 'hib-principle-tag' }, 'In practice'), el('strong', {}, col.label), el('span', {}, text)),
    );
    detail.classList.remove('is-entering');
    void detail.offsetWidth;
    detail.classList.add('is-entering');
  }

  function highlightCol(id) {
    selectedCol = selectedCol === id ? null : id;
    table.querySelectorAll('[data-col]').forEach((n) => n.classList.toggle('is-col', n.dataset.col === selectedCol));
  }

  const head = el(
    'tr',
    {},
    el('th', { scope: 'col', class: 'hib-corner' }, 'Principle'),
    projectsCols.map((col) =>
      el(
        'th',
        { scope: 'col', 'data-col': col.id },
        el('button', { type: 'button', class: 'hib-col-btn', title: `Highlight ${col.label}`, onclick: () => highlightCol(col.id) }, col.label),
      ),
    ),
  );

  const rows = principles.map((p) => {
    const count = projectsCols.filter((c) => matrix[p.id]?.[c.id]).length;
    return el(
      'tr',
      {},
      el(
        'th',
        { scope: 'row', class: 'hib-row-head' },
        el('span', { class: 'hib-row-name' }, p.name),
        el('span', { class: 'hib-row-meter', 'aria-label': `Applied in ${count} of ${projectsCols.length} projects` }, el('span', { style: { width: `${(count / projectsCols.length) * 100}%` } })),
      ),
      projectsCols.map((col) => {
        const text = matrix[p.id]?.[col.id];
        if (!text) return el('td', { 'data-col': col.id }, el('span', { class: 'hib-empty', 'aria-hidden': 'true' }, '·'));
        const btn = el('button', { type: 'button', class: 'hib-dot', 'aria-label': `${p.name} in ${col.label}`, onclick: () => show(p, col) });
        cells.push({ p, col, btn });
        return el('td', { 'data-col': col.id }, btn);
      }),
    );
  });

  const table = el('table', { class: 'hib-matrix' }, el('thead', {}, head), el('tbody', {}, rows));
  show(principles[0], projectsCols[0]);

  const node = el(
    'div',
    { class: 'hib-principles' },
    el(
      'div',
      { class: 'hib-matrix-wrap' },
      el('p', { class: 'hib-hint' }, 'Each dot is a place I applied that principle. Click a dot for the example; click a project to highlight its column.'),
      el('div', { class: 'hib-table-scroll' }, table),
    ),
    detail,
  );
  return { node };
}

/* ------------------------------------------------------------ 3. Case study */

function renderCaseStudy({ intro, steps }) {
  let index = 0;
  const pills = steps.map((s, i) =>
    el(
      'button',
      { type: 'button', class: 'hib-step-pill', 'aria-label': `Iteration ${i + 1}: ${s.title}`, onclick: () => go(i) },
      el('span', { class: 'hib-step-num' }, String(i + 1)),
      el('span', { class: 'hib-step-title' }, s.title),
    ),
  );
  const progress = el('div', { class: 'hib-progress' }, el('span'));
  const card = el('article', { class: 'hib-case-card', 'aria-live': 'polite' });
  const prev = el('button', { type: 'button', class: 'btn btn--small', onclick: () => go(Math.max(0, index - 1)) }, 'Previous');
  const next = el('button', { type: 'button', class: 'btn btn--small btn--primary', onclick: () => go(Math.min(steps.length - 1, index + 1)) }, 'Next');

  function go(i) {
    index = i;
    const s = steps[i];
    pills.forEach((p, k) => {
      p.classList.toggle('is-active', k === i);
      p.classList.toggle('is-done', k < i);
      p.setAttribute('aria-current', k === i ? 'step' : 'false');
    });
    progress.firstChild.style.width = `${(i / (steps.length - 1)) * 100}%`;
    prev.disabled = i === 0;
    next.disabled = i === steps.length - 1;
    card.replaceChildren(
      el('p', { class: 'eyebrow' }, `Iteration ${i + 1} of ${steps.length} · ${s.title}`),
      el('blockquote', { class: 'hib-quote' }, `“${s.feedback}”`, el('span', {}, 'Playtest feedback')),
      el(
        'div',
        { class: 'hib-case-flow' },
        el('div', { class: 'hib-flow-step' }, el('span', { class: 'hib-flow-label' }, 'What was really wrong'), el('p', {}, s.diagnosis)),
        el('span', { class: 'hib-flow-arrow', 'aria-hidden': 'true' }, '→'),
        el('div', { class: 'hib-flow-step' }, el('span', { class: 'hib-flow-label' }, 'What changed'), el('p', {}, s.change)),
        el('span', { class: 'hib-flow-arrow', 'aria-hidden': 'true' }, '→'),
        el(
          'div',
          { class: 'hib-flow-step hib-flow-step--principle' },
          el('span', { class: 'hib-flow-label' }, 'Principle'),
          el('p', {}, s.principle),
          s.metric ? el('span', { class: 'hib-metric' }, s.metric) : null,
        ),
      ),
    );
    card.classList.remove('is-entering');
    void card.offsetWidth;
    card.classList.add('is-entering');
  }

  const node = el('div', { class: 'hib-case', tabindex: '0', 'aria-label': 'Case study. Use left and right arrow keys to step through iterations.' });
  node.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(Math.min(steps.length - 1, index + 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(Math.max(0, index - 1));
    }
  });
  node.append(
    el('p', { class: 'lede' }, intro),
    el('div', { class: 'hib-stepper' }, progress, el('div', { class: 'hib-step-pills' }, pills)),
    card,
    el('div', { class: 'hib-case-nav' }, prev, el('span', { class: 'hib-hint' }, 'Arrow keys also work'), next),
  );
  go(0);
  return { node };
}

/* -------------------------------------------------------------- 4. Try it */

function renderLab() {
  const mapping = controlMappingLab();
  const fitts = fittsLab();
  const node = el(
    'div',
    { class: 'hib-lab' },
    el('p', { class: 'lede' }, 'Two quick experiments behind decisions in this gallery. Your results stay in your browser.'),
    el('div', { class: 'hib-lab-grid' }, mapping.node, fitts.node),
  );
  return {
    node,
    cleanup: () => {
      mapping.cleanup();
      fitts.cleanup();
    },
  };
}

/** Race the old walk-and-turn controls against screen-relative controls. */
function controlMappingLab() {
  const W = 520;
  const H = 300;
  const canvas = el('canvas', { class: 'hib-canvas', tabindex: '0', 'aria-label': 'Control mapping arena. Click, then use arrow keys or WASD to reach the targets.' });
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const TARGETS = [
    [0.82, 0.25],
    [0.18, 0.72],
    [0.78, 0.78],
    [0.3, 0.2],
  ];
  const results = { tank: null, screen: null };
  let mode = 'tank';
  let p;
  let hits;
  let t0;
  let running;
  let done;
  const keys = new Set();

  function reset() {
    p = { x: W / 2, y: H / 2, heading: -Math.PI / 2 };
    hits = 0;
    t0 = 0;
    running = false;
    done = false;
  }
  reset();

  const modeButtons = [
    ['tank', 'Walk-and-turn (old)'],
    ['screen', 'Screen-relative (now)'],
  ].map(([id, label]) => {
    const b = el(
      'button',
      {
        type: 'button',
        class: 'seg',
        'aria-pressed': String(id === mode),
        onclick: () => {
          mode = id;
          modeButtons.forEach((m) => m.setAttribute('aria-pressed', String(m.dataset.mode === mode)));
          reset();
          canvas.focus();
        },
      },
      label,
    );
    b.dataset.mode = id;
    return b;
  });

  const resultsEl = el('div', { class: 'hib-results' });
  function renderResults() {
    const max = Math.max(results.tank ?? 0, results.screen ?? 0, 0.001);
    resultsEl.replaceChildren(
      ...[
        ['tank', 'Walk-and-turn'],
        ['screen', 'Screen-relative'],
      ].map(([id, label]) =>
        el(
          'div',
          { class: 'hib-result-row' },
          el('span', {}, label),
          el('span', { class: 'hib-bar' }, el('span', { class: `hib-bar-fill hib-bar-fill--${id}`, style: { width: results[id] ? `${(results[id] / max) * 100}%` : '0%' } })),
          el('strong', {}, results[id] ? `${results[id].toFixed(1)} s` : '—'),
        ),
      ),
    );
  }
  renderResults();

  const onKey = (e) => {
    const k = e.code;
    if (!/^(Arrow(Up|Down|Left|Right)|Key[WASD])$/.test(k)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'keydown') {
      keys.add(k);
      if (!running && !done) {
        running = true;
        t0 = performance.now();
      }
    } else keys.delete(k);
  };
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('keyup', onKey);
  canvas.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointerdown', () => canvas.focus());

  const axis = () => {
    let x = 0;
    let y = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) y -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) y += 1;
    return { x, y };
  };

  let raf = 0;
  let last = performance.now();
  function frame(now) {
    if (!canvas.isConnected) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const a = axis();
    if (running) {
      if (mode === 'tank') {
        p.heading += a.x * 2.6 * dt;
        const fwd = -a.y * 140;
        p.x += Math.cos(p.heading) * fwd * dt;
        p.y += Math.sin(p.heading) * fwd * dt;
      } else {
        const len = Math.hypot(a.x, a.y) || 1;
        p.x += (a.x / len) * 150 * dt;
        p.y += (a.y / len) * 150 * dt;
        if (a.x || a.y) p.heading = Math.atan2(a.y, a.x);
      }
      p.x = Math.max(10, Math.min(W - 10, p.x));
      p.y = Math.max(10, Math.min(H - 10, p.y));
      const [tx, ty] = TARGETS[hits];
      if (Math.hypot(p.x - tx * W, p.y - ty * H) < 22) {
        hits++;
        if (hits === TARGETS.length) {
          running = false;
          done = true;
          results[mode] = (now - t0) / 1000;
          renderResults();
        }
      }
    }
    draw(now);
  }

  function draw(now) {
    ctx.fillStyle = '#151515';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 20; x < W; x += 20) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
    }
    for (let y = 20; y < H; y += 20) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
    }
    ctx.stroke();
    if (!done) {
      const [tx, ty] = TARGETS[Math.min(hits, TARGETS.length - 1)];
      const pulse = 1 + Math.sin(now / 220) * 0.08;
      ctx.strokeStyle = '#d65a6e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tx * W, ty * H, 16 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(214,90,110,0.25)';
      ctx.fill();
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.heading);
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, 8);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, -8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(245,245,245,0.75)';
    ctx.font = '13px Georgia, serif';
    const status = done
      ? `Done in ${results[mode].toFixed(1)} s. Now try the other scheme.`
      : running
        ? `Target ${hits + 1} of ${TARGETS.length} · ${((now - t0) / 1000).toFixed(1)} s`
        : document.activeElement === canvas
          ? 'Press an arrow key or WASD to start'
          : 'Click here, then use arrow keys / WASD';
    ctx.fillText(status, 12, H - 12);
  }

  raf = requestAnimationFrame(frame);

  const node = el(
    'section',
    { class: 'hib-exp' },
    el('h3', { class: 'hib-exp-title' }, 'Control mapping lab'),
    el(
      'p',
      { class: 'hib-exp-copy' },
      'Reach the four targets with each scheme. Walk-and-turn steers a heading (“left” rotates you); screen-relative moves where the key points. That mismatch is why the gallery switched.',
    ),
    el('div', { class: 'segmented hib-modes', role: 'group', 'aria-label': 'Control scheme' }, modeButtons),
    canvas,
    resultsEl,
  );
  return { node, cleanup: () => cancelAnimationFrame(raf) };
}

/** Fitts's law: time to hit a target grows with distance and shrinks with size. */
function fittsLab() {
  const TRIALS = 10;
  const arena = el('div', { class: 'hib-fitts-arena' });
  const startBtn = el('button', { type: 'button', class: 'btn btn--primary btn--small hib-fitts-start' }, 'Start: click 10 targets');
  const plot = el('div', { class: 'hib-plot' });
  const summary = el('p', { class: 'hib-exp-copy hib-fitts-summary' }, 'Fitts’s law predicts movement time MT = a + b · log₂(D/W + 1): far, small targets take longer. Measure yours.');
  arena.append(startBtn);

  let trials = [];
  let last = null;
  let shownAt = 0;
  let misses = 0;
  let target = null;

  function spawn() {
    const r = arena.getBoundingClientRect();
    const w = 18 + Math.random() * 54;
    const x = 8 + Math.random() * Math.max(10, r.width - w - 16);
    const y = 8 + Math.random() * Math.max(10, r.height - w - 16);
    target?.remove();
    target = el('button', {
      type: 'button',
      class: 'hib-fitts-target',
      'aria-label': `Target ${trials.length + 1} of ${TRIALS}`,
      style: { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${w}px` },
    });
    target.dataset.w = String(w);
    target.dataset.cx = String(x + w / 2);
    target.dataset.cy = String(y + w / 2);
    target.addEventListener('pointerdown', hit);
    arena.append(target);
    shownAt = performance.now();
  }

  function hit(e) {
    e.stopPropagation();
    const now = performance.now();
    const w = +target.dataset.w;
    const d = Math.max(1, Math.hypot(+target.dataset.cx - last.x, +target.dataset.cy - last.y));
    trials.push({ id: Math.log2(d / w + 1), mt: now - shownAt });
    const r = arena.getBoundingClientRect();
    last = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (trials.length >= TRIALS) finish();
    else spawn();
  }

  arena.addEventListener('pointerdown', () => {
    if (target) misses++;
  });

  startBtn.addEventListener('click', (e) => {
    trials = [];
    misses = 0;
    const r = arena.getBoundingClientRect();
    last = { x: e.clientX - r.left, y: e.clientY - r.top };
    startBtn.hidden = true;
    summary.textContent = 'Click each orange target as fast as you can.';
    plot.replaceChildren();
    spawn();
  });

  function finish() {
    target?.remove();
    target = null;
    startBtn.hidden = false;
    startBtn.textContent = 'Run it again';
    // Least-squares fit: MT = a + b·ID
    const n = trials.length;
    const mx = trials.reduce((s, t) => s + t.id, 0) / n;
    const my = trials.reduce((s, t) => s + t.mt, 0) / n;
    const sxx = trials.reduce((s, t) => s + (t.id - mx) ** 2, 0) || 1;
    const b = trials.reduce((s, t) => s + (t.id - mx) * (t.mt - my), 0) / sxx;
    const a = my - b * mx;
    const throughput = trials.reduce((s, t) => s + t.id / (t.mt / 1000), 0) / n;
    // Only claim what this visitor's own data shows.
    const takeaway =
      b > 25
        ? 'Each extra bit of difficulty cost you about ' + Math.round(b) + ' ms, which is why the gallery keeps prompts large and close to where you are looking.'
        : 'Your times barely changed with difficulty this run. Try again moving as fast as you can, and the far, small targets usually start to cost more.';
    summary.replaceChildren(
      el('strong', {}, `MT ≈ ${Math.round(a)} + ${Math.round(b)} · ID ms`),
      ` · throughput ≈ ${throughput.toFixed(1)} bits/s · ${misses} miss${misses === 1 ? '' : 'es'}. `,
      takeaway,
    );
    drawPlot(a, b);
  }

  function drawPlot(a, b) {
    const PW = 300;
    const PH = 170;
    const pad = 30;
    const maxId = Math.max(4, ...trials.map((t) => t.id));
    const maxMt = Math.max(800, ...trials.map((t) => t.mt)) * 1.1;
    const sx = (v) => pad + (v / maxId) * (PW - pad - 8);
    const sy = (v) => PH - pad + 4 - (v / maxMt) * (PH - pad - 8);
    plot.replaceChildren(
      svgEl(
        'svg',
        { viewBox: `0 0 ${PW} ${PH}`, class: 'hib-plot-svg', role: 'img', 'aria-label': 'Your movement time against index of difficulty' },
        svgEl('line', { x1: pad, y1: sy(0), x2: PW - 6, y2: sy(0), class: 'hib-axis' }),
        svgEl('line', { x1: pad, y1: sy(0), x2: pad, y2: 6, class: 'hib-axis' }),
        svgEl('text', { x: PW - 8, y: PH - 6, class: 'hib-axis-label', 'text-anchor': 'end' }, 'difficulty (bits)'),
        svgEl('text', { x: 4, y: 12, class: 'hib-axis-label' }, 'ms'),
        svgEl('line', { x1: sx(0), y1: sy(a), x2: sx(maxId), y2: sy(a + b * maxId), class: 'hib-fit' }),
        trials.map((t) => svgEl('circle', { cx: sx(t.id), cy: sy(t.mt), r: 4, class: 'hib-pt' })),
      ),
    );
  }

  const node = el('section', { class: 'hib-exp' }, el('h3', { class: 'hib-exp-title' }, 'Fitts’s law test'), summary, arena, plot);
  return { node, cleanup: () => target?.remove() };
}

/* ---------------------------------------------------------- 5. Under the hood */

const NODE_W = 150;
const NODE_H = 56;

function edgePath(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 10) {
    const sy = a.y + Math.sign(dy) * (NODE_H / 2);
    const ey = b.y - Math.sign(dy) * (NODE_H / 2 + 6);
    return `M ${a.x} ${sy} L ${b.x} ${ey}`;
  }
  const forward = dx > 0;
  const sx = a.x + (forward ? NODE_W / 2 : -NODE_W / 2);
  const ex = b.x + (forward ? -NODE_W / 2 - 6 : NODE_W / 2 + 6);
  const k = forward ? 50 : -50;
  return `M ${sx} ${a.y} C ${sx + k} ${a.y}, ${ex - k} ${b.y}, ${ex} ${b.y}`;
}

function renderArchitecture({ intro, nodes, edges }) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let selected = nodes[0].id;
  const info = el('div', { class: 'hib-detail', 'aria-live': 'polite' });

  const edgeEls = edges.map((e) => {
    const path = svgEl('path', {
      d: edgePath(byId.get(e.from), byId.get(e.to)),
      class: `sd-edge${e.kind === 'async' ? ' is-async' : ''}`,
      'marker-end': e.kind === 'async' ? 'url(#hib-arch-arrow-accent)' : 'url(#hib-arch-arrow)',
    });
    path.dataset.from = e.from;
    path.dataset.to = e.to;
    return path;
  });

  const nodeEls = nodes.map((n) => {
    const g = svgEl(
      'g',
      { class: 'sd-node', transform: `translate(${n.x - NODE_W / 2} ${n.y - NODE_H / 2})`, tabindex: 0, role: 'button', 'aria-label': `${n.label}: ${n.sub}` },
      svgEl('rect', { width: NODE_W, height: NODE_H, rx: 8 }),
      svgEl('text', { x: NODE_W / 2, y: 24, class: 'sd-node-label' }, n.label),
      svgEl('text', { x: NODE_W / 2, y: 42, class: 'sd-node-sub' }, n.sub),
    );
    g.dataset.id = n.id;
    g.addEventListener('click', () => select(n.id));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select(n.id);
      }
    });
    g.addEventListener('mouseenter', () => highlight(n.id));
    g.addEventListener('mouseleave', () => highlight(selected));
    return g;
  });

  function highlight(id) {
    for (const p of edgeEls) p.classList.toggle('is-related', p.dataset.from === id || p.dataset.to === id);
  }

  function select(id) {
    selected = id;
    for (const g of nodeEls) g.classList.toggle('is-selected', g.dataset.id === id);
    highlight(id);
    const n = byId.get(id);
    const ins = edges.filter((e) => e.to === id).map((e) => byId.get(e.from).label);
    const outs = edges.filter((e) => e.from === id).map((e) => byId.get(e.to).label);
    info.replaceChildren(
      el('p', { class: 'eyebrow' }, n.sub),
      el('h3', { class: 'hib-detail-title' }, n.label),
      el('p', { class: 'hib-detail-summary' }, n.description),
      ins.length ? el('p', { class: 'hib-io' }, el('span', {}, 'Receives from'), ins.join(', ')) : null,
      outs.length ? el('p', { class: 'hib-io' }, el('span', {}, 'Feeds'), outs.join(', ')) : null,
    );
  }

  const marker = (id, cls) =>
    svgEl(
      'marker',
      { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: cls }),
    );

  const svg = svgEl(
    'svg',
    { class: 'sd-svg', viewBox: '0 0 1000 360', role: 'group', 'aria-label': 'How this site is built. Select a part for details.' },
    svgEl('defs', {}, marker('hib-arch-arrow', 'hib-arrowhead hib-arrowhead--muted'), marker('hib-arch-arrow-accent', 'hib-arrowhead')),
    svgEl('g', {}, edgeEls),
    svgEl('g', {}, nodeEls),
  );

  select(selected);
  const node = el(
    'div',
    { class: 'hib-arch' },
    el('p', { class: 'lede' }, intro),
    el(
      'div',
      { class: 'sd-diagram-wrap' },
      el(
        'div',
        { class: 'sd-diagram' },
        svg,
        el(
          'div',
          { class: 'sd-legend', 'aria-hidden': 'true' },
          el('span', { class: 'sd-key sd-key--sync' }, 'drives'),
          el('span', { class: 'sd-key sd-key--async' }, 'on demand / per frame'),
        ),
      ),
      info,
    ),
  );
  return { node };
}
