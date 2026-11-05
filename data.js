/* The site's content, in plain arrays. Edit here; every page renders from these.

   Link syntax inside text fields:  [label](url)
     url may start with  pdf:   → assets/pdfs/<file>      e.g. [slides](pdf:EAS_4U1538.pdf)
                         page:  → a page of this site          e.g. [research](page:research.html#talks)
     anything else is used as-is (https://…, CygX2/, …). */
(() => {
const PDF = 'assets/pdfs/';
const ADS = 'https://ui.adsabs.harvard.edu/search/q=orcid%3A0000-0001-6894-871X&sort=date%20desc%2C%20bibcode%20desc&p_=0';

window.SITE = {
  PDF, ADS,
  ORCID: '0000-0001-6894-871X',
  CV: PDF + 'CV_Loktev.pdf',
  GITHUB: 'https://github.com/belliavesha',
  TELEGRAM: 'https://telegram.me/belliavesha',
  OFFICE: 'Room 207, Boční II 1401/1, Astronomical Institute of the Czech Academy of Sciences',

  /* ---------- the menu (dock) — one entry per page; menu: false keeps a page out of the menu (still reachable by `cd` and links) ---------- */
  nav: [
    { key: 'home',     href: 'index.html',    label: 'home',     note: 'the lake' },
    { key: 'research', href: 'research.html', label: 'research', note: 'papers · talks · plates' },
    { key: 'about',    href: 'about.html',    label: 'about',    note: 'bio · contact' },
    { key: 'merits',   href: 'merits.html',   label: 'merits',   note: 'the certificate wall', menu: false }   // for now: the command line, direct links and the cabin door
  ],
  /* ---------- the "explorers" group in the menu ---------- */
  explorers: [
    { key: 'cygx2',   href: 'CygX2/',            title: 'Cyg X-2 spectral-state explorer', short: 'Cyg X-2',       blurb: 'Z-source? Atoll? Why not a snail, or a swan?' },
    { key: 'collatz', href: 'collatztree/',      title: 'Collatz tree visualizer',         short: 'Collatz tree',  blurb: 'Trees built from generalized Collatz rules.' },
    { key: 'mandelburger', href: 'mandelburger/', title: 'Mandelburger: a parameter-plane explorer', short: 'Mandelburger', blurb: 'A Mandelbrot set for f(θ + T) = F(f(θ), θ).' },
  ],

  /* ---------- "psst — have a look": the note on the birch (and `fortune`) ---------- */
  psst: [
    { text: '4U 1538-52: an X-ray pulsar whose polarization angle won\'t behave. See [the paper](pdf:2025_AA_Loktev_4U1538.pdf) or the [talk at EAS 2025](pdf:EAS_4U1538.pdf).' },
    { text: 'Ray-tracing a Kerr black hole\'s disc, minus the ray-tracing part: [<span class="sc">artpol</span> paper](pdf:2023_Loktev_ARTPOL.pdf) and [the Mondragone slides about it](pdf:Mondragone2022Loktev.pdf)'},
    { text: 'Simple formulae to build an image of an accretion flow in the Schwarzschild metric: see the appendix of [my paper](pdf:2022_AA_Loktev_Pol_Schwarzschild.pdf).' },
    { text: 'Spin a neutron star fast enough and it squashes. [Here\'s what that does to its polarized light](pdf:2020_AA_Loktev_oblate_pol.pdf).' },
    { text: 'Spin a pulsar to see how [the magnetosphere guides the polarization of the light passing through it](page:research.html#plate3), or [how, in observations, it absolutely doesn\'t](pdf:EAS_4U1538.pdf).' },
    { text: '[Slides from Cork (EAS 2025)](pdf:EAS_WMNS.pdf), on modelling the polarization of accreting millisecond pulsars.' },
    { text: '[Slides from EXACTUS 2024](pdf:Loktev_EXACTUS.pdf): a whole PhD in one short talk, for exact-science students.' },
    { text: '[The award-winning poster](pdf:HEPROVIII_poster.pdf): plasma turbulence that survives fast synchrotron cooling.' },
    { text: '[Slides from Český Krumlov](pdf:LoktevBohemianWorkshop.pdf): fast polarimetry of discs around Kerr black holes.' },
    { text: 'Lunchtime at the Flatiron: [what polarized X-rays say about Cyg X-1](https://youtu.be/q4jBUg_biYk) (recording).' },
    { text: 'An improvised COSPAR talk on millisecond pulsars, [recorded, stand-in and all](https://youtu.be/Af5i6FJOBj0).' },
    { text: '[See all the talks](page:research.html#talks).' },
    { text: 'Everything on two pages, more or less: [my CV](pdf:CV_Loktev.pdf).' },
    { text: 'Trace the Z-track of Cyg X-2 with a draggable swan, or a snail. [The state explorer](CygX2/) has cygnets too.' },
    { text: '[Grow your own Collatz tree, with rules of your choosing](collatztree/).' },
    { text: 'For which parameters does f(θ + T) = F(f(θ), θ) have a smooth solution? [A Mandelbrot set for functional equations.](mandelburger/).' },
    { text: 'See [my publications on ADS](' + ADS + ').' },
    { text: 'Code, experiments and odd little tools on [my GitHub](https://github.com/belliavesha).' },
    { text: 'A beats B, B beats C, C beats A. [A note on the best intransitive dice](pdf:Random_variable_regular_tournaments.pdf).' },
    { text: '[Turn a black hole\'s spin up to 0.8 and watch its disc change.](page:research.html#plate2).' },
    { text: 'Does a $50 giveaway sound too good to be true? It is. [Just fill in the form on my about-me page](page:about.html#contact).' }
  ],

  /* ---------- Research, chapter I ---------- */
  interests: {
    lede: 'Broadly: black hole and neutron star X-ray binaries. I try to bridge what we observe with what our models predict. My tools:',
    pillars: [
      { title: 'Radiative transfer and Comptonization', text: 'in hot atmospheres and flows around compact objects.' },
      { title: 'Magnetized plasma turbulence', text: 'in relativistic plasma, simulated numerically.' },
      { title: 'Ray-tracing of polarized X-rays', text: 'around black holes and neutron stars, analytical and numerical.' }
    ],
    now: 'Since October 2026 I have been a postdoc at the [Astronomical Institute of the Czech Academy of Sciences](https://astro.cas.cz/), working with [Michal Dovčiak](https://astro.cas.cz/people/michal-dovciak) on the spectro-polarimetric and timing properties of X-ray binaries and their connection to relativistic plasma physics. I am an active member of [Working Group 4](https://expand-plasma.eu/wg4.html) of the EXPAND COST Action.'
  },

  /* ---------- selected papers (newest first; the order here is the order on the page) ---------- */
  papers: [
    { year: 2025, title: 'Exploring polarization and geometry in the X-ray pulsar 4U 1538-52',
      authors: 'V. Loktev, S. V. Forsblom, S. S. Tsygankov, J. Poutanen, A. A. Mushtukov, et al.', venue: 'A&A 698, A22',
      pdf: '2025_AA_Loktev_4U1538.pdf', ads: 'https://ui.adsabs.harvard.edu/abs/2025A%26A...698A..22L/abstract', plate: 'III' },
    { year: 2024, title: '<span class="sc">artpol</span>: Analytical ray-tracing method for spectro-polarimetric properties of accretion disks around Kerr black holes',
      authors: 'V. Loktev, A. Veledina, J. Poutanen, J. Nättilä, V. F. Suleimanov', venue: 'A&A 685, A84',
      pdf: '2023_Loktev_ARTPOL.pdf', ads: 'https://ui.adsabs.harvard.edu/abs/2024A%26A...685A..84L/abstract', plate: 'II' },
    { year: 2023, title: 'Polarized radiation from an accretion shock in accreting millisecond pulsars using exact Compton scattering formalism',
      authors: 'A. Bobrikova, V. Loktev, T. Salmi, J. Poutanen', venue: 'A&A 678, A99',
      pdf: '2023_AA_Bobrikova_AMSP_Compton.pdf', ads: 'https://ui.adsabs.harvard.edu/abs/2023A%26A...678A..99B/abstract' },
    { year: 2022, title: 'Analytical techniques for polarimetric imaging of accretion flows in the Schwarzschild metric',
      authors: 'V. Loktev, A. Veledina, J. Poutanen', venue: 'A&A 660, A25',
      pdf: '2022_AA_Loktev_Pol_Schwarzschild.pdf', ads: 'https://ui.adsabs.harvard.edu/abs/2022A%26A...660A..25L/abstract', plate: 'II' },
    { year: 2020, title: 'Oblate Schwarzschild approximation for polarized radiation from rapidly rotating neutron stars',
      authors: 'V. Loktev, T. Salmi, J. Nättilä, J. Poutanen', venue: 'A&A 643, A84',
      pdf: '2020_AA_Loktev_oblate_pol.pdf', ads: 'https://ui.adsabs.harvard.edu/abs/2020A%26A...643A..84L/abstract' },
    { year: 2025, title: 'Optimal intransitive dice sets for regular tournaments',
      authors: 'V. Loktev', venue: 'a note', pdf: 'Random_variable_regular_tournaments.pdf' }
  ],

  /* ---------- talks & posters (newest first) ---------- */
  talks: [
    { date: 'June 2025', title: 'Exploring polarization and geometry in the X-ray pulsar 4U 1538-52', kind: 'contributed talk',
      venue: 'EAS 2025, Cork, Ireland · 23–27 June', summary: 'the latest IXPE results, a polarization angle that behaves unusually across energy bands, and what that means for the geometry.',
      material: { label: 'slides', url: 'pdf:EAS_4U1538.pdf' } },
    { date: 'June 2025', title: 'Theoretical approaches to modeling the polarization from accreting millisecond pulsars', kind: 'contributed talk',
      venue: 'EAS 2025, Cork, Ireland · 23–27 June', material: { label: 'slides', url: 'pdf:EAS_WMNS.pdf' } },
    { date: 'May 2024', title: 'A spectro-polarimetric view into accretion plasma physics', kind: 'talk',
      venue: 'EXACTUS Seminar Day, Turku · 24 May', summary: 'a short overview of my PhD for exact-science students.',
      material: { label: 'slides', url: 'pdf:Loktev_EXACTUS.pdf' } },
    { date: 'Oct 2023', title: 'Magnetically-dominated plasma turbulence in the rapid synchrotron-cooling regime', kind: 'poster',
      venue: 'HEPRO VIII, Paris · 29–31 Oct', summary: 'turbulence is not suppressed when cooling beats the plasma timescales and it keeps accelerating particles.',
      material: { label: 'poster', url: 'pdf:HEPROVIII_poster.pdf' }, award: 'one of the three best posters' },
    { date: 'Aug 2023', title: 'Efficient polarimetric analysis of accretion disks around Kerr black holes', kind: 'talk',
      venue: 'South Bohemian X-ray polarisation workshop, Český Krumlov · 29–31 Aug', material: { label: 'slides', url: 'pdf:LoktevBohemianWorkshop.pdf' } },
    { date: 'June 2023', title: 'Polarized X-rays constrain the geometry in black hole X-ray binaries', kind: 'lunch talk',
      venue: 'Center for Computational Astrophysics, Flatiron Institute · 8 June', summary: 'Cyg X-1 in particular.',
      material: { label: 'recording', url: 'https://youtu.be/q4jBUg_biYk' } },
    { date: 'July 2022', title: 'Obtaining neutron star parameters from X-ray polarimetric data on accreting millisecond pulsars', kind: 'talk',
      venue: '44th COSPAR Scientific Assembly, Athens · 16–24 July', summary: 'improvised, standing in for Anna Bobrikova.',
      material: { label: 'recording', url: 'https://youtu.be/Af5i6FJOBj0' } },
    { date: 'July 2022', title: 'Fast track: polarimetric images of black hole accretion disks', kind: 'talk',
      venue: '44th COSPAR Scientific Assembly, Athens · 16–24 July' },
    { date: 'May 2022', title: 'Fast polarimetric imaging of Kerr black holes using a Schwarzschild approximation', kind: 'talk',
      venue: '1st Mondragone Frontiers of Astronomy Series · 20 May', material: { label: 'slides', url: 'pdf:Mondragone2022Loktev.pdf' } }
  ],

  /* ---------- the career path (newest first). Research shows `place` + `text` as a table; About shows `city` + `short` + `brief` as “the route” ---------- */
  path: [
    { when: 'from Oct 2026', short: '2026 –', place: 'Astronomical Institute, Czech Academy of Sciences', city: 'Prague, Czechia', now: true,
      brief: 'here and now: see above.',
      text: 'Postdoc with [Michal Dovčiak](https://astro.cas.cz/people/michal-dovciak) - spectro-polarimetric and timing properties of X-ray binaries and the plasma physics underneath.' },
    { when: '2025–2026', short: '2025 – 26', place: 'Newcastle University (& Durham)', city: 'Newcastle, UK',
      brief: 'independent guest postdoc with [Adam Ingram](https://adingram.bitbucket.io/) on [X-MAPS](https://adingram.bitbucket.io/xmaps.html): the timing of black hole binaries; a research-abroad grant of the Finnish Academy of Science and Letters.',
      text: 'Independent guest postdoc with [Adam Ingram](https://adingram.bitbucket.io/) on the [X-MAPS](https://adingram.bitbucket.io/xmaps.html) project: timing of black hole X-ray binaries. Funded by a research-abroad grant of the Finnish Academy of Science and Letters.' },
    { when: '2024–2025', short: '2024 – 25', place: 'University of Helsinki', city: 'Helsinki, Finland',
      brief: 'non-military (civilian) service in [Joonas Nättilä\'s plasma group](https://natj.github.io/group/) at the [University of Helsinki](https://www.helsinki.fi/en/about-us/people/people-finder/vladislav-loktev-9496333): ILLUMINATOR and the code <i>runko</i>.',
      text: 'Non-military (civilian) service in Joonas Nättilä\'s [Computational Plasma Astrophysics group](https://natj.github.io/group/): the ILLUMINATOR project, developing the simulation code <i>runko</i>.' },
    { when: '2023', short: '2023', place: 'Flatiron Institute, New York', city: 'New York City, US',
      brief: 'predoctoral fellow at the [CCA, Flatiron Institute](https://www.simonsfoundation.org/flatiron/center-for-computational-astrophysics/stars-and-plasma-astrophysics/): relativistic plasma and turbulence.',
      text: 'Predoctoral fellow at the [Center for Computational Astrophysics](https://www.simonsfoundation.org/flatiron/center-for-computational-astrophysics/stars-and-plasma-astrophysics/) with [Joonas Nättilä](https://natj.github.io/) and [Vladimir Zhdankin](https://zhdankin.physics.wisc.edu/): relativistic plasma physics and turbulence.' },
    { when: '2018–2025', short: '2018 – 25', place: 'University of Turku', city: 'Turku, Finland',
      brief: 'PhD in the [High Energy Astrophysics group](https://sites.utu.fi/hea/), University of Turku, with Alexandra Veledina and Juri Poutanen: X-ray polarimetry and IXPE.',
      text: 'PhD in the [High Energy Astrophysics group](https://sites.utu.fi/hea/), supervised by [Alexandra Veledina](https://www.utu.fi/en/people/alexandra-veledina) and [Juri Poutanen](https://users.utu.fi/jurpou/): X-ray polarimetry and observations with NASA\'s [IXPE](https://ixpe.msfc.nasa.gov/).' },
    { when: '2013–2018', short: '2013 – 18', place: 'Saint Petersburg University', city: 'Saint Petersburg, Russia',
      brief: 'master\'s in astronomy, Saint Petersburg University.',
      text: 'Master\'s in astronomy.' }
  ],

  /* ---------- Research → the path: a view of each city on the way, engraved in the About page's two inks (peach & ink-blue).
     Laid out in two columns, top to bottom: col 0 then col 1. ar = width/height of the crop; fx, fy = the crop's focus (0–1);
     tone = gamma on the engraving (<1 lighter, >1 darker); city = the city exactly as it is written in `path` above. ---------- */
  views: [
    { col: 0, city: 'New York City, US', name: 'New York', year: '2023', src: 'assets/images/cities/new-york.jpg', ar: 3 / 4, fx: 0.5, fy: 0.4, tone: 0.8,
      alt: 'One World Trade Center and the Gehry tower behind a stone tower of the Brooklyn Bridge; a tiny pink flamingo sits on a railing post.' },
    { col: 1, city: 'Newcastle, UK', name: 'Newcastle', year: '2025 – 26', src: 'assets/images/cities/newcastle.jpg', ar: 4 / 3, fx: 0.5, fy: 0.3, tone: 0.8,
      alt: 'A train crossing the High Level Bridge over the Tyne in Newcastle, with the Swing Bridge, the Tyne Bridge and the Millennium Bridge behind it.' },
    { col: 0, city: 'Turku, Finland', name: 'Turku', year: '2018 – 25', src: 'assets/images/cities/turku.jpg', ar: 4 / 3, fx: 0.5, fy: 0.5, tone: 0.75,
      alt: 'Posankka, the giant pig-duck sculpture in Turku, sitting on a bed of frosted stones.' },
    { col: 1, city: 'Saint Petersburg, Russia', name: 'Saint Petersburg', year: '2013 – 18', src: 'assets/images/cities/saint-petersburg.jpg', ar: 3 / 4, fx: 0.38, fy: 0.5, tone: 0.65,
      alt: 'The Peter and Paul Fortress at night across the Neva, its cathedral spire lit gold.' }
  ],

  /* ---------- epigraphs on Research: each is legible only through the filter at its own angle ---------- */
  epigraphs: [
    { text: 'All black holes are alike; each neutron star is neutron in its own way.', revealAngle: 67, before: 'papers' },
    { text: 'An oblate, fast rotating, brightly flashing neutron star can be called an epilepsoid.', revealAngle: 151, before: 'talks' },
    { text: 'Astrophysicists are polarized on black hole spins. So, luckily, are the X-rays.', revealAngle: 23, before: 'interests' }
    // { text: 'The shortest path between two points in curved space-time went through Turku, New York, Helsinki and Newcastle.', revealAngle: 23, before: 'path' }
  ],


  /* ---------- About → contact: the tear-off tabs (the only place contacts are listed) ---------- */
  contacts: [
    { label: 'e-mail for all inquiries', user: 'loktev.astro', domain: 'gmail.com' },
    { label: 'e-mail for all other inquiries', user: 'belliavesha', domain: 'gmail.com' },
    { label: 'office e-mail', user: 'loktev', domain: 'asu.cas.cz' },
    { label: 'github', text: 'belliavesha', url: 'https://github.com/belliavesha' },
    { label: 'orcid', text: '0000-0001-6894-871X', url: 'https://orcid.org/0000-0001-6894-871X' },
    { label: 'telegram', text: '@belliavesha', url: 'https://telegram.me/belliavesha' },
  ],
  /* stubs of tabs someone already tore off — decorative, never links. `after` = index of the live tab it follows */
  torn: [
    { text: 'ewcastle.ac.uk', after: 1 },
    { text: 'tu.fi', after: 3 },
    { text: 'd.helsinki.fi', after: 3 },
    { text: 'latironinstitute.org', after: 3 }
  ],

  /* ---------- Merits: the framed certificates, in hanging order ---------- */
  merits: [
    { title: 'Doctoral degree', where: 'Faculty of Science, University of Turku', when: '2018–2025', pdf: 'PhDdegree.pdf',
      logo: 'UTU_logo.png', alt: 'University of Turku logo', frame: 'gilt', size: 'L' },
    { title: 'Pre-Doctoral Fellowship', where: 'CCA, Flatiron Institute, NYC', when: 'Jan–Jun 2023', pdf: 'CCA_certificate.pdf',
      logo: 'FI_logo.png', alt: 'Flatiron Institute logo', frame: 'walnut', size: 'M' },
    { title: 'One of the three best posters', where: 'HEPRO VIII, Paris', when: '29–31 Oct 2023', pdf: 'HEPRO_award.pdf',
      logo: 'HEPRO_VIII_logo.png', alt: 'HEPRO VIII logo', frame: 'black', size: 'S', badge: 'best<br>poster' },
    { title: 'Fundamentals of Deep Learning', where: 'NVIDIA DLI', when: '26 June 2023', pdf: 'Certificate_ML1.pdf',
      logo: 'NVIDIA_DLI_logo.png', alt: 'NVIDIA Deep Learning Institute logo', frame: 'birch', size: 'S' },
    { title: 'Data Parallelism: How to Train Deep Learning Models on Multiple GPUs', where: 'NVIDIA DLI', when: '27 June 2023', pdf: 'Certificate_ML_DATPAR.pdf',
      logo: 'NVIDIA_DLI_logo.png', alt: 'NVIDIA Deep Learning Institute logo', frame: 'birch', size: 'S' },
    { title: 'Finnish Language Qualification, Intermediate Level (YKI)', where: 'Paasikivi-opisto, Turku', when: '28 Aug 2021', pdf: 'YKItodistus.pdf',
      logo: 'YKI_logo.png', alt: 'YKI, the Finnish National Certificates of Language Proficiency, logo', frame: 'walnut', size: 'S' },
    { title: 'CSC Summer School in High-Performance Computing', where: 'Espoo', when: '15 June – 4 July 2019', pdf: 'CSCSSCC.pdf',
      logo: 'CSC_logo.png', alt: 'CSC – IT Center for Science logo', frame: 'black', size: 'S' },
    { title: 'Specialist degree in Astronomy', where: 'Saint Petersburg University', when: '2013–2018', pdf: 'Diploma1.pdf',
      logo: 'SPBU_logo.jpg', alt: 'Saint Petersburg University logo', frame: 'gilt', size: 'L' }
  ],

  /* ---------- `fortune` in the command line: proverbs and physics (the psst notes are mixed in too).
     [original, translation, lang]: lang of the original, 'fi' when left out ---------- */
  fortunes: [
    ['Hiljaa hyvä tulee.', 'Good things come slowly. (So do pikeperch.)'],
    ['Ei savua ilman tulta.', 'No smoke without fire. Check the chimney.'],
    ['Oma koti kullan kallis.', 'One\'s own home is dear as gold.'],
    ['', 'A polarization angle is an axis, not an arrow: it lives between 0° and 180°.'],
    ['', 'Sauna wisdom: after the löyly, the avanto. After the avanto, the löyly.'],
    ['', 'Hedgehogs, as everyone knows, carry apples home on their backs.'],
    ['', 'Apples, as everyone knows, grow on birch trees any time of the year.'],
    ['Без труда не вытащишь и рыбку из пруда.', 'Nothing comes without effort.', 'ru'],
    ['И рыбку съесть, и в воду не лезть.', 'He who would catch fish must not mind getting wet.', 'ru'],
    ['', 'All black holes are alike; each neutron star is neutron in its own way.'],
    ['', 'Zero is a positive emotion.'],
    ['', 'Finland does not actually exist and is merely a fishing coordinate reserved by the UN.'],
    ['', 'All non-black things are not ravens.'],
    ['', 'All models are wrong, but some of them are useful.'],
    ['', 'Socrates was mortal before God was dead.'],
    ['', 'Correlation does not imply causation. People do. Therefore, people are not correlation.'],
    ['', 'The Moon landing was staged on Mars.'],
    ['', 'This statement is false.']
    ['', 'Anything that can be written in JavaScript, will eventually be written in JavaScript'],
  ]
};

/* [label](url) → <a>; pdf: and page: shortcuts. Used by every page. */
window.SITE.md = function (s, opts = {}) {
  // the url may contain one level of balanced parentheses, e.g. a Wikipedia link
  return String(s).replace(/\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, (_, label, url) => {
    let href = url, ext = false;
    if (url.startsWith('pdf:')) { href = PDF + url.slice(4); ext = true; }
    else if (url.startsWith('page:')) href = url.slice(5);
    else if (/^https?:/.test(url)) ext = true;
    const tgt = ext && opts.newTab !== false ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${href.replace(/"/g, '&quot;')}"${tgt}>${label}</a>`;
  });
};
window.SITE.url = u => u.startsWith('pdf:') ? PDF + u.slice(4) : u.startsWith('page:') ? u.slice(5) : u;
})();
