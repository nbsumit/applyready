/* ApplyReady image worker pool.
   Runs image jobs in Web Workers when the browser supports OffscreenCanvas in workers, and on
   the main thread otherwise (older Safari). Cancelling a job terminates its worker, because an
   image encode cannot be interrupted, and a fresh worker replaces it. If the worker script cannot
   start at all (for example an old cached copy offline), the pool falls back to the main thread
   instead of failing every file.

   const pool = ApplyReadyImagePool.create({ size: 2 });
   const result = await pool.run(blob, options, signal, onProgress);   // same result as ImageOps.process
   pool.destroy();
*/
(function (root) {
  'use strict';

  function workerSupported() {
    return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' &&
      typeof OffscreenCanvas.prototype.convertToBlob === 'function' && typeof createImageBitmap === 'function';
  }

  function scriptBase() {
    const current = document.currentScript || Array.from(document.scripts).find(s => /image-pool\.js/.test(s.src));
    return current ? current.src.replace(/lib\/image-pool\.js.*$/, '') : '/js/';
  }
  const BASE = typeof document !== 'undefined' ? scriptBase() : '/js/';
  const cancelled = () => new DOMException('Cancelled', 'AbortError');

  function create(options) {
    const hc = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2;
    const size = Math.max(1, Math.min((options && options.size) || Math.min(4, Math.max(1, Math.floor(hc / 2))), 4));
    let useWorkers = workerSupported() && !(options && options.mainThread);
    const workers = [];
    const waiting = [];
    let seq = 0;
    let destroyed = false;

    function runOnMainThread(job) {
      if (job.signal && job.signal.aborted) { job.reject(cancelled()); return; }
      if (!root.ApplyReadyImageOps) { job.reject(new Error('The image tools did not load. Reload the page and try again.')); return; }
      root.ApplyReadyImageOps.process(job.blob, job.options, job.signal, job.onProgress).then(job.resolve, job.reject);
    }

    function spawn() {
      const w = new Worker(BASE + 'workers/image-worker.js');
      const slot = { worker: w, busy: false, job: null, alive: false };
      w.onmessage = (e) => {
        const data = e.data || {};
        if (data.type === 'ready') { slot.alive = true; return; }
        slot.alive = true;
        const job = slot.job;
        if (!job || data.id !== job.id) return;
        if (data.type === 'progress') { if (job.onProgress) { try { job.onProgress(data.value); } catch (err) { /* ignore */ } } return; }
        finish(slot);
        if (data.ok) job.resolve(data.result); else job.reject(new Error(data.error));
      };
      w.onerror = (e) => {
        const job = slot.job;
        if (e && e.preventDefault) e.preventDefault();
        const neverStarted = !slot.alive;
        replace(slot, neverStarted);
        if (neverStarted) {
          // The worker script could not load: keep going on the main thread.
          useWorkers = false;
          workers.splice(0).forEach(s => { try { s.worker.terminate(); } catch (err) { /* ignore */ } });
          if (job) runOnMainThread(job);
          waiting.splice(0).forEach(runOnMainThread);
          return;
        }
        if (job) job.reject(new Error('The image worker stopped unexpectedly. The file may be too large for this device.'));
      };
      return slot;
    }

    function finish(slot) {
      if (slot.job && slot.job.cleanup) slot.job.cleanup();
      slot.busy = false; slot.job = null;
      next();
    }

    function replace(slot, dropOnly) {
      try { slot.worker.terminate(); } catch (e) { /* ignore */ }
      if (slot.job && slot.job.cleanup) slot.job.cleanup();
      slot.job = null; slot.busy = false;
      const index = workers.indexOf(slot);
      if (index >= 0) {
        if (dropOnly) workers.splice(index, 1);
        else workers[index] = spawn();
      }
      if (!dropOnly) next();
    }

    function next() {
      if (destroyed || !useWorkers) return;
      while (waiting.length) {
        let slot = workers.find(s => !s.busy);
        if (!slot && workers.length < size) { slot = spawn(); workers.push(slot); }
        if (!slot) return;
        const job = waiting.shift();
        if (job.signal && job.signal.aborted) { job.reject(cancelled()); continue; }
        slot.busy = true; slot.job = job;
        if (job.signal) {
          const onAbort = () => { if (slot.job === job) { replace(slot); job.reject(cancelled()); } };
          job.signal.addEventListener('abort', onAbort, { once: true });
          job.cleanup = () => job.signal.removeEventListener('abort', onAbort);
        }
        slot.worker.postMessage({ id: job.id, blob: job.blob, options: job.options });
      }
    }

    function run(blob, opts, signal, onProgress) {
      if (destroyed) return Promise.reject(new Error('The image pool was closed.'));
      return new Promise((resolve, reject) => {
        const job = { id: ++seq, blob, options: opts, signal, onProgress, resolve, reject };
        if (!useWorkers) { runOnMainThread(job); return; }
        if (signal && signal.aborted) { reject(cancelled()); return; }
        waiting.push(job);
        next();
      });
    }

    function destroy() {
      destroyed = true;
      workers.splice(0).forEach(s => { try { s.worker.terminate(); } catch (e) { /* ignore */ } if (s.job) s.job.reject(cancelled()); });
      waiting.splice(0).forEach(job => job.reject(cancelled()));
    }

    return { run, destroy, get usesWorkers() { return useWorkers; }, size };
  }

  root.ApplyReadyImagePool = { create, workerSupported };
})(typeof self !== 'undefined' ? self : this);
