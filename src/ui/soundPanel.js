import { el } from './dom.js';
import { SOUND_LAYERS } from '../audio/galleryAudio.js';

/**
 * The speaker button opens a small Sound panel: an on/off switch, a volume
 * slider and one checkbox per soundscape, so visitors can mix their own.
 */
export function setupSoundPanel({ button, panel, audio }) {
  const onSwitch = el('input', { type: 'checkbox', role: 'switch', id: 'sound-on', class: 'sound-switch' });
  const volume = el('input', { type: 'range', id: 'sound-volume', min: '0', max: '100', step: '1', 'aria-label': 'Volume' });
  const boxes = new Map();

  const list = el(
    'ul',
    { class: 'sound-layers' },
    SOUND_LAYERS.map((layer) => {
      const box = el('input', { type: 'checkbox', id: `sound-${layer.id}` });
      box.addEventListener('change', () => {
        audio.unlock();
        audio.setLayer(layer.id, box.checked);
        if (box.checked && audio.muted) audio.setMuted(false);
      });
      boxes.set(layer.id, box);
      return el('li', {}, el('label', { for: `sound-${layer.id}` }, box, el('span', {}, el('strong', {}, layer.label), el('small', {}, layer.detail))));
    }),
  );

  panel.replaceChildren(
    el('div', { class: 'sound-head' }, el('label', { for: 'sound-on' }, el('strong', {}, 'Sound')), onSwitch),
    el('div', { class: 'sound-volume' }, el('span', { 'aria-hidden': 'true' }, 'Quiet'), volume, el('span', { 'aria-hidden': 'true' }, 'Loud')),
    el('p', { class: 'sound-sub' }, 'Mix your soundscape'),
    list,
  );

  onSwitch.addEventListener('change', () => {
    audio.unlock();
    audio.setMuted(!onSwitch.checked);
  });
  volume.addEventListener('input', () => {
    audio.unlock();
    audio.setVolume(+volume.value / 100);
  });

  const render = (s) => {
    onSwitch.checked = !s.muted;
    volume.value = String(Math.round(s.volume * 100));
    for (const [id, box] of boxes) box.checked = s.layers.includes(id);
    panel.classList.toggle('is-off', s.muted);
    button.classList.toggle('is-muted', s.muted);
    button.setAttribute('aria-label', s.muted ? 'Sound (off)' : 'Sound');
  };
  audio.onChange(render);
  render(audio.settings);

  const isOpen = () => !panel.hidden;
  const setOpen = (open) => {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) onSwitch.focus({ preventScroll: true });
  };
  setOpen(false);

  button.addEventListener('click', (e) => {
    if (e.detail > 0) button.blur();
    audio.unlock();
    setOpen(!isOpen());
  });
  document.addEventListener('pointerdown', (e) => {
    if (isOpen() && !panel.contains(e.target) && !button.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      e.stopPropagation();
      setOpen(false);
      button.focus();
    }
  });
}
