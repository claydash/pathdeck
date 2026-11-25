// PathDeck — router, app chrome, search, keyboard, boot.
import { D, loadIndex, loadSubject, subjects, build, chapterTitle } from './content.js';
import { S, load, save, sub, onChange, migrateLegacy, setSetting, streak, goalMet, level } from './store.js';
import { counts, checkBadges, mistakeCount } from './stats.js';
import { $, esc, ico, FLAME_SVG, dayKey, toast } from './util.js';
import * as cloud from './cloud.js';
import * as home from './views/home.js';
import * as study from './views/study.js';
import * as quiz from './views/quiz.js';
import * as more from './views/more.js';

const app = () => $('#app');
const ACTIONS = { ...home.actions, ...study.actions, ...quiz.actions, ...more.actions };
const NAV = [
  { r: 'today', label: 'Today', icon: 'today', tab: true },
  { r: 'library', label: 'Library', icon: 'library', tab: true },
  { r: 'cards', label: 'Flashcards', icon: 'cards', also: ['study', 'cram'] },
  { r: 'mcq', label: 'MCQs', icon: 'mcq', tab: true, also: ['quiz'] },
  { r: 'mistakes', label: 'Mistakes', icon: 'mistakes', tab: true },
  { r: 'museum', label: 'Museum', icon: 'museum' },
  { r: 'insights', label: 'Insights', icon: 'insights', tab: true },
  { r: 'profile', label: 'Scoreboard', icon: 'trophy' }
];

function parse() {
  const [path, qs] = location.hash.slice(2).split('?');
  const parts = (path || 'today').split('/').map(decodeURIComponent);
  return { route: parts[0] || 'today', parts, params: new URLSearchParams(qs || '') };
}
const FOCUS_ROUTES = new Set(['study', 'cram', 'quiz', 'signin', 'welcome']);

function viewFor({ route, parts, params }) {
  switch (route) {
    case 'library': return home.viewLibrary();
    case 'chapter': return home.viewChapter(parts[1]);
    case 'cards': return study.viewDecks();
    case 'study': return study.viewStudy();
    case 'cram': return study.viewCram();
    case 'mcq': return quiz.viewSetup(params);
    case 'quiz': return quiz.viewQuiz();
    case 'mistakes': return more.viewMistakes();
    case 'museum': return parts[1] ? more.viewSpecimen(parts[1]) : more.viewMuseum(params);
    case 'insights': return more.viewInsights();
    case 'profile': return more.viewProfile();
    case 'signin': return more.viewSignin();
    case 'welcome': return more.viewWelcome();
    default: return home.viewToday();
  }
}
export function render() {
  const r = parse();
  document.body.classList.toggle('focus-mode', FOCUS_ROUTES.has(r.route));
  document.body.classList.toggle('bare', r.route === 'welcome' || r.route === 'signin');
  app().innerHTML = viewFor(r);
  renderChrome();
}
function onRoute() {
  const r = parse();
  if (!S.onboarded && !cloud.currentUser() && (r.route === 'today') && !location.hash.includes('guest')) { location.replace('#/welcome'); return; }
  if (r.route === 'study') study.startSession(r.params);
  if (r.route === 'cram') study.startCram(r.params);
  if (r.route === 'quiz') quiz.startQuiz(r.params);
  const go = () => { render(); window.scrollTo({ top: 0 }); app().focus({ preventScroll: true }); };
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(go); else go();
}

// ---------------------------------------------------------------- chrome
function renderChrome() {
  const r = parse();
  const c = D.cards.length ? counts() : { due: 0, learn: 0 };
  const dueN = c.due + c.learn, mist = mistakeCount();
  const on = n => (r.route === n.r || (n.also || []).includes(r.route) || (n.r === 'library' && r.route === 'chapter')) ? ' on' : '';
  const badge = n => n.r === 'cards' && dueN ? `<span class="count due">${dueN}</span>` : n.r === 'mistakes' && mist ? `<span class="count bad">${mist}</span>` : '';
  const hasMuseum = D.specimens.length || D.images.length;
  $('#nav').innerHTML = NAV.filter(n => n.r !== 'museum' || hasMuseum).map(n => `<a href="#/${n.r}" class="${on(n)}">${ico(n.icon)}<span>${n.label}</span>${badge(n)}</a>`).join('');
  $('#tabbar').innerHTML = NAV.filter(n => n.tab).map(n => `<a href="#/${n.r}" class="${on(n)}">${ico(n.icon)}<span>${n.label}</span>${n.r === 'mistakes' && mist ? `<span class="count">${mist}</span>` : ''}</a>`).join('');
  const subs = subjects();
  $('#subject').innerHTML = subs.length ? `<button class="subject-btn" data-act="subject-menu" aria-haspopup="true"><span class="subj-dot"></span><span class="grow"><small>Subject</small><b>${esc(D.subject ? D.subject.title : '')}</b></span>${subs.length > 1 ? ico('down') : ''}</button>
    <div class="subject-menu" hidden>${subs.map(s => `<button data-act="subject" data-id="${s.id}" class="${s.id === D.subjectId ? 'on' : ''}">${esc(s.title)}<small>${esc(s.book || '')}</small></button>`).join('')}</div>` : '';
  const u = cloud.currentUser(); const met = goalMet(dayKey());
  $('#sidebar-foot').innerHTML = `<a class="mini-streak" href="#/profile">${FLAME_SVG(!met, 32)}<div class="grow"><b>${streak()}</b><small>day streak · Lv ${level()}</small></div></a>
    ${!cloud.authEnabled ? '' : u ? `<a class="account-chip" href="#/profile">${more.avatar(u, 30)}<span class="grow"><b>${esc(u.name || 'Account')}</b><small class="sync-${cloud.status.state}">${cloud.status.state === 'synced' ? 'Synced' : cloud.status.state === 'syncing' ? 'Syncing…' : cloud.status.state === 'offline' || cloud.status.state === 'error' ? 'Saved on device' : ''}</small></span></a>`
      : `<a class="account-chip guest" href="#/signin">${ico('user')}<span class="grow"><b>Sign in</b><small>Save progress to your account</small></span></a>`}`;
  $('#mtop').innerHTML = `<a class="brand" href="#/today"><span class="brand-mark"></span><span class="brand-name">PathDeck</span></a><span class="spacer"></span>
    <button class="icon-btn" data-act="search" aria-label="Search">${ico('search')}</button>
    <a class="icon-btn streak-mini" href="#/profile" aria-label="Streak">${FLAME_SVG(!met, 22)}<b>${streak()}</b></a>
    ${cloud.authEnabled ? `<a class="icon-btn" href="${u ? '#/profile' : '#/signin'}" aria-label="Account">${u ? more.avatar(u, 28) : ico('user')}</a>` : ''}`;
}

// ---------------------------------------------------------------- search (⌘K)
let SEARCH_IDX = null;
function searchIndex() {
  if (SEARCH_IDX) return SEARCH_IDX;
  const out = [];
  D.chapters.forEach(c => { out.push({ t: c.title, s: c.sectionTitle, href: `#/chapter/${c.id}`, k: 'Chapter', w: 4 }); (c.data.subtopics || []).forEach(h => out.push({ t: h.title, s: c.title, href: `#/quiz?mode=heading&chapter=${c.id}&sub=${encodeURIComponent(h.id)}`, k: 'Heading', w: 3 })); });
  D.specimens.forEach(s => out.push({ t: s.name, s: `${s.organ} · specimen`, href: `#/museum/${s.id}`, k: 'Specimen', w: 3 }));
  D.cards.filter(c => c.back && !c.kind).forEach(c => out.push({ t: c.front, s: chapterTitle(c.chapter) + ' · ' + c.back.slice(0, 80), href: `#/cram?chapter=${c.chapter}&sub=${encodeURIComponent(c.sub || '')}`, k: 'Card', w: 1, body: c.back }));
  D.mcqs.filter(q => !q.spec && !q.micro).forEach(q => out.push({ t: q.q, s: chapterTitle(q.chapter) + ' · ' + q.diff, href: `#/quiz?mode=one&key=${encodeURIComponent(q.key)}`, k: 'Question', w: 1, body: q.opts.join(' ') + ' ' + q.exp }));
  return (SEARCH_IDX = out);
}
function runSearch(qs) {
  const words = qs.toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) return [];
  return searchIndex().map(x => { const t = x.t.toLowerCase(), b = ((x.s || '') + ' ' + (x.body || '')).toLowerCase(); let sc = 0;
    for (const w of words) { if (t.includes(w)) sc += 3 + (t.startsWith(w) ? 2 : 0); else if (b.includes(w)) sc += 1; else return null; }
    return { ...x, sc: sc * x.w }; }).filter(Boolean).sort((a, b) => b.sc - a.sc).slice(0, 24);
}
function openSearch() {
  const box = $('#search'); box.hidden = false;
  box.innerHTML = `<div class="search-panel" role="dialog" aria-label="Search"><div class="search-input">${ico('search')}<input id="search-q" placeholder="Search chapters, headings, specimens, cards, questions…" autocomplete="off"><span class="kbd">Esc</span></div><div class="search-results" id="search-res"><div class="empty">Try “caseous”, “keloid”, “p53” or “fibroadenoma”.</div></div></div>`;
  const inp = $('#search-q'); inp.focus(); let sel = 0, res = [];
  const draw = () => { $('#search-res').innerHTML = res.length ? res.map((x, i) => `<a class="sr-item${i === sel ? ' on' : ''}" href="${x.href}"><span class="pill">${x.k}</span><span class="grow"><b>${esc(x.t.length > 110 ? x.t.slice(0, 110) + '…' : x.t)}</b><small>${esc(x.s || '')}</small></span></a>`).join('') : `<div class="empty">${inp.value ? 'No matches.' : 'Try “caseous”, “keloid”, “p53” or “fibroadenoma”.'}</div>`; };
  inp.addEventListener('input', () => { res = runSearch(inp.value); sel = 0; draw(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { sel = Math.min(res.length - 1, sel + 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
    else if (e.key === 'Enter' && res[sel]) { location.hash = res[sel].href; closeSearch(); }
    else if (e.key === 'Escape') closeSearch();
  });
}
function closeSearch() { const b = $('#search'); b.hidden = true; b.innerHTML = ''; }

// ---------------------------------------------------------------- events
const ctx = {
  rebuild: () => { build(sub().custom); SEARCH_IDX = null; },
  applyTheme
};
function applyTheme() {
  const v = S.settings.theme; try { localStorage.setItem('pathdeck:theme', v); } catch (e) {}
  if (v === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
}
document.addEventListener('click', async e => {
  const t = e.target;
  if (t.closest('#search') && !t.closest('.search-panel')) { closeSearch(); return; }
  if (t.closest('.sr-item')) { closeSearch(); return; }
  const z = t.closest('[data-zoom]'); if (z) { const lb = $('#lightbox'); lb.innerHTML = `<div><img src="${esc(z.dataset.zoom)}" alt=""><div class="cap">${esc(z.dataset.cap || '')}</div></div>`; lb.hidden = false; return; }
  if (t.closest('#lightbox')) { $('#lightbox').hidden = true; return; }
  const menu = document.querySelector('.subject-menu'); if (menu && !t.closest('#subject')) menu.hidden = true;
  const el = t.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;
  if (act === 'search') { openSearch(); return; }
  if (act === 'subject-menu') { const m = document.querySelector('.subject-menu'); if (subjects().length > 1) m.hidden = !m.hidden; else location.hash = '#/library'; return; }
  if (act === 'subject') { await switchSubject(el.dataset.id); return; }
  const fn = ACTIONS[act]; if (!fn) return;
  if (el.tagName === 'BUTTON' || el.tagName === 'A' && !el.getAttribute('href')) e.preventDefault();
  fn(el, render, ctx);
});
document.addEventListener('submit', e => { const f = e.target.closest('form[data-form]'); if (f) { e.preventDefault(); more.submitAuth(f, render); } });
document.addEventListener('change', e => {
  if (e.target.id !== 'import') return; const f = e.target.files[0]; if (!f) return;
  f.text().then(txt => { const j = JSON.parse(txt); if (!j || (!j.subjects && !j.srs)) throw new Error('bad');
    import('./store.js').then(m => { if (j.subjects) m.replaceState({ ...j, owner: S.owner }); else { localStorage.setItem('pathdeck:v1', txt); m.load(); migrateLegacy(D); }
      m.save(); Object.keys(m.S.subjects).forEach(s => m.save(s)); ctx.rebuild(); render(); toast('Backup restored'); }); })
    .catch(() => toast('That file is not a PathDeck backup'));
});
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#search').hidden ? openSearch() : closeSearch(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (!$('#lightbox').hidden) { if (e.key === 'Escape') $('#lightbox').hidden = true; return; }
  const { route } = parse();
  if (study.keys(e, route, render) || quiz.keys(e, route, render)) return;
  if (e.key === '/') { e.preventDefault(); openSearch(); return; }
  if (route === 'today' && e.key === 's') location.hash = '#/study';
});
setInterval(quiz.tick, 1000);
window.addEventListener('hashchange', onRoute);

async function switchSubject(id) {
  if (id === D.subjectId) { document.querySelector('.subject-menu').hidden = true; return; }
  S.subject = id; setSetting('subjectAt', Date.now());
  app().innerHTML = '<div class="page"><div class="skeleton"></div></div>';
  await loadSubject(id, sub(id).custom); SEARCH_IDX = null; location.hash = '#/today'; render();
}

// ---------------------------------------------------------------- boot
let lastPulledRender = 0;
onChange(scope => {
  if (scope !== 'all') return;                    // a cloud pull replaced state
  ctx.rebuild();
  const { route } = parse();
  if (FOCUS_ROUTES.has(route) && route !== 'signin' && route !== 'welcome') { renderChrome(); return; }   // don't disturb a session
  if (Date.now() - lastPulledRender > 300) { lastPulledRender = Date.now(); render(); }
});
cloud.onAuth(() => { const { route } = parse(); if (FOCUS_ROUTES.has(route) && route !== 'signin' && route !== 'welcome') renderChrome(); else render(); });

async function boot() {
  load(); applyTheme();
  try {
    await loadIndex();
    if (!subjects().some(s => s.id === S.subject)) S.subject = subjects()[0].id;
    await loadSubject(S.subject, sub(S.subject).custom);
    if (migrateLegacy(D)) { ctx.rebuild(); toast('Your earlier progress was carried over'); }
    if (!location.hash) location.replace('#/today');
    onRoute(); checkBadges();
    cloud.initCloud();
  } catch (err) {
    console.error(err);
    app().innerHTML = `<div class="page narrow"><div class="card done"><h2>Couldn’t load the decks</h2><p class="muted">${esc(err.message)}</p><button class="btn primary" onclick="location.reload()">Try again</button></div></div>`;
  }
}
boot();
