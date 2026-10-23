/*! fx-governor 1.1.1 (API 1), steps the effects down when the screen cannot keep up and never back up behind the player (JS-modules, https://github.com/lfcfoundry/JS-modules). Copyright (c) 2026 LFC Foundry. MIT License. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FxGovernor = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var LINE_SHARE = 0.6;
  function num(v, def) { return typeof v === 'number' && isFinite(v) ? v : def; }
  function pos(v, def) { v = num(v, def); return v > 0 ? v : def; }
  function create(o) {
    o = o || {};
    var levels = o.levels && o.levels.length ? o.levels : ['full', 'lite', 'calm'], idx = Math.max(0, levels.indexOf(o.start || levels[0]));
    var windowMs = pos(o.windowMs, 3000), gapMs = pos(o.gapMs, 250), startAfterMs = Math.max(0, num(o.startAfterMs, 0));
    var strikes = Math.max(1, Math.floor(num(o.strikes, 2)));
    var longGaps = Math.max(1, Math.floor(num(o.longGaps, 3))), severe = num(o.severe, 0.5);
    var period = num(o.expectedPeriod, 0);
    var minFps = o.minFps != null && num(o.minFps, null) !== null ? o.minFps : (period > 0 ? LINE_SHARE * 1000 / period : 36);
    var maxAuto = Math.min(levels.length - 1, Math.max(0, num(o.maxAuto, levels.length - 2)));
    var frames = 0, t0 = 0, last = 0, slow = 0, chosen = false, raf = 0, running = false, armed = !o.waitForReady, warmFrom = 0, longRun = 0;
    function safe(fn, a, b) { try { fn(a, b); } catch (e) {} }
    function done() { return chosen || idx >= maxAuto; }
    function frame(t) {
      if (done()) return;
      var gap = last ? t - last : 0; last = t;
      longRun = gap > gapMs ? longRun + 1 : 0;
      if (!armed) return;
      if (startAfterMs > 0) {
        if (!warmFrom) warmFrom = t;
        if (t - warmFrom < startAfterMs) { t0 = 0; slow = 0; return; }
      }
      if ((typeof document !== 'undefined' && document.hidden) || (gap > gapMs && longRun < longGaps)) { t0 = 0; slow = 0; }
      if (!t0) { t0 = t; frames = 0; return; }
      frames++;
      if (t - t0 < windowMs) return;
      var fps = frames * 1000 / (t - t0);
      t0 = t; frames = 0;
      slow = fps < minFps ? slow + (fps < minFps * severe ? strikes : 1) : 0;
      if (o.onSample) safe(o.onSample, fps);
      if (slow >= strikes && idx < maxAuto) {
        idx++; slow = 0;
        if (o.onChange) safe(o.onChange, levels[idx], fps);
      }
    }
    function schedule() { if (!raf && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(loop); }
    function cancel() { if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf); raf = 0; }
    function loop(t) {
      raf = 0;
      if (!running) return;
      safe(frame, t);
      if (running && !done()) schedule();
    }
    return {
      frame: frame,
      start: function () { if (running) return; running = true; if (!done()) schedule(); },
      stop: function () { running = false; cancel(); },
      choose: function (level) { var i = levels.indexOf(level); if (i < 0) return; chosen = true; idx = i; cancel(); },
      release: function (level) { var i = levels.indexOf(level); if (i >= 0) idx = i; chosen = false; t0 = 0; slow = 0; last = 0; if (running && !done()) schedule(); },
      ready: function () { armed = true; warmFrom = 0; t0 = 0; slow = 0; last = 0; },
      get level() { return levels[idx]; },
      get minFps() { return minFps; },
      get resting() { return running && done(); }
    };
  }
  return { create: create };
});
