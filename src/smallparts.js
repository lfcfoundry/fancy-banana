/* back-close 1.2.0 (API 1), LEAN BUILD without: closeRoute, element, history, supported. Made by modules/back-close/lean.py; the cut parts are missing on purpose. MIT License, Copyright (c) 2026 LFC Foundry. https://github.com/lfcfoundry/JS-modules */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BackClose = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function hasCW(needObserver) { return typeof CloseWatcher === 'function' && (!needObserver || typeof MutationObserver === 'function'); }
  function watchWhen(isOpen, close, opts) { return make(null, close, opts, typeof isOpen === 'function' ? isOpen : null); }
  function make(el, close, opts, openFn) {
   var needMO = false;
    var known = typeof close === 'function' && (el ? true : !!openFn);
    var mode = !known ? 'none' : hasCW(needMO) ? 'closewatcher'
      : 'none';
    var handle = { supported: mode !== 'none', mode: mode, destroy: function () {}, close: function () { return false; }, sync: function () {} };
    function shown() {
      try {
        if (openFn) return !!openFn();
       return false;
      } catch (e) { return false; }
    }
    if (mode === 'none') {
      return handle;
    }
    var cw = null, destroyed = false;
    function run() {
      try { close(); } catch (e) {  }
      if (!destroyed && shown()) arm();
    }
    function arm() {
      if (destroyed || cw ||
        !shown()) return;
      if (mode === 'closewatcher') {
        try { cw = new CloseWatcher(); } catch (e) { cw = null; return; }
        cw.onclose = function () { cw = null; run(); };
      } else {
      }
    }
    function disarm() {
      if (cw) { try { cw.destroy(); } catch (e) {  } cw = null; }
    }
    function sync() { if (destroyed) return; if (shown()) arm(); else disarm(); }
    arm();
    handle.sync = sync;
    handle.destroy = function () {
      destroyed = true;
      disarm();
    };
    return handle;
  }
  var api = {
    watchWhen: watchWhen
  };
  return api;
});
/* wake-keeper 1.1.0 (API 1), LEAN BUILD without: callbacks, idle, inject, status. Made by modules/wake-keeper/lean.py; the cut parts are missing on purpose. MIT License, Copyright (c) 2026 LFC Foundry. https://github.com/lfcfoundry/JS-modules */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WakeKeeper = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function create(opts) {
    opts = opts || {};
   var nav = typeof navigator !== 'undefined' ? navigator : null;
   var doc = typeof document !== 'undefined' ? document : null;
   var now = function () { return Date.now(); };
    var backoffMs = opts.refusalBackoffMs >= 0 ? opts.refusalBackoffMs : 20000;
    var supported = !!(nav && nav.wakeLock && typeof nav.wakeLock.request === 'function');
    var wanted = false, sentinel = null, pending = false, gen = 0;
    var blockedUntil = 0, dead = false;
   var api = { supported: supported, want: want, destroy: destroy };
    function visible() { return !doc || doc.visibilityState !== 'hidden'; }
   function note() {}
    function release() {
      var s = sentinel; sentinel = null; gen++;
      if (s) { try { var r = s.release(); if (r && r.catch) r.catch(function () {}); } catch (e) {  } note(); }
    }
    function acquire() {
      if (dead || !supported || sentinel || pending || !wanted ||
        !visible() || now() < blockedUntil) return;
      pending = true; var my = ++gen;
      var p; try { p = nav.wakeLock.request('screen'); } catch (e) { p = Promise.reject(e); }
      Promise.resolve(p).then(function (s) {
        pending = false;
        if (dead || my !== gen || !wanted ||
          !visible()) {
          try { var r = s.release(); if (r && r.catch) r.catch(function () {}); } catch (e) {  }
          acquire();
          return;
        }
        sentinel = s;
        if (s.addEventListener) s.addEventListener('release', function () { if (sentinel === s) { sentinel = null; note(); } });
        note();
      }, function (err) {
        pending = false;
        if (dead) return;
        if (my !== gen) { acquire(); return; }
        blockedUntil = now() + backoffMs;
      });
    }
    function want(on) {
      if (dead) return;
      on = !!on; if (on === wanted) { if (on) acquire(); return; }
      wanted = on; blockedUntil = 0;
      if (on) {
        acquire();
      }
      else {
        release();
      }
    }
    function onVis() { if (dead || !doc) return; if (doc.visibilityState === 'hidden') release(); else { blockedUntil = 0; acquire(); } }
    if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', onVis);
    function destroy() {
      dead = true; wanted = false;
      release();
      if (doc && doc.removeEventListener) doc.removeEventListener('visibilitychange', onVis);
    }
    return api;
  }
  return { create: create, supported: typeof navigator !== 'undefined' && !!(navigator.wakeLock && navigator.wakeLock.request) };
});
/* even-dt 1.2.0 (API 1), LEAN BUILD without: options, refreshRule, stats. Made by modules/frame-kit/lean.py; the cut parts are missing on purpose. MIT License, Copyright (c) 2026 LFC Foundry. https://github.com/lfcfoundry/JS-modules */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EvenDt = factory();
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function EvenDt(opts) {
   this.minGap = 2; this.maxGap = 60; this.window = 40; this.warmup = 12; this.refreshEvery = 8; this.maxMultiple = 3; this.tolerance = 0.3; this.payback = 0.04;
    this._gaps = [];
    this._sorted = [];
    this._period = 0;
    this._drift = 0;
  }
  EvenDt.prototype.next = function (gapMs) {
    var ri = +gapMs;
    if (!(ri > this.minGap && ri < this.maxGap)) return ri > 0 && isFinite(ri) ? ri : 0;
    var g = this._gaps;
    g.push(ri);
    if (g.length > this.window) g.shift();
    if (g.length < this.warmup) return ri;
   if (!this._period || g.length % this.refreshEvery === 0) {
      var s = this._sorted;
      s.length = g.length;
      for (var i = 0; i < g.length; i++) s[i] = g[i];
      s.sort(function (a, b) { return a - b; });
      this._period = s[s.length >> 1];
    }
    var per = this._period;
    var n = Math.round(ri / per);
    var snap = n * per;
    if (n < 1 || n > this.maxMultiple || Math.abs(ri - snap) > per * this.tolerance) {
      this._drift = 0;
      return ri;
    }
    this._drift += ri - snap;
    var pay = this._drift * this.payback;
    this._drift -= pay;
    return snap + pay;
  };
  return EvenDt;
});
