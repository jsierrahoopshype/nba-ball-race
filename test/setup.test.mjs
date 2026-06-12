// Proves the count -> configs path that shipped broken. Pure, no browser.
import MatterPkg from 'matter-js';
globalThis.Matter = MatterPkg;
const { createSetup } = await import('../js/setup.js');

let pass = true;
const check = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}`); if (!cond) pass = false; };

const s = createSetup(2);
check('starts at 2', s.count === 2 && s.toConfigs().length === 2);

s.setCount(5);
check('setCount(5) -> 5 configs', s.count === 5 && s.toConfigs().length === 5);

s.setName(0, 'WEMB'); s.setColor(0, '#ff0000');
check('name/color edit sticks', s.toConfigs()[0].label === 'WEMB' && s.toConfigs()[0].color === '#ff0000');

s.setCount(3);
check('shrink to 3 keeps edits', s.count === 3 && s.toConfigs()[0].label === 'WEMB');

s.setCount(8);
check('grow to 8', s.toConfigs().length === 8);

check('clamps to 8 max', (s.setCount(20), s.count === 8));
check('clamps to 2 min', (s.setCount(1), s.count === 2));

// End-to-end: configs actually drive ball count in a real race
const { createRace } = await import('../js/physics.js');
s.setCount(6);
const race = createRace(123, s.toConfigs());
check('createRace makes 6 balls from 6 configs', race.balls.length === 6);

console.log(pass ? '\nALL PASS' : '\nFAILURES ABOVE');
process.exit(pass ? 0 : 1);
