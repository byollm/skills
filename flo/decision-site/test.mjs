// Headless functional test for the decision-site template engine.
import fs from 'fs'; import vm from 'vm';
const file = process.argv[2] || (fs.existsSync(new URL('./index.html', import.meta.url)) ? 'index.html' : 'template.html');
const src = fs.readFileSync(new URL('./' + file, import.meta.url), 'utf8')
  .match(/<script>([\s\S]*)<\/script>/)[1];
new vm.Script(src); // syntax check of the embedded script

const INJECT = `DECISIONS.length = 0; MOCKS.length = 0;
DECISIONS.push({id:"G1",q:"test q",def:0,
  opts:["a",{t:"b <obj>",tip:{what:"obj what",pros:["pro one"],cons:["con one","con two"]}}],
  problem:{what:"W-what",when:"W-when",why:"W-why",impact:"W-impact",link:"explain-G1.html",linkLabel:"Go explain"}});
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

console.log(fails ? `\n${fails} FAILURES` : '\nALL TESTS PASS');
process.exit(fails ? 1 : 0);
