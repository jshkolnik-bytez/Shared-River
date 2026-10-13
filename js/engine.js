/*
 * Shared River — the rules engine.
 * Pure game logic: no screens, no sound. Works in the browser and in Node
 * (tools/simulate.js uses it to test the balance).
 */
(function (root) {
  const isNode = typeof window === 'undefined' && typeof require !== 'undefined';
  const CFG = isNode ? require('./config.js') : root.CONFIG;
  const TXT = isNode ? require('./content.js') : root.CONTENT;
  const { ORDER, LEVELS, EVENTS } = TXT;

  // ---------- helpers ----------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const isDry = (rainKey) => rainKey === 'dry' || rainKey === 'drought';

  // Seeded random numbers so a game can be saved and replayed exactly.
  function rand(state) {
    let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (state, list) => list[Math.floor(rand(state) * list.length)];

  // The 20 turns, in order.
  const SCHEDULE = [];
  LEVELS.forEach((level, li) => {
    level.years.forEach((label, yi) => {
      SCHEDULE.push({ levelIndex: li, label, yearInLevel: yi, lastInLevel: yi === level.years.length - 1 });
    });
  });
  const TOTAL_TURNS = SCHEDULE.length;

  // ---------- new game ----------
  function newGame(player, seed) {
    const c = {};
    ORDER.forEach((id) => (c[id] = { needs: CFG.needsStart, budget: CFG.budgetStart }));
    return {
      v: 1,
      player,
      rng: (seed === undefined ? Math.floor(Math.random() * 2 ** 32) : seed) >>> 0,
      turn: 0,
      trust: CFG.trustStart,
      c,
      reservoir: 0,
      construction: 0,
      lightsOn: CFG.lightsOnStart,
      egyptReserve: CFG.egyptReserveStart,
      egyptSavings: 0,
      rule: null,
      forcedRain: null,
      lastEventKey: null,
      year: null,
      history: [],
      over: false,
      ending: null,
    };
  }

  const turnInfo = (state) => SCHEDULE[Math.min(state.turn, TOTAL_TURNS - 1)];
  const levelOf = (state) => LEVELS[turnInfo(state).levelIndex];

  function unlocked(state, feature) {
    const li = turnInfo(state).levelIndex;
    if (feature === 'talks') return li >= 1;
    if (feature === 'dam') return li >= 2;      // reservoir, rain cards, river math
    if (feature === 'release') return li >= 2;
    return true;
  }

  const ruleActive = (state) => !!state.rule && state.rule.signedTurn < state.turn;

  function actualStore(state, key) {
    const want = CFG.store[key] || 0;
    return clamp(want, -state.reservoir, CFG.reservoirMax - state.reservoir);
  }

  // ---------- start of a year ----------
  function drawEvent(state, info, rainForced) {
    const li = info.levelIndex;
    const pool = ['drought_warning', 'big_flood', 'turbine_delay', 'mediator_help', 'power_export', 'heatwave', 'election'].filter((k) => {
      if (k === state.lastEventKey) return false;
      if (k === 'drought_warning' && state.turn >= TOTAL_TURNS - 1) return false;
      if (k === 'big_flood' && rainForced) return false;
      if (k === 'power_export' && li < 2) return false;
      if (k === 'mediator_help' && li < 1) return false;
      return true;
    });
    return pick(state, pool);
  }

  function startYear(state) {
    if (state.year || state.over) return state.year;
    const info = turnInfo(state);
    const level = LEVELS[info.levelIndex];

    let rainKey;
    let rainForced = false;
    if (level.rains) { rainKey = level.rains[info.yearInLevel]; rainForced = true; }
    else if (state.forcedRain) { rainKey = state.forcedRain; rainForced = true; }
    else rainKey = pick(state, CFG.rainDie);
    state.forcedRain = null;

    const eventKey = (level.events && level.events[info.label]) || drawEvent(state, info, rainForced);
    if (eventKey === 'big_flood') rainKey = 'wet';
    if (eventKey === 'drought_warning') state.forcedRain = rand(state) < 0.5 ? 'dry' : 'drought';
    state.lastEventKey = eventKey;

    const widen = ['mediator_help', 'declaration', 'us_offer'].includes(eventKey) ? CFG.talks.eventWiden : 0;

    state.year = {
      turn: state.turn,
      label: info.label,
      levelIndex: info.levelIndex,
      rainKey,
      rain: CFG.rain[rainKey],
      eventKey,
      widen,
      talks: null,
      ai: {},
    };
    // Computer-run countries decide their diplomacy and Ethiopia its water plan up front,
    // so a player who receives shared data can see the plan.
    ORDER.forEach((id) => {
      if (id === state.player) return;
      state.year.ai[id] = { diplomacy: aiDiplomacy(state, id) };
    });
    if (state.player !== 'ethiopia') state.year.ai.ethiopia.water = aiEthiopiaWater(state, rainKey);
    return state.year;
  }

  // ---------- computer-run countries (same simple rules for everyone) ----------
  function aiDiplomacy(state, id) {
    const daily = ruleActive(state) && state.rule.dailyData;
    if (state.trust < CFG.ai.goAloneBelow) return 'alone';
    if (state.trust > CFG.ai.shareAbove && state.c[id].budget >= CFG.cost.shareData && !daily) return 'share';
    return 'quiet';
  }

  function aiEthiopiaWater(state, rainKey) {
    const budget = state.c.ethiopia.budget;
    if (!unlocked(state, 'dam')) {
      if (state.trust < CFG.ai.goAloneBelow && budget >= CFG.build.build_fast.cost) return 'build_fast';
      if (budget >= CFG.build.build_steady.cost) return 'build_steady';
      return 'build_slow';
    }
    if (state.trust < CFG.ai.goAloneBelow) return 'fill_fast';
    const rain = CFG.rain[rainKey];
    if (ruleActive(state) && isDry(rainKey)) {
      const ok = ['fill_fast', 'fill_steady', 'pause', 'release'].find((k) => rain - actualStore(state, k) >= state.rule.minRelease);
      return ok || 'release';
    }
    if (rainKey === 'wet') return 'fill_fast';
    if (rainKey === 'drought' && state.trust > CFG.ai.pauseInDroughtAbove) return 'pause';
    return 'fill_steady';
  }

  function aiSudanWater(state, knownRelease, rainKey) {
    // Same goodwill rule as Ethiopia: in a drought with high trust, don't hold extra water back.
    if (rainKey === 'drought' && state.trust > CFG.ai.pauseInDroughtAbove) return 'release_early';
    if (knownRelease !== null) return knownRelease >= CFG.floodThreshold ? 'release_early' : 'store';
    return rainKey === 'wet' ? 'release_early' : 'store';
  }

  function egyptNeed(state, eventKey) {
    return CFG.egyptNeed + (eventKey === 'heatwave' ? CFG.heatwaveExtra : 0) - state.egyptSavings;
  }

  function aiEgyptWater(state, knownRelease, year) {
    const guess = knownRelease !== null ? knownRelease
      : unlocked(state, 'dam') ? year.rain - actualStore(state, 'fill_steady') : year.rain;
    const flow = guess + CFG.otherRivers - CFG.sudanUse;
    if (flow < egyptNeed(state, year.eventKey)) return 'draw';
    if (state.c.egypt.budget >= CFG.cost.waterSaving + 1 && state.egyptSavings < CFG.egyptSavingMax) return 'save';
    return 'draw';
  }

  // What the player can see before deciding: Ethiopia's plan if Ethiopia shares data.
  function intel(state) {
    const y = state.year;
    if (!y || state.player === 'ethiopia') return null;
    const eth = y.ai.ethiopia;
    const sharing = eth.diplomacy === 'share' || (ruleActive(state) && state.rule.dailyData);
    if (!sharing) return { shared: false };
    if (!unlocked(state, 'dam')) return { shared: true, water: eth.water, release: y.rain };
    const store = actualStore(state, eth.water);
    return { shared: true, water: eth.water, store, release: y.rain - store };
  }

  // ---------- options shown to the player ----------
  function waterOptions(state) {
    const p = state.player;
    const budget = state.c[p].budget;
    const y = state.year;
    if (p === 'ethiopia') {
      if (!unlocked(state, 'dam')) {
        return ['build_fast', 'build_steady', 'build_slow'].map((key) => {
          const cost = CFG.build[key].cost;
          const enabled = key === 'build_slow' || budget >= cost;
          return { key, enabled, reason: enabled ? '' : `Needs ${cost} coins` };
        });
      }
      const keys = ['fill_fast', 'fill_steady', 'pause'];
      if (unlocked(state, 'release')) keys.push('release');
      return keys.map((key) => {
        const store = actualStore(state, key);
        const release = y.rain - store;
        let enabled = true;
        let reason = '';
        if (key === 'release' && state.reservoir <= 0) { enabled = false; reason = 'The lake is empty'; }
        let warn = '';
        if (ruleActive(state) && isDry(y.rainKey) && release < state.rule.minRelease) warn = `Breaks the rule (min ${state.rule.minRelease}): −20 trust`;
        let note = '';
        if (store !== (CFG.store[key] || 0)) note = store === 0 ? 'Lake is full: stores nothing' : `Only room for ${store}`;
        return { key, enabled, reason, store, release, warn, note };
      });
    }
    if (p === 'sudan') return ['store', 'release_early'].map((key) => ({ key, enabled: true }));
    return ['draw', 'save'].map((key) => {
      if (key === 'save') {
        if (state.egyptSavings >= CFG.egyptSavingMax) return { key, enabled: false, reason: 'All projects built' };
        if (budget < CFG.cost.waterSaving) return { key, enabled: false, reason: 'Needs 2 coins' };
      }
      return { key, enabled: true };
    });
  }

  function diplomacyOptions(state) {
    const budget = state.c[state.player].budget;
    const talks = unlocked(state, 'talks');
    return [
      { key: 'share', enabled: budget >= CFG.cost.shareData, reason: 'Needs 1 coin' },
      { key: 'quiet', enabled: true },
      { key: 'propose', enabled: talks, reason: 'Unlocks in level 2', locked: !talks },
      { key: 'mediator', enabled: talks && budget >= CFG.cost.mediator, reason: talks ? 'Needs 1 coin' : 'Unlocks in level 2', locked: !talks },
      { key: 'alone', enabled: true },
    ].map((o) => (o.enabled ? { key: o.key, enabled: true } : o));
  }

  // ---------- talks ----------
  function talkRanges(state, widen) {
    const T = state.trust;
    const t = CFG.talks;
    const W = Math.min(t.maxWiden, widen || 0);
    const k = (T - 50) * t.trustSlope;
    const lo = t.minRelease, hi = t.maxRelease;
    return {
      ethiopia: { lo, hi: clamp(Math.floor(t.ethiopiaMax + k + W / 2), lo, t.ethiopiaCap), dataOk: T > t.ethiopiaDataTrust - W / 2 },
      egypt: { lo: clamp(Math.ceil(t.egyptMin - k - W / 2), lo, hi), hi, dataOk: true },
      sudan: { lo: clamp(Math.ceil(t.sudanMin - (T - 50) * t.sudanSlope - W / 2), lo, hi), hi, dataOk: true, wantsData: T < t.sudanNoDataTrust },
    };
  }

  function talksWiden(state, mediatorKey) {
    const y = state.year;
    return Math.min(CFG.talks.maxWiden, (y ? y.widen : 0) + (mediatorKey ? CFG.talks.mediatorWiden : 0));
  }

  function replyFor(id, m, data, r) {
    if (id === 'ethiopia') {
      if (m > r.hi) return { yes: false, text: `Ethiopia says a ${m}-unit minimum in dry years would leave the lake too low to make power. It could accept up to ${r.hi}.` };
      if (data && !r.dataOk) return { yes: false, text: 'Ethiopia says it is not ready to share data every day at this level of trust.' };
      return { yes: true, text: 'Ethiopia says it can live with this rule, as long as it can still fill and run the dam.' };
    }
    if (id === 'egypt') {
      if (m < r.lo) return { yes: false, text: `Egypt says ${m} units would not protect it in a drought. It wants at least ${r.lo}.` };
      return { yes: true, text: 'Egypt says a written drought rule is what it has asked for since 2015.' };
    }
    if (m < r.lo) return { yes: false, text: `Sudan says ${m} units is too little for its farms in a dry year. It wants at least ${r.lo}.` };
    if (!data && r.wantsData) return { yes: false, text: 'Sudan says it will only sign if data is shared daily, to keep Roseires Dam safe.' };
    return { yes: true, text: 'Sudan says shared rules make the river safer for Khartoum.' };
  }

  // Run talks once this year. Records the outcome; trust changes apply when the year ends.
  function holdTalks(state, proposal, mediatorKey) {
    const y = state.year;
    if (!y || y.talks) return y && y.talks;
    const m = clamp(Math.round(proposal.minRelease), CFG.talks.minRelease, CFG.talks.maxRelease);
    const data = !!proposal.dailyData;
    const widen = talksWiden(state, mediatorKey);
    const ranges = talkRanges(state, widen);
    const replies = {};
    ORDER.forEach((id) => {
      if (id === state.player) replies[id] = { yes: true, text: 'You proposed this rule.' };
      else replies[id] = replyFor(id, m, data, ranges[id]);
    });
    const accepted = ORDER.every((id) => replies[id].yes);
    y.talks = { minRelease: m, dailyData: data, mediator: mediatorKey || null, widen, accepted, replies };
    return y.talks;
  }

  // ---------- end of a year ----------
  function resolveYear(state, choice) {
    const y = state.year;
    if (!y) throw new Error('startYear() first');
    const info = turnInfo(state);
    const p = state.player;
    const T = CFG.trust;
    const S = CFG.score;
    const damOn = unlocked(state, 'dam');
    const dry = isDry(y.rainKey);
    const ev = y.eventKey;
    const ruleOn = ruleActive(state);
    const rule = state.rule;

    const before = {
      trust: state.trust,
      reservoir: state.reservoir,
      lightsOn: state.lightsOn,
      egyptReserve: state.egyptReserve,
      needs: {}, budget: {},
    };
    ORDER.forEach((id) => { before.needs[id] = state.c[id].needs; before.budget[id] = state.c[id].budget; });

    const trustItems = [];
    const addTrust = (amount, text) => { if (amount) trustItems.push({ amount, text }); };
    const scores = { ethiopia: 0, sudan: 0, egypt: 0 };

    // --- 1. Everyone's choices ---
    const dip = {};
    const water = {};
    ORDER.forEach((id) => {
      if (id === p) { dip[id] = choice.diplomacy; water[id] = choice.water; }
      else dip[id] = y.ai[id].diplomacy;
    });
    if (p !== 'ethiopia') water.ethiopia = y.ai.ethiopia.water;

    // Spending: anything a country can't afford falls back to staying quiet.
    const spend = (id, amount) => {
      const paid = Math.min(amount, state.c[id].budget);
      state.c[id].budget -= paid;
      return paid;
    };
    ORDER.forEach((id) => {
      if (dip[id] === 'share') { if (state.c[id].budget >= CFG.cost.shareData) spend(id, CFG.cost.shareData); else dip[id] = 'quiet'; }
      if (dip[id] === 'mediator') spend(id, CFG.cost.mediator);
    });
    const shared = {};
    ORDER.forEach((id) => (shared[id] = dip[id] === 'share' || (ruleOn && rule.dailyData)));

    // --- 2. Ethiopia: build or store ---
    let store = 0;
    const delay = ev === 'turbine_delay' ? 0.5 : 1;
    if (!damOn) {
      const b = CFG.build[water.ethiopia] || CFG.build.build_slow;
      spend('ethiopia', b.cost);
      state.construction = Math.min(100, state.construction + b.progress * delay);
      scores.ethiopia = b.score + (ev === 'turbine_delay' ? S.turbineDelayBuild : 0);
      if (b.trust < 0) addTrust(b.trust, 'Ethiopia builds fast; its neighbours get nervous');
      if (b.trust > 0) addTrust(b.trust, 'Ethiopia slows building to give talks room');
    } else {
      store = actualStore(state, water.ethiopia);
      state.reservoir += store;
      state.construction = Math.min(100, state.construction + CFG.autoBuildPerYear);
    }
    const release = y.rain - store;
    const knownRelease = shared.ethiopia ? release : null;
    if (p !== 'sudan') water.sudan = aiSudanWater(state, knownRelease, y.rainKey);
    if (p !== 'egypt') water.egypt = aiEgyptWater(state, knownRelease, y);

    let powerFrac = 0;
    if (damOn) {
      const turbines = Math.min(1, state.construction / 100);
      powerFrac = (state.reservoir / CFG.reservoirMax) * turbines * delay;
      state.lightsOn = Math.min(100, Math.round((state.lightsOn + CFG.maxPowerGainPerYear * powerFrac) * 10) / 10);
      scores.ethiopia = S.ethiopiaPowerBase + (100 - S.ethiopiaPowerBase) * powerFrac;
      if (state.lightsOn >= CFG.lightsOnGoal) scores.ethiopia += S.lightsGoalBonus;

      if (dry && store >= CFG.store.fill_fast) addTrust(shared.ethiopia ? T.fastFillDry / 2 : T.fastFillDry, `Ethiopia fills fast in a ${y.rainKey} year`);
      else if (y.rainKey === 'drought' && store >= CFG.store.fill_steady) addTrust(shared.ethiopia ? T.steadyFillDrought / 2 : T.steadyFillDrought, 'Ethiopia keeps filling in a drought');
      else if (dry && (store < 0 || (store === 0 && before.reservoir < CFG.reservoirMax))) addTrust(T.pauseInDry, store < 0 ? 'Ethiopia releases extra water in a dry year' : 'Ethiopia pauses filling in a dry year');
      else if (y.rainKey === 'normal' && store >= CFG.store.fill_fast && !shared.ethiopia) addTrust(T.fastFillNoData, 'Ethiopia fills fast without sharing its plan');
    }

    // Signed rule check (only once there is a dam to run)
    let ruleEvent = null;
    if (ruleOn && damOn && dry) {
      if (release >= rule.minRelease) { ruleEvent = 'kept'; addTrust(T.ruleKept, `The drought rule holds: ${release} ≥ ${rule.minRelease} released`); }
      else { ruleEvent = 'broken'; addTrust(T.ruleBroken, `Rule broken: only ${release} released, the rule says ${rule.minRelease}`); }
    }

    // --- 3. Sudan ---
    const sudanUse = CFG.sudanUse + (water.sudan === 'store' ? CFG.sudanStoreExtra : 0);
    const threshold = CFG.floodThreshold + (water.sudan === 'release_early' ? CFG.releaseEarlyBonus : 0);
    const flood = release >= threshold;
    const sudanShort = release < CFG.sudanShortLine;
    let sudanScore = S.sudanBase;
    if (flood) {
      if (water.sudan === 'store' && !shared.ethiopia) sudanScore += S.sudanFloodRoseiresRisk;
      else sudanScore += shared.ethiopia ? S.sudanFlood / 2 : S.sudanFlood;
      if (!shared.ethiopia) addTrust(T.floodNoData, 'Sudan floods without warning');
    }
    if (sudanShort) sudanScore += S.sudanShort;
    if (damOn && !flood && !sudanShort) sudanScore += S.sudanRegulated;
    if (water.sudan === 'store') sudanScore += S.sudanStore;
    if (water.sudan === 'release_early') sudanScore += S.sudanReleaseEarly;
    if (ruleOn && rule.dailyData) sudanScore += S.sudanDailyData;
    if (ev === 'power_export') sudanScore += S.powerDeal;
    if (damOn && state.reservoir > 0 && before.trust >= 50) sudanScore += S.sudanCheapPower;
    scores.sudan = sudanScore;

    // --- 4. Egypt ---
    const need = egyptNeed(state, ev);
    const flow = release + CFG.otherRivers - sudanUse;
    const shortageFlow = Math.max(0, need - flow);
    const drawn = water.egypt === 'draw' ? Math.min(shortageFlow, state.egyptReserve) : 0;
    state.egyptReserve -= drawn;
    const remaining = shortageFlow - drawn;
    const surplus = Math.max(0, flow - need);
    state.egyptReserve = Math.min(CFG.egyptReserveMax, state.egyptReserve + surplus);
    if (water.egypt === 'save') {
      spend('egypt', CFG.cost.waterSaving);
      state.egyptSavings = Math.min(CFG.egyptSavingMax, state.egyptSavings + CFG.egyptSavingStep);
    }
    let egyptScore = S.egyptBase + S.egyptPerShortUnit * remaining
      + S.egyptReservePoints * (state.egyptReserve / CFG.egyptReserveMax)
      + S.egyptPerSavedUnit * state.egyptSavings;
    if (ruleOn && rule.minRelease >= S.egyptDroughtRuleMin) egyptScore += S.egyptDroughtRule;
    scores.egypt = egyptScore;
    if (shortageFlow >= T.bigShortageLine) addTrust(T.egyptBigShortage, `Egypt says it was left ${shortageFlow} units short`);

    // --- 5. Diplomacy ---
    const shareGain = ev === 'drought_warning' ? T.shareData * 2 : T.shareData;
    const name = (id) => TXT.COUNTRIES[id].name;
    const election = {};
    ORDER.forEach((id) => {
      if (dip[id] === 'share') addTrust(id === p ? shareGain : Math.round(shareGain * T.shareDataComputer / T.shareData), `${name(id)} shares data${ev === 'drought_warning' ? ' (double: drought warning)' : ''}`);
      if (dip[id] === 'alone') {
        addTrust(id === p ? T.goAlonePlayer : T.goAloneComputer, `${name(id)} goes it alone`);
        scores[id] += S.goAlone;
        if (ev === 'election') election[id] = S.electionBonus;
      }
    });
    let talks = y.talks;
    if ((dip[p] === 'propose' || dip[p] === 'mediator') && talks) {
      if (talks.mediator) addTrust(T.mediator, `${TXT.MEDIATORS[talks.mediator].name} mediates the talks`);
      if (talks.accepted) {
        state.rule = { minRelease: talks.minRelease, dailyData: talks.dailyData, signedTurn: state.turn, label: y.label };
        ruleEvent = 'signed';
        addTrust(T.ruleSigned, 'All three countries sign a rule');
      } else if (!talks.mediator) addTrust(T.talksFailed, 'Talks end without a deal');
    } else talks = null;
    if (ruleOn && rule.dailyData) addTrust(T.dailyData, 'Daily data keeps flowing under the rule');
    if (!state.rule) addTrust(T.noAgreementDrift, 'Still no binding agreement');
    addTrust(T.baseDrift, 'Old suspicions on all sides');

    // --- 6. Budgets ---
    const income = { ethiopia: CFG.income.ethiopia, sudan: CFG.income.sudan, egypt: CFG.income.egypt };
    if (damOn) income.ethiopia += Math.floor(state.reservoir / CFG.powerSalesPer);
    if (before.trust >= CFG.aidTrustLine) ORDER.forEach((id) => (income[id] += 1));
    if (!flood && !sudanShort) income.sudan += CFG.goodYearBonus;
    if (remaining === 0) income.egypt += CFG.goodYearBonus;
    if (ev === 'power_export') { income.ethiopia += 3; income.sudan += 1; }
    ORDER.forEach((id) => (state.c[id].budget = Math.min(CFG.budgetMax, state.c[id].budget + income[id])));

    // --- 7. Needs meters follow this year's score ---
    ORDER.forEach((id) => {
      const s = clamp(scores[id], 0, 100);
      scores[id] = Math.round(s);
      const c = state.c[id];
      c.needs = clamp(c.needs + Math.round((s - c.needs) * CFG.needsSmoothing) + (election[id] || 0), 0, 100);
    });

    // --- 8. Trust: gains shrink when trust is already high ---
    const fall = clamp(1 - Math.max(0, before.trust - CFG.trustGainFalloffStart) / CFG.trustGainFalloffRange, 0, 1);
    let delta = 0;
    trustItems.forEach((t) => (delta += t.amount > 0 ? t.amount * fall : t.amount));
    state.trust = clamp(Math.round(before.trust + delta), 0, 100);

    // --- 9. Record the year ---
    const result = {
      turn: state.turn,
      label: y.label,
      levelIndex: info.levelIndex,
      lastInLevel: info.lastInLevel,
      rainKey: y.rainKey,
      rain: y.rain,
      eventKey: ev,
      damOn,
      water, dip, shared,
      store, release, threshold, flood, sudanShort, sudanUse,
      egypt: { need, flow, shortageFlow, drawn, remaining },
      ruleEvent, talks,
      trustItems, trustFalloff: fall,
      scores,
      before,
      after: {
        trust: state.trust,
        reservoir: state.reservoir,
        lightsOn: state.lightsOn,
        egyptReserve: state.egyptReserve,
        construction: state.construction,
        needs: Object.fromEntries(ORDER.map((id) => [id, state.c[id].needs])),
        budget: Object.fromEntries(ORDER.map((id) => [id, state.c[id].budget])),
      },
    };
    state.history.push(result);
    state.year = null;
    state.turn += 1;

    if (state.trust <= 0) { state.over = true; state.ending = 'crisis'; state.endedEarly = true; }
    else if (state.turn >= TOTAL_TURNS) { state.over = true; state.ending = endingFor(state); }
    return result;
  }

  function endingFor(state) {
    const needsHigh = state.c[state.player].needs >= CFG.highNeeds;
    const trustHigh = state.trust >= CFG.highTrust;
    if (needsHigh && trustHigh) return 'shared';
    if (needsHigh) return 'hollow';
    if (trustHigh) return 'neighbour';
    return 'crisis';
  }

  // ---------- "Meanwhile in…" cards ----------
  function tally(state, levelIndex) {
    const years = state.history.filter((h) => h.levelIndex === levelIndex);
    const p = state.player;
    const t = {
      years: years.length,
      pShare: years.filter((h) => h.dip[p] === 'share').length,
      pAlone: years.filter((h) => h.dip[p] === 'alone').length,
      ethShare: years.filter((h) => h.shared.ethiopia).length,
      floods: years.filter((h) => h.flood).length,
      floodsNoData: years.filter((h) => h.flood && !h.shared.ethiopia).length,
      sudanShort: years.filter((h) => h.sudanShort).length,
      egyptShort: years.filter((h) => h.egypt.remaining > 0).length,
      fastDry: years.filter((h) => h.damOn && isDry(h.rainKey) && h.store >= 20).length,
      pauseDry: years.filter((h) => h.damOn && isDry(h.rainKey) && h.store <= 0).length,
      signed: years.filter((h) => h.ruleEvent === 'signed').length,
      broken: years.filter((h) => h.ruleEvent === 'broken').length,
      kept: years.filter((h) => h.ruleEvent === 'kept').length,
      othersAlone: years.filter((h) => ORDER.some((id) => id !== p && h.dip[id] === 'alone')).length,
    };
    return t;
  }

  function meanwhile(state, levelIndex) {
    const t = tally(state, levelIndex);
    const p = state.player;
    const you = TXT.COUNTRIES[p].name;
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    const cards = [];
    ORDER.filter((id) => id !== p).forEach((id) => {
      const lines = [];
      if (id === 'egypt') {
        if (t.fastDry) lines.push(`Officials in Cairo say Ethiopia filled fast in ${plural(t.fastDry, 'dry year')}. Egypt says this is exactly why it wants a binding drought rule.`);
        if (t.pauseDry) lines.push('Egypt’s water ministry welcomed Ethiopia pausing the filling when the rains failed.');
        if (t.egyptShort) lines.push(`Farmers in the Nile Delta felt ${plural(t.egyptShort, 'short year')}.`);
        else lines.push('Lake Nasser stayed comfortable. Egypt says it is watching the next dry year closely.');
        if (t.pShare >= Math.ceil(t.years / 2)) lines.push(`Egypt says ${you}’s regular data reports helped it plan.`);
        if (t.pAlone) lines.push(`Newspapers in Cairo call ${you}’s go-it-alone moves a warning sign.`);
        if (t.signed) lines.push('Egypt says a written rule is the first step it has wanted for years.');
        if (t.broken) lines.push('Egypt says a broken rule is worse than no rule at all.');
        if (lines.length < 2) lines.push('Egypt says it still wants a binding agreement with rules for droughts.');
      } else if (id === 'sudan') {
        if (t.floods) lines.push(`Khartoum counted ${plural(t.floods, 'flood year')} along the Blue Nile${t.floodsNoData ? ', some with no warning' : ''}.`);
        if (t.floodsNoData) lines.push('Sudan says it needs daily data to keep Roseires Dam safe.');
        if (!t.floods && levelIndex >= 2) lines.push('Engineers at Roseires say the steadier river made planning easier.');
        if (t.sudanShort) lines.push(`Farmers on the Gezira scheme ran short in ${plural(t.sudanShort, 'year')}.`);
        if (t.pAlone) lines.push(`Sudan’s ministers say ${you}’s go-it-alone moves leave them caught in the middle.`);
        if (t.pShare) lines.push(`Sudan says ${you}’s data reports were useful.`);
        if (t.signed) lines.push('Sudan says a signed rule makes the river safer for Khartoum.');
        if (lines.length < 2) lines.push('Sudan says it is still waiting for a binding agreement on how the dam is run.');
      } else {
        const lights = Math.round(state.history.filter((h) => h.levelIndex === levelIndex).slice(-1)[0].after.lightsOn);
        lines.push(`In Addis Ababa, about ${lights}% of people now have electricity.`);
        if (t.pAlone) lines.push(`Ethiopia argues ${you}’s go-it-alone moves show its neighbours want to hold back its development.`);
        if (t.pShare) lines.push(`Ethiopia says ${you}’s data sharing shows the river can be managed together.`);
        if (t.signed) lines.push('Ethiopia says it can live with the rule, as long as it can still fill and run the dam.');
        if (t.pauseDry) lines.push('Some Ethiopians ask why the dam they paid for paused in dry years; the government argues it was a goodwill gesture.');
        if (lines.length < 2) lines.push('Ethiopia argues the dam is a national project its own citizens paid for, on a river that starts on its land.');
      }
      cards.push({ id, capital: TXT.COUNTRIES[id].capital, lines: lines.slice(0, 3) });
    });
    return cards;
  }

  // ---------- "Your choices vs what really happened" ----------
  function compare(state) {
    const h = state.history;
    const p = state.player;
    const end2024 = h.filter((x) => x.label === 2024)[0];
    const sharedCount = h.filter((x) => x.dip[p] === 'share').length;
    const rows = [];
    rows.push({
      topic: 'Agreement',
      you: state.rule
        ? `You signed a rule in ${state.rule.label}: at least ${state.rule.minRelease} units released in dry years${state.rule.dailyData ? ', with daily data sharing' : ''}.`
        : 'You never got all three countries to sign a rule.',
      real: 'No binding agreement had been reported by early 2026. The 2015 Declaration of Principles did not set filling rules.',
    });
    rows.push({
      topic: 'Filling',
      you: end2024 ? `The lake held ${end2024.after.reservoir} of 74 units by the end of 2024.` : 'Your game ended before the filling years were over.',
      real: 'Five fillings from 2020 to 2024 brought the reservoir to its full level of 640 m.',
    });
    rows.push({
      topic: 'Power',
      you: `“Lights on” in Ethiopia reached ${Math.round(state.lightsOn)}%.`,
      real: 'At the 2025 inauguration, nearly 45% of Ethiopians still had no electricity.',
    });
    rows.push({
      topic: 'Data',
      you: `You shared data in ${sharedCount} of ${h.length} years.`,
      real: 'Sudan and Egypt have asked for binding data sharing on how the dam is run; the sources for this game report no such deal.',
    });
    rows.push({
      topic: 'Talks',
      you: `Regional trust finished at ${state.trust} out of 100.`,
      real: 'Talks stalled several times. In January 2026 the US offered to restart mediation.',
    });
    return rows;
  }

  const Engine = {
    CFG, SCHEDULE, TOTAL_TURNS,
    newGame, startYear, resolveYear, holdTalks, talkRanges, talksWiden,
    waterOptions, diplomacyOptions, intel, unlocked, ruleActive, actualStore,
    turnInfo, levelOf, endingFor, meanwhile, compare, tally, isDry, egyptNeed,
  };
  root.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
