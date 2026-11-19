/* ApplyReady image worker: runs js/lib/image-ops.js off the main thread so the page stays
   responsive while a batch is processed. Receives { id, blob, options }, replies with
   { id, type: 'progress', value } while working, then { id, ok, result } or { id, ok: false, error, code, detail }.
   Posts { type: 'ready' } once it has loaded, so the pool can tell a worker that never started
   from one that failed on a file. Files never leave the browser. */
'use strict';
// Started from a blob: script (js/lib/image-pool.js), image-ops.js is already loaded by then.
if (!self.ApplyReadyImageOps) importScripts('../lib/image-ops.js');

self.onmessage = async (event) => {
  const { id, blob, options } = event.data || {};
  let last = 0;
  const onProgress = value => {
    // At most one message per 5% step: progress is for people, not a stream.
    if (value - last < 0.05 && value < 1) return;
    last = value;
    self.postMessage({ id, type: 'progress', value });
  };
  try {
    const result = await self.ApplyReadyImageOps.process(blob, options, null, onProgress);
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: (err && err.message) || 'This image could not be processed.', code: (err && err.code) || '', detail: (err && err.detail) || null });
  }
};

self.postMessage({ type: 'ready' });
