import { el } from './dom.js';
import { renderers } from './modalContent.js';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, iframe, [tabindex]:not([tabindex="-1"])';

/**
 * DOM modal overlays for the four exhibits. Handles open/close animation,
 * focus trapping, focus restore, backdrop click and Esc (wired from main.js).
 */
export class ModalManager {
  constructor(root, { exhibits, onOpen, onClose, fallbackFocus }) {
    this.root = root;
    this.exhibits = exhibits;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.fallbackFocus = fallbackFocus;
    this.current = null;
  }

  get isOpen() {
    return !!this.current;
  }

  open(id) {
    if (this.current?.id === id) return;
    if (this.current) this.close({ immediate: true, silent: true });

    const exhibit = this.exhibits.find((e) => e.id === id);
    const render = renderers[id];
    if (!exhibit || !render) return;

    this.lastFocus = document.activeElement;
    const titleId = `modal-title-${id}`;

    const closeBtn = el(
      'button',
      { type: 'button', class: 'modal-close', 'aria-label': 'Close dialog', onclick: () => this.close() },
      el('span', { class: 'modal-close-label' }, 'Close'),
      el('kbd', {}, 'Esc'),
      el('span', { class: 'modal-close-x', 'aria-hidden': 'true' }, '✕'),
    );

    const dialog = el(
      'div',
      { class: `modal modal--${id}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' },
      el(
        'header',
        { class: 'modal-head' },
        el(
          'div',
          { class: 'modal-titles' },
          el('p', { class: 'eyebrow' }, `Exhibit ${exhibit.number} · ${exhibit.modalLabel}`),
          el('h2', { id: titleId, class: 'modal-title' }, exhibit.title),
        ),
        closeBtn,
      ),
      el('div', { class: 'modal-body' }, render()),
    );

    const backdrop = el('div', { class: 'modal-backdrop' }, dialog);
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) this.close();
    });
    backdrop.addEventListener('keydown', (e) => this.#trapFocus(e, dialog));

    this.root.append(backdrop);
    this.root.removeAttribute('hidden');
    requestAnimationFrame(() => backdrop.classList.add('is-open'));
    closeBtn.focus({ preventScroll: true });

    this.current = { id, backdrop };
    this.onOpen?.(id);
  }

  close({ immediate = false, silent = false } = {}) {
    const cur = this.current;
    if (!cur) return;
    this.current = null;
    cur.backdrop.classList.remove('is-open');
    cur.backdrop.classList.add('is-closing');
    const remove = () => cur.backdrop.remove();
    if (immediate) remove();
    else setTimeout(remove, 280);

    if (!silent) {
      const target =
        this.lastFocus && this.lastFocus !== document.body && document.contains(this.lastFocus)
          ? this.lastFocus
          : this.fallbackFocus;
      target?.focus?.({ preventScroll: true });
      this.onClose?.(cur.id);
    }
  }

  #trapFocus(e, dialog) {
    if (e.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
