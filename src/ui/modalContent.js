import { el, svgEl, safeUrl, isExternal } from './dom.js';
import { resume, github, projects, paper, howIBuild } from '../portfolioData.js';
import { renderHowIBuild } from './howIBuild.js';
import { projectThumbnail } from '../scene/textures.js';
import { mountPdfPage } from './pdfPage.js';

/* ------------------------------------------------------------ shared bits */

const ICONS = {
  download: 'M12 3v12m0 0l-5-5m5 5l5-5M4 19h16',
  external: 'M14 4h6v6m0-6L10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  check: 'M5 12l5 5L20 7',
  read: 'M4 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-7a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h7z',
};

function icon(name) {
  return svgEl(
    'svg',
    { class: 'icon', viewBox: '0 0 24 24', width: 16, height: 16, 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    svgEl('path', { d: ICONS[name] }),
  );
}

function link(href, text) {
  const url = safeUrl(href);
  if (!url) return el('span', {}, text);
  return el('a', { href: url, ...(isExternal(url) ? { target: '_blank', rel: 'noopener noreferrer' } : {}) }, text);
}

/** Anchor styled as a button; renders a disabled button when the URL is empty. */
function buttonLink(href, label, { primary = false, download = false, newTab = false, iconName } = {}) {
  const url = safeUrl(href);
  const cls = `btn${primary ? ' btn--primary' : ''}`;
  const content = [iconName ? icon(iconName) : null, el('span', {}, label)];
  if (!url) {
    return el('button', { type: 'button', class: cls, disabled: true, title: 'Add a URL in src/portfolioData.js' }, content);
  }
  const external = (isExternal(url) || newTab) && !download;
  return el(
    'a',
    {
      class: cls,
      href: url,
      download: download || null,
      ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
    },
    content,
  );
}

function sectionLabel(text) {
  return el('h3', { class: 'section-label' }, text);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = el('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/* --------------------------------------------------------------- resume */

/**
 * Resume exhibit: the real PDF resume, rendered so the whole page fits on screen
 * (no scrolling) with working links, plus an interactive summary as a second tab.
 */
function renderResume() {
  const r = resume;
  const url = safeUrl(r.pdfUrl);
  let view = url ? 'pdf' : 'summary';

  const pdfPane = el('div', { class: 'resume-pdf', id: 'resume-pane-pdf', role: 'tabpanel', 'aria-labelledby': 'resume-tab-pdf' });
  const summaryPane = el(
    'div',
    { class: 'resume-summary', id: 'resume-pane-summary', role: 'tabpanel', 'aria-labelledby': 'resume-tab-summary' },
    renderResumeSummary(),
  );

  let mounted = false;
  const mountPdf = () => {
    if (mounted || !url) return;
    mounted = true;
    mountPdfPage(pdfPane, url, { title: `${r.name} resume, page 1` });
  };

  const tabs = [
    { id: 'pdf', label: 'Resume PDF' },
    { id: 'summary', label: 'Quick summary' },
  ].map((t) =>
    el(
      'button',
      {
        type: 'button',
        role: 'tab',
        id: `resume-tab-${t.id}`,
        class: 'seg',
        'aria-controls': `resume-pane-${t.id}`,
        onclick: () => show(t.id),
      },
      t.label,
    ),
  );

  function show(next) {
    view = next;
    tabs.forEach((b) => {
      const on = b.id === `resume-tab-${next}`;
      b.setAttribute('aria-selected', String(on));
      b.setAttribute('aria-pressed', String(on));
    });
    if (next === 'pdf') mountPdf();
    pdfPane.hidden = next !== 'pdf';
    summaryPane.hidden = next !== 'summary';
  }
  show(view);

  return el(
    'div',
    { class: 'resume-wrap' },
    el(
      'div',
      { class: 'resume-toolbar' },
      el('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Resume view' }, tabs),
      el(
        'div',
        { class: 'resume-toolbar-actions' },
        buttonLink(url, 'Download PDF', { primary: true, download: true, iconName: 'download' }),
        buttonLink(url, 'Open full size', { iconName: 'external', newTab: true }),
      ),
      el('p', { class: 'resume-hint' }, 'Links on the page are clickable. Click anywhere else on the page to open it full size.'),
    ),
    pdfPane,
    summaryPane,
  );
}

function renderResumeSummary() {
  const r = resume;
  const initials = r.name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const avatar = r.avatar
    ? el('img', { class: 'avatar', src: safeUrl(r.avatar), alt: `Portrait of ${r.name}` })
    : el('div', { class: 'avatar avatar--initials', 'aria-hidden': 'true' }, initials);

  return el(
    'div',
    { class: 'resume' },
    el(
      'aside',
      { class: 'resume-side' },
      avatar,
      el('p', { class: 'resume-name' }, r.name),
      el('p', { class: 'resume-headline' }, r.headline),
      el('p', { class: 'resume-loc' }, r.location),
      sectionLabel('Contact'),
      el(
        'ul',
        { class: 'contact-list' },
        r.contact.map((c) => el('li', {}, el('span', { class: 'contact-label' }, c.label), link(c.href, c.value))),
      ),
      sectionLabel('Core Skills'),
      el('ul', { class: 'pills' }, r.skills.map((s) => el('li', { class: 'pill' }, s))),
    ),
    el(
      'section',
      { class: 'resume-main' },
      sectionLabel('Profile'),
      el('p', { class: 'lede' }, r.summary),
      sectionLabel('Experience'),
      el(
        'ol',
        { class: 'timeline' },
        r.experience.map((job) =>
          el(
            'li',
            { class: 'timeline-item' },
            el('p', { class: 'timeline-when' }, `${job.start} – ${job.end}`, job.place ? ` · ${job.place}` : ''),
            el('h4', { class: 'timeline-role' }, job.role, el('span', { class: 'timeline-org' }, ` · ${job.org}`)),
            el('ul', { class: 'timeline-bullets' }, job.bullets.map((b) => el('li', {}, b))),
          ),
        ),
      ),
      sectionLabel('Education'),
      el(
        'ul',
        { class: 'edu' },
        r.education.map((e) =>
          el(
            'li',
            {},
            el('div', {}, el('strong', {}, e.degree), el('p', { class: 'edu-school' }, e.school), e.note ? el('p', { class: 'edu-note' }, e.note) : null),
            el('span', {}, e.year),
          ),
        ),
      ),
      r.organizations?.length ? sectionLabel('Organizations') : null,
      r.organizations?.length
        ? el(
            'ul',
            { class: 'edu' },
            r.organizations.map((o) =>
              el(
                'li',
                {},
                el('div', {}, el('strong', {}, o.role), el('p', { class: 'edu-school' }, o.org), o.note ? el('p', { class: 'edu-note' }, o.note) : null),
                el('span', {}, o.years),
              ),
            ),
          )
        : null,
    ),
  );
}

/* --------------------------------------------------------------- github */

function renderGithub() {
  return el(
    'div',
    { class: 'gh' },
    el(
      'div',
      { class: 'gh-intro' },
      el('p', { class: 'lede' }, github.intro),
      github.profileUrl ? buttonLink(github.profileUrl, 'View GitHub profile', { iconName: 'external' }) : null,
    ),
    el(
      'ul',
      { class: 'project-grid' },
      projects.map((p, i) =>
        el(
          'li',
          { class: 'project-card' },
          el(
            'div',
            { class: 'project-thumb' },
            el('img', { src: p.image ? safeUrl(p.image) : projectThumbnail(p.title, i), alt: '', loading: 'lazy', decoding: 'async' }),
          ),
          el(
            'div',
            { class: 'project-body' },
            el('h3', { class: 'project-title' }, p.title),
            el('ul', { class: 'tags', 'aria-label': 'Tech stack' }, p.tags.map((t) => el('li', { class: 'tag' }, t))),
            el('p', { class: 'project-desc' }, p.description),
          ),
          el(
            'div',
            { class: 'project-actions' },
            buttonLink(p.source, 'Source Code', { iconName: 'code' }),
            buttonLink(p.demo, 'Live Demo', { iconName: 'external', primary: true }),
          ),
        ),
      ),
    ),
  );
}

/* ---------------------------------------------------------------- paper */

function splitName(full) {
  const parts = full.trim().split(/\s+/);
  const last = parts.pop() || '';
  return { first: parts, last };
}

function citationFormats(p) {
  const names = p.authors.map(splitName);
  const initials = (n) => n.first.map((f) => `${f[0]}.`).join(' ');

  const misc = p.kind === 'misc';
  const link = p.doi ? `https://doi.org/${p.doi}` : p.url && /^https?:/.test(p.url) ? p.url : '';

  const apaAuthors = names.map((n) => `${n.last}, ${initials(n)}`);
  const apaList =
    apaAuthors.length > 1 ? `${apaAuthors.slice(0, -1).join(', ')}, & ${apaAuthors[apaAuthors.length - 1]}` : apaAuthors[0];
  const apa = misc
    ? `${apaList} (${p.year}). ${p.title} [${p.venue}].${link ? ` ${link}` : ''}`
    : `${apaList} (${p.year}). ${p.title}. In ${p.venue}${p.pages ? ` (pp. ${p.pages})` : ''}.${link ? ` ${link}` : ''}`;

  const ieeeAuthors = names.map((n) => `${initials(n)} ${n.last}`.trim());
  const ieeeList =
    ieeeAuthors.length > 2
      ? `${ieeeAuthors.slice(0, -1).join(', ')}, and ${ieeeAuthors[ieeeAuthors.length - 1]}`
      : ieeeAuthors.join(' and ');
  const ieee = misc
    ? `${ieeeList}, “${p.title},” ${p.venue.toLowerCase()}, ${p.year}.${link ? ` [Online]. Available: ${link}` : ''}`
    : `${ieeeList}, “${p.title},” in ${p.venue}, ${p.year}${p.pages ? `, pp. ${p.pages}` : ''}.${p.doi ? ` doi: ${p.doi}.` : ''}`;

  const bibtex = [
    `@${misc ? 'misc' : 'inproceedings'}{${p.bibKey},`,
    `  title     = {${p.title}},`,
    `  author    = {${p.authors.join(' and ')}},`,
    misc ? `  note      = {${p.venue}},` : `  booktitle = {${p.venue}},`,
    `  year      = {${p.year}},`,
    p.pages ? `  pages     = {${p.pages.replace('–', '--')}},` : null,
    p.doi ? `  doi       = {${p.doi}},` : null,
    misc && link ? `  url       = {${link}},` : null,
    `}`,
  ]
    .filter(Boolean)
    .join('\n');

  return [
    { id: 'apa', label: 'APA', text: apa },
    { id: 'ieee', label: 'IEEE', text: ieee },
    { id: 'bibtex', label: 'BibTeX', text: bibtex },
  ];
}

function renderPaper() {
  const p = paper;
  const formats = citationFormats(p);
  let current = formats[0];

  const pre = el('pre', { class: 'citation-text', tabindex: '0' }, current.text);
  const copyLabel = el('span', {}, 'Copy');
  const copyIcon = el('span', { class: 'copy-icon' }, icon('copy'));
  const copyBtn = el('button', { type: 'button', class: 'btn btn--small', 'aria-live': 'polite' }, copyIcon, copyLabel);
  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(current.text);
    copyLabel.textContent = ok ? 'Copied' : 'Copy failed';
    copyIcon.replaceChildren(icon(ok ? 'check' : 'copy'));
    copyBtn.classList.toggle('is-done', ok);
    setTimeout(() => {
      copyLabel.textContent = 'Copy';
      copyIcon.replaceChildren(icon('copy'));
      copyBtn.classList.remove('is-done');
    }, 1800);
  });

  const formatButtons = formats.map((f, i) =>
    el(
      'button',
      {
        type: 'button',
        class: 'seg',
        'aria-pressed': String(i === 0),
        onclick: (e) => {
          current = f;
          pre.textContent = f.text;
          for (const b of formatButtons) b.setAttribute('aria-pressed', String(b === e.currentTarget));
        },
      },
      f.label,
    ),
  );

  const preview =
    p.embedPreview && safeUrl(p.pdfUrl)
      ? el(
          'figure',
          { class: 'paper-preview' },
          el('iframe', { src: `${safeUrl(p.pdfUrl)}#view=FitH&toolbar=0&navpanes=0`, title: `Preview of ${p.title}`, loading: 'lazy' }),
          el('figcaption', {}, 'Embedded preview — use “Read Full Paper” if your browser cannot display PDFs inline.'),
        )
      : null;

  return el(
    'article',
    { class: 'paper' },
    el(
      'header',
      { class: 'paper-head' },
      el('p', { class: 'paper-venue' }, el('span', { class: 'badge' }, p.status), ` ${p.venueShort}`),
      el('h3', { class: 'paper-title' }, p.title),
      el('p', { class: 'paper-authors' }, p.authors.join(', ')),
    ),
    el(
      'div',
      { class: 'paper-grid' },
      el(
        'div',
        { class: 'paper-main' },
        sectionLabel('Abstract'),
        el('p', { class: 'paper-abstract' }, p.abstract),
        sectionLabel('Key Contributions'),
        el('ol', { class: 'contributions' }, p.contributions.map((c) => el('li', {}, c))),
        preview ? sectionLabel('Preview') : null,
        preview,
      ),
      el(
        'aside',
        { class: 'paper-side' },
        sectionLabel('At a Glance'),
        el(
          'dl',
          { class: 'stats' },
          p.highlights.map((h) => el('div', { class: 'stat' }, el('dt', {}, h.label), el('dd', {}, h.value))),
        ),
        sectionLabel('Citation'),
        el(
          'div',
          { class: 'citation' },
          el('div', { class: 'citation-bar' }, el('div', { class: 'segmented', role: 'group', 'aria-label': 'Citation format' }, formatButtons), copyBtn),
          pre,
        ),
        el(
          'div',
          { class: 'modal-actions modal-actions--stack' },
          buttonLink(p.url, 'Read Full Paper', { primary: true, iconName: 'read' }),
          buttonLink(p.pdfUrl, 'Download', { download: true, iconName: 'download' }),
        ),
      ),
    ),
  );
}

export const renderers = {
  resume: renderResume,
  github: renderGithub,
  paper: renderPaper,
  system: () => renderHowIBuild(howIBuild),
};
