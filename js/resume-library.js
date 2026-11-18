/* Resume library: saved-record and backup formats, without any interface.

   Records (IndexedDB store "resumes") and backup files follow docs/ARCHITECTURE.md section 3:
     record   { id, name, createdAt, updatedAt, schemaVersion, data }
     single   { app: 'ApplyReady', version: 2, exportedAt, data }            (earlier releases can import it)
     library  { app: 'ApplyReady', kind: 'resume-library', version: 1, exportedAt, resumes: [{ name, createdAt, updatedAt, data }] }
   Every resume read from storage or a file passes through ApplyReadySchema (validate, then migrate).
   Works in the browser (window.ApplyReadyResumeLibrary) and in Node (require) for the unit tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./resume-schema.js'));
  else root.ApplyReadyResumeLibrary = factory(root.ApplyReadySchema);
})(typeof self !== 'undefined' ? self : this, function (SCHEMA) {
  'use strict';
  const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
  const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
  const MAX_NAME = 120;
  const MAX_IMPORT_RESUMES = 200;
  const DEFAULT_NAME = 'Untitled resume';
  const LIBRARY_VERSION = 1;
  const record = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const time = x => (typeof x === 'number' && isFinite(x) && x > 0 ? Math.round(x) : 0);

  class ImportError extends Error {}

  function newId() {
    const rand = typeof crypto !== 'undefined' && crypto.getRandomValues
      ? Array.from(crypto.getRandomValues(new Uint8Array(9)), b => b.toString(36).padStart(2, '0')).join('')
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return ('r_' + rand).slice(0, 40);
  }

  // A name fit for the list: single spaces, no control characters, at most 120 characters.
  function cleanName(name) {
    if (typeof name !== 'string') return '';
    return name.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  }

  // "Riya Sharma, Operations Analyst" from the resume, or the default name when it is still empty.
  function suggestName(data) {
    const p = record(data) && record(data.personal) ? data.personal : {};
    return cleanName([p.fullName, p.targetTitle].map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean).join(', ')) || DEFAULT_NAME;
  }

  function createRecord(data, options) {
    const o = options || {};
    const now = time(o.now) || Date.now();
    const migrated = SCHEMA.migrate(data);
    return {
      id: o.id && ID_PATTERN.test(o.id) ? o.id : newId(),
      name: cleanName(o.name) || suggestName(migrated),
      createdAt: time(o.createdAt) || now,
      updatedAt: time(o.updatedAt) || now,
      schemaVersion: SCHEMA.CURRENT_VERSION,
      data: migrated
    };
  }

  /* Check a stored record before it reaches the interface. A usable record comes back migrated;
     anything else comes back as damaged, with a safe label, so the list can offer Export raw and
     Delete instead of failing. */
  function inspect(raw) {
    const ok = record(raw) && typeof raw.id === 'string' && ID_PATTERN.test(raw.id) && record(raw.data) && SCHEMA.validate({ data: raw.data });
    const name = record(raw) ? cleanName(raw.name) : '';
    if (!ok) {
      let reason = 'The saved data is not a resume this version can read.';
      if (!record(raw)) reason = 'The saved entry is empty or unreadable.';
      else if (!(typeof raw.id === 'string' && ID_PATTERN.test(raw.id))) reason = 'The saved entry has an invalid identifier.';
      else if (!record(raw.data)) reason = 'The saved entry has no resume data.';
      return { ok: false, name: name || 'Unnamed resume', reason, updatedAt: record(raw) ? time(raw.updatedAt) : 0, raw };
    }
    const data = SCHEMA.migrate(raw.data);
    return {
      ok: true,
      record: { id: raw.id, name: name || suggestName(data), createdAt: time(raw.createdAt) || time(raw.updatedAt), updatedAt: time(raw.updatedAt) || time(raw.createdAt), schemaVersion: SCHEMA.CURRENT_VERSION, data }
    };
  }

  const byRecent = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);

  // Split what IndexedDB returned into usable records (newest first) and damaged ones.
  function sortOut(rawList) {
    const records = [], damaged = [];
    (Array.isArray(rawList) ? rawList : []).forEach(raw => {
      const result = inspect(raw);
      if (result.ok) records.push(result.record); else damaged.push(result);
    });
    records.sort(byRecent);
    damaged.sort(byRecent);
    return { records, damaged };
  }

  // One resume, in the version 2 envelope that earlier releases import as well.
  function singleBackup(rec, now) {
    return {
      app: 'ApplyReady',
      version: 2,
      exportedAt: new Date(time(now) || Date.now()).toISOString(),
      name: cleanName(rec.name) || suggestName(rec.data),
      createdAt: time(rec.createdAt),
      updatedAt: time(rec.updatedAt),
      data: SCHEMA.toLegacyCompatible(rec.data)
    };
  }

  function libraryBackup(records, now) {
    return {
      app: 'ApplyReady',
      kind: 'resume-library',
      version: LIBRARY_VERSION,
      exportedAt: new Date(time(now) || Date.now()).toISOString(),
      resumes: (records || []).map(rec => ({ name: cleanName(rec.name) || suggestName(rec.data), createdAt: time(rec.createdAt), updatedAt: time(rec.updatedAt), data: SCHEMA.migrate(rec.data) }))
    };
  }

  const NEWER = 'This backup was made by a newer version of ApplyReady. Reload the page to get the latest version, then import it again.';
  const NOT_RESUME = 'This file is not an ApplyReady resume backup, or it is damaged. Your saved resumes are unchanged.';

  /* Read a backup file's text. Returns { kind, resumes: [{ name, createdAt, updatedAt, data }], skipped }
     with migrated data, or throws ImportError with a message that can be shown as it is. Accepts the
     library format, the single-resume format of versions 1 to 3, and the old browser draft. */
  function parseBackup(textValue, size) {
    const bytes = typeof size === 'number' ? size : (typeof textValue === 'string' ? textValue.length : 0);
    if (bytes > MAX_IMPORT_BYTES) throw new ImportError('This file is larger than 5 MB, which is far more than any resume backup. Choose the .json file that ApplyReady saved.');
    if (!bytes || typeof textValue !== 'string' || !textValue.trim()) throw new ImportError('This file is empty. Choose the .json backup file that ApplyReady saved.');
    let payload;
    try { payload = JSON.parse(textValue.replace(/^﻿/, '')); } catch (e) {
      throw new ImportError('This file is not valid JSON, so it cannot be a resume backup. It may be damaged or a different kind of file.');
    }
    if (!record(payload)) throw new ImportError(NOT_RESUME);
    if (payload.app !== undefined && payload.app !== 'ApplyReady') throw new ImportError('This file was made by a different app, not ApplyReady, so it cannot be imported here.');
    if (payload.kind === 'resume-library') {
      if (typeof payload.version !== 'number' || payload.version > LIBRARY_VERSION) throw new ImportError(payload.version > LIBRARY_VERSION ? NEWER : NOT_RESUME);
      if (!Array.isArray(payload.resumes)) throw new ImportError(NOT_RESUME);
      const resumes = [];
      let skipped = 0;
      payload.resumes.slice(0, MAX_IMPORT_RESUMES).forEach(item => {
        if (record(item) && record(item.data) && SCHEMA.validate({ data: item.data })) {
          const data = SCHEMA.migrate(item.data);
          resumes.push({ name: cleanName(item.name) || suggestName(data), createdAt: time(item.createdAt), updatedAt: time(item.updatedAt), data });
        } else skipped++;
      });
      skipped += Math.max(0, payload.resumes.length - MAX_IMPORT_RESUMES);
      if (!resumes.length) throw new ImportError(payload.resumes.length ? 'None of the resumes in this file could be read. The file may be damaged.' : 'This backup contains no resumes.');
      return { kind: 'library', resumes, skipped };
    }
    if (payload.kind !== undefined) throw new ImportError(NOT_RESUME);
    if (typeof payload.version === 'number' && payload.version > SCHEMA.CURRENT_VERSION) throw new ImportError(NEWER);
    const inner = record(payload.data) ? payload.data : null;
    if (inner && typeof inner.schemaVersion === 'number' && inner.schemaVersion > SCHEMA.CURRENT_VERSION) throw new ImportError(NEWER);
    if (!SCHEMA.validate(payload)) throw new ImportError(NOT_RESUME);
    const data = SCHEMA.migrate(payload);
    return { kind: 'single', resumes: [{ name: cleanName(payload.name) || suggestName(data), createdAt: time(payload.createdAt), updatedAt: time(payload.updatedAt), data }], skipped: 0 };
  }

  // The resume saved in this browser by releases before the library (localStorage), if any.
  // Returns { data } for a readable draft, { raw } for one that cannot be read, or null.
  function readLegacyDraft(text) {
    if (typeof text !== 'string' || !text) return null;
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { return { raw: text }; }
    if (record(parsed) && SCHEMA.validate(parsed)) return { data: SCHEMA.migrate(parsed), savedAt: Date.parse(parsed.savedAt) || 0 };
    return { raw: parsed };
  }

  // "just now", "4 min ago", "2 hours ago", "yesterday", "3 days ago", or a date.
  function relativeTime(ts, now) {
    const t = time(ts);
    if (!t) return 'unknown';
    const diff = Math.max(0, (time(now) || Date.now()) - t) / 1000;
    if (diff < 45) return 'just now';
    if (diff < 90) return '1 min ago';
    if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
    if (diff < 5400) return '1 hour ago';
    if (diff < 86400) return `${Math.round(diff / 3600)} hours ago`;
    if (diff < 172800) return 'yesterday';
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    return 'on ' + new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function absoluteTime(ts) {
    const t = time(ts);
    return t ? new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  }

  // A file name such as "Riya_Sharma_resume_backup.json" (letters of any script are kept).
  function fileName(base, suffix) {
    const clean = String(base || '').normalize('NFC').replace(/[^\p{L}\p{M}\p{N}_-]+/gu, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
    return `${clean || 'ApplyReady'}_${suffix}`;
  }

  return {
    ID_PATTERN, MAX_IMPORT_BYTES, MAX_NAME, DEFAULT_NAME, LIBRARY_VERSION, ImportError,
    newId, cleanName, suggestName, createRecord, inspect, sortOut, singleBackup, libraryBackup, parseBackup,
    readLegacyDraft, relativeTime, absoluteTime, fileName
  };
});
