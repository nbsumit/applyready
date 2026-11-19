/* Unit tests for js/lib/applicants.js, the memory-only model behind applicant workspaces, and the
   file-name helpers in js/lib/files.js they share with the batch tools. Object URLs are faked, so the
   tests can check that every URL an applicant owned is revoked. */
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
    a.name = 'Ravi Kumar';
    ok(Model.zipName('BCA 2026/27 {applicant}', a, d) === 'BCA 2026-27 Ravi-Kumar.zip', 'a slash typed in the pattern becomes a hyphen, so nothing before it is lost');
    ok(Model.zipName('Class 10\\A {n}', a, d) === 'Class 10-A 1.zip', 'a backslash typed in the pattern becomes a hyphen');
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


  // File names and sizes shared by the batch tools and applicant workspaces (js/lib/files.js)
  {
    const Files = require('../js/lib/files.js');
    const MB = 1000 * 1000;
    // A Windows device name is reserved whatever follows the first dot (CON.jpg, con.backup.jpg, NUL.tar.gz).
    const named = n => Files.safeFileName(n, 'image');
    ok(named('CON.jpg') === 'image_CON.jpg' && named('con.backup.jpg') === 'image_con.backup.jpg' && named('NUL.tar.gz') === 'image_NUL.tar.gz', 'device names are prefixed with or without more dots');
    ok(named('COM1.a.b.png') === 'image_COM1.a.b.png' && named('Lpt9.x.jpg') === 'image_Lpt9.x.jpg' && named('aux .final.jpeg') === 'image_aux .final.jpeg' && named('COM¹.png') === 'image_COM¹.png', 'COM and LPT with any digit, superscripts and a space before the dot');
    ok(named('console.jpg') === 'console.jpg' && named('photo.con.jpg') === 'photo.con.jpg' && named('com10.jpg') === 'com10.jpg', 'names that only contain a device name are left alone');
    // A size over a limit never reads as the limit itself. Sizes use 1 MB = 1,000,000 bytes, rounded up.
    ok(Files.formatOver(52920054, 50 * MB) === '52.93 MB', `52,920,054 bytes reads as 52.93 MB beside a 50 MB limit (${Files.formatOver(52920054, 50 * MB)})`);
    ok(Files.formatOver(50 * MB + 5000, 50 * MB) === '50.01 MB' && Files.formatOver(50 * MB + 1, 50 * MB) === '50.01 MB', 'a size just over the limit is rounded up, so it reads as over it');
    ok(Files.formatOver(51 * MB, 50 * MB) === '51 MB' && Files.formatOver(5.04 * MB, 5 * MB) === '5.04 MB', 'clear sizes are written as usual');
    // INTE-1 / TOOL-3: one size rule for the whole site. 1 KB = 1,000 bytes, rounded up, so the same file
    // reads the same in every tool and never as under a maximum it is over; a maximum of N KB is met at
    // N x 1,000 bytes and a minimum at N x 1,024 bytes, whichever way a portal counts a KB.
    ok(Files.formatBytes(505000) === '505 KB' && Files.formatBytes(505001) === '505.1 KB' && Files.formatBytes(439144) === '439.2 KB' && Files.formatBytes(49999) === '50 KB' && Files.formatBytes(999) === '999 B', 'sizes: 1 KB = 1,000 bytes, rounded up to 0.1 KB');
    ok(Files.formatBytes(1000001) === '1.01 MB' && Files.formatBytes(4544210) === '4.55 MB' && Files.formatBytes(100 * MB) === '100 MB', 'sizes: 1 MB = 1,000,000 bytes, rounded up to 0.01 MB');
    ok(Files.formatExact(49873) === '49.9 KB (49,873 bytes)' && Files.grouped(497925) === '497,925' && Files.grouped(2000) === '2,000', 'exact byte counts are grouped the same in every browser');
    ok(Files.maxBytes(500) === 500000 && Files.maxBytes(50) === 50000 && Files.minBytes(20, 50) === 20480 && Files.minBytes(49, 50) === 49000, 'limits: a maximum at kb x 1,000 bytes, a minimum at kb x 1,024 bytes (or 1,000 when that leaves no room)');
    ok(Files.LIMITS.image === 50 * MB && Files.formatBytes(Files.LIMITS.pdf) === '100 MB', 'file-size caps read as round numbers in the same unit');
    // Plain still images: no hidden details and no animation.
    const be32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    const le32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
    const bytes = s => Array.from(s, c => c.charCodeAt(0));
    const seg = (m, data) => [0xFF, m, ((data.length + 2) >> 8) & 255, (data.length + 2) & 255, ...data];
    const jpeg = (...segs) => new Uint8Array([0xFF, 0xD8, ...segs.flat(), ...seg(0xDA, [1, 2, 3]), 0x11, 0x22, 0xFF, 0xD9]);
    const jfif = seg(0xE0, bytes('JFIF\0\x01\x01\0\0\x01\0\x01\0\0'));
    ok(Files.plainStill(jpeg(jfif, seg(0xE2, bytes('ICC_PROFILE\0'))) ), 'a JPEG with only JFIF and a colour profile is plain');
    ok(!Files.plainStill(jpeg(jfif, seg(0xE1, bytes('Exif\0\0MM')))) && !Files.plainStill(jpeg(jfif, seg(0xE1, bytes('http://ns.adobe.com/xap/1.0/\0')))), 'EXIF or XMP is a hidden detail');
    ok(!Files.plainStill(jpeg(jfif, seg(0xFE, bytes('a comment')))) && !Files.plainStill(jpeg(jfif, seg(0xED, bytes('Photoshop 3.0\0')))), 'a comment or IPTC block is a hidden detail');
    ok(!Files.plainStill(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 16, 1, 2])), 'a JPEG cut off before its image data is not plain');
    const chunk = (type, data) => [...be32(data.length), ...bytes(type), ...data, 0, 0, 0, 0];
    const png = (...chunks) => new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...chunk('IHDR', new Array(13).fill(0)), ...chunks.flat(), ...chunk('IDAT', [1, 2, 3]), ...chunk('IEND', [])]);
    ok(Files.plainStill(png()) && Files.plainStill(png(chunk('iCCP', [1, 2]))), 'a PNG with image data only (and a colour profile) is plain');
    ok(!Files.plainStill(png(chunk('tEXt', bytes('Author\0x')))) && !Files.plainStill(png(chunk('eXIf', [1]))) && !Files.plainStill(png(chunk('acTL', [0, 0, 0, 2, 0, 0, 0, 0]))), 'PNG text, EXIF and animation are not plain');
    const riff = (...chunks) => { const body = [...bytes('WEBP'), ...chunks.flat()]; return new Uint8Array([...bytes('RIFF'), ...le32(body.length), ...body]); };
    const wchunk = (type, data) => [...bytes(type), ...le32(data.length), ...data, ...(data.length & 1 ? [0] : [])];
    ok(Files.plainStill(riff(wchunk('VP8 ', [1, 2, 3, 4]))), 'a simple WebP is plain');
    ok(!Files.plainStill(riff(wchunk('VP8X', [0x08, 0, 0, 0, 0, 0, 0, 0, 0, 0]), wchunk('VP8 ', [1, 2]), wchunk('EXIF', [1, 2, 3]))) && !Files.plainStill(riff(wchunk('VP8X', [0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0]))), 'WebP with EXIF or animation is not plain');
    ok(!Files.plainStill(bytes('GIF89a')) && !Files.plainStill(new Uint8Array(0)), 'other types and nothing at all are not plain');
    // What is hidden, so a note can name the real reason (animation is not "camera or location data").
    const parts = b => JSON.stringify(Files.hiddenParts(b));
    ok(parts(jpeg(jfif, seg(0xE1, bytes('Exif\0\0MM')))) === '["camera"]' && parts(jpeg(jfif, seg(0xE1, bytes('http://ns.adobe.com/xap/1.0/\0')))) === '["description"]', 'JPEG: EXIF is camera data, XMP is description data');
    ok(parts(jpeg(jfif, seg(0xFE, bytes('hi')), seg(0xED, bytes('Photoshop 3.0\0')))) === '["description","text"]', 'JPEG: a comment is text, IPTC is description; every kind is listed');
    ok(parts(jpeg(jfif, seg(0xE2, bytes('MPF\0II*\0')))) === '["other"]' && parts(jpeg(jfif, seg(0xE2, bytes('ICC_PROFILE\0')))) === '[]', 'JPEG: extra pictures (MPF) are hidden data, a colour profile is not');
    ok(parts(png(chunk('tEXt', bytes('Software\0Shot 1.0')))) === '["text"]' && parts(png(chunk('iTXt', bytes('XML:com.adobe.xmp\0\0\0\0\0<x/>')))) === '["description"]', 'PNG: a text note is text, XMP in iTXt is description');
    ok(parts(png(chunk('acTL', [0, 0, 0, 3, 0, 0, 0, 0]))) === '["animation"]' && parts(png(chunk('tIME', [7, 234, 1, 1, 0, 0, 0]), chunk('eXIf', [1]))) === '["camera","date"]', 'PNG: animation, a saved time and EXIF');
    ok(parts(riff(wchunk('VP8X', [0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0]), wchunk('ANIM', [0, 0, 0, 0, 0, 0]), wchunk('ANMF', [1, 2]))) === '["animation"]', 'WebP: an animation is only animation');
    ok(parts(riff(wchunk('VP8X', [0x0C, 0, 0, 0, 0, 0, 0, 0, 0, 0]), wchunk('VP8 ', [1, 2]))) === '["camera","description"]', 'WebP: the EXIF and XMP flags');
    ok(Files.hiddenParts(bytes('GIF89a')) === null && Files.hiddenParts(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 16, 1, 2])) === null, 'unknown types and cut-off files say nothing (null)');
  }

  console.log(`✓ applicant workspace model: ${checks} checks passed`);
})().catch(e => { console.error('✗', e.message); process.exit(1); });
