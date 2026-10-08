// Headless functional test for the decision-site template engine.
import fs from 'fs'; import vm from 'vm'; import { fileURLToPath } from 'url';
const file = process.argv[2] || (fs.existsSync(new URL('./index.html', import.meta.url)) ? 'index.html' : 'template.html');
const src = fs.readFileSync(new URL('./' + file, import.meta.url), 'utf8')
  .match(/<script>([\s\S]*)<\/script>/)[1];
new vm.Script(src); // syntax check of the embedded script

// G1 combines every feature: object options (one tipped), the "About this
// problem" popover with a link (d.problem), and a complete deep dive (d.dive).
const INJECT = `DECISIONS.length = 0; MOCKS.length = 0;
DECISIONS.push({id:"G1",q:"test q",def:0,
  opts:["a",{t:"b <obj>",tip:{what:"obj what",pros:["pro one"],cons:["con one","con two"]}}],
  problem:{what:"W-what",when:"W-when",why:"W-why",impact:"W-impact",link:"explain-G1.html",linkLabel:"Go explain"},
  dive:{problem:"<p>why it breaks</p>",
    examples:[{title:"ex one",before:"old <b>",after:"new"},{title:"ex two",before:"b2",after:"a2"}],
    matrix:{criteria:["fixes","safety"],rows:[
      {scores:["good","mid"],pros:["fast"],cons:["costs memory"]},
      {scores:["bad","good"],pros:["safe"],cons:["slow"]}]},
    graphic:{svg:'<svg viewBox="0 0 10 10"><rect width="5" height="5"/></svg>',caption:"flow"}}});
MOCKS.push({id:"m1",title:"Mock One",screen:"s.js",selected:true,html:"<p>x</p>"});
MOCKS.push({id:"m2",title:"Mock Two",screen:"s2.js",selected:true,html:"<p>y</p>"});
`;

function makeCtx(store, inject = INJECT) {
  const els = {};
  const mkEl = () => ({ innerHTML: '', textContent: '', value: '', style: {},
    classList: { add(){}, remove(){} }, addEventListener(){}, dataset: {}, select(){}, focus(){} });
  const ctx = vm.createContext({
    document: { getElementById: id => els[id] || (els[id] = mkEl()), querySelectorAll: () => [] },
    localStorage: { getItem: k => store[k] || null, setItem: (k, v) => store[k] = v },
    location: { pathname: '/test' }, console, setTimeout, clearTimeout });
  vm.runInContext(src + inject, ctx);
  return { ctx, els };
}

let fails = 0;
const t = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + name); if (!cond) fails++; };

const store = {};
const { ctx, els } = makeCtx(store);

// 1. freeform decision
vm.runInContext('decideFree("G1"); freeInput("G1","my own way");', ctx);
t('freeform decided', vm.runInContext('decisionValue(DECISIONS[0])', ctx) === 'my own way');

// 2. comment draft survives re-render (toggling another mock re-renders all)
vm.runInContext('draftInput("m1","who","flo"); draftInput("m1","text","wip thought"); toggleMock("m2");', ctx);
t('draft survives re-render', vm.runInContext('drafts["m1"].text', ctx) === 'wip thought');
t('draft restored into rendered HTML', vm.runInContext('document.getElementById("mocks").innerHTML', ctx).includes('wip thought'));

// 3. submit comment -> in prompt; deselected mock excluded
vm.runInContext('document.getElementById("cname-m1").value = "flo"; document.getElementById("ctext-m1").value = "wip thought"; addComment("m1"); genPrompt();', ctx);
const out = vm.runInContext('document.getElementById("out").value', ctx);
t('comment in prompt', out.includes('flo: wip thought'));
t('deselected mock excluded', !out.includes('Mock Two'));
t('selected mock included', out.includes('Mock One'));

// 4. state survives reload (fresh context, same store)
const r2 = makeCtx(store);
t('freeform survives reload', vm.runInContext('decisionValue(DECISIONS[0])', r2.ctx) === 'my own way');
t('comment survives reload', vm.runInContext('comments["m1"].length', r2.ctx) === 1);
t('mock toggle survives reload', vm.runInContext('mockSelected("m2")', r2.ctx) === false);

// 5. empty freeform falls back with note
vm.runInContext('freeInput("G1",""); genPrompt();', r2.ctx);
const out2 = vm.runInContext('document.getElementById("out").value', r2.ctx);
t('empty freeform flagged open', out2.includes('G1: OPEN') && out2.includes('1 decision(s) still open'));

// 6. unsubmitted draft reaches the prompt when generated
const r3 = makeCtx(store);
vm.runInContext('draftInput("m1","who","zoe"); draftInput("m1","text","never clicked comment"); genPrompt();', r3.ctx);
const out3 = vm.runInContext('document.getElementById("out").value', r3.ctx);
t('draft folded into prompt', out3.includes('zoe: never clicked comment'));
t('draft cleared after folding', vm.runInContext('drafts["m1"]', r3.ctx) === undefined);

// 7. reset clears everything
vm.runInContext('resetAll();', r2.ctx);
t('reset clears state', vm.runInContext('Object.keys(state).length', r2.ctx) === 0);

// 8. option objects + tooltips
const r4 = makeCtx({});
vm.runInContext('decide("G1",1); genPrompt();', r4.ctx);
t('optText string', vm.runInContext('optText("a")', r4.ctx) === 'a');
t('optText object', vm.runInContext('optText(DECISIONS[0].opts[1])', r4.ctx) === 'b <obj>');
t('decisionValue uses optText', vm.runInContext('decisionValue(DECISIONS[0])', r4.ctx) === 'b <obj>');
t('prompt has object option text', vm.runInContext('document.getElementById("out").value', r4.ctx).includes('G1: b <obj>'));
const cards = vm.runInContext('document.getElementById("cards").innerHTML', r4.ctx);
t('options stacked rows', (cards.match(/class="optrow/g) || []).length === 3);
t('info button only for tipped option', (cards.match(/class="info"/g) || []).length === 1);
t('option text escaped in card', cards.includes('b &lt;obj&gt;'));
t('about button rendered', cards.includes('About this problem') && cards.includes('data-prob="G1"'));
const th = vm.runInContext('tipHTML(DECISIONS[0].opts[1])', r4.ctx);
t('tip has what/pros/cons', th.includes('What it means') && th.includes('obj what') && th.includes('class="pros"') &&
  th.includes('pro one') && th.includes('class="cons"') && th.includes('con two'));
t('tip empty for string option', vm.runInContext('tipHTML("a")', r4.ctx) === '');
const ph = vm.runInContext('problemHTML(DECISIONS[0])', r4.ctx);
t('problem four blocks', ['What happened','When it happened','Why it happened','What it means for us','W-what','W-when','W-why','W-impact'].every(x => ph.includes(x)));
t('problem link rendered safely', ph.includes('href="explain-G1.html"') && ph.includes('target="_blank"') && ph.includes('rel="noopener') && ph.includes('Go explain'));
const r5 = makeCtx({}, `DECISIONS.length = 0; MOCKS.length = 0;
DECISIONS.push({id:"N1",q:"nolink",opts:["x","y"],def:0,problem:{what:"a",when:"b",why:"c",impact:"d"}});
DECISIONS.push({id:"N2",q:"noproblem",opts:["x"],def:0}); render();`);
const ph2 = vm.runInContext('problemHTML(DECISIONS[0])', r5.ctx);
t('no link when not provided', !ph2.includes('<a ') && ph2.includes('What happened'));
const c5 = vm.runInContext('document.getElementById("cards").innerHTML', r5.ctx);
t('legacy string options: no info, one about', !c5.includes('class="info"') && (c5.match(/class="about"/g) || []).length === 1);
t('javascript: link rejected', !vm.runInContext('problemHTML({id:"z",problem:{what:"a",link:"javascript:alert(1)"}})', r5.ctx).includes('<a '));

// 9. deep dive renders every part and escapes plain-text fields
const dive = vm.runInContext('render(); document.getElementById("cards").innerHTML', r2.ctx);
t('dive problem rendered', dive.includes('why it breaks'));
t('dive examples rendered + escaped', dive.includes('ex two') && dive.includes('old &lt;b&gt;'));
// The matrix has one opt-name cell per option (2: "a" and the object option). It is a
// different class from the stacked "optrow" rows counted in section 8.
t('dive matrix has a row per option', (dive.match(/class="opt-name/g) || []).length === 2 && dive.includes('costs memory'));
t('dive matrix names object options via optText, escaped', /class="opt-name[^"]*">b &lt;obj&gt;</.test(dive));
t('dive graphic svg rendered', dive.includes('<svg viewBox="0 0 10 10">'));
t('dive coexists with options and problem popover', dive.includes('class="dive"') && dive.includes('class="optrow') && dive.includes('data-prob="G1"'));
t('dive sits between question and options', dive.indexOf('class="q"') < dive.indexOf('class="dive"') && dive.indexOf('class="dive"') < dive.indexOf('class="opts"'));

// 10. validation: complete dive passes; missing pieces are reported
t('complete dive validates', vm.runInContext('validateDecisions().length', r2.ctx) === 0);
vm.runInContext('DECISIONS.push({id:"G2",q:"bare",opts:["x","y"],def:0});', r2.ctx);
const errs = vm.runInContext('validateDecisions()', r2.ctx);
t('missing dive reported', errs.some(e => e.startsWith('G2')));
vm.runInContext(`DECISIONS[DECISIONS.length-1].dive = {problem:"<p>p</p>",
  examples:[{title:"one",before:"b",after:"a"}],
  matrix:{criteria:["c"],rows:[{scores:["good"],pros:["p"],cons:["c"]}]},
  graphic:{svg:"none"}};`, r2.ctx);
const errs2 = vm.runInContext('validateDecisions().join("|")', r2.ctx);
t('too few examples reported', errs2.includes('G2: needs >= 2 examples'));
t('short matrix reported', errs2.includes('G2: matrix needs one row per option'));
t('missing svg reported', errs2.includes('G2: missing inline SVG graphic'));
vm.runInContext('DECISIONS.pop();', r2.ctx);

// 11. chosen option's cons reach the prompt as the accepted trade-off (text via optText)
vm.runInContext('decide("G1",1); genPrompt();', r2.ctx);
const out4 = vm.runInContext('document.getElementById("out").value', r2.ctx);
t('accepts line for chosen object option', out4.includes('G1: b <obj>') && out4.includes('accepts: slow'));
vm.runInContext('resetAll(); genPrompt();', r2.ctx);
const out5 = vm.runInContext('document.getElementById("out").value', r2.ctx);
t('open decision shows proposed trade-off', out5.includes('accepts: costs memory'));

// 12. open-site.sh: default-open helper (dry-run only; never launches a browser)
import cp from 'child_process'; import os from 'os'; import path from 'path';
const script = fileURLToPath(new URL('./open-site.sh', import.meta.url));
t('open-site.sh exists and is executable', (() => { try { fs.accessSync(script, fs.constants.X_OK); return true; } catch { return false; } })());
t('SKILL.md mentions open-site.sh', fs.readFileSync(new URL('./SKILL.md', import.meta.url), 'utf8').includes('open-site.sh'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'open site '));
const page = path.join(tmp, 'index.html'); fs.writeFileSync(page, '<html></html>');
const realTmp = fs.realpathSync(tmp);
const run = (args, env = {}) => {
  const e = { PATH: process.env.PATH, HOME: process.env.HOME, DISPLAY: ':0', OPEN_SITE_DRY_RUN: '1', ...env };
  const r = cp.spawnSync('bash', [script, ...args], { env: e, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr, last: r.stdout.trim().split('\n').pop() };
};
const wantUrl = 'file://' + realTmp.split(' ').join('%20') + '/index.html';
const dar = run([page], { OPEN_SITE_OS: 'darwin' });
t('darwin dry-run: would run open <path>', dar.out.includes('would run: open ' + path.join(realTmp, 'index.html')));
t('url is absolute file:// with encoded space, on the last line', dar.last === wantUrl && wantUrl.includes('%20'));
t('linux dry-run uses xdg-open', run([page], { OPEN_SITE_OS: 'linux' }).out.includes('would run: xdg-open '));
for (const [name, args, env] of [['OS none', [page], { OPEN_SITE_OS: 'none' }],
    ['--no-open', ['--no-open', page], { OPEN_SITE_OS: 'darwin' }],
    ['OPEN_SITE_DISABLE=1', [page], { OPEN_SITE_OS: 'darwin', OPEN_SITE_DISABLE: '1' }],
    ['linux without display', [page], { OPEN_SITE_OS: 'linux', DISPLAY: '' }]]) {
  const r = run(args, env);
  t(name + ': prints URL, says not opened, no opener', r.code === 0 && r.last === wantUrl &&
    /not opened/i.test(r.out) && !r.out.includes('would run'));
}
const miss = run([path.join(tmp, 'nope.html')], { OPEN_SITE_OS: 'darwin' });
t('missing file exits 2', miss.code === 2 && /not found/.test(miss.err));
fs.rmSync(tmp, { recursive: true, force: true });

console.log(fails ? `\n${fails} FAILURES` : '\nALL TESTS PASS');
process.exit(fails ? 1 : 0);
