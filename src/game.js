(function () {
'use strict';
/*TEST_HOOK_START*/ try { performance.mark('bf-script'); } catch (e) { } /*TEST_HOOK_END*/
var PHASE = 'beta';
var STAMP = '__STAMP__';   // set by build.py: date plus Eastern time, YYYY.MM.DD.HHMM
var NAME = 'Fancy, the Banana';
var COPYRIGHT = 'Copyright \u00a9 2026 LFC Foundry';
var FORGED = 'Forged by LFC Foundry \u2022 MIT Licensed';
try { console.log('\u2699\uFE0F LFC Module initialized fully offline.'); } catch (e) { }

/* ===== Tunable numbers: every number you might want to tweak lives here ===== */
var CFG = {
  W: 360, H: 640, groundH: 72,          // logical play area (scaled to fit the screen)
  gravity: 1500, flapV: -430, maxFall: 620,
  speed0: 140, speedStep: 7, speedMax: 210,   // pixels per second, grows each stage
  contCost: 100, gap0: 178, gapStep: 3, gapMin: 150,          // opening size between obstacles
  spacing: 215, obW: 58, maxShift: 150, minObH: 95,
  gatesPerStage: 10, longAfter: 5, gatesLong: 15, plusStep: 0.1, plusMax: 10, waferWins: 2, empClears: 2,   // speed-up per kept victory and its cap; wafers fly from the third playthrough on
  bananaX: 100, bananaR: 12,
  cardSecs: 2.1, breathSecs: 4.4,         // stage card time; seconds of empty flying after the last gate of a stage (long enough for the card and Ready, Set, Go)
  rsgBeat: 0.5, rsgY: 290, celSecs: 0.75,   // celSecs: the one celebration roll after a stage clear
                // Ready, Set, Go: seconds per word; the height Fancy floats at while he waits
  graceSecs: 0.35, retryDelay: 0.6,
  countSecs: 1.2, launchSecs: 2.3, launchY: 365, launchVy: -380, boostV: 520, boostSecs: 3.5, firstGate: 1375, punchSecs: 0.4, spinSecs: 1.0, spinRolls: 3, pumpMs: 2.5, bounceVy: 520,   // the loop-de-loop launch at the start of every run
  topFreeSecs: 0.8, topPull: 420,        // Fancy may fly off the top this long, then is pulled back down
  easyStages: 2, easyGap: 12, easySpeed: 9,   // the first two stages are gentler: wider gaps and slower by this much, fading out by stage 3
  friendsPerStage: 5, bowStage: 3,       // friends freed per stage cleared; stage that unlocks the bow tie
  miniAfter: 3, balAfter: 2, bal2After: 4, finalTheme: 5, winBonus: 10,   // the water mini game follows the stage with this look (Silverware Drawer); the jungle is the finale, clearing it gives a bonus
  magnetR: 80, magnetV: 520, stageCoins: 5,   // coin magnet reach and pull speed; coins paid for clearing a stage
  coinR: 14, perfectFrac: 0.15, closeCall: 7, streakEvery: 3, streakBonus: 3,   // coins: pick-up radius; a perfect gate is within this share of the gap's middle; a close call skims within this many px; every Nth perfect in a row pays a bonus
  hugSecs: 0.8, hugExtra: 1.8, goldStreak: 8, vaultN: 24, goldN: 30, drawerN: 20, wafCap: 5,   // secrets: seconds to hug the top or floor, extra quiet seconds after a stage on repeat runs, the perfect streak that makes a gold gate, coins in each bonus room, the most a wafer clear can pay
  artScaleMax: 2.4, gritFall: 96,
  step: 1 / 120,                         // fixed physics step (seconds)
  backupEverySecs: 60, errorsKept: 5
};
var FONT = '"Arial Rounded MT Bold","Trebuchet MS",system-ui,"Segoe UI",Roboto,sans-serif';
var INK = '#3a2a4d';
var W = CFG.W, H = CFG.H, GROUND_Y = CFG.H - CFG.groundH;


/* ===== Small helpers ===== */
function $(id) { return document.getElementById(id); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
var rng = mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0);

var errors = [];
function logError(where, err) {
  errors.push(where + ': ' + ((err && err.message) || err));
  if (errors.length > CFG.errorsKept) errors.shift();
}
addEventListener('error', function (e) { logError('window', e.error || e.message); });
addEventListener('unhandledrejection', function (e) { logError('promise', e.reason); });

/* ===== Storage (every read and write is guarded: storage can be missing or full) ===== */
var K = { main: 'bf1', bak: 'bf1-bak', damaged: 'bf1-damaged', before: 'bf1-before-load' };
function sget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function sset(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
var storageOK = (function () { try { localStorage.setItem('bf1-t', '1'); localStorage.removeItem('bf1-t'); return true; } catch (e) { return false; } })();

function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
function num(v, def, max) { v = Number(v); return (isFinite(v) && v >= 0) ? Math.min(Math.floor(v), max) : def; }
function boostObj(o) { var r = {}; if (isObj(o)) Object.keys(o).slice(0, 20).forEach(function (k) { r[k] = num(o[k], 0, 1e6); }); return r; }
function flatObj(o) { var r = {}; if (isObj(o)) Object.keys(o).slice(0, 50).forEach(function (k) { var v = o[k]; if (typeof v === 'boolean' || (typeof v === 'number' && isFinite(v))) r[k] = v; }); return r; }
function defaultSave() { return { game: 'bananafly', v: 1, best: 0, bestR: 0, bestS: {}, cont: {}, bestStage: 1, opts: {}, stats: { runs: 0, gates: 0, flaps: 0, secs: 0, friends: 0, wins: 0, coins: 0, streak: 0, plus: 0, bestWin: 0, bestPz: 0, balClears: 0 }, unlocks: {}, boosts: {}, savedAt: 0 }; }
// One damaged number never erases everything: each field falls back on its own.
function cleanSave(o) {
  if (!isObj(o) || o.game !== 'bananafly') return null;
  var s = isObj(o.stats) ? o.stats : {}, fr = num(s.friends, 0, 1e9), bo = boostObj(o.boosts);
  var cn = num(s.coins, 0, 1e9), cu = flatObj(o.cont), op = flatObj(o.opts), un = flatObj(o.unlocks);
  if (bo.spent > fr + cn) bo.spent = fr + cn;   // you cannot have spent more than you ever had (friends and coins together)
  if (cu.st !== undefined) { cu.st = Math.floor(Number(cu.st)); if (!(cu.st >= 1 && cu.st <= 500)) delete cu.st; }   // a stage number must be a whole number in range
  if (op.spd !== undefined && [100, 90, 80, 70, 60].indexOf(op.spd) < 0) delete op.spd;
  if (un.emp !== undefined) un.emp = (Math.max(0, Math.floor(Number(un.emp)) || 0)) & 0xfffff;
  return {
    game: 'bananafly', v: 1,
    best: num(o.best, 0, 1e6), bestR: num(o.bestR, 0, 1e6), bestS: flatObj(o.bestS), cont: cu, opts: op, bestStage: Math.max(1, num(o.bestStage, 1, 1e5)),
    stats: { runs: num(s.runs, 0, 1e9), gates: num(s.gates, 0, 1e9), flaps: num(s.flaps, 0, 1e9), secs: num(s.secs, 0, 1e9), friends: fr, wins: num(s.wins, 0, 1e9), coins: num(s.coins, 0, 1e9), streak: num(s.streak, 0, 1e9), plus: num(s.plus, 0, 1000), bestWin: num(s.bestWin, 0, 1e7), bestPz: num(s.bestPz, 0, 1e6), balClears: num(s.balClears, 0, 1e6) },
    unlocks: un, boosts: bo, savedAt: num(o.savedAt, 0, 9e15)
  };
}
function tryParse(t) { try { return JSON.parse(t); } catch (e) { return null; } }

var loadNote = '';
/* The shared save-kit (savekit.js, from JS-modules) does the reading, the writing, the spare slot, the kept-aside bad text, the save codes and the other-tab warning. Its slots and codes are exactly the ones this game has always used (bf1, bf1-bak, bf1-damaged, BF1z./BF1p. with an 8-character check), so every old save and code still opens. cleanSave below stays the game's own rules and runs on every save the kit reads. */
var kit = SaveKit.create({ key: K.main, prefix: 'BF1', codeCheck: 'hex8', backupKey: K.bak, damagedKey: K.damaged, readBackupWithoutMain: false, stamp: 'savedAt', backupEveryMs: CFG.backupEverySecs * 1000, maxCodeBytes: 2e6,
  afterValidate: function (clean, raw) { return cleanSave(raw); } });   // (no schema: cleanSave checks every field; a refused save sends the kit to the spare slot)
function loadSave() {
  var main = sget(K.main), s = kit.load();   // a leftover spare never resurrects a game that has no main save
  if (s) { if (main !== null && !cleanSave(tryParse(main))) loadNote = 'Your newest save was damaged, so the backup was loaded.'; return s; }
  if (main !== null) loadNote = 'Your save could not be read, so you are starting fresh.';
  return defaultSave();
}
var save = loadSave();
var otherTab = false;   // P09: another tab wrote the save, so this tab stops saving (a banner offers Reload)
var noSave = false;   // noSave is only switched on by checks
function persist() {
  if (noSave || otherTab) return false;   // otherTab: another tab changed the save; this one must not write over it
  if (!cleanSave(tryParse(JSON.stringify(save)))) { logError('save', 'refused to write an unreadable save'); return false; }
  return kit.save(save);   // stamps savedAt, keeps the spare slot (at most once a minute)
}

/* ===== Player options (Settings): Calm mode, Relaxed speed, left-handed, large buttons, news ticker. Saved with the game and the save code. ===== */
var RM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
function opt(k) { return save.opts[k] || 0; }
function calmOn() { var c = save.opts.calm; return c === undefined ? !!(RM && RM.matches) : !!c; }   // no choice made yet: follow the device's reduced-motion setting
var SPEEDS = [100, 90, 80, 70, 60];
function spdPct() { var v = save.opts.spd; return v === undefined ? (opt('relaxed') ? 80 : 100) : v; }   // game speed in percent; an older Relaxed choice counts as 80
function relaxK() { return spdPct() / 100; }
function bestOf() { var p = spdPct(); return p === 100 ? save.best : p === 80 ? save.bestR : save.bestS[p] || 0; }   // each slower speed keeps its own best score (80 keeps the old Relaxed one)
function setBestOf(sc) { var p = spdPct(); if (p === 100) save.best = Math.max(save.best, sc); else if (p === 80) save.bestR = Math.max(save.bestR, sc); else save.bestS[p] = Math.max(save.bestS[p] || 0, sc); }

/* ===== Save code: BF1z.<base64url deflate-raw JSON>.<FNV-1a check, 8 hex characters> (BF1p = uncompressed), made and read by save-kit ===== */
function makeCode() { return kit.exportCode(save); }
var BAD = 'That is not a Fancy, the Banana save. Copy the whole save code and try again.';
function readText(text) {
  text = String(text || '').trim();
  if (!text) return Promise.reject(new Error('Paste a save code or choose a save file first.'));
  if (text.charAt(0) === '{') {
    var c = cleanSave(tryParse(text));
    return c ? Promise.resolve(c) : Promise.reject(new Error(BAD));
  }
  return kit.importCode(text).then(null, function (m) {   // the kit's reasons, in this game's own words (unchanged since the first release)
    throw new Error(/not complete/.test(m) ? 'That code looks incomplete or has a typo. Copy the whole code and try again.' : /cannot open/.test(m) ? 'This browser cannot open compressed codes. Use a save file instead.' : BAD);
  });
}

/* ===== Page parts ===== */
var stageEl = $('stage'), cv = $('c'), ctx = cv.getContext('2d');
var bar = $('bar'), toastEl = $('toast');
var pWin = $('pWin'), pHelp = $('pHelp'), pWear = $('pWear'), pUp = $('pUp'), pEmp = $('pEmp'), pSet = $('pSet'), pPrac = $('pPrac'), pMuse = $('pMuse'), pChal = $('pChal'), pAssist = $('pAssist'), bar2 = $('bar2'), pSave = $('pSave'), codeEl = $('code'), saveMsg = $('saveMsg'), bConfirm = $('bConfirm'), fileEl = $('file');
var toastTimer = 0;
function toast(t, ms) { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, ms || 3200); }
var PL = [pWin, pHelp, pSave, pWear, pUp, pEmp, pSet, pPrac, pMuse, pChal, pAssist];   // every window; pWin (the win card) is first because Esc and Close never close it
function panelOpen() { return PL.some(function (p) { return !p.hidden; }); }
function closable() { return PL.some(function (p, i) { return i && !p.hidden; }); }
function closePanels() { for (var i = 1; i < PL.length; i++) PL[i].hidden = true; pending = null; bConfirm.hidden = true; syncInert(); }
/* Q23: a window open = the game behind it is inert (panelOpen() checks stay as a second guard) */
var twinEl = $('twin'), INERT = [cv, bar, bar2, $('bCont'), twinEl];
function syncInert() { var on = panelOpen(), i; for (i = 0; i < INERT.length; i++) if (INERT[i] && INERT[i].inert !== on) INERT[i].inert = on; bcSync(); }
/* X16: the phone's back swipe (and the back button) closes the open window, like Esc does, instead of leaving the page. CloseWatcher: Chrome 126+, Firefox 149+; elsewhere nothing happens and the Close buttons still work. */
var bcw = BackClose.watchWhen(closable, function () { closePanels(); });   // BackClose: the lean build of back-close from JS-modules (smallparts.js); it makes the CloseWatcher while a window is open and mends it after a close
function bcSync() { if (bcw) bcw.sync(); }
/* X84: the buttons that exist only as canvas drawings (pause, the card buttons) each get an invisible real button over them, so a keyboard, a screen reader, Voice Access or Switch Access can reach them. A finger still lands on the canvas underneath (the twin ignores the pointer); an assistive click replays the tap through the game's own hit tests. */
var TWL = [], twSig = '';
function twinAdd(x, y, w, h, label, off) { TWL.push(x, y, w, h, label, off ? 1 : 0); }
function twinSync() {
  var n = TWL.length, sig = cssF + '|' + TWL.join('|'), i, b, x;
  if (sig === twSig) return;
  twSig = sig;
  while (twinEl.firstChild) twinEl.removeChild(twinEl.firstChild);
  for (i = 0; i < n; i += 6) {
    b = document.createElement('button'); b.className = 'tw'; b.setAttribute('aria-label', TWL[i + 4]); if (TWL[i + 5]) b.setAttribute('aria-disabled', 'true');
    x = cssF ? W - TWL[i] - TWL[i + 2] : TWL[i];   // a canvas turned over for the backward stage draws the buttons mirrored
    b.style.left = (x / W * 100) + '%'; b.style.top = (TWL[i + 1] / H * 100) + '%'; b.style.width = (TWL[i + 2] / W * 100) + '%'; b.style.height = (TWL[i + 3] / H * 100) + '%';
    b.dataset.cx = TWL[i] + TWL[i + 2] / 2; b.dataset.cy = TWL[i + 1] + TWL[i + 3] / 2;
    twinEl.appendChild(b);
  }
}
twinEl.addEventListener('click', function (e) {
  var t = e.target.closest ? e.target.closest('button.tw') : null, r, o;
  if (!t) return;
  r = cv.getBoundingClientRect(); o = { bubbles: true, button: 0, clientX: r.left + (cssF ? W - +t.dataset.cx : +t.dataset.cx) / W * r.width, clientY: r.top + (+t.dataset.cy) / H * r.height };
  o.buttons = 1; cv.dispatchEvent(new PointerEvent('pointerdown', o)); o.buttons = 0; dispatchEvent(new PointerEvent('pointerup', o));
});
if (window.MutationObserver) { var inertMo = new MutationObserver(syncInert); PL.forEach(function (p) { inertMo.observe(p, { attributes: true, attributeFilter: ['hidden'] }); }); }
function fmtTime(s) { var m = Math.floor(s / 60); return m < 1 ? s + ' s' : m + ' min ' + (s % 60) + ' s'; }
function refreshHelp() {
  var r = $('recs'); r.textContent = '';
  [['Best score', save.best], ['Best score (80% speed)', save.bestR], ['Best score (90% speed)', save.bestS[90] || 0], ['Best score (70% speed)', save.bestS[70] || 0], ['Best score (60% speed)', save.bestS[60] || 0], ['Best stage', save.bestStage], ['Runs', save.stats.runs], ['Gates passed', save.stats.gates], ['Flaps', save.stats.flaps], ['Friends freed', save.stats.friends], ['Prince Chimp defeated', save.stats.wins], ['Banana coins found', save.stats.coins], ['Best perfect streak', save.stats.streak], ['Time played', fmtTime(save.stats.secs)], ['Speed bonus', '+' + Math.min(CFG.plusMax, save.stats.plus) * 10 + '%'], ['Fastest win', save.stats.bestWin ? fmtM(save.stats.bestWin) : 'none yet'], ['Fewest pauses in a win', save.stats.bestPz ? save.stats.bestPz - 1 : 'none yet'], ['Secrets found', secretsAll() + ' of ' + (SEC_KEYS.length + 1)], ['Costume: bow tie', save.unlocks.bow ? 'unlocked' : 'reach stage ' + CFG.bowStage]].forEach(function (p) {
    var dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = p[0]; dd.textContent = p[1]; r.appendChild(dt); r.appendChild(dd);
  });
  helpArt(); helpSecrets();
  $('fileNote').hidden = location.protocol !== 'file:';
  var en = $('errNote'); en.hidden = !errors.length; en.textContent = errors.length ? 'Something went wrong earlier: ' + errors[errors.length - 1] : '';
  $('verNote').textContent = NAME + ' ' + PHASE + ' ' + STAMP;
}
function helpIcon(c, kind) {   // one small picture for the Help panel (the game's own art, drawn once onto a little canvas)
  var g = c.getContext('2d'), old = ctx, sp, sc, i;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.setTransform(2, 0, 0, 2, 0, 0); ctx = g;
  try {
    if (kind === 'banana') ART.banana(g, 28, 24, -0.1, 0.5, 0, 0.4, wearsBow(), 0);
    else if (kind === 'gate') { g.lineWidth = 2.2; g.strokeStyle = INK; g.fillStyle = '#7bd35a'; rrect(15, -6, 26, 20, 4); g.fill(); g.stroke(); rrect(12, 8, 32, 8, 4); g.fill(); g.stroke(); rrect(15, 36, 26, 20, 4); g.fill(); g.stroke(); rrect(12, 28, 32, 8, 4); g.fill(); g.stroke(); ART.coin(g, 28, 22, 0.3); }
    else if (kind === 'friends') { ART.friend(g, 17, 28, -0.14, 0.42, 0); ART.friend(g, 39, 28, 0.14, 0.42, 1); }
    else if (kind === 'coin') ART.coin(g, 28, 23, 0.3);
    else if (kind === 'star') drawIcon('star', 28, 22, 1.5);
    else if (kind === 'pause') drawIcon('pause', 28, 22, 1.5);
    else if (kind === 'chimp') cryChimpStill(g, 28, 26, 0.42);
    else if (kind === 'pad') {
      g.lineWidth = 2.4; g.strokeStyle = INK; g.fillStyle = '#8a6cd8'; g.beginPath(); g.moveTo(10, 14); g.quadraticCurveTo(28, 8, 46, 14); g.quadraticCurveTo(54, 26, 50, 34); g.quadraticCurveTo(44, 38, 38, 30); g.lineTo(18, 30); g.quadraticCurveTo(12, 38, 6, 34); g.quadraticCurveTo(2, 26, 10, 14); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; g.fillRect(14, 20, 10, 3.4); g.fillRect(17.3, 16.7, 3.4, 10); g.beginPath(); g.arc(37, 24, 2.8, 0, 7); g.fill(); g.beginPath(); g.arc(43, 19.5, 2.8, 0, 7); g.fillStyle = '#ffd93b'; g.fill();
    }
    else if (kind === 'balloon' || kind === 'flag' || kind === 'wafer' || kind === 'friend') drawIcon(kind, 28, 22, 1.3);
    else { sp = ART.mg.sprite(kind, kind === 'barrels' ? 2 : kind === 'gull' ? 0 : kind === 'heart' ? true : undefined); sc = Math.min(50 / sp.w, 38 / sp.h, 1.2); g.drawImage(sp.c, 28 - sp.w * sc / 2, 22 - sp.h * sc / 2, sp.w * sc, sp.h * sc); }
  } catch (e) { logError('helpicon', e); }
  ctx = old;
}
function helpArt() { var L = $('pHelp').querySelectorAll('canvas.hic[data-k]'), i; for (i = 0; i < L.length; i++) helpIcon(L[i], L[i].getAttribute('data-k')); }
var SEC_ICON = { balloons: 'balloon', flags: 'flag', wafers: 'wafer', vault: 'star', gold: 'coin', drawer: 'gate', raft: 'barrels', cove: 'bubble', boss: 'sub' };
function helpSecrets() {   // before the first win: a teaser; after it: a rumor for every secret not found yet
  var box = $('secList');
  box.textContent = '';
  function add(kind, text) { var d = document.createElement('div'), c = document.createElement('canvas'), p = document.createElement('p'); d.className = 'hrow'; c.className = 'hic'; c.width = 112; c.height = 88; c.setAttribute('aria-hidden', 'true'); p.textContent = text; d.appendChild(c); d.appendChild(p); box.appendChild(d); helpIcon(c, kind); }
  if (!secretsOn()) { add('balloon', 'The game hides secrets, and the first one is waiting for whoever beats Prince Chimp. Win once, then come back here for rumors.'); return; }
  add('friend', 'Psst! The game is full of secrets now: shimmering edges, glowing gates, and a little door on the title screen. Five quick taps on Fancy there open the Banana Museum.');
  add('friend', huntOn() ? 'Six banana friends are lost in the stages: ' + frCount() + ' of 6 found. Look in the top and bottom corners, halfway between two gates.' : 'Rumor: six banana friends got lost around the stages. They only start hiding once the game has been beaten twice.');
  add('star', 'Challenges: a Challenges button on the title screen turns on Night flashlight, Tiny gaps, Wafer storm or Mirror for your next run. Reach the end in one to earn its badge and a new scarf and mask color for Costume.');
  if (empOn()) add('friend', 'Fancy\'s Place: the little door at the bottom right of the title screen leads to Fancy\'s home. His power-ups, costumes and prizes hang on the wall, the mirror opens the Costume window, and the Apple Press does not work.');
  if (save.stats.wins >= 2) add('balloon', 'Prince Chimp fights: after your second win the last two gates of the final stage become a boss with three rounds, and a hit only repeats the round. Beat the first three for crown pieces, then the Crown Duel. You can turn the fights off with "Prince Chimp fight" in Challenges.');
  MUSE.forEach(function (r) { if (!save.unlocks[r[0]]) add(SEC_ICON[r[0]] || 'star', 'Rumor: ' + r[1] + '. ' + r[2]); });
}
function refreshCode() {
  $('storeWarn').hidden = storageOK; refreshOld(); refreshExport(); askKeep();
  makeCode().then(function (c) { codeEl.value = c; }, function (e) { logError('code', e); });
}
function openPanel(p) { closePanels(); p.hidden = false; syncInert(); saveMsg.textContent = ''; if (p === pSave) refreshCode(); else if (p === pWear) refreshWear(); else if (p === pUp) refreshUp(); else if (p === pEmp) refreshEmp(); else if (p === pSet) refreshSet(); else if (p === pPrac) refreshPrac(); else if (p === pChal) refreshChal(); else if (p === pMuse) refreshMuse(); else if (p === pAssist) refreshAssist(); else refreshHelp(); }
function describe(c) { return 'best score ' + c.best + ', best stage ' + c.bestStage + ', ' + c.stats.runs + ' runs, ' + c.stats.friends + ' friends freed'; }

var pending = null;
function say(t) { saveMsg.textContent = t; }
var loadSeq = 0;
function stage1Load(text) {
  var mySeq = ++loadSeq;
  readText(text).then(function (c) {
    if (mySeq !== loadSeq || pSave.hidden) return;   // the window was closed (or another code chosen) while this one was being read
    pending = c; bConfirm.hidden = false;
    say('Found: ' + describe(c) + '. Press the yellow button to replace your progress. Your current progress is kept as a backup on this device.');
  }, function (e) { if (mySeq !== loadSeq) return; pending = null; bConfirm.hidden = true; say(e.message); });
}
function applyLoaded() {
  if (!pending || blockedByTab()) return;
  var old = sget(K.main); if (old !== null) sset(K.before, old);
  save = pending; pending = null; bConfirm.hidden = true;
  persist(); syncOpts(); refreshCode(); syncUp(); say('Loaded: ' + describe(save) + '.');
}
var oldSave = null, oldArmed = false;   // the game that the last Load or Start fresh replaced (bf1-before-load): offered back from the Save panel
function oldCopy() { var t = sget(K.before), c = t === null ? null : cleanSave(tryParse(t)); return c && t !== sget(K.main) ? c : null; }
function refreshOld() { oldArmed = false; oldSave = oldCopy(); $('bOld').hidden = !oldSave; $('bOld').textContent = 'Put my old game back'; }
function putOldBack() {
  if (!oldSave || blockedByTab()) return;
  if (!oldArmed) { oldArmed = true; $('bOld').textContent = 'Yes, put it back'; say('Your old game: ' + describe(oldSave) + '. Press again to swap it in. The game you have now is kept, so you can swap back.'); return; }
  var cur = sget(K.main), back = oldSave; if (cur !== null) sset(K.before, cur);
  save = back; persist(); syncOpts(); refreshCode(); syncUp(); say('Your old game is back: ' + describe(save) + '. The one you had before is kept; press the button again to swap back.');
}
/* P09: another tab wrote the save: stop saving here and say so */
function otherTabWrote(msg) {
  if (otherTab) return;
  otherTab = true; $('tabWarn').hidden = false; if (typeof msg === 'string') $('tabWarn').firstChild.textContent = msg;
  if (inRun()) onHidden();
}
kit.onOtherTab(otherTabWrote);   // another tab changed (or cleared) the save
var tabG = null;
if (location.hash !== '#test') { try { tabG = TabGuard.start({ name: 'fancy-banana-open', backForwardCache: true, onTakeOver: function () { location.reload(); }, onTwin: function () { otherTabWrote('Fancy is already open in another tab, so saving is paused here to protect that game.'); } }); } catch (e) { } }   // the second open copy is told when it opens, not only after the first one saves (the test pages open several copies at once, so they skip it)
$('bReload').addEventListener('click', function () { if (tabG && tabG.supported && !tabG.holding) tabG.takeOver(); else location.reload(); });   // Reload makes this copy the one in charge (the other copy is told to stop saving), then reloads
function blockedByTab() { if (!otherTab) return false; say('Saving is paused because the game changed in another tab. Reload this page first.'); return true; }
function copyText(t, done) {   // to the clipboard; if the browser says no, a short-lived text box does it
  var fb = function () { var ta = document.createElement('textarea'), ok = false; ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:absolute;left:-999px;top:0'; stageEl.appendChild(ta); ta.select(); try { ok = document.execCommand('copy'); } catch (e) { } stageEl.removeChild(ta); done(ok); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { done(true); }, fb); else fb();
}
function resultText() {
  var v = VS || { secs: 0, pauses: 0, flaps: 0, coins: 0, friends: 0, pops: 0 }, st = save.stats, t = v.secs ? fmtM(v.secs) : '?';
  return 'Fancy, the Banana: I beat Prince Chimp in ' + t + '! ' + v.pauses + ' pause' + (v.pauses === 1 ? '' : 's') + ', ' + v.flaps + ' taps, ' + v.friends + ' friends freed, ' + v.coins + ' gold bananas' + (v.pops ? ', ' + v.pops + ' balloons popped' : '') + '. Win number ' + st.wins + (st.plus ? ', speed +' + st.plus * 10 + '%' : '') + '. https://lfcfoundry.github.io/fancy-banana/';
}
function copyCode() {
  var t = codeEl.value;
  var fallback = function () { codeEl.focus(); codeEl.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { } say(ok ? 'Copied.' : 'Select the code above and copy it.'); if (ok) noteExport(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { say('Copied.'); noteExport(); }, fallback); else fallback();
}
var holdDone = null, dlHold = 0;   // a native Save or Open dialog is on screen: the browser keeps the page's drawing and the dialog fighting for the screen, so the game rests (no steps, no drawing) until you are back
function holdForDialog() {
  if (holdDone) holdDone();
  var t0 = performance.now(), seenBlur = false, tm = 0;
  var done = function () { dlHold = 0; if (holdDone === done) holdDone = null; removeEventListener('blur', onB); removeEventListener('focus', done); removeEventListener('pointermove', back, true); removeEventListener('pointerdown', back, true); removeEventListener('keydown', back, true); clearInterval(tm); };
  var onB = function () { seenBlur = true; }, back = function () { if (performance.now() - t0 > 400) done(); };   // input only counts once the dialog has had time to open
  dlHold = 1; holdDone = done; addEventListener('blur', onB); addEventListener('focus', done); addEventListener('pointermove', back, true); addEventListener('pointerdown', back, true); addEventListener('keydown', back, true);
  tm = setInterval(function () { var age = performance.now() - t0; if ((!seenBlur && age > 2500) || age > 90000) done(); }, 500);   // no dialog took the focus (a browser that saves straight to Downloads): carry on after a moment
}
/* P28: when the save was last copied or saved to a file is kept in its own key (not in the save) */
var EXPK = K.main + '-exp', expHinted = false, keepAsked = false;
function lastExport() { var v = parseInt(sget(EXPK), 10); return v > 0 ? v : 0; }
function noteExport() { sset(EXPK, String(Date.now())); refreshExport(); }
function refreshExport() {
  var t = lastExport(), d = t ? Math.floor((Date.now() - t) / 864e5) : -1, el = $('expNote');
  el.textContent = !t ? 'You have not copied your save code or saved a file yet. A copy outside this browser keeps your game safe if the browser clears its data.' : d < 1 ? 'You copied or saved a copy today.' : 'You last copied or saved a copy ' + (d === 1 ? 'yesterday' : d + ' days ago') + '.';
}
function askKeep() {   // asked on a tap on Save
  if (keepAsked) return; keepAsked = true;
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(function (p) { if (!p) navigator.storage.persist().catch(function () { }); }, function () { }); } catch (e) { }
}
function exportHint() {
  if (expHinted || save.bestStage < 3 || saveAtRisk()) return;
  var t = lastExport(); if (t && Date.now() - t < 14 * 864e5) return;
  expHinted = true; toast('Tip: your game lives only in this browser. Open Save and copy your save code now and then.', 7000);
}
function downloadFile() {
  try {
    var d = new Date(), p = function (n) { return ('0' + n).slice(-2); };
    var name = 'fancy-save-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.json';
    var url = URL.createObjectURL(new Blob([JSON.stringify(save, null, 1)], { type: 'application/json' }));
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); holdForDialog(); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    say('Save file started: ' + name + '. If nothing downloads, copy the save code instead.'); noteExport();
  } catch (e) { logError('download', e); say('This browser blocked the download. Copy the save code instead.'); }
}

/* ===== Settings ===== */
var TGS = [['sCalm', 'calm'], ['sLeft', 'lefty'], ['sBig', 'big'], ['sText', 'bigtext'], ['sTick', 'ticker'], ['sSave', 'saver']];
function tgOn(k) { return k === 'calm' ? calmOn() : k === 'ticker' ? !opt('noticker') : !!opt(k); }
function tgSet(k, v) { if (k === 'ticker') save.opts.noticker = v ? 0 : 1; else save.opts[k] = v ? 1 : 0; }
function syncOpts() {   // apply the choices that change the page itself
  document.body.classList.toggle('lefty', !!opt('lefty')); document.body.classList.toggle('big', !!opt('big')); document.body.classList.toggle('bt', !!opt('bigtext'));
  PB[0] = opt('lefty') ? 34 : 326; MG_PB[0] = opt('lefty') ? 42 : 318; PBR = opt('big') ? 22 : 16;
}
function refreshSet() {
  TGS.forEach(function (t) {
    var b = $(t[0]), on = tgOn(t[1]), n = $(t[0] + 'N'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    n.textContent = on ? (t[1] === 'calm' && save.opts.calm === undefined ? 'On (auto)' : 'On') : 'Off';   // (auto): the device asked for less motion
  });
  var lk = speedLocked(); $('sSpeed').disabled = lk; $('sSpeedN').textContent = spdPct() + '%'; $('sSpeed').classList.toggle('on', spdPct() !== 100); $('sSpeedNote').textContent = lk ? 'Pick this on the title screen (not during a run).' : 'Slower speeds keep their own best score.';
  $('bFull').hidden = !(document.fullscreenEnabled && document.documentElement.requestFullscreen);
  $('bFull').textContent = document.fullscreenElement ? 'Leave full screen' : 'Full screen';
  stillDrawn = false;   // a paused or finished screen is drawn again to show the new choice
}
function speedLocked() { return state === 'play' || state === 'paused' || state === 'launch' || state === 'mini' || state === 'sky' || state === 'volc'; }
$('sSpeed').addEventListener('click', function () { if (speedLocked()) return; var i = SPEEDS.indexOf(spdPct()); save.opts.spd = SPEEDS[(i + 1) % SPEEDS.length]; delete save.opts.relaxed; persist(); refreshSet(); if (state === 'ready') resetWorld(); });
/* Q26: after 5 failed tries at one stage (then every 5 more) offer help; counted in memory only, not in practice or Calm */
var failN = {}, failNext = {};
function assistNote() {
  if (pracN || calmOn() || panelOpen() || otherTab || !stage) return;
  var k, s = stage | 0; for (k in failN) if ((+k) < s) { delete failN[k]; delete failNext[k]; }   
  failN[s] = (failN[s] || 0) + 1;
  if (failN[s] < (failNext[s] || 5)) return;
  failNext[s] = failN[s] + 5; $('aText').textContent = 'Stage ' + s + ' is a tricky one. Anyone can use a little help, and your scores stay yours.';
  openPanel(pAssist);
}
function nextSlower() { var i = SPEEDS.indexOf(spdPct()); return i >= 0 && i < SPEEDS.length - 1 ? SPEEDS[i + 1] : 0; }
function refreshAssist() {
  var n = nextSlower(), lk = speedLocked();
  $('aSlow').hidden = !n; $('aSlow').disabled = lk; $('aSlowN').textContent = n ? n + '%' : '';
  $('aSlowNote').textContent = lk ? 'Pick this on the title screen (not during a run).' : 'Slower speeds keep their own best score. Now: ' + spdPct() + '%.';
  stillDrawn = false;
}
$('aSlow').addEventListener('click', function () { var n = nextSlower(); if (!n || speedLocked()) return; save.opts.spd = n; delete save.opts.relaxed; persist(); closePanels(); toast('Game speed is now ' + n + '%. It has its own best score.', 4000); if (state === 'ready') resetWorld(); });
$('aUps').addEventListener('click', function () { openPanel(pUp); });
$('aNo').addEventListener('click', closePanels);
$('sHelp').addEventListener('click', function () { $('aText').textContent = 'Anyone can use a little help, and your scores stay yours.'; openPanel(pAssist); });
TGS.forEach(function (t) { $(t[0]).addEventListener('click', function () { tgSet(t[1], !tgOn(t[1])); persist(); syncOpts(); refreshSet(); }); });
$('bSet').addEventListener('click', function () { openPanel(pSet); });
$('setClose').addEventListener('click', closePanels);
$('bFull').addEventListener('click', function () {
  try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { logError('fullscreen', e); }
  setTimeout(refreshSet, 300);
});
if (RM && RM.addEventListener) RM.addEventListener('change', function () { if (!pSet.hidden) refreshSet(); });

/* ===== Costumes and upgrades ===== */
/* ===== The Banana Museum (five quick taps on Fancy on the title screen, once the game has been beaten) ===== */
var MUSE = [['balloons', 'Balloon Party', 'Beat Prince Chimp once.'], ['flags', 'Pennant flags', 'He gives them up with the balloons.'], ['wafers', 'Vanilla wafers', 'Thrown in the Navy from the third playthrough.'], ['vault', 'Sky Vault', 'In the quiet at the start of a run or after a stage, fly along the very top edge. Look for a shimmer.'], ['gold', 'Golden Gate', 'A long perfect streak makes one gate glow. Fly through it.'], ['drawer', 'Junk Drawer', 'In the quiet before the Silverware Drawer, skim the floor.'], ['raft', 'Treasure Raft', 'In the Navy, time three barrel leaps just right in a row.'], ['cove', 'Secret Cove', 'Near the end of the Navy, fly through the little rock arch in the water.'], ['boss', 'Boss Sub', 'Sail the whole Navy without losing a heart.'], ['boom', 'Boomerang Chimp', 'Buy the Boomerang key in the Emporium, then sail the whole Navy without losing a heart.'], ['sky', 'Chimp Airforce', 'Buy the Cloud key in the Emporium, then fly through the clouds to the volcano.'], ['volc', 'Volcano Run', 'Buy the Volcano key in the Emporium, then fly out through the inside of the volcano.']];
var museN = 0, museT = -9, museW = 0;
var TOFF = 40;   // the title picture sits this far lower: the news ticker has the top of the screen
function museHit(pl) {
  if (!secretsOn() || panelOpen() || titleFancyIn() < 1 || pl[0] < 18 || pl[0] > 138 || pl[1] < 150 + TOFF || pl[1] > 262 + TOFF) return false;
  if (time - museT > 3) museN = 0;
  museT = time; museN++; museW = 1; burst(76, 182 + TOFF, 8, ['#ffd93b', '#ffffff'], 120, 140);
  if (museN >= 5) { museN = 0; openPanel(pMuse); }
  return true;
}
function refreshMuse() {
  var box = $('museFr'), sec = $('museSec'), i, d, c, g, t, rows = MUSE.slice();
  box.textContent = ''; sec.textContent = '';
  for (i = 0; i < 6; i++) { d = document.createElement('div'); d.className = 'fr'; c = document.createElement('canvas'); c.width = 64; c.height = 48; g = c.getContext('2d'); g.globalAlpha = frFound(i) ? 1 : 0.25; ART.friend(g, 32, 26, 0, 0.9, FR_V[i]); d.appendChild(c); t = document.createElement('span'); t.textContent = frFound(i) ? FR_NAMES[i] : '?'; d.appendChild(t); box.appendChild(d); }
  $('museNote').textContent = !huntOn() ? 'Six friends got lost around the stages. They only start hiding once the game has been beaten twice.' : frCount() + ' of 6 found. They hide in the top and bottom corners, halfway between two gates. Each stage hides one.';
  rows.push(['bunch', 'Banana Bunch', 'Find all six lost friends.']);
  rows.forEach(function (r) { var f = r[0] === 'bunch' ? bunchOk() : !!save.unlocks[r[0]], p = document.createElement('p'), b = document.createElement('b'), sm = document.createElement('small'); p.className = 'mrow'; b.textContent = r[1] + (f ? ': found' : ': not yet'); sm.textContent = r[2]; p.appendChild(b); p.appendChild(sm); sec.appendChild(p); });
}
function wearFlags() { return (wearsBow() ? 1 : 0) | (wearsCrown() ? 2 : 0) | (empWorn(E.hat) ? 4 : 0) | (empWorn(E.shades) ? 8 : 0); }
function wearsBow() { var u = save.unlocks; return !!u.bow && u.wear !== 0; }
function refreshWear() {
  var bow = !!save.unlocks.bow, on = wearsBow();
  [['cvPlain', false], ['cvBow', true]].forEach(function (p) {
    var g = $(p[0]).getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 176, 120); g.setTransform(2, 0, 0, 2, 0, 0);
    ART.banana(g, 54, 32, -0.05, 0.95, 0, 0.4, p[1], 0);
  });
  var bg = $('cvBunch').getContext('2d'); bg.setTransform(1, 0, 0, 1, 0, 0); bg.clearRect(0, 0, 176, 120); bg.setTransform(2, 0, 0, 2, 0, 0); bg.globalAlpha = bunchOk() ? 1 : 0.3; bg.save(); bg.translate(41, 31); bg.rotate(-0.15); bunchDraw(bg, 0.34); bg.restore(); ART.banana(bg, 58, 30, -0.05, 0.8, 0, 0.4, false, 0); bg.globalAlpha = 1;
  refreshColors();
  $('wPlain').classList.toggle('on', !on); $('wBow').classList.toggle('on', on);
  $('wRain').disabled = !rainOk(); $('wRain').classList.toggle('on', rainOn()); $('rainNote').textContent = rainOk() ? (rainOn() ? 'A rainbow behind Fancy' : 'Off') : 'A secret: a perfect streak of 10';
  var fu = !!save.unlocks.flags; $('wFlags').disabled = !fu; $('wFlags').classList.toggle('on', flagsOn()); $('flagNote').textContent = fu ? (flagsOn() ? 'Flying behind Fancy' : 'Off') : 'A secret: beat Prince Chimp';
  $('wBunch').disabled = !bunchOk(); $('wBunch').classList.toggle('on', bunchOn()); $('bunchNote').textContent = bunchOk() ? (bunchOn() ? 'Worn on his back' : 'Off') : 'A secret: find all six lost friends';
  var cu = !!save.unlocks.crown; $('wCrown').disabled = !cu; $('wCrown').classList.toggle('on', wearsCrown()); $('crownNote').textContent = cu ? (wearsCrown() ? 'Wearing it' : 'Off') : 'A secret: win the Crown Duel';
  $('wBow').disabled = !bow; $('bowNote').textContent = bow ? (on ? 'Wearing it' : 'Unlocked') : 'Reach stage ' + CFG.bowStage + ' to unlock';
}
function pickWear(v) { save.unlocks.wear = v; persist(); refreshWear(); }
var UPS = [
  { id: 'roomy', name: 'Roomy gaps', desc: 'Wider openings, +5 px per level', costs: [10, 20, 30] },
  { id: 'gentle', name: 'Gentle fall', desc: 'Fancy falls 6% slower per level', costs: [10, 20, 30] },
  { id: 'shield', name: 'Free bounce', desc: 'Boing! Bounce off the ground or an obstacle and fly on, once per run per level', costs: [25, 50] },
  { id: 'heart', name: 'Extra heart', desc: 'One more heart in the Chimp\'s Navy mini game, per level', costs: [15, 30] },
  { id: 'superleap', name: 'Super Leap', desc: 'In Chimp\'s Navy, leap higher and longer, and sail right over seagulls too', costs: [75, 150] },
  { id: 'magnet', name: 'Banana magnet', desc: 'Gold bananas fly to Fancy from farther away (+35% reach per level)', costs: [15, 30, 45] },
  { id: 'sweet', name: 'Sweet spot', desc: 'A wider PERFECT zone in the middle of every gap (+25% per level)', costs: [20, 40, 60] },
  { id: 'dare', name: 'Daredevil', desc: 'A wider Close call zone (+3 px per level)', costs: [15, 30, 45] },
  { id: 'golden', name: 'Golden touch', desc: 'PERFECT gates and streak bonuses pay +1 more banana per level', costs: [30, 60] },
  { id: 'potassium', name: 'Potassium Power!', desc: 'Hold when 3+ gates line up: Fancy glides straight through, a bit faster', costs: [120] },
  { id: 'wind', name: 'Second wind', desc: 'Once per run, a crash restarts the current stage instead of ending the run', costs: [100] },
  { id: 'rope', name: 'Rope cutter', desc: 'In Chimp\'s Navy, a helper chimp snips the rope: barrel groups split apart before they reach you', costs: [40] },
  { id: 'wshield', name: 'Wafer shield', desc: 'In Chimp\'s Navy, blocks one thrown wafer per run', costs: [30] },
  { id: 'limes', name: 'Lime defense', desc: 'Little rocket limes shoot down a coconut in boss fights, or a seagull in Chimp\'s Navy, that is about to hit you (2 per fight or Navy run, per level)', costs: [150, 300] },
  { id: 'practice', name: 'Practice Chimp\'s Navy', desc: 'Play the water level any time from the title screen (nothing is earned)', costs: [40] }
];
var UPMAX = {};
UPS.forEach(function (u) { UPMAX[u.id] = u.costs.length; });
function magR() { return CFG.magnetR * (1 + 0.35 * lvl('magnet') + (empOwn(E.mega) ? 1 : 0)); }
function nextCost(u) { var l = lvl(u.id); return l < u.costs.length ? u.costs[l] : 0; }
function canBuy(u) { var c = nextCost(u); return c > 0 && bal() >= c; }
function anyBuy() { return UPS.some(canBuy); }
function syncUp() { $('bCont').hidden = !(save.cont.st > 1) || state !== 'title'; $('bCont').textContent = 'Continue: stage ' + (save.cont.st || 0); $('bUp').hidden = !anyBuy(); $('bPractice').hidden = lvl('practice') < 1 || state !== 'title'; $('bEmp').hidden = !empOn() || state !== 'title'; $('bSky').hidden = !skyOn() || state !== 'title'; $('bVolc').hidden = !volcOn() || state !== 'title'; $('bChal').hidden = !secretsOn() || state !== 'title'; applyColors(); }
function lvl(id) { var v = save.boosts[id] || 0, m = UPMAX[id]; return m !== undefined && v > m ? m : v; }   // never past the shop's top level (a damaged or edited save cannot give a million)
function bal() { return save.stats.friends + save.stats.coins - (save.boosts.spent || 0); }
function refreshUp() {
  $('upBal').textContent = bal(); var box = $('upList'); box.textContent = '';
  function tile(u, off) {
    var l = lvl(u.id), max = u.costs.length, cost = l < max ? u.costs[l] : 0, b = document.createElement('button'), nm = document.createElement('b'), pp = document.createElement('div'), sm = document.createElement('small'), em = document.createElement('em'), k;
    b.className = 'ut' + (off ? ' off' : ''); nm.textContent = u.name; b.appendChild(nm); pp.className = 'pips'; for (k = 0; k < max; k++) { var d = document.createElement('s'); if (k < l) d.className = 'on'; pp.appendChild(d); } b.appendChild(pp);
    if (!off) { sm.textContent = u.desc; b.appendChild(sm); } em.textContent = off ? cost - bal() + ' more to go' : 'Buy for ' + cost; b.appendChild(em);
    if (off) { b.disabled = true; b.setAttribute('aria-label', u.name + ', ' + (cost - bal()) + ' more credits needed'); } else b.addEventListener('click', function () { buy(u); });
    box.appendChild(b);
  }
  var can = UPS.filter(canBuy), wait = UPS.filter(function (u) { return nextCost(u) > 0 && !canBuy(u); }), h;
  if (!can.length) { var none = document.createElement('p'); none.textContent = 'Nothing to buy yet. Free more friends and grab golden coins!'; box.appendChild(none); }
  can.forEach(function (u) { tile(u, false); });
  if (wait.length) { h = document.createElement('h3'); h.textContent = 'Saving up for...'; box.appendChild(h); wait.forEach(function (u) { tile(u, true); }); }
}
function buy(u) {
  var l = lvl(u.id); if (l >= u.costs.length || bal() < u.costs[l]) return;
  save.boosts.spent = (save.boosts.spent || 0) + u.costs[l]; save.boosts[u.id] = l + 1; persist(); var sc = $('upList').scrollTop; refreshUp(); $('upList').scrollTop = sc; syncUp(); $('upMsg').textContent = 'Yay! ' + u.name + ' is now level ' + (l + 1) + '!';
}
/* --- The Emporium: a secret shop, open once the Balloon Party has been cleared twice --- */
var E = { hat: 0, shades: 1, mega: 2, gheart: 3, stars: 4, hearts: 5, confetti: 6, perkB: 7, perkH: 8, gift: 9, keyBal: 10, keyBoom: 11, superK: 12, keySky: 13, keyVolc: 14 }, runPB = 0, runPH = 0, EMP_DOOR = [276, 338, 56, 66];
var EMP = [
  { id: 'hat', k: 'wear', g: 0, name: 'Top hat', desc: 'A tall black hat with a red band.', cost: 150 },
  { id: 'shades', k: 'wear', g: 0, name: 'Cool shades', desc: 'Very dark. Very cool.', cost: 100 },
  { id: 'mega', k: 'up', g: 1, name: 'Mega magnet', desc: 'Gold bananas fly to Fancy from twice as far, on top of the magnet upgrade.', cost: 250 },
  { id: 'gheart', k: 'up', g: 1, name: 'Golden heart', desc: 'One more heart in Chimp\'s Navy, for good.', cost: 300 },
  { id: 'stars', k: 'trail', g: 2, tr: 1, name: 'Star trail', desc: 'Little gold stars twinkle behind Fancy.', cost: 80 },
  { id: 'hearts', k: 'trail', g: 2, tr: 2, name: 'Heart trail', desc: 'Pink hearts float behind Fancy.', cost: 80 },
  { id: 'confetti', k: 'spark', g: 2, name: 'Confetti flaps', desc: 'Every flap pops a puff of confetti.', cost: 90 },
  { id: 'perkB', k: 'perk', g: 3, name: 'Spare bounce', desc: 'One extra free bounce for your next run.', cost: 25 },
  { id: 'perkH', k: 'perk', g: 3, name: 'Spare heart', desc: 'One extra heart in Chimp\'s Navy for your next run.', cost: 20 },
  { id: 'gift', k: 'gift', g: 3, name: 'Surprise gift', desc: 'A wrapped box with two random perks inside.', cost: 35 },
  { id: 'keyBal', k: 'up', g: 4, name: 'Night Balloon key', desc: 'Opens a second Balloon Party at night, right after the Fruit Garden: more balloons, a faster sky and a bigger bonus.', cost: 200 },
  { id: 'keyBoom', k: 'up', g: 4, name: 'Boomerang key', desc: 'Opens a secret boss at the end of Chimp\'s Navy: Boomerang Chimp. Dodge his boomerangs and watch them swing back (all hearts needed).', cost: 300 },
  { id: 'superK', k: 'up', g: 1, need: 'potassium', name: 'Super Potassium', desc: 'Needs Potassium Power. Hold the tap for half a second away from a gate lane: Fancy blasts forward for a few seconds and smashes everything he touches without a scratch. Once per stage.', cost: 250 },
  { id: 'keySky', k: 'up', g: 4, name: 'Cloud key', desc: 'Opens a secret game on the title screen: the Chimp Airforce. Fly through the clouds, dodge the Chimp biplanes and their bomber, and reach the volcano.', cost: 300 },
  { id: 'keyVolc', k: 'up', g: 4, name: 'Volcano key', desc: 'Opens a secret level on the title screen: the Volcano Run. Fly inside the volcano past lava streams, rock doors and tight slots, above the lava lake.', cost: 400 }
], EMP_H = ['Costumes', 'Special upgrades', 'Trails and sparks', 'Gifts and one-run perks', 'Keys to secret places'];
function empOn() { return save.stats.balClears >= CFG.empClears; }
function empOwn(i) { return ((save.unlocks.emp | 0) >> i & 1) === 1; }
function empWorn(i) { return empOwn(i) && ((save.unlocks.empOff | 0) >> i & 1) === 0; }
function empTrail() { var t = save.unlocks.empTr | 0; return t && empOwn(t === 1 ? E.stars : E.hearts) ? t : 0; }
function empNow(i) { var e = EMP[i]; return e.k === 'trail' ? empTrail() === e.tr : empWorn(i); }
function usePerks() {   // a new run spends the one-run perks that were bought
  runPB = runPH = 0; if (pracN) return;
  if (lvl('perkB') > 0) { runPB = 1; shield += 1; save.boosts.perkB--; }
  if (lvl('perkH') > 0) { runPH = 1; save.boosts.perkH--; }
  if (runPB || runPH) { persist(); toast(runPB && runPH ? 'Perks ready: a spare bounce and a spare heart!' : runPB ? 'Perk ready: a spare bounce!' : 'Perk ready: a spare heart for Chimp\'s Navy!'); }
}
function refreshEmp() {
  $('epBal').textContent = bal(); var box = $('epList'), g, i;
  box.textContent = '';
  for (g = 0; g < EMP_H.length; g++) {
    var h = document.createElement('h3'); h.textContent = EMP_H[g]; box.appendChild(h);
    for (i = 0; i < EMP.length; i++) if (EMP[i].g === g) empTile(box, i);
  }
}
function empTile(box, i) {
  var e = EMP[i], b = document.createElement('button'), nm = document.createElement('b'), sm = document.createElement('small'), em = document.createElement('em'), stock = e.k === 'perk' ? lvl(e.id) : 0,
    own = e.k !== 'perk' && e.k !== 'gift' && empOwn(i), lock = !!e.need && !lvl(e.need) && !own, can = bal() >= e.cost && !(e.k === 'perk' && stock >= 9) && !(e.k === 'gift' && lvl('perkB') >= 9 && lvl('perkH') >= 9) && !lock;
  b.className = 'ut' + (!own && !can ? ' off' : ''); nm.textContent = e.name; b.appendChild(nm);
  sm.textContent = e.desc + (stock ? ' You have ' + stock + '.' : ''); b.appendChild(sm);
  if (own) { em.textContent = e.k === 'up' ? (e.need && !lvl(e.need) ? 'Yours, but it needs Potassium Power again' : 'Yours!') : empNow(i) ? (e.k === 'wear' ? 'Wearing it' : 'Using it') : (e.k === 'wear' ? 'Tap to wear' : 'Tap to use'); if (e.k !== 'up') b.addEventListener('click', function () { empToggle(i); }); else b.classList.add('done'); }
  else { em.textContent = lock ? 'Needs Potassium Power first' : can ? 'Buy for ' + e.cost : bal() < e.cost ? e.cost - bal() + ' more to go' : 'Stock is full'; if (can) b.addEventListener('click', function () { empBuy(i); }); else b.disabled = true; }
  b.appendChild(em); box.appendChild(b);
}
function empRedo(msg) { persist(); var sc = $('epList').scrollTop; refreshEmp(); $('epList').scrollTop = sc; syncUp(); $('epMsg').textContent = msg; }
function empToggle(i) {
  var e = EMP[i]; if (e.k === 'trail') save.unlocks.empTr = empTrail() === e.tr ? 0 : e.tr; else save.unlocks.empOff = (save.unlocks.empOff | 0) ^ (1 << i);
  empRedo(e.name + (empNow(i) ? ' is on.' : ' is off.'));
}
function empBuy(i) {
  var e = EMP[i], m, a, b; if (bal() < e.cost || (e.need && !lvl(e.need))) return;
  if (e.k === 'perk') { if (lvl(e.id) >= 9) return; save.boosts[e.id] = lvl(e.id) + 1; m = e.name + ' is packed for your next run!'; }
  else if (e.k === 'gift') {
    var pk = ['perkB', 'perkH'].filter(function (k) { return lvl(k) < 9; }), got = [], gi, gk;   // only stock that has room is picked, so a gift never pays for nothing
    if (!pk.length) return;
    for (gi = 0; gi < 2; gi++) { pk = pk.filter(function (k) { return lvl(k) < 9; }); if (!pk.length) break; gk = pk[Math.floor(Math.random() * pk.length)]; save.boosts[gk] = lvl(gk) + 1; got.push(gk); }
    a = got[0]; b = got[1];
    m = !b ? 'Surprise! A spare ' + (a === 'perkB' ? 'bounce' : 'heart') + '!' : a === b ? 'Surprise! Two ' + (a === 'perkB' ? 'spare bounces' : 'spare hearts') + '!' : 'Surprise! A spare bounce and a spare heart!';
  } else { if (empOwn(i)) return; save.unlocks.emp = (save.unlocks.emp | 0) | (1 << i); save.unlocks.empOff = (save.unlocks.empOff | 0) & ~(1 << i); if (e.k === 'trail') save.unlocks.empTr = e.tr; m = 'Yay! ' + e.name + ' is yours!'; }
  save.boosts.spent = (save.boosts.spent || 0) + e.cost; empRedo(m);
}
function drawEmpTrail(pw) {   // little stars or hearts along the trail
  var t = empTrail(), n = trail.length, i, q, a, s;
  if (!t || n < 3 || pw <= 0) return;
  ctx.fillStyle = t === 1 ? '#ffe45c' : '#ff5d8f'; ctx.beginPath();
  for (i = 2; i < n; i += 3) {
    q = trail[i]; a = 1 - q.t / 0.5; if (a <= 0) continue; s = (3 + a * 6) * (0.4 + 0.6 * pw);
    if (t === 1) { for (var k = 0; k < 10; k++) { var r = k % 2 ? s * 0.45 : s, an = -1.5708 + k * 0.62832; ctx[k ? 'lineTo' : 'moveTo'](q.x + Math.cos(an) * r, q.y + Math.sin(an) * r); } ctx.closePath(); }
    else { ctx.moveTo(q.x, q.y + s * 0.9); ctx.bezierCurveTo(q.x - s * 1.6, q.y - s * 0.2, q.x - s * 0.7, q.y - s * 1.3, q.x, q.y - s * 0.5); ctx.bezierCurveTo(q.x + s * 0.7, q.y - s * 1.3, q.x + s * 1.6, q.y - s * 0.2, q.x, q.y + s * 0.9); }
  }
  ctx.fill();
}
$('bWear').addEventListener('click', function () { openPanel(pWear); });
$('bUp').addEventListener('click', function () { openPanel(pUp); });
$('bEmp').addEventListener('click', function () { if (state === 'title') openPanel(pEmp); });
$('bCont').addEventListener('click', continueRun);
$('bPractice').addEventListener('click', function () { if (state === 'title') openPanel(pPrac); });
$('bSky').addEventListener('click', function () { if (state === 'title' && skyOn() && !panelOpen()) startSky(); });
$('bVolc').addEventListener('click', function () { if (state === 'title' && volcOn() && !panelOpen()) startVolc(); });
$('pracClose').addEventListener('click', closePanels);
/* Practice: the water level, or any stage that has been cleared (the same 40-credit upgrade). Nothing is earned and nothing is saved. */
var pracN = 0, pracEnd = '';   // pracN: the stage being practiced (0 = a normal run); pracEnd: how a practice run ended ('win' or 'lose')
function clearedStages() { return save.stats.wins > 0 ? ART.names.length : Math.min(ART.names.length, save.bestStage - 1); }
function refreshChal() {
  var box = $('chList'), cur = chalIdx(), i;
  box.textContent = '';
  CHAL.forEach(function (c, i) {
    var b = document.createElement('button'), sp = document.createElement('span'), sm = document.createElement('small'), st = document.createElement('b');
    b.className = 'opt cmp'; b.id = 'ch' + i; b.setAttribute('aria-pressed', cur === i + 1 ? 'true' : 'false'); if (cur === i + 1) b.classList.add('on');
    sp.textContent = c[1]; sm.textContent = c[2] + (badgeOf(i) ? ' Badge earned.' : ''); sp.appendChild(sm); b.appendChild(sp);
    st.textContent = cur === i + 1 ? 'ON' : badgeOf(i) ? '\u2605' : ''; b.appendChild(st);
    b.addEventListener('click', function () { save.unlocks.chal = cur === i + 1 ? 0 : i + 1; persist(); refreshChal(); });
    box.appendChild(b);
  });
  var pb = $('pcFight'), nx = fightNext(), fo = fightOn(), need = 0, n, np = 0;
  for (n = 1; n <= 4; n++) { if (!pcBeaten(n) && !need) need = n + 1 - save.stats.wins; if (n < 4 && pcBeaten(n)) np++; }
  pb.disabled = !nx; pb.setAttribute('aria-pressed', fo ? 'true' : 'false'); pb.classList.toggle('on', fo); $('pcN').textContent = fo ? 'ON' : '';
  $('pcNote').textContent = nx ? (fo ? 'Next: ' : 'Off. Next would be: ') + FIGHTS[nx - 1][0] + (pcBeaten(nx) ? ' (rematch)' : '') + '. Crown pieces: ' + np + ' of 3. Tap to turn ' + (fo ? 'off' : 'on') + '.' : 'Win ' + Math.max(1, need) + ' more time' + (need > 1 ? 's' : '') + ' to meet the next fight.';
  var pcv = $('pcPieces').getContext('2d'); pcv.setTransform(2, 0, 0, 2, 0, 0); pcv.clearRect(0, 0, 150, 46); drawPieces(pcv, 75, 24, 1);
  $('chNote').textContent = cur ? 'Your next run is in ' + CHAL[cur - 1][1] + '. Tap it again to turn it off.' : 'No challenge is on, so runs are normal.';
}
function refreshColors() {
  [['scRow', 'scarf', SCARFS], ['mkRow', 'mask', MASKS]].forEach(function (r) {
    var box = $(r[0]), cur = colorIdx(r[1]);
    box.textContent = '';
    r[2].forEach(function (c, i) {
      var b = document.createElement('button'), sw = document.createElement('i'), ok = i === 0 || badgeOf(i - 1);
      b.className = 'sw' + (cur === i ? ' on' : ''); b.id = r[1] + i; b.disabled = !ok; b.setAttribute('aria-label', c[0] + (ok ? '' : ', locked: win the ' + CHAL[i - 1][1] + ' challenge'));
      sw.style.background = ok ? c[1] : '#cfc6d8'; b.appendChild(sw); b.appendChild(document.createTextNode(ok ? c[0] : '?'));
      b.addEventListener('click', function () { save.unlocks[r[1]] = i; persist(); applyColors(); refreshWear(); });
      box.appendChild(b);
    });
  });
}
function refreshPrac() {
  var box = $('pracList'), i, b, add = function (label, sub, fn) { b = document.createElement('button'); b.className = 'opt'; b.innerHTML = '<span></span>'; b.firstChild.textContent = label; if (sub) { var sm = document.createElement('small'); sm.textContent = sub; b.firstChild.appendChild(sm); } b.addEventListener('click', fn); box.appendChild(b); };
  box.textContent = '';
  for (i = 1; i <= clearedStages(); i++) (function (n) { add('Stage ' + n + ': ' + ART.names[n - 1], gpsOf(n) + ' gates', function () { startPracticeStage(n); }); })(i);
  add("Chimp's Navy", 'The water level', function () { closePanels(); startPractice(); });
}
$('wClose').addEventListener('click', closePanels); $('uClose').addEventListener('click', closePanels); $('eClose').addEventListener('click', closePanels); document.querySelectorAll('.pcl').forEach(function (b) { b.addEventListener('click', closePanels); });
$('wPlain').addEventListener('click', function () { pickWear(0); }); $('wBow').addEventListener('click', function () { pickWear(1); });
$('wRain').addEventListener('click', function () { if (rainOk()) { save.unlocks.rainOff = rainOn() ? 1 : 0; persist(); refreshWear(); } });
$('wCrown').addEventListener('click', function () { if (save.unlocks.crown) { save.unlocks.crownOff = wearsCrown() ? 1 : 0; persist(); refreshWear(); } });
$('wBunch').addEventListener('click', function () { if (bunchOk()) { save.unlocks.bunchOff = bunchOn() ? 1 : 0; persist(); refreshWear(); } });
$('mClose').addEventListener('click', closePanels); $('pcFight').addEventListener('click', function () { if (fightNext()) { save.unlocks.pcfOff = save.unlocks.pcfOff ? 0 : 1; persist(); refreshChal(); } });
$('chClose').addEventListener('click', closePanels); $('bChal').addEventListener('click', function () { if (state === 'title') openPanel(pChal); });
$('wFlags').addEventListener('click', function () { if (save.unlocks.flags) { save.unlocks.flagsOff = flagsOn() ? 1 : 0; persist(); refreshWear(); } });

$('bHelp').addEventListener('click', function () { openPanel(pHelp); });
$('bSave').addEventListener('click', function () { openPanel(pSave); });
$('hClose').addEventListener('click', closePanels);
$('sClose').addEventListener('click', closePanels);
$('bCopy').addEventListener('click', copyCode);
$('bDown').addEventListener('click', downloadFile);
$('bLoadCode').addEventListener('click', function () { stage1Load(codeEl.value); });
$('bLoadFile').addEventListener('click', function () { fileEl.value = ''; holdForDialog(); fileEl.click(); });
fileEl.addEventListener('change', function () {
  var f = fileEl.files && fileEl.files[0]; if (!f) return;
  if (f.size > 100000) { say('That file is too big to be a Fancy, the Banana save.'); return; }
  f.text().then(stage1Load, function () { say('The file could not be read.'); });
});
bConfirm.addEventListener('click', applyLoaded);
$('bOld').addEventListener('click', putOldBack);
codeEl.addEventListener('input', function () { pending = null; bConfirm.hidden = true; });

/* ===== Game state ===== */
var state = 'title';   // title, ready, launch, play, paused, dead
var obs, score, stage, runTime, runFlaps, runStartBest, newBest;
var clk = 0, clkSp = [];   // the run timer (starts when the countdown ends; stops while paused) and the split times at stage clears, bonus games and bosses
var runSecs = 0, runPauses = 0, runHurts = 0, runFriends0 = 0, runPops = 0, runPopsOf = 0, VS = null;   // this run's story for the victory card: seconds flown, pauses, hits taken, friends at the start, balloons popped
var by, vy, bx = CFG.bananaX, angle, flapAnim, time = 0, grace = 0, deadT = 0, fallD = 0, hurtT = 0;   // fallD: how far he has dropped since his last flap (a long drop makes him grit his teeth); hurtT: a short grit after a boing
var dist = 0, spawned = 0, lastC = 0, nextX = 0;
var bgTheme = 0, bgFrom = 0, bgT = 1, washA = 0;   // washA: a white wash over everything, for the move into the water bonus
var celT = 0;   // the one celebration roll after a stage clear (counts down)
var ftStill = 0, crowd = { m: 0, p: 0, t: 9, time: 0 };   // the Gorilla Guard's arena: ftStill eases the world to a stop (0 to 1); crowd is what the spectators are doing
var rsgT = -1, rsgGo = false, rsgTap = false, rsgWait = false, rsgK = 1, tapWaitOn = true;   // Ready, Set, Go after every stage: Fancy floats on his own (rsgT counts up from the stage clear), then control comes back at GO
var cardT = -1, cardStage = 0, cardY = 125, cardGoal = 125, topT = 0;       // cardT below 0 means no stage card is showing
var titleT = 0, TTL = null, TTLK = 0, tapPic = null, launchT = 0, trackX = 60, trackOn = true, boost = 0, boostT = 99, pendNext = '', nextT = 0, vicT = 0, MG = null, keys = {}, tickW = null, tickSum = 0;
var runChal = '', runCoins = 0, streak = 0, bestStreak = 0, pops = [], trail = [], trailAcc = 0, wind = [], flashT = 0, zoomK = 1, zoomX = 180, gazeS = 0, lastAfter = 0, scrollDX = 0, curSpeed = 0, sparkT = 0;
var fx = [], fxFree = [], fxMax = 70, frng = mulberry32(12345), punchT = 0, whooshT = 0, shield = 0, bngT = 0, invuln = 0, spinT = 0, gardenD0 = 0;   // sparks and confetti, camera punch, the WHOOSH word, bonk shield

function longOn() { return save.stats.wins >= CFG.longAfter; }   // from the fifth win on, the stages after the water level are 15 gates long
function gpsOf(st) { return st > ART.order.indexOf(CFG.miniAfter) + 1 && longOn() ? CFG.gatesLong : CFG.gatesPerStage; }
function gateStart(st) { var n = 0, i; for (i = 1; i < st; i++) n += gpsOf(i); return n; }   // how many gates come before stage st
function stageOfGate(g) { var st = 1; while (g >= gateStart(st + 1)) st++; return st; }
function themeOf(st) { return ART.order[(st - 1) % ART.order.length]; }
function easy(st) { return Math.max(0, CFG.easyStages + 1 - st) / CFG.easyStages; }   // 1 in stage 1, 0.5 in stage 2, 0 from stage 3 on
function gapFor(st) { var g = Math.max(CFG.gapMin, CFG.gap0 - CFG.gapStep * (st - 1)) + CFG.easyGap * 2 * easy(st) + 5 * lvl('roomy'); return runChal === 'tiny' ? Math.round(g * 0.8) : g; }
function plusK() { return 1 + CFG.plusStep * Math.min(CFG.plusMax, save.stats.plus || 0); }   // each victory where the player keeps their stuff makes every later run 10% faster, up to double
function speedFor(st) { return (Math.min(CFG.speedMax, CFG.speed0 + CFG.speedStep * (st - 1)) - CFG.easySpeed * 2 * easy(st)) * relaxK() * plusK(); }   // Relaxed mode: 80% of the speed
function setBar(on) { bar.hidden = !on; bar2.hidden = !on; if (on) syncUp(); else $('bCont').hidden = true; }
function fxAdd(x, y, vx, vy, l, c, sz, st, g) {   // a spark from the pool: dead ones are reused, so flying confetti makes no garbage
  var q = fxFree.pop() || {}; q.x = x; q.y = y; q.vx = vx; q.vy = vy; q.l = l; q.t = 0; q.c = c; q.s = sz; q.st = st; q.g = g; fx.push(q);
}
function burst(x, y, n, cols, sp, g) { if (calmOn()) n = Math.ceil(n * 0.5); for (var i = 0; i < n && fx.length < fxMax; i++) { var a = frng() * 6.283, v = sp * (0.3 + frng()); fxAdd(x, y, Math.cos(a) * v, Math.sin(a) * v - sp * 0.3, 0.6 + frng() * 0.5, cols[i % cols.length], 2 + frng() * 3, frng() < 0.45, g); } }
var CRF = { willReadFrequently: true };   // cached pictures stay in plain memory, never graphics-card textures (see art.js RF)
var smk = [], smkPics = null;   // the Wafer Cannon's smoke: a few soft puffs that rise and spread out of the barrel's dark mouth
var smkMz = null, smkEm = 0, smkEa = 0;   // where the barrel's mouth was last frame: fresh puffs ride along with it for a moment, so the smoke trails from the cannon instead of hanging in mid air
function cannonSmoke(x, y) {
  var n = calmOn() ? 7 : 12, i; smkMz = { x: x, y: y }; smkEm = 0.6; smkEa = 0;
  for (i = 0; i < n && smk.length < 40; i++) smk.push({ x: x - 3 + frng() * 5, y: y + (frng() - 0.5) * 7, vx: -(50 + frng() * 110), vy: -(26 + frng() * 56), r0: 6 + frng() * 4, r1: 26 + frng() * 20, l: 1.3 + frng() * 0.9, t: -i * 0.045 });
}
function smkMake(c0, c1) { var c = document.createElement('canvas'), g; c.width = c.height = 64; g = c.getContext('2d', CRF); var gr = g.createRadialGradient(26, 26, 2, 32, 32, 31); gr.addColorStop(0, c0); gr.addColorStop(0.72, c1); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 31, 0, 6.2832); g.fill(); return c; }
function drawSmoke() {
  var i, q, u, r, a;
  if (!smk.length) return;
  if (!smkPics) smkPics = [smkMake('rgba(70,62,84,1)', 'rgba(88,80,102,.92)'), smkMake('rgba(246,243,250,1)', 'rgba(226,220,236,.9)')];
  for (i = 0; i < smk.length; i++) {
    q = smk[i]; if (q.t < 0) continue; u = q.t / q.l; r = q.r0 + (q.r1 - q.r0) * (1 - (1 - u) * (1 - u)); a = 0.85 * Math.pow(1 - u, 1.2);
    ctx.globalAlpha = a * (1 - Math.min(1, u * 1.5)); if (ctx.globalAlpha > 0.01) ctx.drawImage(smkPics[0], q.x - r, q.y - r, r * 2, r * 2);
    ctx.globalAlpha = a * Math.min(1, u * 1.5); if (ctx.globalAlpha > 0.01) ctx.drawImage(smkPics[1], q.x - r, q.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}

/* The launch track (drawn live in art.js: a huge loop-de-loop). Fancy rides the flat run-up, loops the big ring, and leaves up the ramp.
   Numbers are in the track's own units: ART.TK holds the ring; the camera slides sideways during the loop so the whole ring stays on screen. */
var TKS = ART.TK, LP = { x0: 60, x1: TKS.cx, x2: TKS.cx + 70, rb: TKS.rb, cy: TKS.cy, fy: TKS.cy + TKS.rb };
var LOOPLEN = 2 * Math.PI * LP.rb, FLAT1 = LP.x1 - LP.x0, FLAT2 = LP.x2 - LP.x1, RAMPL = 150, LTOT = FLAT1 + LOOPLEN + FLAT2 + RAMPL;
function ss(v) { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); }
function anchorX(s) { return CFG.bananaX + 80 * (ss((s - (FLAT1 - 130)) / 150) - ss((s - FLAT1 - LOOPLEN) / (FLAT2 + 90))); }   // where on screen the track's progress point sits: slides right into the loop and back out
function pathAt(s) {   // where Fancy is after riding s units along the track: x, y, tilt, and X (how far along the track, ignoring the loop's swing)
  var f, t, u, dx, dy;
  if (s < FLAT1) return { x: LP.x0 + s, y: LP.fy, r: 0, X: LP.x0 + s };
  s -= FLAT1;
  if (s < LOOPLEN) { f = s / LP.rb; return { x: LP.x1 + LP.rb * Math.sin(f), y: LP.cy + LP.rb * Math.cos(f), r: -f, X: LP.x1 }; }
  s -= LOOPLEN;
  if (s < FLAT2) return { x: LP.x1 + s, y: LP.fy, r: 0, X: LP.x1 + s };
  t = Math.min(1, (s - FLAT2) / RAMPL); u = 1 - t;   // ramp: a curve from the flat up into the sky
  dx = 140 * u + 120 * t; dy = -170 * t;
  var X = u * u * LP.x2 + 2 * u * t * (LP.x2 + 70) + t * t * (LP.x2 + 130);
  return { x: X, y: LP.fy - 85 * t * t, r: Math.atan2(dy, dx), X: X };
}
function trailStep(dt, dx) {   // the glowing ribbon behind Fancy: remember where he was, and slide the memories along with the world
  var i;
  for (i = 0; i < trail.length; i++) { trail[i].t += dt; trail[i].x += dx; }
  while (trail.length && trail[0].t > 0.5) trail.shift();
  trailAcc += dt; if (trailAcc >= 1 / 60) { trailAcc = 0; trail.push({ x: bx, y: by, t: 0 }); if (trail.length > (qLvl >= 1 ? 24 : 40)) trail.shift(); }
}
function windStep(dt) {
  var i, w;
  if (!wind.length) for (i = 0; i < 14; i++) wind.push({ x: frng() * W, y: 50 + frng() * 480, l: 26 + frng() * 50, v: 0.6 + frng() * 0.8 });
  for (i = 0; i < wind.length; i++) { w = wind[i]; w.x -= (curSpeed * 1.15 + 90) * w.v * dt; if (w.x < -120) { w.x = W + 10 + frng() * 90; w.y = 50 + frng() * 480; } }
}
function gazeTarget() {   // Fancy looks toward the middle of the next gap
  for (var i = 0; i < obs.length; i++) if (!obs[i].passed) return clamp(((obs[i].gt + obs[i].gb) / 2 - by) / 80, -1, 1);
  return 0;
}
function pop(txt, col, sz) {   // a word that floats up from Fancy: a new one never lands on top of one still readable, it stacks above it (or below when there is no room at the top)
  sz = sz || 22; var w = txt.length * sz * 0.56, x = clamp(mx(bx) + (flipSX() < 0 ? -34 : 34), Math.max(70, w / 2 + 8), Math.min(W - 70, W - w / 2 - 8)), y0 = mirY(by) - 40, y = y0, dir = -1, i, q, n = 0, hit, yy, y2 = 0;
  do {
    hit = false;
    for (i = 0; i < pops.length; i++) { q = pops[i]; if (q.t < 0.95 && Math.abs(q.x - x) < (w + q.w) / 2 + 4 && Math.abs(q.y - y) < (sz + q.sz) * 0.62) { yy = dir < 0 ? q.y - (sz + q.sz) * 0.62 - 1 : q.y + (sz + q.sz) * 0.62 + 1; if (!hit || (dir < 0 ? yy < y2 : yy > y2)) y2 = yy; hit = true; } }
    if (hit) y = y2;
    if (hit && dir < 0 && y < 130) { dir = 1; y = y0; }
  } while (hit && ++n < 8);
  pops.push({ txt: txt, col: col, sz: sz, w: w, t: 0, x: x, y: clamp(y, 100, GROUND_Y - 30) }); if (pops.length > 6) pops.shift();
}
function giveCoins(n, x, y) { runCoins += n; if (!pracN) save.stats.coins += n; burst(x, y, 8 + n * 3, ['#ffd93b', '#fff2a0', '#ffffff'], 150, 140); }
function clearance(o) {   // how far Fancy is from touching this obstacle (px between his circle and the nearest hit box)
  var m = 1e9, i, r, nx, ny, d;
  for (i = 0; i < o.rects.length; i++) { r = o.rects[i]; nx = clamp(CFG.bananaX, o.x + r[0], o.x + r[0] + r[2]); ny = clamp(by + 1, r[1], r[1] + r[3]); d = Math.sqrt((CFG.bananaX - nx) * (CFG.bananaX - nx) + (by + 1 - ny) * (by + 1 - ny)) - CFG.bananaR; if (d < m) m = d; }
  return m;
}
function rateGate(o) {   // called as Fancy clears a gate: perfect (through the middle), or a close call (skimmed an edge)
  if (o.kg) return;   // gates he glided through with Potassium Power count for nothing extra (and cost nothing either)
  var cy = (o.gt + o.gb) / 2, gap = o.gb - o.gt, y = by;
  if (o.mid && Math.abs(o.yAt - cy) < gap * CFG.perfectFrac * (1 + 0.25 * lvl('sweet'))) {
    streak++; if (streak > bestStreak) bestStreak = streak; giveCoins(1 + lvl('golden'), CFG.bananaX, y);
    if (streak === 10 && !pracN && !rainOk()) { save.stats.streak = 10; persist(); refreshWear(); pop('RAINBOW TRAIL unlocked!', '#ff8ad8', 24); pop('Turn it off in Settings', '#ffffff', 16); burst(CFG.bananaX + 30, y, 30, ['#ff6b81', '#ffd93b', '#7be07b', '#7ad8ff', '#b78cff'], 280, 280); }   // the secret is announced the moment it is earned (it used to switch on silently at the end of the run)
    if (streak % CFG.streakEvery === 0) { giveCoins(CFG.streakBonus + lvl('golden'), CFG.bananaX, y); burst(CFG.bananaX + 30, y, 26, ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'], 260, 260); pop('STREAK x' + streak + '!', '#ff8ad8', 26); }
    else pop(streak > 1 ? 'PERFECT x' + streak : 'PERFECT!', '#ffd93b', 22);
  } else {
    streak = 0; goldNext = CFG.goldStreak;
    if (o.cc < CFG.closeCall + 3 * lvl('dare')) { giveCoins(1, CFG.bananaX, y); burst(CFG.bananaX + 10, y, 14, ['#7ad8ff', '#ffffff'], 200, 200); pop('Close call!', '#7ad8ff', 22); }
  }
}
var contN = 0;
function continueRun() { var n = save.cont.st; if (!(n > 1) || state !== 'title') return; contN = n; closePanels(); ART.warm(themeOf(n)); toReady(); toast('Carrying on from stage ' + n + '. Tap to launch!', 3500); }
function resetWorld() {
  var ci = pracN ? 0 : chalIdx(); runChal = ci ? CHAL[ci - 1][0] : ''; nightA = 0; FT = null; runFight = !pracN && fightOn() ? fightNext() : 0; fWarmed = 0;
  kReset(); ftStill = 0; crowd.m = crowd.p = 0; crowd.t = 9; windUsed = false; resT = -1; wasCtrl = true; tapFx.length = 0; obs = []; score = 0; stage = 1; runTime = 0; runFlaps = 0; spawned = 0; dist = 0; BAL = null; BALR = null; fl.length = 0; shd.length = 0; 
  clk = 0; clkSp = []; runSecs = runPauses = runHurts = runPops = runPopsOf = 0; runFriends0 = save.stats.friends; VS = null;
  lastC = GROUND_Y * 0.45; by = CFG.launchY; vy = 0; bx = CFG.bananaX; angle = 0; flapAnim = 0; grace = 0; fallD = 0; hurtT = 0;
  if (pracN) { stage = pracN; spawned = score = gateStart(pracN); }
  if (contN > 1 && !pracN) { stage = contN; spawned = score = gateStart(contN); contN = 0; }   // Continue: carry on from the stage the closed tab had reached
  pracEnd = ''; bgTheme = bgFrom = themeOf(stage); bgT = 1; newBest = false; runStartBest = bestOf();
  cardT = -1; topT = 0; pendNext = ''; nextT = 0; washA = 0; MG = null; rsgT = -1; celT = 0; launchT = 0; trackX = CFG.bananaX - LP.x0; trackOn = true; boost = 0; boostT = 99; fx.length = 0; smk.length = 0; punchT = whooshT = invuln = spinT = gardenD0 = 0; shield = lvl('shield'); bngT = 0;
  ART.keep([bgTheme, themeOf(stage + 1)]);
  runCoins = 0; streak = 0; bestStreak = 0; goldNext = CFG.goldStreak; VAULT = null; hugT = 0; hugKind = ''; pops.length = 0; trail.length = 0; flashT = 0; lastAfter = 0; scrollDX = 0; curSpeed = 0;
  spawnOb(W + CFG.firstGate);   // the first obstacle waits far out: the blast off flies faster than normal for a moment
}
function o_lo(c, gap) { return c - gap * 0.3; }
function obRects(o) {
  var i, r; o.rects = ART.rects(o);
  for (i = 0; i < o.rects.length; i++) { r = o.rects[i]; if (r[1] <= 0) { r[1] -= 1000; r[3] += 1000; } }   // top obstacles reach up past the screen edge, so flying over them does not work
  if (o.waf) o.rects.push([o.waf.dx - 13, o.waf.y - 13, 26, 26]);
}
function obMove(o, dt) {   // a moving gate: still while it is off the screen, then every few seconds it eases in and out of its move (a smooth hump, then a rest)
  var m = o.mv, u, d, h;
  if (o.smash) return;   // a smashed gate stays gone
  if (o.x > W - 20 || o.x < -CFG.obW) return; m.t += dt; u = ((m.t + m.ph) % m.per) / m.per; h = u < m.win ? Math.sin(Math.PI * u / m.win) : 0; d = m.amp * h * h * (3 - 2 * h);
  if (Math.abs(d - m.d) < 0.04) return; m.d = d; o.gt = o.gt0 + d; if (m.k === 2) o.gb = o.gb0 - d; obRects(o);
}
function spawnOb(x) {
  var gs = stageOfGate(spawned), gap = gapFor(gs), i, r;
  var lo = CFG.minObH + gap / 2, hi = GROUND_Y - CFG.minObH - gap / 2;
  var pc = lastC, c = clamp(lastC + (rng() * 2 - 1) * CFG.maxShift, lo, hi);
  if (spawned > 0 && spawned === gateStart(gs)) c = clamp(CFG.rsgY + (rng() * 2 - 1) * 25, lo, hi);   // the first gate after a stage break opens right where Fancy waits, so GO never starts with a scramble
  if (spawned <= gateStart(gs)) kRunN = 0;   // a lane run never carries over a stage break
  if (lvl('potassium') && !BAL && !fightStage(gs) && spawned > gateStart(gs)) {   // with Potassium Power, now and then a few gates in a row line up (so the move has something to ride)
    if (kRunN > 0) { kRunN--; c = clamp(kRunC + (rng() * 2 - 1) * 13, lo, hi); }
    else if (rng() < 0.2) { kRunN = 2; kRunC = lastC; c = clamp(kRunC + (rng() * 2 - 1) * 13, lo, hi); }
  }
  var fi = huntOn() && !runChal && !pracN && gs <= 6 && !frFound(gs - 1) ? spawned - gateStart(gs) : -1;
  if (fi >= 4 && fi <= 6) c = clamp(clamp(gs % 2 ? lo + (fi > 4 ? rng() * 12 : 0) : hi - (fi > 4 ? rng() * 12 : 0), pc - CFG.maxShift, pc + CFG.maxShift), lo, hi);   // a lost friend hides in this stage: the two gates either side of his spot sit at the far edge on his side (high up for a top-corner friend, low down for a floor friend) and the gates before them step toward it. Tried with the game's own physics: from there he can be reached at six taps a second, even with the speed bonus
  lastC = c;
  var o = { x: x, gs: gs, th: themeOf(gs), gt: c - gap / 2, gb: c + gap / 2, kt: Math.floor(rng() * 4), kb: Math.floor(rng() * 4), col: Math.floor(rng() * 4), passed: false, after: CFG.spacing, cc: 1e9, mid: false, yAt: 0, coins: [{ dx: CFG.obW / 2, y: clamp(c + (rng() * 2 - 1) * gap * 0.2, o_lo(c, gap), c + gap * 0.3), got: false, ph: rng() * 3 }] };
  if (spawned > 0 && lastAfter === CFG.spacing) {
    o.coins.push({ dx: CFG.obW / 2 - CFG.spacing / 2, y: (pc + c) / 2, got: false, ph: rng() * 3 });   // a coin halfway between two gates, on the way
    if (runChal === 'storm' && spawned > gateStart(gs)) o.waf = { dx: CFG.obW / 2 - CFG.spacing / 2, y: clamp((pc + c) / 2 + (rng() < 0.5 ? -92 : 92), 52, GROUND_Y - 52) };   // Wafer storm: a vanilla wafer floats in the open air, clear of the line between the two gaps
  }
  // the last gate of a stage is followed by a long empty stretch (the breather) so the stage card never lands on a danger
  if (spawned + 1 === gateStart(gs + 1)) o.after += speedFor(gs + 1) * (CFG.breathSecs + (runSec() ? CFG.hugExtra : 0));   // from the second playthrough the quiet stretch is a little longer: room for the hidden rooms
  if (runSec() && !pracN && streak >= goldNext && spawned > gateStart(gs) && spawned + 1 < gateStart(gs + 1)) { o.gold = true; goldNext = streak + CFG.goldStreak; }   // a long PERFECT streak turns a gate gold
  if (huntOn() && !runChal && !pracN && gs <= 6 && spawned - gateStart(gs) === 6 && !frFound(gs - 1)) o.fr = { i: gs - 1, dx: CFG.obW / 2 - CFG.spacing / 2, y: gs % 2 ? 34 : GROUND_Y - 40, got: false };   // a lost friend, halfway between two gates, right up in the corner or down by the floor
  lastAfter = o.after; obRects(o);
  if ((o.th === 4 || o.th === 5) && !pracN && relaxK() >= 1 && !BAL) { var hf = (spawned * 0.618034 + 0.31) % 1, pr0 = 2.3 + 0.9 * ((spawned * 0.381966 + 0.17) % 1), wn = 0.4; o.gt0 = o.gt; o.gb0 = o.gb; o.mv = { k: o.th === 4 ? 1 : 2, amp: o.th === 4 ? 20 : 13, per: pr0, win: wn, t: 0, ph: pr0 * (wn + 0.06 + hf * (0.94 - wn - 0.06)), d: 0 }; }   // after the water level the gates start to move: the hanging vines of the Fruit Garden dip down now and then; in the Jungle Kingdom the roof and the floor pieces both close in a little (always starting from rest, and only once the gate is on the screen)
  obs.push(o); spawned++; nextX = x + o.after;
}

function bd(th) { return th === ART.journeyTheme ? Math.max(0, dist - gardenD0) : dist; }   // the garden's backdrop is one long journey from the beach to the jungle, so it counts from where that stage began
function boingV(mid) { var d = mid - by; return d < 0 ? -Math.min(560, Math.sqrt(2 * CFG.gravity * -d) + 40) : -120; }   // the free bounce springs Fancy just far enough to reach the middle of the gap (a hit from the top pillar used to fire him down at 520 px/s, through the gap and into the floor)
function boing(v) { bngT = 1; runHurts++; invuln = 1.3; hurtT = 0.9; fallD = 0; vy = v; flapAnim = 0.18; burst(CFG.bananaX, by, 28, ['#8ae28a', '#ffffff', '#ffd93b'], 240, 200); pop('BOING!', '#7be07b', 26); }
function flap() { vy = CFG.flapV; flapAnim = 0.18; runFlaps++; fallD = 0; if (empWorn(E.confetti)) burst(bx - 10, by + 8, 7, ['#ff6b81', '#ffd93b', '#7ad8ff', '#8ae28a', '#c9a0ff'], 150, 220); }

/* ===== Potassium Power! (upgrade). Hold Space or the mouse while 3+ gates line up (their openings within 40 px of each other): Fancy charges up, glides straight through
   the lane and flies up to 25% faster, leaving fading echoes of himself. Not in the water level, boss fights, the balloon stage or the vault. */
var kHeld = { ptr: false, key: false, pad: false }, kHoldT = 0, kOn = false, kCh = 0, kLane = null, kAvail = null, kEcho = [], kEchoT = 0, kRunN = 0, kRunC = 0, kHint = 0, kBy0 = 0;
function kHolding() { return kHeld.ptr || kHeld.key || kHeld.pad; }
function fightStage(g) { return !!runFight && themeOf(g) === CFG.finalTheme; }   // Potassium (both kinds) works in every stage except the last one of a run that ends in a boss fight
function kOk() { return lvl('potassium') > 0 && state === 'play' && !BAL && !FT && !VAULT && !fightStage(stage) && spinT <= 0 && !rsgHold() && (grace <= 0 || sKon) && !MG; }
function kLook() {   // how far ahead gates are made: with the upgrade, enough of them are in place to see a lane coming (never past the end of a stage, and not near the boss)
  if (!lvl('potassium') || BAL || FT || fightStage(stage) || stageOfGate(spawned) !== stage) return 0;
  if (themeOf(stage) === CFG.finalTheme && spawned >= gateStart(stage + 1) - 4) return 0;
  return 2 * CFG.spacing;
}
function kCenter(o) { return (o.gt + o.gb) / 2; }
function kLaneFind() {   // the gates ahead, from the first one he has not cleared: 3 or more in a row whose openings stay within 40 px of each other
  var L = [], i, o, c, lo = 0, hi = 0;
  for (i = 0; i < obs.length; i++) {
    o = obs[i]; if (o.passed) continue;
    c = (o.gt0 !== undefined ? o.gt0 + o.gb0 : o.gt + o.gb) / 2;
    if (o.gold || (L.length && (o.gs !== L[0].gs || Math.max(hi, c) - Math.min(lo, c) > 40))) break;
    if (!L.length) lo = hi = c; else { lo = Math.min(lo, c); hi = Math.max(hi, c); }
    L.push(o);
  }
  return L.length >= 3 ? L : null;
}
function kReach(L) {   // can he get to the first opening in time (the glide eases in; he must not be asked to cross a wall to start)?
  var o = L[0], d = Math.abs(kCenter(o) - by), tg = Math.max(0, o.x - CFG.bananaX - CFG.bananaR) / Math.max(60, curSpeed), t1, e;
  if (d > 68) { t1 = (d - 68) / 540; e = tg <= t1 ? d - 540 * tg : 68 * Math.exp(-8 * (tg - t1)); } else e = d * Math.exp(-8 * tg);
  return e < (o.gb - o.gt) / 2 - CFG.bananaR - 8;
}
var sKpop = -9;
function kSmash() {   // Super Potassium: every gate Fancy touches while blasting breaks apart (and counts as passed, for nothing extra)
  var i, o, n = 0;
  for (i = 0; i < obs.length; i++) {
    o = obs[i]; if (o.smash || o.passed || o.x > CFG.bananaX + CFG.bananaR + 10 || o.x + CFG.obW < CFG.bananaX - CFG.bananaR) continue;
    o.smash = time; o.kg = true; o.rects = []; n++;
    burst(o.x + CFG.obW / 2, o.gt - 16, 16, ['#ffffff', '#ffe27a', '#ff9a3c', '#c98a3c'], 300, 240); burst(o.x + CFG.obW / 2, o.gb + 16, 16, ['#ffffff', '#ffe27a', '#ff9a3c', '#c98a3c'], 300, 240);
  }
  if (n) { punchT = CFG.punchSecs * 0.5; if (time - sKpop > 0.5) { sKpop = time; pop('SMASH!', '#ffe27a', 24); } }
}
function kEnd() { kOn = false; kLane = null; grace = 0.2; vy = clamp(vy, -120, 120); }
function kStep(dt) {   // runs once per step while flying; returns the speed multiplier
  var ok = kOk(), i, o, a = null, b = null, u, tgt, mv, k;
  if (kHolding() && state === 'play') { if (kHoldT === 0) sKarm = !kOn && !sKon && !(ok && (kAvail = kLaneFind()) && kReach(kAvail)); kHoldT += dt; } else kHoldT = 0;
  if (sKon) {
    sKt -= dt; if (!ok || sKt <= 0) { sKon = false; sKused = sKst; invuln = Math.max(invuln, 0.7); grace = 0.2; vy = clamp(vy, -120, 120); if (ok) pop('Phew!', '#ffe27a', 18); } else { by = clamp(by, 70, GROUND_Y - 70); kBy0 = by; vy = 0; fallD = 0; angle = 0; grace = Math.max(grace, 0.05); invuln = Math.max(invuln, 0.08); }
  } else if (ok && !kOn && sKarm && kHoldT >= 0.55 && empOwn(E.superK) && sKused !== stage) { sKon = true; sKt = 2.6; sKst = stage; sKarm = false; sKused = 0; kEchoT = 0; pop('SUPER POTASSIUM!', '#ffe27a', 26); burst(CFG.bananaX, by, 30, ['#ffe27a', '#ffffff', '#fff2a0', '#ff9a3c'], 300, 220); punchT = CFG.punchSecs; }
  if (ok && !kOn && !sKon) {
    kAvail = kLaneFind(); if (kAvail && !kReach(kAvail)) kAvail = null;
    if (kAvail && kHoldT >= 0.15) { kOn = true; kLane = kAvail; for (i = 0; i < kLane.length; i++) kLane[i].kg = true; kEchoT = 0; pop('POTASSIUM POWER!', '#ffe27a', 22); burst(CFG.bananaX, by, 16, ['#ffe27a', '#ffffff', '#fff2a0'], 220, 180); }
  } else if (!ok) kAvail = null;
  if (kOn) {
    if (!ok || !kHolding()) kEnd();
    else {
      for (i = 0; i < kLane.length; i++) if (!kLane[i].passed) { if (!a) a = kLane[i]; else { b = kLane[i]; break; } }
      if (!a) kEnd();
      else {
        tgt = kCenter(a);
        if (b) { u = clamp((bx - (a.x + CFG.obW / 2)) / (b.x - a.x), 0, 1); tgt += (kCenter(b) - tgt) * u * u * (3 - 2 * u); }
        mv = clamp((tgt - kBy0) * 8 * dt, -540 * dt, 540 * dt); by = kBy0 + mv; vy = mv / dt; fallD = 0; angle = clamp(vy / 700, -0.5, 1.1);
      }
    }
  }
  sKch = clamp(sKch + (sKon ? dt / 0.35 : -dt / 0.4), 0, 1);
  kCh = clamp(kCh + (kOn || sKon ? dt / 0.6 : -dt / 0.45), 0, 1); k = kCh * kCh * (3 - 2 * kCh);
  for (i = 0; i < kEcho.length; i++) { kEcho[i].t += dt; kEcho[i].x -= curSpeed * dt; }
  while (kEcho.length && kEcho[0].t > 0.5) kEcho.shift();
  if (kCh > 0.12) { kEchoT -= dt; if (kEchoT <= 0) { kEchoT = 0.07; kEcho.push({ x: bx, y: by, r: angle, t: 0, k: k }); if (kEcho.length > (qLvl >= 1 ? 4 : 7)) kEcho.shift(); } }
  kHint += ((kAvail && !kOn ? 1 : 0) - kHint) * Math.min(1, dt * 8);
  return (1 + 0.25 * k) * (1 + 0.7 * sKch * sKch * (3 - 2 * sKch));
}
var sKon = false, sKt = 0, sKch = 0, sKused = 0, sKst = 0, sKarm = false;   // Super Potassium: blasting now, seconds left, the blast's ramp (0 to 1), the stage it was last used in, and whether this hold began away from a gate lane
function kReset() { sKon = false; sKt = 0; sKch = 0; sKused = 0; sKarm = false; kOn = false; kCh = 0; kHoldT = 0; kLane = null; kAvail = null; kEcho.length = 0; kRunN = 0; kHint = 0; }
function kEchoes() {   // fading copies of Fancy, left behind where he was: they stay in the world, so the faster he goes the further apart they sit
  for (var i = 0; i < kEcho.length; i++) { var e = kEcho[i]; ctx.globalAlpha = 0.6 * e.k * (1 - e.t / 0.5); drawFancy(e.x, e.y, e.r, 1); }
  ctx.globalAlpha = 1;
}
function kRing(ey) {   // the potassium meter, filling in a ring around Fancy
  if (!kOn && kCh <= 0.02) return;
  var r = 27, f = kCh, full = f >= 0.999, pu = full ? 0.5 + 0.5 * Math.sin(time * 24) : 1;
  ctx.lineCap = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(58,42,77,0.7)'; ctx.beginPath(); ctx.arc(bx, by + ey, r, -Math.PI / 2, -Math.PI / 2 + 6.2832 * f); ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = full ? (pu > 0.5 ? '#ffffff' : '#ffe27a') : '#ffd93b'; ctx.stroke(); ctx.lineCap = 'butt';
}
function drawSuperK(ey, f) {   // the blast: a hot glow and speed streaks round Fancy (or, while the hold is building, a ring that fills)
  var i, g, r;
  if (f !== undefined) { ctx.lineCap = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(58,42,77,0.7)'; ctx.beginPath(); ctx.arc(bx, by + ey, 33, -Math.PI / 2, -Math.PI / 2 + 6.2832 * clamp(f, 0, 1)); ctx.stroke(); ctx.lineWidth = 3.4; ctx.strokeStyle = '#ff9a3c'; ctx.stroke(); ctx.lineCap = 'butt'; return; }
  r = 44 + Math.sin(time * 30) * 3; g = ctx.createRadialGradient(bx, by + ey, 4, bx, by + ey, r); g.addColorStop(0, 'rgba(255,240,170,' + (0.8 * sKch) + ')'); g.addColorStop(0.5, 'rgba(255,154,60,' + (0.45 * sKch) + ')'); g.addColorStop(1, 'rgba(255,154,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by + ey, r, 0, 6.2832); ctx.fill();
  if (!calmOn()) { ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * sKch) + ')'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; for (i = 0; i < 6; i++) { var yy = by + ey - 30 + i * 12 + Math.sin(time * 40 + i) * 3, xx = bx - 30 - ((time * 900 + i * 53) % 90); ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx - 26, yy); ctx.stroke(); } ctx.lineCap = 'butt'; }
}
function drawKHint() {
  if (kHint < 0.05) return;
  ctx.globalAlpha = Math.min(1, kHint); outlined('Hold: Potassium Power!', W / 2, GROUND_Y - 26 + Math.sin(time * 6) * 2, 15, '#ffe27a'); ctx.globalAlpha = 1;
}
var fWarmed = 0;
function warmFight() { if (!runFight || fWarmed === runFight) return; fWarmed = runFight; ART.fightWarm(runFight); ART.mg.sprite('wafer'); }   // the boss's pictures (and the gorilla's arena) are only built once the player reaches the last stage: most runs end long before
var contRun = false, gatesCounted = 0;   // a paid continue is the same attempt: its runs and gates are counted once
function toReady() { contRun = false; gatesCounted = 0; resetWorld(); usePerks(); backStage = pracN ? 0 : 2 + Math.floor(Math.random() * 3); flipV = flipWant(); state = 'ready'; setBar(false); if (runChal === 'storm') ART.mg.sprite('wafer'); }
function rsgGoAt() { return CFG.cardSecs + CFG.rsgBeat * 2; }   // seconds after the stage clear when control comes back
function rsgHold() { return (rsgT >= 0 && rsgT < rsgGoAt()) || !!(FT && FT.hold > 0); }
function startLaunch() { state = 'launch'; launchT = -CFG.countSecs; if (stage === 1 && save.cont.st) { save.cont = {}; persist(); } }   // a 3-2-1 countdown first, then the run
var wasCtrl = true, RES_SECS = 1.2, resT = -1, tapBufT = -9, tapFx = [];   // resume countdown (seconds left, -1 = none); when the last tap that could not flap happened; ripples where taps landed
function resume() { state = 'play'; grace = resT === -1 ? CFG.graceSecs : 0.1; resT = -1; vy = 0; }   // after a countdown the player is ready, so the hover is short
function beginResume() { if (resT < 0) resT = RES_SECS; }   // a tap on the paused game starts a 3-2-1 first
function tapRipple(x, y, ign) { if (tapFx.length > 3) tapFx.shift(); tapFx.push({ x: x, y: y, t: 0, ign: ign }); }
function tapIgnored() { return (state === 'play' && (spinT > 0 || (rsgHold() && !rsgWait) || grace > 0)) || (state === 'paused' && resT >= 0) || (state === 'dead' && deadT < CFG.retryDelay); }
function skipLaunch() { return save.stats.runs >= 3 && state === 'launch' && launchT > -CFG.countSecs + 0.35 && launchT < CFG.launchSecs * 0.88; }   // from the 4th run on, a tap skips the loop (not in the first third of a second, so a double tap on Ready cannot skip it)
function startPracticeStage(n) { pracN = n; closePanels(); ART.warm(themeOf(n)); toReady(); }
function pracWin() {   // a practiced stage is finished: no card, no reward, just a choice
  state = 'dead'; deadT = CFG.retryDelay - 0.5; pracEnd = 'win'; vy = 0; angle = 0; rsgT = -1; celT = 0; pendNext = ''; nextT = 0; cardT = -1;
  burst(CFG.bananaX + 20, by, 36, ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'], 300, 340);
}
function rsgStartTap() {   // a tap during the wait starts Ready, Set, GO; a tap a moment into a card skips the rest of it
  if (!tapWaitOn || rsgT < 0 || rsgGo || rsgTap || pendNext) return false;
  if (rsgWait) { rsgTap = true; rsgWait = false; return true; }
  if (rsgT >= 0.7 && rsgT < CFG.cardSecs) { rsgT = CFG.cardSecs; rsgTap = true; cardT = -1; return true; }
  return false;
}
var exitAt = -1e9;   // when a secret game or practice was left: a double tap must not also start a run
function onAction() {
  if (panelOpen()) return;
  if (state === 'title') { if (performance.now() - exitAt > 400) toReady(); }
  else if (state === 'dead') { if (deadT >= CFG.retryDelay) { if (pracN) startPracticeStage(pracN); else toReady(); } }
  else if (state === 'ready') startLaunch();
  else if (state === 'launch') { if (skipLaunch()) { launchT = CFG.launchSecs * 0.88; trail.length = 0; } }
  else if (state === 'play') { if (rsgStartTap()) return; if (tapIgnored()) tapBufT = time; if (spinT <= 0 && !rsgHold()) flap(); }   // a tap that cannot flap yet is remembered for a moment
  else if (state === 'paused') { if (resT >= 0) tapBufT = time; else beginResume(); }
  else if (state === 'mini') miniTap();
  else if (state === 'sky') skyTap();
  else if (state === 'volc') volcTap();
  else if (state === 'gift') giftTap();
  else if (state === 'victory') victoryTap();
}
/*TEST_HOOK_START*/ var DIET = []; /*TEST_HOOK_END*/
var windUsed = false;
function secondWind() {   // the Second wind upgrade: once per run, a crash restarts the stage you are in, with a fresh Ready, Set, GO
  if (pracN || windUsed || !lvl('wind') || BAL || (FT && FT.ph !== 'wait')) return false;
  windUsed = true; FT = null; obs = []; spawned = score = gateStart(stage); by = CFG.rsgY; bx = CFG.bananaX; vy = 0; angle = 0; grace = 0; rsgT = CFG.cardSecs; rsgGo = false; rsgTap = false; cardT = -1; topT = 0; invuln = 0; fallD = 0; hurtT = 0; streak = 0; pendNext = ''; nextT = 0; celT = 0; lastAfter = 0;
  nextX = W + CFG.obW + speedFor(stage) * (rsgGoAt() - rsgT + 0.4); burst(CFG.bananaX, by, 30, ['#7ad8ff', '#ffffff', '#ffd93b'], 260, 260); pop('SECOND WIND!', '#7ad8ff', 28); return true;
}
/* ===== Secrets (build 2): hidden rooms open from the second playthrough, the lost-friend hunt from the third ===== */
var FR_NAMES = ['Pip', 'Specs', 'Wizzy', 'Dapper', 'Leafy', 'Lucky'], FR_V = [0, 1, 2, 3, 4, 0];   // the six lost friends and which look (hat, glasses...) each one wears
var SEC_KEYS = ['balloons', 'flags', 'wafers', 'vault', 'gold', 'drawer', 'raft', 'cove', 'boss', 'boom'];
function secretsOn() { return save.stats.wins >= 1; }
function runSec() { return secretsOn() && !runChal; }   // the hidden rooms stay shut during a challenge run
/* ===== Challenges (build 3a): optional ways to play, from the first win on. Beat the last stage in one to earn its badge, and a new scarf and mask color. ===== */
var CHAL = [['night', 'Night flashlight', 'The whole stage is dark. Your flashlight lights the way.'], ['tiny', 'Tiny gaps', 'Every opening is 20% smaller.'], ['storm', 'Wafer storm', 'Vanilla wafers float between the gates.'], ['mirror', 'Mirror', 'The whole world is upside down.']];
var SCARFS = [['Red', '#e22a40'], ['Blue', '#3d7bff'], ['Green', '#2fbf5f'], ['Orange', '#ff8a1f'], ['Violet', '#b45cff']], MASKS = [['Red', '#e22a40'], ['Navy', '#22337a'], ['Teal', '#12b3a6'], ['Purple', '#7a3fd0'], ['Gold', '#f2b81f']];
var nightA = 0, badgeNew = '';
function chalIdx() { var c = save.unlocks.chal; return secretsOn() && c >= 1 && c <= 4 ? c : 0; }
function badgeOf(i) { return !!save.unlocks['b_' + CHAL[i][0]]; }
function mirOn() { return runChal === 'mirror' && !BAL && (state === 'play' || state === 'paused' || state === 'dead' || state === 'launch' || state === 'ready'); }
function mirY(y) { return mirOn() ? H - y : y; }
/* The backward level: in one stage after the first and before the water level (Jam Jar Pantry, Ice Cream Parlor or Silverware Drawer, drawn by lot at the start of every run) the whole picture is turned left to right: Fancy flies at the right of the screen and everything comes toward him from the left. Only the drawing is turned, so the rules, the hit boxes and the controls do not change. When the stage changes the picture flips over like a card. */
var backStage = 0, flipV = 0;
function flipWant() { return backStage > 0 && stage === backStage && !pracN ? 1 : 0; }
// flipSX: the ready and launch screens of a backward stage are turned round too (the launcher used to shoot Fancy the wrong way and he flipped in mid air)
function flipSX() { if (!(state === 'play' || state === 'paused' || state === 'dead' || ((state === 'ready' || state === 'launch') && flipV >= 1)) || flipV <= 0) return 1; if (flipV >= 1) return -1; var u = flipV * flipV * (3 - 2 * flipV); return Math.cos(Math.PI * u); }
function mx(x) { var f = flipSX(); return f === 1 ? x : W / 2 + (x - W / 2) * f; }   // where a point of the world is on the screen right now
var FB = null, FBg = null, FBmain = null;
var FBff = true, FBdir = false, FBforce = '', cssF = false;   // cssF: Firefox turns a settled backward level over with a CSS flip of the whole canvas (free), so it costs no more than a forward level; the words and counters are drawn turned round to come out right
function hudM(open) { if (!cssF) return; if (open) { ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); } else ctx.restore(); }   // Firefox is slow at many turned-over pictures; every other browser turns the scenery over with one plain transform, with no spare picture to clear and copy each frame
function flipOff() {   // the scenery of a backward stage is drawn the right way round on a spare picture first and then turned over in one go: many small turned-over pictures were four times slower in Firefox
  var fx = flipSX(); if (fx === 1 || cssF) return false;
  if (fx === -1 && (FBforce ? FBforce === 'direct' : !FBff)) { ctx.save(); ctx.translate(W / 2, 0); ctx.scale(-1, 1); ctx.translate(-W / 2, 0); FBdir = true; return true; }
  if (!FB || FB.width !== cv.width || FB.height !== cv.height) { FB = document.createElement('canvas'); FB.width = cv.width; FB.height = cv.height; FBg = FB.getContext('2d'); }
  FBg.setTransform(1, 0, 0, 1, 0, 0); FBg.clearRect(0, 0, FB.width, FB.height); FBg.setTransform(k, 0, 0, k, 0, 0); if (mirOn()) { FBg.translate(0, H); FBg.scale(1, -1); }
  FBmain = ctx; ctx = FBg; return true;
}
function flipBlit() {
  if (FBdir) { FBdir = false; ctx.restore(); return; }
  ctx = FBmain; var f = flipSX(); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = f === -1 ? false : true; ctx.translate(cv.width / 2, 0); ctx.scale(f, 1); ctx.translate(-cv.width / 2, 0); ctx.drawImage(FB, 0, 0); ctx.restore();
}
function flipB() { var f = flipSX(); if (f === 1 || cssF) return false; ctx.save(); ctx.translate(W / 2, 0); ctx.scale(f, 1); ctx.translate(-W / 2, 0); return true; }
/* ===== Prince Chimp fights (build 4): in the last stage the final two gates give way to a boss. Three rounds of 12 seconds; a hit repeats only that round. ===== */
var FIGHTS = [['Wafer Cannon', 'Prince Chimp rolls in with a wafer cannon!', 'Dodge the wafers.'], ['Mecha-Chimp', 'Prince Chimp is inside a giant robot!', 'Dodge the lasers and rocket fists.'], ['Gorilla Guard', 'Prince Chimp brought his gorilla!', 'Dodge coconuts. Hop the shockwaves.'], ['Crown Duel', 'Prince Chimp wants his crown back!', 'Everything at once!']];
var FT = null, runFight = 0, fightNew = '', FT_ROUND = 12, FT_BX = 280;
function pcBeaten(n) { return !!save.unlocks['pc' + n]; }
function fightNext() { if (!secretsOn()) return 0; for (var n = 1; n <= 4; n++) if (!pcBeaten(n)) return save.stats.wins >= n + 1 ? n : 0; return 4; }
function fightOn() { return !save.unlocks.pcfOff && fightNext() > 0; }   // part of the main game: the fights come on their own once earned (two wins for the first); the Challenges switch only turns them off
function wearsCrown() { var u = save.unlocks; return !!u.crown && !u.crownOff; }
function fightDue() { var gs = stageOfGate(spawned); return themeOf(gs) === CFG.finalTheme && spawned === gateStart(gs + 1) - 2; }
function ftNew() { return { n: runFight, ph: 'wait', r: 0, rt: 0, t: 0, hold: 0, nx: 0, list: [], hits: 0, cc: 0, h0: 0, c0: 0, blast: null, lm: 2 * lvl('limes'), lt: 0, limes: [], zaps: 0, by: runFight === 3 ? GROUND_Y - 92 : 300, pc: 0, slide: 0, shake: 0, hop: 0, kick: 0, rc: 9, rw: 9, rf: 9, rcl: 9, rerun: runFight === 4 && pcBeaten(4), hp: null, pose: null }; }
/* Where each boss lets its attacks out, relative to its center: the cannon barrel, the robot's arm and chest lamp, the gorilla's raised fist and feet, the Prince's scepter orb and hand. Nothing ever appears in mid air: an attack starts here, and the boss first lines itself up with where the attack will fly. */
var FT_MZ = { 1: { waf: [-62, 25] }, 2: { fist: [-52, 30], lane: [-22, 28] }, 3: { coco: [-62, -41], wave: [-30, 90] }, 4: { waf: [-50, -36], lane: [-50, -36], coco: [-4, -73], cook: [0, 0] } };
var FT_BMIN = 150, FT_BMAX = GROUND_Y - 95;
function ftBoss(F) { return { x: FT_BX + (1 - ss(F.slide)) * 160 + F.kick * 5, y: F.by + (calmOn() || F.n === 3 ? 0 : Math.sin(time * 1.6) * 6) - F.hop }; }
function ftMk(F, k, o) { var m = FT_MZ[F.n][k]; o.k = k; o.ox = m[0]; o.oy = m[1]; o.live = false; o.d0 = o.d; F.list.push(o); }
function ftWaf(F, y, d, K, fist) { var k = fist ? 'fist' : 'waf', m = FT_MZ[F.n][k]; ftMk(F, k, { y: clamp(y, FT_BMIN + m[1], FT_BMAX + m[1]), vx: -((fist ? 300 : 262) + 18 * F.r) * K, r: fist ? 15 : 13, d: d }); }
function ftLane(F, y, d) { var m = FT_MZ[F.n].lane; ftMk(F, 'lane', { y: clamp(y, FT_BMIN + m[1], FT_BMAX + m[1]), d: d, act: 0.5 }); }
function ftCoco(F, ty, T, d, K) { ftMk(F, 'coco', { ty: ty, T2: T / K, g: 560, r: 15, d: d, x: 0, y: 0, vx: 0, vy: 0 }); }
function ftCookie(F, ty, T, d, K, x0) { ftMk(F, 'cook', { ty: ty, T2: T / K, g: 520, r: 14, d: d, x0: x0, x: x0, y: -26, vx: 0, vy: 0, first: !F.list.some(function (q) { return q.k === 'cook'; }) }); }   // a vanilla cookie that falls in from above the top edge and crosses Fancy's column at height ty
function ftRing(a) {   // where a cookie will cross Fancy's column: a pulsing ring the size of the danger zone, until the cookie has gone past
  var r = a.r + CFG.bananaR - 3, p = 0.75 + 0.25 * Math.sin(time * 12);
  ctx.save(); ctx.globalAlpha = p; ctx.fillStyle = 'rgba(255,90,70,.16)'; ctx.beginPath(); ctx.arc(bx, a.ty, r, 0, 6.2832); ctx.fill(); ctx.setLineDash([6, 4]); ctx.lineWidth = 3; ctx.strokeStyle = '#ffd93b'; ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 2; ctx.strokeStyle = '#ff5a46'; ctx.beginPath(); ctx.moveTo(bx - r - 6, a.ty); ctx.lineTo(bx - r + 6, a.ty); ctx.moveTo(bx + r - 6, a.ty); ctx.lineTo(bx + r + 6, a.ty); ctx.moveTo(bx, a.ty - r - 6); ctx.lineTo(bx, a.ty - r + 6); ctx.moveTo(bx, a.ty + r - 6); ctx.lineTo(bx, a.ty + r + 6); ctx.stroke(); ctx.restore();
}
function ftWave(F, d, K) { ftMk(F, 'wave', { vx: -(236 + 14 * F.r) * K, d: d, x: 0 }); }
function ftAim(a, p) {   // a coconut is held in the thrower's hand until it is let go: its flight is worked out from the hand
  var x0 = p.x + a.ox, y0 = p.y + a.oy; a.x = x0; a.y = y0; a.vx = -(x0 - bx) / a.T2; a.vy = (a.ty - y0 - 0.5 * a.g * a.T2 * a.T2) / a.T2;
}
function ftPattern(F, K) {   // push one volley and say how long until the next
  var k = F.n === 4 ? 1 + (F.pc++ + (F.r > 0 && rng() < 0.35 ? 1 : 0)) % (F.rerun ? 4 : 3) : F.n, r = F.r, duel = F.n === 4, y = clamp(by + vy * 0.2, 130, GROUND_Y - 80), d = 0.3 / K, i, s, hole, y2;
  if (k === 1) {   // wafers: one shot, then three one after another, then a sweeping barrage with a hole in it
    if (r === 0) { ftWaf(F, y + (rng() - 0.5) * 40, d, K); return 1.7 / K; }
    if (r === 1) { ftWaf(F, y - 80, d, K); ftWaf(F, y, d + 0.55, K); ftWaf(F, y + 80, d + 1.1, K); return 2.9 / K; }
    s = rng() < 0.5 ? 1 : -1; hole = 1 + Math.floor(rng() * 3); for (i = 0; i < 5; i++) if (i !== hole) ftWaf(F, (s > 0 ? 200 : 200 + 4 * 70) + s * 70 * i, d + i * 0.34, K); return 3.6 / K;
  }
  if (k === 2) {   // lasers (one at a time, from the emitter) and rocket fists
    y2 = y > 330 ? y - 190 : y + 190;
    if (r === 0) { ftLane(F, y + (rng() - 0.5) * 100, d + 0.5); return 2.3 / K; }
    if (r === 1) { ftLane(F, y, d + 0.5); ftLane(F, y2, d + 2.1); if (!duel) ftWaf(F, y, d + 3.0, K, true); return 3.9 / K; }
    if (duel) { ftLane(F, y, d + 0.5); ftLane(F, y2, d + 1.9); ftLane(F, y + 20, d + 3.3); return 4.6 / K; }
    ftWaf(F, y, d, K, true); ftWaf(F, y + (rng() < 0.5 ? -110 : 110), d + 0.6, K, true); ftLane(F, y + (rng() < 0.5 ? -150 : 150), d + 1.5); return 3.2 / K;
  }
  if (k === 4) {   // the Prince claps and vanilla cookies drop from above (only in reruns of the Crown Duel): one, then two a moment apart, then two almost together
    var cx0 = bx + 150 + rng() * 70;
    if (r === 0) { ftCookie(F, y, 1.15, 1.0 / K, K, cx0); return 2.8 / K; }
    if (r === 1) { ftCookie(F, y - 60, 1.15, 1.0 / K, K, cx0); ftCookie(F, y + 90, 1.05, 2.1 / K, K, cx0 + 60); return 4.1 / K; }
    ftCookie(F, y - 90, 1.2, 1.0 / K, K, cx0); ftCookie(F, y + 70, 1.0, 1.8 / K, K, cx0 + 80); ftCookie(F, y, 1.1, 2.7 / K, K, cx0 + 20); return 4.6 / K;
  }
  if (r === 0) { ftCoco(F, y, 0.85, 0.8 / K, K); return 1.9 / K; }   // coconuts thrown from a raised fist, and shockwaves from a stomp
  if (r === 1) { if (duel) { ftCoco(F, y, 0.85, 0.8 / K, K); ftCoco(F, y - 90, 1.0, 1.7 / K, K); return 3.1 / K; } ftWave(F, 0.9 / K, K); ftCoco(F, y, 0.85, 1.0 / K, K); return 2.7 / K; }
  if (duel) { ftCoco(F, y - 80, 0.85, 0.8 / K, K); ftCoco(F, y + 80, 1.1, 1.5 / K, K); ftCoco(F, y, 0.9, 2.3 / K, K); return 3.6 / K; }
  ftCoco(F, y - 80, 0.85, 0.8 / K, K); ftCoco(F, y + 80, 1.2, 1.4 / K, K); ftWave(F, 1.8 / K, K); return 3.2 / K;
}
function ftHit() {
  var F = FT; if (!F || invuln > 0 || F.hold > 0 || F.ph !== 'round') return false;
  if (shield > 0) { shield--; boing(-CFG.bounceVy); F.list.length = 0; return true; }
  runHurts++; F.hits++; F.list.length = 0; F.limes.length = 0; F.ph = 'retry'; F.hold = 1.7; F.shake = 0.4; invuln = 2.2; hurtT = 0.9; vy = -180; fallD = 0; streak = 0;
  burst(bx, by, 26, ['#ff6b81', '#ffffff', '#ffd93b'], 260, 240); burst(bx, by, 14, ['#ffffff', '#fff2a0'], 380, 60); if (!calmOn()) { flashT = 0.14; punchT = CFG.punchSecs * 0.6; } pop('Oops! Again!', '#ff6b81', 26); return true;
}
function ftLimes(F, dt) {   // Lime defense: a coconut that will hit Fancy within about half a second (and he has not dodged) gets a rocket lime shot at it; the lime steers onto the coconut and pops it
  var i, j, a, L, t, x, y, v, dx, dy, hr, d, sp = 560;
  if (F.lt > 0) F.lt -= dt;
  if (F.lm > 0 && F.lt <= 0 && invuln <= 0 && F.ph === 'round') {
    for (i = 0; i < F.list.length; i++) {
      a = F.list[i]; if (a.k !== 'coco' || !a.live || a.tg || a.x < bx) continue;
      x = a.x; y = a.y; v = a.vy; hr = a.r + CFG.bananaR + 1;
      for (t = 0; t < 0.55; t += 1 / 30) { x += a.vx / 30; y += v / 30; v += a.g / 30; dx = x - bx; dy = y - by; if (dx * dx + dy * dy < hr * hr) break; }
      if (t < 0.55) { a.tg = 1; F.lm--; F.lt = 0.45; F.limes.push({ x: bx + 14, y: by - 8, vx: 160, vy: -200, a: a, t: 0 }); burst(bx + 12, by - 8, 8, ['#9be84a', '#ffffff'], 150, 80); pop('Lime shot!', '#9be84a', 20); break; }
    }
  }
  for (i = F.limes.length - 1; i >= 0; i--) {
    L = F.limes[i]; L.t += dt; a = L.a; if (a && F.list.indexOf(a) < 0) a = L.a = null;
    if (a) { dx = a.x - L.x; dy = a.y - L.y; d = Math.sqrt(dx * dx + dy * dy) || 1; L.vx += (dx / d * sp - L.vx) * Math.min(1, dt * 10); L.vy += (dy / d * sp - L.vy) * Math.min(1, dt * 10); }
    else L.vy += 500 * dt;
    L.x += L.vx * dt; L.y += L.vy * dt;
    if (!calmOn() && frng() < 0.8) fxAdd(L.x - L.vx * 0.03, L.y - L.vy * 0.03, -L.vx * 0.12 + (frng() - 0.5) * 30, -L.vy * 0.12 + (frng() - 0.5) * 30, 0.32, frng() < 0.5 ? '#ffffff' : '#fff2a0', 2 + frng() * 2, false, 0);
    if (a && (a.x - L.x) * (a.x - L.x) + (a.y - L.y) * (a.y - L.y) < (a.r + 8) * (a.r + 8)) {
      j = F.list.indexOf(a); if (j >= 0) F.list.splice(j, 1); F.zaps++; F.limes.splice(i, 1);
      burst(a.x, a.y, 22, ['#a8744c', '#e8d0a0', '#9be84a', '#ffffff'], 280, 170); pop('ZAP!', '#9be84a', 28); if (!calmOn()) punchT = CFG.punchSecs * 0.3; continue;
    }
    if (L.t > 1.6 || L.x > W + 40 || L.y > GROUND_Y - 4 || L.y < -40) { burst(L.x, L.y, 8, ['#9be84a', '#ffffff'], 140, 60); F.limes.splice(i, 1); }
  }
}
var FT_CC = ['Close call!', 'So close!', 'Whoa, nice!', 'Phew!'], FT_WORDS = [['Nice job!', 'Way to go!', 'Great dodging!', 'Keep it up!', 'You did it!'], ['Flawless!', 'Perfect dodging!', 'Super smooth!', 'Banana-tastic!'], ['Boss beaten!', 'Champion!', 'Awesome!']];
function ftCC(F, a) {   // a shot skimmed past Fancy without touching him: a cheer, a little spray of sparkles, and a count for the round
  if (a.cc) return; a.cc = 1; F.cc++; pop(FT_CC[Math.floor(rng() * FT_CC.length)], '#7ad8ff', 24); burst(bx + 12, by, 16, ['#7ad8ff', '#ffffff', '#ffd93b'], 210, 200);
}
function ftBlast(F, last) {   // a round survived: a big encouraging word in the middle of the screen, with confetti
  var flawless = F.hits === F.h0, pool = FT_WORDS[last ? 2 : flawless ? 1 : 0], cc = F.cc - F.c0, sub = (last ? 'Round 3' : 'Round ' + F.r) + ' cleared' + (flawless ? ' - no hits!' : '!') + (cc >= 2 ? '  ' + cc + ' close calls' : '');
  F.blast = { w: pool[Math.floor(rng() * pool.length)], s: sub, t: 0, f: flawless || last, c: last ? '#ffd93b' : flawless ? '#7be07b' : '#ffd93b' };
  burst(W / 2, 250, flawless || last ? 44 : 28, ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'], 320, 330);
}
function ftStep(dt, sp) {
  var F = FT, i, a, p, an, K = relaxK(), goal = F.n === 3 ? GROUND_Y - 92 : clamp(by, FT_BMIN, FT_BMAX), best = 99, dx, dy, rr2, rem, dd, spd;
  if (F.shake > 0) F.shake -= dt;
  if (F.kick > 0) F.kick = Math.max(0, F.kick - dt * 7);
  if (F.blast) { F.blast.t += dt; if (F.blast.t > 2.1) F.blast = null; }
  if (F.ph === 'wait') { if (!obs.length) { F.ph = 'intro'; rsgT = 0; rsgGo = false; rsgTap = false; vy = 0; celT = 0; spinT = 0; lastAfter = 0; } return; }
  F.slide = Math.min(1, F.slide + dt);
  if (!calmOn()) {   // little extras: dust trailing the arriving boss, sparks falling from the robot's boots
    if (F.slide < 1 && frng() < 0.5) { p = ftBoss(F); fxAdd(p.x + 50, p.y + 30 + frng() * 40, 40 + frng() * 50, (frng() - 0.5) * 30, 0.5, '#ffffff', 3 + frng() * 3, false, 0); }
    if (F.n === 4 && F.slide >= 1 && F.ph !== 'won' && frng() < 0.7) { p = ftBoss(F); fxAdd(p.x + (frng() - 0.5) * 40, p.y + 76, (frng() - 0.5) * 70, 130 + frng() * 160, 0.4 + frng() * 0.4, frng() < 0.5 ? '#ffb347' : '#fff2a0', 1.8 + frng() * 2, false, 260); }
    if (F.n === 2 && F.slide >= 1 && F.ph !== 'won' && frng() < 0.55) { p = ftBoss(F); fxAdd(p.x + (frng() < 0.5 ? -15 : 17) + (frng() - 0.5) * 6, p.y + 92, (frng() - 0.5) * 50, 110 + frng() * 120, 0.35 + frng() * 0.3, frng() < 0.5 ? '#ffb347' : '#fff2a0', 1.6 + frng() * 1.8, false, 240); }
  }
  if (F.slide >= 1 && !F.landed) { F.landed = 1; p = ftBoss(F); burst(p.x, GROUND_Y - 8, 14, ['#e8d0a0', '#ffffff'], 170, 60); if (!calmOn()) punchT = CFG.punchSecs * 0.35; }   // the boss arrives with a thump
  if (F.hold > 0 && F.ph !== 'won') { F.hold -= dt; if (F.hold <= 0) { F.hold = 0; F.ph = 'round'; F.rt = 0; F.nx = 0.5; F.h0 = F.hits; F.c0 = F.cc; grace = 0.25; vy = 0; flapAnim = 0.18; pop('Go!', '#7be07b', 28); } }
  if (F.ph === 'intro') { if (!rsgHold()) { F.ph = 'round'; F.rt = 0; F.nx = 0.5; F.h0 = F.hits; F.c0 = F.cc; } }
  F.hop = 0; F.rc += dt; F.rw += dt; F.rf += dt; F.rcl += dt;   // seconds since the last throw, stomp and scepter shot (the arms follow through)
  for (i = 0; i < F.list.length; i++) {   // the boss slides to the height of its next shot, and hops before a stomp
    a = F.list[i];
    if (a.k === 'wave' && !a.live && a.d > 0) F.hop = Math.max(F.hop, 16 * Math.sin(Math.PI * Math.min(1, 1 - a.d / a.d0)));
    if (F.n !== 3 && (a.k === 'waf' || a.k === 'fist' || a.k === 'lane') && (!a.live || (a.k === 'lane' && a.act > 0))) { rem = a.live ? 0 : a.d; if (rem < best) { best = rem; goal = clamp(a.y - a.oy, FT_BMIN, FT_BMAX); } }
  }
  dd = goal - F.by; spd = best < 99 ? clamp(Math.abs(dd) * 8, 80, 440) : 130; F.by += clamp(dd, -spd * dt, spd * dt);
  if (F.ph === 'won') {
    F.t += dt; if (!calmOn() && F.t > 1.4 && frng() < 0.8) { p = ftBoss(F); an = F.t - 1.4; fxAdd(p.x + an * an * 80, p.y - an * an * 70 + an * 20, (frng() - 0.5) * 70, 30 + frng() * 70, 0.7, ['#ffd93b', '#ffffff', '#ff9ac0'][Math.floor(frng() * 3)], 3 + frng() * 3, true, 90); }
    if (!calmOn() && F.t < 2.4 && Math.floor(F.t * 6) !== Math.floor((F.t - dt) * 6)) { p = ftBoss(F); burst(p.x + (rng() - 0.5) * 80, p.y + (rng() - 0.5) * 100, 8, ['#ffd93b', '#ff8a3c', '#ffffff'], 200, 120); }
    if (F.t >= 3.2) ftFinish();
    return;
  }
  if (F.ph !== 'round') return;
  F.rt += dt;
  if (F.rt < FT_ROUND - 1.6) { F.nx -= dt; if (F.nx <= 0) F.nx = ftPattern(F, K); }
  p = ftBoss(F);
  for (i = F.list.length - 1; i >= 0; i--) {
    a = F.list[i];
    if (!a.live) {
      if (a.d > 0) a.d -= dt;
      if (a.k === 'coco') ftAim(a, p);
      if (a.d > 0) continue;
      a.d = 0;
      if (a.k !== 'coco' && a.k !== 'wave' && a.k !== 'cook' && Math.abs(F.by - (a.y - a.oy)) > 5) continue;   // wait until the boss has lined up
      a.live = true; if (a.k === 'cook') { a.x = a.x0; a.y = -26; a.vx = -(a.x0 - bx) / a.T2; a.vy = (a.ty + 26 - 0.5 * a.g * a.T2 * a.T2) / a.T2; F.rcl = 0; p = ftBoss(F); burst(p.x - 44, p.y + 22, 12, ['#ffffff', '#ffd93b', '#ffe9b0'], 170, 30); if (!calmOn()) punchT = CFG.punchSecs * 0.15; } else if (a.k === 'coco') F.rc = 0; else if (a.k === 'wave') F.rw = 0; else if (F.n === 4 && (a.k === 'waf' || a.k === 'lane')) F.rf = 0;
      if (a.k === 'waf' || a.k === 'fist') { a.x = p.x + a.ox; a.y = p.y + a.oy; F.kick = 1; burst(a.x - 24, a.y, 7, ['#ffffff', '#fff2a0', '#ffb347'], 150, 10); if (F.n === 1 && a.k === 'waf') cannonSmoke(p.x - 88, p.y + 25); }   // fired: a puff at the barrel and a little recoil (the first boss also blows a plume of smoke out of its dark muzzle)
      else if (a.k === 'lane') a.y = p.y + a.oy;
      else if (a.k === 'wave') { a.x = p.x + a.ox; burst(a.x, GROUND_Y - 6, 10, ['#e8d0a0', '#ffffff'], 160, 40); if (!calmOn()) punchT = CFG.punchSecs * 0.2; }
    }
    if (a.k === 'lane') { a.act -= dt; if (invuln <= 0) { dy = Math.abs(by - a.y); a.near = Math.min(a.near === undefined ? 99 : a.near, dy); if (dy < 30 && ftHit()) break; } if (a.act <= 0) { if (a.near >= 30 && a.near < 44 + 3 * lvl('dare')) ftCC(F, a); F.list.splice(i, 1); } continue; }
    a.px = a.x; a.x += a.vx * dt;
    if (a.k === 'coco' || a.k === 'cook') { a.y += a.vy * dt; a.vy += a.g * dt; if (a.y > GROUND_Y - 10) { burst(a.x, GROUND_Y - 6, 8, ['#a8744c', '#e8d0a0'], 120, 100); F.list.splice(i, 1); continue; } }
    if (a.x < -50) { F.list.splice(i, 1); continue; }
    if (invuln > 0) continue;
    if (a.k === 'wave') {
      if (by + CFG.bananaR - 2 > GROUND_Y - 46 && Math.abs(a.x - bx) < 20 + CFG.bananaR && ftHit()) break;
      if (Math.abs(a.x - bx) < 20 + CFG.bananaR) a.near = Math.min(a.near === undefined ? 99 : a.near, GROUND_Y - 46 - (by + CFG.bananaR - 2)); else if (a.x < bx && a.near > 0 && a.near < 18 + 3 * lvl('dare')) ftCC(F, a);
    } else {
      dx = a.x - bx; dy = a.y - by; rr2 = a.r + CFG.bananaR - 3; if (dx * dx + dy * dy < rr2 * rr2 && ftHit()) break;
      if (!a.cc && a.px >= bx && a.x < bx && Math.abs(dy) < rr2 + 16 + 3 * lvl('dare')) ftCC(F, a);
    }
  }
  if (F.ph === 'round' || F.limes.length) ftLimes(F, dt);
  if (F.ph === 'round' && F.rt >= FT_ROUND && !F.list.length) {
    if (F.r < 2) { F.r++; F.ph = 'between'; F.hold = 1.5; invuln = Math.max(invuln, 1.7); ftBlast(F, false); burst(bx + 40, by, 20, ['#ffd93b', '#ffffff'], 240, 200); }
    else {
      F.ph = 'won'; F.t = 0; F.hold = 99; invuln = 99; F.list.length = 0; ftBlast(F, true); celT = CFG.celSecs; var n = F.n, bonus = F.hits ? 0 : 15;
      giveCoins(25 + bonus, bx + 20, by); burst(bx + 40, by, 40, ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'], 320, 360);
      if (!pracN) { save.unlocks['pc' + n] = 1; persist(); }
      fightNew = FIGHTS[n - 1][0] + ' beaten!' + (n < 4 ? ' Crown piece ' + n + ' of 3.' : ' The Crown is yours soon...') + (bonus ? ' No hits: +15 bonus.' : '');
    }
  }
}
function ftFinish() {
  FT = null; invuln = 0; hurtT = 0; runFight = 0; grace = 1.4; vy = 0; score = spawned = gateStart(stage + 1); pendNext = ''; stageUp();
}
function drawBeam(mx, my, y, cl) {   // a live laser: a soft red glow, a hot white core, energy dashes running along it, and a bright flare at the lamp
  var gr = ctx.createLinearGradient(0, y - 30, 0, y + 30), i, x, fl = cl ? 1 : 0.9 + 0.1 * Math.sin(time * 60);
  gr.addColorStop(0, 'rgba(255,70,70,0)'); gr.addColorStop(0.28, 'rgba(255,90,80,0.55)'); gr.addColorStop(0.5, 'rgba(255,240,230,0.95)'); gr.addColorStop(0.72, 'rgba(255,90,80,0.55)'); gr.addColorStop(1, 'rgba(255,70,70,0)');
  ctx.globalAlpha = fl; ctx.fillStyle = gr; ctx.fillRect(0, y - 30, mx, 60);
  ctx.fillStyle = '#ff4a4a'; ctx.fillRect(0, y - 11, mx, 22); ctx.fillStyle = '#fff2ee'; ctx.fillRect(0, y - 5, mx, 10);
  if (!cl) { ctx.fillStyle = '#ffffff'; for (i = 0; i < 6; i++) { x = mx - ((time * 1100 + i * 97) % Math.max(60, mx)); ctx.fillRect(x, y - 2.5, 26, 5); ctx.fillRect(x + 40, y - 9 + (i % 3) * 7, 14, 3); } }
  ctx.beginPath(); ctx.arc(mx, my, 27, 0, 7); ctx.fillStyle = 'rgba(255,120,110,0.35)'; ctx.fill(); ctx.beginPath(); ctx.arc(mx, my, 17, 0, 7); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.beginPath(); ctx.arc(mx, my, 9, 0, 7); ctx.fillStyle = '#ffd0cc'; ctx.fill();
  ctx.globalAlpha = 1;
}
function drawBalloonsWagon(F, p, sh, wt, cl) {   // the wagon hangs from three of the same glossy balloons as the Balloon Party; they sway, and float away when the wagon is beaten
  var B = [[-40, -76, 0, -47, 18], [40, -76, 5, 47, 18], [0, -100, 2, 0, 16]], i, b, x, y, hx, hy, sw, kx, ky;
  for (i = 0; i < 3; i++) {
    b = B[i]; sw = cl ? 0 : Math.sin(time * 1.9 + i * 2.1); x = p.x + sh + b[0] + sw * 3.5; y = p.y + b[1] + (cl ? 0 : Math.cos(time * 1.5 + i * 1.7) * 3) - wt * wt * 190; hx = p.x + sh + b[3]; hy = p.y + b[4];
    kx = x; ky = y + 36;
    if (wt > 0) { hx = kx - sw * 4; hy = ky + 34 + wt * 12; }
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.quadraticCurveTo((kx + hx) / 2 + sw * 5, (ky + hy) / 2, hx, hy); ctx.lineWidth = 3.4; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 1.4; ctx.strokeStyle = '#fffdf6'; ctx.stroke();
    ART.bal.draw(ctx, b[2], x, y, 1.08, 1.08, true);
  }
}
function flamePath(x, y, L, w, rip, ph) {   // a flame pointing down from (x, y): it swells just below the nozzle, tapers to a point, and its edges ripple down its length
  var n = 14, i, u, h, a;
  ctx.beginPath();
  for (i = 0; i <= n; i++) { u = i / n; h = w * (u < 0.16 ? 0.55 + 0.45 * (u / 0.16) : Math.pow(1 - (u - 0.16) / 0.84, 1.15)); a = 1 + rip * u * Math.sin(u * 11 - time * 38 + ph); if (i) ctx.lineTo(x - h * a, y + u * L); else ctx.moveTo(x - h * 0.55, y); }
  for (i = n; i >= 0; i--) { u = i / n; h = w * (u < 0.16 ? 0.55 + 0.45 * (u / 0.16) : Math.pow(1 - (u - 0.16) / 0.84, 1.15)); a = 1 + rip * u * Math.sin(u * 11 - time * 38 + ph + 1.9); ctx.lineTo(x + h * a, y + u * L); }
  ctx.closePath();
}
function drawFlare(x, y, len, cl, wd) {   // a rocket jet under a nozzle at (x, y): a hot glow, a rippling orange plume, a yellow body, a blue-white core, a stack of bright shock diamonds, flying sparks, and a splash of light where it reaches the floor
  wd = wd || 1;
  var ph = x * 0.37, L = len * (cl ? 1 : 1 + 0.07 * Math.sin(time * 52 + ph) + 0.04 * Math.sin(time * 31 + ph * 2)), w = 10 * wd, rip = cl ? 0 : 0.16, gr, k, j, u, dh, dw, yc, a, sx, sy;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  gr = ctx.createRadialGradient(x, y + L * 0.35, 2, x, y + L * 0.35, 48 * wd); gr.addColorStop(0, 'rgba(255,150,40,0.42)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); ctx.fillStyle = gr; var gy = y + L * 0.35, gt = Math.max(y - 10, gy - 48 * wd); ctx.fillRect(x - 48 * wd, gt, 96 * wd, Math.min(y + L + 74 * wd, gy + 48 * wd) - gt);   // only the part of the old rectangle the glow actually reaches (the same pixels, about half the fill)
  if (y + L > GROUND_Y - 10) { gr = ctx.createRadialGradient(x, GROUND_Y - 2, 2, x, GROUND_Y - 2, 70 * wd); gr.addColorStop(0, 'rgba(255,210,120,0.55)'); gr.addColorStop(1, 'rgba(255,120,30,0)'); ctx.fillStyle = gr; ctx.save(); ctx.translate(x, GROUND_Y - 2); ctx.scale(1, 0.28); ctx.translate(-x, -(GROUND_Y - 2)); ctx.fillRect(x - 72 * wd, GROUND_Y - 74 * wd, 144 * wd, 148 * wd); ctx.restore(); }
  ctx.globalCompositeOperation = 'source-over';
  gr = ctx.createLinearGradient(0, y, 0, y + L); gr.addColorStop(0, '#ff7a1a'); gr.addColorStop(0.55, 'rgba(255,70,20,0.9)'); gr.addColorStop(1, 'rgba(255,40,20,0)'); ctx.fillStyle = gr; flamePath(x, y, L, w, rip, ph); ctx.fill();
  gr = ctx.createLinearGradient(0, y, 0, y + L * 0.78); gr.addColorStop(0, '#fff09a'); gr.addColorStop(0.55, 'rgba(255,200,60,0.95)'); gr.addColorStop(1, 'rgba(255,160,30,0)'); ctx.fillStyle = gr; flamePath(x, y, L * 0.78, w * 0.64, rip * 0.7, ph + 0.7); ctx.fill();
  gr = ctx.createLinearGradient(0, y, 0, y + L * 0.62); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, 'rgba(190,230,255,0.97)'); gr.addColorStop(1, 'rgba(110,180,255,0)'); ctx.fillStyle = gr; flamePath(x, y, L * 0.62, w * 0.42, rip * 0.4, ph + 1.4); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  for (k = 0; k < 4; k++) {   // shock diamonds: bright beads down the middle of the jet, each smaller and dimmer, that jitter a little
    u = 0.2 + k * 0.17 + (cl ? 0 : Math.sin(time * 44 + k * 1.7 + ph) * 0.012); yc = y + L * u; dh = L * 0.075 * (1 - k * 0.16); dw = w * (0.5 - k * 0.09); a = (0.85 - k * 0.14) * (cl ? 1 : 0.85 + 0.15 * Math.sin(time * 61 + k + ph));
    ctx.fillStyle = 'rgba(255,150,40,' + (a * 0.45).toFixed(2) + ')'; ctx.beginPath(); ctx.moveTo(x, yc - dh * 1.7); ctx.lineTo(x + dw * 1.5, yc); ctx.lineTo(x, yc + dh * 1.7); ctx.lineTo(x - dw * 1.5, yc); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,235,' + Math.min(1, a * 1.15).toFixed(2) + ')'; ctx.beginPath(); ctx.moveTo(x, yc - dh); ctx.lineTo(x + dw, yc); ctx.lineTo(x, yc + dh); ctx.lineTo(x - dw, yc); ctx.closePath(); ctx.fill();
  }
  gr = ctx.createRadialGradient(x, y, 1, x, y, w * 1.1); gr.addColorStop(0, 'rgba(210,235,255,0.95)'); gr.addColorStop(1, 'rgba(120,190,255,0)'); ctx.fillStyle = gr; ctx.fillRect(x - w * 1.2, y - w * 1.2, w * 2.4, w * 2.4);   // a bright bloom right at the nozzle
  if (!cl) {   // sparks streaming off
    ctx.lineCap = 'round';
    for (j = 0; j < 6; j++) { u = (time * 3.1 + j * 0.37 + ph) % 1; sx = x + Math.sin(j * 5.1 + ph) * w * (0.5 + u * 1.5); sy = y + L * (0.2 + u * 0.95); ctx.strokeStyle = 'rgba(255,214,110,' + (0.9 * (1 - u)).toFixed(2) + ')'; ctx.lineWidth = 1.6 * Math.min(wd, 1.6); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.sin(j * 5.1 + ph) * 1.5, sy + 4 + 5 * u); ctx.stroke(); }
  }
  ctx.restore();
}
function ftU(F, ks, win) {   // how far into the wind-up (0 to 1) the next attack of these kinds is: -1 when none is within `win` seconds
  var b = 9, i, a;
  for (i = 0; i < F.list.length; i++) { a = F.list[i]; if (!a.live && a.d > 0 && a.d < b && ks.indexOf(a.k) >= 0) b = a.d; }
  return b < win ? 1 - b / win : -1;
}
function ftThrowW(u, since) {   // 1 = wound all the way back, 0 = the instant of release, below 0 = following through
  if (u >= 0) return u < 0.62 ? ss(u / 0.62) : 1 - ss((u - 0.62) / 0.38);
  return since < 0.5 ? -0.8 * Math.sin(Math.PI * since / 0.5) : 0;
}
function ftPose(F) {   // how the gorilla's arms and the Prince's hands and scepter are posed right now (also where the held coconut is)
  var n = F.n, q = null, u, w, s, r, hx, hy, lerp = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  if (n === 3) {
    u = ftU(F, 'coco', 0.5); w = ftThrowW(u, F.rc);
    s = ftU(F, 'wave', 0.7);   // the stomp: both arms rise, then pound down at the instant the shockwave starts
    s = s >= 0 ? (s < 0.8 ? ss(s / 0.8) : 1 - 2 * ss((s - 0.8) / 0.2)) : F.rw < 0.6 ? -(1 - ss(F.rw / 0.6)) : 0;
    r = u >= 0 || F.rc < 0.5 ? 0.9 * w : s > 0 ? 0.5 * s : 1.24 * s;
    q = { r: r, l: (s > 0 ? -2.6 * s : -0.1 * s) - 0.22 * w };
    F.hp = [-33 + -29 * Math.cos(r) + 49 * Math.sin(r), 8 + -29 * Math.sin(r) - 49 * Math.cos(r)];
  } else if (n === 4) {
    u = ftU(F, 'coco', 0.5); var idle = [46, 34, 0], back = [60, -30, 0.55], rel = [-4, -58, -1.15], fol = [-46, -14, -1.9], hp, lerp3 = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };   // an overhand throw: the hand rises up behind his shoulder, whips over his head (fingers leading, thumb down) and follows through; the arm stays behind his head
    if (u >= 0) hp = u < 0.62 ? lerp3(idle, back, ss(u / 0.62)) : lerp3(back, rel, ss((u - 0.62) / 0.38));
    else if (F.rc < 0.35) hp = lerp3(rel, fol, ss(F.rc / 0.35)); else if (F.rc < 0.9) hp = lerp3(fol, idle, ss((F.rc - 0.35) / 0.55)); else hp = idle;
    var cu = ftU(F, 'cook', 0.7);   // the clap: the free hand rises, then sweeps across to meet the hand that holds the scepter
    if (u < 0 && cu >= 0) hp = cu < 0.6 ? lerp3(idle, [66, -16, 0.5], ss(cu / 0.6)) : lerp3([66, -16, 0.5], [-48, 22, -0.4], ss((cu - 0.6) / 0.4));
    else if (u < 0 && F.rcl < 0.9) hp = F.rcl < 0.25 ? [-48, 22, -0.4] : lerp3([-48, 22, -0.4], idle, ss((F.rcl - 0.25) / 0.65));
    var su = ftU(F, 'waf,lane', 0.5), sw = ftThrowW(su, F.rf);
    q = { tx: hp[0], ty: hp[1], tr: hp[2], open: u >= 0 || F.rc < 0.25 || cu >= 0 || F.rcl < 0.9, s: sw * 0.3 + (F.rcl < 0.2 ? 0.14 * Math.sin(Math.PI * F.rcl / 0.2) : 0), f: su >= 0 ? ss(su) : Math.max(0, 1 - F.rf / 0.3) };
    F.hp = [hp[0], hp[1] - 15];
  }
  F.pose = q; return q;
}
var SPT = null;
function fightSpot(x, y) {   // the soft light behind a boss: one baked picture stamped on whole device pixels (a radial gradient over 260 x 260 units cost over a millisecond every frame in Firefox)
  var m = ctx.getTransform(), s = m.a, c, g, fl;
  if (m.b || m.c || m.a !== m.d) { fl = ctx.createRadialGradient(x, y + 10, 8, x, y + 10, 130); fl.addColorStop(0, 'rgba(255,246,208,0.34)'); fl.addColorStop(1, 'rgba(255,246,208,0)'); ctx.fillStyle = fl; ctx.fillRect(x - 130, y - 120, 260, 260); return; }
  if (!SPT || SPT.s !== s) { c = document.createElement('canvas'); c.width = c.height = Math.ceil(260 * s); g = c.getContext('2d'); g.scale(s, s); fl = g.createRadialGradient(130, 130, 8, 130, 130, 130); fl.addColorStop(0, 'rgba(255,246,208,0.34)'); fl.addColorStop(1, 'rgba(255,246,208,0)'); g.fillStyle = fl; g.fillRect(0, 0, 260, 260); SPT = { s: s, c: c }; }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(SPT.c, Math.round(m.e + (x - 130) * s), Math.round(m.f + (y - 120) * s)); ctx.restore();
}
function drawFight() {
  var F = FT, p = ftBoss(F), i, a, f, g, sh = F.shake > 0 && !calmOn() ? Math.sin(time * 80) * 4 : 0, cl = calmOn(), al, ex, mx, my, fl;
  for (i = 0; i < F.list.length; i++) {   // warnings first, behind everything
    a = F.list[i]; f = a.live ? 1 : a.d > 0 ? 1 - a.d / a.d0 : 1; mx = p.x + a.ox; my = p.y + a.oy;
    if (a.k === 'coco' && !a.live) { ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.55; for (g = 1; g < 14; g++) { al = g * 0.07; if (a.x + a.vx * al < 20) break; ctx.beginPath(); ctx.arc(a.x + a.vx * al, a.y + a.vy * al + 0.5 * a.g * al * al, 3.2, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
    else if (a.k === 'lane') {
      if (!a.live) { al = cl ? 0.28 : 0.18 + 0.16 * Math.abs(Math.sin(time * 14)); ctx.globalAlpha = al; ctx.fillStyle = '#ff4a4a'; ctx.fillRect(0, a.y - 30, mx, 60); ctx.globalAlpha = 1; outlined('!', 30, a.y + 2, 30, '#ffffff'); ctx.globalAlpha = 0.5 + 0.4 * f; ctx.fillStyle = '#ff8a8a'; ctx.beginPath(); ctx.arc(mx, my, 6 + 10 * f, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }   // the emitter charges up
      else { drawBeam(mx, my, a.y, cl); }
    }
    else if (!a.live && (a.k === 'waf' || a.k === 'fist')) { ex = a.k === 'waf' && F.n === 1 ? mx - 34 : mx - 12; ctx.globalAlpha = 0.25 + 0.3 * f; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([8, 10]); ctx.beginPath(); ctx.moveTo(ex, a.y); ctx.lineTo(0, a.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#fff2a0'; ctx.beginPath(); ctx.arc(ex, my, 4 + 8 * f, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }   // the dotted line shows the shot; the muzzle glows
    else if (a.k === 'cook' && !a.live) { ftRing(a); al = cl ? 0.7 : 0.5 + 0.4 * Math.abs(Math.sin(time * 12)); ctx.globalAlpha = al * 0.7; ctx.save(); ctx.translate(a.x0, 156); ART.mg.draw(ctx, 'wafer', 0, 0, undefined, 1); ctx.restore(); ctx.globalAlpha = al; outlined('!', a.x0, 132, 30, '#ffd93b'); ctx.globalAlpha = 1; }   // a cookie is about to fall in from up here
    else if (a.k === 'wave' && !a.live) { ctx.globalAlpha = 0.5 + 0.4 * f; outlined('!', W - 26, GROUND_Y - 30, 30, '#ffd93b'); ctx.fillStyle = '#e8d0a0'; for (g = 0; g < 4; g++) { ctx.beginPath(); ctx.arc(mx - g * 16 + Math.sin(time * 20 + g) * 2, GROUND_Y - 6 - f * 8, 6 + g, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
  }
  for (i = 0; i < F.list.length; i++) {   // a wafer or fist that has just left its barrel or arm is still inside it: drawn behind the boss
    a = F.list[i]; if (!a.live || (a.k !== 'waf' && a.k !== 'fist') || a.x < p.x + a.ox - 46) continue;
    if (a.k === 'waf') ART.mg.draw(ctx, 'wafer', a.x, a.y, undefined, 1); else ART.fxs(ctx, 'fist', a.x, a.y, 0);
  }
  if (F.n === 2 && F.ph !== 'won') { drawFlare(p.x + sh - 15, p.y + 81, 68, cl, 1.15); drawFlare(p.x + sh + 17, p.y + 81, 68, cl, 1.15); }
  if (F.n === 4 && F.ph !== 'won') drawFlare(p.x + sh, p.y + 70, clamp(GROUND_Y - (p.y + 70) + 6, 40, 112), cl, 2.5);   // the Prince's throne burns a big jet   // the robot hovers on rocket boots
  var wt = F.ph === 'won' ? Math.max(0, F.t - 1.4) : 0, co = [[-2, -14, 0.62], [0, -30, 0.72], [34, -66, 0.46], [0, 0, 1.12]][F.n - 1];   // beaten: the boss spins away up and to the right, crying
  if (wt <= 0 || F.n === 1) {   // a soft spotlight behind the boss and its shadow on the floor: smaller and fainter the higher it hovers
    var hh = clamp((GROUND_Y - p.y) / 330, 0, 1), sa = (1 - hh * 0.75) * 0.3 * (wt > 0 ? 0 : 1);
    if (wt <= 0) fightSpot(p.x, p.y);
    ctx.globalAlpha = sa; ctx.fillStyle = '#3a2a4d'; ctx.beginPath(); ctx.ellipse(p.x - 6, GROUND_Y - 4, 66 - hh * 22, 9 - hh * 3, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (F.n === 1) drawBalloonsWagon(F, p, sh, wt, cl);
  ctx.save(); ctx.translate(p.x + sh + wt * wt * 80, p.y - wt * wt * 70 + wt * 20); if (wt > 0 && !calmOn()) ctx.rotate(wt * 4.5);
  ART.boss(ctx, F.n, 0, 0, F.n >= 3 ? ftPose(F) : null); if (F.ph === 'won') cryChimp(co[0], co[1], co[2]);
  ctx.restore();
  drawLimes(F);
  for (i = 0; i < F.list.length; i++) {
    a = F.list[i];
    if (a.k === 'coco' && !a.live) { if (F.hp) ART.fxs(ctx, 'coco', p.x + F.hp[0], p.y + F.hp[1], 0); else ART.fxs(ctx, 'coco', a.x, a.y - 15 - (cl ? 0 : Math.abs(Math.sin(time * 9)) * 3), 0); continue; }   // held up in the hand
    if (!a.live) continue;
    if (a.k === 'waf') { if (a.x < p.x + a.ox - 46) ART.mg.draw(ctx, 'wafer', a.x, a.y, undefined, 1); }
    else if (a.k === 'fist') { fl = cl ? 0 : Math.sin(time * 40) * 5; ctx.fillStyle = 'rgba(200,205,225,0.4)'; for (g = 0; g < 3; g++) { ctx.beginPath(); ctx.arc(a.x + 54 + g * 17, a.y + Math.sin(time * 9 + g * 2) * 3, 6 + g * 2, 0, 7); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,140,50,0.85)'; ctx.beginPath(); ctx.moveTo(a.x + 12, a.y - 9); ctx.quadraticCurveTo(a.x + 30, a.y - 6, a.x + 50 + fl, a.y); ctx.quadraticCurveTo(a.x + 30, a.y + 6, a.x + 12, a.y + 9); ctx.fill(); ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.moveTo(a.x + 12, a.y - 5); ctx.quadraticCurveTo(a.x + 24, a.y - 3, a.x + 36 + fl * .6, a.y); ctx.quadraticCurveTo(a.x + 24, a.y + 3, a.x + 12, a.y + 5); ctx.fill(); if (a.x < p.x + a.ox - 46) ART.fxs(ctx, 'fist', a.x, a.y, 0); }
    else if (a.k === 'cook') { if (a.x > bx) ftRing(a); ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(cl ? 0 : time * 7); ART.mg.draw(ctx, 'wafer', 0, 0, undefined, 1); ctx.restore(); }
    else if (a.k === 'coco') { ART.fxs(ctx, 'coco', a.x, a.y, time * 8); if (a.tg) { ctx.lineWidth = 2.4; ctx.strokeStyle = '#9be84a'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 24); ctx.beginPath(); ctx.arc(a.x, a.y, a.r + 5, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; } }
    else if (a.k === 'wave') { ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(a.x - 22, GROUND_Y); ctx.quadraticCurveTo(a.x - 6, GROUND_Y - 62, a.x + 8, GROUND_Y - 46); ctx.quadraticCurveTo(a.x + 16, GROUND_Y - 20, a.x + 24, GROUND_Y); ctx.closePath(); fl = ctx.createLinearGradient(0, GROUND_Y - 62, 0, GROUND_Y); fl.addColorStop(0, '#fff8d0'); fl.addColorStop(0.6, '#ffd95a'); fl.addColorStop(1, '#f0a830'); ctx.fillStyle = fl; ctx.fill(); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.moveTo(a.x - 12, GROUND_Y - 30); ctx.quadraticCurveTo(a.x - 4, GROUND_Y - 54, a.x + 4, GROUND_Y - 44); ctx.stroke();
      ctx.fillStyle = 'rgba(240,222,176,0.8)'; for (g = 0; g < 3; g++) { ctx.beginPath(); ctx.arc(a.x + 30 + g * 13, GROUND_Y - 5 - g * 2, 7 - g * 1.6, 0, 7); ctx.fill(); } }
  }
}
function drawLimes(F) {   // the rocket limes: a little flame behind each, then the lime pointing where it flies
  var i, L, an, f;
  for (i = 0; i < F.limes.length; i++) {
    L = F.limes[i]; an = Math.atan2(L.vy, L.vx); f = calmOn() ? 0 : Math.sin(time * 60 + i) * 2;
    ctx.save(); ctx.translate(L.x, L.y); ctx.rotate(an);
    ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.moveTo(-9, -3.4); ctx.quadraticCurveTo(-18, 0, -25 + f, 0); ctx.quadraticCurveTo(-18, 0, -9, 3.4); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff2a0'; ctx.beginPath(); ctx.moveTo(-9, -1.8); ctx.lineTo(-17 + f * 0.5, 0); ctx.lineTo(-9, 1.8); ctx.closePath(); ctx.fill();
    ctx.restore(); ART.fxs(ctx, 'lime', L.x, L.y, an);
  }
}
function drawPieces(g, cx, cy, s) {   // the three crown pieces (lit once earned), or the whole crown once the Duel is won
  var i, on, x;
  if (save.unlocks.crown || pcBeaten(4)) { g.save(); g.translate(cx, cy + 8 * s); ART.crown(g, 1.5 * s); g.restore(); return; }
  g.lineJoin = 'round';
  for (i = 0; i < 3; i++) {
    on = pcBeaten(i + 1); x = cx + (i - 1) * 26 * s; g.beginPath(); g.moveTo(x - 11 * s, cy + 11 * s); g.lineTo(x, cy - 13 * s); g.lineTo(x + 11 * s, cy + 11 * s); g.closePath();
    g.fillStyle = on ? '#f0bf45' : 'rgba(58,42,77,0.16)'; g.fill(); g.lineWidth = 2.2; g.strokeStyle = on ? INK : 'rgba(58,42,77,0.4)'; g.stroke();
    if (on) { g.beginPath(); g.arc(x, cy + 3 * s, 3.2 * s, 0, 7); g.fillStyle = ['#ff4a6a', '#4fb8ff', '#4fe0a0'][i]; g.fill(); g.lineWidth = 1.2; g.stroke(); }
  }
}
function drawBlast(F) {   // the encouraging word: it pops in with a bounce, sits with slowly turning rays behind it, then fades
  var B = F.blast, t = B.t, cl = calmOn(), sc = cl ? 1 : easeOutBack(clamp(t / 0.4, 0, 1)), al = clamp((2.1 - t) / 0.5, 0, 1), i, an;
  ctx.save(); ctx.translate(W / 2, 250); ctx.globalAlpha = al * 0.9;
  if (!cl) { ctx.save(); ctx.rotate(t * 0.5); ctx.fillStyle = B.f ? 'rgba(255,236,140,0.2)' : 'rgba(255,255,255,0.13)'; ctx.beginPath(); for (i = 0; i < 12; i++) { an = i * 0.5236; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * 220 * sc, Math.sin(an) * 220 * sc); ctx.lineTo(Math.cos(an + 0.13) * 220 * sc, Math.sin(an + 0.13) * 220 * sc); ctx.closePath(); } ctx.fill(); ctx.restore(); }
  ctx.globalAlpha = al;
  if (sc === 1) stillDraw('blast' + B.f + '|' + B.w + '|' + B.s + '|' + B.c, -200, -80, 400, 170, function () { ctx.save(); if (!cl) ctx.rotate(-0.07); outlined(B.w, 0, 0, B.f ? 46 : 40, B.c, 'center', B.f ? 46 : 40); outlined(B.s, 0, 36, 17, '#ffffff', 'center', 17); ctx.restore(); });   // settled: the tilted word is one picture stamped on whole device pixels (a turned picture is resampled every frame)
  else { ctx.scale(sc, sc); if (!cl) ctx.rotate(-0.07); outlined(B.w, 0, 0, B.f ? 46 : 40, B.c, 'center', B.f ? 46 : 40); outlined(B.s, 0, 36, 17, '#ffffff', 'center', 17); }
  ctx.restore(); ctx.globalAlpha = 1;
}
function drawFtHud() {   // three round segments, each with a star at its end that lights when that round is survived
  var F = FT, gap = 7, sw = 62, x0 = W / 2 - (3 * sw + 2 * gap) / 2, i, x, u, done, cur, sx, sy, j, an, rad;
  if (F.blast) { ctx.save(); ctx.translate(0, HUDUP); drawBlast(F); ctx.restore(); }
  if (F.ph === 'intro') return;
  for (i = 0; i < 3; i++) {
    x = x0 + i * (sw + gap); done = F.ph === 'won' || i < F.r; cur = i === F.r && !done; u = done ? 1 : cur ? clamp(F.rt / FT_ROUND, 0, 1) : 0;
    if (F.ph === 'between' || F.ph === 'retry' || F.ph === 'intro') u = cur ? 0 : u;
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; rrect(x, 108, sw, 12, 6); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill(); ctx.stroke();
    if (u > 0) { rrect(x + 1, 109, Math.max(10, (sw - 2) * u), 10, 5); ctx.fillStyle = done ? '#ffd93b' : '#ff6b81'; ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.45)'; rrect(x + 4, 110.5, Math.max(4, (sw - 8) * u), 2.6, 1.3); ctx.fill(); }
    sx = x + sw - 1; sy = 114; rad = done ? 8 : 6; ctx.beginPath(); for (j = 0; j < 10; j++) { an = -1.5708 + j * 0.6283; ctx.lineTo(sx + Math.cos(an) * (j % 2 ? rad * 0.46 : rad), sy + Math.sin(an) * (j % 2 ? rad * 0.46 : rad)); } ctx.closePath();
    ctx.fillStyle = done ? '#ffd93b' : 'rgba(255,255,255,0.55)'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
  }
  outlined(FIGHTS[F.n - 1][0] + '  -  ' + (F.ph === 'won' ? 'Beaten!' : 'Round ' + (F.r + 1) + ' of 3'), W / 2, 136, 14, '#ffffff');
}
function ftCards() {
  var F = FT, t = rsgT, a, n = F.n;
  if (F.ph === 'intro' && t >= 0 && t < CFG.cardSecs) { a = clamp(Math.min(t / 0.3, (CFG.cardSecs - t) / 0.3), 0, 1); ctx.globalAlpha = a; outlined(FIGHTS[n - 1][0] + '!', W / 2, 168, 38, '#ffd93b'); outlined(FIGHTS[n - 1][1], W / 2, 212, 15, '#ffffff'); outlined(FIGHTS[n - 1][2], W / 2, 236, 16, '#ffffff'); outlined('Survive 3 rounds. A hit only repeats the round.', W / 2, 260, 13, '#ffffff'); ctx.globalAlpha = 1; }
  else if (F.ph === 'won') { a = clamp(F.t / 0.4, 0, 1); ctx.globalAlpha = a; outlined(n < 4 ? 'Crown piece ' + n + ' of 3!' : 'Crown Duel won!', W / 2, 190, 34, '#ffd93b'); outlined(n < 4 ? 'Prince Chimp gives up... for now!' : 'Prince Chimp is crying again.', W / 2, 228, 16, '#ffffff'); if (!F.hits) outlined('No hits! +15 bonus', W / 2, 256, 18, '#7be07b'); drawPieces(ctx, W / 2, 312 + Math.sin(time * 4) * 3, 1.5); ctx.globalAlpha = 1; }
}
function nightLive() { return runChal === 'night' && state === 'play' && !BAL && !(FT && FT.ph !== 'wait') && !VAULT && cardT < 0 && !rsgHold() && spinT <= 0; }
function colorIdx(k) { var i = save.unlocks[k]; return i >= 1 && i <= 4 && badgeOf(i - 1) ? i : 0; }
function applyColors() { ART.setColors(MASKS[colorIdx('mask')][1], SCARFS[colorIdx('scarf')][1]); }
function drawNight() {   // darkness with a soft flashlight round Fancy
  var a = nightA * (calmOn() ? 0.84 : 0.94), g = ctx.createRadialGradient(0, 0, 96, 0, 0, 236);
  g.addColorStop(0, 'rgba(8,12,46,0)'); g.addColorStop(1, 'rgba(8,12,46,' + a.toFixed(2) + ')');
  ctx.save(); ctx.translate(mx(bx), mirY(by)); ctx.scale(1, 1.2); ctx.fillStyle = g; ctx.fillRect(-W * 2, -H * 2, W * 4, H * 4); ctx.restore();
}
function drawWafer(o) {
  var x = o.x + o.waf.dx; if (x < -30 || x > W + 30) return;
  ctx.globalAlpha = 0.25; ctx.fillStyle = '#3a2a4d'; ctx.beginPath(); ctx.ellipse(x + 3, o.waf.y + 17, 13, 4, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  ART.mg.draw(ctx, 'wafer', x, o.waf.y);
}
function huntOn() { return save.stats.wins >= 2; }
function frFound(i) { return !!save.unlocks['f' + i]; }
function frCount() { var n = 0, i; for (i = 0; i < 6; i++) if (frFound(i)) n++; return n; }
function bunchOk() { return frCount() >= 6; }
function bunchOn() { return bunchOk() && !save.unlocks.bunchOff; }
function secretsAll() { var n = 0, i; for (i = 0; i < SEC_KEYS.length; i++) if (save.unlocks[SEC_KEYS[i]]) n++; return n + (bunchOk() ? 1 : 0); }
function secretFound(k, msg) { if (!save.unlocks[k]) { save.unlocks[k] = 1; persist(); if (msg) toast(msg, 4500); } }
function frCollect(i) {
  save.unlocks['f' + i] = 1; giveCoins(3, bx + 20, by); burst(bx + 20, by, 26, ['#ffd93b', '#ffffff', '#7be07b'], 260, 260); pop('Found ' + FR_NAMES[i] + '!', '#7be07b', 24);
  if (bunchOk()) { toast('All six lost friends found! The Banana Bunch now hangs on the back of Fancy (see Costume).', 6000); giveCoins(10, bx + 20, by); }
  else toast('A lost friend: ' + FR_NAMES[i] + '! ' + frCount() + ' of 6 found.', 3500);
  persist();
}
/* Bonus rooms: a few seconds of nothing but golden bananas. The sky vault (hug the top edge) and the junk drawer (skim the floor) open in the quiet stretch at the start of a run or after a stage (the drawer only before the Silverware Drawer); the golden gate warps you in. */
var VAULT = null, hugT = 0, hugKind = '', goldNext = 8;
function quietAhead() { for (var i = 0; i < obs.length; i++) { var o = obs[i]; if (o.x < bx + 170 && o.x + CFG.obW > bx - 50) return false; } return true; }
function hugWant() {
  if (VAULT || !runSec() || pracN || BAL || FT || pendNext || cardT >= 0 || rsgHold() || spinT > 0 || grace > 0 || !quietAhead()) return '';
  if (by < 60) return 'sky';
  if (by + CFG.bananaR > GROUND_Y - 90 && themeOf(stage) === CFG.miniAfter && score === gateStart(stage)) return 'drawer';   // the junk drawer: only in the quiet stretch before the Silverware Drawer's first gate
  return '';
}
function hugStep(dt) {
  var k = hugWant();
  if (k) { if (k !== hugKind) { hugKind = k; hugT = 0; } hugT += dt; if (hugT >= CFG.hugSecs) startVault(k); }
  else { hugT = Math.max(0, hugT - dt * 0.6); if (hugT <= 0) hugKind = ''; }
}
function startVault(kind) {
  var n = kind === 'gold' ? CFG.goldN : kind === 'drawer' ? CFG.drawerN : CFG.vaultN, sx = kind === 'gold' ? 28 : kind === 'drawer' ? 36 : 34, cs = [], i, y;
  hugT = 0; hugKind = '';
  for (i = 0; i < n; i++) {
    y = kind === 'sky' ? 230 + Math.sin(i * 0.62) * 105 : kind === 'gold' ? 250 + Math.sin(i * 0.55) * 120 : GROUND_Y - 62 - Math.abs(Math.sin(i * 0.5)) * 272;   // lazy waves up high; a bigger wave; bouncy arcs off the floor
    cs.push({ x: W + 50 + i * sx, y: y, got: false, ph: i * 0.7 });
  }
  VAULT = { kind: kind, t: 0, cs: cs, got: 0, n: n, bz: 0 };
  obs = []; spawned = score; nextX = 1e9; lastAfter = 0; wasCtrl = true;
  burst(bx + 10, by, 30, kind === 'gold' ? ['#ffd93b', '#fff2a0', '#ffffff'] : ['#bfa8ff', '#ffffff', '#ffd93b'], 280, 280);
  pop(kind === 'gold' ? 'GOLDEN WARP!' : kind === 'drawer' ? 'JUNK DRAWER!' : 'SKY VAULT!', '#ffd93b', 28);
  secretFound(kind === 'gold' ? 'gold' : kind === 'drawer' ? 'drawer' : 'vault', kind === 'gold' ? 'Secret found: the Golden Gate!' : kind === 'drawer' ? 'Secret found: the Junk Drawer!' : 'Secret found: the Sky Vault!');
}
function vaultStep(dt, sp) {
  var v = VAULT, i, c, dx, dy, d2, dd, pl, R = magR(), cr = CFG.bananaR + CFG.coinR;
  v.t += dt; if (v.bz > 0) v.bz = Math.max(0, v.bz - dt * 1.6);
  for (i = 0; i < v.cs.length; i++) {
    c = v.cs[i]; c.x -= sp * dt; if (c.got) continue;
    dx = c.x - CFG.bananaX; if (dx > R || dx < -R) continue; dy = c.y - by; d2 = dx * dx + dy * dy;
    if (d2 < cr * cr) { c.got = true; v.got++; giveCoins(1, c.x, c.y); }
    else if (d2 < R * R) { dd = Math.sqrt(d2); pl = (1 - dd / R) * CFG.magnetV * dt / dd; c.x -= dx * pl; c.y -= dy * pl; }
  }
  if (v.cs[v.cs.length - 1].x < -40) vaultEnd();
}
function vaultEnd() {
  var v = VAULT; VAULT = null;
  if (v.got === v.n) { giveCoins(6, bx + 20, by); pop('ALL ' + v.n + '! +6', '#ffd93b', 26); } else pop(v.got + ' of ' + v.n, '#ffffff', 22);
  nextX = W + CFG.obW + 30; lastC = clamp(by, 170, GROUND_Y - 170); lastAfter = 0;
}
function drawVaultBack() {
  var v = VAULT, i, x, y;
  if (!v) return;
  if (v.kind === 'sky') {
    ctx.fillStyle = 'rgba(20,14,70,0.5)'; ctx.fillRect(0, 0, W, GROUND_Y);
    for (i = 0; i < 36; i++) { x = ((i * 83.7 - v.t * (14 + (i % 5) * 7)) % W + W) % W; y = (i * 47.3) % (GROUND_Y - 40); ctx.globalAlpha = 0.45 + 0.4 * Math.sin(time * 3 + i); ctx.fillStyle = '#fff6c0'; ctx.fillRect(x, y, 2 + (i % 3), 2 + (i % 3)); }
    ctx.globalAlpha = 1;
  } else if (v.kind === 'gold') {
    ctx.fillStyle = 'rgba(150,90,0,0.32)'; ctx.fillRect(0, 0, W, GROUND_Y);
    ctx.fillStyle = 'rgba(255,230,120,0.7)';
    for (i = 0; i < 16; i++) { x = W - ((v.t * 620 + i * 91) % (W + 90)); y = (i * 53.7) % (GROUND_Y - 10); ctx.fillRect(x, y, 70, 2); }
  } else {
    ctx.fillStyle = 'rgba(95,55,25,0.45)'; ctx.fillRect(0, 0, W, GROUND_Y);
    for (i = 0; i < 9; i++) { x = ((i * 117 - v.t * 90) % (W + 60) + W + 60) % (W + 60) - 30; y = 90 + (i * 61) % 340; ctx.fillStyle = ['#e8c07a', '#7ad8ff', '#ff8aa0'][i % 3]; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(40,20,10,0.6)'; ctx.fillRect(x - 4, y - 3, 2, 2); ctx.fillRect(x + 2, y - 3, 2, 2); }
    ctx.lineWidth = 5; ctx.lineCap = 'round';
    ['#ff6b81', '#ffd93b', '#7ad8ff'].forEach(function (c, j) { ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(0, GROUND_Y - 8 - j * 7); for (var q = 1; q <= 12; q++) ctx.lineTo(q * 30, GROUND_Y - 8 - j * 7 + Math.sin(q * 1.3 + time * 20) * 9 * v.bz); ctx.stroke(); });
  }
}
function drawVaultFront() {
  var v = VAULT, i, c;
  if (!v) return;
  for (i = 0; i < v.cs.length; i++) { c = v.cs[i]; if (!c.got && c.x > -20 && c.x < W + 20) ART.coin(ctx, c.x, c.y + Math.sin(time * 3 + c.ph) * 2.5, time + c.ph); }
  if (v.t < 2.2) { ctx.globalAlpha = clamp(2.2 - v.t, 0, 1); outlined(v.kind === 'gold' ? 'Golden Warp!' : v.kind === 'drawer' ? 'The Junk Drawer!' : 'The Sky Vault!', W / 2, 150, 34, '#ffd93b'); ctx.globalAlpha = 1; }
  outlinedC(v.got + ' / ' + v.n, W / 2, 124, 20, '#ffffff');
}
function drawGold(o) {
  var a = 0.26 + 0.12 * Math.sin(time * 6), x = o.x - 4, w = CFG.obW + 8, i, sx, sy;
  ctx.fillStyle = 'rgba(255,217,59,' + a.toFixed(2) + ')'; ctx.fillRect(x, o.gt, w, o.gb - o.gt);
  ctx.strokeStyle = '#ffd93b'; ctx.lineWidth = 3; ctx.strokeRect(x, o.gt, w, o.gb - o.gt);
  for (i = 0; i < 4; i++) { sx = x + 6 + ((i * 37 + time * 40) % (w - 12)); sy = o.gt + 8 + ((i * 53 + time * 30) % (o.gb - o.gt - 16)); ctx.fillStyle = '#fffbe0'; ctx.fillRect(sx - 1, sy - 4, 2, 8); ctx.fillRect(sx - 4, sy - 1, 8, 2); }
}
function drawHug() {   // a hint for those who look: a faint shimmer on the edge, and a bar that fills while you hold still
  if (state !== 'play' || VAULT || !runSec() || pracN || BAL || pendNext || cardT >= 0 || rsgHold() || !quietAhead()) return;
  var top = by < 130, flr = themeOf(stage) === CFG.miniAfter && score === gateStart(stage) && by > GROUND_Y - 170, fy = GROUND_Y - 3, a;
  if (top) { a = 0.12 + 0.1 * Math.sin(time * 5); ctx.fillStyle = 'rgba(255,217,59,' + a.toFixed(2) + ')'; ctx.fillRect(0, 0, W, 6); }
  if (flr) { a = 0.1 + 0.08 * Math.sin(time * 5); ctx.fillStyle = 'rgba(255,107,129,' + a.toFixed(2) + ')'; ctx.fillRect(0, fy - 4, W, 6); }
  if (hugT > 0) { ctx.fillStyle = '#ffd93b'; ctx.fillRect(0, hugKind === 'drawer' ? fy - 4 : 0, W * clamp(hugT / CFG.hugSecs, 0, 1), 6); }
}
function die() {
  if (pendNext === 'win') return;   // the last gate is cleared: the victory is on its way, nothing can undo it now
  if (secondWind()) return;
  kOn = false; kCh = 0; kEcho.length = 0; kHint = 0; sKon = false; sKch = 0;
  state = 'dead'; deadT = 0; vy = -200; cardT = -1; pendNext = ''; nextT = 0; rsgT = -1; celT = 0;
  /*TEST_HOOK_START*/ var _a = performance.now(), _b, _c, _d; /*TEST_HOOK_END*/
  if (pracN) { pracEnd = 'lose'; newBest = false; } else recordRun(); /*TEST_HOOK_START*/ _b = performance.now(); /*TEST_HOOK_END*/
  setTimeout(persist, 400); setTimeout(function () { if (state === 'dead' && !pracN) { setBar(true); saveHint(); exportHint(); assistNote(); } }, 140);   // storage writes and a DOM change are slow on phones: never on the frame of the hit
  /*TEST_HOOK_START*/ _c = _d = performance.now(); /*TEST_HOOK_END*/ ART.warm(themeOf(1), true);   // build the first stage's pictures while the Oops card shows, so the next try starts instantly
  /*TEST_HOOK_START*/ DIET = [_b - _a, _c - _b, _d - _c, performance.now() - _d]; /*TEST_HOOK_END*/
}
var pumpCr = 0;
function pumpPlan() {
  var n;   // [steps, ms] to build this frame when the next stage's pictures (or the water level's) are behind schedule, else null. The build must finish before the next look's first gate is drawn: a stage that is not ready is built in ONE frame then, which on a slow laptop is a long freeze.
  /*TEST_HOOK_START*/ if (window.__noPlan) return null; /*TEST_HOOK_END*/
  if (state === 'mini' && MG && !MG.practice && !pracN) {   // the water bonus game: the look of the stage that follows (the garden's long picture is about 370 small steps) is built an even share each frame over the seconds left, and quickly once the game is over, so nothing is left to build in one go when the flight resumes
    var lf = ART.pend(themeOf(stage), false), tm;
    if (!lf) { pumpCr = 0; return null; }
    if (MG.ph === 'win' || MG.ph === 'lose') return [4, 8];
    tm = Math.max(0.5, CFG.mgSecs - (MG.ph === 'play' ? mgLT(MG) : 0));
    pumpCr += Math.min(3, lf / Math.max(0.25, tm * 36) * 1.35); n = Math.min(4, Math.floor(pumpCr)); pumpCr -= n; return n > 0 ? [n, 0] : null;
  }
  if (state !== 'play' || pracN || BAL || FT) { pumpCr = 0; return null; }
  var mgs = themeOf(stage) === CFG.miniAfter, left = ART.pend(mgs ? -1 : themeOf(stage + 1), mgs), g, tl;
  if (!left || (!mgs && themeOf(stage + 1) === themeOf(stage))) { pumpCr = 0; return null; }
  g = Math.max(1, gateStart(stage + 1) - score); tl = (g * CFG.spacing) / Math.max(80, speedFor(stage));
  pumpCr += Math.min(3, left / Math.max(0.25, tl * 36) * 1.35); n = Math.min(4, Math.floor(pumpCr)); pumpCr -= n;   // an even trickle over the time that is left (about 36 frames a second assumed)
  if (tl < 3) { n = Math.max(n, 2); return [n, 6]; }   // nearly out of time: a bigger share every frame
  return n > 0 ? [n, 0] : null;
}
function pumpFrame(fs) { if (state === 'victory' && vicT < vicDone()) return; var pp = pumpPlan();   // the victory card plays without background building (one balloon or Chimp picture is 10 to 20 ms); the building carries on once the table is complete
  if (pp) ART.pump(pp[1], pp[0]); else if (performance.now() - fs < 6 || ++pumpSkip >= 4) { pumpSkip = 0; ART.pump(CFG.pumpMs); } }
function split(label) { if (!pracN) { clkSp.push([label, clk]); if (clkSp.length > 14) clkSp.shift(); } }
function fmtClk(t) { var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
function drawClock(cx, ax) {   // the run timer under the pause button, with the last few split times under it
  var lh = opt('lefty'), n = Math.min(4, clkSp.length), i;
  if (clk >= 600) cx = clamp(cx, 40, W - 40);   // ten minutes or more is one more digit: keep it on the screen
  outlinedC(fmtClk(clk), cx, 29 + PBR + 14, 16, '#ffffff');
  for (i = 0; i < n; i++) { var e = clkSp[clkSp.length - n + i]; outlined(e[0] + ' ' + fmtClk(e[1]), ax !== undefined ? ax : lh ? 8 : W - 8, 29 + PBR + 33 + i * 15, 12.5, '#ffe9a0', lh ? 'left' : 'right'); }   // a finished split never changes: one picture per line
}
function stageUp() {
  var done = themeOf(stage); cardStage = stage; split('S' + stage); stage++; save.stats.friends += CFG.friendsPerStage;
  giveCoins(CFG.stageCoins, bx + 20, by); burst(bx + 20, by, 26, ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'], 300, 340); pop('Stage bonus +' + CFG.stageCoins + '!', '#ffd93b', 22);   // a little fanfare
  pendNext = done === CFG.miniAfter ? 'mini' : done === CFG.finalTheme ? 'win' : done === CFG.balAfter && save.unlocks.balloons && !pracN ? 'balloons' : done === CFG.bal2After && empOwn(E.keyBal) && !pracN ? 'balloons' : '';
  balNight = pendNext === 'balloons' && done === CFG.bal2After;
  if (pendNext !== 'mini' && pendNext !== 'balloons') { bgFrom = bgTheme; bgTheme = themeOf(stage); bgT = bgFrom === bgTheme ? 1 : 0; if (bgTheme === ART.journeyTheme) gardenD0 = dist; }   // before the water bonus the scene stays put (no glimpse of the next stage): it washes out to white into the mini game
  if (stage >= CFG.bowStage && !save.unlocks.bow) { save.unlocks.bow = true; toast('New costume unlocked: a bow tie for Fancy!'); }
  if (pendNext === 'win') { save.stats.wins++; save.stats.friends += CFG.winBonus; nextT = 0.8; grace = 1.2; vy = 0; if (runChal && !pracN) { var bk = 'b_' + runChal; if (!save.unlocks[bk]) { save.unlocks[bk] = 1; badgeNew = CHAL[chalIdx() - 1][1]; } } }   // the finale gets its own victory screen instead of a stage card
  else { cardT = 0; cardY = cardGoal = mirY(by) < 335 ? 345 : 125; nextT = pendNext ? CFG.cardSecs + 0.35 : 0; rsgT = 0; rsgGo = false; rsgTap = false; celT = CFG.celSecs; }   // a little celebration roll, once around
  if (pendNext !== 'win' && !pracN) save.cont = { st: stage, tm: Math.round(runSecs) };   // where to carry on if the tab is closed mid-run
  if (pendNext !== 'win' && themeOf(stage + 1) !== themeOf(stage)) ART.warm(themeOf(stage + 1));   // start building the look of the stage after this one right away (it used to wait for the first gate: too late on a slow laptop)
  persist();
}
function onHidden() {
  keys = {}; kHeld.key = false; kHeld.ptr = false; resT = -1; if (state === 'mini') mgPause(true); if (state === 'sky') skyPause(true); if (state === 'volc') volcPause(true);
  if (state === 'play') { state = 'paused'; runPauses++; noteBest(); }
  wlSync();   // a paused game no longer wants the lock
  persist();
}
/* Keep the screen awake while a run is going (the browser lets go by itself when the tab is hidden, so ask again when it is back) */
var wk = WakeKeeper.create({ refusalBackoffMs: 8000 });   // WakeKeeper: the lean build of wake-keeper from JS-modules (smallparts.js); it asks again on its own when the tab comes back, and waits 8 s after a refusal
function wlWant() { return state === 'launch' || state === 'play' || state === 'mini' || state === 'sky' || state === 'volc'; }
function wlSync() { wk.want(wlWant()); }
/* Safari clears a site's saved data after a week without a visit (a Home Screen app is exempt): say so once, kindly */
function saveAtRisk() {
  var ua = navigator.userAgent || '', ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1), webkit = /AppleWebKit/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg\/|Android|OPR/.test(ua);
  var home = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  return (ios || webkit) && !home && location.protocol !== 'file:';
}
function saveHint() {
  if (save.opts.hintSafari || save.bestStage < 2 || !saveAtRisk()) return;
  save.opts.hintSafari = 1; persist();
  toast('Tip: Safari clears saved games after a week away. Open Save to copy your save code, or add Fancy to your Home Screen.', 8000);
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { }); } catch (e) { }
}
function inRun() { return state === 'play' || state === 'mini' || state === 'sky' || state === 'volc'; }
function finePointer() { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { return false; } }
addEventListener('blur', function (e) { if (e.target === window) { keys = {}; kHeld.key = false; kHeld.ptr = false; if (inRun() && !document.hidden && !dlHold && finePointer()) onHidden(); } });   // alt-tab or a click on another window pauses a run on a computer (the file chooser is exempt: dlHold); a phone keeps going, because a blur there is often only the keyboard or a bar
document.addEventListener('visibilitychange', function () { if (document.hidden) onHidden(); else wlSync(); });
addEventListener('pagehide', onHidden);

function circleRect(cx, cy, r, rx, ry, rw, rh) {
  var nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh), dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
function hits(o) {
  for (var i = 0; i < o.rects.length; i++) { var r = o.rects[i]; if (circleRect(CFG.bananaX, by + 1, CFG.bananaR, o.x + r[0], r[1], r[2], r[3])) return true; }
  return false;
}

function update(dt) {
  if (shd.length) shardStep(dt);
  nightA = clamp(nightA + (nightLive() ? 1 : -1) * dt * 2.5, 0, 1);
  if (state === 'play' || state === 'dead') { var fw = flipWant(); if (flipV !== fw && !((pendNext === 'mini' || pendNext === 'balloons' || pendNext === 'win') && !calmOn())) flipV = calmOn() ? fw : fw > flipV ? Math.min(1, flipV + dt / 0.9) : Math.max(0, flipV - dt / 0.9); }   // the flip takes under a second (at once in Calm mode)
  time += dt; if (state === 'launch' || state === 'play' || (state === 'mini' && MG && !MG.paused && MG.ph !== 'lose')) runSecs += dt; if (state === 'play' || (state === 'launch' && launchT >= 0) || (state === 'mini' && MG && !MG.paused && MG.ph !== 'lose')) clk += dt; if (flapAnim > 0) flapAnim -= dt; if (punchT > 0) punchT -= dt; if (whooshT > 0) whooshT -= dt; if (invuln > 0) invuln -= dt; if (flashT > 0) flashT -= dt; if (celT > 0) celT = Math.max(0, celT - dt);
  for (var ti = tapFx.length - 1; ti >= 0; ti--) { tapFx[ti].t += dt; if (tapFx[ti].t > 0.4) tapFx.splice(ti, 1); }
  for (var pi = pops.length - 1; pi >= 0; pi--) { pops[pi].t += dt; pops[pi].y -= 26 * dt; if (pops[pi].t > 1.1) pops.splice(pi, 1); }
  var mzx = 0, mzy = 0; if (smkMz) { if (FT && FT.n === 1 && smk.length) { var mzp = ftBoss(FT); mzx = mzp.x - 88 - smkMz.x; mzy = mzp.y + 25 - smkMz.y; smkMz.x += mzx; smkMz.y += mzy; } else smkMz = null; }
  if (smkEm > 0) { smkEm -= dt; smkEa += dt; if (FT && FT.n === 1 && smkMz) { while (smkEa >= 0.05) { smkEa -= 0.05; if (smk.length < 40) smk.push({ x: smkMz.x - 3 + frng() * 4, y: smkMz.y + (frng() - 0.5) * 5, vx: -(30 + frng() * 60), vy: -(14 + frng() * 30), r0: 5 + frng() * 3, r1: 18 + frng() * 14, l: 0.9 + frng() * 0.6, t: 0 }); } } else smkEm = 0; }   // for a moment after the shot the barrel keeps breathing smoke, so it trails from the muzzle
  for (var si = smk.length - 1; si >= 0; si--) { var sm = smk[si]; sm.t += dt; if (sm.t > sm.l) { smk.splice(si, 1); continue; } if (sm.t > 0) { var fol = Math.max(0, 1 - sm.t / 1.1); sm.x += sm.vx * dt + mzx * fol; sm.y += sm.vy * dt + mzy * fol; sm.vx -= sm.vx * 1.7 * dt; sm.vy -= (14 + sm.vy * 0.9) * dt; } }
  for (var f = fx.length - 1; f >= 0; f--) { var q = fx[f]; q.t += dt; if (q.t > q.l) { if (fxFree.length < 90) fxFree.push(q); fx[f] = fx[fx.length - 1]; fx.pop(); continue; } q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; }
  if (bgT < 1) { bgT = Math.min(1, bgT + dt / 0.9); if (bgT >= 1) ART.keep([bgTheme]); }
  if (state !== 'launch') zoomK = 1;
  gazeS += ((state === 'play' ? gazeTarget() : state === 'mini' ? -0.5 : Math.sin(time * 1.3) * 0.6) - gazeS) * Math.min(1, dt * 8);
  if (state === 'title') {
    titleT += dt; if (museW > 0) museW = Math.max(0, museW - dt * 2.5); by = H * 0.42 + Math.sin(time * 4) * 8; vy = 0; angle = Math.sin(time * 4) * 0.08; dist += 70 * dt;
  } else if (state === 'ready') {
    by = CFG.launchY + Math.sin(time * 4) * 3; angle = Math.sin(time * 4) * 0.03; vy = 0;
  } else if (state === 'launch') {
    launchT += dt;
    if (launchT < 0) {   // 3 - 2 - 1: the engine revs harder and harder
      var rv = 1 + (CFG.countSecs + launchT) / CFG.countSecs * 3;
      by = LP.fy + Math.sin(time * 110) * 1.2 * rv; bx = CFG.bananaX + Math.sin(time * 97) * 0.8 * rv; angle = 0; curSpeed = 0; windStep(dt);
      if (frng() < 0.35 * rv) fxAdd(bx - 30, by + 10, -(40 + frng() * 70), -15 - frng() * 30, 0.5 + frng() * 0.3, frng() < 0.5 ? '#ffffff' : '#e8e0ff', 3 + frng() * 3, false, -30);
      return;
    }
    var u = Math.min(1, launchT / CFG.launchSecs), s0 = LTOT * (0.03 * u + 0.97 * Math.pow(u, 2.3)), P = pathAt(s0), ax = anchorX(s0), nt = ax - P.X;   // a slow rev-up, then faster and faster
    scrollDX = nt - trackX; trackX = nt; bx = ax + P.x - P.X; by = P.y; angle = P.r; curSpeed = Math.max(0, -scrollDX / dt);
    zoomK = calmOn() ? 1 : 1 + 0.13 * ss((s0 - (FLAT1 - 100)) / 150) * (1 - ss((s0 - FLAT1 - LOOPLEN * 0.65) / (LOOPLEN * 0.35 + 60))); zoomX = trackX + LP.x1;   // the camera swoops in toward the loop and back out
    dist = (CFG.bananaX - LP.x0) - trackX;   // the ground slides exactly as fast as the track does, so they stay together
    trailStep(dt, scrollDX); windStep(dt);
    if (u < 0.2) by += Math.sin(time * 110) * 1.4 * (1 + u * 5);   // engine rumble while he revs up
    if (u < 0.35 && frng() < 0.5) fxAdd(bx - 30, by + 10, -(30 + frng() * 50), -20 - frng() * 30, 0.5 + frng() * 0.3, frng() < 0.5 ? '#ffffff' : '#e8e0ff', 3 + frng() * 3, false, -30);   // exhaust puffs
    else if (frng() < 0.6) fxAdd(bx - 14, by + 13, -(120 + frng() * 200), -60 + frng() * 90, 0.3 + frng() * 0.25, frng() < 0.5 ? '#ffd93b' : '#ff9a3b', 1.6 + frng() * 2, frng() < 0.25, 260);   // sparks off the track
    if (u >= 1) { state = 'play'; bx = CFG.bananaX; vy = CFG.launchVy; flapAnim = 0.18; boost = CFG.boostV; boostT = 0; grace = 0; punchT = calmOn() ? 0 : CFG.punchSecs; flashT = calmOn() ? 0 : 0.25; whooshT = 0.9; burst(bx + 10, by, 30, ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'], 320, 400); spinT = CFG.spinSecs; }
  } else if (state === 'play') {
    runTime += dt;
    if (rsgT >= 0) { rsgT += dt; if (tapWaitOn && !rsgTap && !pendNext && rsgT >= CFG.cardSecs && rsgT < rsgGoAt()) { rsgT = CFG.cardSecs; rsgWait = true; rsgK = 0; } else { if (rsgWait) rsgWait = false; } if (rsgT >= rsgGoAt() + 0.55) rsgT = -1; else if (rsgT >= rsgGoAt() && !rsgGo) { rsgGo = true; grace = CFG.graceSecs + 0.15; vy = 0; flapAnim = 0.18; burst(bx + 14, by, 18, ['#7be07b', '#ffd93b', '#ffffff'], 220, 260); } }
    var hov = rsgHold(), ctrl = !hov && spinT <= 0 && grace <= 0;
    if (ctrl && !wasCtrl && time - tapBufT <= 0.12) { vy = CFG.flapV; flapAnim = 0.18; fallD = 0; }   // a tap just before control came back is not lost
    wasCtrl = ctrl;
    if (cardT >= 0) {
      cardT += dt; if (cardT > CFG.cardSecs) cardT = -1;
      if (hov) cardGoal = 345; else if (cardGoal === 125 && by < 300) cardGoal = 345; else if (cardGoal === 345 && by > 370) cardGoal = 125;   // the card moves to the half Fancy is not in
      cardY += clamp(cardGoal - cardY, -1200 * dt, 1200 * dt);
    }
    if (hov) { vy = 0; by += (CFG.rsgY + Math.sin(time * 4) * 4 - by) * Math.min(1, dt * 4); }   // Ready, Set: Fancy floats by himself, so a child can rest a hand and get set to tap
    else if (spinT > 0) {   // the football spiral: Fancy rolls along his long axis while he coasts, then the player takes over
      spinT = Math.max(0, spinT - dt); var sk = spinT / CFG.spinSecs; vy = CFG.launchVy * sk * sk; if (spinT > 0) invuln = Math.max(invuln, 0.03);
      if (frng() < 0.7) { var sph = spinPhase(); fxAdd(bx - 22, by + Math.sin(sph) * 15, -(60 + frng() * 60), 0, 0.35, frng() < 0.5 ? '#ffffff' : '#ffe27a', 2 + frng() * 1.6, true, 0); }
      if (spinT === 0) { pop('Go!', '#7be07b', 28); gazeS = 0; }
    } else if (grace > 0) { grace -= dt; vy = 0; } else { vy = Math.min(CFG.maxFall, vy + CFG.gravity * (1 - 0.06 * lvl('gentle')) * dt); }
    // soft ceiling: Fancy may pop off the top of the screen for a moment, then is pulled back down (obstacles up there still hurt)
    if (by < 0) { topT += dt; if (topT > CFG.topFreeSecs) vy = Math.max(vy, CFG.topPull); } else topT = Math.max(0, topT - 2 * dt);
    kBy0 = by; by += vy * dt; if (vy > 0 && grace <= 0) fallD += vy * dt; else fallD = 0; if (hurtT > 0) hurtT -= dt; if (bngT > 0) bngT -= dt;
    angle = clamp(vy / 700, -0.5, 1.1);
    if (rsgT < 0 || !rsgWait && rsgK >= 1) rsgK = 1; else if (!rsgWait) rsgK = Math.min(1, rsgK + dt / 0.45);
    var sp = (speedFor(stage) + boost) * (rsgK >= 1 ? 1 : rsgK * rsgK * (3 - 2 * rsgK)) * (VAULT && VAULT.kind === 'gold' ? 1.35 : 1) * (BAL && BAL.night ? 1.12 : 1) * (lvl('potassium') ? kStep(dt) : 1); if (boostT < CFG.boostSecs) { boostT += dt; boost = boostT >= CFG.boostSecs ? 0 : CFG.boostV * (0.5 + 0.5 * Math.cos(Math.PI * boostT / CFG.boostSecs)); }   // the blast-off speed eases away slowly and smoothly (no sudden slow-down)
    var still = !!(FT && FT.n === 3 && FT.ph !== 'wait' && ART.arena.ready()), sp0 = sp;   // fight 3 happens in a clearing that does not scroll: the gorilla is squatting, so the world slows to a stop (the trail still streams back)
    ftStill = clamp(ftStill + (still ? dt : -dt) / 0.6, 0, 1); if (ftStill > 0) sp = sp0 * (1 - ss(ftStill));
    if (FT && FT.n === 3) { var cm = FT.ph === 'retry' ? 1 : FT.ph === 'between' ? 2 : FT.ph === 'won' ? 3 : 0; if (cm !== crowd.m) { crowd.p = crowd.m; crowd.m = cm; crowd.t = 0; } else crowd.t += dt; }
    dist += sp * dt; nextX -= sp * dt; curSpeed = sp; trailStep(dt, -sp0 * dt); windStep(dt);
    sparkT -= dt; if (sparkT <= 0) { sparkT = 0.07; fxAdd(bx - 30, by + 4 + (frng() - 0.5) * 12, -40 - frng() * 40, (frng() - 0.5) * 30, 0.45, frng() < 0.5 ? '#ffe27a' : '#ffffff', 1.6 + frng() * 1.6, true, 0); }
    if (trackOn) { trackX -= sp * dt; if (trackX < -520) trackOn = false; }
    for (var i = 0; i < obs.length; i++) { obs[i].x -= sp * dt; if (obs[i].mv) obMove(obs[i], dt); }
    if (FT) ftStep(dt, sp); if (BAL) { if (washA > 0) washA = Math.max(0, washA - dt / 0.7); updateBalloons(dt, sp); } if (flagsOn()) flagStep(dt, sp);
    if (BALR && (rsgT < 0 || rsgT >= CFG.cardSecs)) BALR = null;
    if (by + CFG.bananaR > GROUND_Y - 2) { by = GROUND_Y - CFG.bananaR; if (FT && FT.ph !== 'wait') { vy = -420; ftHit(); } else if (VAULT) { vy = VAULT.kind === 'drawer' ? -600 : -330; VAULT.bz = 1; burst(CFG.bananaX, by + 8, 8, ['#ffffff', '#ffd93b'], 120, 140); } else if (shield > 0) { shield--; boing(-CFG.bounceVy); } else if (bngT > 0) { bngT = 0; vy = -420; hurtT = 0.4; } else { die(); return; } }
    if (sKon) kSmash();
    var bonk = null;
    for (i = 0; i < obs.length && !bonk; i++) { var o = obs[i]; if (((o.x < CFG.bananaX + CFG.bananaR && o.x + CFG.obW > CFG.bananaX - CFG.bananaR) || (o.waf && Math.abs(o.x + o.waf.dx - CFG.bananaX) < 44)) && hits(o)) bonk = o; }
    if (bonk && invuln <= 0) {
      if (shield > 0) { shield--; boing(boingV((bonk.gt + bonk.gb) / 2)); }   // boing: Fancy springs toward the middle of the gap and flies on
      else { die(); return; }
    }
    var warp = false;
    for (i = 0; i < obs.length; i++) {
      o = obs[i];
      if (o.fr && !o.fr.got) { var fdx = o.x + o.fr.dx - CFG.bananaX, fdy = o.fr.y - by; if (fdx * fdx + fdy * fdy < 34 * 34) { o.fr.got = true; frCollect(o.fr.i); } }
      if (!o.mid && o.x + CFG.obW / 2 <= CFG.bananaX) { o.mid = true; o.yAt = by; }
      if (o.x < CFG.bananaX + CFG.bananaR + 8 && o.x + CFG.obW > CFG.bananaX - CFG.bananaR - 8) { var cl = clearance(o); if (cl < o.cc) o.cc = cl; }
      for (var ci = 0; ci < o.coins.length; ci++) {   // golden coins
        var cn = o.coins[ci]; if (cn.got) continue; var cdx = o.x + cn.dx - CFG.bananaX; if (cdx > magR() || cdx < -magR()) continue; var cdy = cn.y - by, cd2 = cdx * cdx + cdy * cdy;
        if (cd2 < (CFG.bananaR + CFG.coinR) * (CFG.bananaR + CFG.coinR)) { cn.got = true; giveCoins(1, o.x + cn.dx, cn.y); }
        else if (cd2 < magR() * magR()) { var cdd = Math.sqrt(cd2), pull = (1 - cdd / magR()) * CFG.magnetV * dt / cdd; cn.dx -= cdx * pull; cn.y -= cdy * pull; }   // coins drift toward Fancy when he is near
      }
      if (!o.passed && o.x + CFG.obW < CFG.bananaX - CFG.bananaR) {
        o.passed = true; score++; rateGate(o); if (o.gold && !VAULT && !FT) warp = true;
        if (score === gateStart(stage + 1)) { if (pracN) pracWin(); else stageUp(); }
        if (!pracN && runStartBest > 0 && score === runStartBest + 1) { pop('NEW BEST!', '#ffd93b', 26); burst(CFG.bananaX + 30, by, 22, ['#ffd93b', '#ffffff', '#ff6b81'], 240, 240); }   // past the old record
        if (score - gateStart(stage) === 1) { if (themeOf(stage) === CFG.finalTheme) warmFight(); if (themeOf(stage) === CFG.balAfter && save.unlocks.balloons && !pracN) ART.bal.warm(); if (themeOf(stage) === CFG.bal2After && empOwn(E.keyBal) && !pracN) ART.bal.warm(true); if (themeOf(stage) === CFG.miniAfter) ART.mg.warm(); else if (themeOf(stage + 1) !== bgTheme) ART.warm(themeOf(stage + 1)); }   // build the next stage's pictures early (right after the first gate, in small steps), in a calm moment
        if (score - gateStart(stage) === 3) cardWarm();   // and the words for the stage card, one picture per frame, so the card does not land on one frame
      }
    }
    while (obs.length && obs[0].x + CFG.obW < -10) obs.shift();
    if (warp) startVault('gold');
    if (VAULT) vaultStep(dt, sp); else if (!rsgHold()) hugStep(dt);
    while (nextX < W + CFG.obW + kLook() && !pendNext && !BAL && !VAULT && !FT) { if (runFight && fightDue()) { warmFight(); FT = ftNew(); split('Boss'); break; } spawnOb(nextX); }
    if ((pendNext === 'mini' || pendNext === 'balloons') && nextT > 0) washA = clamp(1 - nextT / 0.55, 0, 1) * (calmOn() ? 0.4 : 1);
    if (nextT > 0) { nextT -= dt; if (nextT <= 0) { if (pendNext === 'mini') startMini(); else if (pendNext === 'balloons') startBalloons(); else if (pendNext === 'win') startVictory(); } }
  } else if (state === 'paused') {
    if (resT >= 0) { resT -= dt; if (resT < 0) { resT = -2; resume(); if (time - tapBufT <= 0.12) flap(); } }   // 3 - 2 - 1, then play carries on
  } else if (state === 'mini') {
    updateMini(dt);
  } else if (state === 'sky' && SKY) {
    skyUpdate(dt);
  } else if (state === 'volc' && VOLC) {
    volcUpdate(dt);
  } else if (state === 'gift') {
    giftUpdate(dt);
  } else if (state === 'home' && HOME) {
    homeUpdate(dt);
  } else if (state === 'victory') {
    vicT += dt; if (frng() < 0.25) burst(40 + frng() * 280, 120 + frng() * 200, 6, ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'], 160, 220);
    fwkT -= dt; if (fwkT <= 0 && vicT > 0.5) { fwkT = calmOn() ? 1.6 : 0.5 + frng() * 0.5; fwk.push({ x: 40 + frng() * 280, y: 70 + frng() * 330, t: 0, o: frng(), c: ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'][Math.floor(frng() * 5)] }); }
    for (var fi = fwk.length - 1; fi >= 0; fi--) { fwk[fi].t += dt; if (fwk[fi].t > 1.1) fwk.splice(fi, 1); }
    if (vicT > vicDone() + 12 && pWin.hidden) openWin();
  } else if (state === 'dead') {
    deadT += dt;
    if (pracEnd !== 'win' && by + CFG.bananaR < GROUND_Y - 2) { vy = Math.min(CFG.maxFall, vy + CFG.gravity * dt); by = Math.min(by + vy * dt, GROUND_Y - CFG.bananaR); angle += dt * 9; }
  }
}

/* ===== Mini game: Chimp's Navy, a vertical reflex level (no shooting). Fancy flies up over the sea; things scroll down toward him. Drag, mouse or arrow keys steer; a tap, click or space makes him LEAP over submarines and barrels (he cannot leap seagulls: steer around them). A whirlpool splits a barrel group apart and sinks a submarine. ===== */
var MG_V0 = 200;   // the sea's normal speed (Relaxed mode scrolls it at 80%)
Object.assign(CFG, {
  mgSecs: 45, mgSpeed: 200, mgHearts: 3, mgMoveV: 540, mgY0: 520, mgYmin: 400, mgYmax: 590,   // length (seconds), how fast the sea scrolls, hearts, steering speed, where Fancy flies
  mgLeap: 0.95, mgLeapH: 34, mgHitR: 13   // seconds in the air, how high he rises on the screen, hit radius
});
var MG_PB = [318, 30];   // where the pause button sits
var MG_INTRO = 2.6;   // seconds the title and instructions show before Ready, Set, Go
var mgDn = null;      // where the finger went down, relative to Fancy: a tap only leaps, a drag steers
function startMini(practice) {
  flipV = 0; if (!practice) { if (clkSp.length && clkSp[clkSp.length - 1][0] === 'Water') clkSp.pop(); split('Water'); } CFG.mgSpeed = MG_V0 * relaxK() * plusK(); var h = CFG.mgHearts + lvl('heart') + (empOwn(E.gheart) ? 1 : 0) + (practice ? 0 : runPH); state = 'mini'; setBar(false); cardT = -1; pendNext = ''; nextT = 0; rsgT = -1; celT = 0; fx.length = 0; ART.warm(themeOf(stage));
  MG = { ph: 'intro', pt: 0, t: 0, scroll: 0, x: W / 2, y: CFG.mgY0, tx: W / 2, ty: CFG.mgY0, leap: -1, buf: 0, hearts: h, maxH: h, inv: 0, ents: [], plan: null, pi: 0, saved: 0, leaps: 0, slow: 0, practice: !!practice, wcd: 1.4, wc: 0, bonus: 0, wsh: lvl('wshield'), pl: 0, lh: h, lid: 0, lw: 0, lb: 0, pay: null, off: 0, lm: lvl('limes') * 2, lt: 0, limes: [], boss: null, bossDone: false, cove: 70 + rng() * 220, coveHit: false, life: [], lifeAt: 0 };
  MG.plan = mgPlan();
}
/* The level is planned up front: a list of things, each with the moment it enters at the top. Obstacle rows are 1.4 to 2 seconds apart (a leap takes 0.8). A seagull is only put into a gap long enough to leave room to dodge it. */
var MG_SIZE = { wafer: [34, 34], sub: [184, 60], barrels: [0, 0], barrel: [40, 44], gull: [72, 60], whirl: [56, 56], bubble: [44, 44], raft: [76, 48], buoy: [48, 48] };
function mgPlan() {
  var p = [], rd, sv, sx, vS = CFG.mgSpeed, cur = 2.2, end = CFG.mgSecs - 6, bub = 0, gap, pr, k, n, x, lo, hi, tg, v, trav = (CFG.mgY0 + 70) / vS;
  function add(kind, arr, o) { o = o || {}; o.k = kind; o.vo = o.vo || 0; o.t = o.at !== undefined ? o.at : Math.max(0, arr - trav / (vS + o.vo)); o.y = o.y === undefined ? -70 : o.y; p.push(o); }
  function whirl(x, vo) { if (rng() < 0.4) add('whirl', cur, { x: x, vo: 0, at: Math.max(0, cur - trav / (vS + vo)), ahead: vo * 1.25 }); }   // a whirlpool right in the way: whatever comes along it catches
  while (cur < end) {
    pr = cur / end; k = rng();
    rd = pr >= 0.5; sv = rd ? 62 : 40; sx = rd ? [100, 260] : [90, 270];   // the first half has the purple submarines; the back half the long, fast red ones (and the fiercer red gulls)
    if (k < 0.28) { add('sub', cur, { x: sx[0], vo: sv, red: rd }); add('sub', rd ? cur + 0.5 : cur, { x: sx[1], vo: sv, red: rd }); if (rng() < 0.5) whirl(rng() < 0.5 ? 90 : 270, sv); }   // a wall of two submarines: leap it (the long red ones come one after the other, so they never overlap)
    else if (k < 0.55) { x = rng() < 0.5 ? 95 : 265; add('sub', cur, { x: x, vo: sv, red: rd }); n = rng() < 0.5 ? 2 : 3; v = rng() < 0.4; add('barrels', cur + 0.3, { n: n, vert: v, x: v ? (x < 180 ? 285 : 75) : (x < 180 ? 330 - n * 18 : 30 + n * 18), vo: 30 }); if (rng() < 0.4) whirl(x, sv); }
    else { n = rng() < 0.5 ? 2 : 3; v = rng() < 0.5; x = 60 + rng() * 240; add('barrels', cur, { n: n, vert: v, x: x, vo: 30 }); if (rng() < 0.5) { n = rng() < 0.5 ? 2 : 3; v = rng() < 0.5; add('barrels', cur + 0.2, { n: n, vert: v, x: 40 + rng() * 280, vo: 30 }); } if (rng() < 0.45) whirl(x, 30); }
    if (bub < 5 && rng() < 0.4) { add('bubble', cur + 0.9, { x: 40 + rng() * 280 }); bub++; }
    gap = 1.5 + rng() * 0.5;
    if (rng() < 0.3 + 0.4 * pr) {
      gap = Math.max(gap, 2.5 + rng() * 0.2); lo = cur + 1.15; hi = cur + gap - 0.95; tg = lo + rng() * (hi - lo);
      v = pr >= 0.5 && rng() < 0.45; add('gull', tg, { x: 40 + rng() * 280, vo: (90 + rng() * 40) * (v ? 1.08 : 1), aim: 1, red: v });   // from the half-way mark some gulls are red, and a little fiercer
      if (pr > 0.6 && rng() < 0.4) { v = rng() < 0.5; add('gull', tg + 0.35, { x: 40 + rng() * 280, vo: (90 + rng() * 40) * (v ? 1.08 : 1), aim: 1, red: v }); }
    } else if (rng() < 0.25) add('whirl', cur + gap * 0.5, { x: 40 + rng() * 280, vo: 0 });   // a lone whirlpool slows Fancy down
    cur += gap;
  }
  var half = CFG.mgSecs / 2;   // exactly half way across: a buoy with a heart on it, with a clear stretch of water around it
  p = p.filter(function (e) { return Math.abs(e.t + (CFG.mgY0 + 70) / (vS + e.vo) - half) > 1.6; });   // (a thing's time here is when it enters at the top; it reaches Fancy (y 520) a little later)
  add('buoy', 0, { x: 70 + rng() * 220, vo: 0, at: half - trav });
  p.sort(function (a, b) { return a.t - b.t; }); return p;
}
/* From the third playthrough on, the chimps on the barrels throw vanilla wafers at Fancy (submarines never do) */
function mgThrowStep(e, dt) {
  var m = MG, ox, oy, i, n = 0, dx, dy, d, a, sw = 175, w;
  if (e.tt === undefined) e.tt = 0.6 + rng() * 1.1;
  if (e.tdone || e.y < 30 || e.y > m.y - 70) return;
  e.tw = (e.tw || 0) + dt;
  if (e.tw < e.tt || m.wcd > 0) return;
  for (i = 0; i < m.ents.length; i++) if (m.ents[i].k === 'wafer') n++;
  if (n >= 2) return;
  { w = Math.floor(rng() * e.n); ox = e.vert ? e.x : e.x - e.w / 2 + 22 + w * 36; oy = e.vert ? e.y - e.h / 2 + 22 + w * 36 - 6 : e.y - 6; }
  dx = m.x - ox; dy = m.y - oy; d = Math.sqrt(dx * dx + dy * dy) || 1; a = Math.atan2(dy, dx) + (rng() - 0.5) * 0.12;
  mgAddEnt({ k: 'wafer', x: ox, y: oy, vx: Math.cos(a) * sw, vo: Math.sin(a) * sw - CFG.mgSpeed });
  e.tdone = 1; m.wcd = 1.5 + rng() * 0.6; burst(ox, oy, 6, ['#ebc98f', '#ffffff'], 90, 100);
  if (!save.unlocks.wafers) { save.unlocks.wafers = 1; persist(); pop('Wafers! Leap or dodge!', '#ffd93b', 20); }
}
function mgWinding(e) { return waferOn() && e.tw !== undefined && !e.tdone && e.sink < 0 && e.tw >= e.tt - 0.45 && MG && e.y < MG.y - 70; }
function mgLeapT() { return [CFG.mgLeap, 1.2, 1.45][lvl('superleap')] || 1.45; }   // seconds in the air: Super Leap makes it longer
function mgLeapHt() { return [CFG.mgLeapH, 44, 54][lvl('superleap')] || 54; }   // and higher
function mgLeap() {
  var m = MG; if (m.ph !== 'play') return;
  if (m.leap < 0) { m.leap = 0; m.leaps++; m.lid++; m.lh = m.hearts; m.lw = 0; m.lb = 0; flapAnim = 0.18; runFlaps++; burst(m.x, m.y + 8, 6, ['#ffffff', '#bfe8ff'], 90, 120); mgRip.push({ x: m.x, y: m.y, t: time }); }
  else if (m.leap > mgLeapT() - 0.14) m.buf = 0.14;   // a tap just before he lands leaps again as soon as he does
}
function mgOver(m) { var u = m.leap / mgLeapT(); return m.leap >= 0 && u > 0.12 && u < 0.88; }   // high enough to clear things on the water
function mgHurt() {
  var m = MG; if (m.inv > 0 || m.ph !== 'play') return;
  if (m.boss && m.boss.kind !== 'boom') { if (!m.boss.end) { m.boss.end = 'fail'; m.boss.et = 0; m.inv = 1.6; burst(m.x, m.y, 22, ['#ffffff', '#7ad8ff'], 240, 260); pop('It got away!', '#ffffff', 22); } return; }   // the giant sub's round costs no heart: one hit and it simply sails off
  m.hearts--; runHurts++; m.inv = 1.6; burst(m.x, m.y, 30, ['#ffffff', '#bfe8ff', '#7ad8ff', '#ff6b81'], 260, 280); mgRip.push({ x: m.x, y: m.y, t: time }, { x: m.x, y: m.y, t: time + .12 });
  if (m.hearts <= 0) { m.ph = 'lose'; m.pt = 0; }
}
function mgSpec(e) { return e.k === 'sub' ? [[10, 14, e.w - 24, 34]] : [[3, 4, e.w - 6, e.h - 8]]; }   // hit box in picture coordinates (subs and barrels)
function mgAddEnt(q) { var s = MG_SIZE[q.k]; MG.ents.push({ k: q.k, n: q.n || 1, x: q.x === undefined ? 180 : q.x, y: q.y, vx: q.vx || 0, vy: q.vo || 0, w: q.k === 'barrels' ? (q.vert ? 44 : q.n * 36 + 4) : q.red && q.k === 'sub' ? 245 : s[0], red: !!q.red, h: q.k === 'barrels' ? (q.vert ? q.n * 36 + 4 : 44) : s[1], vert: !!q.vert, aim: q.aim || 0, f: rng() * 6, ph: rng() * 6.28, sink: -1, spin: 0 }); }
function mgLT(m) { return m.t - m.off; }   // level time: the boss round does not move the shore closer
function mgPerfect(m) {   // did every barrel group this leap passed go under Fancy's middle, near the top of the arc?
  var i, e, n = 0;
  for (i = 0; i < m.ents.length; i++) { e = m.ents[i]; if (e.k === 'barrels' && e.lid === m.lid) { n++; if (e.uc === undefined || Math.abs(e.uc - 0.5) > 0.16) return false; } }
  return n > 0;
}
function mgSplit(e, i, px, py) {   // a barrel group comes apart into single barrels
  var m = MG, c = e.n, bx0 = e.x - e.w / 2 + 22, by0 = e.y - e.h / 2 + 22, kk, sp = function (k) { return k - (c - 1) / 2; };
  for (kk = 0; kk < c; kk++) mgAddEnt({ k: 'barrels', n: 1, x: e.vert ? e.x : bx0 + kk * 36 - 2, y: e.vert ? by0 + kk * 36 : e.y, vo: e.vy + (e.vert ? sp(kk) * 45 : 0) + (rng() - 0.3) * 40, vx: (e.vert ? (rng() - 0.5) * 140 : sp(kk) * 70) + (rng() - 0.5) * 40 });
  m.ents.splice(i, 1); burst(px, py, 22, ['#ffffff', '#bfe8ff', '#d19a58'], 220, 200);
}
function startBoss() { var m = MG, bm = empOwn(E.keyBoom); m.boss = { kind: bm ? 'boom' : 'sub', t: 0, fire: bm ? 1.4 : 0.9, drop: 2.2, x: W / 2, end: '', et: 0, hp: 3, st: 0, bm: [], fl: 0 }; pop(bm ? 'BOOMERANG CHIMP!' : 'BOSS SUB!', bm ? '#ffd93b' : '#ff6b81', 30); burst(W / 2, 100, 30, ['#ffffff', '#7ad8ff', '#ff6b81'], 260, 240); }
function boomStep(m, b, dt) {   // Boomerang Chimp (the Boomerang key): each boomerang flies out to where Fancy was, swings round in a loop and comes back to the Chimp. If it did not hit Fancy, it hits him. Three hits and he is done.
  var i, q, u, d, nx, ny, n, dx, dy, hx, hy, L, k;
  if (b.fl > 0) b.fl -= dt;
  if (b.end) { b.et += dt; if (b.et > (b.end === 'won' ? 1.8 : 1.0)) { m.boss = null; m.bossDone = true; } return; }
  if (b.st > 0) b.st -= dt; else b.fire -= dt;
  if (b.fire <= 0 && b.bm.length < (b.hp <= 1 ? 2 : 1)) {
    b.fire = b.hp <= 1 ? 1.5 : 2.0; hx = b.x; hy = 92; dx = m.x - hx; dy = m.y - hy; L = Math.sqrt(dx * dx + dy * dy) || 1;
    b.bm.push({ ax: m.x, ay: m.y, t: 0, dur: 2.3 - 0.25 * (3 - b.hp), w: Math.min(80, L * 0.3), hit: 0, x: hx, y: hy }); burst(hx, hy, 8, ['#c98a3c', '#ffffff'], 110, 100);
  }
  for (i = b.bm.length - 1; i >= 0; i--) {
    q = b.bm[i]; q.t += dt; u = Math.min(1, q.t / q.dur); hx = b.x; hy = 92; dx = q.ax - hx; dy = q.ay - hy; L = Math.sqrt(dx * dx + dy * dy) || 1; nx = -dy / L; ny = dx / L; d = (1 - Math.cos(6.2832 * u)) / 2;
    q.x = hx + dx * d + nx * q.w * Math.sin(6.2832 * u); q.y = hy + dy * d + ny * q.w * Math.sin(6.2832 * u);
    if (!calmOn() && frng() < 0.7) fxAdd(q.x, q.y, (frng() - 0.5) * 30, (frng() - 0.5) * 30, 0.3, '#fff2a0', 2 + frng() * 2, false, 0);
    dx = m.x - q.x; dy = m.y - q.y;
    if (m.ph === 'play' && m.inv <= 0 && !mgOver(m) && dx * dx + dy * dy < (CFG.mgHitR + 12) * (CFG.mgHitR + 12)) { burst(q.x, q.y, 14, ['#c98a3c', '#ffffff', '#7ad8ff'], 200, 200); mgHurt(); b.bm.splice(i, 1); continue; }
    if (u >= 1) {
      b.bm.splice(i, 1); b.hp--; b.fl = 0.5; b.st = 0.9; burst(b.x, 92, 26, ['#ffd93b', '#ffffff', '#c98a3c'], 260, 220);
      if (b.hp <= 0) { b.end = 'won'; b.et = 0; m.bonus += 20; pop('BOOMERANG CHIMP BEATEN! +20', '#ffd93b', 22); burst(b.x, 100, 44, ['#ffd93b', '#ffffff', '#ff6b81', '#7ad8ff'], 320, 280); secretFound('boom', 'Secret found: Boomerang Chimp! A medal is on the wall in Fancy\'s Place.'); b.bm.length = 0; }
      else pop('OUCH! ' + b.hp + ' to go', '#ffd93b', 22);
    }
  }
}
function drawBoomerang(x, y, sc, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(sc, sc); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-17, 6); ctx.quadraticCurveTo(-4, -2, 0, -15); ctx.quadraticCurveTo(4, -2, 17, 6); ctx.quadraticCurveTo(2, 3, 0, -6); ctx.quadraticCurveTo(-2, 3, -17, 6); ctx.closePath();
  ctx.fillStyle = '#d99a48'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = '#e8453c'; ctx.beginPath(); ctx.arc(-11, 4.4, 2, 0, 6.2832); ctx.arc(11, 4.4, 2, 0, 6.2832); ctx.fill(); ctx.restore();
}
function boomDraw(b) {   // Boomerang Chimp on his raft, with a red bandana, three boomerang lives, and the boomerangs in flight
  var y = 96 + Math.sin(time * 2) * 3, a = b.end === 'won' ? clamp(1 - b.et / 1.8, 0, 1) : 1, i, q, sh = b.fl > 0 && Math.floor(time * 24) % 2 ? 4 : 0;
  ctx.globalAlpha = a; mgRaft(b.x + sh, y + 26 + (b.end ? b.et * 30 : 0)); ART.chimp(ctx, b.x + sh, y - 14 + (b.end ? b.et * 30 : 0), 0.42, 1, time);
  ctx.fillStyle = '#e8453c'; ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(b.x - 13 + sh, y - 26); ctx.lineTo(b.x + 13 + sh, y - 26); ctx.lineTo(b.x + 13 + sh, y - 20); ctx.lineTo(b.x - 13 + sh, y - 20); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(b.x + 13 + sh, y - 23); ctx.lineTo(b.x + 22 + sh, y - 28); ctx.lineTo(b.x + 20 + sh, y - 18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 1;
  if (!b.end) { for (i = 0; i < 3; i++) { ctx.globalAlpha = i < b.hp ? 1 : 0.25; drawBoomerang(130 + i * 50, 22, 0.8, -0.3); } ctx.globalAlpha = 1; }
  for (i = 0; i < b.bm.length; i++) { q = b.bm[i]; ctx.fillStyle = 'rgba(0,30,60,.2)'; ctx.beginPath(); ctx.ellipse(q.x + 8, q.y + 16, 14, 5, 0, 0, 6.2832); ctx.fill(); drawBoomerang(q.x, q.y, 1.1, time * 16); }
}
function bossStep(dt) {
  var m = MG, b = m.boss, a, sw = 175, n = 0, i;
  b.t += dt; m.off += dt; b.x = W / 2 + Math.sin(b.t * 0.9) * 90;
  if (b.kind === 'boom') { boomStep(m, b, dt); return; }
  if (b.end) { b.et += dt; if (b.et > (b.end === 'won' ? 1.5 : 1.0)) { m.boss = null; m.bossDone = true; } return; }
  b.fire -= dt;
  if (b.fire <= 0) {
    for (i = 0; i < m.ents.length; i++) if (m.ents[i].k === 'wafer') n++;
    b.fire = 1.15 - 0.4 * b.t / 12;
    if (n < 3) { a = Math.atan2(m.y - 100, m.x - b.x) + (rng() - 0.5) * 0.16; mgAddEnt({ k: 'wafer', x: b.x, y: 104, vx: Math.cos(a) * sw, vo: Math.sin(a) * sw - CFG.mgSpeed }); burst(b.x, 104, 6, ['#ebc98f', '#ffffff'], 90, 100); }
  }
  b.drop -= dt; if (b.drop <= 0 && b.t < 8.5) { b.drop = 3.2; mgAddEnt({ k: 'barrels', n: 3, vert: false, x: 70 + rng() * 220, y: -70, vo: 30 }); }
  if (b.t >= 12) { b.end = 'won'; b.et = 0; m.bonus += 10; pop('GIANT SUB SUNK! +10', '#ffd93b', 24); burst(b.x, 110, 40, ['#ffffff', '#bfe8ff', '#7ad8ff', '#ffd93b'], 300, 260); secretFound('boss', 'Secret found: the Boss Sub!'); }
}
function mgLimes(m, dt) {   // Lime defense in Chimp's Navy: a seagull that will reach Fancy within about half a second (he cannot leap it) gets a rocket lime shot at it; the lime steers onto the gull and pops it
  var i, j, e, L, t, x, y, d, dx, dy, hr = CFG.mgHitR + 14, vS = CFG.mgSpeed, sp = 560;
  if (m.lt > 0) m.lt -= dt;
  if (m.lm > 0 && m.lt <= 0 && m.ph === 'play' && m.inv <= 0 && !(lvl('superleap') > 0 && mgOver(m))) {
    for (i = 0; i < m.ents.length; i++) {
      e = m.ents[i]; if (e.k !== 'gull' || e.tg || e.sink >= 0 || e.y > m.y + 10) continue;
      for (t = 0; t < 0.55; t += 1 / 30) { x = e.x + e.vx * t; y = e.y + (vS + e.vy) * t; dx = m.x - x; dy = m.y - y; if (dx * dx + dy * dy < hr * hr) break; }
      if (t < 0.55) { e.tg = 1; m.lm--; m.lt = 0.45; m.limes.push({ x: m.x + 14, y: m.y - 8, vx: 160, vy: -200, a: e, t: 0 }); burst(m.x + 12, m.y - 8, 8, ['#9be84a', '#ffffff'], 150, 80); pop('Lime shot!', '#9be84a', 20); break; }
    }
  }
  for (i = m.limes.length - 1; i >= 0; i--) {
    L = m.limes[i]; L.t += dt; e = L.a; if (e && m.ents.indexOf(e) < 0) e = L.a = null;
    if (e) { dx = e.x - L.x; dy = e.y - L.y; d = Math.sqrt(dx * dx + dy * dy) || 1; L.vx += (dx / d * sp - L.vx) * Math.min(1, dt * 10); L.vy += (dy / d * sp - L.vy) * Math.min(1, dt * 10); } else L.vy += 500 * dt;
    L.x += L.vx * dt; L.y += L.vy * dt;
    if (!calmOn() && frng() < 0.8) fxAdd(L.x - L.vx * 0.03, L.y - L.vy * 0.03, -L.vx * 0.12 + (frng() - 0.5) * 30, -L.vy * 0.12 + (frng() - 0.5) * 30, 0.32, frng() < 0.5 ? '#ffffff' : '#fff2a0', 2 + frng() * 2, false, 0);
    if (e && (e.x - L.x) * (e.x - L.x) + (e.y - L.y) * (e.y - L.y) < 30 * 30) {
      j = m.ents.indexOf(e); if (j >= 0) m.ents.splice(j, 1); m.limes.splice(i, 1);
      burst(e.x, e.y, 22, ['#ffffff', '#d8d8d8', e.red ? '#e05a4a' : '#9be84a', '#ffd93b'], 260, 170); pop('ZAP!', '#9be84a', 28); if (!calmOn()) punchT = CFG.punchSecs * 0.3; continue;
    }
    if (L.t > 1.6 || L.x > W + 40 || L.x < -40 || L.y > H + 40 || L.y < -40) { burst(L.x, L.y, 8, ['#9be84a', '#ffffff'], 140, 60); m.limes.splice(i, 1); }
  }
}
function updateMini(dt) {
  if (MG && MG.paused) return;   // paused: nothing moves
  if (washA > 0) washA = Math.max(0, washA - dt / 0.7);
  var m = MG, i, j, e, q, vS = CFG.mgSpeed, dx, dy, d, mv, rs, o, c, u;
  m.pt += dt; if (m.inv > 0) m.inv -= dt; if (m.wcd > 0) m.wcd -= dt;
  if (m.ph === 'intro') { if (tapWaitOn && !m.go && m.pt >= MG_INTRO) { m.pt = MG_INTRO; m.wait = true; m.rk = 0; } else { m.wait = false; m.rk = Math.min(1, (m.rk === undefined ? 1 : m.rk) + dt / 0.45); } m.scroll += vS * dt * 0.6 * (m.rk === undefined ? 1 : m.rk * m.rk * (3 - 2 * m.rk)); if (m.pt > MG_INTRO + CFG.rsgBeat * 2) { m.ph = 'play'; m.pt = 0; } return; }   // the title shows first, then Ready, Set, and GO! as play begins
  if (m.ph === 'win') { m.scroll += vS * dt * 0.4; m.y -= 60 * dt; if (frng() < 0.3) burst(40 + frng() * 280, 100 + frng() * 300, 6, ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'], 160, 220); if (m.pt > 3.2 && !m.practice) finishMini(); return; }
  if (m.ph === 'lose') return;
  m.t += dt; m.scroll += vS * dt; var lt = mgLT(m);
  // steering: follow the finger or mouse, or the arrow keys
  if (m.leap < 0 && (keys.l || keys.r || keys.u || keys.d)) { m.tx = clamp(m.tx + ((keys.r ? 1 : 0) - (keys.l ? 1 : 0)) * CFG.mgMoveV * dt, 24, W - 24); m.ty = clamp(m.ty + ((keys.d ? 1 : 0) - (keys.u ? 1 : 0)) * CFG.mgMoveV * dt, CFG.mgYmin, CFG.mgYmax); }
  mv = CFG.mgMoveV * (m.slow > 0 ? 0.55 : 1) * dt; m.slow = 0; dx = m.tx - m.x; dy = m.ty - m.y; d = Math.sqrt(dx * dx + dy * dy); if (d > mv) { dx *= mv / d; dy *= mv / d; } if (m.leap < 0) { m.x += dx; m.y += dy; }   // in mid-leap Fancy cannot steer: the timing is the whole game
  m.bk = (m.bk || 0) + ((m.leap >= 0 ? 0 : clamp((m.tx - m.x) / 110, -1, 1)) - (m.bk || 0)) * Math.min(1, dt * 9);   // how hard he is turning (smoothed): -1 full left .. 1 full right
  // the leap
  if (m.leap >= 0) { m.leap += dt; if (m.buf > 0) m.buf -= dt; if (m.leap >= mgLeapT()) { m.pay = { lh: m.lh, w: m.lw, b: m.lb, bp: mgPerfect(m) }; m.leap = -1; burst(m.x, m.y + 8, 7, ['#ffffff', '#bfe8ff'], 110, 130); mgRip.push({ x: m.x, y: m.y, t: time }); if (m.buf > 0) { m.buf = 0; mgLeap(); } } }
  flapAnim = m.leap >= 0 ? Math.max(flapAnim, 0.05) : 0.1; bx = m.x; by = m.y;   // (the pop-up words follow Fancy)
  if (m.lm > 0 || m.limes.length) mgLimes(m, dt);
  // things come in at the top
  while (m.pi < m.plan.length && m.plan[m.pi].t <= lt) {
    q = m.plan[m.pi++]; mgAddEnt(q);
    if (q.k === 'whirl' && q.ahead) m.ents[m.ents.length - 1].y = -70 + q.ahead;   // sits a little ahead of the thing that will catch it
  }
  for (i = m.ents.length - 1; i >= 0; i--) {
    e = m.ents[i];
    if (e.k === 'gull') { if (e.aim && e.y < (e.red ? 300 : 270)) { e.vx += (m.x > e.x ? 1 : -1) * (e.red ? 88 : 70) * dt; e.vx = clamp(e.vx, e.red ? -43 : -35, e.red ? 43 : 35); } else if (e.aim) e.aim = 0; e.x += e.vx * dt; }
    e.y += (vS + e.vy) * dt; e.x += e.vx * dt * (e.k === 'gull' ? 0 : 1); e.spin += dt;
    if (e.sink >= 0) { e.sink += dt; if (e.sink > 1.1) { m.ents.splice(i, 1); continue; } }
    if (e.y > H + 100 || e.x < -150 || e.x > W + 150) { m.ents.splice(i, 1); continue; }
    if (e.sink >= 0) continue;
    if (e.k === 'wafer') { dx = m.x - e.x; dy = m.y - e.y; if (m.ph === 'play' && dx * dx + dy * dy < (CFG.mgHitR + 12) * (CFG.mgHitR + 12)) { if (mgOver(m)) { if (!e.cl) { e.cl = 1; m.lw++; } } else if (m.wsh > 0 && m.inv <= 0) { m.wsh--; pop('Blocked!', '#7ad8ff', 22); burst(e.x, e.y, 14, ['#7ad8ff', '#ffffff'], 170, 160); m.ents.splice(i, 1); } else { mgHurt(); burst(e.x, e.y, 14, ['#ebc98f', '#c99a58', '#ffffff'], 170, 160); m.ents.splice(i, 1); } } continue; }   // a thrown wafer: leap over it (a clean leap pays a bonus), block it with the shield, or steer around   // a thrown wafer: leap over it or steer around
    if (waferOn() && m.ph === 'play' && e.k === 'barrels') mgThrowStep(e, dt);   // only the chimps on the barrels throw wafers, never a submarine
    if (e.k === 'gull') { dx = m.x - e.x; dy = m.y - e.y; if (dx * dx + dy * dy < (CFG.mgHitR + 14) * (CFG.mgHitR + 14) && !(lvl('superleap') > 0 && mgOver(m))) mgHurt(); continue; }   // a gull cannot be leapt, unless Fancy has bought Super Leap
    if (e.k === 'raft') { dx = m.x - e.x; dy = m.y - e.y; if (m.ph === 'play' && Math.abs(dx) < 46 && Math.abs(dy) < 30) { m.bonus += 8; m.ents.splice(i, 1); burst(e.x, e.y, 30, ['#ffd93b', '#fff2a0', '#ffffff'], 240, 220); pop('TREASURE! +8', '#ffd93b', 26); secretFound('raft', 'Secret found: the Treasure Raft!'); } continue; }
    if (e.k === 'buoy') { dx = m.x - e.x; dy = m.y - e.y; if (m.ph === 'play' && m.hearts < m.maxH && dx * dx + dy * dy < (CFG.mgHitR + 22) * (CFG.mgHitR + 22)) { m.hearts++; m.ents.splice(i, 1); burst(e.x, e.y, 22, ['#ff6b81', '#ffffff', '#ffd93b'], 220, 180); pop('Heart back!', '#ff8aa0', 22); } continue; }   // the heart buoy: a heart back, if one has been lost
    if (e.k === 'bubble') { dx = m.x - e.x; dy = m.y - e.y; if (dx * dx + dy * dy < (CFG.mgHitR + 20) * (CFG.mgHitR + 20)) { m.saved++; m.ents.splice(i, 1); burst(e.x, e.y, 18, ['#ffffff', '#bfe8ff', '#ffd93b'], 200, 160); pop('Friend freed!', '#ffd93b', 18); } continue; }
    if (e.k === 'whirl') { dx = m.x - e.x; dy = m.y - e.y; if (!mgOver(m) && dx * dx + dy * dy < 31 * 31) m.slow = 1; continue; }
    // submarines and barrels: leap over them, or steer around; a whirlpool sinks a sub and splits a group of barrels apart
    for (j = 0; j < m.ents.length; j++) {
      o = m.ents[j]; if (o.k !== 'whirl') continue;
      if (circleRect(o.x, o.y, 19, e.x - e.w / 2 + 3, e.y - e.h / 2 + 3, e.w - 6, e.h - 6)) {
        if (e.k === 'sub') { e.sink = 0; burst(e.x, e.y, 26, ['#ffffff', '#bfe8ff', '#7ad8ff'], 220, 200); }
        else {
          c = e.k === 'barrels' ? e.n : 1; if (c > 1) mgSplit(e, i, o.x, o.y);
        }
        break;
      }
    }
    if (!m.ents[i] || m.ents[i] !== e || e.sink >= 0) continue;
    if (e.k === 'barrels' && e.n > 1 && !e.cut && lvl('rope') && e.y > 130) { e.cut = 1; mgSplit(e, i, e.x, e.y); continue; }   // the helper chimp's rope cutter
    rs = mgSpec(e); if (circleRect(m.x, m.y, CFG.mgHitR, e.x - e.w / 2 + rs[0][0], e.y - e.h / 2 + rs[0][1], rs[0][2], rs[0][3])) { if (!mgOver(m)) mgHurt(); else if (e.k === 'barrels' && m.ph === 'play') { if (e.lid !== m.lid) { e.lid = m.lid; m.lb++; } if (e.uc === undefined && e.y >= m.y - 4) e.uc = m.leap / mgLeapT(); } }
  }
  if (m.pay) {   // a leap just ended: was it a clean one? (no heart lost, no hit on landing)
    var pz = m.pay; m.pay = null;
    if (m.ph === 'play' && m.hearts === pz.lh) {
      if (pz.w > 0 && !m.practice) { var wp = Math.min(CFG.wafCap, ++m.wc); m.bonus += wp; pop('WAFER CLEAR! +' + wp, '#ffd93b', 22); burst(m.x, m.y - 10, 16, ['#ebc98f', '#ffd93b', '#ffffff'], 200, 200); }
      if (pz.b > 0) { if (pz.bp) { if (++m.pl >= 3 && secretsOn() && !m.practice) { m.pl = 0; mgAddEnt({ k: 'raft', x: 60 + rng() * 240, y: -60 }); pop('A raft appears!', '#ffd93b', 22); } else if (m.pl > 0 && m.pl < 3) pop('PERFECT LEAP x' + m.pl, '#7ad8ff', 18); } else m.pl = 0; }
    } else m.pl = 0;
  }
  if (!m.coveHit && !m.practice && secretsOn() && m.ph === 'play' && Math.abs(m.x - m.cove) < 28 && Math.abs(m.y - (H - Math.max(0, CFG.mgSecs - lt) * vS + 70)) < 22) { m.coveHit = true; m.bonus += 3; pop('SECRET COVE! +3', '#7ad8ff', 26); burst(m.x, m.y, 30, ['#ffffff', '#7ad8ff', '#ffd93b'], 260, 240); secretFound('cove', 'Secret found: the Secret Cove!'); }   // fly through the little rock arch in the water, just before the beach
  if (!m.boss && !m.bossDone && !m.practice && secretsOn() && m.ph === 'play' && m.hearts === m.maxH && lt >= CFG.mgSecs - 5.5) startBoss();
  if (m.boss) bossStep(dt);
  if (lt >= CFG.mgSecs && !m.boss) { m.ph = 'win'; m.pt = 0; if (!m.practice) { save.stats.friends += CFG.friendsPerStage + m.saved + m.bonus; persist(); } burst(W / 2, m.y, 40, ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'], 300, 380); }
}
function finishMini() {   // back to the side-scrolling flight: the next stage starts with a calm stretch
  ART.mg.free(); state = 'play'; obs = []; by = CFG.rsgY; bx = CFG.bananaX; vy = 0; angle = 0; grace = 0; rsgT = CFG.cardSecs; rsgGo = false; rsgTap = false; boost = 0; boostT = 99; trackOn = false; cardT = -1; topT = 0; MG = null; fl.length = 0;
  bgFrom = bgTheme; bgTheme = themeOf(stage); bgT = bgFrom === bgTheme ? 1 : 0; if (bgTheme === ART.journeyTheme) gardenD0 = dist; washA = 0; nextX = W + CFG.obW + speedFor(stage) * (rsgGoAt() - rsgT + 0.4); fx.length = 0; invuln = 0; lastAfter = 0; trail.length = 0;
}
/* practice (bought in the shop, played from the title screen): the same level, nothing earned; when it ends or Fancy is out, a card offers Try again or Back to title */
var MG_BA = [70, 300, 220, 44], MG_BT = [70, 356, 220, 44], PS_BT = [70, 408, 220, 44];   // PS_BT: Settings on the pause screens
function padLine() { if (padOn) outlined(pracN || (MG && MG.practice) ? 'Y: Settings    B: Back to title' : 'Y: Settings    Start: carry on', W / 2, 184, 14, '#ffffff'); }
function mgCard(m) { return m.practice && ((m.ph === 'lose' && m.pt > 0.6) || (m.ph === 'win' && m.pt > 1.2)); }
function mgIn(l, b) { return l[0] >= b[0] && l[0] <= b[0] + b[2] && l[1] >= b[1] && l[1] <= b[1] + b[3]; }
var MIXM = [];   // mixc answers already worked out: the same few colors are mixed the same way every frame, so the text of the answer is kept instead of built again
function mixc(c, to, t) {
  var i, m, a, b, r, g, l;
  for (i = 0; i < MIXM.length; i++) { m = MIXM[i]; if (m.c === c && m.to === to && m.t === t) return m.v; }
  a = parseInt(c.slice(1), 16); b = parseInt(to.slice(1), 16); r = a >> 16 & 255; g = a >> 8 & 255; l = a & 255;
  m = { c: c, to: to, t: t, v: 'rgb(' + Math.round(r + ((b >> 16 & 255) - r) * t) + ',' + Math.round(g + ((b >> 8 & 255) - g) * t) + ',' + Math.round(l + ((b & 255) - l) * t) + ')' };
  if (MIXM.length < 400) MIXM.push(m); return m.v;
}
function mgBtn(b, label, col, sub, off) {   // a chunky plastic button (Apple Press recipe): soft shadow, a hard darker lip, a lit gradient face, a white top highlight
  twinAdd(b[0], b[1], b[2], b[3] + 4, sub ? label + '. ' + sub : label, off);
  if (off) col = '#b9b0c8'; var x = b[0], y = b[1], w = b[2], h = b[3], gr = ctx.createLinearGradient(0, y, 0, y + h), hl = ctx.createLinearGradient(0, y, 0, y + h * .55);
  ctx.fillStyle = 'rgba(30,20,50,.2)'; rrect(x + 1, y + 7, w - 2, h, 16); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = INK; rrect(x, y + 4, w, h, 16); ctx.fillStyle = mixc(col, '#2b1a2e', .5); ctx.fill(); ctx.stroke();
  gr.addColorStop(0, mixc(col, '#ffffff', .22)); gr.addColorStop(.55, col); gr.addColorStop(1, mixc(col, '#2b1a2e', .14));
  rrect(x, y, w, h, 16); ctx.fillStyle = gr; ctx.fill(); ctx.stroke();
  hl.addColorStop(0, 'rgba(255,255,255,.5)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); rrect(x + 4, y + 3, w - 8, h * .55, 12); ctx.fillStyle = hl; ctx.fill();
  if (sub) { outlined(label, x + w / 2, y + h / 2 - 7, 21, '#ffffff'); outlinedC(sub, x + w / 2, y + h / 2 + 15, 12.5, '#ffffff'); } else outlined(label, x + w / 2, y + h / 2 + 2, 22, '#ffffff');
}
function star4(x, y, r, a) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * .28, y - r * .28); ctx.lineTo(x + r, y); ctx.lineTo(x + r * .28, y + r * .28); ctx.lineTo(x, y + r); ctx.lineTo(x - r * .28, y + r * .28); ctx.lineTo(x - r, y); ctx.lineTo(x - r * .28, y - r * .28); ctx.closePath(); ctx.fill(); ctx.restore(); }
var CFC = [], CFP = '', VSQ = 0, NOSTILL = false;   // the card panels (shadow, cream paper, ribbon, shine, borders) baked into pictures once a card sits still; the paper's gradient fill is the slow part (about 1 ms a frame)
function cardPanel(x, y, w, h, col, rh) {
  var gr = ctx.createLinearGradient(0, y, 0, y + h);
  ctx.fillStyle = 'rgba(30,20,50,.28)'; rrect(x + 2, y + 9, w, h, 24); ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = INK; gr.addColorStop(0, '#fffdf3'); gr.addColorStop(1, '#ffeec2'); rrect(x, y, w, h, 24); fs(gr);
  ctx.save(); rrect(x, y, w, h, 24); ctx.clip();
  gr = ctx.createLinearGradient(0, y, 0, y + rh); gr.addColorStop(0, mixc(col, '#ffffff', .3)); gr.addColorStop(1, col); ctx.fillStyle = gr; ctx.fillRect(x, y, w, rh);
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x, y + 4, w, rh * .3);
  ctx.restore();
  ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x, y + rh); ctx.lineTo(x + w, y + rh); ctx.stroke(); rrect(x, y, w, h, 24); ctx.stroke();
}
function stillDraw(tag, x, y, w, h, fn) {   // a part of the screen that sits still (the victory card's paper and table): the first time it is drawn into a picture, after that that picture is stamped on the very same device pixels the live drawing would cover. With any turn or skew in the transform it is drawn live.
  var m = ctx.getTransform(), ox = m.e + x * m.a, oy = m.f + y * m.d, key = [tag, w, h, m.a, m.d, Math.round(ox * 100), Math.round(oy * 100)].join('|'), e = null, i, c, g2, old, px, py;
  if (!NOSTILL && !m.b && !m.c) {
    for (i = 0; i < CFC.length; i++) if (CFC[i].key === key) e = CFC[i];
    if (!e) {
      px = Math.floor(ox - 4 * m.a); py = Math.floor(oy - 4 * m.d); c = document.createElement('canvas'); c.width = Math.ceil((w + 8) * m.a) + 2; c.height = Math.ceil((h + 8) * m.d) + 2; g2 = c.getContext('2d', CRF);
      if (g2) { old = ctx; ctx = g2; g2.setTransform(m.a, 0, 0, m.d, m.e - px, m.f - py); try { fn(); } finally { ctx = old; } e = { key: key, c: c, px: px, py: py, f: TXF }; CFC.push(e); if (CFC.length > 4) CFC.shift(); }
    }
    if (e) { e.f = TXF; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(e.c, e.px, e.py); ctx.restore(); return; }
  }
  fn();
}
function cardFrame(x, y, w, h, col, title, tsz, rh) {   // the shared look of every result card: a cream panel with a colored ribbon on top, a soft shadow, a glossy shine and a few twinkles
  rh = rh || 52;
  var m = ctx.getTransform(), ox = m.e + x * m.a, oy = m.f + y * m.d, key = [w, h, col, rh, m.a, m.d, Math.round(ox * 100), Math.round(oy * 100)].join('|'), e = null, i, c, g2, old, px, py;
  if (!m.b && !m.c) {   // a plain move and scale only: a still card can be one picture, stamped on the very same device pixels the live drawing would cover
    for (i = 0; i < CFC.length; i++) if (CFC[i].key === key) e = CFC[i];
    if (!e && CFP === key) {   // the same spot two frames in a row: the card is at rest, bake it
      px = Math.floor(ox - 5 * m.a); py = Math.floor(oy - 5 * m.d); c = document.createElement('canvas'); c.width = Math.ceil((w + 12) * m.a) + 2; c.height = Math.ceil((h + 19) * m.d) + 2; g2 = c.getContext('2d', CRF);
      if (g2) { old = ctx; ctx = g2; g2.setTransform(m.a, 0, 0, m.d, m.e - px, m.f - py); try { cardPanel(x, y, w, h, col, rh); } finally { ctx = old; } e = { key: key, c: c, px: px, py: py, f: TXF }; CFC.push(e); if (CFC.length > 4) CFC.shift(); }
    }
    CFP = key;
  }
  if (e) { e.f = TXF; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(e.c, e.px, e.py); ctx.restore(); } else cardPanel(x, y, w, h, col, rh);
  star4(x + 24, y + rh / 2 - 6, 7, .6 + .4 * Math.sin(time * 4)); star4(x + w - 26, y + rh / 2 + 6, 6, .6 + .4 * Math.sin(time * 4 + 2)); star4(x + w - 50, y + 12, 4, .5 + .5 * Math.sin(time * 5 + 1));
  outlined(title, x + w / 2, y + rh / 2 + 2, tsz, '#ffffff');
}
function practiceCard(m) {   // practice ended (won or out of hearts): try it again or go back to the title screen
  var a = m.ph === 'win' ? clamp((m.pt - 1.2) / 0.3, 0, 1) : clamp((m.pt - 0.6) / 0.3, 0, 1); if (a <= 0) return;
  ctx.globalAlpha = a; if (m.ph === 'lose') { ctx.fillStyle = 'rgba(58,42,77,0.3)'; ctx.fillRect(0, 0, W, H); }
  cardFrame(40, 156, 280, 300, m.ph === 'win' ? '#58c46f' : '#4a9bd8', m.ph === 'win' ? 'Made it to shore!' : 'Splash!', m.ph === 'win' ? 27 : 30); ctx.globalAlpha = a;
  if (m.ph === 'win') outlined('Great swimming!', W / 2, 244, 22, '#ffd93b');
  else { ART.chimp(ctx, 256, 240, 0.52, 0, time); outlined('The Chimp Navy', 128, 228, 17, '#ffffff'); outlined('got you!', 128, 252, 17, '#ffffff'); }
  outlined('Practice: no prizes this time', W / 2, m.ph === 'win' ? 276 : 280, 14, '#ffffff');
  mgBtn(MG_BA, 'Try again!', '#58c46f'); mgBtn(MG_BT, 'Back to title', '#8a6cd8'); outlined(padOn ? 'A: again   B: title' : 'Space: again   Esc: title', W / 2, 424, 13, '#ffffff'); ctx.globalAlpha = 1;
}
function startPractice() { ART.mg.warm(); ART.mg.done(); startMini(true); }
function practiceExit() { exitAt = performance.now(); pracN = 0; resetWorld(); state = 'title'; titleT = 5; closePanels(); setBar(true); }
function mgOnBtn(l) { return Math.abs(l[0] - MG_PB[0]) < PBH() && Math.abs(l[1] - MG_PB[1]) < PBH(); }
function mgPause(on) { var m = MG; if (m && (m.ph === 'play' || m.ph === 'intro')) { var was = !!m.paused; m.paused = on === undefined ? !m.paused : on; if (m.paused && !was) runPauses++; } }
function miniTap() { var m = MG; if (!m || panelOpen()) return; if (m.paused) { m.paused = false; return; } if (m.ph === 'intro' && tapWaitOn && !m.go && (m.wait || m.pt >= 0.7)) { m.go = true; m.wait = false; m.pt = Math.max(m.pt, MG_INTRO); return; } if (m.practice && mgCard(m)) { startMini(true); return; } if (m.ph === 'lose' && m.pt > 0.6) startMini(m.practice); else mgLeap(); }
function mgLogical(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
function mgPointerDown(e) {   // a mouse click leaps where the mouse is; a finger keeps its distance from Fancy and then moves him, so a tap never throws him sideways
  var l = mgLogical(e);
  if (MG && MG.practice && (MG.paused || mgCard(MG))) { if (mgIn(l, MG_BT)) { practiceExit(); return; } if (!MG.paused && mgIn(l, MG_BA)) { startMini(true); return; } if (!MG.paused) return; }   // practice: the card's two buttons
  if (MG && MG.paused) { MG.paused = false; return; }   // a tap anywhere carries on
  if (MG && mgOnBtn(l)) { mgPause(true); return; }
  mgDn = { ox: MG ? MG.x - l[0] : 0, oy: MG ? MG.y - l[1] : 0, x0: l[0], y0: l[1], t0: performance.now(), moved: false, tap: false };
  if (e.pointerType === 'mouse') { mgPoint(e); miniTap(); return; }
  if (MG && MG.ph === 'play' && !MG.paused) { mgDn.tap = true; return; }   // a finger: a tap leaps when it lifts, a drag only steers (a leap the moment a finger touched down made every drag a leap)
  miniTap();
}
function mgPoint(e) {
  if (state !== 'mini' || !MG) return;
  var l = mgLogical(e); if (MG.paused || mgOnBtn(l)) return;   // reaching for the pause button does not steer him
  if (mgDn && !mgDn.moved && (l[0] - mgDn.x0) * (l[0] - mgDn.x0) + (l[1] - mgDn.y0) * (l[1] - mgDn.y0) > 64) mgDn.moved = true;
  var ox = e.pointerType === 'mouse' || !mgDn ? 0 : mgDn.ox, oy = e.pointerType === 'mouse' || !mgDn ? 0 : mgDn.oy;
  MG.tx = clamp(l[0] + ox, 24, W - 24); MG.ty = clamp(l[1] + oy, CFG.mgYmin, CFG.mgYmax);
}
/* Fancy seen from straight above (nose up the screen): a lemon-yellow banana with a red neck scarf and a red cape spread out behind him. bk (-1..1) is how hard he is turning: the whole hero leans into the turn, the banana bends, and the cape streams out to the other side. */
function mgHero(g, x, y, sc, bk, t) {   // Fancy seen from above, swimming nose up: a glossy toy banana with white gloves paddling, a mask, a scarf and a cape (all plum-inked like the flying Fancy)
  var ab = Math.abs(bk), sh = -bk * 8, b = bk * 5 + 1.2, w = [Math.sin(t * 10) * 2.4, Math.sin(t * 10 + 1.7) * 2.4, Math.sin(t * 10 + 3.1) * 2.4, Math.sin(t * 10 + 4.6) * 2.4], O = '#3a2a4d', q, pd = Math.sin(t * 9), d, B = b * .9;
  g.save(); g.translate(x, y); g.rotate(bk * 0.34); g.scale(sc * (1 - .08 * ab), sc); g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-8, -10); g.bezierCurveTo(-16, 0, -25 + sh, 12, -24 + sh, 27 + w[0]); g.quadraticCurveTo(-17 + sh, 33 + w[1], -8 + sh, 28 + w[2]); g.quadraticCurveTo(0 + sh, 35 + w[3], 9 + sh, 29 + w[0]); g.quadraticCurveTo(18 + sh, 34 + w[1], 24 + sh, 27 + w[2]); g.bezierCurveTo(25 + sh, 12, 16, 0, 8, -10); g.closePath();   // the cape
  q = g.createLinearGradient(-26, 0, 26, 0); q.addColorStop(0, '#a3122c'); q.addColorStop(.22, '#e63a54'); q.addColorStop(.5, '#ff7a8e'); q.addColorStop(.78, '#e63a54'); q.addColorStop(1, '#a3122c'); g.fillStyle = q; g.fill();
  q = g.createLinearGradient(0, -10, 0, 34); q.addColorStop(0, 'rgba(255,255,255,.22)'); q.addColorStop(.5, 'rgba(255,255,255,0)'); q.addColorStop(1, 'rgba(70,0,20,.3)'); g.fillStyle = q; g.fill(); g.strokeStyle = '#4a1230'; g.lineWidth = 2.4; g.stroke();
  g.strokeStyle = 'rgba(100,10,40,.5)'; g.lineWidth = 1.5; [[-4, -9, -11, 29], [0, -9, 0, 31], [4, -9, 11, 30]].forEach(function (f) { g.beginPath(); g.moveTo(f[0], f[1]); g.quadraticCurveTo(f[0] * 2 + sh * .35, 10, f[2] + sh * .8, f[3]); g.stroke(); });
  g.strokeStyle = 'rgba(255,200,210,.5)'; g.lineWidth = 1; [[-8, -7, -15, 26], [8, -7, 15, 26]].forEach(function (f) { g.beginPath(); g.moveTo(f[0], f[1]); g.quadraticCurveTo(f[0] * 1.8 + sh * .3, 10, f[2] + sh * .8, f[3]); g.stroke(); });   // lit folds
  for (d = -1; d <= 1; d += 2) {   // two white gloves paddling alternately at his sides
    var gx = d * 19 + b * .5, gy = 3 - d * pd * 5;
    g.beginPath(); g.moveTo(d * 12 + b * .4, -2); g.lineTo(gx, gy); g.strokeStyle = O; g.lineWidth = 5.4; g.stroke(); g.strokeStyle = '#ffe14d'; g.lineWidth = 3; g.stroke();   // a short arm
    g.beginPath(); g.arc(gx, gy, 5.6, 0, 7); g.fillStyle = g.createRadialGradient(gx - 1.8, gy - 2, .4, gx, gy, 6.6); g.fillStyle.addColorStop(0, '#ffffff'); g.fillStyle.addColorStop(.65, '#e8eef8'); g.fillStyle.addColorStop(1, '#a9b6cf'); g.fill(); g.strokeStyle = O; g.lineWidth = 1.7; g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(gx - 1.8, gy - 2, 1.3, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,' + (.35 + .3 * Math.abs(pd)).toFixed(2) + ')'; g.lineWidth = 1.6; g.beginPath(); g.arc(gx, gy + 1, 8.4, .5, 2.6); g.stroke();   // a little splash around the hand
  }
  g.beginPath(); g.moveTo(-1, 29); g.lineTo(1, 34 + w[3]); g.strokeStyle = '#6a4a1c'; g.lineWidth = 4.4; g.stroke(); g.strokeStyle = '#e8c24a'; g.lineWidth = 2; g.stroke();   // the stem end peeking out under the cape
  g.beginPath(); g.moveTo(0, -26); g.bezierCurveTo(19 + b, -20, 19 + b, 14, 1.5, 29); g.bezierCurveTo(-15 + b, 14, -17 + b, -20, 0, -26); g.closePath();   // the banana, seen from above
  q = g.createLinearGradient(-15, 0, 16, 0); q.addColorStop(0, '#e2a812'); q.addColorStop(.2, '#ffd93b'); q.addColorStop(.48, '#fff08a'); q.addColorStop(.8, '#ffd22e'); q.addColorStop(1, '#d9980c'); g.fillStyle = q; g.fill();
  g.save(); g.clip();
  q = g.createLinearGradient(0, 8, 0, 30); q.addColorStop(0, 'rgba(200,120,0,0)'); q.addColorStop(1, 'rgba(190,110,0,.4)'); g.fillStyle = q; g.fillRect(-26, 8, 52, 24);   // a shade toward the stem
  q = g.createLinearGradient(8, 0, 19 + b, 0); q.addColorStop(0, 'rgba(200,120,0,0)'); q.addColorStop(1, 'rgba(190,110,0,.45)'); g.fillStyle = q; g.fillRect(8, -28, 14, 60);   // the shaded right side
  q = g.createRadialGradient(-5.6 + b * .5, -6, 1, -5.6 + b * .5, -6, 17); q.addColorStop(0, 'rgba(255,255,255,.8)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.beginPath(); g.ellipse(-5.6 + b * .5, -4, 6, 19, 0.05, 0, 7); g.fill();   // the soft light
  g.restore(); g.strokeStyle = O; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, -26); g.bezierCurveTo(19 + b, -20, 19 + b, 14, 1.5, 29); g.bezierCurveTo(-15 + b, 14, -17 + b, -20, 0, -26); g.stroke();
  g.strokeStyle = 'rgba(170,110,0,.4)'; g.lineWidth = 1.2; [-6.4, 6.4].forEach(function (dd) { g.beginPath(); g.moveTo(dd * .25 + b * .2, -21); g.quadraticCurveTo(dd * 1.7 + b, 2, dd * .3 + b * .2, 24); g.stroke(); });   // the ridges
  g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(-6.4 + b * .5, 3, 1.5, 9, 0.05, 0, 7); g.fill(); g.beginPath(); g.arc(-6 + b * .5, -9, 1.2, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(9 + b * .5, 8, 1, 6, -.1, 0, 7); g.fill();   // the sharp gloss
  g.fillStyle = 'rgba(255,255,255,.8)'; [[7, -3, 1.1], [-2, 14, .9], [5, 17, .8], [-9, 9, .7]].forEach(function (p) { g.beginPath(); g.arc(p[0] + b * .4, p[1], p[2], 0, 7); g.fill(); });   // water drops
  g.beginPath(); g.moveTo(-14 + B, -20); g.quadraticCurveTo(-8 + B, -26, B, -23); g.quadraticCurveTo(8 + B, -26, 14 + B, -20); g.quadraticCurveTo(15 + B, -13, 7 + B, -12); g.quadraticCurveTo(B, -14.6, -7 + B, -12); g.quadraticCurveTo(-15 + B, -13, -14 + B, -20); g.closePath();   // the red mask, peeking over the front
  q = g.createLinearGradient(0, -26, 0, -12); q.addColorStop(0, '#ff5a72'); q.addColorStop(1, '#c4162f'); g.fillStyle = q; g.fill(); g.strokeStyle = '#5a1030'; g.lineWidth = 1.6; g.stroke(); g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(-5 + B, -21.4, 4.6, 1.3, -.15, 0, 7); g.fill();
  [-1, 1].forEach(function (dd) { var ex = dd * 5 + B; g.beginPath(); g.ellipse(ex, -18.6, 3.6, 4.2, 0, 0, 7); g.fillStyle = '#fffdf6'; g.fill(); g.strokeStyle = O; g.lineWidth = 1.2; g.stroke(); g.beginPath(); g.arc(ex + dd * .3, -19.6, 2.1, 0, 7); g.fillStyle = '#2a1230'; g.fill(); g.beginPath(); g.arc(ex + dd * .3 + .7, -20.4, .9, 0, 7); g.fillStyle = '#fff'; g.fill(); g.beginPath(); g.arc(ex + dd * .3 - .6, -18.4, .45, 0, 7); g.fill(); });   // eyes looking ahead
  g.fillStyle = 'rgba(255,120,140,.4)'; [-1, 1].forEach(function (dd) { g.beginPath(); g.ellipse(dd * 9.4 + B, -13.4, 2.1, 1.3, 0, 0, 7); g.fill(); });   // cheeks
  g.beginPath(); g.moveTo(-12.4 + b * .7, -10); g.quadraticCurveTo(b * .7, -6.2, 12.4 + b * .7, -10); g.lineTo(13 + b * .7, -4.6); g.quadraticCurveTo(b * .7, -.8, -13 + b * .7, -4.6); g.closePath(); q = g.createLinearGradient(0, -10, 0, -1); q.addColorStop(0, '#ff4a66'); q.addColorStop(1, '#bc1830'); g.fillStyle = q; g.fill(); g.strokeStyle = '#5a1030'; g.lineWidth = 1.5; g.stroke();   // the red scarf round his neck
  g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(-4 + b * .7, -7.4, 4.4, 1, .1, 0, 7); g.fill();
  g.beginPath(); g.arc(b * .7, -1, 3.8, 0, 7); g.fillStyle = '#c41f35'; g.fill(); g.strokeStyle = '#5a1030'; g.lineWidth = 1.3; g.stroke(); g.fillStyle = 'rgba(255,190,200,.8)'; g.beginPath(); g.arc(b * .7 - 1, -2, 1.2, 0, 7); g.fill();   // the knot
  g.beginPath(); g.arc(b * 1.1, -27, 3.6, 0, 7); g.fillStyle = '#6a4220'; g.fill(); g.strokeStyle = O; g.lineWidth = 1.8; g.stroke(); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(b * 1.1 - 1, -28, 1, 0, 7); g.fill();   // the dark tip of the banana
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-12 + b, -33); g.quadraticCurveTo(b * 1.1, -40, 12 + b, -33); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-17 + b, -29); g.quadraticCurveTo(b * 1.1, -44, 17 + b, -29); g.stroke();   // the bow wave: a bright crescent of foam in front of the nose
  g.restore();
}
function mgArch(x, y, hit) {   // the secret cove: a small rock arch in the water, with a dark opening
  if (y < -60 || y > H + 60) return;
  ctx.save(); ctx.translate(x, y); ctx.lineWidth = 3; ctx.strokeStyle = '#2a3340'; ctx.fillStyle = '#7d8a99'; ctx.beginPath(); ctx.roundRect(-34, -22, 68, 44, [22, 22, 8, 8]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = hit ? '#bfe8ff' : '#16304a'; ctx.beginPath(); ctx.roundRect(-18, -8, 36, 30, [16, 16, 0, 0]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.3 * Math.sin(time * 5)).toFixed(2) + ')'; ctx.fillRect(-4 + Math.sin(time * 3) * 8, -15, 8, 2); ctx.restore();
}
function mgRaft(x, y) {   // the treasure raft: planks, a chest and a glint
  ctx.save(); ctx.translate(x, y); ctx.lineWidth = 3; ctx.strokeStyle = '#3a1f10'; ctx.fillStyle = '#b07a3c'; ctx.beginPath(); ctx.roundRect(-36, -8, 72, 24, 6); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(58,31,16,0.6)'; ctx.lineWidth = 2; [-18, 0, 18].forEach(function (q) { ctx.beginPath(); ctx.moveTo(q, -8); ctx.lineTo(q, 16); ctx.stroke(); });
  ctx.lineWidth = 3; ctx.strokeStyle = '#3a1f10'; ctx.fillStyle = '#8a4a1c'; ctx.beginPath(); ctx.roundRect(-16, -22, 32, 20, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffd93b'; ctx.beginPath(); ctx.roundRect(-16, -22, 32, 8, 4); ctx.fill(); ctx.stroke(); ctx.fillRect(-3, -14, 6, 6);
  ctx.fillStyle = '#fffbe0'; var g = Math.sin(time * 6) * 8; ctx.fillRect(g - 1, -36, 2, 10); ctx.fillRect(g - 5, -32, 10, 2); ctx.restore();
}
function mgBoss(b) {   // Prince Chimp's giant submarine, up at the top of the sea
  if (b.kind === 'boom') { boomDraw(b); return; }
  var y = 84 + Math.sin(time * 2) * 3, a = b.end === 'won' ? clamp(1 - b.et / 1.5, 0, 1) : b.end === 'fail' ? clamp(1 - b.et / 1.0, 0, 1) : 1;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(b.x, y + (b.end ? b.et * 30 : 0)); ctx.scale(1.9, 1.9); ART.mg.draw(ctx, 'sub', 0, 0); ctx.restore(); ctx.globalAlpha = a;
  ART.chimp(ctx, b.x, y - 40, 0.42, 1, time); ctx.globalAlpha = 1;
  if (!b.end) { ctx.fillStyle = 'rgba(30,20,50,0.55)'; rrect(110, 12, 140, 10, 5); ctx.fill(); ctx.fillStyle = '#ff6b81'; rrect(110, 12, 140 * clamp(1 - b.t / 12, 0, 1), 10, 5); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; rrect(110, 12, 140, 10, 5); ctx.stroke(); }
}
/* Life under the water: now and then a school of fish or the dark shape of a submarine drifts across, far below the surface and the action. Drawn from the clock and the scroll (no physics), so it glides. */
function mgLifeStep(m) {
  var i, o, n, d, j;
  if (time >= m.lifeAt && m.life.length < 6) {
    m.lifeAt = time + 1.3 + frng() * 3; d = frng() < 0.5 ? 1 : -1; n = frng();
    if (n < 0.62) { o = { k: 'fish', d: d, sp: 26 + frng() * 30, dp: 0.55, n: 4 + Math.floor(frng() * 4), big: 0, fx: [], fy: [] }; for (j = 0; j < o.n; j++) { o.fx.push((frng() - 0.5) * 70 - j * 7 * d); o.fy.push((frng() - 0.5) * 34); } }
    else if (n < 0.88) o = { k: 'fish', d: d, sp: 18 + frng() * 14, dp: 0.5, n: 1, big: 1, fx: [0], fy: [0] };
    else o = { k: 'sub', d: d, sp: 9 + frng() * 9, dp: 0.4 };
    o.x0 = d > 0 ? -70 : W + 70; o.y0 = -50 - frng() * 40; o.s0 = m.scroll; o.t0 = time; o.ph = frng() * 6.28; if (o.k === 'sub') { o.x0 = d > 0 ? -150 : W + 150; o.sc = 0.8 + frng() * 0.35; } if (frng() < 0.5) o.x0 = 40 + frng() * 280;
    m.life.push(o);
  }
  for (i = m.life.length - 1; i >= 0; i--) { o = m.life[i]; if (o.y0 + (m.scroll - o.s0) * o.dp > H + 80 || Math.abs(o.x0 + o.d * o.sp * (time - o.t0) - W / 2) > W + 220) m.life.splice(i, 1); }
}
function mgLifeDraw(m) {
  var i, o, j, x, y, a, wg, c = m.life.length;
  for (i = 0; i < c; i++) {
    o = m.life[i]; x = o.x0 + o.d * o.sp * (time - o.t0); y = o.y0 + (m.scroll - o.s0) * o.dp;
    if (o.k === 'sub') { ctx.globalAlpha = 0.2; ctx.save(); ctx.translate(x, y); ctx.scale(o.d * o.sc, o.sc); ART.mg.draw(ctx, 'shadowSub', 0, 0); ctx.restore(); ctx.globalAlpha = 1; continue; }
    ctx.fillStyle = 'rgba(8,52,104,0.34)';
    for (j = 0; j < o.n; j++) {
      wg = Math.sin(time * 9 + o.ph + j * 1.7); a = o.big ? 1.9 : 1;
      ctx.save(); ctx.translate(x + o.fx[j], y + o.fy[j] + Math.sin(time * 1.4 + j + o.ph) * 2); ctx.scale(o.d * a, a);
      ctx.beginPath(); ctx.ellipse(0, 0, 8, 3.6, 0, 0, 6.2832); ctx.moveTo(-6, 0); ctx.lineTo(-13, -4 + wg * 2.4); ctx.lineTo(-13, 4 + wg * 2.4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}
function mgFlame(x, y, ph) {   // a tiki torch flame: it flickers in height, leans in the breeze, glows, and lets go of embers (y is the rim of the torch)
  var t = time * 9 + ph, h = 27 + Math.sin(t) * 3.2 + Math.sin(t * 2.3 + 1) * 2.2, ln = Math.sin(t * 0.7) * 3 + Math.sin(t * 1.9) * 1.6, w = 8.6 + Math.sin(t * 1.7 + 2) * 1.3, i, u;
  ctx.globalAlpha = 0.7 + Math.sin(t * 1.3) * 0.15 + Math.sin(t * 3.1) * 0.08; ART.mg.draw(ctx, 'glow', x, y - 16);
  ctx.globalAlpha = 1; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x + ln, y - h); ctx.bezierCurveTo(x + w + ln * 0.5, y - h * 0.62, x + w, y - 6, x, y); ctx.bezierCurveTo(x - w, y - 6, x - w + ln * 0.4, y - h * 0.62, x + ln, y - h); ctx.fillStyle = '#ff9f2a'; ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = '#d8501a'; ctx.stroke();
  h *= 0.68; w *= 0.62; ctx.beginPath(); ctx.moveTo(x + ln * 0.7, y - h - 2); ctx.bezierCurveTo(x + w + ln * 0.3, y - h * 0.6, x + w, y - 4, x, y - 1); ctx.bezierCurveTo(x - w, y - 4, x - w, y - h * 0.6, x + ln * 0.7, y - h - 2); ctx.fillStyle = '#ffd24a'; ctx.fill();
  h *= 0.55; w *= 0.55; ctx.beginPath(); ctx.moveTo(x + ln * 0.5, y - h - 3); ctx.bezierCurveTo(x + w, y - h * 0.6, x + w, y - 3, x, y - 2); ctx.bezierCurveTo(x - w, y - 3, x - w, y - h * 0.6, x + ln * 0.5, y - h - 3); ctx.fillStyle = '#fffbe0'; ctx.fill();
  for (i = 0; i < 3; i++) { u = (time * 0.8 + i / 3 + ph * 0.37) % 1; ctx.globalAlpha = (1 - u) * 0.9; ctx.fillStyle = i % 2 ? '#ffe27a' : '#ff9f2a'; ctx.fillRect(x + Math.sin(u * 7 + i * 2 + ph) * 6 + ln * u - 1, y - 24 - u * 34, 2, 2); }
  ctx.globalAlpha = 1;
}
var mgRip = [];   // rings spreading on the water where Fancy leaps, lands or gets hit: {x, y, t}
function renderMini() {   // like the flying game: everything is drawn where it will be when the picture is shown (physics is in fixed steps), so it glides instead of hopping
  var m = MG, a = m && !m.paused && m.ph === 'play' ? acc : 0, i, e, vS = CFG.mgSpeed;
  if (a) { m.t += a; m.scroll += vS * a; for (i = 0; i < m.ents.length; i++) { e = m.ents[i]; e.y += (vS + (e.vy || 0)) * a; e.x += (e.vx || 0) * a; } }
  renderMini0();
  if (a) { m.t -= a; m.scroll -= vS * a; for (i = 0; i < m.ents.length; i++) { e = m.ents[i]; e.y -= (vS + (e.vy || 0)) * a; e.x -= (e.vx || 0) * a; } }
}
function renderMini0() {
  var m = MG, i, e, lt = mgLT(m), rem = Math.max(0, CFG.mgSecs - lt) * CFG.mgSpeed, sb = H - rem, p = clamp(lt / CFG.mgSecs, 0, 1), z = m.leap >= 0 ? Math.sin(Math.PI * m.leap / mgLeapT()) : 0;
  ART.mg.sea(ctx, p, p + H / CFG.mgSpeed / CFG.mgSecs); ART.mg.water(ctx, m.scroll); ART.mg.caustic(ctx, m.scroll, p); ART.mg.glints(ctx, m.scroll, time, p); mgLifeStep(m); mgLifeDraw(m); if (secretsOn() && !m.practice && sb > -300) mgArch(m.cove, sb + 70, m.coveHit);
  if (sb > 0) {
    ART.mg.jungle(ctx, sb - 300); ART.mg.draw(ctx, 'shore', W / 2, sb - 150); mgFlame(17, sb - 110, 0); mgFlame(343, sb - 110, 2.3);
    ctx.lineCap = 'round'; for (i = 0; i < 3; i++) { ctx.strokeStyle = 'rgba(255,255,255,' + [.8, .55, .35][i] + ')'; ctx.lineWidth = [3.4, 2.4, 1.6][i]; ctx.beginPath(); for (var wx = 0; wx <= W; wx += 8) { var wy = sb - 6 + i * 6 + Math.sin(wx * .06 + time * 1.8 + i * 1.3) * 3 + Math.sin(wx * .17 - time * 2.4) * 1.1; if (wx === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy); } ctx.stroke(); }   // waves washing up the beach
  }
  for (i = 0; i < m.ents.length; i++) { e = m.ents[i]; if (e.k === 'whirl') { ctx.save(); ctx.translate(e.x, e.y); ctx.scale(1.2, 1.2); ART.mg.draw(ctx, 'whirl', 0, 0); ctx.rotate(e.spin * -2); ART.mg.draw(ctx, 'whirlArms', 0, 0); ctx.restore(); } }
  for (i = 0; i < m.ents.length; i++) {
    e = m.ents[i];
    if (e.k === 'sub' || e.k === 'barrels') {
      if (e.sink >= 0) { var s = e.sink / 1.1; ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(s * 0.5); ctx.scale(1 - 0.5 * s, 1 - 0.5 * s); ctx.globalAlpha = 1 - s; ART.mg.draw(ctx, 'sub', 0, 0, e.red ? 'r' : undefined); ctx.restore(); ctx.globalAlpha = 1; }
      else if (e.k === 'barrels' && e.vx) { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.spin * e.vx * 0.02); ART.mg.draw(ctx, e.vert ? 'barrelsV' : 'barrels', 0, 0, e.n); ctx.restore(); }
      else { if (e.k === 'sub') { ctx.save(); ctx.globalAlpha = .8; ctx.translate(e.x + e.w / 2 - 2, e.y + 2); ctx.rotate(-1.5708); ctx.scale(1.15, 1.25); ART.mg.draw(ctx, 'wake', 0, 65); ctx.restore(); } ART.mg.draw(ctx, e.k === 'barrels' && e.vert ? 'barrelsV' : e.k, e.x, e.y + Math.sin(time * 3 + e.ph) * 1.2, e.red ? 'r' : e.n); }
    } else if (e.k === 'bubble') ART.mg.draw(ctx, 'bubble', e.x, e.y + Math.sin(time * 3 + e.ph) * 3);
    else if (e.k === 'buoy') { var bu = (time * 0.8 + e.ph) % 1; ctx.globalAlpha = (1 - bu) * .7; ctx.lineWidth = 2.4; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(e.x, e.y, 24 + bu * 14, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1; ctx.save(); ctx.translate(e.x, e.y + Math.sin(time * 2.6 + e.ph) * 3); ctx.rotate(Math.sin(time * 1.7 + e.ph) * 0.1); ART.mg.draw(ctx, 'buoy', 0, 0); ctx.restore(); }
    else if (e.k === 'raft') mgRaft(e.x, e.y + Math.sin(time * 3 + e.ph) * 2);
  }
  for (i = 0; i < m.ents.length; i++) {   // wafers fly over the water: a shadow on the water shows where they really are
    e = m.ents[i];
    if (e.k === 'wafer') { ctx.fillStyle = 'rgba(0,30,60,0.28)'; ctx.beginPath(); ctx.ellipse(e.x + 5, e.y + 15, 14, 6, 0, 0, 7); ctx.fill(); ctx.save(); ctx.translate(e.x, e.y - 8 + Math.sin(e.spin * 9) * 1.5); ctx.rotate(e.spin * 5); ART.mg.draw(ctx, 'wafer', 0, 0); ctx.restore(); }
    else if ((e.k === 'sub' || e.k === 'barrels') && mgWinding(e)) { var wx = e.k === 'sub' ? e.x : e.vert ? e.x : e.x - e.w / 2 + 22 + 18 * Math.min(e.n - 1, 1), wy = (e.k === 'sub' ? e.y - 2 : e.vert ? e.y - e.h / 2 + 22 : e.y - 6) - 18 - Math.abs(Math.sin(time * 14)) * 5; ctx.save(); ctx.translate(wx, wy); ctx.scale(0.8, 0.8); ART.mg.draw(ctx, 'wafer', 0, 0); ctx.restore(); }
  }
  for (i = mgRip.length - 1; i >= 0; i--) { e = mgRip[i]; var ru = (time - e.t) / .85; if (ru < 0) continue; if (ru >= 1) { mgRip.splice(i, 1); continue; } ctx.globalAlpha = (1 - ru) * .85; ctx.save(); ctx.translate(e.x, e.y + 8); ctx.scale(.45 + ru * 1.7, .45 + ru * 1.7); ART.mg.draw(ctx, 'ripple', 0, 0); ctx.restore(); }
  var wka = Math.max(0, (1 - z * 1.6) * .8); ctx.globalAlpha = wka; if (wka > 0.02) { ctx.save(); ctx.translate(m.x - (m.bk || 0) * 5, m.y + 20); ctx.rotate((m.bk || 0) * .3); ART.mg.draw(ctx, 'wake', 0, 62); ctx.restore(); }
  for (i = 0; i < 2; i++) { var hu = (time * .9 + i / 2) % 1; ctx.globalAlpha = (1 - hu) * .45 * (1 - z); ctx.save(); ctx.translate(m.x, m.y + 12); ctx.scale(.55 + hu * 1.1, .55 + hu * 1.1); ART.mg.draw(ctx, 'ripple', 0, 0); ctx.restore(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,30,60,' + (0.22 - 0.1 * z).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(m.x, m.y + 14, 15 - 4 * z, 6 - 1.5 * z, 0, 0, 6.3); ctx.fill();   // Fancy's shadow stays on the water while he leaps
  if (!(m.inv > 0 && !calmOn() && Math.floor(time * 14) % 2)) { if (calmOn() && m.inv > 0) ctx.globalAlpha = 0.6; mgHero(ctx, m.x, m.y - mgLeapHt() * z, 0.9 * (1 + 0.45 * z), m.bk || 0, time); ctx.globalAlpha = 1; }   // Fancy seen from above, nose up the screen, leaning into a turn
  if (m.boss) mgBoss(m.boss);
  for (i = 0; i < m.ents.length; i++) { e = m.ents[i]; if (e.k === 'gull') { var gf = Math.floor((time * 9 + e.f) % 4); ctx.globalAlpha = .5; ART.mg.draw(ctx, 'gullShadow', e.x + 16, e.y + 30, gf); ctx.globalAlpha = 1; ART.mg.draw(ctx, 'gull', e.x, e.y, gf + (e.red ? 4 : 0)); } }
  if (m.limes.length) drawLimes(m);
  drawFx();
  var mlh = opt('lefty'), mhx = function (x) { return mlh ? W - x : x; };
  for (i = 0; i < m.maxH; i++) ART.mg.draw(ctx, 'heart', mhx(26 + i * 28), 30, i < m.hearts, 1);
  if (m.wsh > 0) { ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#4a9bd8'; ctx.beginPath(); ctx.arc(mhx(26 + m.maxH * 28 + 6), 30, 10, 0, 7); ctx.fill(); ctx.stroke(); }   // the wafer shield is ready
  if (m.lm > 0) { var lx = mhx(26 + m.maxH * 28 + (m.wsh > 0 ? 34 : 6)); ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#7ccc2e'; ctx.beginPath(); ctx.arc(lx, 30, 10, 0, 7); ctx.fill(); ctx.stroke(); outlined(String(m.lm), lx, 30, 13, '#ffffff'); }   // the limes left
  ctx.fillStyle = 'rgba(30,20,50,0.55)'; rrect(mhx(350), 70, 10, 480, 5); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  var ry = 540 - clamp(lt / CFG.mgSecs, 0, 1) * 470; ctx.fillStyle = '#ffd93b'; rrect(mhx(350), ry, 10, 540 - ry + 10, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(mhx(350) + 2.4, ry + 4, 2, Math.max(0, 540 - ry - 4));   // the way done so far fills with gold
  ART.coin(ctx, mhx(342), ry, time);
  if (m.ph === 'intro' || m.ph === 'play') { drawPauseBtn(MG_PB, .55); drawClock(MG_PB[0], opt('lefty') ? 26 : 334); }   // the pause button
  if (m.ph === 'intro') { if (m.pt < MG_INTRO || m.wait) { outlined('Chimp\'s Navy!', W / 2, 150, 40, '#ffd93b'); outlined('Drag or move the mouse to steer.', W / 2, 196, 17, '#ffffff'); outlined('Tap or click to LEAP subs and barrels.', W / 2, 222, 17, '#ffffff'); outlined('No steering in mid-leap: time it!', W / 2, 248, 17, '#ffd93b'); outlined('Seagulls can\'t be leapt: dodge them!', W / 2, 274, 17, '#ffffff'); outlined('Free the friends in bubbles!', W / 2, 300, 17, '#ffffff'); if (m.wait) tapWord(W / 2, 400); } else rsgWord(m.pt - MG_INTRO, W / 2, 190); }
  else if (m.ph === 'play' && m.pt < 0.6) rsgWord(CFG.rsgBeat * 2 + m.pt, W / 2, 190);
  else if (m.practice && (m.ph === 'win' || m.ph === 'lose')) practiceCard(m);
  else if (m.ph === 'win') {
    var nf = CFG.friendsPerStage + m.saved + m.bonus; cardFrame(40, 176, 280, 214, '#58c46f', 'Made it to shore!', 27);
    ART.mg.draw(ctx, 'bubble', 90, 270, undefined); outlinedC('+' + nf, 90, 316, 30, '#ffd93b'); outlined('banana friends', 212, 262, 18, '#ffffff'); outlined('swam to freedom!', 212, 288, 18, '#ffffff');
    outlined('Next stop', W / 2, 348, 14, '#ffffff'); outlined(ART.names[themeOf(stage)], W / 2, 372, 19, '#ffd93b');
  }
  else if (m.ph === 'lose') {
    ctx.fillStyle = 'rgba(58,42,77,0.32)'; ctx.fillRect(0, 0, W, H); cardFrame(40, 176, 280, 262, '#4a9bd8', 'Splash!', 32);
    ART.chimp(ctx, 256, 266, 0.62, 0, time); outlined('The Chimp Navy', 128, 258, 18, '#ffffff'); outlined('got you!', 128, 284, 18, '#ffffff'); outlined('All your hearts are gone.', W / 2, 330, 15, '#ffffff');
    ctx.globalAlpha = m.pt > 0.6 ? 1 : 0.35; mgBtn([70, 354, 220, 46], 'Dive in again!', '#58c46f'); ctx.globalAlpha = 1;
  }
  if (m.paused) { ctx.fillStyle = 'rgba(58,42,77,0.45)'; ctx.fillRect(0, 0, W, H); outlined('Paused', W / 2, 226, 44, '#ffd93b'); outlined('Tap to continue', W / 2, 286, 24, '#ffffff'); mgBtn(PS_BT, 'Settings', '#4a9bd8'); padLine(); if (m.practice) mgBtn(MG_BT, 'Back to title', '#8a6cd8'); else outlined('(the P key pauses too)', W / 2, 366, 15, '#ffffff'); drawExtrasCard(); }
}
function noteBest() {
  if (pracN) return;   // a Relaxed run keeps its own best score, so the normal records stay honest
  setBestOf(score); if (spdPct() === 100) save.bestStage = Math.max(save.bestStage, stage);
}
function recordRun() {
  var s = save.stats; save.cont = {}; if (!contRun) s.runs++; s.gates += Math.max(0, score - (contRun ? gatesCounted : 0)); gatesCounted = score; s.flaps += runFlaps; s.secs += Math.round(runTime);
  newBest = score > runStartBest; noteBest(); s.streak = Math.max(s.streak, bestStreak);
}

/* ===== The finale: Prince Chimp is beaten. The player chooses to keep their upgrades and banana credits, or start fresh. Either way the game is exactly as hard as before. ===== */
function startVictory() {
  flipV = 0;
  var s = save.stats, secs = Math.max(1, Math.round(runSecs)), pz = runPauses;
  if (fightNew) { toast(fightNew, 6000); fightNew = ''; }
  if (badgeNew) { toast('Challenge badge earned: ' + badgeNew + '! New scarf and mask colors are in Costume.', 7000); badgeNew = ''; }
  split('Win'); state = 'victory'; VSQ++; setBar(false); vicT = 0; pendNext = ''; nextT = 0; cardT = -1; BAL = null; fwk.length = 0; fwkT = 0.4; recordRun();
  VS = { secs: secs, pauses: pz, flaps: runFlaps, coins: runCoins, hurts: runHurts, friends: s.friends - runFriends0, pops: runPops, popsOf: runPopsOf, prevTime: s.bestWin, prevPz: s.bestPz ? s.bestPz - 1 : -1, recT: !s.bestWin || secs < s.bestWin, recP: !s.bestPz || pz + 1 < s.bestPz };
  if (VS.recT) s.bestWin = secs; if (VS.recP) s.bestPz = pz + 1;
  persist(); ART.bal.warm(); burst(W / 2, 200, 50, ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'], 320, 400); }
function setWo(id, t, sm) { var e = $(id); e.querySelector('b').textContent = t; e.querySelector('small').textContent = sm; }
function openWin() {
  var np = Math.min(CFG.plusMax, save.stats.plus + 1), up = np > save.stats.plus;
  pWin.hidden = false; setWo('wFresh', 'Start brand new', 'Upgrades, credits and speed bonus go back to zero. Your records and costumes stay.'); $('wFresh').classList.remove('armed'); freshArmed = false; $('winMsg').textContent = '';
  setWo('wKeep', up ? 'Play again, 10% faster!' : 'Play again!', 'Keep all your upgrades and credits.' + (up ? ' Your speed bonus grows to +' + np * 10 + '%!' : ''));
  $('winNote').textContent = up ? 'You beat Prince Chimp! Pick what happens next.' : 'You beat Prince Chimp! Your speed bonus is already at the top: +' + CFG.plusMax * 10 + '%.';
}
function giftNeeded() { return !save.unlocks.balloons ? 1 : pcBeaten(4) && !save.unlocks.crown ? 2 : 0; }   // 1: Prince Chimp's balloons (first win), 2: the crown (Crown Duel won)
function afterWin() { giftTitle = false; var g = giftNeeded(); if (g) { resetWorld(); startGift(g === 2 ? 1 : 0); } else toReady(); }   // a gift scene ends with the only toReady, so the one-run perks are spent once
var freshArmed = false;
function winTitle() { save.stats.plus = Math.min(CFG.plusMax, save.stats.plus + 1); persist(); pWin.hidden = true; var g = giftNeeded(); if (g) { startGift(g === 2 ? 1 : 0, true); return; } resetWorld(); state = 'title'; titleT = 5; setBar(true); toast('Saved. Welcome back to the title screen!', 3000); }   // keep everything, save, and rest at the title screen instead of going straight to the launch pad
function winKeep() { save.stats.plus = Math.min(CFG.plusMax, save.stats.plus + 1); persist(); pWin.hidden = true; afterWin(); }
function winFresh() {
  if (otherTab) { $('winMsg').textContent = 'Saving is paused because the game changed in another tab. Reload this page first.'; return; }
  if (!freshArmed) { freshArmed = true; setWo('wFresh', 'Tap again to be sure!', 'Upgrades, credits and speed bonus will reset to zero.'); $('wFresh').classList.add('armed'); $('winMsg').textContent = 'Your best score, records and costumes always stay. Your current save is kept as a backup on this device.'; return; }
  var old = sget(K.main); if (old !== null) sset(K.before, old);
  save.boosts = { spent: save.stats.friends + save.stats.coins };   // upgrades back to level 0 and the credit balance to zero; the lifetime count of friends freed stays in the records
  save.stats.plus = 0; persist(); pWin.hidden = true; afterWin();
}
$('wCopy').addEventListener('click', function () { copyText(resultText(), function (ok) { $('winMsg').textContent = ok ? 'Copied your result. Paste it anywhere!' : 'Could not copy on this browser.'; }); });
$('wKeep').addEventListener('click', winKeep); $('wTitle').addEventListener('click', winTitle); $('wFresh').addEventListener('click', winFresh);

/* ===== Specials: Prince Chimp's balloons (Balloon Party stage), pennant flags, and the big victory card ===== */
var balNight = false, BAL = null, BALR = null, shd = [], BAL_DUR = 25, BAL_END = 22;   // the balloon stage now running, its result card, pieces of popped balloons
var fl = [], flAcc = 0, FLC = ['#ff4d6d', '#ffd93b', '#4d9bff', '#4fd36a', '#ff9a3c', '#9a6cff'];   // the pennant string: where Fancy's tail has been
var giftT = 0, giftS = 0, giftSt = 0, fwk = [], fwkT = 0;   // the balloon hand-over scene (step, seconds in step); victory fireworks
function rainOk() { return save.stats.streak >= 10; }   // earned by a best perfect streak of 10
function rainOn() { return rainOk() && !save.unlocks.rainOff; }
var RB = []; (function () { for (var i = 0; i < 36; i++) RB.push('hsl(' + i * 10 + ',92%,60%)'); })();
var FLN = 18;   // pennant string length in points (40% shorter than the old 30)
function flagsOn() { var u = save.unlocks; return !!u.flags && !u.flagsOff; }
function waferOn() { return save.stats.wins >= CFG.waferWins; }
function fmtM(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
function secretsFound() { var u = save.unlocks; return (u.balloons ? 1 : 0) + (u.flags ? 1 : 0) + (u.wafers ? 1 : 0); }

/* --- the pennant string --- */
function flagStep(dt, sp) {
  var i, p; for (i = 0; i < fl.length; i++) fl[i].x -= sp * dt * 0.6;   // the string drags behind Fancy, a little slower than the world
  flAcc += dt; if (flAcc >= 0.03) { flAcc = 0; p = fl.length >= FLN ? fl.shift() : { x: 0, y: 0 }; p.x = bx - 17; p.y = by + 3; fl.push(p); }
}
function drawFlags() {   // a thin string drawn as one smooth curve, with small pennants that stream back and flutter more toward the loose end
  var n = fl.length, i, c = 0, p, a, b, tx, ty, tl, w, wx, d, calm = calmOn();
  if (n < 4) return;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(fl[n - 1].x, fl[n - 1].y);
  for (i = n - 2; i > 0; i--) ctx.quadraticCurveTo(fl[i].x, fl[i].y, (fl[i].x + fl[i - 1].x) / 2, (fl[i].y + fl[i - 1].y) / 2);
  ctx.lineTo(fl[0].x, fl[0].y); ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.stroke(); ctx.strokeStyle = '#fffdf6'; ctx.lineWidth = 1; ctx.stroke();
  for (var ii = n - 4; ii >= 3; ii -= 2.5, c++) {
    i = Math.round(ii); p = fl[i]; a = fl[i + 1]; b = fl[i - 1]; tx = a.x - b.x; ty = a.y - b.y; tl = Math.sqrt(tx * tx + ty * ty) || 1; tx = tx / tl * 3.8; ty = ty / tl * 3.8;
    d = (n - 1 - i) / n; w = calm ? 0 : Math.sin(time * 11 + c * 1.7) * (1.2 + 2.6 * d); wx = calm ? 0 : Math.cos(time * 8.3 + c * 1.3) * (0.8 + 2.2 * d);   // wind flutter, both up-down and back-forth, so it still shows when the string runs straight up or down
    ctx.beginPath(); ctx.moveTo(p.x + tx, p.y + ty);
    ctx.quadraticCurveTo(p.x - 1 + w * 0.2 + wx * 0.3, p.y + 3.8 + w * 0.5, p.x - 8.2 + w * 0.3 + wx, p.y + 5.4 + w);
    ctx.quadraticCurveTo(p.x - 5.5 + w * 0.2 + wx * 0.3, p.y + 1.4 + w * 0.3, p.x - tx, p.y - ty); ctx.closePath();
    ctx.fillStyle = FLC[c % FLC.length]; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
  }
}

/* --- Balloon Party: a calm flight between the Ice Cream Parlor and the Silverware Drawer. No obstacles; pop balloons. Only the floor hurts. --- */
function balPlan(nt) {   // nt: the night party packs in 40% more balloons (the same plan, squeezed into the same time)
  var p = [], cur = 1.0, k, i, n, y, d, A, c, dn = nt ? 1.4 : 1;
  function add(t, yy, gold) { p.push({ t: t, y: clamp(yy, 135, 500), ci: gold ? 8 : Math.floor(rng() * 8), gold: !!gold }); }
  while (cur < BAL_END * dn) {
    k = rng();
    if (k < 0.3) { n = 5 + Math.floor(rng() * 3); c = 200 + rng() * 200; A = 50 + rng() * 40; for (i = 0; i < n; i++) add(cur + i * 0.42, c + A * Math.sin(i * 0.95)); cur += n * 0.42 + 0.5; }   // a wave
    else if (k < 0.55) { n = 4 + Math.floor(rng() * 3); y = 170 + rng() * 280; d = (rng() < 0.5 ? -1 : 1) * 38; for (i = 0; i < n; i++) add(cur + i * 0.4, y + d * i); cur += n * 0.4 + 0.5; }   // a slope
    else if (k < 0.8) { c = 200 + rng() * 210; add(cur, c - 70); add(cur + 0.05, c); add(cur + 0.1, c + 70); if (rng() < 0.5) { add(cur + 0.7, c - 35); add(cur + 0.75, c + 35); } cur += 1.5; }   // a tall bunch
    else if (k < 0.93) { y = 320 + rng() * 140; for (i = 0; i < 3; i++) add(cur + i * 0.55, y - i * 45 + (rng() - 0.5) * 20); cur += 2.2; }
    else { add(cur, 420 + rng() * 80, true); cur += 1.2; }   // a gold one, low and tempting
  }
  add(7 + rng() * 2, 250 + rng() * 150, true); add(15 + rng() * 2, 250 + rng() * 150, true);
  if (nt) p.forEach(function (q) { q.t /= dn; });
  p.sort(function (a, b) { return a.t - b.t; }); return p;
}
function startBalloons() {
  flipV = 0; ART.bal.warm(balNight);
  state = 'play'; pendNext = ''; nextT = 0; cardT = -1; celT = 0; obs = []; fx.length = 0; trail.length = 0; fl.length = 0; pops.length = 0; shd.length = 0;
  split(balNight ? 'Balloons2' : 'Balloons'); BAL = { night: balNight, t: 0, ph: 'play', plan: balPlan(balNight), pi: 0, list: [], popped: 0, total: 0, combo: 0, comboT: 0, coins: 0, pw: [] }; BAL.total = BAL.plan.length;
  rsgT = 0; rsgGo = false; rsgTap = false; vy = 0; grace = 0; boost = 0; boostT = 99; trackOn = false; invuln = 0; spinT = 0; by = CFG.rsgY; bx = CFG.bananaX; washA = calmOn() ? 0.4 : 1;
}
function balPop(b) {
  var B = BAL, col = ART.bal.cols[b.ci], n = calmOn() ? 6 : 11, i, a, v, c = b.gold ? 5 : 1;
  B.popped++; runPops++; B.combo++; B.comboT = 1.2; var ex = B.combo >= 7 ? 3 : B.combo >= 5 ? 2 : B.combo >= 3 ? 1 : 0; c += ex; B.coins += c; giveCoins(c, b.x, b.y);   // a chain of quick pops pays extra: +1 from the 3rd, +2 from the 5th, +3 from the 7th
  var st = b.gold ? 6 : Math.floor(frng() * 6), sh, cnt = st === 1 ? n + 8 : st === 4 ? 8 : st === 3 ? 5 : n;   // each balloon pops its own way: six styles (a gold one always bursts into stars)
  if (calmOn()) cnt = Math.min(cnt, 7);
  for (i = 0; i < cnt; i++) {
    a = st === 4 ? i / cnt * 6.283 : frng() * 6.283; v = 90 + frng() * 150;
    sh = { x: b.x + Math.cos(a) * 8, y: b.y + Math.sin(a) * 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, r: frng() * 6.28, vr: (frng() - 0.5) * 18, t: 0, l: 0.6 + frng() * 0.35, s: 5.5 + frng() * 5, c: col, k: 0, g: 1, cv: 0, fl: 0 };
    if (st === 1) { sh.k = 1; sh.vx *= 0.8; sh.vy = Math.sin(a) * v * 0.7 - 110; sh.g = 0.22; sh.fl = 1; sh.l = 1.0 + frng() * 0.5; sh.s = 3 + frng() * 2.6; sh.c = frng() < 0.4 ? '#ffffff' : frng() < 0.5 ? '#ffd93b' : col; }   // confetti: little squares that drift down and flutter
    else if (st === 2) { v = 120 + frng() * 70; sh.vx = Math.cos(a) * v; sh.vy = Math.sin(a) * v; sh.cv = 5.5; sh.g = 0.3; sh.vr = 14; sh.l = 0.8 + frng() * 0.3; }   // a swirl: pieces curl as they fly
    else if (st === 3) { v = 230 + frng() * 120; sh.vx = Math.cos(a) * v; sh.vy = Math.sin(a) * v; sh.k = 3; sh.s = 8 + frng() * 4; sh.l = 0.38 + frng() * 0.12; sh.g = 0.5; }   // a snap: a few long slivers fly out fast
    else if (st === 4) { v = 170; sh.vx = Math.cos(a) * v; sh.vy = Math.sin(a) * v; sh.g = 0.35; sh.l = 0.7; sh.s = 7.5; }   // a tidy ring of eight pieces
    else if (st === 5) { sh.vx *= 0.35; sh.vy = 20 + frng() * 60; sh.g = 1.7; sh.s = 6 + frng() * 5; sh.l = 0.9; }   // a limp one: the pieces just drop
    else if (st === 6) { v = 110 + frng() * 150; sh.vx = Math.cos(a) * v; sh.vy = Math.sin(a) * v - 40; sh.k = 2; sh.s = 6 + frng() * 5; sh.c = frng() < 0.5 ? '#ffd93b' : '#fff2a0'; sh.l = 0.8 + frng() * 0.4; sh.g = 0.6; sh.vr = (frng() - 0.5) * 10; }   // gold: a burst of sparkling stars
    shd.push(sh);
  }
  if (shd.length > 90) shd.splice(0, shd.length - 90);
  B.pw.push({ x: b.x, y: b.y, t: 0, ci: b.ci, st: st, col: col });
  burst(b.x, b.y, 8, [col, '#ffffff', '#fff2a0'], 200, 220);
  if (b.gold) pop('GOLD! +5', '#ffd93b', 22); else if (B.combo >= 3 && B.combo % 2 === 1) pop('CHAIN x' + B.combo + '  +' + ex, col, 20);
}
function updateBalloons(dt, sp) {
  var B = BAL, i, b, dx, dy, q;
  if (B.pw.length) for (i = B.pw.length - 1; i >= 0; i--) { B.pw[i].t += dt; if (B.pw[i].t > 0.4) B.pw.splice(i, 1); }
  if (B.ph === 'done') return;
  if (!rsgHold()) { B.t += dt; if (B.comboT > 0) B.comboT -= dt; else B.combo = 0; }
  while (B.pi < B.plan.length && B.plan[B.pi].t <= B.t) { q = B.plan[B.pi++]; B.list.push({ x: W + 44, y: q.y, ci: q.ci, gold: q.gold, ph: rng() * 6.28 }); }
  for (i = B.list.length - 1; i >= 0; i--) {
    b = B.list[i]; b.x -= sp * dt; dx = b.x - bx; dy = b.y + Math.sin(time * 1.7 + b.ph) * 5 - by;
    if (dx > 0 && dx < 70 && dy > -60 && dy < 60) { b.y -= dy * Math.min(1, dt * 2.4) * (1 - dx / 70); dy = b.y + Math.sin(time * 1.7 + b.ph) * 5 - by; }   // a balloon that is close drifts toward Fancy: generous for small hands
    if (dx * dx + dy * dy < 35 * 35) { balPop(b); B.list.splice(i, 1); continue; }
    if (b.x < -50) B.list.splice(i, 1);
  }
  if (B.t >= BAL_DUR && !B.list.length && B.pi >= B.plan.length) balFinish();
}
function balFinish() {
  var B = BAL, perfect = B.popped === B.total, bonus = (perfect ? 15 : B.popped >= B.total * 0.7 ? 5 : 0) * (B.night ? 2 : 1);
  if (bonus) giveCoins(bonus, bx + 20, by);
  if (!B.night) save.stats.balClears = Math.min(999, save.stats.balClears + 1); if (!B.night && save.stats.balClears === CFG.empClears) toast('A secret door appeared! Tap it to enter the Emporium.', 5200); persist();
  BALR = { night: B.night, popped: B.popped, total: B.total, coins: B.coins + bonus, perfect: perfect, bonus: bonus }; runPopsOf += B.total;
  if (B.night) ART.bal.free();
  BAL = null; rsgT = 0; rsgGo = false; rsgTap = false; celT = CFG.celSecs; vy = 0; grace = 0; invuln = 0; lastAfter = 0;
  bgFrom = bgTheme; bgTheme = themeOf(stage); bgT = bgFrom === bgTheme ? 1 : 0; if (bgTheme === ART.journeyTheme) gardenD0 = dist;
  nextX = W + CFG.obW + speedFor(stage) * (rsgGoAt() + 0.4);   // the first gate of the Silverware Drawer arrives well after GO
  burst(W / 2, 220, 40, ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'], 300, 340);
}
function shardStep(dt) {
  for (var i = shd.length - 1; i >= 0; i--) { var s = shd[i]; s.t += dt; if (s.t > s.l) { shd[i] = shd[shd.length - 1]; shd.pop(); continue; } if (s.cv) { var ca = s.cv * dt, cc = Math.cos(ca), cs = Math.sin(ca), nvx = s.vx * cc - s.vy * cs; s.vy = s.vx * cs + s.vy * cc; s.vx = nvx; } s.x += s.vx * dt + (s.fl ? Math.sin(s.t * 9 + s.r) * 22 * dt : 0); s.y += s.vy * dt; s.vy += 520 * (s.g || 1) * dt; s.r += s.vr * dt * (s.fl ? 1.6 : 1); }
}
function drawBalloons() {
  var B = BAL, i, b, s, p, u, f, a, k2, y;
  if (B) for (i = 0; i < B.list.length; i++) { b = B.list[i]; if (b.x > -50 && b.x < W + 50) ART.bal.draw(ctx, b.ci, b.x, b.y + Math.sin(time * 1.7 + b.ph) * 5); }
  if (B) for (i = 0; i < B.pw.length; i++) {   // the pop: a quick squash and white flash, then a ring
    p = B.pw[i]; f = p.t / 0.4; if (p.t < 0.07) { u = p.t / 0.07; ART.bal.draw(ctx, p.ci, p.x, p.y, 1 + 0.3 * u, 1 - 0.2 * u); }
    var ps = p.st | 0;
    if (ps !== 5) { ctx.globalAlpha = Math.max(0, 1 - f * 1.6) * (ps === 3 ? 1 : 0.85); ctx.fillStyle = ps === 6 ? '#fff2a0' : '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, (ps === 3 ? 5 : 8) + (ps === 3 ? 44 : 30) * Math.min(1, f * 3), 0, 7); ctx.fill(); }   // the flash
    if (ps === 0 || ps === 2 || ps === 4 || ps === 6) { ctx.globalAlpha = 1 - f; ctx.strokeStyle = ps === 4 ? p.col : '#ffffff'; ctx.lineWidth = (ps === 4 ? 8 : 5) * (1 - f) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, 12 + (ps === 4 ? 70 : 52) * f, 0, 7); ctx.stroke(); }   // the ring
    if (ps === 2 && f > 0.1) { ctx.globalAlpha = (1 - f) * 0.8; ctx.strokeStyle = p.col; ctx.lineWidth = 3 * (1 - f) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, 6 + 34 * (f - 0.1), 0, 7); ctx.stroke(); }   // a second, inner ring
    if (ps === 3) { ctx.globalAlpha = 1 - f; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4; ctx.beginPath(); for (var rr2 = 0; rr2 < 8; rr2++) { var ra = rr2 * 0.785 + 0.2; ctx.moveTo(p.x + Math.cos(ra) * (10 + 20 * f), p.y + Math.sin(ra) * (10 + 20 * f)); ctx.lineTo(p.x + Math.cos(ra) * (24 + 46 * f), p.y + Math.sin(ra) * (24 + 46 * f)); } ctx.stroke(); }   // a crack of spokes
    ctx.globalAlpha = 1;
  }
  ctx.lineJoin = 'round'; ctx.lineWidth = 1.5; ctx.strokeStyle = INK;
  for (i = 0; i < shd.length; i++) {
    s = shd[i]; ctx.globalAlpha = clamp((s.l - s.t) / 0.25, 0, 1); ctx.fillStyle = s.c; ctx.beginPath();
    if (s.k === 1) { var cq = Math.cos(s.r) * s.s, sq = Math.sin(s.r) * s.s * (0.3 + 0.7 * Math.abs(Math.sin(s.t * 8 + s.r))); ctx.moveTo(s.x + cq, s.y + sq); ctx.lineTo(s.x - sq, s.y + cq * 0.5); ctx.lineTo(s.x - cq, s.y - sq); ctx.lineTo(s.x + sq, s.y - cq * 0.5); }
    else if (s.k === 2) { for (k2 = 0; k2 < 8; k2++) { a = s.r + k2 * 0.785; y = s.s * (k2 % 2 ? 0.3 : 1.15); ctx.lineTo(s.x + Math.cos(a) * y, s.y + Math.sin(a) * y); } }
    else if (s.k === 3) { a = Math.atan2(s.vy, s.vx); ctx.moveTo(s.x + Math.cos(a) * s.s, s.y + Math.sin(a) * s.s); ctx.lineTo(s.x - Math.cos(a) * s.s * 0.6 - Math.sin(a) * 1.8, s.y - Math.sin(a) * s.s * 0.6 + Math.cos(a) * 1.8); ctx.lineTo(s.x - Math.cos(a) * s.s * 0.6 + Math.sin(a) * 1.8, s.y - Math.sin(a) * s.s * 0.6 - Math.cos(a) * 1.8); }
    else for (k2 = 0; k2 < 3; k2++) { a = s.r + k2 * 2.094; y = s.s * (k2 ? 0.8 : 1.5); ctx.lineTo(s.x + Math.cos(a) * y, s.y + Math.sin(a) * y); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function drawBalHud() {
  var B = BAL, w = 150, x0 = W / 2 - w / 2;
  ctx.lineWidth = 2.5; ctx.strokeStyle = INK; rrect(x0, 108, w, 11, 5.5); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill(); ctx.stroke();
  if (B.t > 0) { rrect(x0 + 1, 109, Math.max(8, (w - 2) * clamp(B.t / BAL_DUR, 0, 1)), 9, 4.5); ctx.fillStyle = '#ff6b81'; ctx.fill(); }
  outlined((B.night ? 'Night Balloon Party  -  ' : 'Balloon Party  -  ') + B.popped + ' of ' + B.total, W / 2, 133, 14, '#ffffff');
  if (B.combo >= 2 && B.comboT > 0) { outlinedC('x' + B.combo, W / 2, 158, 20, '#ffd93b'); ctx.lineWidth = 2; ctx.strokeStyle = INK; rrect(W / 2 - 30, 168, 60, 7, 3.5); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill(); ctx.stroke(); rrect(W / 2 - 29, 169, Math.max(5, 58 * clamp(B.comboT / 1.2, 0, 1)), 5, 2.5); ctx.fillStyle = '#ffd93b'; ctx.fill(); }   // the chain meter: pop the next one before it runs out
}
function balIntro() {   // the title and the one rule, before Ready, Set, Go
  if (!BAL || BAL.t > 0 || rsgT < 0 || rsgT >= CFG.cardSecs) return;
  var a = clamp(Math.min(rsgT / 0.3, (CFG.cardSecs - rsgT) / 0.3), 0, 1);
  ctx.globalAlpha = a; outlined(BAL.night ? 'Night Party!' : 'Balloon Party!', W / 2, 168, 40, '#ffd93b'); outlined(BAL.night ? 'More balloons, a faster sky. Pop them all!' : 'Prince Chimp is sorry. Pop his balloons!', W / 2, 212, 16, '#ffffff'); outlined('Nothing can hurt you up here. Only the floor.', W / 2, 236, 16, '#ffffff'); ctx.globalAlpha = 1;
}
function drawEmpDoor(cx, by0) {   // the Emporium door on the Balloon Party card: an arched wooden door with a gold star
  var w = 34, h = 48, x = cx - w / 2, y = by0 - h, lit = 0.5 + 0.5 * Math.sin(time * 4);
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#3a2a4d'; ctx.fillStyle = '#8a4b2a';
  ctx.beginPath(); ctx.moveTo(x, by0); ctx.lineTo(x, y + w / 2); ctx.arc(cx, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, by0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,217,59,' + (0.55 + 0.45 * lit) + ')'; ctx.beginPath();
  for (var k = 0; k < 10; k++) { var r = k % 2 ? 4 : 9, an = -1.5708 + k * 0.62832; ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(an) * r, y + 17 + Math.sin(an) * r); }
  ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffd93b'; ctx.beginPath(); ctx.arc(x + w - 7, y + 33, 2.6, 0, 6.2832); ctx.fill(); ctx.restore();
}
/* ===== Fancy's Place: the home base (a door on the title screen, once the Emporium is open). A room drawn once into a picture; Fancy wanders on the floor; tap things on the wall to read about them ===== */
/* ===== Chimp Airforce (the Cloud key): a secret flying game. Same one-tap flap as the main game, but in open sky: Chimp biplanes cross from the right, cloud banks hide some of them, Lime defense shoots the ones that would hit (and coconuts), a bomber fires coconuts near the end, then the volcano rises. Three hearts, about a minute. Win: +25 bananas, the Cloud medal on the wall in Fancy's Place. ===== */
var SKY = null, SKY_SECS = 62, SKY_X = 96, SKY_V = 190, SKY_BOSS = 38, SKY_BA = [70, 330, 220, 46], SKY_BT = [70, 388, 220, 46];
function skyOn() { return empOwn(E.keySky); }
function skyPlan() {
  var p = [], t = 2.6, pr, gap, x, y, vx, r, c = 0;
  function pl(tt, yy, o) { o = o || {}; o.t = tt; o.k = 'plane'; o.y = yy; o.vx = o.vx || -(205 + rng() * 30 + 55 * pr); p.push(o); }
  while (t < SKY_BOSS - 1.5) {
    pr = clamp((t - 2.6) / (SKY_BOSS - 4), 0, 1); r = rng(); y = 90 + rng() * 460;
    if (r < 0.2 + 0.1 * pr && pr > 0.25) { y = 110 + rng() * 270; vx = -(195 + 40 * pr); pl(t, y, { vx: vx, col: c++ % 3 }); pl(t, y + 150, { vx: vx, col: c++ % 3 }); }   // a pair with a gap to fly through
    else if (r < 0.45 && pr > 0.15) pl(t, 130 + rng() * 360, { mode: 1, amp: 36 + rng() * 26, ph: rng() * 6.28, col: c++ % 3 });   // a weaver
    else if (r < 0.62 && pr > 0.45) pl(t, 70 + rng() * 120, { mode: 2, vx: -(190 + 30 * pr), col: c++ % 3 });   // a diver, aimed at where Fancy is when it appears
    else pl(t, y, { col: c++ % 3 });
    gap = 1.5 - 0.45 * pr + rng() * 0.45; t += gap;
  }
  for (t = 5; t < SKY_BOSS - 3; t += 5.5 + rng() * 2) {   // cloud banks drift in; from a little way in, a plane flies through the middle of some
    y = 120 + rng() * 380; r = { t: t, k: 'cloud', y: y, w: 130 + rng() * 60, h: 76 + rng() * 30, seed: rng() * 100 };
    p.push(r); if (t > 10 && rng() < 0.65) { pr = clamp((t - 2.6) / (SKY_BOSS - 4), 0, 1); pl(t + 1.7, y + (rng() - 0.5) * 34, { vx: -(185 + 25 * pr), col: c++ % 3 }); }
  }
  p.sort(function (a, b) { return a.t - b.t; }); return p;
}
function startSky() {
  flipV = 0; state = 'sky'; setBar(false); cardT = -1; pendNext = ''; nextT = 0; rsgT = -1; celT = 0; fx.length = 0; MG = null; pracN = 0;
  var h = CFG.mgHearts + lvl('heart') + (empOwn(E.gheart) ? 1 : 0), i, bg = [];
  for (i = 0; i < 9; i++) bg.push({ x: frng() * 460, y: 60 + frng() * 480, r: 14 + frng() * 22, s: 0.2 + frng() * 0.25 });
  SKY = { ph: 'ready', t: 0, pt: 0, y: 300, vy: 0, fa: 0, rot: 0, hearts: h, maxH: h, inv: 0, ents: [], plan: skyPlan(), pi: 0, lm: lvl('limes') * 2, lt: 0, limes: [], boss: null, bossDone: false, paused: false, spd: relaxK() * plusK(), sc: 0, say: '', sayT: 0, bg: bg, won: 0, hits: 0, shot: 0 };
}
function skyExit() { exitAt = performance.now(); SKY = null; pracN = 0; resetWorld(); state = 'title'; titleT = 5; closePanels(); setBar(true); }
function skyPause(on) { var m = SKY; if (m && (m.ph === 'play' || m.ph === 'ready')) { m.paused = on === undefined ? !m.paused : on; if (m.paused) { persist(); } } }
function skySay(m, t) { m.say = t; m.sayT = 1.6; }
function skyAdd(m, q) {
  var e = { k: q.k, x: q.x === undefined ? W + 50 : q.x, y: q.y, vx: q.vx || 0, vy: q.vy || 0, w: q.w || 56, h: q.h || 22, mode: q.mode || 0, amp: q.amp || 0, ph: q.ph || 0, y0: q.y, col: q.col || 0, seed: q.seed || 0, dead: false, t: 0 };
  if (e.mode === 1) e.y = e.y0 + e.amp * Math.sin(e.ph);
  if (e.mode === 2) { var tt = Math.max(0.5, (e.x - SKY_X) / -e.vx); e.vy = clamp((m.y - e.y) / tt, -250, 250); }
  m.ents.push(e); return e;
}
function skyHurt(m) {   // (the lime missiles in flight are dropped when the flight ends)
  if (m.inv > 0 || m.ph !== 'play') return;
  m.hearts--; m.hits++; m.inv = 1.5; m.vy = -220; burst(SKY_X, m.y, 16, ['#ffffff', '#ffd93b', '#ff6b81'], 220, 240);
  if (m.hearts <= 0) { m.ph = 'lose'; m.pt = 0; m.vy = -260; m.limes.length = 0; }
}
function skyUpdate(dt) {
  var m = SKY, i, e, b, tt, a, v;
  if (!m || m.paused) return;
  m.pt += dt; if (m.fa > 0) m.fa -= dt; if (m.sayT > 0) m.sayT -= dt;
  if (m.ph === 'ready') { m.y = 300 + Math.sin(time * 3) * 8; m.rot = Math.sin(time * 3) * 0.05; return; }
  if (m.ph === 'win') {   // the volcano is here: coast, with fireworks
    m.sc += SKY_V * m.spd * dt * 0.4; m.y += (250 - m.y) * Math.min(1, dt * 2); m.rot = -0.12;
    if (frng() < 0.3) burst(40 + frng() * 280, 120 + frng() * 200, 6, ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'], 160, 220);
    return;
  }
  if (m.ph === 'lose') { m.vy = Math.min(CFG.maxFall, m.vy + CFG.gravity * dt); m.y = Math.min(760, m.y + m.vy * dt); m.rot += dt * 9; if (m.ents.length) m.ents.length = 0; return; }
  m.t += dt; m.sc += SKY_V * m.spd * dt; if (m.inv > 0) m.inv -= dt; if (m.lt > 0) m.lt -= dt;
  m.vy = Math.min(CFG.maxFall, m.vy + CFG.gravity * (1 - 0.06 * lvl('gentle')) * dt); m.y += m.vy * dt;
  if (m.y < 36) { m.y = 36; if (m.vy < 0) m.vy = 0; } if (m.y > 590) { m.y = 590; m.vy = 0; }   // the roof and the sea of clouds below are soft: no harm
  m.rot = clamp(m.vy / 900, -0.35, 0.5);
  while (m.pi < m.plan.length && m.plan[m.pi].t <= m.t) { v = m.plan[m.pi++]; if (v.k === 'cloud') skyAdd(m, { k: 'cloud', y: v.y, vx: -80 * m.spd, w: v.w, h: v.h, seed: v.seed, x: W + v.w / 2 + 10 }); else skyAdd(m, { k: 'plane', y: v.y, vx: v.vx * m.spd, mode: v.mode, amp: v.amp, ph: v.ph, col: v.col }); }
  if (!m.boss && !m.bossDone && m.t >= SKY_BOSS) { m.boss = { t: 0, x: W + 140, y: 270, fire: 1.4, n: 0 }; skySay(m, 'BOMBER!'); }
  if (m.boss) {
    b = m.boss; b.t += dt; b.x += ((b.t < 11.2 ? 284 : W + 150) - b.x) * Math.min(1, dt * 2.2); b.y = 280 + 150 * Math.sin(b.t * 0.95); b.fire -= dt;
    if (b.t > 1 && b.t < 11 && b.fire <= 0 && m.ph === 'play') {
      b.fire = 1.45 - 0.25 * Math.min(1, b.t / 10); a = Math.atan2(m.y - (b.y + 10), SKY_X - (b.x - 70)); b.n++;
      for (i = b.n % 4 === 0 ? -1 : 0; i <= (b.n % 4 === 0 ? 1 : 0); i++) skyAdd(m, { k: 'coco', x: b.x - 70, y: b.y + 10, vx: Math.cos(a + i * 0.3) * 195 * m.spd, vy: Math.sin(a + i * 0.3) * 195 * m.spd, w: 18, h: 18 });
    }
    if (b.t > 13.5) { m.boss = null; m.bossDone = true; }
  }
  for (i = m.ents.length - 1; i >= 0; i--) {
    e = m.ents[i]; e.t += dt; if (e.mode === 1) e.vy = e.amp * 2.6 * Math.cos(e.ph + e.t * 2.6);
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.dead || e.x < -150 || e.x > W + 260 || e.y < -80 || e.y > H + 80) { m.ents.splice(i, 1); continue; }
    if (e.k === 'plane' && circleRect(SKY_X, m.y, 11, e.x - e.w / 2 + 3, e.y - e.h / 2 + 3, e.w - 6, e.h - 6)) { skyHurt(m); if (m.inv > 1.4) { e.dead = true; burst(e.x, e.y, 18, ['#ff9a3c', '#ffd93b', '#5a5a66'], 200, 220); } }
    else if (e.k === 'coco' && (e.x - SKY_X) * (e.x - SKY_X) + (e.y - m.y) * (e.y - m.y) < 19 * 19) { skyHurt(m); if (m.inv > 1.4) { e.dead = true; burst(e.x, e.y, 14, ['#8a5a33', '#ffd93b', '#ffffff'], 200, 220); } }
  }
  if (m.lm > 0 && m.lt <= 0 && m.ph === 'play') {   // Lime defense: something that would hit Fancy in the next half second gets a rocket lime
    for (i = 0; i < m.ents.length; i++) {
      e = m.ents[i]; if (e.dead || e.tg || e.k === 'cloud' || e.x < SKY_X + 70 || e.x > W - 2) continue;
      tt = (e.x - SKY_X) / Math.max(60, -e.vx); if (tt < 0.1 || tt > 0.6) continue;
      if (Math.abs(e.y + e.vy * tt - m.y) < (e.k === 'coco' ? 24 : 32)) { e.tg = true; m.lm--; m.lt = 0.4; m.limes.push({ x: SKY_X + 14, y: m.y, e: e, a: 0 }); skySay(m, 'LIME!'); break; }
    }
  }
  for (i = m.limes.length - 1; i >= 0; i--) {
    v = m.limes[i]; e = v.e; if (e.dead && v.dead !== 1) { m.limes.splice(i, 1); continue; }
    a = Math.atan2(e.y - v.y, e.x - v.x); v.a = a; v.x += Math.cos(a) * 560 * dt; v.y += Math.sin(a) * 560 * dt;
    if ((e.x - v.x) * (e.x - v.x) + (e.y - v.y) * (e.y - v.y) < 22 * 22) { e.dead = true; m.shot++; burst(e.x, e.y, 24, ['#7ccc2e', '#ffd93b', '#ffffff', '#ff9a3c'], 260, 240); m.limes.splice(i, 1); }
  }
  if (m.t >= SKY_SECS && m.ph === 'play') { m.ph = 'win'; m.pt = 0; m.limes.length = 0; m.won = 25; save.stats.friends += 25; persist(); burst(W / 2, m.y, 40, ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'], 300, 380); secretFound('sky', 'Secret found: the Chimp Airforce! A medal is on the wall in Fancy\'s Place.'); }
}
function skyTap() {
  var m = SKY; if (!m) return;
  if (m.paused) { m.paused = false; return; }
  if ((m.ph === 'win' || m.ph === 'lose') && m.pt > 0.6) { startSky(); return; }
  if (m.ph === 'ready' && m.pt > 0.3) { m.ph = 'play'; m.pt = 0; }
  if (m.ph === 'play') { m.vy = CFG.flapV; m.fa = 0.18; if (empWorn(E.confetti)) burst(SKY_X - 10, m.y + 8, 7, ['#ff6b81', '#ffd93b', '#7ad8ff', '#8ae28a', '#c9a0ff'], 150, 220); }
}
function skyPointer(pl) {
  var m = SKY; if (!m || panelOpen()) return;
  if (m.paused) { if (mgIn(pl, MG_BT)) { skyExit(); return; } m.paused = false; return; }
  if ((m.ph === 'win' || m.ph === 'lose') && m.pt > 0.6) { if (mgIn(pl, SKY_BT)) { skyExit(); return; } if (mgIn(pl, SKY_BA)) { startSky(); return; } return; }
  if (Math.abs(pl[0] - MG_PB[0]) < PBH() && Math.abs(pl[1] - MG_PB[1]) < PBH() && (m.ph === 'play' || m.ph === 'ready')) { skyPause(true); return; }
  skyTap();
}
function skyPlane(x, y, col, ghost) {   // a little red, blue or yellow biplane flying left, a chimp in the cockpit and a spinning propeller
  var c = ['#d8453b', '#3f8fd8', '#e8b22a'][col % 3];
  ctx.save(); ctx.translate(x, y); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  ctx.fillStyle = mixc(c, '#2b1a2e', 0.25); ctx.beginPath(); ctx.moveTo(18, -2); ctx.lineTo(32, -14); ctx.lineTo(32, -4); ctx.lineTo(24, 4); ctx.closePath(); ctx.fill(); ctx.stroke();   // tail fin
  ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 1, 30, 9, 0, 0, 6.2832); ctx.fill(); ctx.stroke();   // body
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-4, -2, 16, 3, 0, 0, 6.2832); ctx.fill();
  ART.chimp(ctx, -2, -9, 0.2, 0);   // the pilot
  ctx.fillStyle = mixc(c, '#ffffff', 0.18); rrect(-16, -15, 32, 5, 2); ctx.fill(); ctx.stroke(); rrect(-14, 6, 28, 5, 2); ctx.fill(); ctx.stroke();   // two wings
  ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(-8, 6); ctx.moveTo(8, -10); ctx.lineTo(8, 6); ctx.stroke();
  ctx.fillStyle = 'rgba(40,40,60,.45)'; ctx.beginPath(); ctx.ellipse(-32, 1, 3, 12, 0, 0, 6.2832); ctx.fill();   // the propeller blur
  ctx.fillStyle = '#ffd93b'; ctx.beginPath(); ctx.arc(10, 1, 3.4, 0, 6.2832); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
}
function skyBomber(x, y, t) {   // the big grey chimp bomber with four propellers
  ctx.save(); ctx.translate(x, y); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  ctx.fillStyle = '#6f7d92'; ctx.beginPath(); ctx.moveTo(40, -4); ctx.lineTo(74, -28); ctx.lineTo(74, -6); ctx.lineTo(54, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8f9db3'; ctx.beginPath(); ctx.ellipse(0, 4, 66, 20, 0, 0, 6.2832); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7a889e'; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(30, -8); ctx.lineTo(44, 36); ctx.lineTo(0, 30); ctx.closePath(); ctx.fill(); ctx.stroke();   // wing
  ctx.fillStyle = '#c9e8ff'; ctx.beginPath(); ctx.ellipse(-44, -2, 15, 10, 0, 0, 6.2832); ctx.fill(); ctx.stroke(); ART.chimp(ctx, -44, 4, 0.34, 0);
  ctx.fillStyle = '#ffd93b'; ctx.beginPath(); ctx.arc(14, 2, 6, 0, 6.2832); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(40,40,60,.4)'; for (var i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(-30 + i * 34, 26 + i * 4 + 2, 4, 15 + Math.sin(t * 40 + i) * 1.5, 0, 0, 6.2832); ctx.fill(); }
  ctx.restore();
}
function skyCloud(e, a) {   // a bank of cloud: one soft white shape (planes inside show through a little)
  var s = e.seed, w = e.w, h = e.h, i, cx, cy, r;
  ctx.save(); ctx.translate(e.x, e.y);
  for (var pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass ? 'rgba(255,255,255,' + a + ')' : 'rgba(176,196,226,' + a + ')'; ctx.beginPath();
    for (i = 0; i < 6; i++) { cx = (i / 5 - 0.5) * (w - h * 0.6) + Math.sin(s + i * 2.1) * 6; cy = Math.sin(s * 1.7 + i * 1.3) * h * 0.14 + (pass ? 0 : 7); r = h * (0.34 + 0.12 * Math.abs(Math.sin(s + i * 1.9))); ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, 6.2832); }
    ctx.fill();
  }
  ctx.restore();
}
function skyHeart(x, y, on) { ctx.save(); ctx.translate(x, y); ctx.lineWidth = 2.4; ctx.strokeStyle = '#ffffff'; ctx.fillStyle = on ? '#ff4a5a' : 'rgba(60,50,80,.55)'; ctx.beginPath(); ctx.moveTo(0, 9); ctx.bezierCurveTo(-16, -2, -9, -14, 0, -6); ctx.bezierCurveTo(9, -14, 16, -2, 0, 9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
function skyVolcano(x) {   // the island's volcano: a dark cone with a glowing crater and a plume
  var g = ctx.createLinearGradient(0, 300, 0, 640);
  ctx.save(); ctx.translate(x, 0); g.addColorStop(0, '#6a4a52'); g.addColorStop(1, '#3a2a36');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-230, 640); ctx.lineTo(-48, 318); ctx.quadraticCurveTo(0, 304, 48, 318); ctx.lineTo(230, 640); ctx.closePath(); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.ellipse(0, 318, 46, 11, 0, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#ffd93b'; ctx.beginPath(); ctx.ellipse(0, 319, 30, 6, 0, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-30, 330); ctx.quadraticCurveTo(-60, 440, -90, 640); ctx.moveTo(26, 330); ctx.quadraticCurveTo(50, 450, 70, 640); ctx.stroke();   // lava runs
  ctx.fillStyle = 'rgba(90,80,96,.75)'; for (var i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(Math.sin(time * 0.8 + i) * 12 + i * 4, 290 - i * 34, 20 + i * 7, 0, 6.2832); ctx.fill(); }
  ctx.restore();
}
function renderSky() {
  var m = SKY, i, e, a = m.ph === 'play' && !m.paused ? acc : 0, vx = SKY_V * m.spd, lh = opt('lefty'), hx = function (x) { return lh ? W - x : x; }, g, b, yy;
  if (a) { m.y += m.vy * a; m.sc += vx * a; m.t += a; for (i = 0; i < m.ents.length; i++) { e = m.ents[i]; e.x += e.vx * a; e.y += e.vy * a; } }
  g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#4fa8e8'); g.addColorStop(0.6, '#9fd6f5'); g.addColorStop(1, '#e6f4ff'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(280, 110, 44, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#fff6c2'; ctx.beginPath(); ctx.arc(280, 110, 26, 0, 6.2832); ctx.fill();
  for (i = 0; i < m.bg.length; i++) { b = m.bg[i]; yy = b.y; var bx = ((b.x - m.sc * b.s) % 460 + 460) % 460 - 50; ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + b.s * 0.6) + ')'; ctx.beginPath(); ctx.arc(bx, yy, b.r, 0, 6.2832); ctx.arc(bx + b.r * 0.9, yy + 4, b.r * 0.75, 0, 6.2832); ctx.arc(bx - b.r * 0.8, yy + 5, b.r * 0.7, 0, 6.2832); ctx.fill(); }
  if (m.t > SKY_SECS - 14) skyVolcano(SKY_X + (SKY_SECS - m.t) * 40 + (m.ph === 'win' ? -Math.min(1, m.pt) * 0 : 0));
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; for (i = 0; i < 6; i++) { var sx = ((i * 83 - m.sc * 2.6) % 440 + 440) % 440 - 40, sy = 70 + ((i * 197) % 480); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 26, sy); ctx.stroke(); }   // wind streaks
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); for (i = 0; i < 12; i++) { var sx2 = i * 34 - ((m.sc * 1.2) % 34); ctx.moveTo(sx2 + 26, 618); ctx.arc(sx2, 618 + Math.sin(i * 2.3) * 4, 26, 0, 6.2832); } ctx.fill(); ctx.fillRect(0, 622, W, 20);   // the sea of clouds far below
  for (i = 0; i < m.ents.length; i++) { e = m.ents[i]; if (e.k === 'plane') skyPlane(e.x, e.y, e.col); else if (e.k === 'coco') { ctx.fillStyle = '#7a4a26'; ctx.beginPath(); ctx.arc(e.x, e.y, 9, 0, 6.2832); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(e.x - 3, e.y - 3, 3, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#ffd93b'; ctx.beginPath(); ctx.arc(e.x + 8 - Math.sin(time * 30) * 1.5, e.y - 8, 2.6, 0, 6.2832); ctx.fill(); } }
  if (m.boss) skyBomber(m.boss.x, m.boss.y, time);
  for (i = 0; i < m.ents.length; i++) { e = m.ents[i]; if (e.k === 'cloud') skyCloud(e, 0.8); }
  drawFx();
  if (!(m.inv > 0 && m.ph === 'play' && Math.floor(time * 14) % 2)) { ctx.save(); ctx.translate(SKY_X, m.y); ctx.rotate(m.rot); ctx.scale(1 - 0.07 * (m.fa > 0 ? m.fa / 0.18 : 0), 1 + 0.1 * (m.fa > 0 ? m.fa / 0.18 : 0)); ART.banana(ctx, 0, 0, 0, 1, m.fa > 0 ? m.fa : 0, time, wearFlags(), m.vy, false, 0, -1, m.inv > 1.1 || m.ph === 'lose' ? 2 : 0); ctx.restore(); }
  for (i = 0; i < m.limes.length; i++) { e = m.limes[i]; ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.a); ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-20 - Math.sin(time * 50) * 3, -3); ctx.lineTo(-20, 3); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#7ccc2e'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 5.5, 0, 0, 6.2832); ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); }
  for (i = 0; i < m.maxH; i++) skyHeart(hx(26 + i * 28), 30, i < m.hearts);
  if (m.lm > 0) { var lx = hx(26 + m.maxH * 28 + 6); ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#7ccc2e'; ctx.beginPath(); ctx.arc(lx, 30, 10, 0, 7); ctx.fill(); ctx.stroke(); outlined(String(m.lm), lx, 30, 13, '#ffffff'); }
  var pg = clamp(m.t / SKY_SECS, 0, 1); ctx.fillStyle = 'rgba(30,20,50,.5)'; rrect(60, 56, 240, 9, 4.5); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke(); if (pg > 0.01) { ctx.fillStyle = '#ffd93b'; rrect(60, 56, 240 * pg, 9, 4.5); ctx.fill(); } ART.coin(ctx, 60 + 240 * pg, 60.5, time);
  if (m.ph === 'ready' || m.ph === 'play') drawPauseBtn(MG_PB, 0.55);
  if (m.sayT > 0 && m.ph === 'play') outlined(m.say, W / 2, 150, 34, '#ffd93b');
  if (m.ph === 'ready') { outlined('Chimp Airforce!', W / 2, 170, 38, '#ffd93b'); outlined('Tap to flap. Dodge the biplanes!', W / 2, 212, 17, '#ffffff'); outlined('Clouds hide planes. Watch the bomber!', W / 2, 238, 17, '#ffffff'); outlined('Fly to the volcano!', W / 2, 264, 17, '#ffd93b'); outlined('Tap to start', W / 2, 400, 22 + Math.sin(time * 5) * 1.5, '#ffffff'); }
  else if (m.ph === 'win') {
    cardFrame(40, 150, 280, 296, '#58c46f', 'The volcano!', 30); outlinedC('+' + m.won, W / 2, 232, 34, '#ffd93b'); outlined('bananas', W / 2, 266, 18, '#ffffff'); outlined('Cloud medal won!', W / 2, 296, 16, '#ffd93b');
    ctx.globalAlpha = m.pt > 0.6 ? 1 : 0.35; mgBtn(SKY_BA, 'Fly again', '#58c46f'); mgBtn(SKY_BT, 'Back to title', '#8a6cd8'); ctx.globalAlpha = 1;
  } else if (m.ph === 'lose') {
    ctx.fillStyle = 'rgba(58,42,77,.3)'; ctx.fillRect(0, 0, W, H); cardFrame(40, 150, 280, 296, '#4a9bd8', 'Shot down!', 32); ART.chimp(ctx, 256, 232, 0.5, 0, time); outlined('The Chimp', 120, 224, 18, '#ffffff'); outlined('Airforce got you.', 140, 250, 18, '#ffffff'); outlined(Math.floor(clamp(m.t / SKY_SECS, 0, 1) * 100) + '% of the way to the volcano', W / 2, 296, 14, '#ffd93b');
    ctx.globalAlpha = m.pt > 0.6 ? 1 : 0.35; mgBtn(SKY_BA, 'Fly again', '#58c46f'); mgBtn(SKY_BT, 'Back to title', '#8a6cd8'); ctx.globalAlpha = 1;
  }
  if (m.paused) { ctx.fillStyle = 'rgba(58,42,77,.45)'; ctx.fillRect(0, 0, W, H); outlined('Paused', W / 2, 226, 44, '#ffd93b'); outlined('Tap to continue', W / 2, 286, 24, '#ffffff'); mgBtn(PS_BT, 'Settings', '#4a9bd8'); mgBtn(MG_BT, 'Back to title', '#8a6cd8'); padLine(); drawExtrasCard(); }
  if (a) { m.y -= m.vy * a; m.sc -= vx * a; m.t -= a; for (i = 0; i < m.ents.length; i++) { e = m.ents[i]; e.x -= e.vx * a; e.y -= e.vy * a; } }
}
/* ===== Volcano Run (the Volcano key): a secret side-scrolling level inside the volcano, flown like the main game (same flap, gravity and hearts). Lava streams fall in columns with gaps that slide down; rock doors slide shut and open on a beat; narrow slots cut through rock walls; the lava lake below burns. About 70 seconds. Win: +40 bananas and the Volcano medal in Fancy's Place. ===== */
var VOLC = null, VOLC_X = 96, VOLC_V = 175, VOLC_N = 44, VOLC_FLOOR = 598;
function volcOn() { return empOwn(E.keyVolc); }
function volcPlan() {
  var p = [], x = 560, i, pr, r, k;
  for (i = 0; i < VOLC_N; i++) {
    pr = i / (VOLC_N - 1); r = rng();
    k = pr < 0.2 ? (r < 0.6 ? 'slot' : 'stream') : r < 0.38 ? 'stream' : r < 0.7 ? 'door' : 'slot';
    if (k === 'slot') p.push({ k: 'slot', x: x, cy: 150 + rng() * 300, g: 176 - 24 * pr + 5 * lvl('roomy') });
    else if (k === 'door') p.push({ k: 'door', x: x, cy: 170 + rng() * 260, T: 3.0 - 0.5 * pr, ph: rng() * 6.28 });
    else { var gl = 196 - 30 * pr + 5 * lvl('roomy'), P = 300 + rng() * 60, sp = 72 + rng() * 30 + 16 * pr; p.push({ k: 'stream', x: x, P: P, gl: gl, sp: sp, ph: rng() * P }); if (pr > 0.6 && rng() < 0.3) { x += 160; p.push({ k: 'stream', x: x, P: P + 20, gl: gl, sp: sp * 0.8, ph: rng() * P }); } }
    x += 285 - 55 * pr + rng() * 40;
  }
  return { obs: p, end: x + 120 };
}
function startVolc() {
  flipV = 0; state = 'volc'; setBar(false); cardT = -1; pendNext = ''; nextT = 0; rsgT = -1; celT = 0; fx.length = 0; MG = null; SKY = null; pracN = 0;
  var h = CFG.mgHearts + lvl('heart') + (empOwn(E.gheart) ? 1 : 0), pl = volcPlan(), i, bg = [];
  for (i = 0; i < 12; i++) bg.push({ x: i * 62 + frng() * 30, w: 22 + frng() * 26, h: 60 + frng() * 150, up: i % 2 === 0, s: 0.25 + frng() * 0.2 });
  VOLC = { ph: 'ready', t: 0, pt: 0, y: 300, vy: 0, fa: 0, rot: 0, hearts: h, maxH: h, inv: 0, obs: pl.obs, end: pl.end, paused: false, spd: relaxK() * plusK(), sc: 0, bg: bg, won: 0, hits: 0, say: '', sayT: 0 };
}
function volcExit() { exitAt = performance.now(); VOLC = null; pracN = 0; resetWorld(); state = 'title'; titleT = 5; closePanels(); setBar(true); }
function volcPause(on) { var m = VOLC; if (m && (m.ph === 'play' || m.ph === 'ready')) { m.paused = on === undefined ? !m.paused : on; if (m.paused) persist(); } }
function volcHurt(m, lava) {
  if (m.inv > 0 || m.ph !== 'play') return;
  m.hearts--; m.hits++; m.inv = 1.5; m.vy = lava ? -430 : -200; burst(VOLC_X, m.y, 16, ['#ff9a3c', '#ffd93b', '#ff4a2a'], 220, 240);
  if (m.hearts <= 0) { m.ph = 'lose'; m.pt = 0; m.vy = -260; }
}
function volcStream(o, t, y0, y1) {   // is the part of the column between y0 and y1 clear of lava? (the pattern slides down: gaps travel with it)
  var a = (((y0 - t * o.sp - o.ph) % o.P) + o.P) % o.P, b = (((y1 - t * o.sp - o.ph) % o.P) + o.P) % o.P;
  return a >= o.P - o.gl && b >= a;
}
function volcGapH(o, t) { return 10 + (200 + 5 * lvl('roomy')) * (0.5 + 0.5 * Math.sin(6.2832 * t / o.T + o.ph)); }
function volcUpdate(dt) {
  var m = VOLC, i, o, sx, hw, ok;
  if (!m || m.paused) return;
  m.pt += dt; if (m.fa > 0) m.fa -= dt; if (m.sayT > 0) m.sayT -= dt;
  if (m.ph === 'ready') { m.y = 300 + Math.sin(time * 3) * 8; m.rot = Math.sin(time * 3) * 0.05; return; }
  if (m.ph === 'win') { m.sc += VOLC_V * m.spd * dt * 0.5; m.y += (230 - m.y) * Math.min(1, dt * 2); m.rot = -0.12; if (frng() < 0.3) burst(40 + frng() * 280, 120 + frng() * 200, 6, ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'], 160, 220); return; }
  if (m.ph === 'lose') { m.vy = Math.min(CFG.maxFall, m.vy + CFG.gravity * dt); m.y = Math.min(760, m.y + m.vy * dt); m.rot += dt * 9; return; }
  m.t += dt; m.sc += VOLC_V * m.spd * dt; if (m.inv > 0) m.inv -= dt;
  m.vy = Math.min(CFG.maxFall, m.vy + CFG.gravity * (1 - 0.06 * lvl('gentle')) * dt); m.y += m.vy * dt; m.rot = clamp(m.vy / 900, -0.35, 0.5);
  if (m.y < 30) { m.y = 30; if (m.vy < 0) m.vy = 0; }
  if (m.y + 12 > VOLC_FLOOR) { m.y = VOLC_FLOOR - 12; volcHurt(m, true); if (m.ph === 'play') m.vy = -430; }   // the lava lake: it burns, and throws Fancy back up
  for (i = 0; i < m.obs.length; i++) {
    o = m.obs[i]; sx = o.x - m.sc; if (sx < -120) continue; if (sx > VOLC_X + 80) break;
    hw = o.k === 'stream' ? 19 : 28; if (Math.abs(sx - VOLC_X) > hw + 10) continue;
    if (o.k === 'stream') ok = volcStream(o, m.t, m.y - 11, m.y + 11);
    else if (o.k === 'door') ok = Math.abs(m.y - o.cy) + 11 <= volcGapH(o, m.t) / 2;
    else ok = Math.abs(m.y - o.cy) + 11 <= o.g / 2;
    if (!ok) volcHurt(m, false);
  }
  if (m.sc >= m.end - 150 && m.ph === 'play') { m.ph = 'win'; m.pt = 0; m.won = 40; save.stats.friends += 40; persist(); burst(W / 2, m.y, 40, ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'], 300, 380); secretFound('volc', 'Secret found: the Volcano Run! A medal is on the wall in Fancy\'s Place.'); }
}
function volcTap() {
  var m = VOLC; if (!m) return;
  if (m.paused) { m.paused = false; return; }
  if ((m.ph === 'win' || m.ph === 'lose') && m.pt > 0.6) { startVolc(); return; }
  if (m.ph === 'ready' && m.pt > 0.3) { m.ph = 'play'; m.pt = 0; }
  if (m.ph === 'play') { m.vy = CFG.flapV; m.fa = 0.18; if (empWorn(E.confetti)) burst(VOLC_X - 10, m.y + 8, 7, ['#ff6b81', '#ffd93b', '#7ad8ff', '#8ae28a', '#c9a0ff'], 150, 220); }
}
function volcPointer(pl) {
  var m = VOLC; if (!m || panelOpen()) return;
  if (m.paused) { if (mgIn(pl, MG_BT)) { volcExit(); return; } m.paused = false; return; }
  if ((m.ph === 'win' || m.ph === 'lose') && m.pt > 0.6) { if (mgIn(pl, SKY_BT)) { volcExit(); return; } if (mgIn(pl, SKY_BA)) { startVolc(); return; } return; }
  if (Math.abs(pl[0] - MG_PB[0]) < PBH() && Math.abs(pl[1] - MG_PB[1]) < PBH() && (m.ph === 'play' || m.ph === 'ready')) { volcPause(true); return; }
  volcTap();
}
function volcSlab(x, y0, y1, w, glow) {   // a slab of rock from y0 to y1, with a hot edge where it faces the gap
  if (y1 <= y0) return; var g;
  ctx.fillStyle = '#4d3944'; ctx.fillRect(x - w / 2, y0, w, y1 - y0); ctx.fillStyle = '#6a4f5a'; ctx.fillRect(x - w / 2, y0, 8, y1 - y0); ctx.fillStyle = '#3a2833'; ctx.fillRect(x + w / 2 - 9, y0, 9, y1 - y0);
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeRect(x - w / 2, y0, w, y1 - y0);
  if (glow) { ctx.fillStyle = '#ff7a2a'; ctx.fillRect(x - w / 2 + 3, glow < 0 ? y0 + 2 : y1 - 7, w - 6, 5); ctx.fillStyle = '#ffd93b'; ctx.fillRect(x - w / 2 + 8, glow < 0 ? y0 + 3 : y1 - 5, w - 16, 2); }
  ctx.fillStyle = 'rgba(0,0,0,.18)'; for (var yy = y0 + 22; yy < y1 - 10; yy += 34) ctx.fillRect(x - w / 2 + 12, yy, w - 24, 3);
}
function volcDrawOb(o, sx, t) {
  var yy, len, k;
  if (o.k === 'slot') { volcSlab(sx, -4, o.cy - o.g / 2, 56, 1); volcSlab(sx, o.cy + o.g / 2, VOLC_FLOOR + 6, 56, -1); }
  else if (o.k === 'door') { var h = volcGapH(o, t); volcSlab(sx, -4, o.cy - h / 2, 50, 1); volcSlab(sx, o.cy + h / 2, VOLC_FLOOR + 6, 50, -1); }
  else {
    var off = (t * o.sp + o.ph) % o.P, seg = o.P - o.gl;
    ctx.fillStyle = 'rgba(255,110,40,.18)'; ctx.fillRect(sx - 34, 0, 68, VOLC_FLOOR);
    for (k = -1; k * o.P + off < VOLC_FLOOR; k++) { yy = off + k * o.P - o.gl + o.gl; yy = off + k * o.P; len = o.P - o.gl; if (yy + len < 0 || yy > VOLC_FLOOR) continue;
      ctx.fillStyle = '#ff5a1f'; rrect(sx - 20, yy, 40, len, 18); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = '#ffa63a'; rrect(sx - 12, yy + 4, 24, Math.max(8, len - 8), 12); ctx.fill(); ctx.fillStyle = '#ffe58a'; rrect(sx - 4, yy + 8, 7, Math.max(6, len - 16), 4); ctx.fill(); }
    ctx.fillStyle = '#4d3944'; ctx.fillRect(sx - 30, -4, 60, 26); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeRect(sx - 30, -4, 60, 26);
  }
}
function renderVolc() {
  var m = VOLC, i, o, sx, a = m.ph === 'play' && !m.paused ? acc : 0, vx = VOLC_V * m.spd, lh = opt('lefty'), hx = function (x) { return lh ? W - x : x; }, g, b, tt;
  if (a) { m.y += m.vy * a; m.sc += vx * a; m.t += a; }
  g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1c0c1a'); g.addColorStop(0.7, '#4a1a22'); g.addColorStop(1, '#8a2a16'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(40,16,34,.9)'; for (i = 0; i < m.bg.length; i++) { b = m.bg[i]; sx = ((b.x - m.sc * b.s) % 744 + 744) % 744 - 60; ctx.beginPath(); if (b.up) { ctx.moveTo(sx - b.w, 0); ctx.lineTo(sx + b.w, 0); ctx.lineTo(sx, b.h); } else { ctx.moveTo(sx - b.w * 1.4, VOLC_FLOOR); ctx.lineTo(sx + b.w * 1.4, VOLC_FLOOR); ctx.lineTo(sx, VOLC_FLOOR - b.h * 0.7); } ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,120,40,.22)'; ctx.lineWidth = 2; for (i = 0; i < 5; i++) { sx = ((i * 97 - m.sc * 0.5) % 500 + 500) % 500 - 60; ctx.beginPath(); ctx.moveTo(sx, 90 + i * 70); ctx.lineTo(sx + 30, 120 + i * 70); ctx.lineTo(sx + 18, 160 + i * 70); ctx.stroke(); }   // glowing cracks in the far wall
  if (m.end - m.sc < W + 300) { var ex = m.end - m.sc; g = ctx.createRadialGradient(ex, 300, 10, ex, 300, 260); g.addColorStop(0, 'rgba(255,248,200,1)'); g.addColorStop(0.35, 'rgba(255,200,110,.8)'); g.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = g; ctx.fillRect(ex - 260, 0, 520, VOLC_FLOOR + 40); }   // the way out, at the end
  for (i = 0; i < m.obs.length; i++) { o = m.obs[i]; sx = o.x - m.sc; if (sx < -70 || sx > W + 70) continue; volcDrawOb(o, sx, m.t); }
  ctx.fillStyle = '#ff6a1f'; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, VOLC_FLOOR); for (i = 0; i <= W; i += 12) ctx.lineTo(i, VOLC_FLOOR + 3 + Math.sin(i * 0.05 + time * 2.4) * 3 + Math.sin(i * 0.13 - time * 1.7) * 1.5); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffb13a'; ctx.fillRect(0, VOLC_FLOOR + 14, W, H - VOLC_FLOOR - 14); ctx.fillStyle = 'rgba(255,240,150,.6)'; for (i = 0; i < 6; i++) { sx = ((i * 71 - m.sc * 1.5) % 400 + 400) % 400 - 20; ctx.fillRect(sx, VOLC_FLOOR + 18 + (i % 3) * 7, 26, 3); }
  ctx.fillStyle = '#ffd36a'; for (i = 0; i < 16; i++) { tt = (time * 0.35 + i * 0.37) % 1; ctx.globalAlpha = 1 - tt; ctx.beginPath(); ctx.arc(((i * 53 - m.sc * 0.9) % 400 + 400) % 400 - 20, VOLC_FLOOR - tt * 520, 1.8 + (i % 3) * 0.7, 0, 6.2832); ctx.fill(); } ctx.globalAlpha = 1;   // embers drift up
  drawFx();
  if (!(m.inv > 0 && m.ph === 'play' && Math.floor(time * 14) % 2)) { ctx.save(); ctx.translate(VOLC_X, m.y); ctx.rotate(m.rot); ctx.scale(1 - 0.07 * (m.fa > 0 ? m.fa / 0.18 : 0), 1 + 0.1 * (m.fa > 0 ? m.fa / 0.18 : 0)); ART.banana(ctx, 0, 0, 0, 1, m.fa > 0 ? m.fa : 0, time, wearFlags(), m.vy, false, 0, -1, m.inv > 1.1 || m.ph === 'lose' ? 2 : 0); ctx.restore(); }
  for (i = 0; i < m.maxH; i++) skyHeart(hx(26 + i * 28), 30, i < m.hearts);
  var pg = clamp(m.sc / (m.end - 150), 0, 1); ctx.fillStyle = 'rgba(30,20,50,.5)'; rrect(60, 56, 240, 9, 4.5); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke(); if (pg > 0.01) { ctx.fillStyle = '#ffd93b'; rrect(60, 56, 240 * pg, 9, 4.5); ctx.fill(); } ART.coin(ctx, 60 + 240 * pg, 60.5, time);
  if (m.ph === 'ready' || m.ph === 'play') drawPauseBtn(MG_PB, 0.55);
  if (m.ph === 'ready') { outlined('Volcano Run!', W / 2, 150, 40, '#ffd93b'); outlined('Tap to flap through the volcano.', W / 2, 192, 17, '#ffffff'); outlined('Fly through the gaps in the lava streams.', W / 2, 218, 17, '#ffffff'); outlined('Rock doors open and close: time them!', W / 2, 244, 17, '#ffffff'); outlined('The lava lake below burns!', W / 2, 270, 17, '#ffd93b'); outlined('Tap to start', W / 2, 420, 22 + Math.sin(time * 5) * 1.5, '#ffffff'); }
  else if (m.ph === 'win') {
    cardFrame(40, 150, 280, 296, '#58c46f', 'Out of the volcano!', 25); outlinedC('+' + m.won, W / 2, 232, 34, '#ffd93b'); outlined('bananas', W / 2, 266, 18, '#ffffff'); outlined('Volcano medal won!', W / 2, 296, 16, '#ffd93b');
    ctx.globalAlpha = m.pt > 0.6 ? 1 : 0.35; mgBtn(SKY_BA, 'Fly again', '#58c46f'); mgBtn(SKY_BT, 'Back to title', '#8a6cd8'); ctx.globalAlpha = 1;
  } else if (m.ph === 'lose') {
    ctx.fillStyle = 'rgba(58,42,77,.3)'; ctx.fillRect(0, 0, W, H); cardFrame(40, 150, 280, 296, '#d8603a', 'Too hot!', 32); outlined('The volcano got you.', W / 2, 226, 18, '#ffffff'); outlined(Math.floor(clamp(m.sc / (m.end - 150), 0, 1) * 100) + '% of the way out', W / 2, 262, 16, '#ffd93b');
    ctx.globalAlpha = m.pt > 0.6 ? 1 : 0.35; mgBtn(SKY_BA, 'Fly again', '#58c46f'); mgBtn(SKY_BT, 'Back to title', '#8a6cd8'); ctx.globalAlpha = 1;
  }
  if (m.paused) { ctx.fillStyle = 'rgba(58,42,77,.45)'; ctx.fillRect(0, 0, W, H); outlined('Paused', W / 2, 226, 44, '#ffd93b'); outlined('Tap to continue', W / 2, 286, 24, '#ffffff'); mgBtn(PS_BT, 'Settings', '#4a9bd8'); mgBtn(MG_BT, 'Back to title', '#8a6cd8'); padLine(); drawExtrasCard(); }
  if (a) { m.y -= m.vy * a; m.sc -= vx * a; m.t -= a; }
}
var HOME = null, HOME_DOOR = [300, 486, 44, 78], HOME_BOOKS = [['Lunch Trip', '#d8453b'], ['The Keeper\'s Light', '#2a8f9c'], ['Bolivar\'s Treasure', '#c9971f'], ['Yesterday\'s Soup', '#e0782a']];
var HOME_JOKES = ['APPLE PRESS: Out of order. Please try the other game.', 'The screen says: "Press an apple. Get a banana." Nobody knows what that means.', 'Fancy tried a coin. The machine tried a vanilla wafer. Nobody won.', 'High score: ??? (the machine has been unplugged since before the jungle).'];
function homeHit(pl) {
  if (!empOn() || panelOpen() || titleFancyIn() < 1 || !mgIn(pl, HOME_DOOR)) return false;
  startHome(); return true;
}
function drawHomeDoor() {   // the little arched door at the bottom right of the title screen
  var cx = 322, by0 = 546, w = 36, h = 54, x = cx - w / 2, y = by0 - h, gl = 0.5 + 0.5 * Math.sin(time * 3);
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.fillStyle = '#b36a35';
  ctx.beginPath(); ctx.moveTo(x, by0); ctx.lineTo(x, y + w / 2); ctx.arc(cx, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, by0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(58,42,77,.55)'; ctx.strokeRect(x + 6, y + 26, 10, 11); ctx.strokeRect(x + 20, y + 26, 10, 11); ctx.strokeRect(x + 6, y + 40, 10, 9); ctx.strokeRect(x + 20, y + 40, 10, 9);
  ctx.fillStyle = '#ff6b81'; ctx.beginPath(); ctx.arc(cx - 3.6, y + 14, 4.2, 0, 6.2832); ctx.arc(cx + 3.6, y + 14, 4.2, 0, 6.2832); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx - 7.6, y + 15.5); ctx.lineTo(cx, y + 24); ctx.lineTo(cx + 7.6, y + 15.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,217,59,' + (0.7 + 0.3 * gl) + ')'; ctx.beginPath(); ctx.arc(x + w - 6, y + 38, 2.8, 0, 6.2832); ctx.fill(); ctx.restore();
  outlined('Home', cx, by0 + 12, 12, '#ffffff');
}
function startHome() {
  closePanels(); state = 'home'; setBar(false); vy = 0; angle = 0; flapAnim = 0; fx.length = 0; ART.warm(0);
  HOME = { bg: null, k: 0, z: [], x: 180, y: 524, tx: 180, ty: 524, face: 1, mv: 0, msg: [], mt: -9, jk: 0, pw: false };
  homeSay('Welcome to Fancy\'s Place! Tap the wall to look closer, or the floor to walk around.');
}
function homeBack() { exitAt = performance.now(); HOME = null; resetWorld(); state = 'title'; titleT = 5; setBar(true); }
function homeSay(t) {
  var a = t.split(' '), l = '', i, o = [];
  ctx.font = '700 12px ' + FONT;
  for (i = 0; i < a.length; i++) { if (l && ctx.measureText(l + ' ' + a[i]).width > 308) { o.push(l); l = a[i]; } else l = l ? l + ' ' + a[i] : a[i]; }
  o.push(l); HOME.msg = o; HOME.mt = time;
}
function homeUpdate(dt) {
  var h = HOME, dx = h.tx - h.x, dy = h.ty - h.y, d = Math.sqrt(dx * dx + dy * dy), s = 170 * dt, po;
  if (d > 2) { if (d < s) s = d; h.x += dx / d * s; h.y += dy / d * s; if (Math.abs(dx) > 3) h.face = dx > 0 ? 1 : -1; h.mv = 1; } else h.mv = 0;
  flapAnim = (h.mv || time % 2.2 < 0.5) && time % 0.5 < 0.18 ? 0.18 - time % 0.5 : 0;
  po = panelOpen(); if (h.pw && !po) h.k = 0;   // a window just closed: the costume may have changed, so the room is drawn again
  h.pw = po;
}
function homeTap(pl) {
  var h = HOME, i, z, n, it, own;
  if (!h || panelOpen()) return;
  for (i = 0; i < h.z.length; i++) if (mgIn(pl, h.z[i])) break;
  if (i >= h.z.length) { if (pl[1] > 462) { h.tx = clamp(pl[0], 26, 334); h.ty = clamp(pl[1], 484, 566); } return; }
  z = h.z[i]; n = z[5]; burst(pl[0], pl[1], 6, ['#ffd93b', '#ffffff'], 110, 120);
  if (z[4] === 'back') { homeBack(); return; }
  if (z[4] === 'mirror') { openPanel(pWear); return; }
  if (z[4] === 'apple') { homeSay(HOME_JOKES[h.jk++ % HOME_JOKES.length]); return; }
  if (z[4] === 'book') { homeSay(HOME_BOOKS[n][0] + ': a story written in the Story Editor.'); return; }
  if (z[4] === 'up') { it = homeUps()[n]; homeSay(it.n + (it.m > 1 ? ' (level ' + it.l + ' of ' + it.m + ')' : '') + ': ' + (it.l ? '' : 'not yet bought. ') + it.d); return; }
  if (z[4] === 'cos') { it = homeCos()[n]; homeSay(it.n + (it.own ? (it.on ? ': wearing it. Tap the mirror to change outfits.' : ': you own it. Tap the mirror to wear it.') : ': ' + it.how)); return; }
  if (z[4] === 'prize') { it = homePrizes()[n]; homeSay(it.n + (it.own ? ': ' + it.yes : ': ' + it.how)); }
}
function homeUps() {
  var o = UPS.map(function (u) { return { n: XSHORT[u.id] || u.name, d: u.desc, l: lvl(u.id), m: u.costs.length }; });
  o.push({ n: 'Mega magnet', d: EMP[E.mega].desc, l: empOwn(E.mega) ? 1 : 0, m: 1 }, { n: 'Golden heart', d: EMP[E.gheart].desc, l: empOwn(E.gheart) ? 1 : 0, m: 1 }, { n: 'Night key', d: EMP[E.keyBal].desc, l: empOwn(E.keyBal) ? 1 : 0, m: 1 }, { n: 'Boomerang key', d: EMP[E.keyBoom].desc, l: empOwn(E.keyBoom) ? 1 : 0, m: 1 }, { n: 'Super Potassium', d: EMP[E.superK].desc, l: empOwn(E.superK) ? 1 : 0, m: 1 }, { n: 'Cloud key', d: EMP[E.keySky].desc, l: empOwn(E.keySky) ? 1 : 0, m: 1 }, { n: 'Volcano key', d: EMP[E.keyVolc].desc, l: empOwn(E.keyVolc) ? 1 : 0, m: 1 });
  return o;
}
function homeCos() {
  return [{ n: 'Red bow', own: !!save.unlocks.bow, on: wearsBow(), how: 'reach stage ' + CFG.bowStage + ' to unlock it.' }, { n: 'Top hat', own: empOwn(E.hat), on: empWorn(E.hat), how: 'buy it in the Emporium.' },
    { n: 'Cool shades', own: empOwn(E.shades), on: empWorn(E.shades), how: 'buy it in the Emporium.' }, { n: 'Banana Crown', own: !!save.unlocks.crown, on: wearsCrown(), how: 'win the Crown Duel.' }];
}
function homePrizes() {
  var o = [], i;
  for (i = 0; i < 4; i++) o.push({ n: FIGHTS[i][0] + ' medal', own: pcBeaten(i + 1), yes: 'beaten in Prince Chimp\'s fight.', how: 'beat Prince Chimp in this fight (after your second win).' });
  o.push({ n: 'Crown pieces', own: pcBeaten(1) || !!save.unlocks.crown, yes: save.unlocks.crown ? 'the whole Banana Crown is yours!' : (pcBeaten(1) + pcBeaten(2) + pcBeaten(3)) + ' of 3 won.', how: 'one piece for each of the first three fights.' });
  o.push({ n: 'Balloons', own: !!save.unlocks.balloons, yes: 'Prince Chimp\'s gift for losing to Fancy.', how: 'beat Prince Chimp once.' });
  o.push({ n: 'Pennant flags', own: !!save.unlocks.flags, yes: 'they came with the balloons.', how: 'beat Prince Chimp once.' });
  o.push({ n: 'Banana Bunch', own: bunchOk(), yes: 'all six lost friends found.', how: 'find all six lost friends.' });
  o.push({ n: 'Boomerang medal', own: !!save.unlocks.boom, yes: 'won from Boomerang Chimp.', how: 'beat Boomerang Chimp at the end of Chimp\'s Navy (needs the Boomerang key and all your hearts).' });
  o.push({ n: 'Cloud medal', own: !!save.unlocks.sky, yes: 'won in the Chimp Airforce.', how: 'reach the volcano in the Chimp Airforce (needs the Cloud key).' });
  o.push({ n: 'Volcano medal', own: !!save.unlocks.volc, yes: 'won in the Volcano Run.', how: 'fly out of the volcano in the Volcano Run (needs the Volcano key).' });
  return o;
}
function homeBuild() {
  var h = HOME, c = h.bg || document.createElement('canvas'), g, i, j, x, y, z = [], it, own, sz, a, n;
  c.width = Math.round(W * k); c.height = Math.round(H * k); h.bg = c; h.k = k; g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); g.lineJoin = 'round'; g.lineCap = 'round'; g.textBaseline = 'middle';
  function T(t, tx, ty, s, fill, al, ink) { g.font = '800 ' + s + 'px ' + FONT; g.textAlign = al || 'center'; if (ink) { g.lineWidth = s / 3.2; g.strokeStyle = INK; g.strokeText(t, tx, ty); } g.fillStyle = fill; g.fillText(t, tx, ty); }
  function RR(rx, ry, rw, rh, r) { g.beginPath(); g.roundRect(rx, ry, rw, rh, r); }
  g.fillStyle = '#f6e1ad'; g.fillRect(0, 0, W, 460); g.fillStyle = 'rgba(214,170,96,.35)'; for (x = 0; x < W; x += 40) g.fillRect(x, 0, 20, 460);
  g.fillStyle = '#d99a58'; g.fillRect(0, 48, W, 5); g.fillStyle = '#b9763a'; g.fillRect(0, 53, W, 8); g.fillStyle = '#7a4a26'; g.fillRect(0, 446, W, 14);
  g.fillStyle = '#c98c52'; g.fillRect(0, 460, W, H - 460); g.strokeStyle = 'rgba(90,52,24,.35)'; g.lineWidth = 2;
  for (y = 490, j = 0; y < H + 30; y += 30, j++) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); for (x = (j % 2) * 45 + 20; x < W; x += 90) { g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x, y); g.stroke(); } }
  g.fillStyle = '#d8485c'; g.beginPath(); g.ellipse(180, 535, 150, 46, 0, 0, 6.2832); g.fill(); g.lineWidth = 3; g.strokeStyle = '#ffd93b'; g.beginPath(); g.ellipse(180, 535, 135, 36, 0, 0, 6.2832); g.stroke();
  T('Fancy\'s Place', 190, 30, 24, '#ffd93b', 'center', 1);
  g.fillStyle = '#ffd93b'; RR(12, 12, 66, 34, 10); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); T('Back', 45, 30, 15, INK); z.push([12, 12, 66, 34, 'back', 0]);
  // the power-up wall
  T('POWER-UPS', 180, 70, 11, '#7a4a26'); a = homeUps();
  for (i = 0; i < a.length; i++) {
    it = a[i]; own = it.l > 0; x = 16 + (i % 4) * 83; y = 78 + Math.floor(i / 4) * 26; RR(x, y, 78, 22, 6);
    if (own) {
      g.fillStyle = '#fffbe8'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#8a5a33'; g.stroke(); sz = 10; g.font = '800 ' + sz + 'px ' + FONT; while (sz > 6.5 && g.measureText(it.n).width > (it.m > 1 ? 50 : 56)) { sz -= 0.5; g.font = '800 ' + sz + 'px ' + FONT; }
      T(it.n, x + 5, y + 11.5, sz, '#4a2f14', 'left');
      for (j = 0; j < it.m; j++) { g.beginPath(); g.arc(x + 78 - 7 - (it.m - 1 - j) * 7, y + 11, 2.6, 0, 6.2832); g.fillStyle = j < it.l ? '#e8a900' : 'rgba(122,74,38,.25)'; g.fill(); }
    } else { g.fillStyle = 'rgba(122,74,38,.10)'; g.fill(); g.setLineDash([4, 3]); g.lineWidth = 1.5; g.strokeStyle = 'rgba(122,74,38,.5)'; g.stroke(); g.setLineDash([]); T('?', x + 39, y + 12, 12, 'rgba(122,74,38,.4)'); }
    z.push([x, y, 78, 22, 'up', i]);
  }
  // the costume rack
  T('COSTUMES', 180, 238, 11, '#7a4a26'); g.strokeStyle = '#7a4a26'; g.lineWidth = 4; g.beginPath(); g.moveTo(20, 252); g.lineTo(340, 252); g.stroke(); a = homeCos();
  for (i = 0; i < 4; i++) {
    x = 58 + i * 81; y = 276; it = a[i]; g.save(); g.globalAlpha = it.own ? 1 : 0.22; g.lineWidth = 1.6; g.strokeStyle = '#7a4a26'; g.beginPath(); g.moveTo(x, 252); g.lineTo(x, y - 10); g.stroke(); g.lineWidth = 2; g.strokeStyle = INK;
    if (i === 0) { g.fillStyle = '#e8453c'; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 16, y - 9); g.lineTo(x - 16, y + 9); g.closePath(); g.moveTo(x, y); g.lineTo(x + 16, y - 9); g.lineTo(x + 16, y + 9); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#b32a24'; g.beginPath(); g.arc(x, y, 4.5, 0, 6.2832); g.fill(); g.stroke(); }
    else if (i === 1) { g.fillStyle = '#2b2b2b'; g.beginPath(); g.ellipse(x, y + 9, 18, 5, 0, 0, 6.2832); g.fill(); g.stroke(); RR(x - 10, y - 12, 20, 21, 2); g.fill(); g.stroke(); g.fillStyle = '#d8453b'; g.fillRect(x - 10, y + 1, 20, 5); }
    else if (i === 2) { g.fillStyle = '#111'; g.beginPath(); g.ellipse(x - 10, y, 9, 6, 0, 0, 6.2832); g.ellipse(x + 10, y, 9, 6, 0, 0, 6.2832); g.fill(); g.stroke(); g.beginPath(); g.moveTo(x - 2, y - 1); g.lineTo(x + 2, y - 1); g.stroke(); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x - 14, y - 3, 4, 2); g.fillRect(x + 6, y - 3, 4, 2); }
    else { g.translate(x, y + 2); ART.crown(g, 1); }
    g.restore(); T(it.own ? it.n + (it.on ? ' (on)' : '') : '?', x, 297, 9, it.own ? '#4a2f14' : 'rgba(122,74,38,.4)'); z.push([x - 34, 256, 68, 46, 'cos', i]);
  }
  // the prize shelf
  T('PRIZES', 180, 310, 11, '#7a4a26'); a = homePrizes();
  for (i = 0; i < 11; i++) {
    x = 22 + i * 31.6; y = 328; it = a[i]; g.save(); g.lineWidth = 2; g.strokeStyle = INK;
    if (i < 4) {
      g.globalAlpha = it.own ? 1 : 0.22; g.fillStyle = '#e8453c'; g.beginPath(); g.moveTo(x - 7, y - 14); g.lineTo(x - 3, y + 2); g.lineTo(x - 11, y + 2); g.closePath(); g.fill(); g.fillStyle = '#4fb8ff'; g.beginPath(); g.moveTo(x + 7, y - 14); g.lineTo(x + 11, y + 2); g.lineTo(x + 3, y + 2); g.closePath(); g.fill();
      g.fillStyle = '#f0bf45'; g.beginPath(); g.arc(x, y + 5, 11, 0, 6.2832); g.fill(); g.stroke(); T(String(i + 1), x, y + 5.5, 12, INK);
    } else if (i === 4) { drawPieces(g, x, y + 2, 0.42); }
    else if (i === 5) { g.globalAlpha = it.own ? 1 : 0.22; g.lineWidth = 1.4; for (j = 0; j < 2; j++) { g.beginPath(); g.moveTo(x - 5 + j * 11, y + 14); g.quadraticCurveTo(x - 2 + j * 11, y + 2, x - 5 + j * 11, y - 3); g.stroke(); g.fillStyle = j ? '#4fb8ff' : '#ff6b81'; g.lineWidth = 2; g.beginPath(); g.ellipse(x - 6 + j * 12, y - 8, 7, 9, 0, 0, 6.2832); g.fill(); g.stroke(); g.lineWidth = 1.4; } }
    else if (i === 6) { g.globalAlpha = it.own ? 1 : 0.22; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - 17, y - 8); g.quadraticCurveTo(x, y + 2, x + 17, y - 8); g.stroke(); ['#e8453c', '#ffd93b', '#4fb8ff'].forEach(function (cl, q) { var px = x - 12 + q * 12, py = y - 4 + (q === 1 ? 2 : 0); g.fillStyle = cl; g.beginPath(); g.moveTo(px - 5, py); g.lineTo(px + 5, py); g.lineTo(px, py + 13); g.closePath(); g.fill(); g.lineWidth = 1.4; g.stroke(); }); }
    else if (i === 7) { g.globalAlpha = it.own ? 1 : 0.22; g.translate(x, y - 1); bunchDraw(g, 0.5); }
    else if (i === 10) { g.globalAlpha = it.own ? 1 : 0.22; g.fillStyle = '#f0bf45'; g.beginPath(); g.arc(x, y + 3, 12, 0, 6.2832); g.fill(); g.lineWidth = 2; g.stroke(); g.fillStyle = '#ff5a1f'; g.beginPath(); g.moveTo(x - 8, y + 10); g.lineTo(x - 3, y - 2); g.lineTo(x + 3, y - 2); g.lineTo(x + 8, y + 10); g.closePath(); g.fill(); g.lineWidth = 1.4; g.stroke(); g.fillStyle = '#ffd93b'; g.beginPath(); g.ellipse(x, y - 2, 3.5, 1.6, 0, 0, 6.2832); g.fill(); }
    else if (i === 9) { g.globalAlpha = it.own ? 1 : 0.22; g.fillStyle = '#f0bf45'; g.beginPath(); g.arc(x, y + 3, 12, 0, 6.2832); g.fill(); g.lineWidth = 2; g.stroke(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - 4, y + 5, 4.2, 0, 6.2832); g.arc(x + 1, y + 2.5, 5, 0, 6.2832); g.arc(x + 6, y + 5, 3.8, 0, 6.2832); g.fill(); g.lineWidth = 1.4; g.stroke(); }
    else { g.globalAlpha = it.own ? 1 : 0.22; g.fillStyle = '#f0bf45'; g.beginPath(); g.arc(x, y + 3, 12, 0, 6.2832); g.fill(); g.lineWidth = 2; g.stroke(); g.translate(x, y + 5); g.scale(0.42, 0.42); g.beginPath(); g.moveTo(-17, 6); g.quadraticCurveTo(-4, -2, 0, -15); g.quadraticCurveTo(4, -2, 17, 6); g.quadraticCurveTo(2, 3, 0, -6); g.quadraticCurveTo(-2, 3, -17, 6); g.closePath(); g.fillStyle = '#d99a48'; g.fill(); g.lineWidth = 3.4; g.stroke(); }
    g.restore(); z.push([x - 15.5, 306, 31, 36, 'prize', i]);
  }
  g.fillStyle = '#8a5a33'; g.fillRect(12, 344, 336, 7); g.fillStyle = '#6a4222'; g.fillRect(12, 351, 336, 2);
  // the Apple Press arcade machine
  g.fillStyle = '#4b3a78'; g.beginPath(); g.moveTo(14, 452); g.lineTo(14, 372); g.quadraticCurveTo(14, 356, 30, 356); g.lineTo(74, 356); g.quadraticCurveTo(90, 356, 90, 372); g.lineTo(90, 452); g.closePath(); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  g.fillStyle = '#ff5a6a'; RR(20, 360, 64, 16, 4); g.fill(); g.lineWidth = 1.5; g.stroke(); T('APPLE PRESS', 52, 368.5, 8, '#ffffff');
  g.fillStyle = '#0f2a1c'; RR(22, 382, 60, 34, 4); g.fill(); g.stroke(); g.fillStyle = '#ff4a5a'; g.beginPath(); g.arc(52, 401, 8, 0, 6.2832); g.fill(); g.fillStyle = '#6ede6e'; g.fillRect(52, 389, 3, 5); g.fillRect(55, 389, 4, 2);
  g.fillStyle = '#2e2352'; g.fillRect(18, 421, 68, 13); g.strokeStyle = '#d0d0d8'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(34, 427); g.lineTo(34, 421); g.stroke(); g.fillStyle = '#ff4a5a'; g.beginPath(); g.arc(34, 420, 3.4, 0, 6.2832); g.fill(); g.fillStyle = '#ffd93b'; g.beginPath(); g.arc(62, 427, 3.2, 0, 6.2832); g.fill(); g.fillStyle = '#7ad8ff'; g.beginPath(); g.arc(74, 427, 3.2, 0, 6.2832); g.fill();
  g.fillStyle = '#1c1536'; g.fillRect(44, 439, 16, 6); z.push([14, 356, 76, 96, 'apple', 0]);
  // the mirror (it opens the costume picker)
  g.fillStyle = '#7a4a26'; g.fillRect(124, 446, 8, 8); g.fillRect(164, 446, 8, 8); g.fillStyle = '#d9a441'; g.beginPath(); g.ellipse(148, 402, 32, 48, 0, 0, 6.2832); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  g.fillStyle = '#d8efff'; g.beginPath(); g.ellipse(148, 402, 26, 42, 0, 0, 6.2832); g.fill(); g.lineWidth = 2; g.stroke();
  if (bunchOn()) { g.save(); g.translate(131, 404); g.rotate(-0.15); bunchDraw(g, 0.25); g.restore(); }
  ART.banana(g, 148, 406, -0.05, 0.58, 0, 0.4, wearFlags(), 0); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.beginPath(); g.arc(148, 402, 33.5, 3.5, 4.5); g.stroke(); T('Costumes', 148, 459 - 4, 9, '#ffffff', 'center', 1); z.push([116, 356, 64, 96, 'mirror', 0]);
  // the bookshelf
  g.fillStyle = '#8a5a33'; g.fillRect(236, 354, 108, 98); g.fillStyle = '#5e3a1c'; g.fillRect(242, 360, 96, 40); g.fillRect(242, 406, 96, 40); g.lineWidth = 2; g.strokeStyle = INK; g.strokeRect(236, 354, 108, 98);
  for (i = 0; i < 4; i++) {
    j = i & 1; x = 247 + j * 4; y = (i >> 1 ? 446 : 400) - 13 * (j + 1); n = 86 - j * 6; g.fillStyle = HOME_BOOKS[i][1]; RR(x, y, n, 13, 2); g.fill(); g.lineWidth = 1.4; g.strokeStyle = INK; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 3, y + 1.5, 2, 10); g.fillRect(x + n - 5, y + 1.5, 2, 10);
    sz = 8; g.font = '800 ' + sz + 'px ' + FONT; while (sz > 5.5 && g.measureText(HOME_BOOKS[i][0]).width > n - 16) { sz -= 0.5; g.font = '800 ' + sz + 'px ' + FONT; } T(HOME_BOOKS[i][0], x + n / 2, y + 7, sz, '#ffffff');
    z.push([x, y, n, 13, 'book', i]);
  }
  h.z = z;
}
function renderHome() {
  var h = HOME, i, y;
  var bl = Math.floor(time * 2) % 2, y0 = 396, sx = h.bg ? h.bg.width / W : 1;
  if (!h.bg || h.k !== k) { homeBuild(); h.full = 1; }
  if (h.full || fx.length || h.fxo) { ctx.drawImage(h.bg, 0, 0, W, H); h.full = 0; }   // the room never changes: after the first picture only the bottom part (where Fancy walks) is put back each frame, which costs a third as much
  else { ctx.drawImage(h.bg, 0, y0 * sx, h.bg.width, h.bg.height - y0 * sx, 0, y0, W, H - y0); if (h.bl !== bl || bl) ctx.drawImage(h.bg, 20 * sx, 358 * sx, 66 * sx, 20 * sx, 20, 358, 66, 20); }
  h.fxo = fx.length > 0; h.bl = bl;
  if (bl) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(22, 363, 4, 3); ctx.fillRect(78, 363, 4, 3); }   // the Apple Press marquee blinks
  ctx.fillStyle = 'rgba(70,35,10,.28)'; ctx.beginPath(); ctx.ellipse(h.x, h.y + 24, 20 - Math.sin(time * 4) * 1.5, 6, 0, 0, 6.2832); ctx.fill();
  ctx.save(); ctx.translate(h.x, h.y + Math.sin(time * 4) * 3 - 6); if (h.face < 0) ctx.scale(-1, 1); drawFancy(0, 0, h.mv ? 0.1 : -0.04, 0.85); ctx.restore();
  drawFx();
  if (h.msg.length && time - h.mt < 5) {
    ctx.globalAlpha = clamp((5 - (time - h.mt)) / 0.4, 0, 1); y = 632 - 12 - h.msg.length * 16; ctx.fillStyle = 'rgba(40,24,12,.82)'; rrect(14, y - 2, 332, h.msg.length * 16 + 12, 10); ctx.fill();
    ctx.font = '700 12px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff'; for (i = 0; i < h.msg.length; i++) ctx.fillText(h.msg[i], 180, y + 11 + i * 16); ctx.globalAlpha = 1;
  }
}
function balResultCard() {
  var t = rsgT, a = clamp(Math.min(t / 0.3, (CFG.cardSecs - t) / 0.3), 0, 1), e = a * a * (3 - 2 * a), dx = (t < CFG.cardSecs / 2 ? 1 : -1) * (1 - e) * 400, y = 336, R = BALR, i;
  ctx.save(); ctx.translate(dx, 0); cardFrame(30, y, 300, 200, R.night ? '#7a6cff' : '#ff7aa8', R.night ? 'Night Party!' : 'Balloon Party!', 28, 46);
  for (i = 0; i < 5; i++) ART.bal.draw(ctx, (i * 2 + 1) % 8, 62 + i * 59, y + 84 + Math.sin(time * 3 + i) * 4, 0.5);
  if (empOn()) drawEmpDoor(EMP_DOOR[0] + 28, EMP_DOOR[1] + 62);
  outlined((R.perfect ? 'PERFECT! ' : 'You popped ') + R.popped + ' of ' + R.total + '!', W / 2, y + 128, 20, R.perfect ? '#ffd93b' : '#ffffff');
  ART.coin(ctx, 104, y + 166, time); outlined('+' + R.coins + ' banana credits', 212, y + 168, 16, '#ffffff');
  if (empOn()) outlined('Tap the door: the Emporium!', W / 2, y + 190, 13, '#ffd93b');
  ctx.restore();
}

/* --- Prince Chimp gives up his balloons (the first time the game is beaten) --- */
var GIFT_LINES = ['Fine! You win, Banana!', 'Take every balloon I own... and please leave me alone!'];
var giftK = 0, giftTitle = false, CROWN_LINES = ['Fair and square, Banana!', 'Take my crown...', 'it looks better on you!'];
function startGift(k, toTitle) { giftK = k || 0; giftTitle = !!toTitle; bx = CFG.bananaX; by = 330; vy = 0; angle = 0; trackOn = false; state = 'gift';   // Fancy hovers up in the open for the gift scene (he used to sit down on the launcher)
  giftT = 0; giftS = 0; giftSt = 0; setBar(false); ART.bal.warm(); }
function giftTap() { if ((giftS === 1 || giftS === 2) && giftSt > 0.45) { giftS++; giftSt = 0; } }
function giftUpdate(dt) {
  giftT += dt; giftSt += dt; by = 330 + Math.sin(time * 2.4) * 7; angle = Math.sin(time * 1.7) * 0.05; flapAnim = time % 0.6 < 0.18 ? 0.18 - time % 0.6 : 0;
  if (giftS === 0 && giftSt > 1.6) { giftS = 1; giftSt = 0; }
  else if ((giftS === 1 || giftS === 2) && giftSt > 9) { giftS++; giftSt = 0; }
  else if (giftS === 3 && giftSt > 2.4) {
    giftS = 4; giftSt = 0; if (giftK) { save.unlocks.crown = 1; save.unlocks.crownOff = 0; } else { save.unlocks.balloons = 1; save.unlocks.flags = 1; } persist();
    burst(bx + 10, by - 10, 36, ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff'], 300, 320);
  } else if (giftS === 4 && giftSt > 2.2) { if (giftTitle) { giftTitle = false; resetWorld(); state = 'title'; titleT = 5; setBar(true); } else toReady(); if (giftK) toast('The true ending! Fancy now has the Banana Crown (see Costume).', 7000); else toast('Secret unlocked! A Balloon Party now follows the Ice Cream Parlor, and Fancy has pennant flags (see Costume).', 7000); }
}
function drawBunch(x, y, t, s, up) {   // a bunch of balloons held at (x, y), the strings gathered in the hand
  var offs = [[-34, -92], [-12, -112], [14, -100], [36, -84], [-46, -62], [0, -72], [28, -58]], i, px2, py2;
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineCap = 'round';
  for (i = 0; i < offs.length; i++) { px2 = x + offs[i][0] * s + Math.sin(t * 1.3 + i) * 3; py2 = y + offs[i][1] * s - up + Math.cos(t * 1.1 + i * 2) * 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(px2, py2 + 36 * s); ctx.stroke(); }
  ctx.lineWidth = 1.3; ctx.strokeStyle = '#fffdf6';
  for (i = 0; i < offs.length; i++) { px2 = x + offs[i][0] * s + Math.sin(t * 1.3 + i) * 3; py2 = y + offs[i][1] * s - up + Math.cos(t * 1.1 + i * 2) * 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(px2, py2 + 36 * s); ctx.stroke(); }
  for (i = 0; i < offs.length; i++) { px2 = x + offs[i][0] * s + Math.sin(t * 1.3 + i) * 3; py2 = y + offs[i][1] * s - up + Math.cos(t * 1.1 + i * 2) * 2; ART.bal.draw(ctx, (i + 3) % 9, px2, py2, 0.78 * s, undefined, true); }
}
function bigCrown(x, y, sc) {   // the Banana Crown offered to Fancy: floating in a soft golden glow with a few twinkling stars (the crown picture itself is drawn no larger than 1.5x so it stays crisp)
  var i, a, r = 58 * sc / 1.5, sx, sy, q, gr;
  ctx.save(); ctx.translate(x, y);
  gr = ctx.createRadialGradient(0, 0, 4, 0, 0, r * 1.5); gr.addColorStop(0, 'rgba(255,238,150,.7)'); gr.addColorStop(.5, 'rgba(255,214,80,.25)'); gr.addColorStop(1, 'rgba(255,214,80,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, 6.2832); ctx.fill();
  ctx.fillStyle = '#fffbe0'; ctx.beginPath();
  for (i = 0; i < 6; i++) { a = time * 0.9 + i * 1.0472; sx = Math.cos(a) * r * 1.05; sy = Math.sin(a) * r * 0.62; q = (3.5 + 2.2 * Math.sin(time * 5 + i * 2)) * sc; ctx.moveTo(sx, sy - q); ctx.lineTo(sx + q * .28, sy - q * .28); ctx.lineTo(sx + q, sy); ctx.lineTo(sx + q * .28, sy + q * .28); ctx.lineTo(sx, sy + q); ctx.lineTo(sx - q * .28, sy + q * .28); ctx.lineTo(sx - q, sy); ctx.lineTo(sx - q * .28, sy - q * .28); ctx.closePath(); }
  ctx.fill(); ctx.rotate(Math.sin(time * 2) * 0.06); ART.crown(ctx, sc); ctx.restore();
}
function drawGift() {
  var S = giftS, st = giftSt, cx, cy = 452, lean = 0, up = 0, hx, hy, line = S === 1 ? (giftK ? CROWN_LINES[0] : GIFT_LINES[0]) : S === 2 ? GIFT_LINES[1] : '', u;
  cx = S === 0 ? W + 90 - (W + 90 - 262) * easeOutBack(clamp(st / 1.4, 0, 1)) : S === 4 ? 262 + st * st * 90 : 262;
  hx = cx - 84; hy = cy + 40;
  if (S === 3) { u = clamp(st / 2.2, 0, 1); u = u * u * (3 - 2 * u); hx += (bx + 8 - hx) * u; hy += (by - 26 - hy) * u; }
  else if (S === 4) { hx = bx + 8; hy = by - 26 - st * 150; }
  ctx.save(); ctx.translate(cx, cy + Math.sin(time * 6) * 1.5); ctx.rotate(lean); cryChimp(0, 0, 1.15); ctx.restore();
  if (S < 3) {   // the white flag of surrender, waving
    var fx0 = cx + 46, fy0 = cy + 40; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(fx0, fy0 + 40); ctx.lineTo(fx0, fy0 - 60); ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#d8c8a0'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx0, fy0 - 58); ctx.quadraticCurveTo(fx0 + 16, fy0 - 62 + Math.sin(time * 7) * 5, fx0 + 32, fy0 - 52 + Math.sin(time * 7 + 1) * 4); ctx.quadraticCurveTo(fx0 + 16, fy0 - 38 + Math.sin(time * 7 + 2) * 5, fx0, fy0 - 34); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  }
  if (giftK) { if (S < 4) { var gu = S === 3 ? u : 0, k0x = cx - 112, k0y = cy - 56; bigCrown(k0x + (bx + 8 - k0x) * gu, k0y + Math.sin(time * 3) * 4 * (1 - gu) + (by - 26 - k0y) * gu, 1.5 - 0.65 * gu); } } else drawBunch(hx, hy, time, 1, 0);
  if (line) {
    var ba = clamp(st / 0.25, 0, 1); ctx.globalAlpha = ba; ctx.lineWidth = 3; ctx.strokeStyle = INK; rrect(20, 90, 320, 92, 20); ctx.fillStyle = 'rgba(58,42,77,0.9)'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 28, 182); ctx.lineTo(cx - 6, 182); ctx.lineTo(cx - 14, 214); ctx.closePath(); ctx.fill(); ctx.stroke();
    outlined('Prince Chimp', W / 2, 108, 15, '#ffd93b');
    if (S === 1) outlined(line, W / 2, 144, 22, '#ffffff'); else { outlined(giftK ? CROWN_LINES[1] : 'Take every balloon I own...', W / 2, 136, 20, '#ffffff'); outlined(giftK ? CROWN_LINES[2] : 'and please leave me alone!', W / 2, 162, 20, '#ffffff'); }
    if (st > 0.5 && Math.floor(time * 2) % 2) outlined('tap', W - 40, 168, 14, '#ffd93b');
    ctx.globalAlpha = 1;
  }
  if (S === 4) { var ta = clamp(st / 0.4, 0, 1); ctx.globalAlpha = ta; outlined(giftK ? 'Banana Crown unlocked!' : 'Balloon Party unlocked!', W / 2, 200, 26, '#ffd93b'); outlined(giftK ? 'The true ending!' : 'and pennant flags!', W / 2, 232, 20, '#ffffff'); ctx.globalAlpha = 1; }
}

/* --- the big victory card --- */
function vicDone() { return 1.3 + 8 * 0.42 + 0.9; }
function drawIcon(n, x, y, s) {
  var i, a;
  if (n === 'clock') { ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(x, y, 10 * s, 0, 7); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(time * 3) * 7 * s, y + Math.sin(time * 3) * 7 * s); ctx.moveTo(x, y); ctx.lineTo(x, y - 5 * s); ctx.stroke(); ctx.fillStyle = '#ff6b81'; ctx.fillRect(x - 2.5 * s, y - 14 * s, 5 * s, 3 * s); }
  else if (n === 'pause') { ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(x, y, 10 * s, 0, 7); ctx.fillStyle = '#5aa2ff'; ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 5 * s, y - 5 * s, 3.4 * s, 10 * s); ctx.fillRect(x + 1.6 * s, y - 5 * s, 3.4 * s, 10 * s); }
  else if (n === 'tap') drawTapIcon(x, y);
  else if (n === 'coin') ART.coin(ctx, x, y, time);
  else if (n === 'heart') ART.mg.draw(ctx, 'heart', x, y, true, 1);
  else if (n === 'friend') ART.friend(ctx, x, y + 4, 0, 0.5, 0);
  else if (n === 'balloon') ART.bal.draw(ctx, 0, x, y + 4, 0.34);
  else if (n === 'flag') { ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x - 11, y - 8); ctx.lineTo(x + 11, y - 8); ctx.stroke(); for (i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - 10 + i * 8, y - 8); ctx.lineTo(x - 3 + i * 8, y - 8); ctx.lineTo(x - 6.5 + i * 8, y + 5); ctx.closePath(); ctx.fillStyle = FLC[i]; ctx.fill(); ctx.stroke(); } }
  else if (n === 'wafer') ART.mg.draw(ctx, 'wafer', x, y, undefined, 1);
  else if (n === 'star') { ctx.beginPath(); for (i = 0; i < 10; i++) { a = -1.5708 + i * 0.6283; ctx.lineTo(x + Math.cos(a) * (i % 2 ? 4.2 : 10) * s, y + Math.sin(a) * (i % 2 ? 4.2 : 10) * s); } ctx.closePath(); ctx.fillStyle = '#ffd93b'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
}
function drawMedal(x, y, s) {
  var i, g, sh;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = INK;
  [[-1, '#e8283f'], [1, '#3a7ae8']].forEach(function (r) { ctx.beginPath(); ctx.moveTo(r[0] * 6, 20); ctx.lineTo(r[0] * 26, 20); ctx.lineTo(r[0] * 34, 62); ctx.lineTo(r[0] * 21, 53); ctx.lineTo(r[0] * 12, 64); ctx.closePath(); ctx.fillStyle = r[1]; ctx.fill(); ctx.stroke(); });
  g = ctx.createRadialGradient(-10, -12, 2, 0, 0, 38); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.55, '#f0bf45'); g.addColorStop(1, '#c98a1d');
  ctx.beginPath(); ctx.arc(0, 0, 33, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 25, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = '#a8701a'; ctx.stroke();
  ctx.beginPath(); for (i = 0; i < 10; i++) { var a = -1.5708 + i * 0.6283, r = i % 2 ? 8 : 19; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r + 1); } ctx.closePath(); ctx.fillStyle = '#fffbe0'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#a8701a'; ctx.stroke();
  if (!calmOn()) { ctx.beginPath(); ctx.arc(0, 0, 32, 0, 7); ctx.clip(); sh = ((time * 70) % 200) - 100; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(sh - 8, -40); ctx.lineTo(sh + 6, -40); ctx.lineTo(sh - 18, 40); ctx.lineTo(sh - 32, 40); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function cryChimpStill(g, x, y, s) { ART.chimp(g, x, y, s, 2); }
function cryChimp(x, y, s) {   // Prince Chimp blubbering: sobbing shake, a stream of tear drops flying off in arcs (still, with drops frozen away, in calm mode)
  var cs = calmOn(), i, d, ph, px, py;
  ART.chimp(ctx, x + (cs ? 0 : Math.sin(time * 23) * 1.3 * s), y - (cs ? 0 : Math.abs(Math.sin(time * 11)) * 1.8 * s), s, 2);
  if (cs) return;
  ctx.lineWidth = 1.2; ctx.strokeStyle = INK;
  for (d = -1; d <= 1; d += 2) for (i = 0; i < 3; i++) {
    ph = (time * 1.7 + i / 3 + (d > 0 ? 0.17 : 0)) % 1; px = x + d * (14 + ph * 36) * s; py = y + (6 - ph * 16 + ph * ph * 76) * s;
    ctx.globalAlpha = 1 - ph * ph; ctx.beginPath(); ctx.arc(px, py, (2.8 - ph) * s + 0.8, 0, 7); ctx.fillStyle = '#8fdcff'; ctx.fill(); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function victoryCard() {
  var S = VS || { secs: 0, pauses: 0, flaps: 0, coins: 0, hurts: 0, friends: 0, pops: 0, popsOf: 0, prevTime: 0, prevPz: -1, recT: false, recP: false }, t = vicT, i, j, e, u, rows, sp, y, v, tx, shown, ep, cs = calmOn();
  ctx.fillStyle = 'rgba(58,42,77,0.5)'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, 200); if (!cs) ctx.rotate(t * 0.22); ctx.fillStyle = 'rgba(255,236,140,0.2)';   // slowly turning sunburst (twelve straight rays in one path; the far ends are well off the screen)
  ctx.beginPath(); for (i = 0; i < 12; i++) { ctx.rotate(0.5236); ctx.moveTo(0, 0); ctx.lineTo(562.6, -62.1); ctx.lineTo(562.6, 62.1); ctx.closePath(); } ctx.fill(); ctx.restore();
  for (i = 0; i < fwk.length; i++) {   // fireworks
    var f = fwk[i], q = f.t / 1.1, r0 = q * 78, r1 = r0 + 22 * (1 - q) + 4; ctx.globalAlpha = 1 - q * q; ctx.strokeStyle = f.c; ctx.lineWidth = 3.2 * (1 - q) + 1; ctx.lineCap = 'round';
    ctx.beginPath(); for (j = 0; j < 16; j++) { var an = j * 0.3927 + f.o; ctx.moveTo(f.x + Math.cos(an) * r0, f.y + Math.sin(an) * r0); ctx.lineTo(f.x + Math.cos(an) * r1, f.y + Math.sin(an) * r1); } ctx.stroke();
  }
  ctx.globalAlpha = 1; var vc = VCLIP; if (vc) { ctx.restore(); VCLIP = false; }
  ep = easeOutBack(clamp(t / 0.55, 0, 1)); ctx.save(); ctx.translate(W / 2, 227); ctx.scale(0.55 + 0.45 * ep, 0.55 + 0.45 * ep); ctx.translate(-W / 2, -227);
  rows = [['clock', 'Your time', S.secs, 'time', S.prevTime ? (S.recT ? 'NEW RECORD!' : 'best ' + fmtM(S.prevTime)) : 'First win!'],
    ['pause', 'Pauses', S.pauses, 'n', S.pauses === 0 ? 'Never paused!' : S.prevPz < 0 ? '' : S.recP ? 'NEW RECORD!' : 'fewest ' + S.prevPz],
    ['tap', 'Taps', S.flaps, 'n', ''], ['coin', 'Banana credits', S.coins, 'n', ''],
    ['heart', 'Bonks', S.hurts, 'n', S.hurts === 0 ? 'Flawless!' : ''], ['friend', 'Friends freed', S.friends, 'plus', '']];
  if (S.popsOf > 0) rows.push(['balloon', 'Balloons', S.pops, 'of', S.popsOf]);
  sp = Math.min(31, 212 / (rows.length + 1));
  var settled = t >= vicDone(), panel = function () {
    ctx.lineWidth = 4; ctx.strokeStyle = INK; rrect(16, 18, 328, 418, 24); ctx.fillStyle = vc ? '#fffcf0' : 'rgba(255,252,240,0.97)'; ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffd93b'; rrect(23, 25, 314, 404, 19); ctx.stroke();
  }, vrows = function (pass) {   // the table: pass 0 draws everything; once it has all arrived, pass 1 (the stripes, words and numbers, which sit still) is baked into the card's picture and pass 2 (the little pictures and the pulsing record notes) is drawn live
    var i, y, u, e, j, r, rv, cu, pl, shown, uu, names, has, pul;
    for (i = 0; i <= rows.length; i++) {
      y = 206 + i * sp; u = clamp((t - 1.3 - i * 0.42) / 0.35, 0, 1); if (u <= 0) continue; e = easeOutBack(u);
      ctx.save(); ctx.translate((1 - e) * 340, 0); ctx.globalAlpha = Math.min(1, u * 2.5);
      if (i % 2 === 0 && pass !== 2) { ctx.fillStyle = 'rgba(58,42,77,0.12)'; rrect(30, y - sp / 2 + 1, 300, sp - 2, 11); ctx.fill(); }
      if (i < rows.length) {
        r = rows[i]; rv = r[2]; cu = clamp((t - 1.3 - i * 0.42 - 0.2) / 0.7, 0, 1); pl = /RECORD|Flawless|Never|First/.test(r[4]);
        if (pass !== 1) drawIcon(r[0], 50, y, 1);   // the little pictures are always live: some are built in the background and may not be ready yet when the table is first drawn
        if (pass !== 2) {
          outlined(r[1], 72, y, 15, '#ffffff', 'left');
          shown = r[3] === 'time' ? fmtM(rv * cu) : r[3] === 'plus' ? '+' + Math.round(rv * cu) : r[3] === 'of' ? Math.round(rv * cu) + ' / ' + r[4] : String(Math.round(rv * cu));
          outlinedC(shown, 222, y, 17, '#ffffff', 'right');
        }
        if (r[3] !== 'of' && r[4] && cu >= 1 && (pass === 0 || (pass === 2) === (pl && !cs))) { pul = pl && !cs ? 1 + 0.08 * Math.sin(time * 7) : 1; outlined(r[4], 238, y, 12 * pul, pl ? '#ffd93b' : '#ffffff', 'left', 12); }
      } else {
        if (pass !== 1) { uu = save.unlocks; names = ['balloon', 'flag', 'wafer']; has = [uu.balloons, uu.flags, uu.wafers]; for (j = 0; j < 3; j++) { ctx.globalAlpha = Math.min(1, u * 2.5) * (has[j] ? 1 : 0.3); drawIcon(names[j], 196 + j * 34, y - (names[j] === 'balloon' ? 3 : 0), 1); if (!has[j]) { ctx.globalAlpha = Math.min(1, u * 2.5); outlined('?', 196 + j * 34, y + 1, 15, '#ffd93b'); } } }
        if (pass !== 2) { ctx.globalAlpha = Math.min(1, u * 2.5); outlined('Secrets found', 72, y, 15, '#ffffff', 'left'); outlinedC(secretsFound() + '/3', 322, y, 14, '#ffffff', 'right'); }
      }
      ctx.restore();
    }
  };
  if (settled) stillDraw('vic' + VSQ, 12, 14, 336, 426, function () { panel(); vrows(1); }); else panel();
  var word = 'YOU DID IT!', ws = [], tot = 0, c;
  for (i = 0; i < word.length; i++) { e = textPic(word[i], 36, '#ffd93b'); ws.push(e ? e.w : 16); tot += ws[i] + 1; }
  tx = W / 2 - tot / 2;
  for (i = 0; i < word.length; i++) {
    u = t - 0.35 - i * 0.06; y = 58 - (u > 0 && !cs ? Math.max(0, Math.sin(u * 9)) * 9 * Math.exp(-u * 1.3) : 0); c = !cs && Math.sin(time * 5 - i * 0.8) > 0.82 ? '#fff6b0' : '#ffd93b';
    if (word[i] !== ' ') { ctx.globalAlpha = clamp(u / 0.1 + 1, 0, 1); outlined(word[i], tx + ws[i] / 2, y, 36, c); ctx.globalAlpha = 1; }
    tx += ws[i] + 1;
  }
  ART.coin(ctx, 44, 58, time); ART.coin(ctx, W - 44, 58, time + 0.5);
  u = clamp((t - 0.6) / 0.5, 0, 1); drawMedal(W / 2, 118, 0.8 * easeOutBack(u));
  if (u > 0) { ART.banana(ctx, 72, 128 - Math.abs(Math.sin(time * 5)) * 12, -0.12 + Math.sin(time * 5) * 0.08, 1.0, Math.sin(time * 5) > 0.6 ? 0.18 : 0, time, wearFlags(), -200, false, 0, -1); cryChimp(286, 140, 0.72); if (u >= 1) outlined('Boo hoo!', 288 + Math.sin(time * 9) * 2, 92, 14, '#8fdcff'); }
  vrows(settled ? 2 : 0);
  ctx.restore();
  if (t > vicDone() - 0.2) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 4); outlined('Tap for your prize!', W / 2, 452, 20, '#ffffff'); ctx.globalAlpha = 1; }
}
function victoryTap() { if (vicT < 0.7) return; if (vicT < vicDone()) vicT = vicDone(); else if (pWin.hidden) openWin(); }   // a tap in the first moments (one aimed at the flight) cannot skip the celebration

/* ===== Title screen news ticker: the story, the news, a few little known facts and rumors (the banana jokes were taken out on request) ===== */
var TICKS = ['BREAKING NEWS: Evil Prince Chimp has banana-napped every banana friend!', 'Hero SuperBanana Fancy takes to the skies to rescue them!', 'Each time Fancy dodges the Prince\'s obstacles, 5 friends escape!'];

var NEWS2 = ['Bananas are going missing! Citizens ask Fancy, the Banana to investigate.', 'Grocery stores raided across the land.', 'Vanilla wafer stores depleted.', 'Coconut supply drops by 90%.', 'Prince Chimp claims no knowledge as to the causes of all the mysterious events.', 'When asked about the missing bananas, Prince Chimp states, "No comment."'];
var FACTS = ['Fancy, the Banana, wants everyone to know that the situation is under control.', 'Little known fact: potassium gives SuperBananas cool new powers.', 'Little known fact: one of the historical enemies of all bananas is the vanilla wafer, so be careful out there.', 'Little known fact: coconuts can be blown out of the air with lime missiles.'];   // mixed into the news: three of the four each time, a different three as you play
var RUMOR_A = ['RUMOR: Win once and Prince Chimp may give up a big surprise!', 'RUMOR: Winners say the game keeps secrets. Can you find them?'];
var RUMOR_B = ['RUMOR: A shimmer at the very top of the sky hides a vault!', 'RUMOR: A long PERFECT streak can make one gate glow gold!', 'RUMOR: Stay low before the Silverware Drawer. Something rattles!', 'RUMOR: In Chimp\'s Navy, three perfect barrel leaps call up a raft!', 'RUMOR: A rock arch near the Navy\'s end hides a secret cove!', 'RUMOR: Sail the whole Navy with no hits and the Boss Sub awaits!', 'RUMOR: Five quick taps on Fancy open a little secret door!', 'RUMOR: Six banana friends are still lost. Look closely!', 'RUMOR: Beat the game in a Challenge for a badge and new colors!', 'RUMOR: Prince Chimp wants a rematch. After your second win he waits at the end of the jungle!', 'RUMOR: Beat all his machines and his crown might be yours!'];
var TKLIST = null, TKW = -1;
function tickList() {   // the headlines: the story, the news, and rumors that hint at the secrets
  var w = save.stats.wins > 0 ? 1 : 0, o = TICKS.slice(0, 3), i, st = save.stats.runs % FACTS.length;
  o = o.concat(NEWS2); for (i = 0; i < 3; i++) o.push(FACTS[(st + i) % FACTS.length]);
  if (!w) return o.concat(RUMOR_A);
  for (i = 0; i < 5; i++) o.push(RUMOR_B[(save.stats.runs * 3 + i * 2) % RUMOR_B.length]);   // five of the eleven rumors, a different five now and then (the strip must stay short enough for one picture)
  return o;
}
var TSEP = '   ★   ';
var TKS = null, TKK = 0;   // the headlines drawn once into one long strip; each frame copies the visible part (text drawing is slow in Firefox)
function tickerStrip() {
  var kk = k, c = document.createElement('canvas'), g2, i, x = 0;
  c.width = Math.ceil(tickSum * kk) + 2; c.height = Math.ceil(34 * kk); g2 = c.getContext('2d', CRF); g2.scale(kk, kk);
  g2.font = '700 15px ' + FONT; g2.textAlign = 'left'; g2.textBaseline = 'middle'; g2.fillStyle = '#ffffff';
  for (i = 0; i < TKLIST.length; i++) { g2.fillText(TKLIST[i] + TSEP, x, 17); x += tickW[i]; }
  TKS = c; TKK = kk;
}
function tickerBlit() {   // scrolls by the smooth clock (the time plus the part of a physics step not yet run), at any fraction of a pixel: whole-pixel steps from an uneven clock made the words judder
  if (!TKS || TKK !== k) tickerStrip();
  var vw = Math.round(250 * k), sw = Math.round(tickSum * k), tm = time + Math.min(acc, 0.05), sx = ((((tm * 52 - 8) % tickSum) + tickSum) % tickSum) * k, dx = Math.round(88 * k) / k, dy = Math.round(12 * k) / k, h = TKS.height, a = Math.min(vw, sw - sx);
  ctx.imageSmoothingEnabled = true; ctx.drawImage(TKS, sx, 0, a, h, dx, dy, a / k, h / k);
  if (a < vw) ctx.drawImage(TKS, 0, 0, vw - a, h, dx + a / k, dy, (vw - a) / k, h / k);
}
function drawTicker() {
  var i = 0, x, w, guard = 0, ww = save.stats.wins > 0 ? 1 : 0;
  if (!TKLIST || ww !== TKW) { TKW = ww; TKLIST = tickList(); tickW = null; TKS = null; }
  ctx.font = '700 15px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  if (!tickW) { tickW = TKLIST.map(function (t) { return ctx.measureText(t + TSEP).width; }); tickSum = tickW.reduce(function (a, b) { return a + b; }, 0); }
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffffff'; rrect(10, 10, 340, 38, 12); fs('rgba(30,20,50,0.9)');
  tickerBlit();
  rrect(10, 10, 76, 38, 12); fs('#e8283f'); outlined('NEWS', 48, 29, 17, '#ffffff');
}

/* ===== Drawing (the pictures themselves live in art.js; this part only places them) ===== */
var k = 1, dpr = 1, artK = 0;
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function fs(fill) { ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); }
/* Outlined text is drawn ONCE into a small picture and then stamped (stroke + fill of text every frame was a steady cost). `base` lets a changing size reuse one picture. */
var TXC = {}, TXI = Object.create(null), TXN = 0, TXF = 0;   // cache of text pictures; TXF counts drawn frames so the cache can drop only pictures nobody has used for a while
var TEXTQ = [], TXP = {};   // outlined text built one per frame (a lazy request is queued and drawn from the next frame on): a card full of new text no longer lands on one frame
(function () { [[64, '#ffffff'], [22, '#ffffff'], [20, '#ffffff'], [32, '#ffffff'], [24, '#ffffff'], [24, '#ffd93b'], [16, '#ffffff'], [14, '#ffffff']].forEach(function (p) { '0123456789'.split('').forEach(function (c) { var key = p[0] + '|' + p[1] + '|' + c; TXP[key] = 1; TEXTQ.push([c, p[0], p[1], key]); }); }); })();   // the digits are built early, one per frame
(function () { [['Ready', '#ff6b81'], ['Set', '#ffd93b'], ['GO!', '#7be07b']].forEach(function (p) { var key = '72|' + p[1] + '|' + p[0]; TXP[key] = 1; TEXTQ.push([p[0], 72, p[1], key]); }); })();
(function () {   // words the first run needs mid-play (the Oh no card, the launch words, the stage counter): built early, one per frame, so no frame pays for a card full of new text
  function q(text, size, fill) { var key = size + '|' + fill + '|' + text; if (!TXP[key]) { TXP[key] = 1; TEXTQ.push([text, size, fill, key]); } }
  function chars(text, size, fill) { text.split('').forEach(function (c) { q(c, size, fill); }); }
  '0123456789'.split('').forEach(function (c) { q(c, 52, '#ffd93b'); });
  q('Tap to launch!', 28, '#ffffff'); q('Go!', 28, '#7be07b'); q('WHOOSH!', 34, '#ffd93b');
  q('Oh no! Bonk!', 30, '#ffffff'); q('Gates you flew through', 14, '#ffffff'); q('Try again!', 22, '#ffffff'); q('Space: try again', 13, '#ffffff');
  chars('Your best: .', 16, '#ffffff'); chars('Stage +', 14, '#ffffff'); chars('New best!', 22, '#ffd93b');
})();   // Ready, Set, Go are built early too
/*TEST_HOOK_START*/ var TXT = {}; /*TEST_HOOK_END*/
function textPic(text, size, fill, lazy) {   // a picture already built is found through TXI (fill, then size, then text) without making a key string every call
  var ix = TXI[fill], e = ix && ix[size], key;
  e = e && e[text];
  if (e) { e.u = TXF; return e; }
  key = size + '|' + fill + '|' + text; e = TXC[key];
  if (e) { e.u = TXF; txIndex(e, fill, size, text); return e; }
  if (lazy) { if (!TXP[key]) { TXP[key] = 1; TEXTQ.push([text, size, fill, key]); } return null; }
  if (TXN > 320) txTrim();
  var c = document.createElement('canvas'), g2, pad = Math.ceil(size * 0.2) + 2, kk = k > 0 ? k : 1, w;
  g2 = c.getContext('2d', CRF); g2.font = '800 ' + size + 'px ' + FONT; w = g2.measureText(text).width;
  e = { c: c, w: w, pad: pad, h: Math.ceil(size * 1.4) + pad * 2 }; c.width = Math.ceil((w + pad * 2) * kk); c.height = Math.ceil(e.h * kk);
  g2 = c.getContext('2d', CRF); g2.scale(kk, kk); g2.font = '800 ' + size + 'px ' + FONT; g2.textBaseline = 'middle'; g2.textAlign = 'left';
  g2.lineJoin = 'round'; g2.lineWidth = size * 0.2; g2.strokeStyle = INK; g2.strokeText(text, pad, e.h / 2); g2.fillStyle = fill || '#fff'; g2.fillText(text, pad, e.h / 2);
  e.u = TXF; TXC[key] = e; TXN++; txIndex(e, fill, size, text); return e;
}
function txIndex(e, fill, size, text) { var a = TXI[fill] || (TXI[fill] = Object.create(null)), b = a[size] || (a[size] = Object.create(null)); b[text] = e; e.xf = fill; e.xs = size; e.xt = text; }
function txDrop(key) { var e = TXC[key], a = TXI[e.xf], b = a && a[e.xs]; if (b) delete b[e.xt]; delete TXC[key]; }
function txTrim() {   // make room: drop pictures unused for 15 seconds (the old way threw the WHOLE cache away at 160 pictures, so every word on screen was rebuilt in one frame: a freeze by the Silverware Drawer on a slow laptop)
  var ks = Object.keys(TXC), i, n = 0, old = TXF - 900;
  for (i = 0; i < ks.length; i++) if (TXC[ks[i]].u < old) { txDrop(ks[i]); n++; }
  if (n < 30) { ks = Object.keys(TXC).sort(function (a, b) { return TXC[a].u - TXC[b].u; }); for (i = 0; i < 40 && i < ks.length; i++) { txDrop(ks[i]); n++; } }
  TXN = Object.keys(TXC).length;
}
function outlined(text, x, y, size, fill, align, base, lazy) {
  /*TEST_HOOK_START*/ TXT[text] = 1; /*TEST_HOOK_END*/
  var b = base || size, e = textPic(text, Math.round(b), fill, lazy), s, kk = k > 0 ? k : 1, ox;
  if (!e) return;
  s = size / Math.round(b); ox = align === 'left' ? 0 : align === 'right' ? e.w : e.w / 2;
  ctx.drawImage(e.c, Math.round((x - (ox + e.pad) * s) * kk) / kk, Math.round((y - e.h / 2 * s) * kk) / kk, e.c.width / kk * s, e.c.height / kk * s);
}
var OCW = [], OCP = [];
function outlinedC(text, x, y, size, fill, align, base, lazy) {   // text that changes (scores, counters): every character is its own cached picture, so a new number never builds a new picture
  /*TEST_HOOK_START*/ TXT[text] = 1; /*TEST_HOOK_END*/
  var b = Math.round(base || size), s = size / b, kk = k > 0 ? k : 1, i, e, ws = OCW, tw = 0, cx, pics = OCP;   // OCW and OCP: scratch lists reused by every call (a new pair of lists per call was garbage every frame)
  for (i = 0; i < text.length; i++) { e = textPic(text.charAt(i), b, fill, lazy); pics[i] = e; ws[i] = e ? e.w * s : size * 0.55; tw += ws[i]; }
  cx = align === 'left' ? x : align === 'right' ? x - tw : x - tw / 2;
  for (i = 0; i < text.length; i++) { e = pics[i]; if (e) ctx.drawImage(e.c, Math.round((cx - e.pad * s) * kk) / kk, Math.round((y - e.h / 2 * s) * kk) / kk, e.c.width / kk * s, e.c.height / kk * s); cx += ws[i]; }
}
function shownTheme() { return bgT < 0.5 ? bgFrom : bgTheme; }   // stage change = a quick fade through white, so only ONE scene is drawn per frame (two at once was the big hitch)
/* Firefox: the sky and the hills are separate page layers that the browser slides by itself, so the page thread draws only the foreground (Firefox drew about twice as long per frame as it can show: the compositor then dropped one frame in seven; measured on a laptop, 2026-10-11). Other browsers draw everything on the canvas. */
var BKDEF = /Firefox\//.test(navigator.userAgent), BKMODE = BKDEF, bkEl = $('bk'), bkTh = -1, bkOn = false, bkBands = [], bkLast = [], bkCache = {};   // bkCache: the finished layers of a stage (the one on screen and the next), kept so a stage change does not build them in one frame
function bkHide() { if (bkOn) { bkOn = false; bkEl.hidden = true; } }
function bkReset() { bkTh = -1; bkLast = []; bkCache = {}; bkEl.textContent = ''; }
function bkPart(th, i) {   // one picture of a stage's layers per call (0 the sky, 1 to 3 the hill bands), built into the cache
  var li = ART.layersOf(th), cpl = stageEl.clientWidth / W, K, r = bkCache[th] || (bkCache[th] = { els: [], bands: [] }), e, c, n, j, b;
  if (!li || r.els[i]) return !!li; K = li.K;
  if (i === 0) { e = document.createElement('canvas'); e.width = li.sky.width; e.height = li.sky.height; e.getContext('2d').drawImage(li.sky, 0, 0); e.style.top = '0px'; e.style.width = (li.sky.width / K * cpl) + 'px'; e.style.height = (li.sky.height / K * cpl) + 'px'; e.style.willChange = 'auto'; r.els[0] = e; return true; }
  b = li.bands[i - 1]; c = b.L.c; n = Math.ceil(W * K / c.width) + 1;
  e = document.createElement('canvas'); e.width = c.width * n; e.height = c.height; for (j = 0; j < n; j++) e.getContext('2d').drawImage(c, j * c.width, 0);
  e.style.top = (Math.round(b.L.y * K) / K * cpl) + 'px'; e.style.width = (e.width / K * cpl) + 'px'; e.style.height = (c.height / K * cpl) + 'px';
  r.els[i] = e; r.bands[i - 1] = { el: e, pc: c.width / K, f: b.f }; return true;
}
function bkBuild(th) {   // put this stage's layers on the page (building what the cache does not hold yet)
  var i, r, k;
  for (i = 0; i < 4; i++) if (!bkPart(th, i)) return false;
  r = bkCache[th]; bkEl.textContent = ''; for (i = 0; i < 4; i++) bkEl.appendChild(r.els[i]);
  bkBands = r.bands; bkTh = th; bkLast = []; for (k in bkCache) if (+k !== th && +k !== bkNext()) delete bkCache[k];
  return true;
}
function bkNext() { return themeOf(stage + 1); }
function bkPre() {   // between frames of play: build the next stage's layers one picture per frame, once its scenery exists
  var th = bkNext(), r, i;
  if (th === bkTh || th === ART.journeyTheme || !ART.sceneReady(th)) return;
  r = bkCache[th]; if (r && r.els.length >= 4 && r.els[3]) return;
  for (i = 0; i < 4; i++) if (!(bkCache[th] && bkCache[th].els[i])) { bkPart(th, i); return; }
}
function bkWant(th) { return BKMODE && state === 'play' && !BAL && !FT && ftStill < 0.01 && !mirOn() && nightA <= 0.01 && zoomK <= 1.001 && punchT <= 0 && flipSX() === 1 && !cssF && th !== ART.journeyTheme; }   // never on a backward stage: turning the canvas over by CSS while the page layers sit under it froze the picture in Firefox (the owner's pantry-to-ice-cream crash)
function bkDraw(th, d) {
  var i, o, cpl, x;
  if (th !== bkTh && !bkBuild(th)) { bkHide(); return false; }
  if (!bkOn) { bkOn = true; bkEl.hidden = false; bkLast = []; }
  cpl = stageEl.clientWidth / W; bkPre();
  for (i = 0; i < bkBands.length; i++) { o = (d * bkBands[i].f) % bkBands[i].pc; x = (-o * cpl).toFixed(3); if (bkLast[i] !== x) { bkLast[i] = x; bkBands[i].el.style.transform = 'translate3d(' + x + 'px,0,0)'; } }
  ctx.clearRect(0, 0, W, H); return true;
}
function drawBack() { if (BAL) { bkHide(); ART.bal.back(ctx, dist, BAL.night); return; } if (ftStill >= 0.5) { bkHide(); crowd.time = time; if (ART.arena.draw(ctx, crowd)) return; } var th = shownTheme(); if (bkWant(th) && bkDraw(th, bd(th))) return; bkHide(); ART.back(ctx, th, bd(th)); }
function drawGround() { if (BAL) { ART.bal.ground(ctx, dist, BAL.night); return; } var th = shownTheme(); ART.ground(ctx, th, bd(th)); }
function spinPhase() { return (1 - spinT / CFG.spinSecs) * CFG.spinRolls * 6.2832; }
function drawFancy(x, y, rot, sc) {   // a little squash and stretch: taller on a flap, long and thin in the launch
  var f = flapAnim > 0 ? flapAnim / 0.18 : 0, st = state === 'launch' ? clamp((launchT / CFG.launchSecs - 0.3) / 0.5, 0, 1) : 0;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1 - 0.07 * f + 0.14 * st, 1 + 0.1 * f - 0.1 * st);
  ART.banana(ctx, 0, 0, 0, sc, flapAnim > 0 ? flapAnim : 0, time, wearFlags(), state === 'play' || state === 'dead' ? vy : 0, false, gazeS, state === 'play' && spinT > 0 ? spinPhase() : state === 'play' && celT > 0 ? (1 - celT / CFG.celSecs) * 6.2832 : -1, (state === 'dead' && pracEnd !== 'win') || hurtT > 0 ? 2 : state === 'play' && fallD > CFG.gritFall ? 4 : 0);   /* grit for bounces and hits, the rollercoaster 'oh face' for a long drop */ ctx.restore();
}
function zoomOn() { if (zoomK <= 1.001) return false; ctx.save(); ctx.translate(zoomX, GROUND_Y); ctx.scale(zoomK, zoomK); ctx.translate(-zoomX, -GROUND_Y); return true; }
function drawCount() {   // the big 3 - 2 - 1
  if (state !== 'launch' || launchT >= 0) return;
  var seg = CFG.countSecs / 3, n = Math.ceil(-launchT / seg), f = (-launchT - (n - 1) * seg) / seg, cols = ['#7be07b', '#ffd93b', '#ff6b81'];
  ctx.globalAlpha = clamp(1 - (1 - f) * 0.2, 0.6, 1); outlined(String(n), W / 2, 210, 120 * (1 + 0.5 * (1 - f) * (1 - f)), cols[n - 1] || '#fff', 'center', 180); ctx.globalAlpha = 1;
}
function rsgWord(t, x, y) {   // t seconds into Ready (0), Set (beat), Go (2 beats), drawn big in the middle; the same words are used by the mini game
  var b = CFG.rsgBeat, n = t < b ? 0 : t < 2 * b ? 1 : 2, f, a = 1, s;
  if (t < 0 || t > 2 * b + 0.55) return;
  f = n === 2 ? (t - 2 * b) / 0.55 : (t - n * b) / b; if (n === 2) a = clamp((1 - f) / 0.35, 0, 1);
  s = 1 + (n === 2 ? 0.35 : 0.5) * (1 - clamp(f * 2.2, 0, 1)) * (1 - clamp(f * 2.2, 0, 1));
  var base = n === 2 ? 108 : 72;   // GO! is the big moment: bigger than Ready and Set
  ctx.globalAlpha = a; outlined(['Ready', 'Set', 'GO!'][n], x, y, base * s, ['#ff6b81', '#ffd93b', '#7be07b'][n], 'center', base); ctx.globalAlpha = 1;
}
var HUDUP = 38;   // the progress pips, text and badges ride this much higher now that the big count sits at the very top
function drawProgress() {   // ten pips for the ten gates of the stage, then "n to go" and the record to beat
  var gps = gpsOf(stage), done = score - gateStart(stage), i, x0 = W / 2 - (gps - 1) * 7, rec = pracN ? 0 : runStartBest, t;
  for (i = 0; i < gps; i++) { ctx.beginPath(); ctx.arc(x0 + i * 14, 114, 4.2, 0, 7); ctx.fillStyle = i < done ? '#ffd93b' : 'rgba(255,255,255,0.35)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(); }
  var rp = rec - gateStart(stage);   // a little flag above the gate where the best run ended
  if (rp >= 1 && rp <= gps) { var fx0 = x0 + (rp - 1) * 14; ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(fx0, 99); ctx.lineTo(fx0, 109); ctx.stroke(); ctx.fillStyle = '#ff6b81'; ctx.beginPath(); ctx.moveTo(fx0, 99); ctx.lineTo(fx0 + 8, 102); ctx.lineTo(fx0, 105); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  t = pracN ? 'Practice  -  ' + (gps - done) + ' to go' : 'Stage ' + stage + '  -  ' + (gps - done) + ' to go';
  if (rec > 0) t += score > rec ? '  -  new best!' : '  -  best ' + rec;
  outlined(t, W / 2, 131, 14, rec > 0 && score > rec ? '#ffd93b' : '#ffffff');
  if (done + 1 < gps) { var t2 = pracN ? 'Practice  -  ' + (gps - done - 1) + ' to go' : 'Stage ' + stage + '  -  ' + (gps - done - 1) + ' to go'; if (rec > 0) t2 += score + 1 > rec ? '  -  new best!' : '  -  best ' + rec; txWarm(t2, 14, rec > 0 && score + 1 > rec ? '#ffd93b' : '#ffffff'); }   // the next gate's line is built a frame at a time while this one shows, so passing a gate costs nothing
}
var TESTFILE = false, labUsed = false;   // the tester build flips TESTFILE to true; its badge shows only once the Test Lab has changed something (labUsed). The player build never shows it
var XSHORT = { potassium: 'Potassium Power', practice: 'Practice Navy', wshield: 'Wafer shield', rope: 'Rope cutter', superleap: 'Super Leap' };
var XCHIP = { roomy: ['R', '#7be07b'], gentle: ['G', '#6ec6ff'], shield: ['B', '#ff6b81'], magnet: ['M', '#b45cff'], sweet: ['P', '#ffd93b'], dare: ['D', '#ff8a1f'], golden: ['$', '#f2b81f'], wind: ['W', '#4ad6c8'], potassium: ['K', '#ffe27a'], limes: ['L', '#9be84a'] };   // the letters of the small row shown while flying (Chimp's Navy extras only appear on the pause list)
function extrasList() {   // everything switched on for this run, as [text, color] lines for the pause list
  var L = [], i, u, l, t, sec = state === 'sky' || state === 'volc';   // the secret games use hearts and lime missiles, not bounces, second wind, challenges or fights
  for (i = 0; i < UPS.length; i++) {
    u = UPS[i]; l = lvl(u.id); if (!l || (sec && (u.id === 'shield' || u.id === 'wind'))) continue;
    t = (XSHORT[u.id] || u.name) + (u.costs.length > 1 ? ' ' + l : '');
    if (u.id === 'shield' && state !== 'mini') t += ' (' + shield + ' left)';
    if (u.id === 'wind' && state !== 'mini') t += windUsed ? ' (used)' : ' (ready)';
    if (u.id === 'limes') t += FT ? ' (' + FT.lm + ' left)' : '';
    L.push([t, '#ffffff']);
  }
  L.push(['Speed ' + spdPct() + '%', spdPct() === 100 ? '#cfe6ff' : '#ffd93b']);
  if (save.stats.plus > 0) L.push(['Victory bonus +' + Math.round((plusK() - 1) * 100) + '%', '#ffd93b']);
  if (runChal && !sec) for (i = 0; i < CHAL.length; i++) if (CHAL[i][0] === runChal) L.push(['Challenge: ' + CHAL[i][1], '#ff9ac0']);
  if (runFight && !sec) L.push(['Fight: ' + FIGHTS[runFight - 1][0], '#ff9ac0']);
  return L;
}
function drawExtrasCard() {   // the list on the pause screens, in two columns under the buttons
  var L = extrasList(), n = L.length, rows = Math.ceil(n / 2), y0 = 488, rh = Math.min(15, (H - 40 - y0) / rows), i, c, x, y;
  ctx.fillStyle = 'rgba(40,28,60,0.55)'; rrect(14, y0 - 32, W - 28, 24 + rows * rh + 12, 14); ctx.fill();
  outlined('What you have switched on', W / 2, y0 - 16, 14, '#ffd93b');
  for (i = 0; i < n; i++) { c = i < rows ? 0 : 1; x = c ? 190 : 28; y = y0 + 6 + (i - c * rows) * rh; outlined(L[i][0], x, y, 12, L[i][1], 'left'); }
  if (TESTFILE && labUsed) testBadge();
}
function testBadge() { ctx.globalAlpha = 0.9; ctx.lineWidth = 2; ctx.strokeStyle = INK; rrect(W - 92, H - 26, 84, 20, 8); ctx.fillStyle = '#e22a40'; ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1; outlined('TEST FILE', W - 50, H - 15, 12, '#ffffff'); }
function drawExtrasRow() {   // tiny badges while flying: a letter per upgrade, its level as pips, dim when spent
  var A = [], i, id, l, x, n, j, c, dim;
  for (id in XCHIP) { l = lvl(id); if (l) A.push(id); }
  var sp = spdPct() !== 100; n = A.length + (sp ? 1 : 0);
  if (n) {
    x = W / 2 - (n - 1) * 10; ctx.globalAlpha = 0.72;
    for (i = 0; i < A.length; i++, x += 20) {
      id = A[i]; l = lvl(id); c = XCHIP[id]; dim = (id === 'shield' && !shield) || (id === 'wind' && windUsed) || (id === 'limes' && FT && !FT.lm);
      ctx.globalAlpha = dim ? 0.3 : 0.78; ctx.lineWidth = 2; ctx.strokeStyle = INK; rrect(x - 8, 144, 16, 16, 5); ctx.fillStyle = c[1]; ctx.fill(); ctx.stroke();
      outlined(c[0], x, 153, 11, '#ffffff');
      for (j = 0; j < l; j++) { ctx.beginPath(); ctx.arc(x - (l - 1) * 2.5 + j * 5, 166, 2, 0, 7); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke(); }
    }
    if (sp) { ctx.globalAlpha = 0.78; outlined(spdPct() + '%', x, 153, 11, '#ffd93b'); }
    ctx.globalAlpha = 1;
  }
  if (TESTFILE && labUsed) testBadge();
}
function drawTaps() {   // a thin ring where a tap landed, so a tap is always seen: dim when the game could not use it yet
  for (var i = 0; i < tapFx.length; i++) { var q = tapFx[i], f = q.t / 0.4; ctx.globalAlpha = (q.ign ? 0.32 : 0.7) * (1 - f); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * (1 - f) + 1; ctx.beginPath(); ctx.arc(q.x, q.y, 8 + 26 * f, 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function drawResume() {   // the 3 - 2 - 1 after a pause
  var seg = RES_SECS / 3, n = Math.ceil(resT / seg), f = (resT - (n - 1) * seg) / seg, cols = ['#7be07b', '#ffd93b', '#ff6b81'];
  ctx.globalAlpha = clamp(1 - (1 - f) * 0.2, 0.6, 1); outlined(String(n), W / 2, 270, 120 * (1 + 0.4 * (1 - f) * (1 - f)), cols[n - 1] || '#fff', 'center', 180); ctx.globalAlpha = 1;
}
function drawRSG() { if (state === 'play' && rsgT >= 0) { if (rsgWait) tapWord(W / 2, 190); else rsgWord(rsgT - CFG.cardSecs, W / 2, 190); } }
function tapWord(x, y) { var p = 1 + 0.06 * Math.sin(time * 5); outlined('Tap to start!', x, y, 44 * p, '#ffd93b', 'center', 44); }
function drawWind() {
  if ((state !== 'play' && state !== 'launch') || !wind.length || ftStill >= 0.5) return;
  var i, w, k2 = clamp(curSpeed / 220, 0.4, 3), a = state === 'launch' ? clamp(0.18 + curSpeed / 1400, 0, 0.5) : clamp(0.16 + boost / 700, 0, 0.5);
  ctx.strokeStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
  for (i = 0; i < wind.length; i++) { w = wind[i]; ctx.moveTo(w.x, w.y); ctx.lineTo(w.x + w.l * k2 * 0.6, w.y); }
  ctx.stroke(); ctx.lineCap = 'butt';
}
var TRC1 = [], TRC2 = [];
(function () { for (var i = 0; i <= 24; i++) { TRC1.push('rgba(255,190,50,' + (i / 24 * 0.5).toFixed(3) + ')'); TRC2.push('rgba(255,255,230,' + (i / 24 * 0.85).toFixed(3) + ')'); } })();   // colour strings made once: nothing new for the garbage collector each frame
var BUNCH = null, BUNCH_S = 0.42;
function bunchDraw(g, s) {   // the Banana Bunch: a little brown rucksack with banana friends poking out of the top (origin: the middle of the pack)
  var i, bx0, by0, a, tipx, tipy;
  g.save(); g.scale(s, s); g.lineCap = 'round'; g.lineJoin = 'round';
  for (var j = 0; j < 3; j++) {   // three bananas packed tight, barely fanned (the outer two first, the middle one on top), behind the flap
    i = j === 0 ? 0 : j === 1 ? 2 : 1;
    a = (i - 1) * 0.2; bx0 = (i - 1) * 5.5; by0 = -12; tipx = bx0 + Math.sin(a) * 21 + (i - 1) * 1; tipy = by0 - Math.cos(a) * 21;
    g.beginPath(); g.moveTo(bx0, by0); g.quadraticCurveTo(bx0 + Math.sin(a) * 22 + (i - 1) * 2.5, by0 - Math.cos(a) * 14, tipx, tipy); g.strokeStyle = INK; g.lineWidth = 14; g.stroke(); g.strokeStyle = i === 1 ? '#ffdf4a' : '#f6cd33'; g.lineWidth = 10; g.stroke();
    g.fillStyle = '#5a3a14'; g.beginPath(); g.arc(tipx, tipy, 3.2, 0, 6.2832); g.fill();
    g.fillStyle = INK; g.beginPath(); g.arc(bx0 + Math.sin(a) * 12 - 2.6, by0 - Math.cos(a) * 12, 1.5, 0, 6.2832); g.arc(bx0 + Math.sin(a) * 12 + 2.6, by0 - Math.cos(a) * 12, 1.5, 0, 6.2832); g.fill();
  }
  g.fillStyle = '#b06a2e'; g.beginPath(); g.roundRect(-18, -14, 36, 40, 9); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();   // the pack
  g.fillStyle = '#c98a45'; g.beginPath(); g.roundRect(-13, 6, 26, 15, 5); g.fill(); g.lineWidth = 2.2; g.stroke();   // the front pocket
  g.fillStyle = '#8a4e20'; g.beginPath(); g.roundRect(-18, -14, 36, 17, 8); g.fill(); g.lineWidth = 3; g.stroke();   // the flap
  g.fillStyle = '#ffd93b'; g.beginPath(); g.roundRect(-4, -3, 8, 8, 2); g.fill(); g.lineWidth = 1.8; g.stroke();   // the buckle
  g.strokeStyle = 'rgba(255,230,170,.55)'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(-14, -9); g.lineTo(14, -9); g.stroke(); g.setLineDash([]);   // stitching
  g.restore();
}
function bunchPic() { if (!BUNCH || BUNCH.kk !== k) { var c = document.createElement('canvas'), g; c.width = Math.round(60 * BUNCH_S * k); c.height = Math.round(80 * BUNCH_S * k); g = c.getContext('2d', CRF); g.scale(k, k); g.translate(30 * BUNCH_S, 46 * BUNCH_S); bunchDraw(g, BUNCH_S); c.kk = k; BUNCH = c; } return BUNCH; }
function rollNow() { return state === 'play' && spinT > 0 ? spinPhase() : state === 'play' && celT > 0 ? (1 - celT / CFG.celSecs) * 6.2832 : -1; }   // Fancy's roll about his long axis (the football spiral and the win roll), or -1
function drawBuddies(ey, pass) { var sw = clamp(-vy / 3000, -0.2, 0.2) + Math.sin(time * 3.2) * 0.04, ph = rollNow(), c = ph >= 0 ? Math.cos(ph) : 1; if ((ph >= 0 && Math.sin(ph) > 0 ? 1 : 0) !== pass) return; ctx.save(); ctx.translate(bx, by + ey); ctx.rotate(angle); ctx.translate(-30, -4); if (ph >= 0) ctx.scale(1, Math.abs(c) < 0.04 ? 0.04 : c); ctx.rotate(-0.3 + sw); ctx.drawImage(bunchPic(), -30 * BUNCH_S, -46 * BUNCH_S, 60 * BUNCH_S, 80 * BUNCH_S); ctx.restore(); }   // worn like a rucksack on his back; in a roll the whole pack turns about Fancy's long axis with him (squashing edge-on, flipping over, passing behind and in front of his body)
function bunchStrap(ey) { var ph = rollNow(), c = ph >= 0 ? Math.cos(ph) : 1; if (c < 0.05) return; ctx.save(); ctx.translate(bx, by + ey); ctx.rotate(angle); if (ph >= 0) { ctx.translate(0, -5); ctx.scale(1, c); ctx.translate(0, 5); } ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-19, -9); ctx.quadraticCurveTo(-9, 3, -13, 13); ctx.strokeStyle = INK; ctx.lineWidth = 3.8; ctx.stroke(); ctx.strokeStyle = '#8a4e20'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }   // the strap across his middle (it goes round the back of the body for half of a roll)
function drawTrail() {
  var n = trail.length, i, p, q, a, pw = state === 'launch' ? clamp((launchT / CFG.launchSecs - 0.12) / 0.4, 0, 1) : state === 'play' ? 0.25 + 0.75 * clamp(boost / CFG.boostV + kCh, 0, 1) : 0, qa;
  if (n < 2 || pw <= 0) return;
  ctx.lineCap = 'round'; var rb = rainOn();
  for (i = 1; i < n; i++) {
    p = trail[i - 1]; q = trail[i]; a = 1 - q.t / 0.5; if (a <= 0) continue;
    qa = Math.round(a * pw * 24);
    ctx.strokeStyle = rb ? RB[(i * 2 + Math.floor(time * 30)) % 36] : TRC1[qa]; ctx.lineWidth = 4 + a * 22 * pw; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.strokeStyle = TRC2[qa]; ctx.lineWidth = 2 + a * 8 * pw; ctx.stroke();
  }
  ctx.lineCap = 'butt'; drawEmpTrail(pw);
}
function drawCoins() {
  var i, j, o, c, x;
  drawVaultFront();
  for (i = 0; i < obs.length; i++) { o = obs[i]; if (o.fr && !o.fr.got) { x = o.x + o.fr.dx; if (x > -30 && x < W + 30) { c = o.fr.y + Math.sin(time * 3 + o.fr.i) * 4; ART.friend(ctx, x, c, Math.sin(time * 2 + o.fr.i) * 0.14, 0.62, FR_V[o.fr.i]); ctx.fillStyle = '#fffbe0'; ctx.fillRect(x + 14 + Math.sin(time * 7) * 4, c - 16, 2, 8); ctx.fillRect(x + 11 + Math.sin(time * 7) * 4, c - 13, 8, 2); } } for (j = 0; j < o.coins.length; j++) { c = o.coins[j]; x = o.x + c.dx; if (!c.got && x > -20 && x < W + 20) ART.coin(ctx, x, c.y + Math.sin(time * 3 + c.ph * 2) * 2.5, time + c.ph); } }
}
function drawPops() {
  for (var i = 0; i < pops.length; i++) { var q = pops[i], sc = q.t < 0.12 ? 0.6 + q.t / 0.12 * 0.4 : 1; ctx.globalAlpha = clamp((1.1 - q.t) / 0.35, 0, 1); outlined(q.txt, q.x, q.y, q.sz * sc, q.col, 'center', q.sz); }
  ctx.globalAlpha = 1;
}
function drawLife() { if (BAL || ftStill >= 0.5) return; ART.life(ctx, shownTheme(), time, dist); }
/* Confetti: each colour is drawn once as a dot and four star turns, then only stamped (no per-piece save / rotate / path work). */
var FXS = {}, FXR = 6;
function fxPics(col) {
  var p = FXS[col]; if (p) return p; var kk = k > 0 ? k : 1, n = Math.ceil(FXR * 2 * kk) + 2, c, g2, r, i, s;
  p = FXS[col] = { dot: null, st: [] };
  c = document.createElement('canvas'); c.width = c.height = n; g2 = c.getContext('2d', CRF); g2.fillStyle = col; g2.beginPath(); g2.arc(n / 2, n / 2, FXR * kk, 0, 7); g2.fill(); p.dot = c;
  for (i = 0; i < 4; i++) {
    c = document.createElement('canvas'); c.width = c.height = n; g2 = c.getContext('2d', CRF); g2.translate(n / 2, n / 2); g2.rotate(i * Math.PI / 8); g2.fillStyle = col; s = FXR * kk;
    g2.fillRect(-s, -s * 0.45, s * 2, s * 0.9); g2.fillRect(-s * 0.45, -s, s * 0.9, s * 2); p.st.push(c);
  }
  return p;
}
function drawFx() {
  var i, q, a, p, d, kk = k > 0 ? k : 1, ph;
  drawSmoke();
  for (i = 0; i < fx.length; i++) {
    q = fx[i]; a = 1 - q.t / q.l; ctx.globalAlpha = a < 0.35 ? a / 0.35 : 1; p = fxPics(q.c); d = q.s * 2 * (FXR * 2 + 2 / kk) / (FXR * 2);
    ph = q.st ? p.st[((q.t * 9 / (Math.PI / 8)) | 0) & 3] : p.dot;   // a plus sign turns 90 degrees onto itself: four poses are a full spin
    ctx.drawImage(ph, Math.round((q.x - d / 2) * kk) / kk, Math.round((q.y - d / 2) * kk) / kk, d, d);
  }
  ctx.globalAlpha = 1;
}
function drawSpeedLines() {
  var s = state === 'launch' ? clamp((launchT / CFG.launchSecs - 0.25) / 0.5, 0, 1) : state === 'play' ? clamp(boost / CFG.boostV, 0, 1) : 0, i, x, y;
  if (s <= 0) return;
  ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 * s).toFixed(2) + ')'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath();
  for (i = 0; i < 11; i++) { x = bx - 26 - ((time * 1300 + i * 83) % 190); y = by + (i - 5) * 11 + Math.sin(i * 2.3) * 4; ctx.moveTo(x, y); ctx.lineTo(x - 22 - (i % 3) * 10, y); }
  ctx.stroke(); ctx.lineCap = 'butt';
}
function drawShield() {
  if (shield <= 0 || (state !== 'play' && state !== 'launch')) return;
  for (var i = 0; i < shield; i++) { ctx.beginPath(); ctx.arc(bx, by, 24 + i * 4, 0, 7); ctx.fillStyle = 'rgba(150,235,170,0.18)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(80,190,110,0.95)'; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(bx, by, 20, Math.PI * 1.15, Math.PI * 1.6); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
}
function txWarm(text, size, fill, chars) { var i; if (chars) { for (i = 0; i < text.length; i++) textPic(text.charAt(i), size, fill, true); } else textPic(text, size, fill, true); }   // ask for a picture of text ahead of time (built one per frame, nothing is drawn)
function cardWarm() {   // queue (lazily, one per frame) every picture of text the 'stage clear' card is about to need
  var nx = themeOf(stage + 1);
  txWarm('Stage ' + stage + ' clear!', 30, '#ffd93b', true); txWarm(CFG.friendsPerStage + ' banana friends escaped!', 17, '#ffffff');
  txWarm('Bonus: Chimp\'s Navy!', 17, '#ffd93b'); txWarm('Bonus: Balloon Party!', 17, '#ffd93b'); txWarm('Next: ' + ART.names[nx], 17, '#ffd93b');
  txWarm('Ready', 72, '#ff6b81'); txWarm('Set', 72, '#ffd93b'); txWarm('GO!', 108, '#7be07b');   // the Ready, Set, GO words that follow the card
  ['#ffd93b', '#ff6b81', '#7ad8ff', '#8ae28a', '#ffffff', '#7be07b'].forEach(fxPics);   // and the confetti colors of the stage bonus burst
}
function stageCard() {
  var t = cardT, a = clamp(Math.min(t / 0.3, (CFG.cardSecs - t) / 0.3), 0, 1), e = a * a * (3 - 2 * a);
  var dx = (t < CFG.cardSecs / 2 ? 1 : -1) * (1 - e) * 400, y = cardY, i;   // slides in from the right, leaves to the left
  ctx.save(); ctx.translate(dx, 0);
  ctx.lineWidth = 3; ctx.strokeStyle = INK; rrect(30, y, 300, 200, 22); fs('rgba(255,252,240,0.94)');
  outlinedC('Stage ' + cardStage + ' clear!', W / 2, y + 36, 30, '#ffd93b');
  for (i = 0; i < CFG.friendsPerStage; i++) ART.friend(ctx, 62 + i * 59, y + 84 - Math.abs(Math.sin(time * 6 + i * 1.3)) * 8, (i - 2) * 0.14, 0.85, i);
  outlined(CFG.friendsPerStage + ' banana friends escaped!', W / 2, y + 128, 17, '#ffffff');
  ART.chimp(ctx, 62, y + 168, 0.42, 1, time);
  var bk = !pendNext && stage === backStage && !pracN;
  if (bk) { ctx.save(); ctx.translate(205, y + 150); ctx.rotate(Math.sin(time * 5) * 0.04); outlined('Whoa! It flips backward!', 0, 0, 15, '#ff9ad0'); ctx.restore(); }
  outlined(pendNext === 'mini' ? 'Bonus: Chimp\'s Navy!' : pendNext === 'balloons' ? (balNight ? 'Bonus: Night Balloon Party!' : 'Bonus: Balloon Party!') : 'Next: ' + ART.names[themeOf(stage)], 205, y + (bk ? 176 : 170), 17, '#ffd93b');
  ctx.restore();
}
function pracCard(da) {   // a practiced stage ended
  var win = pracEnd === 'win'; ctx.globalAlpha = da; ctx.fillStyle = 'rgba(58,42,77,0.3)'; ctx.fillRect(0, 0, W, H);
  cardFrame(40, 156, 280, 300, win ? '#58c46f' : '#4a9bd8', win ? 'Stage cleared!' : 'Bonk!', 30); ctx.globalAlpha = da;
  if (win) outlined('Great flying!', W / 2, 244, 22, '#ffd93b'); else { ART.chimp(ctx, 256, 240, 0.52, 0, time); outlined('So close!', 128, 228, 22, '#ffd93b'); outlined('Try it again!', 128, 256, 16, '#ffffff'); }
  outlined('Practice: no prizes this time', W / 2, win ? 276 : 280, 14, '#ffffff');
  ctx.globalAlpha = deadT >= CFG.retryDelay ? da : 0.4; mgBtn(MG_BA, 'Try again!', '#58c46f'); mgBtn(MG_BT, 'Back to title', '#8a6cd8'); outlined(padOn ? 'A: again   B: title' : 'Space: again   Esc: title', W / 2, 424, 13, '#ffffff'); ctx.globalAlpha = 1;
}
var DOFF = 38, DC_A = [48, 340, 264, 48], DC_B = [48, 402, 264, 56];   // the Oops card's two buttons: try again, and pay to keep going
function contCan() { return state === 'dead' && !pracN && stage > 1 && deadT >= CFG.retryDelay; }
function payContinue() {   // pay the fee and start the stage that was lost again (the run carries on from there)
  if (!contCan()) return false;
  if (bal() < CFG.contCost) { toast('Keeping on going costs ' + CFG.contCost + ' banana credits. You have ' + bal() + '. Free friends and grab golden coins!', 3500); return false; }
  save.boosts.spent = (save.boosts.spent || 0) + CFG.contCost; var n = stage, bsv = backStage, dsc = score; contN = n; persist(); toReady(); contRun = true; gatesCounted = dsc; backStage = bsv; flipV = flipWant(); toast('Paid ' + CFG.contCost + ' credits. Back at stage ' + n + ': tap to launch!', 3500); return true;
}
function deadCard(da) {
  if (pracN) { pracCard(da); return; }
  var ok = deadT >= CFG.retryDelay, cr = bal(), can = stage > 1, aff = cr >= CFG.contCost, ya = ok ? da : 0.35;
  ctx.globalAlpha = da; ctx.fillStyle = 'rgba(58,42,77,0.34)'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(0, DOFF + (1 - da) * 26);   // the card sits below the buttons at the top right
  cardFrame(24, 96, 312, can ? 400 : 330, '#ff6b81', 'Oh no! Bonk!', 30); ctx.globalAlpha = da;
  ART.chimp(ctx, 266, 226, 0.7, 0, time);
  outlined('Gates you flew through', 118, 176, 14, '#ffffff'); outlinedC(String(score), 118, 220, 52, '#ffd93b');
  outlinedC(newBest ? 'New best!' : 'Your best: ' + save.best, 118, 262, newBest ? 22 : 16, newBest ? '#ffd93b' : '#ffffff');
  [['flag', 'Stage ' + stage], ['coin', '+' + runCoins], ['friend', String(save.stats.friends)]].forEach(function (c, i) { var x = 40 + i * 96; ctx.fillStyle = 'rgba(58,42,77,.13)'; rrect(x, 292, 88, 34, 14); ctx.fill(); drawIcon(c[0], x + 17, 309, .9); outlinedC(c[1], x + 63, 310, 14, '#ffffff'); });
  ctx.globalAlpha = ya; mgBtn(can ? DC_A : [DC_A[0], 346, DC_A[2], 52], 'Try again!', '#58c46f');
  if (can) mgBtn(DC_B, 'Keep going!', '#f5a31a', aff ? 'Back to stage ' + stage + ' for ' + CFG.contCost + ' credits' : 'Need ' + CFG.contCost + ' credits (you have ' + cr + ')', !aff);
  outlined(padOn ? 'A: try again' + (can ? '   Y: keep going' : '') : 'Space: try again' + (can ? '   C: keep going' : ''), W / 2, can ? 478 : 424, 12.5, '#ffffff'); ctx.restore(); ctx.globalAlpha = 1;
}


/* ---------- the title: glossy, extruded letters (cream sticker edge, deep side) that swoop in one by one, then Fancy zooms in beside them ---------- */
function easeOutBounce(x) { var n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + .75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + .9375; return n * (x -= 2.625 / d) * x + .984375; }
function easeOutBack(x) { var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
function letterPics() {
  if (TTL && TTLK === k) return TTL;
  var lines = [{ t: 'Fancy,', size: 54, x: 150, y: 168, face: ['#ffc21f', '#f2a10a', '#d17f06'], side: '#ffe680' }, { t: 'the Banana', size: 38, x: 150, y: 228, face: ['#ff8a80', '#f0483f', '#c81e36'], side: '#7a1224' }], out = [], kk = k, c0 = document.createElement('canvas').getContext('2d'), li, ln, i, n = 0, wd, sz, px, pad, w, h, c, g2, dep, d, pass, xs, edge, m, o, gap, word;
  for (li = 0; li < lines.length; li++) {
    ln = lines[li]; sz = ln.size;
    for (pass = 0; pass < 2; pass++) {   // lay the letters out by their painted shapes, not their font boxes: the same small gap between every pair of faces (the sticker edges still merge into one outline), the same wider gap between words; if the line is too wide, shrink it once and lay it out again
      c0.font = '800 ' + sz + 'px ' + FONT; gap = sz * TTG; xs = []; edge = 0; word = false;
      for (i = 0; i < ln.t.length; i++) {
        if (ln.t[i] === ' ') { word = true; continue; }
        m = c0.measureText(ln.t[i]); o = i === 0 ? 0 : edge + (word ? sz * .3 : gap) + m.actualBoundingBoxLeft; xs[i] = o; edge = o + m.actualBoundingBoxRight; word = false;
      }
      wd = edge; if (wd > 198 && pass === 0) sz = Math.floor(sz * 198 / wd); else break;
    }
    for (i = 0; i < ln.t.length; i++) {
      if (ln.t[i] === ' ') continue;
      px = xs[i]; w = c0.measureText(ln.t[i]).width; pad = Math.ceil(sz * .3); dep = Math.max(3, Math.round(sz * .1)); h = Math.ceil(sz * 1.3) + pad * 2 + dep;
      var cw = Math.ceil((w + pad * 2) * kk), ch = Math.ceil(h * kk), cy = pad + sz * .65, cf = document.createElement('canvas'), cd = document.createElement('canvas'), gf, gd;
      c = document.createElement('canvas'); c.width = cf.width = cd.width = cw; c.height = cf.height = cd.height = ch; g2 = c.getContext('2d', CRF); gf = cf.getContext('2d', CRF); gd = cd.getContext('2d', CRF);
      g2.scale(kk, kk); gf.scale(kk, kk); gd.scale(kk, kk); g2.font = gf.font = gd.font = '800 ' + sz + 'px ' + FONT; g2.textBaseline = gf.textBaseline = gd.textBaseline = 'middle'; g2.textAlign = gf.textAlign = gd.textAlign = 'left'; g2.lineJoin = gf.lineJoin = gd.lineJoin = 'round';
      for (d = dep; d >= 1; d--) { gd.lineWidth = sz * .23; gd.strokeStyle = d > dep - 1 ? INK : ln.side; gd.strokeText(ln.t[i], pad, cy + d); gd.fillStyle = ln.side; gd.fillText(ln.t[i], pad, cy + d); }   // cd: the deep side (with its dark bottom line)
      g2.lineWidth = sz * .23; g2.strokeStyle = '#fff6df'; g2.strokeText(ln.t[i], pad, cy);                                    // c: the cream sticker edge. Drawn in three passes for the whole word (all deep sides, then all edges, then all faces) so a neighbor's edge never cuts a notch in another letter's side
      var gr = gf.createLinearGradient(0, cy - sz * .5, 0, cy + sz * .5); gr.addColorStop(0, ln.face[0]); gr.addColorStop(.5, ln.face[1]); gr.addColorStop(1, ln.face[2]);
      gf.fillStyle = gr; gf.fillText(ln.t[i], pad, cy);
      gf.globalCompositeOperation = 'source-atop'; gf.fillStyle = 'rgba(255,255,255,.34)'; gf.fillRect(0, cy - sz * .56, w + pad * 2, sz * .3); gf.globalCompositeOperation = 'source-over';   // cf: the face, with gloss across the top (only on what is painted)
      out.push({ d: cd, c: c, f: cf, x: ln.x + px - pad, y: ln.y - cy, w: c.width / kk, h: c.height / kk, i: n++, ch: ln.t[i] });
    }
  }
  TTLK = k; TTL = out; return out;
}
var TTG = 0.05;   // the gap between neighboring letter faces on the title, as a share of the type size
var LDIR = [[-1, 0], [1, 0], [0, -1], [0, 1]];
var TWB = null;   // the finished title word (letters, shadow, the lean) baked into one picture: 30 rotated stamps and a gradient every frame for a word that no longer moves
function drawTitleWord() {
  if (titleT > 2.3) {
    var L0 = letterPics();
    if (L0.length && (!TWB || TWB.k !== k || TWB.L !== L0)) {
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, i, q, c, g2, old = ctx, ok;
      for (i = 0; i < L0.length; i++) { q = L0[i]; x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x + q.w); y1 = Math.max(y1, q.y + q.h); }
      x0 = Math.floor(Math.min(x0, 134) - 30); y0 = Math.floor(Math.min(y0, 232) - 30); x1 = Math.ceil(Math.max(x1, 358) + 30); y1 = Math.ceil(Math.max(y1, 270) + 30);
      c = document.createElement('canvas'); c.width = Math.ceil((x1 - x0) * k); c.height = Math.ceil((y1 - y0) * k); g2 = c.getContext('2d', CRF);
      if (g2) { g2.setTransform(k, 0, 0, k, -x0 * k, -y0 * k); ctx = g2; try { ok = titleWordLive(); } finally { ctx = old; } TWB = ok ? { c: c, x: x0, y: y0, w: x1 - x0, h: y1 - y0, k: k, L: L0 } : null; }
    }
    if (TWB && TWB.k === k && TWB.L === L0) { ctx.drawImage(TWB.c, TWB.x, TWB.y, TWB.w, TWB.h); return true; }
  }
  return titleWordLive();
}
function titleWordLive() {
  var L = letterPics(), i, q, t, u, e, dx, dy, rot, sx, sy, dir, n = L.length, landed = 0, cxp, cyp, sh;
  ctx.save(); ctx.translate(150, 236); ctx.rotate(-0.035); ctx.translate(-150, -236);   // the whole word leans -2 degrees from its lower left, like a sticker slapped on slightly crooked
  if (n) { sh = ctx.createRadialGradient(246, 252, 4, 246, 252, 112); sh.addColorStop(0, 'rgba(40,24,60,.38)'); sh.addColorStop(1, 'rgba(40,24,60,0)'); ctx.save(); ctx.globalAlpha = clamp((titleT - 0.5) / 1.5, 0, 1); ctx.translate(246, 252); ctx.scale(1, .16); ctx.translate(-246, -252); ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(246, 252, 112, 0, 7); ctx.fill(); ctx.restore(); }   // a soft ground shadow under the word (the extruded sides give the hard edge)
  for (i = 0; i < n; i++) { q = L[i]; if (clamp((titleT - 0.12 - i * 0.075) / 0.8, 0, 1) >= 1) { landed++; put0(q.d, q.x, q.y, q.w, q.h); } }   // landed letters: every deep side first...
  for (i = 0; i < n; i++) { q = L[i]; if (clamp((titleT - 0.12 - i * 0.075) / 0.8, 0, 1) >= 1) put0(q.c, q.x, q.y, q.w, q.h); }   // ...then every sticker edge, so neighbors merge into one outline that covers the sides evenly...
  for (i = 0; i < n; i++) { q = L[i]; if (clamp((titleT - 0.12 - i * 0.075) / 0.8, 0, 1) >= 1) put0(q.f, q.x, q.y, q.w, q.h); }   // ...then every face on top
  for (i = 0; i < n; i++) {
    q = L[i]; t = titleT - 0.12 - i * 0.075; u = clamp(t / 0.8, 0, 1); if (t < 0 || u >= 1) continue;
    dir = LDIR[i % 4]; e = easeOutBounce(u); var f = 1 - e;
    dx = dir[0] * 330 * f + (dir[0] ? 0 : (i % 8 < 4 ? -40 : 40) * f); dy = dir[1] * 420 * f; rot = ((i % 2) ? 1 : -1) * 2.4 * f; sx = 1 + .9 * f; sy = Math.max(.12, Math.cos(f * 1.35));
    cxp = q.x + q.w / 2 + dx; cyp = q.y + q.h / 2 + dy;
    ctx.save(); ctx.translate(cxp, cyp); ctx.rotate(rot); ctx.scale(sx, sy); ctx.drawImage(q.d, -q.w / 2, -q.h / 2, q.w, q.h); ctx.drawImage(q.c, -q.w / 2, -q.h / 2, q.w, q.h); ctx.drawImage(q.f, -q.w / 2, -q.h / 2, q.w, q.h); ctx.restore();
  }
  ctx.restore();
  return landed === n && n > 0;
}
function put0(c, x, y, w, h) { ctx.drawImage(c, Math.round(x * k) / k, Math.round(y * k) / k, w, h); }
function titleFancyIn() { return clamp((titleT - 2.05) / 0.6, 0, 1); }

function drawTapIcon(x, y) {   // a little 'tap' badge: a fingertip dot with two ripples (drawn once, then stamped)
  var kk = k > 0 ? k : 1;
  if (!tapPic || tapPic.k !== kk) {
    var c = document.createElement('canvas'), g2; c.width = c.height = Math.ceil(26 * kk); g2 = c.getContext('2d', CRF); g2.scale(kk, kk); g2.translate(13, 13); g2.lineJoin = 'round';
    g2.lineWidth = 4.2; g2.strokeStyle = INK; g2.beginPath(); g2.arc(0, 0, 10.4, 0, 7); g2.stroke(); g2.beginPath(); g2.arc(0, 0, 4.9, 0, 7); g2.stroke();
    g2.lineWidth = 2; g2.strokeStyle = '#7ad8ff'; g2.beginPath(); g2.arc(0, 0, 10.4, 0, 7); g2.stroke();
    g2.beginPath(); g2.arc(0, 0, 4.9, 0, 7); g2.fillStyle = '#ffd93b'; g2.fill(); g2.strokeStyle = INK; g2.lineWidth = 1.8; g2.stroke();
    tapPic = { c: c, k: kk };
  }
  ctx.drawImage(tapPic.c, Math.round((x - 13) * kk) / kk, Math.round((y - 13) * kk) / kk, tapPic.c.width / kk, tapPic.c.height / kk);
}
var PR = null, prT = 0;
function lap(n) { if (PR) { var t = performance.now(); PR[n] = (PR[n] || 0) + t - prT; prT = t; } }   // test-only section timer: costs one test per call when off
var PBR = 16;   // pause button radius (bigger with Large buttons)
function PBH() { return PBR + (WIDE ? 22 : 8); }   // how far from its middle a tap still counts as the pause button (more sideways, where the picture is small)
function drawPauseBtn(b, a) { var f = PBR / 16; twinAdd(b[0] - PBH(), b[1] - PBH(), 2 * PBH(), 2 * PBH(), (state === 'paused' || (MG && MG.paused) || (SKY && SKY.paused) || (VOLC && VOLC.paused)) ? 'Resume' : 'Pause', 0); ctx.beginPath(); ctx.arc(b[0], b[1], PBR, 0, 7); ctx.fillStyle = 'rgba(30,20,50,' + a + ')'; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4; ctx.stroke(); ctx.fillStyle = '#ffffff'; rrect(b[0] - 6.5 * f, b[1] - 7 * f, 4.4 * f, 14 * f, 1.6); ctx.fill(); rrect(b[0] + 2.1 * f, b[1] - 7 * f, 4.4 * f, 14 * f, 1.6); ctx.fill(); }
function blinkOff() { return invuln > 0 && spinT <= 0 && !calmOn() && Math.floor(time * 14) % 2; }   // after a bump Fancy blinks (Calm mode: steady and a little see-through instead)
var barTk = false, VCLIP = false;
function render() {
  twinSync(); TWL.length = 0; if (lbWant() !== LBT) lbApply();
  var tk = state === 'title' && !opt('noticker'); if (tk !== barTk) { barTk = tk; bar.classList.toggle('tk', tk); }   // the buttons on the title screen sit below the news ticker
  TXF++; if (PR) prT = performance.now(); if (TKS && state !== 'title') TKS = null; if (CFC.length && TXF - CFC[CFC.length - 1].f > 120) { CFC = []; CFP = ''; }   // the news strip is a big picture only the title screen uses
  ctx.setTransform(k, 0, 0, k, 0, 0); ctx.globalAlpha = 1;
  var cw = (FBforce ? FBforce === 'css' : FBff) && flipSX() === -1; if (cw !== cssF || LAYERD) { cssF = cw; LAYERD = false; cv.style.transform = (LAYER === 'z' ? 'translateZ(0)' : '') + (cw ? ' scaleX(-1)' : ''); cv.style.willChange = LAYER === 'wc' ? 'transform' : ''; }
  if (state === 'mini' && MG) { bkHide(); renderMini(); return; }
  if (state === 'sky' && SKY) { bkHide(); renderSky(); return; }
  if (state === 'volc' && VOLC) { bkHide(); renderVolc(); return; }
  if (state === 'home' && HOME) { bkHide(); renderHome(); return; }
  var i, pe = punchT > 0 && !calmOn() ? punchT / CFG.punchSecs : 0;
  if (pe > 0) { var sh = pe * pe * 6 * Math.sin(time * 90); ctx.save(); ctx.translate(Math.round(sh * k) / k, Math.round(sh * 0.6 * k) / k); }   // camera shake at the blast off: a plain slide (a zoom would re-scale every picture on screen, which stalled Firefox and phones)
  var mir = mirOn(); if (mir) { ctx.save(); ctx.translate(0, H); ctx.scale(1, -1); }
  var ex = state === 'play' && !trackOn && !mir && curSpeed > 0 ? Math.min(curSpeed * acc, 30) : 0, ey = state === 'play' && !trackOn && !BAL && !FT ? clamp(vy * acc, -6, 6) : 0;   // the world is drawn where it will be at the moment the picture is shown: physics runs in fixed 1/120 s steps, so without this the scenery would jump by one, two or three steps from picture to picture
  if (ex) dist += ex;
  var fl1 = flipOff(), fl2 = false;   // the backward level: the scenery, the gates and the coins are drawn turned round...
  VCLIP = state === 'victory' && vicT >= 0.55 && !pe && !mir;   // once the victory card has finished opening it covers most of the screen: the scene, the dim and the sunburst are only drawn outside it (the card's dark outline hides the join)
  if (VCLIP) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.roundRect(17, 19, 326, 416, 23); ctx.clip('evenodd'); }
  drawBack(); lap('back'); drawLife(); lap('life'); drawWind(); lap('wind');
  drawVaultBack();
  if (ex) for (i = 0; i < obs.length; i++) obs[i].x -= ex;
  for (i = 0; i < obs.length; i++) { if (obs[i].smash) { var sa = 1 - (time - obs[i].smash) / 0.3; if (sa > 0) { ctx.globalAlpha = sa; ART.obstacle(ctx, obs[i]); ctx.globalAlpha = 1; } continue; } ART.obstacle(ctx, obs[i]); if (obs[i].gold && !obs[i].passed) drawGold(obs[i]); if (obs[i].waf) drawWafer(obs[i]); }
  if (BAL || shd.length) drawBalloons(); if (FT && FT.ph !== 'wait') drawFight();
  lap('obstacles'); drawCoins(); lap('coins'); if (ex) for (i = 0; i < obs.length; i++) obs[i].x += ex;
  var zm = zoomOn();
  if (state === 'ready' || state === 'launch' || (state === 'play' && trackOn)) ART.track(ctx, trackX, calmOn() ? time * 0.15 : time, state === 'launch' ? Math.max(0, launchT) / CFG.launchSecs : 0, bgTheme, state === 'ready');
  if (zm) ctx.restore();
  lap('track'); drawGround(); lap('ground'); if (fl1) flipBlit(); if (ex) dist -= ex;
  if (bgT < 1) { ctx.globalAlpha = Math.min(calmOn() ? 0.4 : 0.92, (bgT < 0.5 ? bgT : 1 - bgT) * 2.6); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }   // the fade through white washes the scene only: the card, Fancy and the confetti stay clear
  if (ftStill > 0 && ftStill < 1) { ctx.globalAlpha = Math.min(calmOn() ? 0.4 : 0.92, (ftStill < 0.5 ? ftStill : 1 - ftStill) * 2.6); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }   // the arena fades in through white, like a new stage
  if (state === 'title' && empOn() && titleFancyIn() >= 1) drawHomeDoor();
  if (state === 'title') { var fi = titleFancyIn(); if (fi > 0) { var fz = 1 + 2.6 * (1 - easeOutBack(fi)); ctx.globalAlpha = clamp(fi * 3, 0, 1); drawFancy(62 + 14 * easeOutBack(fi), 204 + TOFF + Math.sin(time * 4) * 6, -0.1 + Math.sin(time * 4) * 0.05 - (1 - fi) * 0.9 + Math.sin(time * 45) * 0.2 * museW, 1.25 * Math.max(.2, fz)); ctx.globalAlpha = 1; } }
  else {
    if (cardT >= 0 && state === 'play') { if (mir) { ctx.save(); ctx.translate(0, H); ctx.scale(1, -1); } hudM(1); stageCard(); hudM(0); if (mir) ctx.restore(); lap('card'); }   // drawn before Fancy, so Fancy always stays in view
    fl2 = flipB();   // ...and so are Fancy, his trail and the sparkles (the stage card, the counters and every word are not)
    zm = zoomOn(); drawTrail(); if ((state === 'play' || state === 'paused') && flagsOn()) drawFlags(); if ((state === 'play' || state === 'paused') && bunchOn()) drawBuddies(ey, 0); lap('trail'); drawSpeedLines(); lap('speedlines');
    if (kEcho.length && !zm) kEchoes();
    if (!zm && !blinkOff()) { if (calmOn() && invuln > 0 && spinT <= 0) ctx.globalAlpha = 0.6; drawFancy(bx, by + ey, angle, 1); if ((state === 'play' || state === 'paused') && bunchOn()) { drawBuddies(ey, 1); bunchStrap(ey); } ctx.globalAlpha = 1; if (kCh > 0.02 && state === 'play') kRing(ey); if (sKch > 0.02 && state === 'play') drawSuperK(ey); else if (sKarm && kHoldT > 0.12 && state === 'play' && sKused !== stage && empOwn(E.superK)) drawSuperK(ey, kHoldT / 0.55); }
    lap('fancy'); drawShield();
    if (zm) { ctx.restore(); if (!blinkOff()) drawFancy(zoomX + (bx - zoomX) * zoomK, GROUND_Y + (by - GROUND_Y) * zoomK, angle, 1); }   // in the swoop-in Fancy follows the zoomed track but is stamped at his normal size (a scaled stamp was the costly one)
  }
  zm = zoomOn(); if (state !== 'victory') drawFx(); if (zm) ctx.restore();   // (the victory card draws the confetti itself, on top of the card)
  if (fl2) ctx.restore();
  if (mir) ctx.restore();
  hudM(1);
  if (nightA > 0.01) drawNight();
  lap('fx'); drawHug(); drawPops(); drawCount(); drawRSG(); drawTaps(); lap('pops');
  if (state === 'gift') drawGift(); else if (state === 'play') { if (BAL) balIntro(); if (FT) ftCards(); if (BALR && rsgT >= 0 && rsgT < CFG.cardSecs) balResultCard(); }
  if (whooshT > 0) { ctx.globalAlpha = clamp(whooshT / 0.5, 0, 1); outlined('WHOOSH!', 190, mirY(by) - 52 - (0.9 - whooshT) * 40, 34, '#ffd93b'); ctx.globalAlpha = 1; }
  hudM(0); if (pe > 0) ctx.restore(); hudM(1);
  if (flashT > 0) { ctx.globalAlpha = 0.6 * flashT / 0.25; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (state === 'play' && by < 0) {   // Fancy is above the top edge: show where he is and that he is being called back
    var w = clamp(topT / CFG.topFreeSecs, 0, 1);
    if (mirOn()) { ctx.save(); ctx.translate(0, H); ctx.scale(1, -1); }
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(mx(bx), 12); ctx.lineTo(mx(bx) - 14, 36); ctx.lineTo(mx(bx) + 14, 36); ctx.closePath(); fs(w > 0.6 && (calmOn() || Math.floor(time * 10) % 2) ? '#ff6b5e' : '#ffd93b');
    if (mirOn()) ctx.restore();
  }
  if (state === 'play' || state === 'paused' || state === 'dead') {
    outlinedC(String(BAL ? BAL.popped : score), W / 2, 37, 64, '#ffffff');   // the big gate count: its top edge lines up with the top of the pause button and the banana counter
    if (state !== 'dead') {
      var lh = opt('lefty'), hx = function (x) { return lh ? W - x : x; }, ha = lh ? 'right' : 'left';   // left-handed: the counters move to the right so the pause button can sit at the left
      ART.coin(ctx, hx(24), 26, time); outlinedC(String(runCoins), hx(42), 27, 22, '#ffffff', ha);
      drawTapIcon(hx(24), 58); outlinedC(String(runFlaps), hx(42), 59, 20, '#ffffff', ha);   // taps this run
      if (streak >= 2) outlinedC('x' + streak + ' perfect', hx(14), 79, 14, '#ffd93b', ha);   // sits in the gap between the tap counter and the progress line (it used to overprint the line's text)
    }
    if (state === 'play' || state === 'paused') { drawPauseBtn(PB, .5); drawClock(PB[0]); ctx.save(); ctx.translate(0, -HUDUP); if (BAL) drawBalHud(); else if (FT && FT.ph !== 'wait') drawFtHud(); else drawProgress(); if (state === 'play') drawExtrasRow(); ctx.restore(); if (state === 'play') drawKHint(); }   // the pause button, and how far along the stage is
    lap('hud');
  }
  if (state === 'title') {
    // splash: the name's letters swoop in, then Fancy zooms in beside them
    ctx.save(); ctx.translate(0, TOFF); var tw = drawTitleWord(); ctx.restore(); var ta = clamp((titleT - 2.5) / 0.4, 0, 1);
    ctx.globalAlpha = ta;
    outlined('Tap to start', W / 2, 352 + TOFF, 26, '#ffffff');
    outlined(spdPct() !== 100 ? 'Best (' + spdPct() + '% speed): ' + bestOf() : 'Best: ' + save.best + '   Stage: ' + save.bestStage, W / 2, 404 + TOFF - 6, 20, '#ffffff');
    outlined('Friends freed: ' + save.stats.friends + (save.stats.plus ? '   Speed +' + Math.min(CFG.plusMax, save.stats.plus) * 10 + '%' : ''), W / 2, 430 + TOFF - 6, 18, '#ffffff');
    if (save.stats.plus >= 5) { if (save.stats.plus >= CFG.plusMax) { ctx.lineWidth = 4; ['#ff6b81', '#ffd93b', '#7be07b', '#7ad8ff'].forEach(function (c, k) { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(W - 30, 418 + TOFF - 6, 20 - k * 4, Math.PI, 0); ctx.stroke(); }); } ART.coin(ctx, W - 30, 404 + TOFF - 6, time); }   // trophies: a gold banana at +50% speed, with a rainbow at the +100% top
    if (!opt('noticker')) drawTicker();
    ctx.globalAlpha = 1;
    outlined(PHASE + ' ' + STAMP, W / 2, 556, 13, '#ffffff');
    outlined(COPYRIGHT, W / 2, 576, 11, '#ffffff');
    outlined(FORGED, W / 2, 593, 11, '#ffffff');
  } else if (state === 'launch') {
    if (skipLaunch()) { ctx.globalAlpha = 0.85; outlined('Tap to skip', W / 2, 604, 17, '#ffffff'); ctx.globalAlpha = 1; }
  } else if (state === 'ready') {
    outlined('Tap to launch!', W / 2, 110, 28, '#ffffff');
    if (runChal) outlined('Challenge: ' + CHAL[chalIdx() - 1][1], W / 2, 146, 17, '#ffd93b');
  } else if (state === 'paused') {
    if (resT >= 0) { ctx.fillStyle = 'rgba(58,42,77,0.18)'; ctx.fillRect(0, 0, W, H); drawResume(); }
    else { ctx.fillStyle = 'rgba(58,42,77,0.35)'; ctx.fillRect(0, 0, W, H); outlined('Paused', W / 2, 226, 44, '#ffd93b'); outlined('Tap to continue', W / 2, 286, 24, '#ffffff'); mgBtn(PS_BT, 'Settings', '#4a9bd8'); padLine(); if (pracN) mgBtn(MG_BT, 'Back to title', '#8a6cd8'); else outlined('(the P key pauses too)', W / 2, 366, 15, '#ffffff'); drawExtrasCard(); }
  } else if (state === 'dead') {
    deadCard(clamp(deadT / 0.35, 0, 1));
  } else if (state === 'victory') {
    victoryCard(); drawFx();
  }
  hudM(0);
}


/* X01 + X75: sideways on a phone the picture is small (231 px wide at 892 x 412), so its real buttons were 33 px tall. "Wide" mode puts the buttons in the empty side space, makes the windows about 1.45 times bigger than the picture (they scroll), and keeps the letterbox in the stage's own colors. */
var UIMIN = 0.97, WIDE = false;
function sp(k, v) { stageEl.style.setProperty(k, v); }   // 0.97: the Settings rows come out at 48 px, the floor for a grown-up's finger
function wideSet(aw, s, cssW) {
  var w = s < UIMIN && (aw - cssW) / 2 >= 150, root = document.body;
  if (w !== WIDE) { WIDE = w; root.classList.toggle('wide', w); }
  sp('--ui', (w ? UIMIN : s) + 'px'); sp('--su', s + 'px'); sp('--sw', cssW + 'px'); sp('--room', (aw - cssW) / 2 + 'px'); sp('--kk', w ? UIMIN / s : 1);
  LBK = '';
}
/* X75: the letterbox (the bars beside or above and below the picture) shows the same colors as the picture's edge instead of plain navy: one column of the stage's own sky, hills and ground, read once per stage from a tiny copy, becomes the page background. */
var LBT = -2, LBK = '', LBC = {};
function lbWant() { if (' title ready launch play paused dead '.indexOf(' ' + state + ' ') < 0 || BAL) return -1; return bgT >= 1 ? shownTheme() : LBT; }   // during the quick fade between stages the margin keeps the old colors
function lbColumn(th) {
  var c, g, d, i, a = [];
  if (LBC[th]) return LBC[th];
  if (!ART.sceneReady(th)) return null;   // asking for a stage that is still being built would make it all at once
  try {
    c = document.createElement('canvas'); c.width = 8; c.height = 64; g = c.getContext('2d', { willReadFrequently: true }); g.scale(8 / W, 64 / H);
    ART.back(g, th, 0); ART.ground(g, th, 0); d = g.getImageData(0, 0, 1, 64).data;
    for (i = 0; i < 256; i += 16) a.push('rgb(' + d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ')');
  } catch (e) { return null; }
  LBC[th] = a; return a;
}
function lbApply() {
  var th = lbWant(), col = th >= 0 ? lbColumn(th) : null, r, t, h, st, i, key;
  LBT = th >= 0 && !col ? -2 : th;   // -2: try again next frame
  if (!col) { LBK = ''; document.documentElement.style.removeProperty('--lb'); return; }
  r = stageEl.getBoundingClientRect(); t = Math.round(r.top); h = r.height; key = th + '|' + t + '|' + Math.round(h);
  if (key === LBK) return;
  LBK = key; st = [col[0] + ' 0', col[0] + ' ' + t + 'px'];
  for (i = 0; i < col.length; i++) st.push(col[i] + ' ' + (t + (i + 0.5) / col.length * h).toFixed(1) + 'px');
  st.push(col[col.length - 1] + ' ' + (t + h).toFixed(1) + 'px', col[col.length - 1] + ' 100%');
  document.documentElement.style.setProperty('--lb', 'linear-gradient(to bottom,' + st.join(',') + ')');
}
function resize() {
  var cs = getComputedStyle(document.body), aw = Math.max(120, innerWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)), ah = Math.max(120, innerHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0));   // the body keeps clear of notches and rounded corners (safe-area padding)
  var s = Math.min(aw / W, ah / H), cssW = Math.floor(W * s), cssH = Math.floor(H * s);
  stageEl.style.width = cssW + 'px'; stageEl.style.height = cssH + 'px'; stageEl.style.setProperty('--u', s + 'px');
  wideSet(aw, s, cssW);
  dpr = DPRFORCE || Math.min(devicePixelRatio || 1, dprMax || 2);   // dprMax is lowered by the quality governor
  var nw = Math.max(1, Math.round(cssW * dpr)), nh = Math.max(1, Math.round(cssH * dpr));
  if (dpcb && !DPRFORCE && dpr >= (devicePixelRatio || 1) - 0.001 && Math.abs(dpcb.w - nw) <= 2 && Math.abs(dpcb.h - nh) <= 2) { nw = dpcb.w; nh = dpcb.h; }   // P60
  if (nw !== cv.width || nh !== cv.height) { cv.width = nw; cv.height = nh; TXC = {}; TXI = Object.create(null); TXN = 0; FXS = {}; CFC = []; CFP = ''; } k = cv.width / W;   // a resize that changes nothing (a phone's address bar) must not throw away every word picture
  bkReset();
  var ak = Math.min(k, CFG.artScaleMax);   // art pictures are built at most this sharp, to save memory on big screens
  if (ak !== artK) { artK = ak; ART.init(ak); fWarmed = 0; }   // init drops the fight pictures: build them again
  LBK = ''; if (LBT !== -2) lbApply();
}
/* P13: the visible canvas can be lost to a driver reset (art pictures are in plain memory and survive): pause, then redraw when it comes back */
var ctxLost = false, ctxLostN = 0;
function onCtxLost(e) { if (e && e.preventDefault) e.preventDefault(); ctxLost = true; ctxLostN++; if (inRun()) onHidden(); toast('The picture was reset by your device. The game is paused.', 4000); }
function onCtxBack() { ctxLost = false; TXC = {}; TXI = Object.create(null); TXN = 0; FXS = {}; CFC = []; CFP = ''; FB = null; FBg = null; if (FBmain) { ctx = FBmain; FBmain = null; } stillDrawn = false; try { resize(); render(); } catch (e) { logError('render', e); } }
cv.addEventListener('contextlost', onCtxLost); cv.addEventListener('contextrestored', onCtxBack);
/* P60: use the canvas box in real device pixels (within 2 px of our own, governor not lowering sharpness) */
var dpcb = null;   
if (window.ResizeObserver) { try { new ResizeObserver(function (L) { var b = L[0] && L[0].devicePixelContentBoxSize && L[0].devicePixelContentBoxSize[0]; if (!b) return; var n = { w: Math.round(b.inlineSize), h: Math.round(b.blockSize) }; if (dpcb && dpcb.w === n.w && dpcb.h === n.h) return; dpcb = n; if (n.w !== cv.width || n.h !== cv.height) { clearTimeout(rzT); rzT = setTimeout(function () { resize(); try { if (renders > 0) render(); } catch (e) { logError('render', e); } }, 60);   /* before the first picture is on screen the picture loop draws it (a draw here would do the whole first-screen work in one go) */ } }).observe(cv, { box: 'device-pixel-content-box' }); } catch (e) { dpcb = null; } }
var rzT = 0, rzRaf = 0;   // phones fire many resize events while the address bar slides: fit the box now (cheap), rebuild the picture once things are quiet
function fitStage() { bkReset(); var cs = getComputedStyle(document.body), aw = Math.max(120, innerWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)), ah = Math.max(120, innerHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0)), s = Math.min(aw / W, ah / H); stageEl.style.width = Math.floor(W * s) + 'px'; stageEl.style.height = Math.floor(H * s) + 'px'; stageEl.style.setProperty('--u', s + 'px'); }
addEventListener('resize', function () {
  if (!rzRaf) rzRaf = requestAnimationFrame(function () { rzRaf = 0; fitStage(); });
  clearTimeout(rzT); rzT = setTimeout(function () { resize(); try { render(); } catch (e) { logError('render', e); } }, 140);
});

/* ===== Input ===== */
var PB = [326, 30];   // the pause button (top right while flying)
cv.addEventListener('pointerdown', function (e) { e.preventDefault(); if (e.button === 0) kHeld.ptr = true; var pl = mgLogical(e); if (!panelOpen() && ((state === 'paused' && resT < 0) || (state === 'mini' && MG && MG.paused) || (state === 'sky' && SKY && SKY.paused) || (state === 'volc' && VOLC && VOLC.paused)) && mgIn(pl, PS_BT)) { refreshSet(); openPanel(pSet); return; } if (pracN && !panelOpen() && ((state === 'dead' && deadT >= CFG.retryDelay) || (state === 'paused' && resT < 0)) && mgIn(pl, MG_BT)) { practiceExit(); return; } if (state === 'play' && BALR && empOn() && !panelOpen() && rsgT >= 0.3 && rsgT < CFG.cardSecs - 0.3 && mgIn(pl, EMP_DOOR)) { var rp0 = runPauses; onHidden(); runPauses = rp0; openPanel(pEmp); return; } if (state === 'play' && Math.abs(pl[0] - PB[0]) < PBH() && Math.abs(pl[1] - PB[1]) < PBH()) { onHidden(); return; } if (state === 'title' && (museHit(pl) || homeHit(pl))) return; if (state === 'home') { homeTap(pl); return; }
  if (state === 'sky') { skyPointer(pl); return; }
  if (state === 'volc') { volcPointer(pl); return; } if (contCan() && stage > 1 && mgIn([pl[0], pl[1] - DOFF], DC_B)) { payContinue(); return; } if (state === 'mini') mgPointerDown(e); else { if (state === 'play' || state === 'ready' || state === 'launch' || state === 'paused') tapRipple(pl[0], pl[1], tapIgnored()); onAction(); } });
cv.addEventListener('pointermove', function (e) { if (state === 'mini' && (e.pointerType === 'mouse' || e.buttons)) mgPoint(e); });
addEventListener('pointerup', function () { kHeld.ptr = false; if (mgDn && mgDn.tap && !mgDn.moved && state === 'mini' && MG && MG.ph === 'play' && !MG.paused && performance.now() - mgDn.t0 < 450) mgLeap(); mgDn = null; }); addEventListener('pointermove', function (e) { if (kHeld.ptr && !e.buttons) kHeld.ptr = false; }); addEventListener('pointercancel', function () { kHeld.ptr = false; mgDn = null; }); addEventListener('blur', function () { kHeld.ptr = kHeld.key = kHeld.pad = false; });
var STEER = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' }, STEERK = { a: 'l', d: 'r', w: 'u', s: 'd' };
function steerKey(e) { var k = STEER[e.code]; if (k) return k; if (e.code) return null; k = String(e.key); return STEER[k] || STEERK[k.toLowerCase()] || null; }   // steering by the key's place (W A S D stay under the left hand on any layout, and Caps Lock or Shift change nothing); an event without a code (a test, an odd device) falls back to the letter
function isSpace(e) { return e.code === 'Space' || e.key === ' '; }
addEventListener('keydown', function (e) {
  if (isSpace(e)) kHeld.key = true;
  if (e.key === 'Escape') { if (state === 'home' && !panelOpen()) { homeBack(); return; } if (state === 'sky' && !panelOpen()) { if (SKY && (SKY.paused || SKY.ph === 'win' || SKY.ph === 'lose')) skyExit(); else skyPause(true); return; } if (state === 'volc' && !panelOpen()) { if (VOLC && (VOLC.paused || VOLC.ph === 'win' || VOLC.ph === 'lose')) volcExit(); else volcPause(true); return; } if (pracN && (state === 'dead' || state === 'paused') && !panelOpen()) { practiceExit(); return; } if (state === 'mini' && MG && MG.practice && !panelOpen() && (MG.paused || mgCard(MG))) practiceExit(); else closePanels(); return; }
  var kk = steerKey(e); if (kk) keys[kk] = true;
  if (state === 'mini' && e.key === 'ArrowUp') { e.preventDefault(); return; }
  if ((e.key === 'p' || e.key === 'P') && !panelOpen()) { if (e.repeat) return; if (state === 'mini') mgPause(); else if (state === 'sky') skyPause(); else if (state === 'volc') volcPause(); else if (state === 'play') onHidden(); else if (state === 'paused') beginResume(); return; }   // P pauses and resumes   // in the water level the up arrow only steers
  if ((e.key === 'c' || e.key === 'C') && contCan() && !panelOpen()) { payContinue(); return; }
  if (!isSpace(e) && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
  var ae = document.activeElement, t = ae && ae.tagName;
  if (t === 'BUTTON' && isSpace(e) && state !== 'title' && !panelOpen()) ae.blur();   // in a run the space bar flaps even if some button still has the focus (a focused button would swallow it and press itself)
  else if (t === 'BUTTON' || t === 'TEXTAREA' || t === 'INPUT') return;
  e.preventDefault(); if (!e.repeat) { if (state === 'play' || state === 'launch') tapRipple(mx(bx), mirY(by), tapIgnored()); onAction(); }
});
// A button that was clicked or tapped lets go of the keyboard focus, so the space bar flaps instead of pressing that same button again (a focused button swallows Space). A keyboard press (detail 0) keeps its focus.
document.addEventListener('click', function (e) { var b = e.target && e.target.closest ? e.target.closest('button') : null; if (b && e.detail > 0) b.blur(); });
addEventListener('keyup', function (e) { if (isSpace(e)) kHeld.key = false; var kk = steerKey(e); if (kk) keys[kk] = false; });
document.addEventListener('contextmenu', function (e) { if (e.target === cv) e.preventDefault(); });

/* ===== Game controller. In play: any face button or trigger flaps or leaps, Start pauses, the stick or d-pad steers in the water level.
   Menus: the d-pad (or stick) moves a purple focus ring around the buttons, A picks, B goes back, Start closes. Pause: Y or Select opens Settings.
   Only polled once a controller has been plugged in or touched. ===== */
var padOn = false, padTest = null, padPrev = {}, padDir = { l: 0, r: 0, u: 0, d: 0 }, padRep = {}, padNavT = false, padOpener = null, padPanelWas = null, padPanelAt = 0, padLast = 0, padGuard = 450, padHintAt = 0, padHintEl = $('padHint');
addEventListener('gamepaddisconnected', function () {   // the last controller was unplugged in the middle of a run: pause instead of letting him fall
  var L = padList(), i, left = 0; for (i = 0; i < L.length; i++) if (L[i] && L[i].connected) left++;
  if (left || !padOn || !inRun()) return;
  onHidden(); toast('Controller disconnected. The game is paused.', 4000);
});
addEventListener('gamepadconnected', function () { if (!padOn) toast('Controller found: A flaps, the d-pad steers and moves around menus, Start pauses.', 5000); padOn = true; });
addEventListener('blur', function (e) { if (e.target && e.target.classList) e.target.classList.remove('pf'); }, true);
function padList() { return padTest || (navigator.getGamepads ? navigator.getGamepads() : []); }
function padB(g, n) { return !!(g.buttons[n] && g.buttons[n].pressed); }
function padPanel() { for (var i = 0; i < PL.length; i++) if (!PL[i].hidden) return PL[i]; return null; }
function padCands(root) {   // the buttons a controller can reach right now: the open panel's, or the title screen's own buttons
  var L = (root === stageEl ? stageEl : root).querySelectorAll('button'), o = [], i, b;
  for (i = 0; i < L.length; i++) { b = L[i]; if (b.disabled || b.classList.contains('pcl') || !b.getClientRects().length) continue; if (root === stageEl && !bar.contains(b) && b.id !== 'bCont') continue; o.push(b); }
  return o;
}
function padFocus(el) { var o = document.querySelector('.pf'); if (o) o.classList.remove('pf'); el.classList.add('pf'); try { el.focus(); } catch (e) { } }
function padScroll(root, d) { if (root === stageEl) return; root.scrollTop += (d === 'd' ? 1 : -1) * Math.max(60, root.clientHeight * 0.5); }
function padMove(root, d) {   // spatial move: the nearest button in that direction; with nothing there, a tall panel scrolls instead
  var c = padCands(root), cur = document.activeElement, i, best = null, bs = 1e9, r, p, cx, cy, dx, dy, al, ac, sc;
  if (!c.length) return;
  if (c.length === 1 && (d === 'u' || d === 'd')) { padScroll(root, d); return; }
  if (c.indexOf(cur) < 0) { padFocus(c[0]); return; }
  r = cur.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
  for (i = 0; i < c.length; i++) {
    if (c[i] === cur) continue; p = c[i].getBoundingClientRect(); dx = p.left + p.width / 2 - cx; dy = p.top + p.height / 2 - cy;
    al = d === 'l' ? -dx : d === 'r' ? dx : d === 'u' ? -dy : dy; ac = d === 'l' || d === 'r' ? Math.abs(dy) : Math.abs(dx);
    if (al < 4) continue; sc = al + ac * 2.5; if (sc < bs) { bs = sc; best = c[i]; }
  }
  if (best) padFocus(best); else if (d === 'u' || d === 'd') padScroll(root, d);
}
function padOpenSet() { refreshSet(); openPanel(pSet); }
function padHint(t, top) { if (!padHintEl) return; if (t) { padHintEl.textContent = t; padHintEl.className = top ? 'top' : ''; padHintEl.hidden = false; } else padHintEl.hidden = true; }
function padStep() {
  var L = padList(), i, g, j, now = performance.now(), D = { l: 0, r: 0, u: 0, d: 0, act: 0, a: 0, b: 0, xy: 0, pz: 0, sel: 0 }, any = false, ax, hv, root, cur, c, k, ks = ['l', 'r', 'u', 'd'], E = {}, pp = padPrev, canPause;
  for (i = 0; i < L.length; i++) {
    g = L[i]; if (!g || !g.buttons) continue; any = true; ax = g.axes || [];
    if (padB(g, 0)) D.a = 1; if (padB(g, 1)) D.b = 1; if (padB(g, 2) || padB(g, 3)) D.xy = 1;
    for (j = 0; j < 8; j++) if (padB(g, j)) D.act = 1;   // A, B, X, Y, shoulders and triggers
    if (padB(g, 8)) D.sel = 1; if (padB(g, 9)) D.pz = 1;
    if (padB(g, 12) || ax[1] < -0.45 || ax[3] < -0.45) D.u = 1;
    if (padB(g, 13) || ax[1] > 0.45 || ax[3] > 0.45) D.d = 1;
    if (padB(g, 14) || ax[0] < -0.45 || ax[2] < -0.45) D.l = 1;
    if (padB(g, 15) || ax[0] > 0.45 || ax[2] > 0.45) D.r = 1;
    if (ax.length > 9 && g.buttons.length <= 12 && ax[9] <= 1.05) { hv = Math.round((ax[9] + 1) * 3.5); if (hv === 7 || hv === 0 || hv === 1) D.u = 1; if (hv >= 1 && hv <= 3) D.r = 1; if (hv >= 3 && hv <= 5) D.d = 1; if (hv >= 5 && hv <= 7) D.l = 1; }   // a d-pad that reports as a hat switch
  }
  if (!any) return;
  ks.forEach(function (k) { if (D[k] !== padDir[k]) { padDir[k] = D[k]; keys[k] = !!D[k]; } });
  for (k in D) E[k] = D[k] && !pp[k];
  if (D.act || D.xy || D.sel || D.pz || D.u || D.d || D.l || D.r) padLast = now;
  root = padPanel(); if (root !== padPanelWas) {   // a panel opened or closed
    padHintAt = now;
    if (root && now - padLast < 8000) { padPanelAt = now; c = padCands(root); if (c.length > 1) padFocus(c[0]); } else if (root) padPanelAt = now;
    if (!root && state === 'title' && padNavT && padOpener && padOpener.getClientRects().length) padFocus(padOpener);
    padPanelWas = root;
  }
  if (state !== 'title') padNavT = false;
  if (root || (state === 'title' && padNavT)) {   // ---- menus ----
    var R = root || stageEl; padHint(now - padHintAt > 3500 ? '' : root ? 'D-pad: move    A: pick' + (root === pWin ? '' : '    B: back') : 'D-pad: move    A: pick    B: play', !!root);
    ks.forEach(function (k) { if (D[k]) { if (E[k]) { padMove(R, k); padRep[k] = now + 380; } else if (now >= padRep[k]) { padMove(R, k); padRep[k] = now + 120; } } });
    cur = document.activeElement; c = padCands(R);
    if (E.a && now - padPanelAt > padGuard) { if (c.indexOf(cur) >= 0) { if (!root) padOpener = cur; cur.click(); } else if (c.length === 1) c[0].click(); else if (!root) { padNavT = false; toReady(); } }
    else if ((E.b || E.pz) && root !== pWin) { if (root) closePanels(); else { padNavT = false; padHint(''); if (cur && cur.blur) cur.blur(); } }
    else if (E.pz && !root) { padNavT = false; padHint(''); toReady(); }
  } else {   // ---- playing ----
    padHint('');
    canPause = (state === 'paused' && resT < 0) || (state === 'mini' && MG && MG.paused) || (state === 'sky' && SKY && SKY.paused) || (state === 'volc' && VOLC && VOLC.paused);
    if (state === 'title' && (E.l || E.r || E.u || E.d)) { c = padCands(stageEl); if (c.length) { padNavT = true; padHintAt = now; padFocus($('bCont').getClientRects().length ? $('bCont') : c[0]); } }
    else if ((E.xy || E.sel) && canPause) padOpenSet();
    else if (E.xy && contCan() && !panelOpen()) payContinue();
    else if (E.b && (pracN || (state === 'mini' && MG && MG.practice)) && ((state === 'dead' && deadT >= CFG.retryDelay) || canPause)) practiceExit();
    else if (E.b && state === 'sky' && SKY && (SKY.paused || SKY.ph === 'win' || SKY.ph === 'lose')) skyExit();
    else if (E.b && state === 'volc' && VOLC && (VOLC.paused || VOLC.ph === 'win' || VOLC.ph === 'lose')) volcExit();
    else if (E.b && state === 'home') homeBack();
    else if (E.b && state === 'mini' && MG && MG.practice && mgCard(MG)) practiceExit();
    else if (E.act && !((D.xy || D.sel) && canPause && !D.a)) { if (state === 'play' || state === 'launch') tapRipple(mx(bx), mirY(by), tapIgnored()); onAction(); }
    if (E.pz && !panelOpen()) { if (state === 'mini') mgPause(); else if (state === 'play') onHidden(); else if (state === 'paused') beginResume(); else if (state === 'sky') skyPause(); else if (state === 'volc') volcPause(); else if (state === 'home') homeBack(); else if (state === 'title') { padNavT = false; toReady(); } }
  }
  kHeld.pad = !!D.a; padPrev = D;
}

/* ===== Start ===== */
var awayMs = save.stats.runs > 0 && save.savedAt > 0 ? Date.now() - save.savedAt : 0;
PicCache.start(function () {   // the title's big pictures may be put back from the browser's own storage first (at most a 150 ms wait; off where that is not quicker); then the game starts as it always did
applyColors(); syncOpts(); resetWorld(); resize(); setBar(true); if (awayMs > 3 * 864e5) setTimeout(function () { toast('Welcome back! Tap, click or press Space to flap. P pauses. Settings is the gear.', 6000); }, 2500); ART.warm(shownTheme());
firstScreenGo(function () { requestAnimationFrame(frame); requestAnimationFrame(function () { try { LFCReport.mark('first-screen'); } catch (e) { } }); });
});   // the first stage's obstacle pieces are built in the background while the title shows
if (loadNote) toast(loadNote);
if (!storageOK) toast('This browser is not keeping progress. Use Save to copy your save code.');

/* The browser's frame times wobble by a millisecond or two even when every picture is on time, and the game moves by that wobble, so the scenery shivers a little. This finds the screen's real beat (the middle of the recent frame gaps) and, when a gap is a whole number of beats give or take a little, moves by exactly that; real stalls are passed through as they are, and any left-over difference is paid back slowly so the clock never drifts. */
var ed = new EvenDt();   // EvenDt: the lean build of even-dt from JS-modules (smallparts.js)
function evenDt(ri) { return ed.next(ri); }
var pumpSkip = 0, last = 0, acc = 0, autoRun = true, REC = null, stillDrawn = false, renders = 0;   // renders: how many pictures were drawn (checks use it)
var qLvl = 0, qHint = false, dprMax = 2, govOn = true, lastDraw = 0;   // quality level 0 (full) to 4 (lightest): the governor steps it from how long frames really take
function qApply() {
  fxMax = qLvl >= 1 ? 36 : 70; ART.lite = qLvl >= 2; var d = qLvl >= 4 ? 1 : qLvl >= 3 ? 1.5 : 2;
  if (d !== dprMax) { dprMax = d; try { resize(); render(); } catch (e) { logError('render', e); } }
}
var gov = FxGovernor.create({ levels: [0, 1, 2, 3, 4], maxAuto: 4, onChange: function (to) { var from = qLvl; qLvl = to; qApply(); if (to > from && qLvl >= 2 && !qHint && !opt('saver')) { qHint = true; toast('This screen is working hard. Settings has a Battery saver that makes it lighter.', 5000); } } });   // FxGovernor: the lean build of fx-governor from JS-modules (fxgovernor.js): two slow 3-second stretches in a row (under 36 FPS) step the effects down one level, and it never steps back up by itself
function govStep(ri, t) {
  if (!govOn) return;
  if (document.hidden || (state !== 'play' && state !== 'mini')) return;   // only play frames are counted: a pause, a hidden tab or another screen leaves a long gap, and a long gap restarts the count
  gov.frame(t);
}
var artDown = 0;
function softFail(e) {   // a canvas could not be made (memory ran out): build the art a notch less sharp instead of leaving a black screen
  if (!/canvas-memory|null/.test(String(e && e.message)) || artDown >= 3 || CFG.artScaleMax <= 1) return;
  artDown++; CFG.artScaleMax = Math.max(1, CFG.artScaleMax * 0.75); artK = 0; try { resize(); } catch (e2) { }
}
var idleAt = performance.now();   // last touch, key or mouse move
['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'].forEach(function (n) { window.addEventListener(n, function () { idleAt = performance.now(); }, { capture: true, passive: true }); });
function drawGap() {   // how long to leave the picture alone: only the Battery saver now. Windows and the Oops card used to throttle it (about 8 and 15 pictures a second) on the idea that nobody sees it change, but the scenery shows round a window's edge and keeps moving, so it looked like a crawl
  return opt('saver') || (state === 'title' && performance.now() - idleAt > 30000) ? 28 : 0;   // the title screen rests at the Battery saver's pace after 30 s with nobody touching it (about 35 pictures a second); any touch, key or mouse move brings the full pace back at once. Windows are not throttled (see above)
}
var LAYER = '', LAYERD = false, DPRFORCE = 0;   // Test Lab: '' normal, 'wc' = will-change, 'z' = translateZ (own compositor layer for the canvas)
var STEPMODE = 0, PACE = [0, 0, 0, 0, 0];   // STEPMODE 1 (Test Lab only): one even step per screen refresh instead of fixed 1/120 s steps; PACE counts physics steps per drawn frame
function firstScreenGo(go) {   // build the title's pictures in pieces of about 8 ms, one after another with no wait for the screen between them (a message to ourselves lets the browser breathe in between), then start the picture loop
  var ch = null;
  function pieces() { var ok; try { ok = state !== 'title' || firstScreenStep(0); } catch (e) { ok = true; } if (ok) { go(); return; } ch.port2.postMessage(0); }
  if (typeof MessageChannel !== 'function') { go(); return; }
  try { ch = new MessageChannel(); ch.port1.onmessage = pieces; } catch (e) { go(); return; }
  ch.port2.postMessage(0);   // not at once: the rest of the page's code has to finish loading first
}
var FSW = null, FSI = 0;
function firstScreenStep(t) {   // a first visit: the title's pictures are made in pieces of about 8 ms per screen refresh (the scenery, then the news strip, the title word and the leaderboard column), the later ones drawn into a scratch canvas so nothing shows early; true once all are ready and the title can be drawn in one cheap go
  var o = ctx, steps, t0 = performance.now();
  if (!ART.sceneStep(shownTheme(), 8) || !ART.heroStep(Math.max(1, 8 - (performance.now() - t0)))) return false;
  steps = [function () { if (lbWant() !== LBT) lbApply(); }, function () { if (!opt('noticker')) drawTicker(); }, drawTitleWord];
  if (!FSW) { FSW = document.createElement('canvas'); FSW.width = FSW.height = 8; FSW = FSW.getContext('2d'); }
  while (FSI < steps.length && performance.now() - t0 < 8) {
    FSW.setTransform(k, 0, 0, k, 0, 0); ctx = FSW;
    try { steps[FSI++](); } catch (e) { logError('first-screen', e); } finally { ctx = o; }
  }
  return FSI >= steps.length;
}
function frame(t) {
  requestAnimationFrame(frame);
  if (!autoRun || dlHold) { last = t; return; }
  if (renders === 0 && state === 'title' && !firstScreenStep(t)) { last = t; return; }   // a first visit: the scenery behind the title is built a few milliseconds per screen refresh (no single long freeze), and the title appears the moment it is ready
  var fs = performance.now(), ri = t - last, dt = Math.min(0.05, evenDt(ri) / 1000 || 0), p0 = REC ? fs : 0; last = t; acc += dt; wlSync(); govStep(ri, t); if (padOn || padTest) padStep();
  var sn = 0; try { if (STEPMODE) { sn = Math.ceil(acc / 0.0167 - 1e-6); if (sn > 0) { var sd = acc / sn; for (var si = 0; si < sn; si++) update(sd); acc = 0; } } else while (acc >= CFG.step) { update(CFG.step); acc -= CFG.step; sn++; } var p1 = REC ? performance.now() : 0, still = washA <= 0 && ((state === 'paused' && resT < 0) || (state === 'mini' && MG && MG.paused)); if (!(still && stillDrawn) && !(t - lastDraw < drawGap())) { renders++; lastDraw = t; render(); stillDrawn = still; if (washA > 0) { ctx.globalAlpha = washA; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; } }   /* a paused game does not change: draw it once, then rest (saves battery and heat); the Battery saver draws at most every 28 ms */ if (renders > 0 && PicCache.boot) PicCache.end(); if (TEXTQ.length) { var tq = TEXTQ.shift(); delete TXP[tq[3]]; textPic(tq[0], tq[1], tq[2]); } /*TEST_HOOK_START*/ if (renders === 1) { try { performance.mark('bf-first-frame'); } catch (e) { } } PACE[sn > 4 ? 4 : sn]++; if (window.__burn) { var bt = performance.now(); while (performance.now() - bt < window.__burn); } /*TEST_HOOK_END*/ if (renders > 1) pumpFrame(fs); /* background art building only when this frame was cheap (or every 4th frame at the latest), so a slow phone is not made slower right when it struggles */ if (REC) REC(t, dt, p1 - p0, performance.now() - p1); } catch (e) { logError('frame', e); acc = 0; softFail(e); }
}

/*TEST_HOOK_START*/
if (/[#&]test\b/.test(location.hash)) {
  tapWaitOn = false;   // the test copy starts the old way (no wait for a tap) for the automatic checks; the Test Lab switches it on for hands-on play
  window.__bf = {
    gpsOf: gpsOf, gateStart: gateStart, stageOfGate: stageOfGate, die: die, continueRun: continueRun, winTitle: winTitle, resultText: resultText, padSet: function (v) { padTest = v; }, padStep: padStep, magR: magR, spdPct: spdPct, longOn: longOn, get windUsed() { return windUsed; }, get contN() { return contN; }, balPop: function (b) { balPop(b); }, get keys() { return keys; }, get nextX() { return nextX; }, get spawned() { return spawned; }, get invuln2() { return invuln; },
    setRec: function (f) { REC = f; }, get dieT() { return DIET; }, get runFlaps() { return runFlaps; }, get boost() { return boost; }, get boostT() { return boostT; }, get titleT() { return titleT; }, set titleT(v) { titleT = v; }, get copyright() { return COPYRIGHT; }, letterCount: function () { return letterPics().length; }, setPR: function (o) { PR = o; }, get fxLen() { return fx.length; }, get popsLen() { return pops.length; }, get trackOn() { return trackOn; },
    get state() { return state; }, get renders() { return renders; }, get qLvl() { return qLvl; }, setTime: function (v) { time = v; }, seedF: function (n) { frng = mulberry32(n); }, get fxPool() { return fxFree.length; }, get artMax() { return CFG.artScaleMax; }, softFail: softFail, govStep: function (ri, t) { govStep(ri, t); }, setState: function (n) { state = n; }, get score() { return score; }, get stage() { return stage; },
    get by() { return by; }, get vy() { return vy; }, get bx() { return bx; }, get topT() { return topT; }, get fallD() { return fallD; }, get hurtT() { return hurtT; }, get cardT() { return cardT; }, get trackX() { return trackX; }, get nextX() { return nextX; }, get dist() { return dist; }, get bgT() { return bgT; }, get theme() { return bgTheme; }, get shield() { return shield; }, get spinT() { return spinT; }, get gardenD0() { return gardenD0; }, set dist(v) { dist = v; }, syncUp: syncUp, get upShown() { return !$('bUp').hidden; }, get invuln() { return invuln; }, get fxCount() { return fx.length; }, get punchT() { return punchT; }, gapFor: gapFor, speedFor: speedFor, buy: function (id) { buy(UPS.filter(function (u) { return u.id === id; })[0]); }, wearsBow: wearsBow, pickWear: pickWear, ART: ART, get mg() { return MG; }, get pendNext() { return pendNext; }, get vicT() { return vicT; }, openWin: openWin, winKeep: winKeep, winFresh: winFresh, get obs() { return obs; }, get rsgT() { return rsgT; }, get celT() { return celT; }, mgPoint: function (x, y) { if (MG) { MG.tx = x; MG.ty = y; } }, get errors() { return errors.slice(); },
    get save() { return JSON.parse(JSON.stringify(save)); }, markLab: function () { labUsed = true; }, pumpFrame: pumpFrame, drawGap: drawGap, pumpPlan: pumpPlan, get txn() { return TXN; }, textPic: textPic, txFrame: function (n) { TXF += n || 1; }, fxKeys: function () { return Object.keys(FXS); }, textStep: function () { if (TEXTQ.length) { var tq = TEXTQ.shift(); delete TXP[tq[3]]; textPic(tq[0], tq[1], tq[2]); } }, get washA() { return washA; }, ftLive: function () { return FT; }, ftDirect: function (n) { resetWorld(); ART.fightWarm(n); ART.pump(1e9); var f = 1; while (themeOf(f) !== CFG.finalTheme) f++; stage = f; spawned = score = gateStart(f); bgFrom = bgTheme = themeOf(f); bgT = 1; ART.warm(bgTheme); runFight = n; obs = []; spinT = 0; celT = 0; boost = 0; boostT = 99; hurtT = 0; grace = 0; punchT = 0; flashT = 0; trackOn = false; launchT = 0; FT = ftNew(); FT.ph = 'intro'; rsgT = 0; rsgGo = false; rsgTap = false; state = 'play'; by = CFG.rsgY; bx = CFG.bananaX; vy = 0; invuln = 0; pendNext = ''; washA = 0; setBar(false); }, giveBoost: function (id, n) { save.boosts[id] = n; syncUp(); }, extrasList: extrasList, drawExtrasCard: drawExtrasCard, drawExtrasRow: drawExtrasRow, get testFile() { return TESTFILE; }, setRuns: function (n) { save.stats.runs = n; }, setBestStage: function (n) { save.bestStage = n; }, startPractice: startPractice, startPracticeStage: startPracticeStage, get pracN() { return pracN; }, get pracEnd() { return pracEnd; }, practiceExit: practiceExit, get titleState() { return state; }, get storageOK() { return storageOK; }, drawClock: drawClock, split: split, setClk: function (v) { clk = v; }, clearSplits: function () { clkSp.length = 0; }, get PBpos() { return PB; }, twinList: function () { return TWL.slice(); }, twinSync: twinSync, get twinCount() { return twinEl.children.length; }, get wideOn() { return WIDE; }, get lbT() { return LBT; }, lbApply: lbApply, resizeNow: function () { resize(); }, get otherTab() { return otherTab; }, get inertOn() { return cv.inert; }, get barInert() { return bar.inert; }, get failN() { return failN; }, assistNote: assistNote, get ctxLost() { return ctxLost; }, get ctxLostN() { return ctxLostN; }, onCtxLost: onCtxLost, onCtxBack: onCtxBack, get dpcb() { return dpcb; }, lastExport: lastExport, noteExport: noteExport, exportHint: exportHint, get expHinted() { return expHinted; }, resetHints: function () { expHinted = false; keepAsked = false; }, resetTab: function () { otherTab = false; $('tabWarn').hidden = true; }, resetAssist: function () { failN = {}; failNext = {}; }, get steer() { return { l: !!keys.l, r: !!keys.r, u: !!keys.u, d: !!keys.d }; },
    txtClear: function () { TXT = {}; }, tickList: tickList, setRunChal: function (v) { runChal = v; }, setNightA: function (v) { nightA = v; }, spawnOb: spawnOb, get runChal() { return runChal; }, get nightA() { return nightA; }, chalIdx: chalIdx, mirOn: mirOn, applyColors: applyColors, colorIdx: colorIdx, refreshChal: refreshChal, gapFor: gapFor, padGuard: function (v) { padGuard = v; }, themeOfFn: themeOf, get TKLISTN() { return TKLIST ? TKLIST.length : 0; }, openHelp: function () { openPanel(pHelp); }, get txt() { return Object.keys(TXT); },
    get FT() { return FT && { ph: FT.ph, r: FT.r, rt: FT.rt, n: FT.n, hits: FT.hits, hold: FT.hold, list: FT.list.map(function (a) { return { k: a.k, d: a.d, x: a.x, y: a.y, vx: a.vx, vy: a.vy, g: a.g, r: a.r, act: a.act, live: a.live, ox: a.ox, oy: a.oy }; }), by: FT.by }; }, get runFight() { return runFight; }, set runFight(v) { runFight = v; },
    jumpStage: function (n) { stage = n; spawned = score = gateStart(n); obs = []; nextX = W + 160; boost = 0; boostT = 99; bgFrom = bgTheme = themeOf(n); bgT = 1; ART.warm(bgTheme); },
    ftForce: function (n, ph) { ART.fightWarm(n); ART.pump(1e9); runFight = n; obs = []; spinT = 0; celT = 0; boost = 0; boostT = 99; hurtT = 0; grace = 0; punchT = 0; flashT = 0; FT = ftNew(); FT.ph = ph || 'intro'; if (FT.ph === 'intro') { rsgT = 0; rsgGo = false; rsgTap = false; } state = 'play'; by = CFG.rsgY; vy = 0; invuln = 0; shield = 0; pendNext = ''; setBar(false); }, ftHit: ftHit, ftNew: ftNew, ftStep: ftStep, fightNext: fightNext, fightOn: fightOn, fightDue: fightDue, wearsCrown: wearsCrown, setBy: function (v) { by = v; vy = 0; }, setInv: function (v) { invuln = v; }, get fightNew() { return fightNew; }, set fightNew(v) { fightNew = v; }, startGift: startGift, afterWin: afterWin, get giftK() { return giftK; }, get giftS() { return giftS; }, refreshChal: refreshChal, refreshWear: refreshWear, get spawned() { return spawned; }, get nextT() { return nextT; },
    seed: function (n) { rng = mulberry32(n); }, manual: function (on) { autoRun = !on; },
    action: onAction, step: function (n) { for (var i = 0; i < n; i++) update(CFG.step); }, render: render,
    makeCode: makeCode, readText: readText, persist: persist, CFG: CFG, resetWorld: resetWorld, toReady: toReady,
    stamp: STAMP, set noSave(v) { noSave = !!v; }, get noSave() { return noSave; },
    setSave: function (o) { save = cleanSave(o) || save; },
    burst: burst, setAcc: function (v) { acc = v; }, tapWait: function (v) { tapWaitOn = !!v; }, flipPath: function (v) { FBforce = v || ''; }, startHome: startHome, volcStream: volcStream, payContinue: payContinue, get runPH() { return runPH; }, labTitle: function () { exitAt = -1e9; SKY = null; VOLC = null; HOME = null; MG = null; pracN = 0; resetWorld(); state = 'title'; titleT = 5; closePanels(); setBar(true); syncUp(); }, startSky: startSky, skyExit: skyExit, skyTap: skyTap, skyPointer: skyPointer, startVolc: startVolc, volcExit: volcExit, volcTap: volcTap, get VOLC() { return VOLC; }, get SKY() { return SKY; }, homeBack: homeBack, homeTap: homeTap, get HOME() { return HOME; }, get sKon() { return sKon; }, holdForDialog: holdForDialog, get dlHold() { return dlHold; }, get cssF() { return cssF; }, get cfc() { return CFC.length; }, get noStill() { return NOSTILL; }, set noStill(v) { NOSTILL = !!v; CFC = []; CFP = ''; }, get popsList() { return pops.map(function (q) { return { x: q.x, y: q.y, w: q.w, sz: q.sz, txt: q.txt }; }); }, pop: pop, get crowd() { return JSON.parse(JSON.stringify(crowd)); }, get ftStill() { return ftStill; }, get rsg() { return { t: rsgT, wait: rsgWait, tap: rsgTap, k: rsgK, mg: MG ? { ph: MG.ph, wait: !!MG.wait, go: !!MG.go, pt: MG.pt } : null }; }, get kp() { return { on: kOn, ch: kCh, avail: !!kAvail, lane: kLane ? kLane.length : 0, echo: kEcho.length, hold: kHoldT }; }, kHold: function (v) { kHeld.key = !!v; if (!v) kHeld.ptr = kHeld.pad = false; }, get kHeldDbg() { return [kHeld.ptr, kHeld.key, kHeld.pad]; }, kUnlock: function () { save.boosts.potassium = 1; }, get MGo() { return MG; }, get flipV() { return flipV; }, get backStage() { return backStage; }, setBack: function (n) { backStage = n; flipV = flipWant(); }, flipSX: flipSX,     get zoomK() { return zoomK; }, get launchT() { return launchT; }, get runCoins() { return runCoins; }, rateGate: rateGate, get streak() { return streak; }, set streak(v) { streak = v; }, get popList() { return pops; }, get pops() { return pops.length; }, get trailN() { return trail.length; }, giveCoins: giveCoins, startMini: startMini, get dprNow() { return dpr; }, get qLvlNow() { return qLvl; }, get dprCap() { return dprMax || 2; }, qSet: function (n) { qLvl = gov._level = n; gov._changedAt = performance.now(); gov._slow = gov._fast = 0; qApply(); }, evenDt: evenDt, govOff: function (v) { govOn = !v; }, bkMode: function (v) { BKMODE = v === undefined ? BKDEF : !!v; bkReset(); if (!BKMODE) bkHide(); }, get bkOn() { return bkOn; }, drawScale: function (v) { DPRFORCE = +v || 0; resize(); render(); }, canvasLayer: function (v) { LAYER = v || ''; LAYERD = true; }, stepMode: function (v) { STEPMODE = v ? 1 : 0; acc = 0; }, get pace() { return PACE.slice(); }, clearPace: function () { PACE = [0, 0, 0, 0, 0]; }, empBuy: function (id) { empBuy(E[id]); }, empToggle: function (id) { empToggle(E[id]); }, empOn: empOn, wearFlags: wearFlags, balDone: function () { BAL = { popped: 5, total: 5, coins: 0, list: [], pi: 0, plan: [], t: 0 }; balFinish(); }, mgThrow: function (e, dt) { mgThrowStep(e, dt); }, waferOn: waferOn, startVictory: startVictory, setStage: function (n) { stage = n; bgFrom = bgTheme = themeOf(n); bgT = 1; gardenD0 = dist; ART.warm(bgTheme); }, stageUp: stageUp, get rsgT() { return rsgT; }, get rsgGoAtV() { return rsgGoAt(); }, finishMini: finishMini, startBalloons: startBalloons, startGift: startGift, startVictory: startVictory, balFinish: balFinish, mgThrowStep: mgThrowStep, afterWin: afterWin, get BAL() { return BAL; }, get BALR() { return BALR; }, get VS() { return VS; }, get runSecs() { return runSecs; }, get runPauses() { return runPauses; }, get giftS() { return giftS; }, flagsOn: flagsOn, plusK: plusK, setStats: function (o) { Object.assign(save.stats, o); }, setUnlock: function (k, v) { save.unlocks[k] = v; }, winKeep: winKeep, winFresh: winFresh, get fl() { return fl; }, get shd() { return shd; }, setBy: function (y) { by = y; vy = 0; }, speedFor: speedFor, mgTap: miniTap, mgHurt: mgHurt, wFreshBtn: winFresh, setScore: function (n) { score = spawned = n; }, secretsOn: secretsOn, huntOn: huntOn, frCount: frCount, frCollect: frCollect, startVault: startVault, hugStep: hugStep, hugWant: hugWant, get VAULT() { return VAULT; }, get hugT() { return hugT; }, get goldNext() { return goldNext; }, startBoss: startBoss, museHit: museHit, openMuse: function () { openPanel(pMuse); }, secretsAll: secretsAll, mgLT: mgLT, set streak(v) { streak = v; }, bunchOn: bunchOn, spawnOb: spawnOb
  };
}
/*TEST_HOOK_END*/
})();
