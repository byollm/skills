// Headless functional test for the decision-site template engine.
import fs from 'fs'; import vm from 'vm';
const src = fs.readFileSync(new URL('./template.html', import.meta.url), 'utf8')
  .match(/<script>([\s\S]*)<\/script>/)[1];

const INJECT = `
DECISIONS.push({id:"G1",q:"test q",opts:["a","b"],def:0});
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

// 6. reset clears everything
vm.runInContext('resetAll();', r2.ctx);
t('reset clears state', vm.runInContext('Object.keys(state).length', r2.ctx) === 0);

console.log(fails ? `\n${fails} FAILURES` : '\nALL TESTS PASS');
process.exit(fails ? 1 : 0);
