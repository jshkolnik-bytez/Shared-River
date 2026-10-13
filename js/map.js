/*
 * Shared River — the top-down map (SVG).
 * Coordinates come from real longitude/latitude: x = (lon − 24) × 32, y = (32 − lat) × 32.
 */
(function (root) {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 576, H = 832;

  const SHAPES = {
    med: 'M0,0 L349,0 L330,19 L314,28 L266,22 L250,16 L205,17 L176,26 L0,13 Z',
    redSea: 'M273,65 L300,140 L307,154 L368,256 L426,352 L422,400 L467,448 L502,528 L560,592 L576,605 L576,512 L548,448 L480,336 L448,288 L416,224 L378,160 L349,80 L330,138 L280,72 Z',
    egypt: 'M32,15 L176,26 L205,17 L250,16 L266,22 L314,28 L330,19 L349,80 L330,138 L280,72 L273,65 L300,140 L307,154 L368,256 L405,320 L32,320 Z',
    sudan: 'M0,320 L405,320 L426,352 L422,400 L467,448 L440,470 L416,480 L397,566 L381,621 L371,640 L347,660 L330,685 L323,720 L288,698 L240,682 L176,717 L112,723 L0,704 Z',
    ethiopia: 'M397,566 L440,575 L470,560 L512,560 L545,590 L576,612 L576,832 L352,832 L330,800 L336,760 L323,720 L330,685 L347,660 L371,640 L381,621 Z',
  };

  const RIVERS = {
    blueUp: 'M428,650 C440,660 458,680 452,695 C446,708 420,710 403,701 C390,694 372,676 355,665',
    blueDown: 'M355,665 C345,660 338,652 332,646 C320,625 308,605 307,590 C306,578 306,570 304,563 C295,548 282,535 273,525',
    nileSudan: 'M273,525 C290,505 310,480 319,455 C322,430 312,410 299,399 C285,410 262,440 243,442 C228,440 210,425 205,405 C200,380 215,350 235,326',
    nileEgypt: 'M285,253 C283,230 278,215 276,202 C278,190 270,180 255,165 C232,150 218,130 216,120 C222,100 230,80 232,63',
    white: 'M240,832 C245,790 248,740 245,719 C255,680 275,630 277,602 C278,570 276,545 273,525',
    atbara: 'M432,598 C420,585 405,580 400,576 C380,540 340,480 319,458',
    reservoir: 'M355,665 C372,676 390,694 403,701 C420,710 446,708 452,695',
    nasser: 'M235,326 C245,310 255,295 262,285 C270,272 278,262 285,253',
  };

  const PLACES = [
    { id: 'cairo', name: 'Cairo', x: 232, y: 63, lx: 240, ly: 70, anchor: 'start' },
    { id: 'aswan', name: 'Aswan High Dam', x: 285, y: 253, lx: 293, ly: 250, anchor: 'start' },
    { id: 'khartoum', name: 'Khartoum', x: 273, y: 525, lx: 264, ly: 522, anchor: 'end' },
    { id: 'roseires', name: 'Roseires Dam', x: 332, y: 646, lx: 324, ly: 652, anchor: 'end' },
    { id: 'gerd', name: 'GERD', x: 355, y: 665, lx: 352, ly: 688, anchor: 'end', big: true },
    { id: 'tana', name: 'Lake Tana', x: 425, y: 638, lx: 440, ly: 630, anchor: 'start' },
    { id: 'addis', name: 'Addis Ababa', x: 472, y: 735, lx: 480, ly: 739, anchor: 'start' },
  ];

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  // Point-in-polygon for scattering Ethiopia's town lights.
  function polyPoints(d) {
    return d.replace(/[MZ]/g, '').trim().split(/\s*L\s*/).map((p) => p.split(',').map(Number));
  }
  function inside(pt, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  const refs = {};
  const widthFor = (flow) => Math.max(1.5, Math.min(13, flow / 6.5));

  function pill(parent, cls) {
    const g = el('g', { class: `map-pill ${cls}` }, parent);
    const r = el('rect', { rx: 9, ry: 9, height: 18 }, g);
    const t = el('text', { 'dominant-baseline': 'central', y: 9 }, g);
    return { g, r, t };
  }
  function setPill(p, x, y, text, tone) {
    p.t.textContent = text;
    const w = Math.round(text.length * 6.1 + 16);
    p.r.setAttribute('width', w);
    p.t.setAttribute('x', 8);
    p.g.setAttribute('transform', `translate(${x},${y})`);
    p.g.dataset.tone = tone || '';
  }

  const RiverMap = {
    build(container, opts = {}) {
      container.innerHTML = '';
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'river-map', role: 'img', 'aria-label': 'Map of the Blue Nile from Lake Tana in Ethiopia, past the GERD, Roseires and Khartoum in Sudan, to Lake Nasser and Cairo in Egypt' });
      container.appendChild(svg);
      const defs = el('defs', {}, svg);
      const glow = el('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
      el('feGaussianBlur', { stdDeviation: 2.4, result: 'b' }, glow);
      const merge = el('feMerge', {}, glow);
      el('feMergeNode', { in: 'b' }, merge);
      el('feMergeNode', { in: 'SourceGraphic' }, merge);
      const lightGlow = el('filter', { id: 'lightGlow', x: '-200%', y: '-200%', width: '500%', height: '500%' }, defs);
      el('feGaussianBlur', { stdDeviation: 1.6 }, lightGlow);
      const hatch = el('pattern', { id: 'grid', width: 24, height: 24, patternUnits: 'userSpaceOnUse' }, defs);
      el('path', { d: 'M24 0 L0 0 0 24', fill: 'none', class: 'map-gridline' }, hatch);

      // Land, seas, countries
      el('rect', { x: 0, y: 0, width: W, height: H, class: 'map-land' }, svg);
      el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#grid)' }, svg);
      el('path', { d: SHAPES.med, class: 'map-sea' }, svg);
      el('path', { d: SHAPES.redSea, class: 'map-sea' }, svg);
      refs.country = {};
      ['egypt', 'sudan', 'ethiopia'].forEach((id) => {
        refs.country[id] = el('path', { d: SHAPES[id], class: `map-country c-${id}` }, svg);
      });

      // Sea and neighbour labels
      const lab = (x, y, text, cls, rot) => {
        const t = el('text', { x, y, class: cls, 'text-anchor': 'middle' }, svg);
        if (rot) t.setAttribute('transform', `rotate(${rot} ${x} ${y})`);
        t.textContent = text;
        return t;
      };
      lab(110, 8, 'MEDITERRANEAN SEA', 'map-sea-label');
      lab(430, 330, 'RED SEA', 'map-sea-label', 58);
      lab(150, 790, 'SOUTH SUDAN', 'map-neighbour');
      lab(470, 500, 'ERITREA', 'map-neighbour');
      lab(500, 200, 'SAUDI ARABIA', 'map-neighbour');
      refs.label = {
        egypt: lab(140, 200, 'EGYPT', 'map-country-label l-egypt'),
        sudan: lab(130, 470, 'SUDAN', 'map-country-label l-sudan'),
        ethiopia: lab(505, 800, 'ETHIOPIA', 'map-country-label l-ethiopia'),
      };

      // Farmland: Nile valley, delta, Gezira fields
      refs.valley = el('path', { d: RIVERS.nileEgypt, class: 'map-valley' }, svg);
      refs.delta = el('path', { d: 'M232,63 L198,21 L264,19 Z', class: 'map-delta' }, svg);
      refs.fields = [];
      [282, 289, 296].forEach((x) => [570, 577, 584, 591].forEach((y) => {
        refs.fields.push(el('rect', { x, y, width: 5, height: 5, rx: 1, class: 'map-field' }, svg));
      }));

      // Town lights in Ethiopia
      const poly = polyPoints(SHAPES.ethiopia);
      refs.lights = [];
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      while (refs.lights.length < 46) {
        const pt = [350 + rnd() * 226, 600 + rnd() * 232];
        if (!inside(pt, poly)) continue;
        if (Math.hypot(pt[0] - 425, pt[1] - 638) < 18) continue;
        refs.lights.push(el('circle', { cx: pt[0].toFixed(1), cy: pt[1].toFixed(1), r: 1.7, class: 'map-light' }, svg));
      }

      // Lakes
      el('ellipse', { cx: 425, cy: 638, rx: 12, ry: 14, class: 'map-lake' }, svg);
      refs.nasser = el('path', { d: RIVERS.nasser, class: 'map-lake-stroke' }, svg);
      refs.reservoir = el('path', { d: RIVERS.reservoir, class: 'map-reservoir' }, svg);
      refs.reservoirLen = refs.reservoir.getTotalLength ? refs.reservoir.getTotalLength() : 120;

      // Rivers (base + animated flow on top)
      refs.river = {};
      const river = (key, cls) => {
        const base = el('path', { d: RIVERS[key], class: `map-river ${cls || ''}` }, svg);
        const flow = el('path', { d: RIVERS[key], class: 'map-flow' }, svg);
        refs.river[key] = { base, flow };
      };
      river('white', 'minor');
      river('atbara', 'minor');
      river('blueUp');
      river('blueDown');
      river('nileSudan');
      river('nileEgypt');
      el('path', { d: 'M232,63 L205,20 M232,63 L250,17 M232,63 L228,20', class: 'map-river minor delta-arms' }, svg);

      // Dams
      const wall = (x1, y1, x2, y2, cls) => el('line', { x1, y1, x2, y2, class: `map-dam ${cls || ''}` }, svg);
      wall(281, 249, 289, 257, 'small');
      wall(328, 652, 337, 641, 'small');
      refs.gerdBase = wall(349.6, 672.2, 360.4, 657.8, 'gerd-base');
      refs.gerd = wall(349.6, 672.2, 360.4, 657.8, 'gerd');

      // Event markers
      refs.flood = el('g', { class: 'map-marker flood', transform: 'translate(300,575)' }, svg);
      el('circle', { r: 26, class: 'pulse' }, refs.flood);
      el('circle', { r: 14, class: 'core' }, refs.flood);
      const ft = el('text', { y: 4, 'text-anchor': 'middle' }, refs.flood);
      ft.textContent = 'FLOOD';
      refs.short = el('g', { class: 'map-marker short', transform: 'translate(232,63)' }, svg);
      el('circle', { r: 24, class: 'pulse' }, refs.short);
      refs.shortText = el('text', { y: -30, 'text-anchor': 'middle' }, refs.short);

      // Places
      PLACES.forEach((p) => {
        el('circle', { cx: p.x, cy: p.y, r: p.big ? 4.5 : 3, class: `map-place ${p.big ? 'big' : ''}` }, svg);
        const t = el('text', { x: p.lx, y: p.ly, 'text-anchor': p.anchor, class: `map-place-label ${p.big ? 'big' : ''}` }, svg);
        t.textContent = p.name;
      });
      refs.whiteLabel = el('text', { x: 236, y: 650, class: 'map-minor-label', 'text-anchor': 'end' }, svg);
      refs.whiteLabel.textContent = 'White Nile';
      const at = el('text', { x: 382, y: 532, class: 'map-minor-label', 'text-anchor': 'start' }, svg);
      at.textContent = 'Atbara';
      const bn = el('text', { x: 470, y: 676, class: 'map-minor-label blue', 'text-anchor': 'start' }, svg);
      bn.textContent = 'Blue Nile';

      // Number pills
      refs.pills = {
        inflow: pill(svg, 'inflow'),
        release: pill(svg, 'release'),
        other: pill(svg, 'other'),
        egypt: pill(svg, 'egypt'),
        lake: pill(svg, 'lake'),
        nasser: pill(svg, 'nasser'),
      };

      // Click the dam for facts
      const hit = el('circle', { cx: 355, cy: 665, r: 18, class: 'map-hit', tabindex: 0, role: 'button', 'aria-label': 'About the GERD' }, svg);
      if (opts.onDamClick) {
        hit.addEventListener('click', opts.onDamClick);
        hit.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onDamClick(); } });
      }
      refs.svg = svg;
      return svg;
    },

    update(v) {
      if (!refs.svg) return;
      const setW = (key, flow) => {
        const w = widthFor(flow);
        refs.river[key].base.style.strokeWidth = w;
        refs.river[key].flow.style.strokeWidth = Math.max(0.8, w * 0.35);
        refs.river[key].flow.style.animationDuration = `${Math.max(0.6, 2.4 - flow / 40)}s`;
      };
      setW('blueUp', v.inflow);
      setW('blueDown', v.release);
      setW('nileSudan', v.toEgypt);
      setW('nileEgypt', v.egyptGets);
      setW('white', 26);
      setW('atbara', 12);
      refs.river.blueDown.base.classList.toggle('unknown', !v.known);
      refs.river.nileSudan.base.classList.toggle('unknown', !v.known);
      refs.river.nileEgypt.base.classList.toggle('unknown', !v.known);

      // Reservoir grows upstream and wider as it fills
      const frac = Math.max(0, Math.min(1, v.reservoir / 74));
      const L = refs.reservoirLen;
      refs.reservoir.style.strokeDasharray = `${(L * frac).toFixed(1)} ${L.toFixed(1)}`;
      refs.reservoir.style.strokeWidth = 4 + frac * 20;
      refs.reservoir.style.opacity = frac > 0 ? 1 : 0;

      // Dam wall rises with construction
      const gl = 18;
      refs.gerd.style.strokeDasharray = `${(gl * Math.min(1, v.construction / 100)).toFixed(1)} ${gl}`;

      // Lake Nasser
      refs.nasser.style.strokeWidth = 3 + (v.reserve / 40) * 9;

      // Farmland and lights
      const tone = (n) => Math.max(0.15, Math.min(1, n / 100));
      refs.delta.style.opacity = 0.25 + 0.65 * tone(v.egyptNeeds);
      refs.valley.style.opacity = 0.15 + 0.5 * tone(v.egyptNeeds);
      refs.fields.forEach((f, i) => f.classList.toggle('dry', v.sudanShort || (i * 8 > v.sudanNeeds)));
      const lit = Math.round((refs.lights.length * (v.lightsOn - 40)) / 60);
      refs.lights.forEach((l, i) => l.classList.toggle('on', i < lit));

      // Markers
      refs.flood.classList.toggle('show', !!v.flood);
      refs.short.classList.toggle('show', v.egyptShort > 0);
      refs.shortText.textContent = v.egyptShort > 0 ? `SHORT ${v.egyptShort}` : '';

      // Highlight player's country
      ['egypt', 'sudan', 'ethiopia'].forEach((id) => {
        refs.country[id].classList.toggle('player', id === v.player);
        refs.label[id].classList.toggle('player', id === v.player);
      });

      // Number pills
      const P = refs.pills;
      setPill(P.inflow, 462, 700, `Rain in: ${v.inflow}`);
      setPill(P.release, 338, 600, v.known ? `Released: ${v.release}` : 'Released: ?', v.flood ? 'bad' : '');
      setPill(P.other, 150, 600, '+35 other rivers', 'muted');
      setPill(P.egypt, 296, 196, v.known ? `To Egypt: ${v.toEgypt} / ${v.egyptNeed}` : `To Egypt: ? / ${v.egyptNeed}`, v.known && v.toEgypt < v.egyptNeed ? 'bad' : v.known ? 'good' : '');
      setPill(P.lake, 236, 744, `GERD lake: ${Math.round(v.reservoir)} / 74`, 'lake');
      setPill(P.nasser, 120, 280, `Lake Nasser: ${Math.round(v.reserve)}`, 'lake');
      P.lake.g.style.opacity = v.damOn ? 1 : 0.55;
      if (!v.damOn) setPill(P.lake, 236, 744, `Dam wall: ${Math.round(v.construction)}%`, 'lake');
    },
  };

  root.RiverMap = RiverMap;
})(window);
