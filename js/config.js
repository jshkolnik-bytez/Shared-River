/*
 * Shared River — every game number lives here.
 * Balancing the game means changing numbers in this file, not code.
 * One "water unit" = 1 billion m³. All values are simplified game values.
 */
(function (root) {
  const CONFIG = {
    // ---- River -------------------------------------------------------
    rain: { wet: 60, normal: 49, dry: 38, drought: 28 },
    // Paper-version die: 1 = Drought, 2–3 = Dry, 4–5 = Normal, 6 = Wet
    rainDie: ['drought', 'dry', 'dry', 'normal', 'normal', 'wet'],
    otherRivers: 35,          // White Nile, Atbara and others reaching Egypt
    sudanUse: 18,             // used in Sudan every year
    sudanStoreExtra: 5,       // extra kept for farms when Sudan stores at Roseires
    floodThreshold: 50,       // Sudan floods when Ethiopia lets this much through
    releaseEarlyBonus: 12,    // Roseires lowered early can absorb this much more
    sudanShortLine: 25,       // below this, Sudan's farms run short
    egyptNeed: 55,
    heatwaveExtra: 5,
    egyptReserveStart: 30,    // Lake Nasser buffer (simplified)
    egyptReserveMax: 40,
    egyptSavingStep: 2,       // each water-saving project lowers Egypt's need by this
    egyptSavingMax: 10,

    // ---- Dam ---------------------------------------------------------
    reservoirMax: 74,
    store: { fill_fast: 20, fill_steady: 10, pause: 0, release: -10 },
    build: {                  // levels 1–2: building the dam
      build_fast:   { cost: 3, progress: 12, score: 70, trust: -3 },
      build_steady: { cost: 2, progress: 9,  score: 55, trust: 0 },
      build_slow:   { cost: 1, progress: 6,  score: 35, trust: 2 },
    },
    autoBuildPerYear: 10,     // construction progress per year from level 3
    lightsOnStart: 55,        // ~45% of Ethiopians without electricity
    lightsOnGoal: 80,
    maxPowerGainPerYear: 3.5, // lights-on points per year with a full lake

    // ---- Meters ------------------------------------------------------
    needsStart: 50,
    trustStart: 50,
    budgetStart: 10,
    budgetMax: 25,
    needsSmoothing: 0.4,      // how fast the needs meter follows each year's score
    highNeeds: 60,            // ending thresholds
    highTrust: 60,

    // ---- Trust changes -----------------------------------------------
    trust: {
      shareData: 5,
      shareDataComputer: 2,   // computer-run countries' sharing counts for less
      goAlonePlayer: -10,
      goAloneComputer: -3,
      mediator: 2,
      talksFailed: -2,
      ruleSigned: 10,
      ruleKept: 3,
      ruleBroken: -20,
      dailyData: 2,
      noAgreementDrift: -2,   // each year without any signed rule
      baseDrift: -1,          // old suspicions on all sides, every year
      fastFillDry: -8,        // Ethiopia stores 20 in a dry or drought year
      steadyFillDrought: -4,
      pauseInDry: 3,
      fastFillNoData: -3,     // normal year, stores 20 without sharing data
      floodNoData: -3,
      egyptBigShortage: -3,   // flow shortage of 15+ before Lake Nasser helps
      bigShortageLine: 15,
    },
    // Gains shrink as trust gets high: x1 at 50, x0.5 at 80
    trustGainFalloffStart: 50,
    trustGainFalloffRange: 50,

    // ---- Budget ------------------------------------------------------
    cost: { shareData: 1, mediator: 1, waterSaving: 2 },
    income: { ethiopia: 2, sudan: 2, egypt: 2 },
    powerSalesPer: 25,        // Ethiopia earns +1 coin per this many units in the lake
    aidTrustLine: 60,         // +1 coin aid for everyone when trust is at least this
    goodYearBonus: 1,

    // ---- Yearly "how did it go" scores (0–100) -----------------------
    score: {
      ethiopiaPowerBase: 25,    // + 75 × how much power the dam made
      lightsGoalBonus: 10,      // Ethiopia reached its 80% lights-on goal
      sudanBase: 40,
      sudanFlood: -40,
      sudanFloodRoseiresRisk: -55, // stored at Roseires and no warning
      sudanShort: -30,
      sudanRegulated: 10,
      sudanStore: 10,
      sudanReleaseEarly: -10,   // Roseires kept low: less irrigation and power
      sudanDailyData: 10,
      sudanCheapPower: 5,
      powerDeal: 10,
      egyptBase: 45,
      egyptReservePoints: 20,   // + up to this much for a full Lake Nasser
      egyptPerSavedUnit: 1,     // + this per unit of water saved by projects
      egyptPerShortUnit: -4,
      egyptDroughtRule: 10,
      egyptDroughtRuleMin: 25,  // a rule this strong counts as a "drought rule"
      goAlone: 10,
      electionBonus: 10,        // straight onto the needs meter
      turbineDelayBuild: -10,
    },

    // ---- Talks -------------------------------------------------------
    talks: {
      minRelease: 0,
      maxRelease: 40,
      ethiopiaMax: 20,        // Ethiopia accepts a minimum release up to this at trust 50
      ethiopiaCap: 28,        // …but never promises more than a drought year brings
      egyptMin: 34,           // Egypt wants at least this at trust 50
      sudanMin: 15,
      ethiopiaDataTrust: 40,  // Ethiopia agrees to daily data above this trust
      sudanNoDataTrust: 70,   // Sudan signs without daily data only above this
      trustSlope: 0.5,        // range widens by this per trust point above 50
      sudanSlope: 0.3,
      mediatorWiden: 15,
      eventWiden: 15,
      maxWiden: 25,
    },

    // ---- Computer-run countries (same rules for all) -----------------
    ai: {
      shareAbove: 40,
      pauseInDroughtAbove: 60,
      goAloneBelow: 25,
    },
  };

  root.CONFIG = CONFIG;
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
