// Headless functional test for the decision-site template engine.
import fs from 'fs'; import vm from 'vm';
const src = fs.readFileSync(new URL('./template.html', import.meta.url), 'utf8')
  .match(/<script>([\s\S]*)<\/script>/)[1];

const INJECT = `
DECISIONS.push({id:"G1",q:"test q",opts:["a","b"],def:0,
  dive:{problem:"<p>why it breaks</p>",
    examples:[{title:"ex one",before:"old <b>",after:"new"},{title:"ex two",before:"b2",after:"a2"}],
    matrix:{criteria:["fixes","safety"],rows:[
      {scores:["good","mid"],pros:["fast"],cons:["costs memory"]},
      {scores:["bad","good"],pros:["safe"],cons:["slow"]}]},
    graphic:{svg:'<svg viewBox="0 0 10 10"><rect width="5" height="5"/></svg>',caption:"flow"}}});
MOCKS.push({id:"m1",title:"Mock One",screen:"s.js",selected:true,html:"<p>x</p>"});
MOCKS.push({id:"m2",title:"Mock Two",screen:"s2.js",selected:true,html:"<p>y</p>"});
`;

function makeCtx(store) {
  const els = {};
  const mkEl = () => ({ innerHTML: '', textContent: '', value: '', style: {},
    classList: { add(){}, remove(){} }, addEventListener(){}, dataset: {}, select(){}, focus(){} });
  const ctx = vm.createContext({
    document: { getElementById: id => els[id] || (els[id] = mkEl()), querySelectorAll: () => [] },
    localStorage: { getItem: k => store[k] || null, setItem: (k, v) => store[k] = v },
    location: { pathname: '/test' }, console });
  vm.runInContext(src + INJECT, ctx);
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

// 8. deep dive renders every part and escapes plain-text fields
const cards = vm.runInContext('render(); document.getElementById("cards").innerHTML', r2.ctx);
t('dive problem rendered', cards.includes('why it breaks'));
t('dive examples rendered + escaped', cards.includes('ex two') && cards.includes('old &lt;b&gt;'));
t('dive matrix has a row per option', (cards.match(/class="opt-name/g) || []).length === 2 && cards.includes('costs memory'));
t('dive graphic svg rendered', cards.includes('<svg viewBox="0 0 10 10">'));

// 9. validation: complete dive passes; missing pieces are reported
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

// 10. chosen option's cons reach the prompt as the accepted trade-off
vm.runInContext('decide("G1",1); genPrompt();', r2.ctx);
const out4 = vm.runInContext('document.getElementById("out").value', r2.ctx);
t('accepts line for chosen option', out4.includes('G1: b') && out4.includes('accepts: slow'));
vm.runInContext('resetAll(); genPrompt();', r2.ctx);
const out5 = vm.runInContext('document.getElementById("out").value', r2.ctx);
t('open decision shows proposed trade-off', out5.includes('accepts: costs memory'));

console.log(fails ? `\n${fails} FAILURES` : '\nALL TESTS PASS');
process.exit(fails ? 1 : 0);
