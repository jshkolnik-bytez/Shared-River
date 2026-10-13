# Shared River

A short turn-based strategy game about the **Grand Ethiopian Renaissance Dam (GERD)**. You lead Ethiopia, Sudan or Egypt through about 20 years on the Blue Nile, balancing your own country's needs against trust with the other two. One game takes 15–20 minutes.

Made as a school project. The history is real; the game numbers are simplified (one water unit = 1 billion m³).

## Play

Open `index.html` in a browser. Nothing to install.

If your browser blocks local files, run a tiny local server from this folder:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## How the game works

- **Each year** you read the rain card (Wet 60, Normal 49, Dry 38, Drought 28) and one event card. Then you make two choices: a **water plan** and one **diplomacy** move.
- **River math:** Flow to Egypt = Rain − Stored by Ethiopia + 35 (other rivers) − 18 (used in Sudan). Egypt needs 55. Sudan floods if Ethiopia lets 50 or more through.
- **Four meters:** your needs, regional trust (shared by all three countries), budget, and the reservoir.
- **Five levels** follow the real timeline (2011–2026). Level 5 is a labelled what-if drought.
- **Four endings**, set by your needs and regional trust: Shared river, Hollow win, Good neighbour or Crisis. If trust hits 0, the game ends early in Crisis.

## Project files

| File | What's in it |
|---|---|
| `index.html` | The page and its screens |
| `css/style.css` | All the styling |
| `js/config.js` | **Every game number** (rain, needs, trust changes, costs). Balance the game here. |
| `js/content.js` | All the words: countries, levels, event cards, rules, endings, sources |
| `js/engine.js` | The rules: river math, computer-run countries, talks, scores, endings |
| `js/map.js` | The SVG map of the Nile (drawn from real coordinates) |
| `js/audio.js` | Sounds, generated in code (no sound files) |
| `js/ui.js` | Screens, buttons and animations |
| `tools/simulate.js` | Plays thousands of games with different strategies to check every ending can happen |
| `tools/check-river-table.js` | Checks the river math against the table in the game plan |

## Testing the balance

```sh
node tools/check-river-table.js   # river math matches the plan's lookup table
node tools/simulate.js 2000       # which endings each strategy reaches
```

## Keeping it fair

- No villain: all three countries are playable, and the computer runs each by the same rules.
- Claims are written as "Egypt says…" or "Ethiopia argues…", not as fact.
- Game numbers are simplified, and level 5 is clearly a what-if.
- No real leaders appear as characters, and no quotes are invented.

## Sources

- [Grand Ethiopian Renaissance Dam](https://en.wikipedia.org/wiki/Grand_Ethiopian_Renaissance_Dam), Wikipedia: size, power, fillings, cost, timeline
- "Ethiopia unveils Africa's largest dam", Gulf News, September 2025: electricity access
- "Ethiopia inaugurates Grand Renaissance Dam, Egypt pushes back", Shafaq News, September 2025: Egypt's and Sudan's reactions
- "US re-engages in GERD dispute", Peoples Dispatch, January 2026: the US mediation offer and each side's argument
- "The Declaration of Principles on Ethiopia's Renaissance Dam", IDOS, March 2015: what the 2015 agreement says

## Credits

Fonts: Fraunces and Inter (Google Fonts, SIL Open Font License). Sound is generated with the Web Audio API.
