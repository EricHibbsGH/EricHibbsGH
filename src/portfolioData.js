/**
 * portfolioData.js — the ONE file to edit for all personal content.
 *
 * Everything you see in the gallery (wall lettering, painting titles, HUD labels,
 * directions and all four modals) is rendered from the objects below.
 *
 * Swapping in real assets:
 *  - Frame artwork: set `exhibits[i].preview.image` to an image URL (e.g. './art/resume.png'
 *    placed in /public/art). Leave it null to keep the procedural canvas artwork.
 *  - Resume PDF:    /public/resume.pdf
 *  - Paper PDF:     /public/paper.pdf
 *  - Project thumbs: set `projects[i].image` to an image URL; null = generated thumbnail.
 *  - Links: any empty string ('') renders as a disabled button / hidden link.
 */

export const site = {
  title: 'Eric Hibbs',
  owner: 'Eric Hibbs',
  role: 'HCI Developer & Product Owner',
  wallTagline: 'Digital Narrative & Interactive Design - University of Pittsburgh, 2025',
  intro:
    'I lead human-centered AI products from research to release, pairing HCI methods with product ownership so what ships is measurably easier to use. Walk the gallery for my resume, projects, research and design process.',
};

/**
 * The four framed exhibits.
 * placement.wall: 'left' | 'right' | 'back'  (room is 18m wide × 22m deep × 4.6m high)
 * placement.offset: position along that wall in metres (z for side walls, x for the back wall)
 * placement.height: centre height of the frame in metres
 * placement.labelSide: which side of the frame the wall label hangs on (-1 = left, 1 = right, as you face it)
 * size: outer artwork size in metres
 */
export const exhibits = [
  {
    id: 'resume',
    number: '01',
    title: 'Resume',
    navLabel: 'Resume',
    prompt: 'View Resume',
    subtitle: 'Experience, education & skills',
    modalLabel: 'Resume',
    placement: { wall: 'left', offset: -3, height: 2.3, labelSide: -1 },
    size: { width: 1.6, height: 2.05 },
    preview: { style: 'resume', image: null },
  },
  {
    id: 'github',
    number: '02',
    title: 'Projects',
    navLabel: 'Projects',
    prompt: 'View Projects',
    subtitle: 'Things I have designed & shipped',
    modalLabel: 'GitHub Projects',
    placement: { wall: 'back', offset: -4.1, height: 2.3, labelSide: -1 },
    size: { width: 2.3, height: 1.72 },
    preview: { style: 'github', image: null },
  },
  {
    id: 'paper',
    number: '03',
    title: 'Research',
    navLabel: 'Research',
    prompt: 'Read the Paper',
    subtitle: 'Independent research, 2026',
    modalLabel: 'Research Paper',
    placement: { wall: 'back', offset: 4.1, height: 2.3, labelSide: 1 },
    size: { width: 1.6, height: 2.05 },
    preview: { style: 'paper', image: null },
  },
  {
    id: 'system',
    number: '04',
    title: 'How I Build',
    navLabel: 'How I Build',
    prompt: 'See How I Build',
    subtitle: 'Human-centered system design',
    modalLabel: 'Design process & HCI',
    placement: { wall: 'right', offset: -3, height: 2.3, labelSide: 1 },
    size: { width: 2.3, height: 1.72 },
    preview: { style: 'system', image: null },
  },
];

/* ------------------------------------------------------------------ */
/* Modal 1 — Resume                                                    */
/* ------------------------------------------------------------------ */
export const resume = {
  name: 'Eric Hibbs',
  headline: 'HCI Developer & Product Owner',
  location: 'Atlanta, GA',
  avatar: null, // e.g. './art/avatar.jpg' — null shows initials
  pdfUrl: './resume.pdf',
  contact: [
    { label: 'Email', value: 'ericbhibbs@gmail.com', href: 'mailto:ericbhibbs@gmail.com' },
    { label: 'LinkedIn', value: 'linkedin.com/in/erichibbs', href: 'https://www.linkedin.com/in/erichibbs/' },
    { label: 'GitHub', value: 'github.com/EricHibbsGH', href: 'https://github.com/EricHibbsGH' },
  ],
  skills: [
    'Python', 'JavaScript', 'Java', 'R', 'HTML/CSS', 'Chart.js',
    'Agentic AI', 'Data Analysis', 'Probability Modeling', 'Algorithms & Data Structures',
    'Figma', 'UI/UX', 'Prototyping',
  ],
  summary:
    'I design and build AI products, taking problems from raw data to working prototypes in Python, JavaScript and Figma. ' +
    'I bring a design degree from Pitt, product management experience and over a year of building agentic AI systems. ' +
    'On my own, I research how large AI models are trained, most recently in an independent paper on a method that makes reasoning-model training up to 2.1× faster.',
  experience: [
    {
      role: 'Data & AI Leadership Program',
      org: 'Acuity Inc.',
      start: 'Jul 2025',
      end: 'Nov 2026',
      place: 'Atlanta, GA',
      bullets: [
        'Built agentic AI systems for Acuity, a leader in lighting and building technology.',
        'Analyzed and optimized enterprise datasets with millions of records.',
      ],
    },
    {
      role: 'Digital Product Management Intern',
      org: 'Acuity Brands',
      start: 'May 2024',
      end: 'Aug 2024',
      place: 'Remote',
      bullets: [
        'Designed and prototyped the first version of a new Order Management Dashboard interface.',
        'Analyzed customer experience (CX) system data to identify improvements to the CX platform.',
        'Researched competitors to shape product strategy and feature plans for several in-house tools.',
        'Documented UI components in Zeroheight to keep design consistent across in-house tools.',
      ],
    },
    {
      role: 'Freelance Designer',
      org: 'Self-Employed',
      start: 'Aug 2023',
      end: 'Present',
      place: 'Pittsburgh, PA',
      bullets: [
        'Design consumer app prototypes for fitness tracking (StayActive), trip planning (TripGenius) and task management (EZTask).',
      ],
    },
  ],
  education: [
    {
      degree: 'B.S. Digital Narrative and Interactive Design',
      school: 'University of Pittsburgh',
      year: '2021 - 2025',
      note: 'Minor in Information Science · Graduated with Honors',
    },
  ],
  organizations: [
    { role: 'Social Chair', org: 'Sigma Alpha Epsilon', years: '2023 - 2024', note: 'Planned and hosted events averaging 200+ attendees.' },
    { role: 'Camp Counselor / Youth Director', org: 'Ardmore Presbyterian Church', years: '2014 - 2019', note: 'Managed camp logistics and led groups of campers and counselors.' },
  ],
};

/* ------------------------------------------------------------------ */
/* Modal 2 — GitHub projects (3-column grid)                           */
/* ------------------------------------------------------------------ */
export const github = {
  profileUrl: 'https://github.com/EricHibbsGH',
  intro: 'Research write-ups, interactive dashboards, games and small tools. Every one has a live version you can open.',
};

export const projects = [
  {
    title: 'Overlapping, Not Approximating',
    description: 'A 10-page independent analysis of TLT (ASPLOS ’26): 11 claims traced to exact lines of released code, 5 code-vs-paper gaps, and a math model of where the 1.7–2.1× speed-up comes from.',
    tags: ['Research', 'LaTeX', 'RL systems'],
    source: 'https://github.com/EricHibbsGH/ASync-Mania',
    demo: 'https://erichibbsgh.github.io/ASync-Mania/',
    image: null,
  },
  {
    title: 'Taming the Long-Tail',
    description: 'A 7-tab interactive dashboard for an MIT-led ASPLOS ’26 paper, reproducing its 9 figures and 7 tables, with a rollout simulator and calculators for each model.',
    tags: ['JavaScript', 'Chart.js', 'Data viz'],
    source: 'https://github.com/EricHibbsGH/Taming-the-Long-Tail-an-interactive.',
    demo: 'https://erichibbsgh.github.io/Taming-the-Long-Tail-an-interactive./',
    image: null,
  },
  {
    title: 'CacheOps',
    description: 'Shows what missed prompt caching costs you in Claude Code, explains why it happened, and fixes what it can.',
    tags: ['Developer tools', 'LLMs', 'HTML'],
    source: 'https://github.com/EricHibbsGH/CacheOps-site',
    demo: 'https://erichibbsgh.github.io/CacheOps-site/',
    image: null,
  },
  {
    title: 'QuadChess',
    description: 'Four-player chess on a 160-square board: pass-and-play or online across four computers over WebRTC, with no accounts and no game server.',
    tags: ['TypeScript', 'WebRTC', 'Game'],
    source: 'https://github.com/EricHibbsGH/QuadChess',
    demo: 'https://erichibbsgh.github.io/QuadChess/',
    image: null,
  },
  {
    title: 'Mah Jongg Practice',
    description: 'A calm, accessible app for learning American Mah Jongg (lessons, hand families and strategy drills), built for my mom.',
    tags: ['JavaScript', 'Accessibility', 'Teaching'],
    source: 'https://github.com/EricHibbsGH/MahjongForMom',
    demo: 'https://erichibbsgh.github.io/MahjongForMom/',
    image: null,
  },
  {
    title: 'Inside the Numbers: MLB',
    description: 'A data story on MLB betting lines, pitcher performance and inning-by-inning scoring, with an interactive 3D scatter of odds vs. win rate.',
    tags: ['Python', 'Pandas', 'Plotly'],
    source: 'https://github.com/EricHibbsGH/Inside-the-Numbers-Unveiling-Insights-from-MLB-Data',
    demo: 'https://erichibbsgh.github.io/Inside-the-Numbers-Unveiling-Insights-from-MLB-Data/',
    image: null,
  },
];

/* ------------------------------------------------------------------ */
/* Modal 3 — Research paper                                            */
/* Citations (APA / IEEE / BibTeX) are generated from these fields.    */
/* kind: 'misc' for independent work, 'inproceedings' for conferences. */
/* ------------------------------------------------------------------ */
export const paper = {
  kind: 'misc',
  title: 'Overlapping, Not Approximating: Asynchronous-Style Speedup in Reasoning-RL Training and the Lossless Design of TLT',
  authors: ['Eric Hibbs'],
  venue: 'Independent research paper',
  venueShort: 'Independent analysis of TLT (ASPLOS ’26) · 2026',
  year: '2026',
  pages: '',
  doi: '',
  bibKey: 'hibbs2026overlapping',
  status: 'Independent research',
  url: 'https://erichibbsgh.github.io/ASync-Mania/', // "Read Full Paper"
  pdfUrl: './paper.pdf', // "Download" + embedded preview
  embedPreview: true,
  abstract:
    'Reinforcement-learning training of reasoning LLMs is throttled by a long-tail rollout problem: a handful of very long generations dominate each step while most workers sit idle. ' +
    'TLT attacks this not by approximating the algorithm but by overlapping otherwise-idle work in time, with an Adaptive Drafter trained on idle GPUs and an Adaptive Rollout Engine that turns on speculative decoding exactly when the batch shrinks into its sweet spot. ' +
    'This paper frames TLT around those asynchrony mechanisms, pairs each with its measured speedup and its implementation in the released code, develops a mathematical model of where the gains come from and why they saturate, and contrasts TLT’s lossless synchrony with the off-policy drift risked by fully asynchronous RL. ' +
    'The thesis: you can capture async-style utilization gains without paying the correctness tax of async RL.',
  contributions: [
    'A 10-page analysis of TLT, an ASPLOS ’26 method that speeds up reasoning-model RL training 1.7–2.1× without changing results.',
    'Traced 11 claims to exact lines in the released code and found 5 gaps between code and paper, including a core feature shipped disabled.',
    'A math model showing the speedup needs a 1.9–2.6× faster generation phase, plus a deployment guide on cost, setup and checks.',
  ],
  highlights: [
    { value: '1.7–2.1×', label: 'Training speed-up analyzed' },
    { value: '11', label: 'Claims traced to code' },
    { value: '5', label: 'Code vs. paper gaps found' },
  ],
};

/* ------------------------------------------------------------------ */
/* Modal 4 — How I Build (human-centered system design)                */
/* Every example below is drawn from real projects on this site.       */
/* ------------------------------------------------------------------ */
export const howIBuild = {
  intro:
    'I make complex things explorable, ground every claim in evidence, and iterate with real people until the interface feels obvious. This exhibit is that process, and it is interactive: try the ideas instead of reading about them.',
  traits: [
    { label: 'Explorable over explained', detail: 'Dashboards, simulators and calculators so people can test an idea themselves.' },
    { label: 'Evidence first', detail: 'Claims traced to code, values checked against sources, performance measured.' },
    { label: 'Built for a real person', detail: 'My mom, a neighborhood, the visitor in front of the screen.' },
    { label: 'Fewer gates', detail: 'No accounts, servers or build steps unless they earn their place.' },
  ],

  /* The design loop (HCI's iterative design cycle) */
  loop: [
    {
      id: 'understand',
      label: 'Understand',
      verb: 'Listen',
      summary: 'Start with the person and their context, not the feature list.',
      questions: ['Who is this for, and what are they trying to get done?', 'What do they already know, and what will they expect to happen?'],
      methods: ['Interviews & observation', 'Data audit', 'Competitive research'],
      evidence: [
        { project: 'Food Access in the Hill District', detail: 'Compared 2010 Census tract data against food-desert criteria before proposing anything.' },
        { project: 'Acuity Brands', detail: 'Analyzed customer-experience data and researched competitors to shape product strategy.' },
        { project: 'Mah Jongg Practice', detail: 'Designed around one real learner: my mom.' },
      ],
      principle: { name: 'Contextual inquiry', note: 'A design is only as good as your picture of the user’s world.' },
    },
    {
      id: 'define',
      label: 'Define',
      verb: 'Frame',
      summary: 'Name the real problem, the constraints, and how we will know it is solved.',
      questions: ['What does success look like in behavior or numbers?', 'What has to stay simple no matter what?'],
      methods: ['Requirements docs', 'Success metrics', 'Constraints'],
      evidence: [
        { project: 'MyThirdPlace', detail: 'Wrote an in-depth requirements document before designing the app.' },
        { project: 'CacheOps', detail: 'Framed the problem as a cost people can see: what missed prompt caching actually costs.' },
      ],
      principle: { name: 'Task analysis', note: 'Break the goal into the steps a person really takes.' },
    },
    {
      id: 'prototype',
      label: 'Prototype',
      verb: 'Make',
      summary: 'Build the lowest-fidelity thing that can answer the next question, then raise fidelity.',
      questions: ['What is the riskiest assumption?', 'What is the cheapest thing I can put in front of someone today?'],
      methods: ['Figma prototypes', 'Clickable flows', 'Working code spikes'],
      evidence: [
        { project: 'Acuity Brands', detail: 'Designed and prototyped the first version of a new Order Management Dashboard.' },
        { project: 'Freelance design', detail: 'Consumer app prototypes for StayActive, TripGenius and EZTask.' },
      ],
      principle: { name: 'Progressive fidelity', note: 'Sketch, then wireframe, then interactive, each step answering one question.' },
    },
    {
      id: 'test',
      label: 'Test',
      verb: 'Watch',
      summary: 'Put it in front of people and watch. The moments of confusion are the data.',
      questions: ['Where do people hesitate or guess?', 'What did they expect to happen instead?'],
      methods: ['Playtests', 'Think-aloud', 'Screenshot feedback'],
      evidence: [{ project: 'This gallery', detail: 'Playtests showed walk-and-turn controls made the camera spin, so the control scheme was rebuilt.' }],
      principle: { name: 'Usability testing', note: 'A handful of honest sessions beats a pile of opinions.' },
    },
    {
      id: 'measure',
      label: 'Measure',
      verb: 'Verify',
      summary: 'Check the work against reality: numbers, sources and code, not vibes.',
      questions: ['Can every claim be traced to a source?', 'Is it fast enough to feel instant?'],
      methods: ['Source tracing', 'Benchmarks', 'Performance budgets'],
      evidence: [
        { project: 'Overlapping, Not Approximating', detail: 'Traced 11 claims to exact lines of released code and found 5 gaps.' },
        { project: 'Taming the Long-Tail', detail: 'Reproduced 9 figures and 7 tables, checking every value against the paper.' },
        { project: 'This gallery', detail: 'Profiled to about 120 fps with 111 draw calls on a laptop.' },
      ],
      principle: { name: 'Doherty threshold', note: 'Responses under ~400 ms keep people in flow.' },
    },
    {
      id: 'refine',
      label: 'Refine',
      verb: 'Simplify',
      summary: 'Remove until it feels obvious, and keep the system consistent so people learn it once.',
      questions: ['What can be removed without losing the goal?', 'Does it behave the same way everywhere?'],
      methods: ['Design systems', 'Heuristic review', 'Cutting scope'],
      evidence: [
        { project: 'Acuity Brands', detail: 'Documented UI components in Zeroheight to keep in-house tools consistent.' },
        { project: 'QuadChess', detail: 'No accounts, no database, no game server: open it and play.' },
        { project: 'Mah Jongg Practice', detail: 'No framework, no build step, no network calls.' },
      ],
      principle: { name: 'Consistency & standards', note: 'Learn it once, use it everywhere.' },
    },
  ],

  /* Principles × projects matrix */
  principles: [
    { id: 'status', name: 'Visibility of system status', source: 'Nielsen heuristic 1', summary: 'Always show people what is happening and where they are.' },
    { id: 'mental', name: 'Match the mental model', source: 'Nielsen heuristic 2 · Norman’s mapping', summary: 'Controls and language should work the way people already expect.' },
    { id: 'control', name: 'User control & freedom', source: 'Nielsen heuristic 3', summary: 'Easy exits, no forced paths, nothing gated without a reason.' },
    { id: 'consistency', name: 'Consistency & standards', source: 'Nielsen heuristic 4', summary: 'The same thing looks and behaves the same way everywhere.' },
    { id: 'access', name: 'Accessible by default', source: 'WCAG 2.2', summary: 'Keyboard paths, readable contrast and calm motion from the start.' },
    { id: 'speed', name: 'Performance is UX', source: 'Doherty threshold', summary: 'If it does not feel instant, it does not feel good.' },
  ],
  projectsCols: [
    { id: 'gallery', label: 'This gallery' },
    { id: 'tlt', label: 'Taming the Long-Tail' },
    { id: 'cacheops', label: 'CacheOps' },
    { id: 'quadchess', label: 'QuadChess' },
    { id: 'mahjong', label: 'Mah Jongg' },
    { id: 'acuity', label: 'Acuity dashboard' },
  ],
  matrix: {
    status: {
      gallery: 'A guide pill shows the next exhibit, its distance and direction; opened exhibits get a tick.',
      cacheops: 'Surfaces the cost of missed prompt caching so it is visible instead of hidden in a bill.',
      mahjong: 'Progress is saved on the device, so learners can see how far they have come.',
    },
    mental: {
      gallery: 'After playtests, WASD moves the figure in screen directions instead of rotating the world.',
      tlt: 'Rebuilds the paper’s own figures, so readers start from a picture they recognize.',
      cacheops: 'Explains why caching was missed, not just that it was.',
    },
    control: {
      gallery: 'Esc always closes, keys override click-to-walk, tips can be skipped, right-drag looks anywhere.',
      tlt: 'Interactive calculators let readers change the model’s assumptions themselves.',
      quadchess: 'No account wall: open the page and play, pass-and-play or online.',
    },
    consistency: {
      gallery: 'One HUD system: the same panels, buttons and hover feedback everywhere.',
      acuity: 'Documented UI components in Zeroheight so in-house tools stay consistent.',
    },
    access: {
      gallery: 'Every exhibit is reachable by keyboard, dialogs trap focus, and reduced motion is respected.',
      mahjong: 'A calm, accessible teaching tool rather than a fast-paced online game.',
    },
    speed: {
      gallery: 'Baked shadows, merged geometry and adaptive resolution hold ~120 fps; pdf.js loads only when needed.',
      quadchess: 'The whole game runs in the page; players connect browser-to-browser over WebRTC.',
      mahjong: 'Plain HTML, CSS and JavaScript with no build step keep it light.',
    },
  },

  /* Case study: how this gallery was designed, one playtest at a time */
  caseStudy: {
    intro: 'This gallery was built in short loops: playtest, note what felt wrong, find the principle underneath, change one thing, measure.',
    steps: [
      {
        title: 'Warmth',
        feedback: 'Too white and boring. It feels AI-generated.',
        diagnosis: 'Sterile surfaces gave no sense of place, so nothing invited people to linger.',
        change: 'Rebuilt as a warm salon: oak floor, sage plaster, lamps, furniture and plants.',
        principle: 'Aesthetic–usability effect',
      },
      {
        title: 'Camera',
        feedback: 'The camera needs to follow. I don’t want to click to move it.',
        diagnosis: 'Steering the camera and the figure at once split attention between two tasks.',
        change: 'A follow camera that tracks the figure automatically.',
        principle: 'Reduce cognitive load',
      },
      {
        title: 'Controls',
        feedback: 'He keeps spinning and is still hard to control.',
        diagnosis: 'Walk-and-turn controls rotate the whole view, a control–display mismatch with how people expect “left” to work.',
        change: 'Screen-relative WASD, click-to-walk, and a camera that holds its angle.',
        principle: 'Stimulus–response compatibility',
        metric: 'Stops in under 0.1 s',
      },
      {
        title: 'Freedom',
        feedback: 'This is limiting the camera view.',
        diagnosis: 'Taking away manual camera control fixed the spinning but removed agency.',
        change: 'Right-drag to look, plus a one-time “Drag to move camera” hint.',
        principle: 'User control & discoverability',
      },
      {
        title: 'Performance',
        feedback: 'It is choppy.',
        diagnosis: 'Shadows re-rendered every frame, hundreds of draw calls, and a texture re-uploaded 24 times a second.',
        change: 'Baked shadows, merged meshes, a vector stick figure and adaptive resolution.',
        principle: 'Doherty threshold',
        metric: '~120 fps · 111 draw calls',
      },
      {
        title: 'Wayfinding',
        feedback: 'Label the paintings and give people directions.',
        diagnosis: 'Visitors could not tell what each frame was or where to go next.',
        change: 'Painted titles, high-contrast labels, a direction pill, a floor compass and first-visit tips.',
        principle: 'Visibility of system status',
      },
      {
        title: 'Resume',
        feedback: 'It needs to be fully viewable, no scroll.',
        diagnosis: 'A PDF viewer added chrome and forced scrolling for a single page.',
        change: 'Render the page to fit the screen, with its links still live.',
        principle: 'Minimize interaction cost',
        metric: '0 scrolling · 11 live links',
      },
    ],
  },

  /* Under the hood: how this site is put together */
  architecture: {
    intro: 'The same thinking applies to the code. Click a part to see what it does and why.',
    nodes: [
      { id: 'data', label: 'portfolioData.js', sub: 'all content, one file', x: 100, y: 80, description: 'Every word, link and exhibit lives in one file, so updating the portfolio never means touching rendering code.' },
      { id: 'input', label: 'Input', sub: 'keys · clicks · touch', x: 100, y: 280, description: 'Keyboard, click-to-walk and a touch joystick all feed one movement intent, so every input method behaves the same way.' },
      { id: 'hud', label: 'HUD & guide', sub: 'status · wayfinding', x: 320, y: 80, description: 'The top bar, mini-map, direction pill and coach keep visitors oriented: where they are, where to go, what they have seen.' },
      { id: 'controller', label: 'Controller', sub: 'screen-relative · collisions', x: 320, y: 280, description: 'Maps input to screen directions, slides along furniture, and stops within a tenth of a second when input ends.' },
      { id: 'modals', label: 'Exhibits', sub: 'accessible dialogs', x: 540, y: 80, description: 'Each exhibit opens as a focus-trapped dialog with Esc to close and a deep link (#resume, #paper …).' },
      { id: 'camera', label: 'Follow camera', sub: 'holds angle · right-drag', x: 540, y: 280, description: 'Tracks the figure without spinning, frames a painting once on arrival, and hands control to the visitor on right-drag.' },
      { id: 'pdf', label: 'pdf.js', sub: 'loaded on demand', x: 760, y: 80, description: 'The resume renderer is a separate chunk that only downloads when the Resume exhibit opens, so the 3D scene never pays for it.' },
      { id: 'scene', label: 'Scene', sub: 'merged · baked shadows', x: 760, y: 280, description: 'Static furniture is merged into a handful of meshes and shadows are rendered once, because nothing that casts them moves.' },
      { id: 'renderer', label: 'Renderer', sub: 'adaptive resolution', x: 900, y: 180, description: 'Watches the frame rate and trades a little resolution for smoothness when a device struggles, then climbs back.' },
    ],
    edges: [
      { from: 'data', to: 'hud' },
      { from: 'data', to: 'modals' },
      { from: 'hud', to: 'modals' },
      { from: 'input', to: 'controller' },
      { from: 'controller', to: 'hud', kind: 'async' },
      { from: 'controller', to: 'camera' },
      { from: 'modals', to: 'pdf', kind: 'async' },
      { from: 'camera', to: 'renderer' },
      { from: 'scene', to: 'renderer' },
    ],
  },
};
