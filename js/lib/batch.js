/* ApplyReady batch queue.
   Runs one job per file with a small concurrency limit, so a batch of 200 photos never decodes
   200 images at once. Each item reports its own status; the whole batch can be cancelled, and
   failed or cancelled items can be retried. The queue does not know what a job does: tools pass
   a `process(item, { signal, progress })` function that returns a result object.

   Item: { id, file, name, size, status, progress, error, result, attempts }
   status: 'queued' | 'processing' | 'done' | 'error' | 'cancelled'

   Results usually hold a Blob. Call queue.remove(id) or queue.clear() to release them; the
   queue calls `release(result)` (if given) so tools can revoke object URLs. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ApplyReadyBatch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let seq = 0;

  function createQueue(options) {
    const opts = Object.assign({ concurrency: 2, maxItems: 500 }, options || {});
    if (typeof opts.process !== 'function') throw new TypeError('createQueue needs a process function');
    const items = [];
    const listeners = new Set();
    const controllers = new Map();
    let running = 0;
    let active = false;
    let notifyPending = false;

    function snapshot() {
      const counts = { total: items.length, queued: 0, processing: 0, done: 0, error: 0, cancelled: 0 };
      items.forEach(item => { counts[item.status]++; });
      const finished = counts.done + counts.error + counts.cancelled;
      const partial = items.reduce((sum, item) => sum + (item.status === 'processing' ? (item.progress || 0) : 0), 0);
      counts.progress = items.length ? (finished + partial) / items.length : 0;
      counts.running = active;
      return counts;
    }

    // Coalesce change events: a 300-file batch should not repaint the list 300 times per tick.
    function emit(item) {
      if (item) listeners.forEach(fn => { try { fn({ type: 'item', item, summary: snapshot() }); } catch (e) { /* listener errors must not stop the queue */ } });
      if (notifyPending) return;
      notifyPending = true;
      Promise.resolve().then(() => {
        notifyPending = false;
        const summary = snapshot();
        listeners.forEach(fn => { try { fn({ type: 'change', summary }); } catch (e) { /* ignore */ } });
      });
    }

    function add(files) {
      const list = Array.from(files || []);
      const room = Math.max(0, opts.maxItems - items.length);
      const accepted = list.slice(0, room).map(file => ({
        id: `b${++seq}`, file, name: file.name || 'file', size: file.size || 0,
        status: 'queued', progress: 0, error: '', result: null, attempts: 0, meta: {}
      }));
      items.push(...accepted);
      emit();
      if (active) pump();
      return { added: accepted, skipped: list.length - accepted.length };
    }

    function release(item) {
      if (item.result && typeof opts.release === 'function') { try { opts.release(item.result, item); } catch (e) { /* ignore */ } }
      item.result = null;
    }

    async function runItem(item) {
      const controller = new AbortController();
      controllers.set(item.id, controller);
      item.status = 'processing';
      item.progress = 0;
      item.error = '';
      item.attempts++;
      emit(item);
      try {
        const result = await opts.process(item, {
          signal: controller.signal,
          progress: fraction => { item.progress = Math.max(0, Math.min(1, fraction)); emit(item); }
        });
        if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        release(item);
        item.result = result;
        item.status = 'done';
        item.progress = 1;
      } catch (err) {
        if (controller.signal.aborted || (err && err.name === 'AbortError')) {
          item.status = 'cancelled';
          item.error = 'Cancelled';
        } else {
          item.status = 'error';
          item.error = (err && err.message) || 'This file could not be processed.';
        }
        item.progress = 0;
      } finally {
        controllers.delete(item.id);
        emit(item);
      }
    }

    function pump() {
      if (!active) return;
      while (running < opts.concurrency) {
        const next = items.find(item => item.status === 'queued');
        if (!next) break;
        running++;
        runItem(next).finally(() => { running--; pump(); });
      }
      if (running === 0 && !items.some(item => item.status === 'queued')) {
        active = false;
        emit();
        listeners.forEach(fn => { try { fn({ type: 'idle', summary: snapshot() }); } catch (e) { /* ignore */ } });
      }
    }

    /** Process every queued item. Resolves when the queue is idle. */
    function start() {
      return new Promise(resolve => {
        const onIdle = event => { if (event.type === 'idle') { listeners.delete(onIdle); resolve(snapshot()); } };
        listeners.add(onIdle);
        active = true;
        emit();
        pump();
      });
    }

    /** Stop: running jobs are aborted, queued jobs become "cancelled". Finished results stay. */
    function cancel() {
      items.forEach(item => { if (item.status === 'queued') { item.status = 'cancelled'; item.error = 'Cancelled'; } });
      controllers.forEach(controller => controller.abort());
      emit();
      if (running === 0) pump();
    }

    /** Put failed and cancelled items (or one item) back in the queue. Does not start it. */
    function retry(id) {
      items.forEach(item => {
        if ((id ? item.id === id : true) && (item.status === 'error' || item.status === 'cancelled')) {
          item.status = 'queued'; item.error = ''; item.progress = 0;
        }
      });
      emit();
      if (active) pump();
    }

    /** Mark finished items queued again, e.g. after the output settings change. */
    function requeueAll() {
      items.forEach(item => { if (item.status !== 'processing') { release(item); item.status = 'queued'; item.error = ''; item.progress = 0; } });
      emit();
    }

    function remove(id) {
      const index = items.findIndex(item => item.id === id);
      if (index < 0) return;
      const [item] = items.splice(index, 1);
      const controller = controllers.get(id);
      if (controller) controller.abort();
      release(item);
      emit();
    }

    function clear() {
      controllers.forEach(controller => controller.abort());
      items.splice(0).forEach(release);
      emit();
    }

    function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    return {
      add, start, cancel, retry, requeueAll, remove, clear, on,
      get items() { return items.slice(); },
      get running() { return active; },
      summary: snapshot
    };
  }

  return { createQueue };
});
