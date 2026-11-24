import { el } from './dom.js';

/**
 * Persistent HUD (matches the wireframe):
 *  top-left  — brand + Quick Travel links
 *  top-right — [Mute Audio] and [Controls] toggles
 *  bottom-left — controls legend
 *  bottom-centre — contextual "[E] VIEW …" prompt
 * The mini-map (bottom-right) lives in minimap.js.
 */
export class Hud {
  constructor({ site, exhibits, muted, onTravel, onInteract, onToggleMute }) {
    document.getElementById('hud-brand').textContent = site.owner;
    document.getElementById('hud-role').textContent = site.role;

    this.navButtons = new Map();
    const nav = document.getElementById('qt-nav');
    exhibits.forEach((ex) => {
      const btn = el(
        'button',
        {
          type: 'button',
          class: 'qt-link',
          title: `Walk to ${ex.title}`,
          onclick: (e) => {
            if (e.detail > 0) btn.blur(); // mouse click: return keyboard focus to the scene
            onTravel(ex.id);
          },
        },
        el('span', { class: 'qt-num', 'aria-hidden': 'true' }, ex.number),
        el('span', { class: 'qt-text' }, ex.navLabel),
        el('span', { class: 'qt-check', 'aria-hidden': 'true' }),
      );
      this.navButtons.set(ex.id, btn);
      nav.append(btn);
    });

    this.muteBtn = document.getElementById('btn-mute');
    this.muteBtn.addEventListener('click', (e) => {
      if (e.detail > 0) this.muteBtn.blur();
      onToggleMute();
    });
    this.setMuted(muted);

    this.legend = document.getElementById('hud-legend');
    this.controlsBtn = document.getElementById('btn-controls');
    this.controlsBtn.addEventListener('click', (e) => {
      if (e.detail > 0) this.controlsBtn.blur();
      this.setLegendVisible(this.legend.hidden);
    });
    const compact = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
    this.setLegendVisible(!compact);

    this.prompt = document.getElementById('hud-prompt');
    this.promptText = document.getElementById('hud-prompt-text');
    this.prompt.addEventListener('click', (e) => {
      if (e.detail > 0) this.prompt.blur();
      onInteract();
    });
    this.promptExhibit = null;
  }

  setMuted(muted) {
    this.muteBtn.setAttribute('aria-pressed', String(muted));
    this.muteBtn.querySelector('.label').textContent = muted ? 'Unmute Audio' : 'Mute Audio';
    this.muteBtn.classList.toggle('is-muted', muted);
  }

  setLegendVisible(visible) {
    this.legend.hidden = !visible;
    this.controlsBtn.setAttribute('aria-expanded', String(visible));
  }

  setPrompt(exhibit) {
    if (exhibit === this.promptExhibit) return;
    this.promptExhibit = exhibit;
    if (!exhibit) {
      this.prompt.classList.remove('is-visible');
      this.prompt.tabIndex = -1;
      return;
    }
    this.promptText.textContent = exhibit.prompt;
    this.prompt.setAttribute('aria-label', `${exhibit.prompt} (press E)`);
    this.prompt.tabIndex = 0;
    this.prompt.classList.remove('is-visible');
    void this.prompt.offsetWidth; // restart entrance animation
    this.prompt.classList.add('is-visible');
  }

  pulsePrompt() {
    this.prompt.classList.remove('is-pulse');
    void this.prompt.offsetWidth;
    this.prompt.classList.add('is-pulse');
  }

  setVisited(id, visited) {
    const btn = this.navButtons.get(id);
    if (!btn) return;
    btn.classList.toggle('is-visited', visited);
    btn.title = visited ? 'Visited - walk back to it' : btn.title;
  }

  setActive(id) {
    for (const [key, btn] of this.navButtons) {
      if (key === id) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    }
  }
}
