/* Unit tests for js/lib/applicants.js, the memory-only model behind applicant workspaces.
   Object URLs are faked, so the tests can check that every URL an applicant owned is revoked. */
'use strict';
const assert = require('node:assert/strict');
const Model = require('../js/lib/applicants.js');

let checks = 0;
const ok = (c, m) => { assert(c, m); checks++; };

function fakeEnv() {
  const live = new Set();
  let n = 0;
  return {
    live,
    createURL: () => { const u = `blob:test/${++n}`; live.add(u); return u; },
    revokeURL: u => { live.delete(u); }
  };
}
const file = (name, size) => ({ name, size: size || 1000 });
const blob = (type) => ({ type: type || 'image/jpeg', size: 10 });

(async () => {
  // Numbering, labels and the active applicant
  {
    const env = fakeEnv();
    const s = Model.createSession(env);
    const a = s.add();
    const b = s.add();
    ok(a.label === 'Applicant 1' && b.label === 'Applicant 2', 'applicants are numbered from 1');
    ok(s.active === b, 'a new applicant becomes active');
    b.name = '  Meena  ';
    ok(b.label === 'Meena', 'a typed name is used, trimmed');
    s.activate(a.id);
    ok(s.active === a, 'activate switches the active applicant');
    s.finish(a.id);
    const c = s.add();
    ok(c.label === 'Applicant 3', 'numbers are not reused within a session');
    s.end();
    ok(s.add().label === 'Applicant 1', 'ending the session starts numbering again');
  }

  // Isolation: files, results and URLs belong to one applicant
  {
    const env = fakeEnv();
    const s = Model.createSession(env);
    const a = s.add(), b = s.add();
    const fa = a.addFile(file('ravi.jpg'), { kind: 'image' });
    fa.thumb = a.adoptURL(env.createURL());
    const fb = b.addFile(file('meena.pdf'), { kind: 'pdf' });
    ok(fa.kind === 'image' && fb.kind === 'pdf' && fb.checking, 'file kinds are recorded; PDFs are checked first');
    const ra = a.addResult({ blob: blob(), name: 'ravi-photo.jpg', facts: { width: 350, height: 450 } });
    const rb = b.addResult({ blob: blob('application/pdf'), name: 'meena.pdf' });
    ok(a.files.length === 1 && b.files.length === 1 && a.results.length === 1 && b.results.length === 1, 'each applicant has only its own files and results');
    ok(ra.url !== rb.url && a.urlCount === 2 && b.urlCount === 1, 'each applicant owns its URLs');
    ok(rb.kind === 'pdf', 'result kind follows the blob type');
    const dup = a.addResult({ blob: blob(), name: 'ravi-photo.jpg' });
    ok(dup.name === 'ravi-photo (2).jpg', 'result names are unique within an applicant');
    ok(b.addResult({ blob: blob(), name: 'ravi-photo.jpg' }).name === 'ravi-photo.jpg', 'names in another applicant do not clash');
    const ownedByA = [fa.thumb, ra.url, dup.url];
    s.finish(a.id);
    ok(a.finished && a.files.length === 0 && a.results.length === 0 && a.urlCount === 0, 'finishing drops every file, result and URL');
    ok(ownedByA.every(u => !env.live.has(u)), 'finished applicant URLs are revoked');
    ok(env.live.size === 2 && b.urlCount === 2, 'the other applicant keeps its URLs');
    ok(s.active === b, 'the next applicant becomes active after finishing');
    ok(a.addFile(file('late.jpg'), { kind: 'image' }) === null && a.addResult({ blob: blob(), name: 'x.jpg' }) === null, 'a finished applicant accepts nothing new');
    const late = env.createURL();
    ok(a.adoptURL(late) === null && !env.live.has(late), 'a URL handed to a finished applicant is revoked at once');
    s.end();
    ok(env.live.size === 0, 'ending the session revokes every URL');
    ok(s.size === 0 && s.active === null, 'ending the session removes every applicant');
  }

  // Jobs: results reach only the applicant that started them, and finishing cancels them
  {
    const env = fakeEnv();
    const s = Model.createSession(env);
    const a = s.add(), b = s.add();
    const f = a.addFile(file('scan.jpg'), { kind: 'image' });
    const j1 = a.startJob({ label: 'Photo', fileIds: [f.id] });
    ok(a.busyFile(f.id) && a.status === 'working', 'a running job marks its file busy');
    s.activate(b.id);
    ok(a.endJob(j1) === true, 'a job still belongs to its applicant after switching away');
    a.addResult({ blob: blob(), name: 'scan-photo.jpg' });
    ok(a.results.length === 1 && b.results.length === 0, 'the result lands with the applicant that started the job');
    const j2 = a.startJob({ label: 'Signature', fileIds: [f.id] });
    let aborted = false;
    j2.signal.addEventListener('abort', () => { aborted = true; });
    s.finish(a.id);
    ok(aborted, 'finishing an applicant aborts its running jobs');
    ok(a.endJob(j2) === false, 'a job of a finished applicant must drop its result');
    const j3 = b.startJob({ label: 'PDF' });
    b.cancelJob(j3.id);
    ok(b.endJob(j3) === false, 'a cancelled job must drop its result');
    ok(b.jobs.length === 0, 'ended jobs are removed');
    let threw = false;
    try { a.startJob({}); } catch (e) { threw = e.name === 'AbortError'; }
    ok(threw, 'a finished applicant cannot start jobs');
  }

  // Status and counts
  {
    const s = Model.createSession(fakeEnv());
    const a = s.add();
    ok(a.status === 'new' && !a.hasData && !s.hasData(), 'an empty applicant is new and holds no data');
    const fx = a.addFile(file('x.jpg'), { kind: 'image' });
    ok(a.status === 'added' && s.hasData(), 'files with nothing run yet are not started, not in progress');
    const running = a.startJob({ fileIds: [fx.id] });
    ok(a.status === 'working', 'a running task is in progress');
    a.endJob(running);
    ok(a.status === 'added', 'a task that ended without a result leaves it not started');
    const r1 = a.addResult({ blob: blob(), name: 'one.jpg' });
    a.addResult({ blob: blob(), name: 'two.jpg' });
    ok(a.status === 'ready' && a.counts().waiting === 2, 'results to download make it ready');
    a.markDownloaded([r1.id]);
    ok(a.counts().downloaded === 1 && a.status === 'ready', 'one of two downloaded is still ready');
    a.markDownloaded();
    ok(a.status === 'downloaded' && a.counts().waiting === 0, 'all downloaded');
    a.removeResult(r1.id);
    ok(a.results.length === 1 && a.urlCount === 1, 'removing a result releases its URL');
    ok(a.addResult({ blob: blob(), name: 'one.jpg' }).name === 'one.jpg', 'a removed result frees its name');
  }

  // Files: order, limit, removal
  {
    const env = fakeEnv();
    const s = Model.createSession(env);
    const a = s.add();
    const f1 = a.addFile(file('1.jpg'), { kind: 'image' });
    const f2 = a.addFile(file('2.jpg'), { kind: 'image' });
    a.moveFile(f2.id, -1);
    ok(a.files[0] === f2, 'files can be moved up');
    ok(a.moveFile(f2.id, -1) === false, 'the first file cannot move further up');
    f1.thumb = a.adoptURL(env.createURL());
    const t = f1.thumb;
    a.removeFile(f1.id);
    ok(!env.live.has(t) && a.files.length === 1, 'removing a file releases its thumbnail URL');
    for (let i = 0; i < 60; i++) a.addFile(file(`${i}.jpg`), { kind: 'image' });
    ok(a.files.length === Model.MAX_FILES, `an applicant holds at most ${Model.MAX_FILES} files`);
    f2.selected = true; f2.error = 'damaged';
    ok(!a.selected.includes(f2), 'a damaged file is never part of a selection');
  }

  // ZIP names
  {
    const s = Model.createSession(fakeEnv());
    const a = s.add();
    const d = new Date(2026, 10, 18, 9, 5);
    ok(Model.zipName('{applicant}-{date}', a, d) === 'Applicant-1-2026-11-18.zip', 'default pattern with the default label');
    a.name = 'Ravi Kumar';
    ok(Model.zipName('{applicant}-{date}', a, d) === 'Ravi-Kumar-2026-11-18.zip', 'spaces in the name become hyphens');
    ok(Model.zipName('cafe-{n}-{applicant}.zip', a, d) === 'cafe-1-Ravi-Kumar.zip', '{n} and an explicit .zip are handled');
    ok(Model.zipName('', a, d) === 'Ravi-Kumar-2026-11-18.zip', 'an empty pattern falls back to the default');
    a.name = 'Ravi S/O Ramesh';
    ok(Model.zipName('{applicant}-{date}', a, d) === 'Ravi-S-O-Ramesh-2026-11-18.zip', 'a slash in the name (S/O) keeps the whole name');
    a.name = 'Ravi\\Kumar: "S" ';
    ok(Model.zipName('{applicant}-{date}', a, d) === 'Ravi-Kumar-S-2026-11-18.zip', 'characters a file name cannot hold become hyphens');
    a.name = '//';
    ok(Model.zipName('{applicant}-{date}', a, d) === 'Applicant-1-2026-11-18.zip', 'a name of only such characters falls back to the number');
  }

  // Results follow the order of the files they came from
  {
    const s = Model.createSession(fakeEnv());
    const a = s.add();
    const photo = a.addFile(file('photo.jpg'), { kind: 'image' });
    const sign = a.addFile(file('sign.jpg'), { kind: 'image' });
    const scan = a.addFile(file('scan.pdf'), { kind: 'pdf' });
    const rScan = a.addResult({ blob: blob('application/pdf'), name: 'scan.pdf', sourceIds: [scan.id] });
    const rSign = a.addResult({ blob: blob(), name: 'sign-signature.jpg', sourceIds: [sign.id] });
    const rBoth = a.addResult({ blob: blob('application/pdf'), name: 'photo-combined.pdf', sourceIds: [sign.id, photo.id] });
    const rPhoto = a.addResult({ blob: blob(), name: 'photo-photo.jpg', sourceIds: [photo.id] });
    ok(a.orderedResults.map(r => r.name).join(',') === 'photo-combined.pdf,photo-photo.jpg,sign-signature.jpg,scan.pdf', `results follow the file list, not the finishing order (${a.orderedResults.map(r => r.name)})`);
    a.moveFile(scan.id, -2);
    ok(a.orderedResults[0] === rScan, 'moving a file moves its results');
    a.removeFile(sign.id);
    ok(a.orderedResults.indexOf(rSign) === a.results.length - 1 && a.orderedResults.includes(rBoth) && a.orderedResults.includes(rPhoto), 'a result whose file was removed goes last');
  }

  // Events
  {
    const s = Model.createSession(fakeEnv());
    const seen = [];
    s.on((type) => seen.push(type));
    const a = s.add();
    const j = a.startJob({});
    a.progress(j, 0.5, 'Half');
    ok(j.progress === 0.5 && j.text === 'Half', 'progress is recorded');
    ok(seen.includes('list') && seen.includes('change') && seen.includes('progress'), 'the model reports list, change and progress events');
  }

  console.log(`✓ applicant workspace model: ${checks} checks passed`);
})().catch(e => { console.error('✗', e.message); process.exit(1); });
