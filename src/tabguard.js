/*! tab-guard 1.1.0 (API 1, JS-modules, https://github.com/lfcfoundry/JS-modules). Copyright (c) 2026 LFC Foundry. MIT License. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TabGuard = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function start(o) {
    o = o || {};
    var name = o.name || 'tab-guard', retryMs = o.retryMs == null ? 700 : o.retryMs, returnMs = o.returnMs == null ? 1000 : o.returnMs;
    var nav = typeof navigator !== 'undefined' ? navigator : null;
    var guard = { supported: false, holding: false, twin: false, free: false, reason: '', takeOver: function () {}, stop: function () {} };
    if (!nav || !nav.locks || !nav.locks.request) {
      guard.reason = typeof isSecureContext !== 'undefined' && !isSecureContext ? 'insecure-context' : 'no-web-locks';
      return guard;
    }
    guard.supported = true;
    var stopped = false, taking = false, cur = null, waiter = null, timer = null, away = false, awayTimer = null, win = typeof window !== 'undefined' && window.addEventListener ? window : null;

    function say(fn, arg) { if (typeof fn === 'function') { try { fn(arg); } catch (e) { /* the page's own callback failed; keep the guard working */ } } }

    // The guard cannot work here (not a steal): switch it off and tell the page, which should keep saving.
    function unavailable(e) {
      taking = false;
      if (!guard.supported) return;
      guard.supported = false; guard.holding = false; guard.reason = (e && e.name) || 'error';
      drop(cur); drop(waiter); cur = waiter = null;
      if (timer) { clearTimeout(timer); timer = null; }
      if (awayTimer) { clearTimeout(awayTimer); awayTimer = null; }
      unlisten();
      say(o.onUnavailable, e);
    }

    // Gives up a request: releases the lock if it is held, or cancels it while it is still waiting.
    function drop(r) {
      if (!r) return;
      r.aborted = true;
      if (r.held) { r.released = true; if (r.release) r.release(); }
      else if (r.ac) { try { r.ac.abort(); } catch (e) {} }
    }

    // Another copy took the lock from us (or never gave it): this copy is the twin. Then wait quietly for it to be free.
    function lost() {
      cur = null; guard.holding = false; guard.free = false;
      var first = !guard.twin;
      guard.twin = true;
      if (first) say(o.onTwin);
      wait();
    }

    // One request to the lock manager. onGrant(r) runs when the lock is ours (held until stop() or the page ends);
    // onRefuse() runs when { ifAvailable: true } finds it taken. A rejection that is an AbortError after we held the lock means
    // it was stolen; any other rejection means the guard cannot work (unless `quiet`).
    function ask(opts, onGrant, onRefuse, quiet) {
      var r = { held: false, released: false, aborted: false, release: null, ac: null }, p, queued = !!opts.queue;
      try {
        if (queued && typeof AbortController === 'function') { r.ac = new AbortController(); opts = { signal: r.ac.signal }; }
        else if (queued) opts = {};
        p = nav.locks.request(name, opts, function (lock) {
          if (!lock) { if (onRefuse && !stopped) onRefuse(); return; }
          if (stopped || r.aborted) return;   // too late: returning at once frees the lock again
          if (queued) { onGrant(r); return; }   // a waiting request only learns the lock is free: it hands the lock straight back
          return new Promise(function (resolve) { r.release = resolve; r.held = true; onGrant(r); });
        });
      } catch (e) { if (!quiet) unavailable(e); return r; }
      p.then(function () {
        if (r.held && !r.released && !r.aborted && !stopped && cur === r) lost();   // ended without our release: treat as taken
      }, function (e) {
        if (stopped || r.aborted) return;
        if (!r.held && !queued) taking = false;
        if (e && e.name === 'AbortError') { if (r.held && cur === r) lost(); }
        else if (!quiet) unavailable(e);
      });
      return r;
    }

    function wait() {
      if (stopped || waiter || !guard.supported) return;
      waiter = ask({ queue: true }, function () {
        waiter = null; guard.free = true;
        say(o.onFree);
      }, null, true);
    }

    function begin(again) {
      cur = ask({ ifAvailable: true }, function (r) { cur = r; guard.holding = true; guard.twin = false; guard.free = false; say(o.onClaimed); }, function () {
        cur = null;
        if (again && !stopped) timer = setTimeout(function () { timer = null; begin(false); }, retryMs);
        else if (!stopped) lost();
      });
    }

    guard.takeOver = function () {
      if (stopped || !guard.supported || guard.holding || taking) return;   // stealing our own lock would knock this copy out
      taking = true;
      ask({ steal: true }, function (r) {
        taking = false; drop(waiter); waiter = null; cur = r;
        guard.holding = true; guard.twin = false; guard.free = false; say(o.onTakeOver);
      });
    };
    // Back/forward cache option: let go of everything just before the page leaves, take it all back when it returns.
    function leaving() {
      if (stopped || away || !guard.supported) return;
      away = true;
      if (timer) { clearTimeout(timer); timer = null; }
      drop(cur); drop(waiter); cur = waiter = null; taking = false; guard.holding = false;
      if (awayTimer) clearTimeout(awayTimer);
      awayTimer = setTimeout(function () { awayTimer = null; back(); }, returnMs);   // the page is still here: the leaving did not happen
    }
    function back() {
      if (!away || stopped || !guard.supported) return;
      away = false;
      if (awayTimer) { clearTimeout(awayTimer); awayTimer = null; }
      begin(false);   // claims the lock if it is free; if another copy took it in the meantime this copy is the twin (onTwin only the first time)
    }
    function onShow(e) { if (e && e.persisted) back(); }
    function unlisten() { if (win) { win.removeEventListener('beforeunload', leaving); win.removeEventListener('pageshow', onShow); } }
    guard.stop = function () {
      stopped = true; guard.holding = false; unlisten();
      if (awayTimer) { clearTimeout(awayTimer); awayTimer = null; }
      if (timer) { clearTimeout(timer); timer = null; }
      drop(cur); drop(waiter); cur = waiter = null;
    };
    if (o.backForwardCache && win) { win.addEventListener('beforeunload', leaving); win.addEventListener('pageshow', onShow); }
    begin(true);
    return guard;
  }

  return { start: start, supported: typeof navigator !== 'undefined' && !!(navigator.locks && navigator.locks.request) };
});
