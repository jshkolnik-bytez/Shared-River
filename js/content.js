/*
 * Shared River — all the words: countries, levels, cards, endings, sources.
 * Rule of thumb: write "Egypt says…" / "Ethiopia argues…", never one side's claim as fact.
 */
(function (root) {
  const COUNTRIES = {
    ethiopia: {
      id: 'ethiopia',
      name: 'Ethiopia',
      capital: 'Addis Ababa',
      position: 'Upstream',
      color: '#3fbf7f',
      needsLabel: 'Power & development',
      wants: 'Electricity for its people and power to sell to neighbours; the right to develop a river that starts on its land.',
      worries: 'Being held back by older Nile treaties it did not sign, and outside pressure on a project its own citizens paid for.',
      goal: 'Raise “lights on” to 80% while filling the reservoir.',
      blurb: 'You run the dam. Nearly 45% of about 130 million people have no electricity. Every unit you store makes power, but every unit you store is a unit your neighbours don’t get this year.',
    },
    sudan: {
      id: 'sudan',
      name: 'Sudan',
      capital: 'Khartoum',
      position: 'Middle',
      color: '#ef8a4c',
      needsLabel: 'Farms & flood safety',
      wants: 'Fewer floods, cheaper power and steadier water for farms; a binding agreement on how the dam is run.',
      worries: 'The safety of its own Roseires Dam if releases are not shared and planned together.',
      goal: 'Keep floods and shortages low and get a data-sharing deal.',
      blurb: 'You sit in the middle. The dam can protect you from floods, but only if you know what is coming. Your Roseires Dam is just downstream of the GERD.',
    },
    egypt: {
      id: 'egypt',
      name: 'Egypt',
      capital: 'Cairo',
      position: 'Downstream',
      color: '#f2c14e',
      needsLabel: 'Water security',
      wants: 'A steady Nile flow, which supplies about 90% of its water; a binding agreement with rules for droughts.',
      worries: 'Running short of water in dry years, with no say over how the dam is filled.',
      goal: 'Keep the water meter above the danger line and win a drought rule.',
      blurb: 'You are last in line. About 90% of your water comes from the Nile, and you need 55 units a year. Lake Nasser is your savings account for dry years.',
    },
  };

  const ORDER = ['ethiopia', 'sudan', 'egypt'];

  const RAIN = {
    wet:     { name: 'Wet',     icon: '🌧️', text: 'Heavy rains in the Ethiopian highlands.' },
    normal:  { name: 'Normal',  icon: '🌦️', text: 'An ordinary rainy season.' },
    dry:     { name: 'Dry',     icon: '🌤️', text: 'The rains came late and stopped early.' },
    drought: { name: 'Drought', icon: '☀️', text: 'The rains failed. Someone will have to give.' },
  };

  const EVENTS = {
    drought_warning: {
      name: 'Drought warning', icon: '📡',
      text: 'Forecasters expect next year to be Dry or Drought. Sharing data this year earns double trust.',
    },
    big_flood: {
      name: 'Big flood', icon: '🌊',
      text: 'Rain is Wet this year. Sudan floods unless Ethiopia fills fast — or Sudan lowers Roseires early.',
    },
    turbine_delay: {
      name: 'Turbine delay', icon: '⚙️',
      text: 'Parts arrive late. Ethiopia’s power gain (or building progress) is halved this year.',
    },
    mediator_help: {
      name: 'Mediator offers help', icon: '🤝',
      text: 'Talks are easier this year: the computer-run countries accept a wider range.',
    },
    power_export: {
      name: 'Power export deal', icon: '⚡',
      text: 'Ethiopia gains 3 coins selling electricity; Sudan pays less for power.',
    },
    heatwave: {
      name: 'Heatwave', icon: '🔥',
      text: 'Egypt needs 5 more units of water this year.',
    },
    election: {
      name: 'Election year', icon: '🗳️',
      text: 'Voters want strength at home: going it alone gives +10 to your needs meter.',
    },
    declaration: {
      name: 'Declaration of Principles', icon: '📜', history: true,
      text: 'History: in March 2015 the three leaders signed a Declaration of Principles in Khartoum. Talks are easier this year.',
    },
    us_offer: {
      name: 'A new mediation offer', icon: '✉️', history: true,
      text: 'History: in January 2026 the US President wrote to Egypt’s President offering to restart US-led mediation. Talks are easier this year.',
    },
  };

  const LEVELS = [
    {
      id: 1,
      name: 'Foundation stone',
      years: [2011, 2012, 2013, 2014],
      situation: 'Building starts; Ethiopia raises money at home.',
      newIdea: 'The meters, sharing data and the budget',
      tip: 'Watch the four meters on the left. Your needs meter follows how well each year goes for your country. Regional trust is shared by all three countries — if it ever hits 0, talks collapse and the game ends.',
      history: [
        ['2 April 2011', 'Construction of the Grand Ethiopian Renaissance Dam begins on the Blue Nile, about 14 km from the Sudan border.'],
        ['2011 onward', 'The dam costs about US$4–5 billion, paid mostly through Ethiopian bonds and donations.'],
        ['Why it matters', 'Nearly 45% of Ethiopia’s roughly 130 million people still live without electricity.'],
      ],
    },
    {
      id: 2,
      name: 'Talking it through',
      years: [2015, 2016, 2017, 2018, 2019],
      situation: 'The Declaration of Principles; US-hosted talks.',
      newIdea: 'Proposing a rule and inviting a mediator',
      tip: 'Diplomacy now has two new choices. Propose a rule to open talks with two sliders. Invite a mediator (African Union, US or UN) to make the others accept a wider range. The coloured zones on the slider show what each country will accept — they widen as trust rises.',
      events: { 2015: 'declaration' },
      history: [
        ['23 March 2015', 'Egypt, Ethiopia and Sudan sign the Declaration of Principles in Khartoum, agreeing to work toward filling rules and to avoid significant harm.'],
        ['Nov 2019 – 2020', 'US-hosted talks end without a deal.'],
      ],
    },
    {
      id: 3,
      name: 'Filling the lake',
      years: [2020, 2021, 2022, 2023, 2024],
      situation: 'Yearly fillings, the UN Security Council debate, first power.',
      newIdea: 'The reservoir, rain cards and the river math',
      tip: 'The dam is ready to hold water. Each year: Flow to Egypt = Rain − Stored by Ethiopia + 35 (other rivers) − 18 (used in Sudan). Egypt needs 55. Sudan floods if Ethiopia lets 50 or more through. Filling fast is safe in wet years — in a drought it hurts everyone downstream.',
      history: [
        ['July 2020', 'First filling; talks resume under the African Union.'],
        ['8 July 2021', 'The UN Security Council discusses the dispute.'],
        ['20 February 2022', 'First electricity: 375 MW.'],
        ['July–October 2024', 'Fifth and final filling brings the reservoir to its full level of 640 m.'],
      ],
    },
    {
      id: 4,
      name: 'Lights on',
      years: [2025, 2026],
      situation: 'The dam opens; Egypt protests at the UN; a new US mediation offer.',
      newIdea: 'Running a full dam: rules for every year, not just filling',
      tip: 'A full dam is a tool, not just a wall. Ethiopia can hold the lake high for power, or release extra water from it in a dry year. Signed rules still apply every year.',
      events: { 2026: 'us_offer' },
      history: [
        ['9 September 2025', 'Ethiopia inaugurates the dam; Egypt protests to the UN Security Council.'],
        ['16 January 2026', 'The US President writes to Egypt’s President offering to restart US-led mediation.'],
        ['February 2026', 'Ethiopia confirms the dam is fully complete. No binding agreement between the three countries has been reported.'],
      ],
    },
    {
      id: 5,
      name: 'What if: the long drought',
      years: ['What-if 1', 'What-if 2', 'What-if 3', 'What-if 4'],
      fiction: true,
      situation: 'Several dry years in a row — invented, and labelled as fiction.',
      newIdea: 'Whether the rules signed earlier hold under pressure',
      tip: 'This level is made up. It asks one question: when the rains fail year after year, do the rules you signed earlier still hold?',
      rains: ['dry', 'drought', 'drought', 'dry'],
      events: { 'What-if 1': 'drought_warning' },
      history: [
        ['Fiction', 'Everything in this level is invented. Scientists expect the Nile’s rainfall to stay highly variable, which is why the three countries keep arguing about drought rules.'],
        ['The real question', 'Egypt says it needs guaranteed releases in long droughts. Ethiopia argues a fixed guarantee would limit its right to use its own resources. Sudan wants the rules written down and the data shared.'],
      ],
    },
  ];

  const WATER_OPTIONS = {
    build_fast:   { name: 'Build fast',          tag: '3 coins', text: 'The wall rises quickly. Your people cheer; neighbours get nervous.' },
    build_steady: { name: 'Build steady',        tag: '2 coins', text: 'Keep a steady pace the bonds can pay for.' },
    build_slow:   { name: 'Slow down for talks', tag: '1 coin',  text: 'Give diplomacy room. Neighbours relax; people at home grumble.' },
    fill_fast:    { name: 'Fill fast',           tag: 'store 20', text: 'Fill the lake quickly for power sooner.' },
    fill_steady:  { name: 'Fill steady',         tag: 'store 10', text: 'A middle path: some power, some water passes.' },
    pause:        { name: 'Pause filling',       tag: 'store 0',  text: 'Let this year’s rain pass downstream.' },
    release:      { name: 'Release from the lake', tag: 'release 10', text: 'Send extra water downstream from the lake. Less power.' },
    store:        { name: 'Store at Roseires',   tag: '+5 for farms', text: 'Keep water behind Roseires Dam for farms. Risky if a big flow arrives without warning.' },
    release_early:{ name: 'Release early',       tag: 'flood-safe', text: 'Lower Roseires before the rains so it can absorb a big flow (floods only at 62+).' },
    draw:         { name: 'Draw on Lake Nasser', tag: 'use reserve', text: 'Use Egypt’s reserve to cover any shortage this year.' },
    save:         { name: 'Water-saving projects', tag: '2 coins', text: 'Canal lining and drip irrigation: Egypt needs 2 fewer units every year after. No reserve drawing this year.' },
  };

  const DIPLOMACY_OPTIONS = {
    share:    { name: 'Share data',        tag: '+5 trust · 1 coin', text: 'Send river and rainfall data to your neighbours.' },
    quiet:    { name: 'Stay quiet',        tag: 'free',             text: 'No move this year.' },
    propose:  { name: 'Propose a rule',    tag: 'opens talks',      text: 'Set a drought release and data rule. Both others must agree.' },
    mediator: { name: 'Invite a mediator', tag: '1 coin · wider talks', text: 'Talks with a mediator: the others accept a wider range. +2 trust.' },
    alone:    { name: 'Go it alone',       tag: '−10 trust',        text: 'Put home first. Free, and your people like it, but trust falls.' },
  };

  const MEDIATORS = {
    au: { name: 'African Union', note: 'Hosted the talks from July 2020.' },
    us: { name: 'United States', note: 'Hosted talks in 2019–2020 and offered to restart them in January 2026.' },
    un: { name: 'United Nations', note: 'The Security Council discussed the dispute in July 2021.' },
  };

  const ENDINGS = {
    shared: {
      name: 'Shared river',
      tagline: 'Lights on, fields watered, a signed agreement.',
      icon: '🌊',
      text: 'You met your country’s needs and kept your neighbours’ trust. Nobody got everything, but the river works for all three countries.',
    },
    hollow: {
      name: 'Hollow win',
      tagline: 'Your goals met, but borders tense and talks frozen.',
      icon: '🏆',
      text: 'Your own people are doing well, but your neighbours no longer trust you. The next drought could undo everything.',
    },
    neighbour: {
      name: 'Good neighbour',
      tagline: 'Trusted partner, but your own people still short.',
      icon: '🤝',
      text: 'The region trusts you and talks are alive, but your own country gave up too much. Leaders at home will ask why.',
    },
    crisis: {
      name: 'Crisis',
      tagline: 'Shortages everywhere and talks collapsed.',
      icon: '⚠️',
      text: 'Needs went unmet and trust ran out. When nobody talks, every dry year becomes an emergency.',
    },
  };

  const DAM_FACTS = [
    ['Reservoir', '74 billion m³ (74 units)'],
    ['Power', '5,150 MW from 13 turbines'],
    ['Size', '145 m high, 1,780 m long'],
    ['Cost', 'About US$4–5 billion'],
    ['Flow at the dam', 'About 49 billion m³ a year, out of about 84 for the whole Nile'],
    ['Inaugurated', '9 September 2025'],
  ];

  const SOURCES = [
    { title: 'Grand Ethiopian Renaissance Dam', outlet: 'Wikipedia', note: 'size, power, fillings, cost, timeline', url: 'https://en.wikipedia.org/wiki/Grand_Ethiopian_Renaissance_Dam' },
    { title: 'Ethiopia unveils Africa’s largest dam', outlet: 'Gulf News, September 2025', note: 'electricity access' },
    { title: 'Ethiopia inaugurates Grand Renaissance Dam, Egypt pushes back', outlet: 'Shafaq News, September 2025', note: 'Egypt’s and Sudan’s reactions' },
    { title: 'US re-engages in GERD dispute', outlet: 'Peoples Dispatch, January 2026', note: 'the US mediation offer and each side’s argument' },
    { title: 'The Declaration of Principles on Ethiopia’s Renaissance Dam', outlet: 'IDOS, March 2015', note: 'what the 2015 agreement says' },
  ];

  // The rules walkthrough shown after choosing a country: the parts that differ per country.
  const RULES = {
    ethiopia: {
      where: 'The Blue Nile starts in your highlands at Lake Tana. Your dam, the GERD, sits on it about 14 km before the Sudan border — so every drop you keep back is a drop Sudan and Egypt don’t get that year.',
      waterIntro: 'You control the dam. In levels 1–2 you are still building it; from 2020 you decide how much water to keep.',
      water: [
        ['Levels 1–2: Build fast / steady / slow', 'Costs 3, 2 or 1 coins. Faster makes your people happier but makes your neighbours nervous. Slowing down earns a little trust.'],
        ['Fill fast — store 20', 'Most power, soonest. Safe in a wet year (it even stops Sudan flooding). In a dry year it leaves Egypt short and costs trust.'],
        ['Fill steady — store 10', 'A middle path: some power, some water passes.'],
        ['Pause — store 0', 'All the rain flows on. No new power, but pausing in a dry year earns trust.'],
        ['Release from the lake — 10 extra', 'Sends stored water downstream to help in a drought. Your lake (and power) drops a little.'],
      ],
      meter: 'GERD lake (0–74 units) and “Lights on” — the share of Ethiopians with electricity. It starts at 55% and grows as your lake fills. Your goal is 80%.',
      tips: [
        'Fill fast in wet years — it’s safe and it protects Sudan from floods.',
        'In a drought, pausing (or releasing) earns trust and keeps Egypt off the danger line.',
        'Share data before big moves: surprises cost more trust than the moves themselves.',
      ],
    },
    sudan: {
      where: 'You sit in the middle. Water from Ethiopia’s GERD reaches your Roseires Dam first, then Khartoum, where it meets the White Nile and flows on to Egypt.',
      waterIntro: 'You run Roseires Dam. Your choice is about floods versus farms.',
      water: [
        ['Store at Roseires', 'Keep 5 extra units for your farms (good for your needs). But if a big flow arrives and nobody warned you, the flood hits much harder.'],
        ['Release early', 'Lower Roseires before the rains so it can soak up a big flow: you only flood at 62+ instead of 50+. Your farms get less this year.'],
      ],
      meter: '“So far” shows how many flood years and short years you have had. Floods (50+ from Ethiopia) and shortages (under 25) are what hurt you.',
      tips: [
        'Read the 📡 line every year: if Ethiopia shared its plan and 50+ is coming, release early.',
        'No data and a wet year? Release early to be safe.',
        'A daily data-sharing rule is your best friend — push for it in talks.',
      ],
    },
    egypt: {
      where: 'You are last in line. About 90% of your water comes from the Nile. Whatever Ethiopia stores and Sudan uses, you go without.',
      waterIntro: 'You can’t change the river upstream, but you can prepare for dry years.',
      water: [
        ['Draw on Lake Nasser', 'Your reserve behind the Aswan High Dam covers any shortage this year. It refills in years with extra water.'],
        ['Water-saving projects', 'Costs 2 coins. Canal lining and drip irrigation lower your need by 2 units every year after (up to 10). You don’t draw on Lake Nasser that year.'],
      ],
      meter: 'Lake Nasser reserve (0–40 units) — your savings account for dry years. You need 55 units a year (less after water-saving projects).',
      tips: [
        'Build water-saving projects in normal and wet years; draw on Lake Nasser in dry ones.',
        'Trust above 60 makes Ethiopia pause in droughts — your best protection.',
        'Win a drought rule in talks: a written minimum release protects you when it matters.',
      ],
    },
  };

  const CONTENT = { COUNTRIES, ORDER, RAIN, EVENTS, LEVELS, WATER_OPTIONS, DIPLOMACY_OPTIONS, MEDIATORS, ENDINGS, DAM_FACTS, SOURCES, RULES };
  root.CONTENT = CONTENT;
  if (typeof module !== 'undefined' && module.exports) module.exports = CONTENT;
})(typeof window !== 'undefined' ? window : globalThis);
