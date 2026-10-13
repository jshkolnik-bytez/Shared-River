#!/usr/bin/env node
/*
 * Checks that the game's river math matches the lookup table in the game plan.
 * Run:  node tools/check-river-table.js
 */
const CFG = require('../js/config.js');

// From the plan: what reaches Egypt for each mix of rain and filling speed.
const PLAN = {
  wet:     { fill_fast: '57',                  fill_steady: '67, flood in Sudan', pause: '77, flood in Sudan' },
  normal:  { fill_fast: '46, Egypt short 9',   fill_steady: '56',                 pause: '66' },
  dry:     { fill_fast: '35, Egypt short 20',  fill_steady: '45, Egypt short 10', pause: '55' },
  drought: { fill_fast: '25, Egypt short 30',  fill_steady: '35, Egypt short 20', pause: '45, Egypt short 10' },
};

let failures = 0;
for (const rainKey of Object.keys(PLAN)) {
  for (const plan of Object.keys(PLAN[rainKey])) {
    const rain = CFG.rain[rainKey];
    const stored = CFG.store[plan];
    const release = rain - stored;
    const flow = release + CFG.otherRivers - CFG.sudanUse;
    const parts = [String(flow)];
    if (release >= CFG.floodThreshold) parts.push('flood in Sudan');
    if (flow < CFG.egyptNeed) parts.push(`Egypt short ${CFG.egyptNeed - flow}`);
    const got = parts.join(', ');
    const ok = got === PLAN[rainKey][plan];
    if (!ok) failures++;
    console.log(`${ok ? '✓' : '✗'} ${rainKey.padEnd(8)} ${plan.padEnd(12)} ${got}${ok ? '' : `   (plan says: ${PLAN[rainKey][plan]})`}`);
  }
}
console.log(failures ? `\n${failures} mismatch(es)` : '\nAll 12 cells match the plan.');
process.exit(failures ? 1 : 0);
