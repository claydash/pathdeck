import { D, chapterTitle, subjects } from '../content.js';
import { S, sub, todayLog, streak, goalMet, openMistakes, resetCards, resetMcqs, isExcluded, toggleExcluded } from '../store.js';
import { counts, newQueue, analyse, trend, forecast, refreshGoal } from '../stats.js';
import { isDue, LEARN_AHEAD } from '../srs.js';
import { esc, ico, ring, masteryColor, FLAME_SVG, dayKey, addDays, clamp, now, plural, toast } from '../util.js';
import { currentUser } from '../cloud.js';

export function heatmap(weeks = 18) {
  const today = dayKey(); const dow = new Date(today + 'T12:00').getDay();
  const start = addDays(today, -(weeks * 7 - 1) - (6 - dow)); const total = weeks * 7 + (6 - dow) + 1;
  let cells = '';
  for (let i = 0; i < total + (6 - dow); i++) {
    const k = addDays(start, i); if (i >= total) { cells += '<i class="future"></i>'; continue; }
    const l = S.log[k]; const n = l ? (l.cards || 0) + (l.mcq || 0) : 0;
    const lv = n === 0 ? 0 : n < 10 ? 1 : n < 25 ? 2 : n < 50 ? 3 : 4;
    cells += `<i class="l${lv}" title="${k}: ${n} cards + questions"></i>`;
  }
  return `<div class="heat">${cells}</div><div class="heat-legend">Less <i style="background:var(--heat-0)"></i><i style="background:var(--heat-1)"></i><i style="background:var(--heat-2)"></i><i style="background:var(--heat-3)"></i><i style="background:var(--heat-4)"></i> More</div>`;
}
export function weekStrip() {
  const t = dayKey();
  return `<div class="week">${Array.from({ length: 7 }, (_, i) => addDays(t, i - 6)).map(k => { const d = new Date(k + 'T12:00'); return `<div class="d${goalMet(k) ? ' met' : ''}${k === t ? ' today' : ''}">${'SMTWTFS'[d.getDay()]}<i>${goalMet(k) ? ico('check') : ''}</i></div>`; }).join('')}</div>`;
}
export function streakCard() {
  const l = todayLog(), s = streak(), met = goalMet(dayKey());
  const done = (l.cards || 0) + (l.mcq || 0); const prog = clamp(Math.round((100 * done) / S.settings.goal), 0, 100);
  return `<div class="card streak-card">
    <div class="streak-top">${FLAME_SVG(!met)}<div><div class="streak-num">${s}</div><div class="streak-lbl">day streak${met ? ' · today done ✓' : ' · keep it alive today'}</div></div></div>
    <div><div class="goal-row"><span>Daily goal</span><span>${Math.min(done, S.settings.goal)} / ${S.settings.goal}</span></div><div class="goal-bar"><i style="width:${met ? 100 : prog}%"></i></div></div>
    ${weekStrip()}</div>`;
}
export function focusCard(A, limit = 3, compact) {
  const f = A.focus.slice(0, limit);
  if (!f.length) return `<div class="empty">Answer a few questions and study some cards — your weak spots will show up here.</div>`;
  return `<div class="focus-list">${f.map((x, i) => `<a class="focus" href="${x.action.href}"><span class="focus-n">${i + 1}</span><span class="grow"><b>${esc(x.title)}</b><small>${esc(chapterTitle(x.chapter) !== x.title ? chapterTitle(x.chapter) + ' · ' : '')}${esc(x.reason)}</small></span>${compact ? ico('right') : `<span class="btn sm">${esc(x.action.label)}</span>`}</a>`).join('')}</div>`;
}

export function viewToday() {
  refreshGoal();
  const c = counts(), l = todayLog(), met = goalMet(dayKey());
  const mist = openMistakes().filter(([k]) => D.mcqByKey[k]).sort((a, b) => b[1].at - a[1].at);
  const u = currentUser(); const h = new Date().getHours();
  const greet = `${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}${u && u.name ? ', ' + esc(u.name.split(' ')[0]) : ''}.`;
  const dueBy = {}; const t = now(); const P = sub();
  D.cards.forEach(cd => { const x = P.srs[cd.key]; if (x && isDue(x, t + LEARN_AHEAD) && (cd.chapter === 'mine' || !isExcluded(cd.chapter))) dueBy[cd.chapter] = (dueBy[cd.chapter] || 0) + 1; });
  const newBy = {}; newQueue().slice(0, c.new).forEach(cd => { newBy[cd.chapter] = (newBy[cd.chapter] || 0) + 1; });
  const studyN = c.new + c.learn + c.due; const tomorrow = forecast(2)[1].n;
  const A = analyse();
  const cont = A.chapters.filter(x => x.qTotal + x.cTotal).sort((a, b) => (b.started - a.started) || (a.mastery - b.mastery)).slice(0, 4);
  return `<div class="page">
  <div class="head"><div><div class="eyebrow">${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · ${esc(D.subject.title)}</div><h1>${greet}</h1>
  <p class="sub">${studyN ? `You have <b>${studyN}</b> card${studyN === 1 ? '' : 's'} for today${mist.length ? ` and <b>${mist.length}</b> mistake${mist.length === 1 ? '' : 's'} to fix` : ''}.` : met ? 'Today’s cards are done. Practise questions or fix a mistake to keep going.' : 'No cards waiting right now.'}</p></div></div>
  <div class="hero">
    <div class="card hero-main">
      <div class="counts">
        <div class="count-block"><b class="c-new">${c.new}</b><span>New today</span></div>
        <div class="count-block"><b class="c-learn">${c.learn}</b><span>Learning</span></div>
        <div class="count-block"><b class="c-due">${c.due}</b><span>Due for review</span></div>
        <div class="count-block"><b class="c-bad">${mist.length}</b><span>Mistakes</span></div>
      </div>
      <div class="hero-actions">
        <a class="btn primary lg" href="#/study">${ico('play')} ${studyN ? 'Study cards' : 'Study ahead'} <span class="kbd">S</span></a>
        <a class="btn lg" href="#/mcq">${ico('mcq')} Practise MCQs</a>
        ${mist.length ? `<a class="btn lg" href="#/quiz?mode=mistakes">${ico('retry')} Retry mistakes</a>` : ''}
      </div>
    </div>
    ${streakCard()}
  </div>
  <div class="cols">
    <div class="card col">
      <div class="col-head"><span class="dot" style="background:var(--new)"></span><h3>Today’s new cards</h3><span class="col-badge" style="background:var(--hema-soft);color:var(--new)">${c.new}</span></div>
      <div class="list">${Object.keys(newBy).length ? Object.entries(newBy).map(([d, n]) => `<a class="row" href="#/study?chapter=${d}"><span class="grow">${esc(chapterTitle(d))}</span><span class="num c-new">${n}</span></a>`).join('') : `<div class="empty">${c.newAvail ? `Today’s ${S.settings.newPerDay} new cards are done. More unlock tomorrow.` : 'Every card has been introduced.'}</div>`}</div>
      <p class="muted small">${S.settings.newPerDay} new cards are released each day${S.settings.order === 'mixed' ? ', rotating chapters' : ', in syllabus order'}.</p>
    </div>
    <div class="card col">
      <div class="col-head"><span class="dot" style="background:var(--due)"></span><h3>Due for review</h3><span class="col-badge" style="background:var(--good-soft);color:var(--due)">${c.due + c.learn}</span></div>
      <div class="list">${Object.keys(dueBy).length ? Object.entries(dueBy).sort((a, b) => b[1] - a[1]).map(([d, n]) => `<a class="row" href="#/study?chapter=${d}"><span class="grow">${esc(chapterTitle(d))}</span><span class="num c-due">${n}</span></a>`).join('') : `<div class="empty">Nothing due. ${tomorrow ? `${plural(tomorrow, 'card')} come back tomorrow.` : 'Cards you study come back here on a spaced schedule.'}</div>`}</div>
      ${c.due + c.learn ? `<a class="btn" href="#/study?only=due">${ico('retry')} Review due only</a>` : ''}
    </div>
    <div class="card col">
      <div class="col-head"><span class="dot" style="background:var(--bad)"></span><h3>Revisit mistakes</h3><span class="col-badge" style="background:var(--bad-soft);color:var(--bad)">${mist.length}</span></div>
      <div class="list">${mist.length ? mist.slice(0, 4).map(([k]) => { const q = D.mcqByKey[k]; return `<a class="row" href="#/quiz?mode=one&key=${encodeURIComponent(k)}"><span class="grow"><span class="clip">${esc(q.q)}</span><span class="meta">${esc(chapterTitle(q.chapter))}</span></span></a>`; }).join('') : '<div class="empty">No mistakes waiting. Wrong MCQ answers land here until you get them right twice in a row.</div>'}</div>
      ${mist.length ? `<a class="btn" href="#/mistakes">See all ${mist.length}</a>` : ''}
    </div>
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><div class="card-head"><h2>${ico('target')} Focus next</h2><a href="#/insights">All insights →</a></div>${focusCard(A, 3, true)}</div>
    <div class="card"><div class="card-head"><h2>${ico('layers')} Chapters</h2><a href="#/library">Library →</a></div>
      <div class="list">${cont.map(x => `<a class="row" href="#/chapter/${x.id}">${ring(x.mastery, 36, 4, masteryColor(x.mastery), x.started ? x.mastery : '–')}<span class="grow"><b>${esc(x.title)}</b><span class="meta">${x.started ? `${x.qTried}/${x.qTotal} questions · ${x.cSeen}/${x.cTotal} cards` : 'Not started'}</span></span>${ico('right')}</a>`).join('')}</div></div>
  </div>
  <div class="section-title"><h2>Activity</h2><a href="#/insights">Insights →</a></div>
  <div class="card">${heatmap(18)}</div>
  </div>`;
}

export function viewLibrary() {
  const A = analyse(); const byId = Object.fromEntries(A.chapters.map(c => [c.id, c]));
  const subs = subjects();
  return `<div class="page">
  <div class="head"><div><div class="eyebrow">Library</div><h1>${esc(D.subject.title)}</h1><p class="sub">${esc(D.subject.book || '')} · ${D.chapters.length} chapters · ${D.mcqs.length} questions · ${D.cards.length} cards</p></div>
  ${subs.length > 1 ? `<div class="seg" data-act-seg="subject">${subs.map(s => `<button data-v="${s.id}" class="${s.id === D.subjectId ? 'on' : ''}">${esc(s.title)}</button>`).join('')}</div>` : ''}</div>
  ${D.subject.sections.map(sec => `<div class="section-title"><h2>${esc(sec.title)}</h2><span class="muted">${sec.chapters.length} chapter${sec.chapters.length === 1 ? '' : 's'}</span></div>
    <div class="chapter-grid">${sec.chapters.map(ch => { const a = byId[ch.id] || {}; const m = a.mastery || 0;
      return `<a class="chapter-card" href="#/chapter/${ch.id}">
        <div class="cc-top">${ring(m, 52, 5, masteryColor(m), a.started ? m : '–')}<div class="grow"><b>${esc(ch.title)}</b><small>${esc(ch.competency || '')}</small></div></div>
        <div class="cc-stats"><span>${ico('mcq')} ${ch.counts.mcqs} MCQs</span><span>${ico('cards')} ${ch.counts.cards} cards</span>${a.mistakes ? `<span class="c-bad">${ico('mistakes')} ${a.mistakes}</span>` : ''}</div>
        <div class="meter"><i style="width:${Math.round((a.coverage || 0) * 100)}%"></i></div>
        <div class="cc-foot muted">${a.started ? `${Math.round((a.coverage || 0) * 100)}% covered${a.acc != null ? ` · ${Math.round(a.acc * 100)}% accuracy` : ''}` : 'Not started'}</div>
      </a>`; }).join('')}</div>`).join('')}
  <div class="callout info" style="margin-top:28px"><b>More chapters are on the way.</b> New subjects and chapters appear here automatically when they’re published — your progress on existing ones is kept.</div>
  </div>`;
}

export function viewChapter(id) {
  const ch = D.chapterById[id]; if (!ch) return viewLibrary();
  const A = analyse(); const a = A.chapters.find(x => x.id === id); const heads = A.headings.filter(h => h.chapter === id);
  const c = counts(id); const studyN = c.new + c.learn + c.due;
  const order = (ch.data.subtopics || []).map(s => s.id);
  heads.sort((x, y) => order.indexOf(x.sub) - order.indexOf(y.sub));
  const kindLink = ch.kind === 'museum' ? `<a class="btn" href="#/museum">${ico('museum')} Open museum</a><a class="btn" href="#/quiz?mode=spotter&r=${now()}">${ico('image')} Spotter quiz</a>`
    : ch.kind === 'gallery' ? `<a class="btn" href="#/museum?tab=micro">${ico('image')} View images</a><a class="btn" href="#/quiz?mode=histo&r=${now()}">${ico('image')} Histology quiz</a>` : '';
  const pctv = v => (v == null ? '—' : Math.round(v * 100) + '%');
  return `<div class="page">
  <div class="crumbs"><a href="#/library">${esc(D.subject.title)}</a>${ico('right')}<span>${esc(ch.sectionTitle)}</span></div>
  <div class="chapter-hero card">
    <div class="ch-ring">${ring(a.mastery, 112, 10, masteryColor(a.mastery), a.started ? a.mastery : '–')}<small>mastery</small></div>
    <div class="grow">
      <h1>${esc(ch.title)}</h1><p class="sub">${esc(ch.competency || '')}${ch.ref ? ` · ${esc(ch.ref)}` : ''}</p>
      <div class="kv">
        <div><b>${a.qTried}/${a.qTotal}</b><span>questions tried</span></div>
        <div><b>${pctv(a.acc)}</b><span>accuracy</span></div>
        <div><b>${a.cSeen}/${a.cTotal}</b><span>cards seen</span></div>
        <div><b>${pctv(a.retention)}</b><span>card recall</span></div>
        <div><b class="${a.mistakes ? 'c-bad' : ''}">${a.mistakes}</b><span>open mistakes</span></div>
      </div>
    </div>
  </div>
  <div class="action-grid">
    <a class="action primary" href="#/study?chapter=${id}">${ico('cards')}<b>Study cards</b><small>${studyN ? `${c.due + c.learn} due · ${c.new} new today` : 'Nothing due — study ahead'}</small></a>
    <a class="action" href="#/mcq?chapter=${id}">${ico('mcq')}<b>Practise MCQs</b><small>Choose difficulty and heading</small></a>
    <a class="action" href="#/quiz?mode=chapter&chapter=${id}&all=1&r=${now()}">${ico('retry')}<b>Redo all questions</b><small>Every question again, ignoring history</small></a>
    <a class="action" href="#/cram?chapter=${id}">${ico('zap')}<b>Practise cards again</b><small>Cram mode — doesn’t change your schedule</small></a>
  </div>
  ${kindLink ? `<div class="hero-actions" style="margin-top:12px">${kindLink}</div>` : ''}
  <div class="section-title"><h2>Competency headings</h2><span class="muted">Weakest areas show in red</span></div>
  <div class="card" style="padding:6px 8px">${heads.length ? `<div class="heads">${heads.map(h => { const accp = h.acc == null ? null : Math.round(h.acc * 100);
    return `<div class="head-row"><div class="grow"><b>${esc(h.title)}</b><small>${h.qTotal} questions · ${h.cTotal} cards${h.mistakes ? ` · <span class="c-bad">${h.mistakes} mistakes</span>` : ''}</small></div>
      <div class="hbar"><div class="meter"><i style="width:${accp ?? 0}%;background:${accp == null ? 'var(--line-strong)' : accp >= 75 ? 'var(--good)' : accp >= 50 ? 'var(--warn)' : 'var(--bad)'}"></i></div><small>${accp == null ? 'not tried' : accp + '%'}</small></div>
      <div class="head-acts">${h.qTotal ? `<a class="btn sm" href="#/quiz?mode=heading&chapter=${id}&sub=${encodeURIComponent(h.sub)}&r=${now()}">Practise</a>` : ''}${h.cTotal ? `<a class="btn sm ghost" href="#/cram?chapter=${id}&sub=${encodeURIComponent(h.sub)}">Cards</a>` : ''}</div></div>`; }).join('')}</div>` : '<div class="empty">No headings in this chapter.</div>'}</div>
  <div class="section-title"><h2>Start over</h2></div>
  <div class="card settings">
    <div class="setting"><div><b>Include in daily study</b><small>When off, this chapter’s cards stay out of “Study all”.</small></div><button class="switch${isExcluded(id) ? '' : ' on'}" data-act="toggle-chapter" data-id="${id}" aria-pressed="${!isExcluded(id)}"><i></i></button></div>
    <div class="setting"><div><b>Reset flashcards</b><small>All ${ch.counts.cards} cards go back to new and are re-introduced over the coming days.</small></div><button class="btn sm danger" data-act="reset-cards" data-id="${id}">${ico('retry')} Reset cards</button></div>
    <div class="setting"><div><b>Reset question history</b><small>Clears scores, flags and mistakes for this chapter’s questions so you can start fresh.</small></div><button class="btn sm danger" data-act="reset-mcqs" data-id="${id}">${ico('retry')} Reset questions</button></div>
  </div>
  </div>`;
}

export const actions = {
  'toggle-chapter': (el, rerender) => { toggleExcluded(el.dataset.id); rerender(); },
  'reset-cards': (el, rerender) => { if (!el.dataset.confirm) { el.dataset.confirm = 1; el.textContent = 'Tap again to reset'; return; } const n = resetCards(el.dataset.id, D); toast(`Flashcards reset${n ? ` (${n} cards had progress)` : ''}`); rerender(); },
  'reset-mcqs': (el, rerender) => { if (!el.dataset.confirm) { el.dataset.confirm = 1; el.textContent = 'Tap again to reset'; return; } const n = resetMcqs(el.dataset.id, D); toast(`Question history cleared${n ? ` (${n} questions)` : ''}`); rerender(); }
};
