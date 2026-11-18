/* ApplyReady applicant sessions: the memory-only model behind applicant workspaces (workspace.html).

   A session holds applicants. Each applicant is a separate object that owns everything of that
   person: their files, results, running jobs, error messages and every object URL made for them.
   Nothing is shared between applicants and nothing is written to any storage: when an applicant is
   finished, their jobs are cancelled, their object URLs are revoked and every reference is dropped.

   const session = ApplyReadyApplicants.createSession({ createURL, revokeURL });
   const a = session.add();                       // 'Applicant 1', becomes the active applicant
   a.addFile(file, info) / a.removeFile(id)
   const job = a.startJob({ label, fileIds });    // job.signal for the engine
   ... const ok = a.endJob(job);                  // false: cancelled or applicant finished, drop the result
   if (ok) a.addResult({ blob, name, kind, facts, notes, warning, sourceIds });
   session.finish(a.id)                           // wipe one applicant, returns the next one (or null)
   session.end()                                  // wipe everyone

   No DOM here, so the model runs in Node for tests (createURL and revokeURL are injected there). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ApplyReadyApplicants = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_FILES = 50;
  const abortError = () => (typeof DOMException === 'function' ? new DOMException('Cancelled', 'AbortError') : Object.assign(new Error('Cancelled'), { name: 'AbortError' }));

  /** Make `name` unique within `used` (a Set of lower-case names): photo.jpg, photo (2).jpg, ... */
  function uniqueName(name, used) {
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let candidate = name;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${stem} (${n})${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  }

  /**
   * "{applicant}-{date}" with the applicant's label, today's date and number. Spaces and characters
   * a file name cannot hold become hyphens, so "Ravi S/O Ramesh" gives "Ravi-S-O-Ramesh": a slash
   * would otherwise be read as a folder and everything before it lost. A slash typed in the pattern
   * itself ("BCA 2026/27-{applicant}") becomes a hyphen for the same reason.
   */
  function zipName(pattern, applicant, now) {
    const d = now instanceof Date ? now : new Date();
    const two = n => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
    const time = `${two(d.getHours())}${two(d.getMinutes())}`;
    const label = String(applicant.label).trim()
      .replace(/[\s\\/:*?"<>|\u0000-\u001f]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '') || `Applicant-${applicant.number}`;
    let base = String(pattern || '{applicant}-{date}')
      .replace(/\{applicant\}/gi, label)
      .replace(/\{date\}/gi, date)
      .replace(/\{time\}/gi, time)
      .replace(/\{n\}/gi, String(applicant.number))
      .replace(/\.zip$/i, '')
      .replace(/\s*[\\/]+\s*/g, '-')
      .trim();
    if (!base) base = `${label}-${date}`;
    return `${base}.zip`;
  }

  function createSession(env) {
    const e = env || {};
    const createURL = e.createURL || (blob => URL.createObjectURL(blob));
    const revokeURL = e.revokeURL || (url => URL.revokeObjectURL(url));
    const listeners = new Set();
    let applicants = [];
    let activeId = null;
    let number = 0;   // shown in "Applicant 1", "Applicant 2"... never reused within a session
    let uid = 0;      // ids for applicants, files, results and jobs; unique within the session
    const next = p => `${p}${++uid}`;
    const emit = (type, detail) => listeners.forEach(fn => { try { fn(type, detail); } catch (err) { /* a listener must not break the model */ } });

    class Applicant {
      constructor() {
        this.id = next('a');
        this.number = ++number;
        this.name = '';
        this.files = [];
        this.results = [];
        this.jobs = [];
        this.errors = [];
        this.finished = false;
        this.zipping = false;
        this._urls = new Set();
        this._names = new Set();
      }

      get label() { return String(this.name || '').trim() || `Applicant ${this.number}`; }

      /** An object URL owned by this applicant; revoked when the applicant is finished. */
      url(blob) {
        if (this.finished) throw abortError();
        const u = createURL(blob);
        this._urls.add(u);
        return u;
      }

      /** Take ownership of a URL made elsewhere (thumbnails). Revoked at once if this applicant is gone. */
      adoptURL(u) {
        if (!u) return null;
        if (this.finished) { revokeURL(u); return null; }
        this._urls.add(u);
        return u;
      }

      releaseURL(u) { if (u && this._urls.delete(u)) revokeURL(u); }

      get urlCount() { return this._urls.size; }

      addFile(file, info) {
        if (this.finished) return null;
        if (this.files.length >= MAX_FILES) return null;
        const kind = info && info.kind === 'pdf' ? 'pdf' : 'image';
        const entry = {
          id: next('f'), file, info: info || null, kind,
          name: file && file.name ? String(file.name) : (kind === 'pdf' ? 'document.pdf' : 'image'),
          size: file && typeof file.size === 'number' ? file.size : 0,
          width: 0, height: 0, pages: 0, encrypted: false, password: undefined,
          thumb: null, selected: false, error: '', checking: kind === 'pdf'
        };
        this.files.push(entry);
        emit('change', this);
        return entry;
      }

      file(id) { return this.files.find(f => f.id === id) || null; }

      removeFile(id) {
        const i = this.files.findIndex(f => f.id === id);
        if (i < 0) return false;
        const [f] = this.files.splice(i, 1);
        this.releaseURL(f.thumb);
        f.thumb = null; f.file = null; f.password = undefined;
        emit('change', this);
        return true;
      }

      moveFile(id, delta) {
        const i = this.files.findIndex(f => f.id === id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= this.files.length) return false;
        const [f] = this.files.splice(i, 1);
        this.files.splice(j, 0, f);
        emit('change', this);
        return true;
      }

      get selected() { return this.files.filter(f => f.selected && !f.error && !f.checking); }

      /** Add a finished result. Returns the entry, or null when this applicant is already finished. */
      addResult(r) {
        if (this.finished) return null;
        const entry = {
          id: next('r'),
          blob: r.blob,
          name: uniqueName(String(r.name || 'result'), this._names),
          kind: r.kind || (r.blob && r.blob.type === 'application/pdf' ? 'pdf' : 'image'),
          action: r.action || '',
          facts: r.facts || {},
          notes: r.notes || [],
          warning: r.warning || '',
          sourceIds: r.sourceIds || [],
          downloaded: false,
          url: null
        };
        entry.url = this.url(r.blob);
        this.results.push(entry);
        emit('change', this);
        return entry;
      }

      result(id) { return this.results.find(r => r.id === id) || null; }

      removeResult(id) {
        const i = this.results.findIndex(r => r.id === id);
        if (i < 0) return false;
        const [r] = this.results.splice(i, 1);
        this._names.delete(r.name.toLowerCase());
        this.releaseURL(r.url);
        r.url = null; r.blob = null;
        emit('change', this);
        return true;
      }

      markDownloaded(ids) {
        let changed = false;
        this.results.forEach(r => { if ((!ids || ids.includes(r.id)) && !r.downloaded) { r.downloaded = true; changed = true; } });
        if (changed) emit('change', this);
        return changed;
      }

      /** Start a job for this applicant. Its signal is aborted when the job is cancelled or the applicant finished. */
      startJob(options) {
        if (this.finished) throw abortError();
        const o = options || {};
        const controller = new AbortController();
        const job = { id: next('j'), label: o.label || 'Working', fileIds: o.fileIds || [], action: o.action || '', progress: 0, text: o.text || 'Starting…', controller, signal: controller.signal };
        this.jobs.push(job);
        emit('change', this);
        return job;
      }

      job(id) { return this.jobs.find(j => j.id === id) || null; }

      progress(job, fraction, text) {
        if (!this.jobs.includes(job)) return;
        job.progress = Math.max(0, Math.min(1, Number(fraction) || 0));
        if (text) job.text = text;
        emit('progress', { applicant: this, job });
      }

      /**
       * A job has stopped (finished, failed or cancelled). Returns true only when its outcome still
       * belongs here: the job was not cancelled and this applicant has not been finished.
       */
      endJob(job) {
        const i = this.jobs.indexOf(job);
        if (i >= 0) this.jobs.splice(i, 1);
        const alive = i >= 0 && !this.finished && !job.signal.aborted;
        if (i >= 0 && !this.finished) emit('change', this);
        return alive;
      }

      cancelJob(id) {
        const job = this.job(id);
        if (!job) return false;
        job.controller.abort();
        return true;
      }

      busyFile(id) { return this.jobs.some(j => j.fileIds.includes(id)); }

      addError(text) {
        if (this.finished) return null;
        const err = { id: next('e'), text: String(text) };
        this.errors.push(err);
        emit('change', this);
        return err;
      }

      dismissError(id) {
        const i = this.errors.findIndex(x => x.id === id);
        if (i >= 0) { this.errors.splice(i, 1); emit('change', this); }
      }

      counts() {
        const downloaded = this.results.filter(r => r.downloaded).length;
        return { files: this.files.length, results: this.results.length, downloaded, running: this.jobs.length, waiting: this.results.length - downloaded };
      }

      /** new: nothing added | added: files, but nothing run yet | working: a task is running |
          ready: results to download | downloaded: all downloaded */
      get status() {
        const c = this.counts();
        if (!c.files && !c.results && !c.running) return 'new';
        if (c.running) return 'working';
        if (!c.results) return 'added';
        return c.waiting ? 'ready' : 'downloaded';
      }

      /**
       * Results in the order of the files they came from (the first source file counts), so the list
       * and the ZIP follow the file list, not the order in which tasks happened to finish. Results
       * whose files were removed follow, in the order they were made.
       */
      get orderedResults() {
        const pos = new Map(this.files.map((f, i) => [f.id, i]));
        const rank = r => r.sourceIds.reduce((m, id) => (pos.has(id) ? Math.min(m, pos.get(id)) : m), Infinity);
        return this.results.map((r, i) => ({ r, i, k: rank(r) })).sort((a, b) => (a.k - b.k) || (a.i - b.i)).map(x => x.r);
      }

      get hasData() { return this.files.length > 0 || this.results.length > 0 || this.jobs.length > 0; }

      /** Cancel every job, revoke every URL and drop every reference. The object is unusable afterwards. */
      wipe() {
        if (this.finished) return;
        this.finished = true;
        this.jobs.splice(0).forEach(j => { try { j.controller.abort(); } catch (err) { /* already stopped */ } });
        this._urls.forEach(u => { try { revokeURL(u); } catch (err) { /* already revoked */ } });
        this._urls.clear();
        this.files.forEach(f => { f.file = null; f.thumb = null; f.password = undefined; f.name = ''; });
        this.results.forEach(r => { r.blob = null; r.url = null; r.name = ''; });
        this.files = [];
        this.results = [];
        this.errors = [];
        this._names.clear();
        this.name = '';
      }
    }

    const session = {
      MAX_FILES,
      get applicants() { return applicants.slice(); },
      get active() { return applicants.find(a => a.id === activeId) || null; },
      get size() { return applicants.length; },
      get(id) { return applicants.find(a => a.id === id) || null; },

      add() {
        const a = new Applicant();
        applicants.push(a);
        activeId = a.id;
        emit('list', a);
        return a;
      },

      activate(id) {
        const a = session.get(id);
        if (!a || a.id === activeId) return a;
        activeId = a.id;
        emit('list', a);
        return a;
      },

      /** Wipe one applicant and remove it. Returns the applicant that becomes active, or null. */
      finish(id) {
        const i = applicants.findIndex(a => a.id === id);
        if (i < 0) return session.active;
        const [a] = applicants.splice(i, 1);
        a.wipe();
        if (activeId === id) {
          const nextOne = applicants[i] || applicants[i - 1] || null;
          activeId = nextOne ? nextOne.id : null;
        }
        emit('list', session.active);
        return session.active;
      },

      /** Wipe everyone and start numbering again. */
      end() {
        applicants.splice(0).forEach(a => a.wipe());
        activeId = null;
        number = 0;
        emit('list', null);
      },

      hasData() { return applicants.some(a => a.hasData); },

      on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    };
    return session;
  }

  return { createSession, zipName, uniqueName, MAX_FILES };
});
