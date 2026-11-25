#!/usr/bin/env node
// Validates every chapter listed in content/manifest.json and writes content/index.json.
// Usage: node scripts/build.mjs          (exits 1 if anything is wrong)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = p => join(root, 'content', p);
const errors = [], warnings = [];
const err = (f, m) => errors.push(`${f}: ${m}`);
const warn = (f, m) => warnings.push(`${f}: ${m}`);
const DIFFS = new Set(['easy', 'medium', 'hard']);

const manifest = JSON.parse(readFileSync(C('manifest.json'), 'utf8'));
const index = { version: 2, built: new Date().toISOString(), subjects: [] };

for (const subj of manifest.subjects) {
  if (!/^[a-z0-9-]+$/.test(subj.id)) err('manifest', `bad subject id "${subj.id}"`);
  const outSubj = { ...subj, sections: [] };
  const seenChapters = new Set();
  for (const sec of subj.sections) {
    const outSec = { id: sec.id, title: sec.title, chapters: [] };
    for (const ch of sec.chapters) {
      const rel = `${subj.id}/${ch}.json`; const file = C(rel);
      if (seenChapters.has(ch)) err('manifest', `chapter "${ch}" listed twice in ${subj.id}`);
      seenChapters.add(ch);
      if (!existsSync(file)) { err(rel, 'file not found'); continue; }
      const raw = readFileSync(file, 'utf8');
      let j; try { j = JSON.parse(raw); } catch (e) { err(rel, 'invalid JSON — ' + e.message); continue; }
      if (j.id !== ch) err(rel, `"id" is "${j.id}" but the file/manifest name is "${ch}"`);
      if (!j.title) err(rel, 'missing "title"');
      const subs = new Set((j.subtopics || []).map(s => s.id));
      const ids = new Set();
      const uniq = (id, what) => { if (!id) err(rel, `${what} without id`); else if (ids.has(id)) err(rel, `duplicate id "${id}"`); ids.add(id); };
      const mcqs = j.mcqs || [], cards = j.cards || [], specimens = j.specimens || [], images = j.images || [];
      mcqs.forEach(q => {
        uniq(q.id, 'mcq');
        if (!q.q) err(rel, `${q.id}: empty question`);
        if (!Array.isArray(q.opts) || q.opts.length !== 4) err(rel, `${q.id}: needs exactly 4 options`);
        else if (new Set(q.opts).size !== 4) err(rel, `${q.id}: duplicate options`);
        if (!(Number.isInteger(q.ans) && q.ans >= 0 && q.ans <= 3)) err(rel, `${q.id}: "ans" must be 0–3`);
        if (!DIFFS.has(q.diff)) err(rel, `${q.id}: "diff" must be easy, medium or hard`);
        if (!q.exp) warn(rel, `${q.id}: no explanation`);
        if (q.sub && !subs.has(q.sub)) err(rel, `${q.id}: sub "${q.sub}" is not in subtopics`);
        if (q.img && !existsSync(join(root, q.img))) err(rel, `${q.id}: image ${q.img} not found`);
      });
      cards.forEach(c => {
        uniq(c.id, 'card');
        if (!c.front || !c.back) err(rel, `${c.id}: card needs front and back`);
        if (c.sub && !subs.has(c.sub)) err(rel, `${c.id}: sub "${c.sub}" is not in subtopics`);
        if (c.img && !existsSync(join(root, c.img))) err(rel, `${c.id}: image ${c.img} not found`);
      });
      specimens.forEach(s => {
        uniq('spec-' + s.id, 'specimen');
        (s.images || []).forEach(im => { if (!existsSync(join(root, im))) err(rel, `${s.id}: image ${im} not found`); });
        if (!s.gross || !s.gross.length) err(rel, `${s.id}: needs gross features`);
      });
      images.forEach(m => { uniq('img-' + m.slug, 'image'); if (!existsSync(join(root, m.file))) err(rel, `${m.slug}: ${m.file} not found`); if (!m.license) warn(rel, `${m.slug}: no licence recorded`); });
      (j.subtopics || []).forEach(s => { if (mcqs.length && !mcqs.some(q => q.sub === s.id) && !specimens.length && !images.length) warn(rel, `subtopic "${s.id}" has no MCQs`); });
      const hash = createHash('sha1').update(raw).digest('hex').slice(0, 10);
      const spotters = specimens.filter(s => s.images && s.images.length && s.quizCrop).length;
      outSec.chapters.push({
        id: ch, title: j.title, competency: j.competency || '', ref: j.ref || '', hash,
        subtopics: (j.subtopics || []).map(s => ({ id: s.id, title: s.title })),
        counts: { mcqs: mcqs.length + spotters + images.length, cards: cards.length + specimens.length + images.length, specimens: specimens.length, images: images.length },
        kind: specimens.length ? 'museum' : images.length ? 'gallery' : 'topic'
      });
    }
    outSubj.sections.push(outSec);
  }
  index.subjects.push(outSubj);
}

warnings.forEach(w => console.warn('warn  ' + w));
if (errors.length) { errors.forEach(e => console.error('ERROR ' + e)); console.error(`\n${errors.length} error(s). index.json not written.`); process.exit(1); }
writeFileSync(C('index.json'), JSON.stringify(index, null, 1));
for (const s of index.subjects) {
  const chs = s.sections.flatMap(x => x.chapters);
  console.log(`${s.title}: ${chs.length} chapters, ${chs.reduce((a, c) => a + c.counts.mcqs, 0)} MCQs, ${chs.reduce((a, c) => a + c.counts.cards, 0)} cards`);
}
console.log('content/index.json written.');
