/* ApplyReady image worker pool.
   Runs image jobs in Web Workers when the browser supports OffscreenCanvas in workers, and on
   the main thread otherwise (older Safari). Cancelling a job terminates its worker, because an
   image encode cannot be interrupted, and a fresh worker replaces it.

   const pool = ApplyReadyImagePool.create({ size: 2 });
   const result = await pool.run(blob, options, signal);   // same result as ImageOps.process
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

  function create(options) {
    const hc = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2;
    const size = Math.max(1, Math.min((options && options.size) || Math.min(4, Math.max(1, Math.floor(hc / 2))), 4));
    const useWorkers = workerSupported() && !(options && options.mainThread);
    const workers = [];
    const waiting = [];
    let seq = 0;
    let destroyed = false;

    function spawn() {
      const w = new Worker(BASE + 'workers/image-worker.js');
      const slot = { worker: w, busy: false, job: null };
      w.onmessage = (e) => {
        const job = slot.job;
        if (!job || e.data.id !== job.id) return;
        finish(slot);
        if (e.data.ok) job.resolve(e.data.result); else job.reject(new Error(e.data.error));
      };
      w.onerror = (e) => {
        const job = slot.job;
        e.preventDefault();
        replace(slot);
        if (job) job.reject(new Error('The image worker stopped unexpectedly. The file may be too large for this device.'));
      };
      return slot;
    }

    function finish(slot) {
      if (slot.job && slot.job.cleanup) slot.job.cleanup();
      slot.busy = false; slot.job = null;
      next();
    }

    function replace(slot) {
      try { slot.worker.terminate(); } catch (e) { /* ignore */ }
      const index = workers.indexOf(slot);
      if (slot.job && slot.job.cleanup) slot.job.cleanup();
      if (index >= 0) workers[index] = spawn();
      next();
    }

    function next() {
      if (destroyed) return;
      while (waiting.length) {
        let slot = workers.find(s => !s.busy);
        if (!slot && workers.length < size) { slot = spawn(); workers.push(slot); }
        if (!slot) return;
        const job = waiting.shift();
        if (job.signal && job.signal.aborted) { job.reject(new DOMException('Cancelled', 'AbortError')); continue; }
        slot.busy = true; slot.job = job;
        if (job.signal) {
          const onAbort = () => { if (slot.job === job) { replace(slot); job.reject(new DOMException('Cancelled', 'AbortError')); } };
          job.signal.addEventListener('abort', onAbort, { once: true });
          job.cleanup = () => job.signal.removeEventListener('abort', onAbort);
        }
        slot.worker.postMessage({ id: job.id, blob: job.blob, options: job.options });
      }
    }

    function run(blob, opts, signal) {
      if (destroyed) return Promise.reject(new Error('The image pool was closed.'));
      if (!useWorkers) {
        if (signal && signal.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
        return root.ApplyReadyImageOps.process(blob, opts, signal);
      }
      return new Promise((resolve, reject) => {
        waiting.push({ id: ++seq, blob, options: opts, signal, resolve, reject });
        next();
      });
    }

    function destroy() {
      destroyed = true;
      workers.splice(0).forEach(s => { try { s.worker.terminate(); } catch (e) { /* ignore */ } });
      waiting.splice(0).forEach(job => job.reject(new DOMException('Cancelled', 'AbortError')));
    }

    return { run, destroy, get usesWorkers() { return useWorkers; }, size };
  }

  root.ApplyReadyImagePool = { create, workerSupported };
})(typeof self !== 'undefined' ? self : this);
