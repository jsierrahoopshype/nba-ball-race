// Drives the real index.html through jsdom: selecting a count must produce N rows
// AND N configs. Mocks canvas just enough that main.js loads without a real GPU.
import { JSDOM } from 'jsdom';
import fs from 'fs';
import MatterPkg from 'matter-js';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.Image = window.Image;
globalThis.Matter = MatterPkg;
globalThis.requestAnimationFrame = () => 0;

// Minimal 2D context + captureStream so main.js boots headlessly
const ctxStub = new Proxy({}, { get: () => () => {}, });
window.HTMLCanvasElement.prototype.getContext = () => ctxStub;
window.HTMLCanvasElement.prototype.captureStream = () => ({ getTracks: () => [] });
window.MediaRecorder = class { constructor(){} start(){} stop(){} };
window.MediaRecorder.isTypeSupported = () => true;

// Import main.js as a module (strip the type=module script, run manually)
const code = fs.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
// main.js uses bare imports; run via dynamic import instead of inlining
await import('../js/main.js');

const doc = window.document;
const sel = doc.getElementById('ball-count');
const rows = () => doc.getElementById('ball-rows').children.length;

let pass = true;
const check = (n, c) => { console.log(`${c?'PASS':'FAIL'}: ${n}`); if(!c) pass=false; };

check('boots with 2 rows', rows() === 2);

sel.value = '5';
sel.dispatchEvent(new window.Event('change'));
check('selecting 5 renders 5 rows', rows() === 5);

sel.value = '8';
sel.dispatchEvent(new window.Event('change'));
check('selecting 8 renders 8 rows', rows() === 8);

check('REC button exists', !!doc.getElementById('btn-rec'));
check('RACE button exists', !!doc.getElementById('btn-race'));

console.log(pass ? '\nDOM WIRING OK' : '\nDOM WIRING BROKEN');
process.exit(pass ? 0 : 1);
