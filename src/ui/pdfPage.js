import { el, safeUrl } from './dom.js';

/*
 * Renders one page of a PDF so the WHOLE page fits inside a container — no scrolling,
 * no viewer chrome — with the PDF's own hyperlinks overlaid as real <a> elements.
 * pdf.js is loaded lazily the first time a PDF is shown, so the 3D scene never pays for it.
 */

let pdfjsPromise = null;
function loadPdfjs() {
  pdfjsPromise ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(
    ([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    },
  );
  return pdfjsPromise;
}

const documents = new Map();

/**
 * @param {HTMLElement} container  element whose box the page must fit inside
 * @param {string} url             PDF URL
 * @param {{ title: string, pageNumber?: number }} opts
 */
export function mountPdfPage(container, url, { title, pageNumber = 1 }) {
  const href = safeUrl(url);
  const canvas = el('canvas', { class: 'pdf-canvas', role: 'img', 'aria-label': title });
  const links = el('div', { class: 'pdf-links' });
  const stage = el('div', { class: 'pdf-stage', title: 'Click to open the full-size PDF' }, canvas, links);
  const status = el('p', { class: 'pdf-status' }, 'Loading…');
  container.classList.add('pdf-fit');
  container.append(status, stage);

  // Clicking the page (anywhere except a link) opens the full PDF.
  stage.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    window.open(href, '_blank', 'noopener');
  });

  let page = null;
  let task = null;
  let lastKey = '';
  let timer = 0;
  const observer = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(render, 50);
  });

  (async () => {
    try {
      const pdfjs = await loadPdfjs();
      if (!documents.has(href)) documents.set(href, pdfjs.getDocument(href).promise);
      const doc = await documents.get(href);
      page = await doc.getPage(pageNumber);
      status.remove();
      observer.observe(container);
      render();
    } catch (err) {
      console.error('[pdf] could not render', err);
      status.textContent = 'This PDF could not be displayed here — use “Open in new tab” instead.';
    }
  })();

  async function render() {
    if (!page || !container.isConnected) return;
    const box = container.getBoundingClientRect();
    if (box.width < 20 || box.height < 20) return; // hidden tab

    const base = page.getViewport({ scale: 1 });
    const fit = Math.min(box.width / base.width, box.height / base.height);
    const cssW = Math.floor(base.width * fit);
    const cssH = Math.floor(base.height * fit);
    const key = `${cssW}x${cssH}`;
    if (key === lastKey) return;
    lastKey = key;

    // Supersample so small resume text stays crisp when the page is scaled down.
    const density = Math.min(3, (window.devicePixelRatio || 1) * 2);
    const viewport = page.getViewport({ scale: fit * density });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    for (const node of [canvas, stage]) {
      node.style.width = `${cssW}px`;
      node.style.height = `${cssH}px`;
    }

    task?.cancel();
    task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
    try {
      await task.promise;
    } catch (err) {
      if (err?.name === 'RenderingCancelledException') return;
      throw err;
    }

    const cssViewport = page.getViewport({ scale: fit });
    const annotations = await page.getAnnotations();
    links.replaceChildren(
      ...annotations
        .filter((a) => a.subtype === 'Link' && a.url && safeUrl(a.url))
        .map((a) => {
          const [x1, y1, x2, y2] = cssViewport.convertToViewportRectangle(a.rect);
          return el('a', {
            class: 'pdf-link',
            href: safeUrl(a.url),
            target: '_blank',
            rel: 'noopener noreferrer',
            'aria-label': a.url,
            title: a.url,
            style: {
              left: `${Math.min(x1, x2)}px`,
              top: `${Math.min(y1, y2)}px`,
              width: `${Math.abs(x2 - x1)}px`,
              height: `${Math.abs(y2 - y1)}px`,
            },
          });
        }),
    );
  }

  return () => {
    observer.disconnect();
    task?.cancel();
  };
}
