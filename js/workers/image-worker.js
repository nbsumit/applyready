/* ApplyReady image worker: runs js/lib/image-ops.js off the main thread so the page stays
   responsive while a batch is processed. Receives { id, blob, options }, replies with
   { id, ok, result } or { id, ok: false, error }. Files never leave the browser. */
'use strict';
importScripts('../lib/image-ops.js');

self.onmessage = async (event) => {
  const { id, blob, options } = event.data || {};
  try {
    const result = await self.ApplyReadyImageOps.process(blob, options);
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: (err && err.message) || 'This image could not be processed.' });
  }
};
