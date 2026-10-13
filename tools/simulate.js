#!/usr/bin/env node
/*
 * Balance tester: plays thousands of games with simple strategies and
 * prints which endings happen. Run:  node tools/simulate.js [games]
 * Week 5 goal: "tune the numbers so every ending can actually happen".
 */
const Engine = require('../js/engine.js');
const { ORDER } = require('../js/content.js');

const GAMES = Number(process.argv[2]) || 2000;

function choose(list, rand) { return list[Math.floor(rand() * list.length)]; }

function tryTalks(state, mine, preferHigh) {
  // Find a minimum release everyone accepts; with a mediator if needed.
  for (const mediator of [null, 'au']) {
    if (mediator && state.c[state.player].budget < 1) continue;
    const r = Engine.talkRanges(state, Engine.talksWiden(state, mediator));
    let lo = 0, hi = 40, dataOk = true, needData = false;
    ORDER.filter((id) => id !== mine).forEach((id) => {
      lo = Math.max(lo, r[id].lo); hi = Math.min(hi, r[id].hi);
      if (r[id].dataOk === false) dataOk = false;
      if (r[id].wantsData) needData = true;
    });
    if (lo <= hi && (dataOk || !needData)) {
      return { mediator, proposal: { minRelease: preferHigh ? hi : lo, dailyData: dataOk } };
    }
  }
  return null;
}

const STRATEGIES = {
  cooperative(state, rand) {
    const p = state.player;
    const y = state.year;
    const water = Engine.waterOptions(state).filter((o) => o.enabled && !o.warn);
    let w;
    if (p === 'ethiopia') {
      if (!Engine.unlocked(state, 'dam')) w = 'build_steady';
      else if (y.rainKey === 'wet') w = 'fill_fast';
      else if (y.rainKey === 'normal') w = 'fill_steady';
      else if (y.rainKey === 'dry') w = 'pause';
      else w = state.reservoir >= 40 ? 'release' : 'pause';
      if (!water.find((o) => o.key === w)) w = water[water.length - 1].key;
    } else if (p === 'sudan') {
      const intel = Engine.intel(state);
      w = (intel && intel.shared ? intel.release >= 50 : y.rainKey === 'wet') ? 'release_early' : 'store';
    } else {
      w = Engine.isDry(y.rainKey) || state.c.egypt.budget < 3 || state.egyptSavings >= 10 ? 'draw' : 'save';
    }
    let d = state.c[p].budget >= 1 ? 'share' : 'quiet';
    if (Engine.unlocked(state, 'talks') && !state.rule) {
      const t = tryTalks(state, p, p === 'egypt');
      if (t) {
        d = t.mediator ? 'mediator' : 'propose';
        Engine.holdTalks(state, t.proposal, t.mediator);
      }
    }
    return { water: w, diplomacy: d };
  },
  selfish(state) {
    const p = state.player;
    let w = { ethiopia: Engine.unlocked(state, 'dam') ? 'fill_fast' : 'build_fast', sudan: 'store', egypt: 'draw' }[p];
    if (!Engine.waterOptions(state).find((o) => o.key === w && o.enabled)) w = Engine.waterOptions(state).find((o) => o.enabled).key;
    return { water: w, diplomacy: 'alone' };
  },
  // Selfish, but shares data when trust gets dangerously low.
  canny(state) {
    const c = STRATEGIES.selfish(state);
    if (state.trust < 40 && state.c[state.player].budget >= 1) c.diplomacy = 'share';
    if (state.player === 'ethiopia' && Engine.unlocked(state, 'dam') && state.year.rainKey === 'drought') c.water = 'fill_steady';
    return c;
  },
  // Plays for itself but keeps talks alive: shares data when trust slips.
  careful(state, rand) {
    const p = state.player;
    const y = state.year;
    const c = STRATEGIES.selfish(state);
    if (p === 'ethiopia' && Engine.unlocked(state, 'dam')) c.water = y.rainKey === 'drought' ? 'pause' : y.rainKey === 'dry' ? 'fill_steady' : 'fill_fast';
    if (p === 'ethiopia' && !Engine.unlocked(state, 'dam') && state.c.ethiopia.budget < 4) c.water = 'build_steady';
    if (p === 'egypt' && state.c.egypt.budget >= 3 && state.egyptSavings < 10 && !Engine.isDry(y.rainKey)) c.water = 'save';
    if (state.trust < 45 && state.c[p].budget >= 1) c.diplomacy = 'share';
    else if (state.trust < 45) c.diplomacy = 'quiet';
    if (!Engine.waterOptions(state).find((o) => o.key === c.water && o.enabled)) c.water = Engine.waterOptions(state).find((o) => o.enabled).key;
    return c;
  },
  // Cooperative diplomacy with a sensible water plan for itself.
  smart(state, rand) {
    const c = STRATEGIES.cooperative(state, rand);
    const careful = STRATEGIES.careful(state, rand);
    const y = state.year;
    if (state.player === 'ethiopia' && Engine.unlocked(state, 'dam')) {
      c.water = { wet: 'fill_fast', normal: 'fill_fast', dry: 'fill_steady', drought: 'pause' }[y.rainKey];
      const ok = Engine.waterOptions(state).filter((o) => o.enabled && !o.warn);
      if (!ok.find((o) => o.key === c.water)) c.water = ok[ok.length - 1].key;
    } else if (state.player !== 'ethiopia') c.water = careful.water;
    return c;
  },
  // Gives everything away: cooperative diplomacy, worst water plan for itself.
  generous(state, rand) {
    const c = STRATEGIES.cooperative(state, rand);
    const p = state.player;
    if (p === 'ethiopia') c.water = Engine.unlocked(state, 'dam') ? (state.reservoir > 0 && Engine.unlocked(state, 'release') ? 'release' : 'pause') : 'build_slow';
    if (p === 'sudan') c.water = 'release_early';
    if (p === 'egypt') c.water = 'save';
    if (!Engine.waterOptions(state).find((o) => o.key === c.water && o.enabled)) c.water = Engine.waterOptions(state).find((o) => o.enabled).key;
    return c;
  },
  random(state, rand) {
    const w = choose(Engine.waterOptions(state).filter((o) => o.enabled), rand).key;
    const dOpts = Engine.diplomacyOptions(state).filter((o) => o.enabled).map((o) => o.key);
    let d = choose(dOpts, rand);
    if (d === 'propose' || d === 'mediator') {
      Engine.holdTalks(state, { minRelease: Math.floor(rand() * 41), dailyData: rand() < 0.5 }, d === 'mediator' ? 'un' : null);
    }
    return { water: w, diplomacy: d };
  },
};

function mulberry(seed) {
  return () => {
    let t = (seed = (seed + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rows = [];
for (const country of ORDER) {
  for (const [name, strat] of Object.entries(STRATEGIES)) {
    const counts = { shared: 0, hollow: 0, neighbour: 0, crisis: 0 };
    let early = 0, earlyTurn = 0, needs = 0, trust = 0, rules = 0, lights = 0;
    for (let g = 0; g < GAMES; g++) {
      const rand = mulberry(g * 7919 + 1);
      const s = Engine.newGame(country, g + 1);
      while (!s.over) {
        Engine.startYear(s);
        Engine.resolveYear(s, strat(s, rand));
      }
      counts[s.ending]++;
      if (s.endedEarly) { early++; earlyTurn += s.turn; }
      needs += s.c[country].needs; trust += s.trust; lights += s.lightsOn;
      if (s.rule) rules++;
    }
    const pct = (n) => `${Math.round((100 * n) / GAMES)}%`.padStart(4);
    rows.push(`${country.padEnd(9)} ${name.padEnd(12)} shared ${pct(counts.shared)}  hollow ${pct(counts.hollow)}  neighbour ${pct(counts.neighbour)}  crisis ${pct(counts.crisis)} (early ${pct(early)}${early ? ' @' + (earlyTurn / early).toFixed(0).padStart(2) : '   '})  | needs ${(needs / GAMES).toFixed(0).padStart(3)} trust ${(trust / GAMES).toFixed(0).padStart(3)} rule ${pct(rules)} lights ${(lights / GAMES).toFixed(0)}`);
  }
}
console.log(rows.join('\n'));
