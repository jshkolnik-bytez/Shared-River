/*
 * Shared River — screens and interaction.
 * Reads and changes the game only through Engine; draws with RiverMap.
 */
(function () {
  const E = window.Engine;
  const C = window.CONTENT;
  const CFG = window.CONFIG;
  const { COUNTRIES, ORDER, RAIN, EVENTS, LEVELS, WATER_OPTIONS, DIPLOMACY_OPTIONS, MEDIATORS, ENDINGS } = C;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const SAVE_KEY = 'sharedRiver.save.v1';

  let game = null;
  let sel = { water: null, diplomacy: null };
  let mapBuilt = false;
  let showDeltas = false;

  // ---------- small helpers ----------
  const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0');
  const arrow = (n) => (n > 0 ? '▲' : n < 0 ? '▼' : '•');
  const toneOf = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat');
  const yearText = (label) => (typeof label === 'number' ? String(label) : label);
  const cName = (id) => COUNTRIES[id].name;
  const levelRange = (lv) => (typeof lv.years[0] === 'number' ? `${lv.years[0]}–${lv.years[lv.years.length - 1]}` : 'A future decade');

  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch (e) { /* storage blocked */ } }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      return s && s.v === 1 && s.player ? s : null;
    } catch (e) { return null; }
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${id}`));
    window.scrollTo(0, 0);
    if (id === 'title') $('[data-action="continue"]').hidden = !loadSave();
  }

  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------- modal ----------
  function openModal(html, opts = {}) {
    const m = $('#modal');
    const card = $('.modal-card', m);
    card.className = `modal-card${opts.wide ? ' wide' : ''}${opts.cls ? ' ' + opts.cls : ''}`;
    card.onkeydown = null;
    card.innerHTML = html;
    m.hidden = false;
    m.dataset.dismissable = opts.dismissable === false ? '' : '1';
    requestAnimationFrame(() => m.classList.add('open'));
    card.scrollTop = 0;
    card.focus({ preventScroll: true });
    return card;
  }
  function closeModal() {
    const m = $('#modal');
    m.classList.remove('open');
    m.hidden = true;
    $('.modal-card', m).innerHTML = '';
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal').hidden && $('#modal').dataset.dismissable) closeModal();
  });
  $('.modal-backdrop').addEventListener('click', () => { if ($('#modal').dataset.dismissable) closeModal(); });

  // ---------- global buttons ----------
  const actions = {
    play() { renderChoose(); show('choose'); },
    continue() { resume(); },
    title() { closeModal(); show('title'); },
    how() { if (game && !game.over && $('#screen-game').classList.contains('active')) showRules(game.player, null); else howModal(); },
    sources() { sourcesModal(); },
    dam() { damModal(); },
    sound() { const on = Sound.toggle(); $('#btn-sound').textContent = on ? '🔊' : '🔇'; },
    menu() { menuModal(); },
    close() { closeModal(); },
  };
  document.addEventListener('click', (e) => {
    Sound.unlock();
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const fn = actions[b.dataset.action];
    if (fn) { Sound.click(); fn(b); }
  });

  // ---------- choose your country ----------
  function renderChoose() {
    $('#country-cards').innerHTML = ORDER.map((id) => {
      const c = COUNTRIES[id];
      return `
      <button class="country-card" style="--c:${c.color}" data-country="${id}">
        <span class="cc-pos">${c.position}</span>
        <h3>${c.name}</h3>
        <p class="cc-blurb">${c.blurb}</p>
        <dl>
          <dt>Wants</dt><dd>${c.wants}</dd>
          <dt>Worries about</dt><dd>${c.worries}</dd>
          <dt>Your goal</dt><dd><strong>${c.goal}</strong></dd>
        </dl>
        <span class="btn primary block">Play as ${c.name}</span>
      </button>`;
    }).join('');
    $$('.country-card').forEach((b) => b.addEventListener('click', () => { Sound.select(); startNew(b.dataset.country); }));
  }

  function startNew(country) {
    game = E.newGame(country);
    save();
    enterGame();
    showRules(country, showLevelIntro);
  }

  // ---------- rules walkthrough (after choosing a country) ----------
  function rulesSteps(country) {
    const c = COUNTRIES[country];
    const R = C.RULES[country];
    const chain = ORDER.map((id) => {
      const k = COUNTRIES[id];
      const sub = { ethiopia: 'Lake Tana · the GERD', sudan: 'Roseires Dam · Khartoum', egypt: 'Lake Nasser · Cairo' }[id];
      return `<div class="chain-item${id === country ? ' you' : ''}" style="--c:${k.color}"><span class="ci-pos">${k.position}</span><b>${k.name}</b><span class="ci-sub">${sub}</span>${id === country ? '<span class="ci-you">You</span>' : ''}</div>`;
    }).join('<span class="chain-arrow" aria-hidden="true">→</span>');
    const rainChips = ['wet', 'normal', 'dry', 'drought'].map((k) => `<span class="chip r-${k}">${RAIN[k].icon} ${RAIN[k].name} · ${CFG.rain[k]}</span>`).join('');
    const ex = (rainKey, storeKey) => {
      const rain = CFG.rain[rainKey], st = CFG.store[storeKey], flow = rain - st + CFG.otherRivers - CFG.sudanUse;
      const short = CFG.egyptNeed - flow;
      const verb = { fill_fast: 'fills fast', fill_steady: 'fills steady', pause: 'pauses filling' }[storeKey];
      const flood = rain - st >= CFG.floodThreshold ? ' · <span class="bad">Sudan floods</span>' : '';
      return `<div class="rx"><span class="rx-label">${RAIN[rainKey].name} year, Ethiopia ${verb}</span><span class="rx-sum">${rain} − ${st} + 35 − 18 = <b class="${short > 0 ? 'bad' : 'good'}">${flow}</b></span><span class="rx-out"><span class="${short > 0 ? 'bad' : 'good'}">${short > 0 ? `Egypt short ${short}` : 'Egypt OK'}</span>${flood}</span></div>`;
    };
    const myMeter = { ethiopia: 'GERD lake & Lights on', sudan: 'Floods & shortages', egypt: 'Lake Nasser' }[country];

    return [
      {
        title: `You are ${c.name}`,
        body: `
          <div class="chain">${chain}</div>
          <p class="rules-lead">${R.where}</p>
          <div class="goal-box" style="--c:${c.color}"><span class="gb-label">Your goal</span><b>${c.goal}</b></div>
          <ul class="rules-list">
            <li><b>20 turns.</b> One turn is one year, from 2011 to a what-if future. A game takes about 15–20 minutes.</li>
            <li><b>One water unit</b> = 1 billion m³ of water. The numbers are simplified, but the history is real.</li>
          </ul>`,
      },
      {
        title: 'Every year, in four steps',
        body: `
          <ol class="year-steps">
            <li><span class="ys-n">1</span><div><b>Read the rain card.</b> The rains in Ethiopia’s highlands decide how much water there is:<div class="chips-row">${rainChips}</div></div></li>
            <li><span class="ys-n">2</span><div><b>Read the event card.</b> One surprise each year — a heatwave, an election, a flood warning, a mediator…</div></li>
            <li><span class="ys-n">3</span><div><b>Make your two choices:</b> a <em>water plan</em> and one <em>diplomacy</em> move. These are the only decisions you make.</div></li>
            <li><span class="ys-n">4</span><div><b>Press “End the year”.</b> The river runs, the other two countries make their moves, and you see what happened and why.</div></li>
          </ol>`,
      },
      {
        title: 'Your water plan',
        body: `
          <p class="rules-lead">${R.waterIntro}</p>
          <div class="opt-explain">${R.water.map(([n, t]) => `<div><b>${n}</b><span>${t}</span></div>`).join('')}</div>`,
      },
      {
        title: 'Diplomacy: one move a year',
        body: `
          <div class="opt-explain">
            <div><b>📡 Share data</b><span>+5 trust, costs 1 coin. Your neighbours see your plans, so nobody is surprised.</span></div>
            <div><b>🤐 Stay quiet</b><span>Free. Nothing changes.</span></div>
            <div><b>✍️ Propose a rule</b><span>From level 2. Opens talks with two sliders: the minimum water Ethiopia must let through in dry years, and daily data sharing. Both other countries must agree. A signed rule gives +10 trust — breaking it later costs 20.</span></div>
            <div><b>🤝 Invite a mediator</b><span>From level 2. Talks with the African Union, US or UN: costs 1 coin, +2 trust, and the others accept a wider range.</span></div>
            <div><b>🚩 Go it alone</b><span>Free, and good for your needs this year — but −10 trust. Do it too often and talks collapse.</span></div>
          </div>`,
      },
      {
        title: 'Where the water goes',
        body: `
          <div class="math rules-math">
            <span class="term">Rain<b>?</b></span><span class="op">−</span>
            <span class="term">Stored by Ethiopia<b>?</b></span><span class="op">+</span>
            <span class="term">Other rivers<b>35</b></span><span class="op">−</span>
            <span class="term">Used in Sudan<b>18</b></span><span class="op">=</span>
            <span class="term result good">Flow to Egypt<b>?</b></span>
          </div>
          <ul class="rules-list">
            <li><b>Egypt needs 55</b> a year. If less arrives, Lake Nasser can cover the gap — until it runs dry.</li>
            <li><b>Sudan floods</b> if Ethiopia lets <b>50 or more</b> through (62 if Sudan lowered Roseires early).</li>
            <li><b>Before 2020</b> there is no dam holding water, so all the rain flows on.</li>
          </ul>
          <div class="rx-wrap">${ex('normal', 'fill_steady')}${ex('drought', 'fill_fast')}${ex('wet', 'pause')}</div>
          <p class="muted small">The lesson in one line: filling fast is safe in wet years, but in a drought someone has to give.</p>`,
      },
      {
        title: 'Your meters',
        body: `
          <div class="meter-explain">
            <div class="me me-needs"><b>Your needs</b><span>0–100, starts at 50. Follows how well each year goes for ${c.name} (${c.needsLabel.toLowerCase()}). <strong>60+ counts as high.</strong></span></div>
            <div class="me me-trust"><b>Regional trust</b><span>0–100, starts at 50, <strong>shared by all three countries</strong>. Up: sharing data, keeping promises, signing rules. Down: surprises, going it alone, breaking rules. Below 25 the others go it alone. <strong>At 0 the game ends.</strong></span></div>
            <div class="me me-budget"><b>Budget</b><span>Starts at 10 coins, about +2 a year (more with power sales, aid and good years). Spend it on sharing data, mediators, building and projects.</span></div>
            <div class="me me-res"><b>${myMeter}</b><span>${R.meter}</span></div>
          </div>`,
      },
      {
        title: 'How it ends',
        body: `
          <div class="end-grid">
            <span class="eg-axis eg-y">Your needs</span>
            <div class="he he-hollow"><b>${ENDINGS.hollow.icon} ${ENDINGS.hollow.name}</b><span>High needs, low trust</span></div>
            <div class="he he-shared"><b>${ENDINGS.shared.icon} ${ENDINGS.shared.name}</b><span>High needs, high trust</span></div>
            <div class="he he-crisis"><b>${ENDINGS.crisis.icon} ${ENDINGS.crisis.name}</b><span>Low needs, low trust</span></div>
            <div class="he he-neighbour"><b>${ENDINGS.neighbour.icon} ${ENDINGS.neighbour.name}</b><span>Low needs, high trust</span></div>
            <span class="eg-axis eg-x">Regional trust →</span>
          </div>
          <p class="rules-lead">“High” means 60 or more after the last year — and if trust ever hits 0, it’s Crisis straight away. Five levels follow the real timeline; each one unlocks one new idea. Level 5 is a made-up “what-if” drought.</p>
          <h4 class="tips-h">Tips for ${c.name}</h4>
          <ul class="tips">${R.tips.map((t) => `<li>${t}</li>`).join('')}</ul>`,
      },
    ];
  }

  function showRules(country, onDone, step = 0) {
    const steps = rulesSteps(country);
    const s = steps[step];
    const last = step === steps.length - 1;
    const c = COUNTRIES[country];
    const card = openModal(`
      <div class="rules" style="--c:${c.color}">
        <div class="rules-top">
          <p class="eyebrow">How to play as ${c.name} · ${step + 1} of ${steps.length}</p>
          <button class="link" id="r-skip">${onDone === showLevelIntro ? 'Skip' : 'Close'}</button>
        </div>
        <h2 class="h-display">${s.title}</h2>
        <div class="rules-body">${s.body}</div>
        <div class="rules-foot">
          <div class="rules-dots" aria-hidden="true">${steps.map((_, i) => `<span class="${i === step ? 'on' : i < step ? 'done' : ''}"></span>`).join('')}</div>
          <div class="rules-nav">
            ${step > 0 ? '<button class="btn ghost" id="r-back">← Back</button>' : ''}
            <button class="btn primary" id="r-next">${last ? (onDone === showLevelIntro ? 'Start level 1 →' : 'Got it') : 'Next →'}</button>
          </div>
        </div>
      </div>`, { wide: true, dismissable: false, cls: 'rules-card' });
    const go = (to) => { Sound.click(); showRules(country, onDone, to); };
    const finish = () => { Sound.select(); closeModal(); if (onDone) onDone(); };
    $('#r-next', card).addEventListener('click', () => (last ? finish() : go(step + 1)));
    if (step > 0) $('#r-back', card).addEventListener('click', () => go(step - 1));
    $('#r-skip', card).addEventListener('click', finish);
    card.onkeydown = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); last ? finish() : go(step + 1); }
      if (e.key === 'ArrowLeft' && step > 0) { e.preventDefault(); go(step - 1); }
    };
  }

  function enterGame() {
    show('game');
    if (!mapBuilt) {
      RiverMap.build($('#map'), { onDamClick: damModal });
      mapBuilt = true;
    }
    $('#btn-sound').textContent = Sound.enabled ? '🔊' : '🔇';
    showDeltas = false;
    renderTopbar();
    renderMeters();
    $('#panel-decide').innerHTML = '';
    updateMap();
  }

  function resume() {
    const s = loadSave();
    if (!s) return;
    game = s;
    enterGame();
    if (game.over) return showEnding();
    if (game.year) {
      sel = { water: null, diplomacy: game.year.talks ? (game.year.talks.mediator ? 'mediator' : 'propose') : null };
      renderAll();
      return;
    }
    if (E.turnInfo(game).yearInLevel === 0) showLevelIntro();
    else beginYear();
  }

  // ---------- level intro ("What really happened") ----------
  function showLevelIntro() {
    const info = E.turnInfo(game);
    const lv = LEVELS[info.levelIndex];
    const card = openModal(`
      <div class="intro ${lv.fiction ? 'fiction' : ''}">
        <p class="eyebrow">Level ${lv.id} of ${LEVELS.length} · ${levelRange(lv)} · ${lv.years.length} turns</p>
        <h2 class="h-display">${lv.name}</h2>
        ${lv.fiction ? '<p class="badge fiction">What-if · this level is fiction</p>' : ''}
        <p class="intro-situation">${lv.situation}</p>
        <h3 class="intro-h">${lv.fiction ? 'Setting the scene' : 'What really happened'}</h3>
        <ol class="timeline">
          ${lv.history.map(([d, t]) => `<li><span class="tl-date">${d}</span><span class="tl-text">${t}</span></li>`).join('')}
        </ol>
        <div class="newidea"><span class="ni-label">New idea</span> ${lv.newIdea}</div>
        <button class="btn primary big block" id="start-level">${info.levelIndex === 0 ? 'Start the game' : 'Start level'} →</button>
      </div>`, { dismissable: false, cls: 'intro-card' });
    $('#start-level', card).addEventListener('click', () => { Sound.select(); closeModal(); beginYear(); });
  }

  // ---------- a new year ----------
  function beginYear() {
    E.startYear(game);
    sel = { water: null, diplomacy: null };
    save();
    renderAll();
  }

  function renderAll() {
    renderTopbar();
    renderMeters();
    renderDecide();
    updateMap();
  }

  function renderTopbar() {
    const info = E.turnInfo(game);
    const lv = LEVELS[info.levelIndex];
    $('#tb-level').textContent = `Level ${lv.id} · ${lv.name}`;
    $('#tb-level').classList.toggle('fiction', !!lv.fiction);
    $('#tb-year').textContent = game.over ? '' : yearText(info.label);
    $('#tb-progress').innerHTML = E.SCHEDULE.map((s, i) => {
      const cls = [i < game.turn ? 'done' : '', i === game.turn && !game.over ? 'current' : '', s.yearInLevel === 0 && i > 0 ? 'gap' : ''].join(' ');
      return `<span class="${cls}"></span>`;
    }).join('');
  }

  // ---------- meters ----------
  function meter({ name, sub, value, max = 100, unit = '', marks = [], cls = '', delta = null, danger = null }) {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    const d = delta !== null && showDeltas && delta !== 0 ? `<span class="delta ${toneOf(delta)}">${arrow(delta)} ${Math.abs(Math.round(delta * 10) / 10)}</span>` : '';
    const low = danger !== null && value < danger ? ' low' : '';
    return `
      <div class="meter ${cls}${low}">
        <div class="meter-head"><span class="meter-name">${name}</span><span class="meter-val">${d}<b>${Math.round(value * 10) / 10}</b>${unit}</span></div>
        <div class="meter-bar">
          <div class="meter-fill" style="width:${pct}%"></div>
          ${marks.map((m) => `<span class="mark" style="left:${(m.at / max) * 100}%" title="${m.label}"><i>${m.label}</i></span>`).join('')}
        </div>
        ${sub ? `<div class="meter-sub">${sub}</div>` : ''}
      </div>`;
  }

  function renderMeters() {
    const p = game.player;
    const c = COUNTRIES[p];
    const last = game.history[game.history.length - 1];
    const dl = (get) => (last ? get(last.after) - get(last.before) : null);
    const highN = CFG.highNeeds, highT = CFG.highTrust;
    let html = `
      <div class="you" style="--c:${c.color}">
        <div class="you-row"><span class="dot"></span><strong>${c.name}</strong><span class="muted">${c.position}</span></div>
        <p class="goal">${c.goal}</p>
      </div>`;
    html += meter({ name: 'Your needs', sub: c.needsLabel + (p === 'egypt' ? ' · danger line 30' : ''), value: game.c[p].needs, cls: 'm-needs', delta: dl((a) => a.needs[p]), marks: [{ at: highN, label: 'High' }].concat(p === 'egypt' ? [{ at: 30, label: 'Danger' }] : []), danger: p === 'egypt' ? 30 : 25 });
    html += meter({ name: 'Regional trust', sub: 'Shared by all three · at 0 talks collapse', value: game.trust, cls: 'm-trust', delta: dl((a) => a.trust), marks: [{ at: 25, label: 'Others go alone' }, { at: highT, label: 'High' }], danger: 25 });
    const coins = game.c[p].budget;
    const bd = dl((a) => a.budget[p]);
    html += `
      <div class="meter m-budget">
        <div class="meter-head"><span class="meter-name">Budget</span><span class="meter-val">${bd !== null && showDeltas && bd !== 0 ? `<span class="delta ${toneOf(bd)}">${arrow(bd)} ${Math.abs(bd)}</span>` : ''}<b>${coins}</b> coins</span></div>
        <div class="coins" aria-hidden="true">${Array.from({ length: Math.min(coins, 25) }, () => '<i></i>').join('')}</div>
      </div>`;
    if (E.unlocked(game, 'dam')) {
      html += meter({ name: 'GERD reservoir', sub: 'Full at 74 units (74 billion m³)', value: game.reservoir, max: CFG.reservoirMax, unit: ' / 74', cls: 'm-res', delta: dl((a) => a.reservoir) });
    } else {
      html += meter({ name: 'Dam wall built', sub: 'The reservoir opens in level 3 (2020)', value: Math.round(game.construction), unit: '%', cls: 'm-res', delta: last ? Math.round(last.after.construction - (game.history.length > 1 ? game.history[game.history.length - 2].after.construction : 0)) : null });
    }
    if (p === 'ethiopia') html += meter({ name: 'Lights on', sub: 'Share of Ethiopians with electricity · goal 80%', value: game.lightsOn, unit: '%', cls: 'm-lights', delta: dl((a) => a.lightsOn), marks: [{ at: 80, label: 'Goal' }] });
    if (p === 'egypt') html += meter({ name: 'Lake Nasser reserve', sub: `Covers shortages · Egypt needs ${E.egyptNeed(game, game.year ? game.year.eventKey : null)} units this year`, value: game.egyptReserve, max: CFG.egyptReserveMax, unit: ' / 40', cls: 'm-res', delta: dl((a) => a.egyptReserve) });
    if (p === 'sudan') {
      const floods = game.history.filter((h) => h.flood).length;
      const short = game.history.filter((h) => h.sudanShort).length;
      html += `<div class="meter m-sudan"><div class="meter-head"><span class="meter-name">So far</span></div><div class="tally"><span><b>${floods}</b> flood years</span><span><b>${short}</b> short years</span></div></div>`;
    }
    const r = game.rule;
    html += r
      ? `<div class="rule-box signed"><span class="rb-label">Signed rule${E.ruleActive(game) ? '' : ' · starts next year'}</span><b>At least ${r.minRelease} units released in dry years</b>${r.dailyData ? '<span>Data shared daily</span>' : ''}</div>`
      : `<div class="rule-box"><span class="rb-label">No signed rule</span><span>${E.unlocked(game, 'talks') ? 'Propose one in Diplomacy.' : 'Talks unlock in level 2.'}</span></div>`;
    html += `<div class="neighbours"><h4>Neighbours’ needs</h4>${ORDER.filter((id) => id !== p).map((id) => {
      const v = game.c[id].needs;
      return `<div class="nb" style="--c:${COUNTRIES[id].color}"><span>${cName(id)}</span><div class="nb-bar"><i style="width:${v}%"></i></div><b>${v}</b></div>`;
    }).join('')}</div>`;
    $('#panel-meters').innerHTML = html;
  }

  // ---------- decision panel ----------
  function projection() {
    const y = game.year;
    const p = game.player;
    const need = E.egyptNeed(game, y.eventKey);
    const sudanUse = CFG.sudanUse + (p === 'sudan' && sel.water === 'store' ? CFG.sudanStoreExtra : 0);
    let release = y.rain, known = true, store = 0;
    if (E.unlocked(game, 'dam')) {
      if (p === 'ethiopia') {
        if (sel.water) store = E.actualStore(game, sel.water);
        else known = false;
      } else {
        const intel = E.intel(game);
        if (intel && intel.shared) store = intel.store;
        else { known = false; store = E.actualStore(game, 'fill_steady'); }
      }
      release = y.rain - store;
    }
    const toEgypt = release + CFG.otherRivers - sudanUse;
    return { release, store, known, toEgypt, need, sudanUse };
  }

  function forecastText() {
    const y = game.year;
    const p = game.player;
    const pr = projection();
    const damOn = E.unlocked(game, 'dam');
    const egyptLine = (flow) => (flow >= pr.need ? `Egypt gets about <b>${flow}</b> of the ${pr.need} it needs.` : `Egypt gets about <b>${flow}</b> of ${pr.need} — <b class="bad">short ${pr.need - flow}</b>.`);
    if (!damOn) return `No dam yet: the river runs freely. <b>${y.rain}</b> units pass Sudan${y.rain >= CFG.floodThreshold ? ' — <b class="bad">enough to flood Sudan</b> unless Roseires is lowered early' : ''}. ${egyptLine(pr.toEgypt)}`;
    if (p === 'ethiopia') {
      if (!sel.water) return 'Pick a water plan to see where the water goes.';
      const flood = pr.release >= CFG.floodThreshold;
      return `You let <b>${pr.release}</b> through.${flood ? ' <b class="bad">Sudan floods</b> unless it lowered Roseires early (62+).' : ''} ${egyptLine(pr.toEgypt)}`;
    }
    if (!pr.known) {
      const lo = y.rain - E.actualStore(game, 'fill_fast') + CFG.otherRivers - pr.sudanUse;
      const hi = y.rain - E.actualStore(game, 'pause') + CFG.otherRivers - pr.sudanUse;
      return p === 'sudan'
        ? `Ethiopia hasn’t shared its plan. It could release anywhere from <b>${y.rain - E.actualStore(game, 'fill_fast')}</b> to <b>${y.rain - E.actualStore(game, 'pause')}</b>. ${y.rainKey === 'wet' ? '<b class="bad">A wet year can flood you.</b>' : ''}`
        : `Ethiopia hasn’t shared its plan. Egypt could get anywhere from <b>${lo}</b> to <b>${hi}</b> of the ${pr.need} it needs.`;
    }
    if (p === 'sudan') {
      const flood = pr.release >= CFG.floodThreshold;
      const safe = sel.water === 'release_early' ? pr.release < CFG.floodThreshold + CFG.releaseEarlyBonus : !flood;
      return `Ethiopia’s data: it will release <b>${pr.release}</b>. ${flood ? (safe ? 'Releasing early keeps you safe.' : '<b class="bad">That floods you unless you release early!</b>') : 'No flood risk this year.'} ${egyptLine(pr.toEgypt)}`;
    }
    return `Ethiopia’s data: it will release <b>${pr.release}</b>. ${egyptLine(pr.toEgypt)} Lake Nasser holds ${game.egyptReserve}.`;
  }

  function optionButton(kind, o, info, selected) {
    let tag = info.tag;
    if (o.store !== undefined && game.player === 'ethiopia' && E.unlocked(game, 'dam')) tag = o.store >= 0 ? `store ${o.store} · lets ${o.release} through` : `release ${-o.store} · lets ${o.release} through`;
    const extra = [];
    if (o.note) extra.push(`<span class="opt-note">${o.note}</span>`);
    if (o.warn) extra.push(`<span class="opt-warn">⚠ ${o.warn}</span>`);
    if (!o.enabled && o.reason) extra.push(`<span class="opt-note">${o.locked ? '🔒 ' : ''}${o.reason}</span>`);
    return `
      <button class="opt${selected ? ' selected' : ''}${o.locked ? ' locked' : ''}" data-kind="${kind}" data-key="${o.key}" ${o.enabled ? '' : 'disabled'} aria-pressed="${selected}">
        <span class="opt-top"><span class="opt-name">${info.name}</span><span class="opt-tag">${tag}</span></span>
        <span class="opt-text">${info.text}</span>
        ${extra.join('')}
      </button>`;
  }

  function renderDecide() {
    const y = game.year;
    if (!y) return;
    const info = E.turnInfo(game);
    const lv = LEVELS[info.levelIndex];
    const rain = RAIN[y.rainKey];
    const ev = EVENTS[y.eventKey];
    const p = game.player;
    const talks = y.talks;

    let html = `
      <div class="year-card">
        <div class="yc-top"><span class="yc-year">${yearText(y.label)}</span>${lv.fiction ? '<span class="badge fiction">What-if</span>' : ''}<span class="yc-turn">Turn ${game.turn + 1} of ${E.TOTAL_TURNS}</span></div>
        <div class="card rain r-${y.rainKey}">
          <span class="ic" aria-hidden="true">${rain.icon}</span>
          <div><b>${rain.name} year · ${y.rain} units of rain</b><p>${rain.text}</p></div>
        </div>
        <div class="card event${ev.history ? ' history' : ''}">
          <span class="ic" aria-hidden="true">${ev.icon}</span>
          <div><b>${ev.name}</b>${ev.history ? ' <span class="badge">History</span>' : ''}<p>${ev.text}</p></div>
        </div>
      </div>`;

    if (info.yearInLevel === 0) html += `<div class="tip"><span class="ni-label">New idea</span><b>${lv.newIdea}</b><p>${lv.tip}</p></div>`;

    if (p !== 'ethiopia') {
      const intel = E.intel(game);
      html += intel && intel.shared
        ? `<div class="intel ok">📡 <b>Ethiopia shared its plan:</b> ${WATER_OPTIONS[intel.water].name.toLowerCase()}${E.unlocked(game, 'dam') ? `, letting ${intel.release} through` : ''}.</div>`
        : '<div class="intel">📡 Ethiopia hasn’t shared its plan this year.</div>';
    }

    html += '<h3 class="step"><span>1</span> Water plan</h3><div class="options">';
    E.waterOptions(game).forEach((o) => { html += optionButton('water', o, WATER_OPTIONS[o.key], sel.water === o.key); });
    html += `</div><p class="forecast">${forecastText()}</p>`;

    html += '<h3 class="step"><span>2</span> Diplomacy</h3><div class="options dip">';
    E.diplomacyOptions(game).forEach((o) => {
      const opt = talks ? { ...o, enabled: (talks.mediator ? 'mediator' : 'propose') === o.key } : o;
      html += optionButton('diplomacy', opt, DIPLOMACY_OPTIONS[o.key], sel.diplomacy === o.key);
    });
    html += '</div>';
    if (talks) {
      html += `<div class="talks-summary ${talks.accepted ? 'ok' : 'no'}">${talks.accepted ? '✍️ <b>Rule agreed!</b>' : '🗣️ <b>No deal this time.</b>'} Minimum ${talks.minRelease} in dry years${talks.dailyData ? ', daily data' : ''}${talks.mediator ? ` · mediator: ${MEDIATORS[talks.mediator].name}` : ''}.</div>`;
    }

    const ready = sel.water && sel.diplomacy && (!['propose', 'mediator'].includes(sel.diplomacy) || talks);
    html += `<button class="btn primary big block end-year" id="end-year" ${ready ? '' : 'disabled'}>End the year →</button>`;
    if (!ready) html += `<p class="muted small center">${!sel.water ? 'Choose a water plan' : !sel.diplomacy ? 'Choose a diplomacy move' : 'Finish the talks first'}</p>`;

    const panel = $('#panel-decide');
    const keepScroll = panel.scrollTop;
    panel.innerHTML = html;
    panel.scrollTop = keepScroll;

    $$('.opt', panel).forEach((b) => b.addEventListener('click', () => {
      if (b.disabled) return;
      Sound.select();
      const kind = b.dataset.kind, key = b.dataset.key;
      if (kind === 'diplomacy' && (key === 'propose' || key === 'mediator') && !talks) { openTalks(key === 'mediator'); return; }
      sel[kind] = key;
      renderDecide();
      updateMap();
    }));
    $('#end-year', panel).addEventListener('click', endYear);
  }

  // ---------- talks ----------
  function openTalks(withMediator, mediatorKey = null) {
    if (withMediator && !mediatorKey) {
      const card = openModal(`
        <p class="eyebrow">Diplomacy · costs 1 coin · +2 trust</p>
        <h2 class="h-display">Invite a mediator</h2>
        <p class="muted">A mediator makes the others accept a wider range this year. All three work the same way in the game; they differ in history.</p>
        <div class="mediators">
          ${Object.entries(MEDIATORS).map(([k, m]) => `<button class="mediator" data-m="${k}"><b>${m.name}</b><span>${m.note}</span></button>`).join('')}
        </div>
        <div class="modal-actions"><button class="btn ghost" data-action="close">Cancel</button></div>`);
      $$('.mediator', card).forEach((b) => b.addEventListener('click', () => { Sound.select(); openTalks(true, b.dataset.m); }));
      return;
    }
    const p = game.player;
    const widen = E.talksWiden(game, mediatorKey);
    const ranges = E.talkRanges(game, widen);
    const others = ORDER.filter((id) => id !== p);
    let lo = 0, hi = CFG.talks.maxRelease;
    others.forEach((id) => { lo = Math.max(lo, ranges[id].lo); hi = Math.min(hi, ranges[id].hi); });
    const overlap = lo <= hi;
    const ethData = p === 'ethiopia' || ranges.ethiopia.dataOk;
    const sudanWants = p !== 'sudan' && ranges.sudan.wantsData;
    let value = overlap ? Math.round((lo + hi) / 2) : 20;
    let data = ethData;

    const rows = others.map((id) => {
      const r = ranges[id];
      let dataNote = 'Data: either way';
      if (id === 'ethiopia') dataNote = r.dataOk ? 'Daily data: OK' : 'Not ready for daily data';
      if (id === 'sudan') dataNote = r.wantsData ? 'Insists on daily data' : 'Daily data optional';
      return `
        <div class="zone-row" style="--c:${COUNTRIES[id].color}">
          <span class="zr-name">${cName(id)}</span>
          <div class="zr-track"><i style="left:${(r.lo / 40) * 100}%;width:${((r.hi - r.lo) / 40) * 100}%"></i><b class="zr-marker"></b></div>
          <span class="zr-range">${r.lo}–${r.hi}</span>
          <span class="zr-data">${dataNote}</span>
        </div>`;
    }).join('');

    const card = openModal(`
      <p class="eyebrow">${mediatorKey ? `Talks with the ${MEDIATORS[mediatorKey].name}` : 'Propose a rule'} · trust ${game.trust}</p>
      <h2 class="h-display">Talks</h2>
      <p class="muted">Set the rule. Both other countries must say yes. Their public positions are shown below — they widen as trust rises${widen ? ', and a mediator or event widens them now' : ''}.</p>
      <div class="talk-slider">
        <label for="t-min">Minimum water Ethiopia must let through in a dry or drought year: <output id="t-out">${value}</output> units</label>
        <div class="zones">${rows}
          <div class="zone-row overlap ${overlap ? 'ok' : 'no'}"><span class="zr-name">Everyone</span>
            <div class="zr-track">${overlap ? `<i style="left:${(lo / 40) * 100}%;width:${Math.max(1.2, ((hi - lo) / 40) * 100)}%"></i>` : ''}<b class="zr-marker"></b></div>
            <span class="zr-range">${overlap ? `${lo}–${hi}` : 'none'}</span>
            <span class="zr-data">${overlap ? 'Pick a number in here' : 'No overlap: build trust or bring a mediator'}</span>
          </div>
        </div>
        <input type="range" id="t-min" min="0" max="40" step="1" value="${value}">
        <div class="scale"><span>0</span><span>10</span><span>20</span><span>30</span><span>40</span></div>
      </div>
      <label class="toggle"><input type="checkbox" id="t-data" ${data ? 'checked' : ''}><span></span> Share river data every day</label>
      <p class="talk-explain" id="t-explain"></p>
      <div class="modal-actions">
        <button class="btn ghost" data-action="close">Cancel</button>
        <button class="btn primary" id="t-go">Put it on the table</button>
      </div>`, { wide: true });

    const input = $('#t-min', card);
    const dataBox = $('#t-data', card);
    const explain = () => {
      value = Number(input.value);
      data = dataBox.checked;
      $('#t-out', card).textContent = value;
      $$('.zr-marker', card).forEach((m) => (m.style.left = `${(value / 40) * 100}%`));
      const dStore = Math.max(-10, CFG.rain.drought - value), dryStore = Math.max(-10, CFG.rain.dry - value);
      const st = (n) => (n >= 0 ? `store at most <b>${n}</b>` : `release <b>${-n}</b> from the lake`);
      $('#t-explain', card).innerHTML = `In a drought (28 rain) Ethiopia could ${st(dStore)}; in a dry year (38) it could ${st(dryStore)}. Egypt would get at least <b>${value + CFG.otherRivers - CFG.sudanUse}</b> in those years. ${sudanWants && !data ? '<b class="bad">Sudan won’t sign without daily data.</b>' : ''} ${data && !ethData ? '<b class="bad">Ethiopia isn’t ready for daily data.</b>' : ''}`;
    };
    input.addEventListener('input', explain);
    dataBox.addEventListener('change', explain);
    explain();

    $('#t-go', card).addEventListener('click', () => {
      const t = E.holdTalks(game, { minRelease: value, dailyData: data }, mediatorKey);
      sel.diplomacy = mediatorKey ? 'mediator' : 'propose';
      save();
      if (t.accepted) Sound.signed(); else Sound.bad();
      const res = openModal(`
        <p class="eyebrow">Talks · ${t.minRelease} units minimum${t.dailyData ? ' · daily data' : ''}</p>
        <h2 class="h-display">${t.accepted ? 'Agreed!' : 'No deal this time'}</h2>
        <ul class="replies">
          ${ORDER.map((id) => `<li class="${t.replies[id].yes ? 'yes' : 'no'}" style="--c:${COUNTRIES[id].color}"><span class="rp-mark">${t.replies[id].yes ? '✓' : '✗'}</span><div><b>${cName(id)}${id === p ? ' (you)' : ''}</b><p>${t.replies[id].text}</p></div></li>`).join('')}
        </ul>
        <p class="muted">${t.accepted ? 'All three countries sign. The rule starts next year (+10 trust when the year ends). Breaking it later costs 20 trust.' : t.mediator ? 'The mediator keeps the door open: no trust lost.' : 'Failed talks cost 2 trust. Try again when trust is higher, or bring a mediator.'}</p>
        <div class="modal-actions"><button class="btn primary" id="t-back">Back to my turn</button></div>`);
      $('#t-back', res).addEventListener('click', () => { closeModal(); renderDecide(); });
    });
  }

  // ---------- end of year ----------
  function endYear() {
    if (!game.year || !sel.water || !sel.diplomacy) return;
    const yearInfo = E.turnInfo(game);
    const r = E.resolveYear(game, { water: sel.water, diplomacy: sel.diplomacy });
    save();
    showDeltas = true;
    $('#panel-decide').innerHTML = '<div class="resolving"><span class="spinner"></span> The river runs…</div>';
    renderMeters();
    renderTopbar();
    updateMap();
    const p = game.player;
    const bad = r.flood && p === 'sudan' || r.egypt.remaining > 0 && p === 'egypt' || r.ruleEvent === 'broken' || r.after.needs[p] < r.before.needs[p];
    setTimeout(() => {
      if (bad) Sound.bad(); else Sound.good();
      showResults(r, yearInfo);
    }, 650);
  }

  function lessonFor(r) {
    const p = game.player;
    if (r.ruleEvent === 'broken') return 'A broken rule costs more trust than having no rule at all.';
    if (r.ruleEvent === 'kept' && r.egypt.remaining > 0) return `The rule held, but a ${game.rule.minRelease}-unit minimum still left Egypt short. A rule is only as strong as the numbers in it.`;
    if (r.ruleEvent === 'kept') return 'The drought rule held. This is what rules are for: the hard years.';
    if (r.flood && !r.shared.ethiopia) return 'Sudan flooded with no warning. When Ethiopia shares data, Sudan can lower Roseires early.';
    if (r.flood) return 'Big flows flood Sudan. Filling fast in a wet year, or lowering Roseires early, can prevent it.';
    if (!r.damOn && E.isDry(r.rainKey)) return 'Before the dam, the Blue Nile simply ran low in dry years — nobody could store or share water.';
    if (r.damOn && r.egypt.shortageFlow > 0 && E.isDry(r.rainKey)) return 'In a dry year, every unit stored upstream is a unit missing downstream. Lake Nasser is Egypt’s buffer.';
    if (r.damOn && r.rainKey === 'wet' && r.store >= 20) return 'In a wet year, filling fast is safe — it even protects Sudan from floods.';
    if (r.dip[p] === 'alone') return 'Going it alone helps at home this year, but trust is shared — and so is the next drought.';
    if (!r.damOn) return 'Before the dam, the Blue Nile ran freely: floods in wet years, shortages in droughts.';
    return 'Calm years are the time to build trust for the dry ones.';
  }

  function showResults(r, info) {
    const p = game.player;
    const lv = LEVELS[r.levelIndex];
    const ev = EVENTS[r.eventKey];
    const rain = RAIN[r.rainKey];
    const eg = r.egypt;

    const math = r.damOn
      ? `<div class="math" aria-label="River math">
          <span class="term">Rain<b>${r.rain}</b></span><span class="op">−</span>
          <span class="term">${r.store >= 0 ? 'Stored by Ethiopia' : 'Released from lake'}<b>${r.store >= 0 ? r.store : `+${-r.store}`}</b></span><span class="op">+</span>
          <span class="term">Other rivers<b>${CFG.otherRivers}</b></span><span class="op">−</span>
          <span class="term">Used in Sudan<b>${r.sudanUse}</b></span><span class="op">=</span>
          <span class="term result ${eg.flow >= eg.need ? 'good' : 'bad'}">Flow to Egypt<b>${eg.flow}</b></span>
        </div>`
      : `<div class="math pre"><span class="term">Rain<b>${r.rain}</b></span><span class="op">+</span><span class="term">Other rivers<b>${CFG.otherRivers}</b></span><span class="op">−</span><span class="term">Used in Sudan<b>${r.sudanUse}</b></span><span class="op">=</span><span class="term result ${eg.flow >= eg.need ? 'good' : 'bad'}">Flow to Egypt<b>${eg.flow}</b></span></div>
         <p class="muted small">No dam is holding water yet — the river math with storage starts in level 3.</p>`;

    const outcomes = [];
    outcomes.push(r.flood ? `<span class="oc bad">🌊 Flood in Sudan (${r.release} ≥ ${r.threshold})</span>` : `<span class="oc good">✓ No flood in Sudan</span>`);
    if (r.sudanShort) outcomes.push('<span class="oc bad">🌾 Sudan’s farms ran short</span>');
    if (eg.shortageFlow === 0) outcomes.push(`<span class="oc good">✓ Egypt’s needs met (${eg.flow} of ${eg.need})</span>`);
    else if (eg.remaining === 0) outcomes.push(`<span class="oc warn">💧 Egypt short ${eg.shortageFlow} — Lake Nasser covered it</span>`);
    else outcomes.push(`<span class="oc bad">🚱 Egypt short ${eg.remaining}${eg.drawn ? ` (Lake Nasser covered ${eg.drawn})` : ''}</span>`);
    if (r.ruleEvent === 'signed') outcomes.push('<span class="oc good">✍️ Rule signed</span>');
    if (r.ruleEvent === 'kept') outcomes.push('<span class="oc good">🤝 Rule kept</span>');
    if (r.ruleEvent === 'broken') outcomes.push('<span class="oc bad">💔 Rule broken (−20 trust)</span>');
    if (r.damOn && r.after.lightsOn > r.before.lightsOn) outcomes.push(`<span class="oc good">💡 Lights on +${Math.round((r.after.lightsOn - r.before.lightsOn) * 10) / 10}%</span>`);

    const did = ORDER.map((id) => {
      const w = WATER_OPTIONS[r.water[id]];
      const d = DIPLOMACY_OPTIONS[r.dip[id]];
      return `<li style="--c:${COUNTRIES[id].color}"><b>${cName(id)}${id === p ? ' (you)' : ''}</b><span>${w ? w.name : '—'} · ${d.name}</span></li>`;
    }).join('');

    const row = (name, a, b, unit = '') => {
      const d = Math.round((b - a) * 10) / 10;
      return `<tr><th>${name}</th><td>${Math.round(a * 10) / 10}${unit}</td><td class="arr">→</td><td><b>${Math.round(b * 10) / 10}${unit}</b></td><td class="delta ${toneOf(d)}">${arrow(d)} ${signed(d)}</td></tr>`;
    };
    let meters = row('Your needs', r.before.needs[p], r.after.needs[p]);
    meters += row('Regional trust', r.before.trust, r.after.trust);
    meters += row('Budget', r.before.budget[p], r.after.budget[p], ' coins');
    if (r.damOn) meters += row('GERD reservoir', r.before.reservoir, r.after.reservoir);
    if (p === 'ethiopia') meters += row('Lights on', r.before.lightsOn, r.after.lightsOn, '%');
    if (p === 'egypt') meters += row('Lake Nasser', r.before.egyptReserve, r.after.egyptReserve);

    const trustList = r.trustItems.map((t) => `<li class="${t.amount > 0 ? 'up' : 'down'}"><b>${signed(Math.round(t.amount * 10) / 10)}</b> ${t.text}</li>`).join('');
    const falloff = r.trustFalloff < 1 && r.trustItems.some((t) => t.amount > 0) ? `<p class="muted small">Trust is already high, so gains count ×${r.trustFalloff.toFixed(2)}.</p>` : '';

    let next = 'Next year →';
    if (game.over) next = 'See your ending →';
    else if (r.lastInLevel) next = 'Meanwhile… →';

    const card = openModal(`
      <div class="results">
        <p class="eyebrow">Level ${lv.id} · ${lv.name}${lv.fiction ? ' · What-if' : ''}</p>
        <h2 class="h-display">${yearText(r.label)}: the year in review</h2>
        <div class="res-chips"><span class="chip r-${r.rainKey}">${rain.icon} ${rain.name} · ${r.rain}</span><span class="chip">${ev.icon} ${ev.name}</span></div>
        ${math}
        <div class="outcomes">${outcomes.join('')}</div>
        <div class="res-grid">
          <div><h4>What everyone did</h4><ul class="did">${did}</ul></div>
          <div><h4>Your meters</h4><table class="res-table">${meters}</table>
            <p class="muted small">This year scored <b>${r.scores[p]}</b>/100 for ${cName(p)}; your needs meter moves part of the way toward it.</p></div>
        </div>
        <details class="why"><summary>Why trust changed (${signed(r.after.trust - r.before.trust)})</summary><ul class="trust-list">${trustList || '<li>No change</li>'}</ul>${falloff}</details>
        <p class="lesson">💡 ${lessonFor(r)}</p>
        ${game.over && game.endedEarly ? '<p class="lesson bad">Regional trust hit zero. Talks have collapsed.</p>' : ''}
        <div class="modal-actions"><button class="btn primary big" id="res-next">${next}</button></div>
      </div>`, { wide: true, dismissable: false });
    $('#res-next', card).addEventListener('click', () => {
      Sound.click();
      closeModal();
      if (game.over) return showEnding();
      if (r.lastInLevel) return showMeanwhile(r.levelIndex);
      beginYear();
    });
  }

  // ---------- "Meanwhile in…" ----------
  function showMeanwhile(levelIndex) {
    const lv = LEVELS[levelIndex];
    const cards = E.meanwhile(game, levelIndex);
    const years = game.history.filter((h) => h.levelIndex === levelIndex);
    const first = years[0], last = years[years.length - 1];
    const p = game.player;
    const card = openModal(`
      <p class="eyebrow">End of level ${lv.id} · ${lv.name}</p>
      <h2 class="h-display">Meanwhile…</h2>
      <p class="muted">How the other two capitals saw your choices.</p>
      <div class="mw-cards">
        ${cards.map((c) => `<div class="mw-card" style="--c:${COUNTRIES[c.id].color}"><h3>Meanwhile in ${c.capital}</h3><ul>${c.lines.map((l) => `<li>${l}</li>`).join('')}</ul></div>`).join('')}
      </div>
      <div class="mw-stats">
        <div><span>Your needs</span><b>${first.before.needs[p]} → ${last.after.needs[p]}</b></div>
        <div><span>Regional trust</span><b>${first.before.trust} → ${last.after.trust}</b></div>
        <div><span>Floods in Sudan</span><b>${years.filter((h) => h.flood).length}</b></div>
        <div><span>Egypt short years</span><b>${years.filter((h) => h.egypt.remaining > 0).length}</b></div>
      </div>
      <div class="modal-actions"><button class="btn primary big" id="mw-next">Next level →</button></div>`, { wide: true, dismissable: false });
    $('#mw-next', card).addEventListener('click', () => { Sound.click(); closeModal(); showLevelIntro(); });
  }

  // ---------- ending ----------
  function showEnding() {
    const key = game.ending;
    const en = ENDINGS[key];
    const p = game.player;
    const c = COUNTRIES[p];
    const needs = game.c[p].needs;
    const last = game.history[game.history.length - 1];
    const sub = game.endedEarly ? `Trust hit zero in ${yearText(last.label)} — the game ended early` : `After ${game.history.length} years`;
    const rows = E.compare(game);

    // chart of needs and trust over time
    const n = game.history.length;
    const W = 560, H = 180, pad = 26;
    const xAt = (i) => pad + (i / Math.max(1, n)) * (W - pad * 2);
    const yAt = (v) => H - pad - (v / 100) * (H - pad * 2);
    const series = (get) => [get(game.history[0].before)].concat(game.history.map((h) => get(h.after)));
    const line = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');
    const needsS = series((a) => a.needs[p]);
    const trustS = series((a) => a.trust);
    const levelLines = LEVELS.map((lv, li) => {
      const idx = game.history.findIndex((h) => h.levelIndex === li);
      return idx > 0 ? `<line x1="${xAt(idx)}" x2="${xAt(idx)}" y1="${pad - 8}" y2="${H - pad}" class="ch-level"/><text x="${xAt(idx) + 3}" y="${pad - 10}" class="ch-level-t">L${li + 1}</text>` : '';
    }).join('');
    const chart = `
      <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Your needs and regional trust over the game">
        <line x1="${pad}" x2="${W - pad}" y1="${yAt(60)}" y2="${yAt(60)}" class="ch-high"/>
        <text x="${W - pad}" y="${yAt(60) - 4}" class="ch-high-t" text-anchor="end">High (60)</text>
        <line x1="${pad}" x2="${W - pad}" y1="${yAt(0)}" y2="${yAt(0)}" class="ch-axis"/>
        ${levelLines}
        <path d="${line(trustS)}" class="ch-trust"/>
        <path d="${line(needsS)}" class="ch-needs" style="stroke:${c.color}"/>
        <circle cx="${xAt(n)}" cy="${yAt(trustS[n])}" r="4" class="ch-dot-trust"/>
        <circle cx="${xAt(n)}" cy="${yAt(needsS[n])}" r="4" style="fill:${c.color}"/>
      </svg>
      <div class="chart-legend"><span class="lg needs" style="--c:${c.color}">Your needs</span><span class="lg trust">Regional trust</span></div>`;

    const quad = ['hollow', 'shared', 'crisis', 'neighbour'].map((k) => `<div class="q q-${k}${k === key ? ' here' : ''}"><b>${ENDINGS[k].name}</b></div>`).join('');
    const mx = Math.max(3, Math.min(97, game.trust));
    const my = Math.max(3, Math.min(97, 100 - needs));

    $('#screen-ending').innerHTML = `
      <div class="ending ending-${key}">
        <p class="eyebrow">${c.name} · ${sub}</p>
        <div class="ending-icon" aria-hidden="true">${en.icon}</div>
        <h1 class="h-display ending-title">${en.name}</h1>
        <p class="ending-tag">${en.tagline}</p>
        <p class="ending-text">${en.text}</p>
        <div class="ending-grid">
          <div class="panel quad-wrap">
            <h3>Where you landed</h3>
            <div class="quad">${quad}<span class="you-dot" style="left:${mx}%;top:${my}%;--c:${c.color}" title="You: needs ${needs}, trust ${game.trust}"></span></div>
            <div class="quad-axes"><span>← low trust</span><span>high trust →</span></div>
            <p class="muted small center">Your needs ${needs} · trust ${game.trust} · “high” means 60+</p>
          </div>
          <div class="panel chart-wrap"><h3>Twenty years in two lines</h3>${chart}</div>
        </div>
        <h2 class="h-display compare-h">Your choices vs what really happened</h2>
        <div class="compare">
          ${rows.map((r) => `<div class="cmp-row"><span class="cmp-topic">${r.topic}</span><p class="cmp-you"><span>You</span>${r.you}</p><p class="cmp-real"><span>Real world</span>${r.real}</p></div>`).join('')}
        </div>
        <p class="muted small center">Game numbers are simplified. Level 5 was a what-if. Check the news: this dispute is still live.</p>
        <div class="ending-actions">
          <button class="btn primary big" id="again">Play again as ${c.name}</button>
          <button class="btn ghost big" id="other">Try another country</button>
          <button class="btn ghost big" data-action="sources">Sources</button>
        </div>
      </div>`;
    show('ending');
    if (key === 'shared' || key === 'neighbour') Sound.signed(); else Sound.bad();
    $('#again').addEventListener('click', () => { Sound.select(); startNew(p); });
    $('#other').addEventListener('click', () => { clearSave(); actions.play(); });
  }

  // ---------- map ----------
  function updateMap() {
    if (!mapBuilt || !game) return;
    const g = game;
    const base = {
      player: g.player,
      reservoir: g.reservoir,
      reserve: g.egyptReserve,
      construction: g.construction,
      damOn: E.unlocked(g, 'dam') || g.reservoir > 0,
      lightsOn: g.lightsOn,
      sudanNeeds: g.c.sudan.needs,
      egyptNeeds: g.c.egypt.needs,
    };
    if (g.year) {
      const pr = projection();
      RiverMap.update({ ...base, inflow: g.year.rain, release: pr.release, toEgypt: pr.toEgypt, egyptGets: Math.min(pr.toEgypt, pr.need), egyptNeed: pr.need, known: pr.known, flood: false, egyptShort: 0, sudanShort: false });
      return;
    }
    const r = g.history[g.history.length - 1];
    if (r) {
      RiverMap.update({ ...base, inflow: r.rain, release: r.release, toEgypt: r.egypt.flow, egyptGets: r.egypt.need - r.egypt.remaining, egyptNeed: r.egypt.need, known: true, flood: r.flood, egyptShort: r.egypt.remaining, sudanShort: r.sudanShort });
      return;
    }
    RiverMap.update({ ...base, inflow: CFG.rain.normal, release: CFG.rain.normal, toEgypt: 66, egyptGets: 55, egyptNeed: 55, known: true, flood: false, egyptShort: 0, sudanShort: false });
  }

  // ---------- info modals ----------
  function damModal() {
    const g = game;
    const yours = g ? `
      <h3 class="intro-h">In your game</h3>
      <div class="facts">
        <div><span>Dam wall</span><b>${Math.round(g.construction)}% built</b></div>
        <div><span>Reservoir</span><b>${g.reservoir} / 74 units</b></div>
        <div><span>Lights on in Ethiopia</span><b>${Math.round(g.lightsOn)}%</b></div>
      </div>` : '';
    openModal(`
      <p class="eyebrow">Dam info card</p>
      <h2 class="h-display">The Grand Ethiopian Renaissance Dam</h2>
      <p class="muted">Africa’s largest hydropower dam, on the Blue Nile in western Ethiopia, about 14 km from the Sudan border.</p>
      <div class="facts">${C.DAM_FACTS.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      ${yours}
      <div class="modal-actions"><button class="btn primary" data-action="close">Close</button></div>`);
  }

  function howModal() {
    openModal(`
      <p class="eyebrow">How to play</p>
      <h2 class="h-display">One river, three countries</h2>
      <p>You lead one country on the Blue Nile. Each turn is one year. Five levels follow the real timeline from 2011, then end with a labelled what-if.</p>
      <ol class="how-steps">
        <li><b>Rain card</b> — Wet (60), Normal (49), Dry (38) or Drought (28) units, plus one event card.</li>
        <li><b>Water plan</b> — Ethiopia builds, then fills or releases. Sudan stores at Roseires or releases early. Egypt draws on Lake Nasser or pays for water-saving projects.</li>
        <li><b>Diplomacy</b> — share data, propose a rule, invite a mediator, or go it alone.</li>
        <li><b>River math</b> — Flow to Egypt = Rain − Stored by Ethiopia + 35 (other rivers) − 18 (used in Sudan). Egypt needs 55. Sudan floods if 50+ comes through.</li>
        <li><b>Meters update</b> — your needs, regional trust, budget and the reservoir.</li>
      </ol>
      <div class="how-endings">
        ${['shared', 'hollow', 'neighbour', 'crisis'].map((k) => `<div class="he he-${k}"><b>${ENDINGS[k].icon} ${ENDINGS[k].name}</b><span>${ENDINGS[k].tagline}</span></div>`).join('')}
      </div>
      <p class="muted small">High = 60 or more. If regional trust ever hits 0, the game ends early in Crisis. The computer runs the other two countries by the same simple rules: they share data when trust is above 40, Ethiopia pauses filling in a drought when trust is above 60, and they go it alone when trust is below 25.</p>
      <div class="modal-actions"><button class="btn primary" data-action="close">Got it</button></div>`, { wide: true });
  }

  function sourcesModal() {
    openModal(`
      <p class="eyebrow">Sources &amp; credits</p>
      <h2 class="h-display">Where the facts come from</h2>
      <ul class="sources">
        ${C.SOURCES.map((s) => `<li>${s.url ? `<a href="${s.url}" target="_blank" rel="noopener">${s.title}</a>` : `<b>${s.title}</b>`} — ${s.outlet}: ${s.note}</li>`).join('')}
      </ul>
      <h3 class="intro-h">Keeping it fair</h3>
      <ul class="fair">
        <li>No villain: all three countries are playable and the computer runs each by the same rules.</li>
        <li>Claims are written as “Egypt says…” or “Ethiopia argues…”, not as fact.</li>
        <li>Game numbers are simplified, and level 5 is a what-if.</li>
        <li>No real leaders appear as characters, and no quotes are invented.</li>
      </ul>
      <h3 class="intro-h">Credits</h3>
      <p class="muted small">Map drawn from real coordinates. Sound generated in code with the Web Audio API. Fonts: Fraunces and Inter (Google Fonts, SIL Open Font License).</p>
      <div class="modal-actions"><button class="btn primary" data-action="close">Close</button></div>`, { wide: true });
  }

  function menuModal() {
    const card = openModal(`
      <h2 class="h-display">Menu</h2>
      <div class="menu-list">
        <button class="btn ghost block" data-action="close">Resume</button>
        <button class="btn ghost block" data-action="how">How to play</button>
        <button class="btn ghost block" data-action="sources">Sources &amp; credits</button>
        <button class="btn ghost block" id="m-restart">Restart with another country</button>
        <button class="btn ghost block" data-action="title">Save and quit to title</button>
      </div>`);
    $('#m-restart', card).addEventListener('click', () => { closeModal(); clearSave(); actions.play(); });
  }

  // ---------- boot ----------
  show('title');
  // Debug/testing hook (used by the automated check): window.SharedRiver.state()
  window.SharedRiver = { state: () => game };
})();
