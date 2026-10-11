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
DOC.push({id:"p1",section:"Overview",html:"The service handles <b>retries</b> today."});
DOC.push({id:"p2",section:"Overview",html:"Second paragraph."});
`;

function makeCtx(store, fetchMock) {
  const els = {};
  const mkEl = () => ({ innerHTML: '', textContent: '', value: '', style: {},
    classList: { add(){}, remove(){} }, addEventListener(){}, dataset: {}, select(){}, focus(){} });
  const docEl = mkEl();
  docEl.cloneNode = () => { const c = mkEl();
    c.querySelector = () => null; c.querySelectorAll = () => [];
    c.appendChild = ch => { c._child = ch; };
    Object.defineProperty(c, 'outerHTML', { get: () =>
      '<html><body>' + (c._child ? c._child.textContent : '') + '</body></html>' });
    return c; };
  docEl.querySelector = () => null; docEl.querySelectorAll = () => [];
  const ctx = vm.createContext({
    document: { getElementById: id => els[id] || (els[id] = mkEl()), querySelectorAll: () => [],
      documentElement: docEl, createElement: () => { const e = mkEl(); return e; },
      execCommand: () => true },
    localStorage: { getItem: k => store[k] || null, setItem: (k, v) => store[k] = v },
    sessionStorage: { _s: {}, getItem(k) { return this._s[k] || null; },
      setItem(k, v) { this._s[k] = v; }, removeItem(k) { delete this._s[k]; } },
    location: { pathname: '/test' }, console,
    fetch: fetchMock || (() => Promise.reject(new Error('no fetch'))),
    confirm: () => true, btoa: s => Buffer.from(s, 'binary').toString('base64'),
    unescape, encodeURIComponent, window: {},
    setTimeout: f => f(), Date, Math, JSON, Object, String, Array
  });
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

// 11. document editing: edit, persist, prompt inclusion, revert clears flag
const r4 = makeCtx(store);
vm.runInContext('docInput("p1","The service <b>fails</b> retries today."); renderDoc();', r4.ctx);
t('doc edit rendered + flagged', vm.runInContext('document.getElementById("doc").innerHTML', r4.ctx).includes('edited') && vm.runInContext('document.getElementById("doc").innerHTML', r4.ctx).includes('fails'));
vm.runInContext('genPrompt();', r4.ctx);
const out6 = vm.runInContext('document.getElementById("out").value', r4.ctx);
t('doc edit in prompt', out6.includes('DOCUMENT EDITS') && out6.includes('fails retries today'));
const r5 = makeCtx(store);
t('doc edit survives reload', vm.runInContext('docEdits["p1"]', r5.ctx).includes('fails'));
vm.runInContext('docInput("p1","The service handles <b>retries</b> today."); docBlur("p1",{innerHTML:"The service handles <b>retries</b> today.",classList:{add(){}}});', r5.ctx);
t('reverted doc edit clears flag', vm.runInContext('docEdits["p1"]', r5.ctx) === undefined);

// 12. graphic comments: submit, persist, prompt inclusion
vm.runInContext('document.getElementById("gname-G1").value = "flo"; document.getElementById("gtext-G1").value = "arrow overlaps the box"; addGComment("G1"); genPrompt();', r5.ctx);
const out7 = vm.runInContext('document.getElementById("out").value', r5.ctx);
t('graphic comment in prompt', out7.includes('GRAPHIC COMMENTS') && out7.includes('flo: arrow overlaps the box'));
t('graphic comment rendered on card', vm.runInContext('render(); document.getElementById("cards").innerHTML', r5.ctx).includes('arrow overlaps the box'));

// 13. chat actions mutate page state
const r6 = makeCtx(store);
vm.runInContext('applyAct("[ACT] decide G1 2");', r6.ctx);
t('act decide', vm.runInContext('state["G1"]', r6.ctx) === 1);
vm.runInContext('applyAct("[ACT] select-mock m2 false");', r6.ctx);
t('act select-mock', vm.runInContext('mockSelected("m2")', r6.ctx) === false);
vm.runInContext('applyAct("[ACT] edit-doc p2 Model rewrote this.");', r6.ctx);
t('act edit-doc', vm.runInContext('docEdits["p2"]', r6.ctx).includes('rewrote'));
vm.runInContext('applyAct("[ACT] comment-graphic G1 model colors are wrong");', r6.ctx);
t('act comment-graphic', vm.runInContext('gcomments["G1"].some(c => c.text === "colors are wrong")', r6.ctx));
t('act bad id rejected', vm.runInContext('applyAct("[ACT] decide NOPE 1")', r6.ctx) === null);
const sysp = vm.runInContext('chatSystemPrompt()', r6.ctx);
t('system prompt has state', sysp.includes('G1') && sysp.includes('p2') && sysp.includes('[ACT] decide'));

// 14. publish: gh call sequence with mocked fetch
const calls = [];
const ghFetch = (url, opts) => {
  calls.push({ url, method: (opts || {}).method || 'GET', body: (opts || {}).body || null });
  if (url.includes('/git/ref/heads/main')) return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve({ object: { sha: 'sha-base' } }) });
  if (url.includes('/git/refs') && (opts || {}).method === 'POST') return Promise.resolve({ ok: true, status: 201, headers: { get: () => null }, json: () => Promise.resolve({}) });
  if (url.includes('/contents/index.html') && url.includes('ref=')) return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve({ sha: 'sha-index' }) });
  if (url.includes('/contents/decisions.md') && url.includes('ref=')) return Promise.resolve({ ok: true, status: 404, headers: { get: () => null }, json: () => Promise.resolve({}) });
  if (url.includes('/contents/')) return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve({ sha: 'sha-x' }) });
  if (url.includes('/pulls')) return Promise.resolve({ ok: true, status: 201, headers: { get: () => null }, json: () => Promise.resolve({ html_url: 'https://github.com/o/r/pull/1' }) });
  if (url.includes('/issues')) return Promise.resolve({ ok: true, status: 201, headers: { get: () => null }, json: () => Promise.resolve({ html_url: 'https://github.com/o/r/issues/9' }) });
  return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: () => Promise.resolve({ default_branch: 'main', full_name: 'o/r' }) });
};
const r7 = makeCtx({}, ghFetch);
vm.runInContext('ghTokInput("tok123"); ghCfg("repo","o/r"); ghTest();', r7.ctx);
await new Promise(r => setTimeout(r, 20));
t('gh test ok', vm.runInContext('document.getElementById("ghSt").textContent', r7.ctx).includes('o/r'));
calls.length = 0;
vm.runInContext('publishPR();', r7.ctx);
await new Promise(r => setTimeout(r, 20));
const seq = calls.map(c => c.method + ' ' + c.url.replace('https://api.github.com', ''));
t('pr call order', seq[0].includes('GET /repos/o/r/git/ref/heads/main') &&
  seq[1].includes('POST /repos/o/r/git/refs') &&
  seq.some(s => s.startsWith('PUT /repos/o/r/contents/index.html')) &&
  seq.some(s => s.startsWith('PUT /repos/o/r/contents/decisions.md')) &&
  seq[seq.length - 1].includes('POST /repos/o/r/pulls'));
const putIndex = calls.find(c => (c.method === 'PUT') && c.url.includes('index.html'));
t('existing file sha included', putIndex && putIndex.body.includes('sha-index'));
const putMd = calls.find(c => (c.method === 'PUT') && c.url.includes('decisions.md'));
t('new file has no sha', putMd && !putMd.body.includes('"sha"'));
t('pr body is the prompt', calls.find(c => c.url.includes('/pulls')).body.includes('DECISIONS'));
t('token in auth header only', calls.every(c => !JSON.stringify(c.body || '').includes('tok123')));
calls.length = 0;
vm.runInContext('publishIssue();', r7.ctx);
await new Promise(r => setTimeout(r, 20));
t('issue filed with prompt body', calls.some(c => c.url.includes('/issues') && c.body.includes('DECISIONS')));

// 15. serializeSite: baked state, no token, no runtime DOM
const ser = vm.runInContext('serializeSite()', r7.ctx);
t('serialized has baked state', ser.includes('window.BAKED_STATE='));
t('serialized has no token', !ser.includes('tok123'));
t('serialized clears runtime dom', !ser.includes('Mock One'));

// 16. degradation: no token -> copy path, no fetch
const calls2 = [];
const r8 = makeCtx({}, (u, o) => { calls2.push(u); return Promise.reject(new Error('x')); });
vm.runInContext('publishIssue();', r8.ctx);
t('no token degrades to copy', vm.runInContext('document.getElementById("pubOut").innerHTML', r8.ctx).includes('copied'));
t('degradation makes no calls', calls2.length === 0);

console.log(fails ? `\n${fails} FAILURES` : '\nALL TESTS PASS');
process.exit(fails ? 1 : 0);
