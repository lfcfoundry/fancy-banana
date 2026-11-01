# Fancy, the Banana: developer changelog

What changed in each version, newest first, for developers, in three depths: Quick (what changed and whether anything breaks), Details (the main numbers and how it was checked) and Deep (the full record: design reasons, measurements, tests). Players read [changelog.md](changelog.md). Versions before 2026.10.22 were recorded per build; the older ones are grouped here by day.

## 2026.11.01.0300 (beta)

### Quick
Three in-code characters above U+00FF are now `\u` escapes (curly apostrophe in art.js, ellipsis in fieldreport.js, star in game.js), and `build.py` fails on any other character above U+00FF in the scripts or head. The four license-header emoji (U+1F3ED, 1F4DC, 1F6E0, FE0F) are allow-listed in `HEAD_OK` until the owner decides on them. Landing page apostrophes are `&#x2019;`.

### Details
Research round 33: one such character makes Chromium store the whole page's text at 2 bytes per character. File size is unchanged (497,680 bytes); the saving is in memory once the header emoji are escaped as well.

## 2026.10.31.1730 (beta)

### Quick
`back()` skips the far hill band when `ART.lite` is on (quality level 2 or more). Normal screens are unchanged. Garden (jungle) stages are not affected.

### Details
Phone (Chrome 156, 8 cores, 412x892 at 2.9x, early-stop A/B): far hills off is 0.83 of the time per frame (range 0.68 to 0.86, 4 rounds; 6.54 to 4.88 ms; lower is faster). All three bands off: 0.79 (0.71 to 0.95, noisy). Free running both held 60 FPS. Cloud timing of level 0 vs 2 was inconclusive (Chromium 155 1.00, Firefox 158 0.97 on stage 4), so the phone number is the evidence. Ratio-2 check (Chromium 155): 0.53 to 1.44 M canvas pixels (2.7x).

### Deep
Chosen by Jawad on a card (drop far hills on slow devices only). The Fruit Garden's extra per-frame cost is not scenery: with the same setup draw plus step is 8.18 ms (stage 4) vs 8.59 ms (stage 5); the two stamps per jungle layer are one visible plus one mostly off-screen picture. Pictures: full vs level 2 on stage 4 are kept by the maker.

## 2026.10.31.1405 (beta)

### Quick
save-kit 1.4.0 with `durable: true` (and `kit.recover()` right after `load()`) keeps a strict IndexedDB copy of every save; field-report 1.1.0 in `frames: 'external'` mode takes frames from the game's own loop. Animation-frame callbacks drop from about 120 to 60 a second.

### Details
Kill test (change one setting, SIGKILL the browser 250 ms later, reopen the same profile): old build lost the save entirely in ungoogled Chromium 155.0.8059.39 and Firefox 158.0 (twice in Chromium); new build kept it in both. `recover()` is applied only while the game is still on the title with no window open. Start-up (9 loads, median, old to new): Chromium page ready 96 to 107 ms and first paint 108 to 96 ms; Firefox 98 to 100 ms and 143 to 135 ms; WebKitGTK 2.52.6 (15 loads) 28 to 23 ms and 41 to 34 ms. Animation-frame callbacks at 4 s: Chromium 120 to 59 a second, Firefox 108 to 56, WebKitGTK 85 to 41; game code time in them 31.2 to 29.4, 180.8 to 175 and 33.4 to 29.2 ms a second. Size 494,515 to 497,670 bytes.

### Deep
The vendored copies are lean builds (save-kit: autosave, compact, migrate, nativeBase64, persist, raw, skipUnchanged, stageImport, twoTap and large cut; durable kept) with comments removed, as before. The recorder's own frame loop was the second callback seen in round 13; the game loop now calls `LFCReport.frame(t)` and the module's loop is off. A WebKitGTK first-paint reading of 30 vs 40 ms in a 9-load run reversed in a 15-load run (41 vs 34 ms), so it is noise. Chromium page-ready +11 ms sits inside run scatter. Approved by Jawad on the code thread's card (save-kit durable on in Fancy and Pineapple).

## 2026.10.31.1326 (beta)

### Quick
The title screen redraws at the Battery saver's pace (28 ms between pictures) after 30 s with no touch, key or mouse move; any input restores full pace. Windows and cards are not throttled.

### Details
`drawGap()` returns 28 when the Battery saver is on or when `state === 'title'` and 30 s have passed since the last pointerdown, pointermove, keydown, touchstart or wheel (one capture-phase passive listener each). Game code run inside animation-frame callbacks per second at about 38 s idle, old to new: ungoogled Chromium 155.0.8059.39 22.7 to 16.7 ms, Firefox 158.0 190 to 97 ms, WebKitGTK 2.52.6 23.6 to 23.6 ms (noisy: 46 to 31 ms at 4 s). Callbacks stay 100-120 a second; only the drawing is skipped.

### Deep
Round 13 measured 217 ms of main-thread time a second after 60 s idle on the title (whole page, Chromium). The metric here is only the game's own callback time, so it is smaller. Throttling windows and cards was tried earlier and removed because the scenery shows round a window's edge and read as a crawl; this change touches the title state only and reuses the pace already accepted for the Battery saver. Gamepad-only idling is not counted as input, but any pad press on the title leaves the title within seconds. Owner approved by card.

## 2026.10.31.0846 (beta)

### Quick
The player file ships its script as four blocks (helpers, art and picture cache, small parts, game) instead of one, so the browser's compile of the 500 KB file is four short tasks. Same code, same look; the file is 5 KB smaller.

### Details
build.py minifies each group on its own (top-level names are not renamed in a classic script, so the blocks share one scope exactly as before) and writes four script tags. Start-up in Chromium 155: the single 60-80 ms task is gone (every block under 50 ms) and first paint moves from a median 132 ms to 84 ms (9 loads, alternating old and new). Firefox 158: first paint 137 vs 131 ms, page ready 109 vs 104 ms (equal within noise). WebKitGTK 2.52.6 (15 loads): page ready 27 vs 20 ms, first paint 38 vs 29 ms. File 499,274 to 494,284 bytes (gzip 176,342 to 174,591). Rebuild with the steps in src/README.md; the picture-cache signature is still computed from the whole script before the split, so cached pictures behave as before.

### Deep
Profile first: the 60-80 ms start task is native "program" time, the browser compiling the script, not game setup and not the wasm. The file is 7 top-level statements, two of them huge (game 237 KB, art 182 KB), so a split can only fall at those boundaries. Lazy-compile hints do nothing here because every wrapper runs at once and inner functions are already compiled lazily; the only inline data is a 10 KB base64 string (the wasm), and the art file is drawing code, not data, so moving it to a data block would not cut compile work. Look check at 412x892 after 2.5 s: no script errors in any browser; the title animates, so pictures never match exactly even old against old (97.6% Chromium, 92.1% Firefox, 66.4% WebKitGTK); old against new was 97.3%, 95.7% and 75.5%, inside that noise. Tested with Firefox 158.0, ungoogled Chromium 155.0.8059.39-1 and WebKitGTK 2.52.6, one at a time.

## 2026.10.31 (docs and one color, PR 26 and 27)

### Quick
The landing page is now the front page and the game lives at /play/. The "You won" title is a darker orange-brown so it is easier to read. Nothing else in the game changed.

### Details
PR 26: about.html became the root index.html; the game file moved unchanged (100% rename) to play/index.html; links and docs updated. No redirect and no service worker, so the old root address now shows the landing page. PR 27: `#pWin h2` color #e8890c to #9a4f00, contrast on the cream card from about 2.4:1 to about 5.6:1 (WCAG 2.2 SC 1.4.3). Two files, one value.

### Deep
Contrast computed from the card gradient (#fff7d2 to #fff9e8): #e8890c was 2.43:1 and 2.49:1, below even the 3:1 large-text minimum (26 px title; the white text-shadow does not count). #9a4f00 gives 5.58:1 on the darker end. #a85a00 (4.84:1 on the lighter end) was the alternative; the darker one was chosen to pass 4.5:1 across the whole gradient. Owner approved the look by merge tap. No picture-gate or speed run: static CSS color on a card that opens once per run.

## 2026.10.30 (docs only)

### Quick
Promises up front on the README and about page: no ads, accounts, data sent or microtransactions; nothing to install, no admin rights, no know-how; fully open source; single player; works offline (worded as once opened or saved, no offline install); any modern browser.

### Details
- Promises up front on the README and about page: no ads, accounts, data sent or microtransactions; nothing to install, no admin rights, no know-how; fully open source; single player; works offline (worded as once opened or saved, no offline install); any modern browser.

### Deep
- Promises up front on the README and about page: no ads, accounts, data sent or microtransactions; nothing to install, no admin rights, no know-how; fully open source; single player; works offline (worded as once opened or saved, no offline install); any modern browser. Checked: 0 requests outside the file in 15 s of play (Chromium); game fits 9 screen sizes from 320 x 568 to 2560 x 1440 with no page scroll in Chromium 155.0.8059.39, Firefox 158.0 and WebKitGTK 2.52.6 (WebKitGTK cannot go below a 447 px wide window in the driver).
- Built-in picture-by-picture How to play (the ? button) mentioned; there is no guided tour. Logo and chips left-justified in the page header like Apple Press.
- History rewritten on 2026.10.29 evening (owner's tap): the old title picture removed from all 17 branches; tips in the private review folder
- *Tested: about page in Ungoogled Chromium 155.0.8059.39, Firefox 158.0, WebKitGTK 2.52.6; no errors, no sideways scroll, 16 pictures load.*

## 2026.10.29 (docs only)

### Quick
README top and a new about.html in the landing style: logo above "What it is", Why it exists, Highlights, a gallery, the course, upgrade tiles captured from the game's own shop, a calmer-play section and a by-the-numbers strip.

### Details
- README top and a new about.html in the landing style: logo above "What it is", Why it exists, Highlights, a gallery, the course, upgrade tiles captured from the game's own shop, a calmer-play section and a by-the-numbers strip.

### Deep
- README top and a new about.html in the landing style: logo above "What it is", Why it exists, Highlights, a gallery, the course, upgrade tiles captured from the game's own shop, a calmer-play section and a by-the-numbers strip. Three new screenshots (Jam Jar Pantry, Ice Cream Parlor, upgrade shop) and a retaken title screenshot; the old title picture showed the owner's personal name and was replaced (still in earlier history, Support request drafted).
- Numbers on the page (build 2026.10.23.2236, Chromium 155.0.8059.39, phone-size view): median game work 0.4 ms per frame, 99% of frames under 2 ms, memory flat over 10 minutes (DOM nodes 857, heap 3.1 MB, canvases 36.5 MB), allocation 12 KB per frame with GC about 0.65% of main-thread time, first frame about 260 to 284 ms Chromium, 309 to 317 Firefox, 145 to 163 WebKitGTK (run noise about 10%).
- *Tested: page checked at desktop and phone width, light and dark: Ungoogled Chromium 155.0.8059.39, Firefox 158.0, WebKitGTK 2.52.6. No script errors, no sideways scroll, all 16 pictures load. index.html byte for byte unchanged.*

## 2026.10.23.2236 (beta)

### Quick
The "Oh no!" card, the launch words and the stage counter no longer cause a small hiccup the first time they appear in a run. Nothing looks different.

### Details
**2026.10.23.2236 (beta)** (repo PR 21, merged 2026-10-24, auto-merged under the invisible-change rule): about 15 text pictures the first run needs mid-play (Oh-no card: 21 built in one frame, about 8 ms; Tap to launch!, Go!, WHOOSH!, score digits at 52 px) are queued early, one per frame, in the existing text queue; text-picture limit 220 to 320. File 498,758 to 499,274 bytes.

### Deep
**2026.10.23.2236 (beta)** (repo PR 21, merged 2026-10-24, auto-merged under the invisible-change rule): about 15 text pictures the first run needs mid-play (Oh-no card: 21 built in one frame, about 8 ms; Tap to launch!, Go!, WHOOSH!, score digits at 52 px) are queued early, one per frame, in the existing text queue; text-picture limit 220 to 320. File 498,758 to 499,274 bytes. Worst frame in 24 s of play, 3 runs each (lower is better): 19.7/19.1/17.7 ms to 12.2/14.3/11.4 ms; p50 and p99 unchanged. Start-up to first frame, median of 20-30 alternating runs: Chromium 261 to 264 ms, WebKitGTK 133 to 130, Firefox 299 to 306 (+2.3%). *Tested: Chromium 155.0.8059.39-1 (full QA green, 90 s), Firefox 158.0, WebKitGTK 2.52.6; pictures 100.000% identical in all three; shipped page opens clean. GNOME Web no longer tested (owner rule 2026-10-24).*

## 2026.10.23.0013 (beta)

### Quick
If the game is already open in another tab or window, the new one now says so as soon as it opens and does not save over the other game. Its Reload button makes that copy the one in charge.

### Details
**2026.10.23.0013 (beta)** (repo PR 20, merged 2026-10-23): tab-guard 1.1.0 (JS-modules, Web Locks) added: a second open copy shows "Fancy is already open in another tab, so saving is paused here" at open and stops saving; Reload takes over (the other copy is told to stop). Skipped on `#test` pages. File 495,361 to 498,758 bytes (+3,397; player ceiling 600,000).

### Deep
**2026.10.23.0013 (beta)** (repo PR 20, merged 2026-10-23): tab-guard 1.1.0 (JS-modules, Web Locks) added: a second open copy shows "Fancy is already open in another tab, so saving is paused here" at open and stops saving; Reload takes over (the other copy is told to stop). Skipped on `#test` pages. File 495,361 to 498,758 bytes (+3,397; player ceiling 600,000). Start-up to first frame with vs without, lower is better, median of 16 to 30 alternating runs: Chromium 223 to 225 ms, Firefox 254 to 246, WebKitGTK 100 to 103, GNOME Web 118 to 118. *Tested: Chromium 155.0.8059.39-1 (full QA green, 84 s), Firefox 158.0, WebKitGTK 2.52.6, GNOME Web 46.5; pictures 100.000% identical; shipped page opens clean in all four; two-copies check passes in all four (twocopies.js for Chromium and Firefox, twocopies-wk.js for WebKitGTK and GNOME Web; both in fancy-banana/fuzz-2026.10.23/).*

## 2026.10.22.2251 (beta)

### Quick
The game file is about 37% smaller (495 KB instead of 791 KB), so it downloads and opens a little faster. Nothing looks different.

### Details
**2026.10.22.2251 (beta)** (repo PR 18, merged 2026-10-23): The shipped index.html is the esbuild-minified build (495,361 bytes, was 791,088; gzip 175 KB, was 245 KB). The readable source with comments and the rebuild steps are in the repo under src/ (esbuild 0.28.2; rebuild is byte-identical, checked with cmp).

### Deep
**2026.10.22.2251 (beta)** (repo PR 18, merged 2026-10-23): The shipped index.html is the esbuild-minified build (495,361 bytes, was 791,088; gzip 175 KB, was 245 KB). The readable source with comments and the rebuild steps are in the repo under src/ (esbuild 0.28.2; rebuild is byte-identical, checked with cmp). Start-up to first frame, readable to minified, lower is better: Chromium 241 to 211 ms, Firefox 253 to 249, WebKitGTK 99 to 92, GNOME Web 106 to 105 (10 to 24 alternating runs). *Tested: Chromium 155.0.8059.39-1 (full QA green), Firefox 158.0, WebKitGTK 2.52.6, GNOME Web 46.5; pictures 100.000% identical (readable test build vs minified test build); shipped page opens clean in all four.*

## 2026.10.22.2219 (beta)

### Quick
The first time the game opens on a device, Fancy's first face is now drawn in small steps too, so the opening stays smooth.

### Details
**2026.10.22.2219 (beta)** (repo PR 17, merged 2026-10-23): Fancy's first face, a 28 ms start-up step on a first visit, is drawn in slices while the title is built (no start-up step over 8 ms in Chromium; a saved copy is still used at once). Start-up to finished title vs 2131, median of 10 alternating runs, lower is better: Chromium 242 to 239 ms, Firefox 308 to 301, WebKitGTK 130 to 127, GNOME Web 120 to 114.

### Deep
**2026.10.22.2219 (beta)** (repo PR 17, merged 2026-10-23): Fancy's first face, a 28 ms start-up step on a first visit, is drawn in slices while the title is built (no start-up step over 8 ms in Chromium; a saved copy is still used at once). Start-up to finished title vs 2131, median of 10 alternating runs, lower is better: Chromium 242 to 239 ms, Firefox 308 to 301, WebKitGTK 130 to 127, GNOME Web 120 to 114. Also field-report 1.0.2 (the version it writes now matches its header). *Tested: Chromium 155.0.8059.39-1 (full QA green), Firefox 158.0, WebKitGTK 2.52.6, GNOME Web 46.5; pictures 100.000% identical to the previous release in all four.*

## 2026.10.22.2131 (beta)

### Quick
The first time the game opens on a device, the title is built in small pieces so the page never freezes for one long moment; the title can appear a little later.

### Details
**2026.10.22.2131 (beta)** (repo PR 16, merged 2026-10-23 on the owner's card tap, speed guard flagged; replaces the first 2027 build): On a first visit the title's scenery, news strip, title word and leaderboard column are built in pieces of about 8 ms (message-channel driven, drawn into a scratch canvas) instead of one first-frame task of about 130 ms in Chromium; the saved-pictures write reads rows in bands (was one 38 ms read); the 60 ms screen-fit timer no longer draws the whole title early (that draw was a 39 ms task).

### Deep
**2026.10.22.2131 (beta)** (repo PR 16, merged 2026-10-23 on the owner's card tap, speed guard flagged; replaces the first 2027 build): On a first visit the title's scenery, news strip, title word and leaderboard column are built in pieces of about 8 ms (message-channel driven, drawn into a scratch canvas) instead of one first-frame task of about 130 ms in Chromium; the saved-pictures write reads rows in bands (was one 38 ms read); the 60 ms screen-fit timer no longer draws the whole title early (that draw was a 39 ms task). Cost, start-up to finished title, median of 10 alternating runs, lower is better: Chromium 227 to 246 ms (+8%), Firefox 245 to 279 (+14%), WebKitGTK 107 to 119 (+11%), GNOME Web 106 to 117 (+10%). First version was +13% to +29%. Canvas size checked in four screen shapes: it never changes after the first build. Not sliced: the 28 ms banana-face step. *Tested: Chromium 155.0.8059.39-1 (full QA green), Firefox 158.0, WebKitGTK 2.52.6, GNOME Web 46.5; pictures 100.000% identical to the previous release in all four.*

## 2026.10.22.2026 (beta)

### Quick
On a struggling device the game now lightens its effects only when the frame rate really drops, and it does not flip back and forth.

### Details
**2026.10.22.2026 (beta)** (repo PR 15, merged 2026-10-22): The quality governor is replaced by fx-governor 1.1.1 (JS-modules): two slow 3-second stretches under about 36 FPS step one level down, a stretch under 18 FPS counts twice, never steps back up. Start-up medians (10 alternating runs, lower is better) old to new: Chromium 231 to 229 ms, Firefox 256 to 256, WebKitGTK 95 to 92, GNOME Web 106 to 97.

### Deep
**2026.10.22.2026 (beta)** (repo PR 15, merged 2026-10-22): The quality governor is replaced by fx-governor 1.1.1 (JS-modules): two slow 3-second stretches under about 36 FPS step one level down, a stretch under 18 FPS counts twice, never steps back up. Start-up medians (10 alternating runs, lower is better) old to new: Chromium 231 to 229 ms, Firefox 256 to 256, WebKitGTK 95 to 92, GNOME Web 106 to 97. *Tested: same four browsers; pictures 100.000% identical; full QA green (79 s).*

## 2026.10.22.2025 (beta)

### Quick
Smoother play on slower phones (less memory churn while you play), and the Help, Settings and Costume windows now break their lines more evenly.

### Details
**2026.10.22.2025 (beta)** (repo PR 14, merged 2026-10-22): Zero garbage per frame: about 16.0 to 6.2 KB per frame (Chromium heap sample, stage 2, after warm-up; lower is better) through a text-picture index, scratch arrays and fixed typed arrays; field-report 1.0.1 (Save downloads its file); text-wrap balance/pretty on Help, Settings and Costume (about 8 lonely last words to 0 in Chromium, WebKitGTK and GNOME Web; Firefox 158 keeps 3).

### Deep
**2026.10.22.2025 (beta)** (repo PR 14, merged 2026-10-22): Zero garbage per frame: about 16.0 to 6.2 KB per frame (Chromium heap sample, stage 2, after warm-up; lower is better) through a text-picture index, scratch arrays and fixed typed arrays; field-report 1.0.1 (Save downloads its file); text-wrap balance/pretty on Help, Settings and Costume (about 8 lonely last words to 0 in Chromium, WebKitGTK and GNOME Web; Firefox 158 keeps 3). Typed-array particles and image-decode adoption measured no gain and were not adopted (0 decodes of big pictures in all four browsers). Start-up medians old to new: Chromium 222 to 218 ms, Firefox 254 to 249, WebKitGTK 98 to 102, GNOME Web 96 to 102 (20-run repeat; spread about 10 ms). *Tested: same four browsers; pictures 100.000% identical; full QA green (78 s).*

## 2026.10.22.1905 (beta)

### Quick
A few more behind-the-scenes changes; nothing looks different.

### Details
**2026.10.22.1905 (beta)** (repo PR 13, merged 2026-10-22): The game now carries the shared recorder field-report 1.0.0 (JS-modules): started first so start-up errors are caught, it draws and sends nothing until asked, and then saves two small Markdown files on the device, a speed report (start-up time, FPS, slowest frames, heavy jobs) and an error log. The public text does not name the hidden trigger.

### Deep
**2026.10.22.1905 (beta)** (repo PR 13, merged 2026-10-22): The game now carries the shared recorder field-report 1.0.0 (JS-modules): started first so start-up errors are caught, it draws and sends nothing until asked, and then saves two small Markdown files on the device, a speed report (start-up time, FPS, slowest frames, heavy jobs) and an error log. The public text does not name the hidden trigger. Pictures: 100.000% identical in all four browsers. Start-up, page open to first drawn frame, median, before then after (lower is better): ungoogled-chromium 155.0.8059.39-1 363 to 351 ms, Firefox 158.0 409 to 370 ms, WebKitGTK 2.52.6 123 to 125 ms, GNOME Web 46.5 122 to 121 ms (all within noise of about 100 ms). The page grows by 17,918 bytes (+2.3%). The recorder check passes in all four browsers (10 of 10), the page policy is unchanged. *Tested: ungoogled-chromium 155.0.8059.39-1 (91 of 91), Firefox 158.0 (26 of 26), WebKitGTK 2.52.6 (3 of 3), GNOME Web 46.5 (3 of 3); not yet run on a phone.*

## 2026.10.22.1903 (beta)

### Quick
Small behind-the-scenes changes to how the game starts; nothing looks different.

### Details
**2026.10.22.1903 (beta)** (repo PR 12, merged 2026-10-22): The picture-drawing helper (sprite-baker 1.7.0) and the unpacker (lzma-decode 1.3.0) start compiling their WebAssembly in the background as soon as the file loads. Same pictures (title and stages 1, 2 and 4: 100.000% identical in all four browsers).

### Deep
**2026.10.22.1903 (beta)** (repo PR 12, merged 2026-10-22): The picture-drawing helper (sprite-baker 1.7.0) and the unpacker (lzma-decode 1.3.0) start compiling their WebAssembly in the background as soon as the file loads. Same pictures (title and stages 1, 2 and 4: 100.000% identical in all four browsers). Script start to first picture: no measurable change (Chromium 195 to 194 ms, Firefox 134 to 134, WebKitGTK 82 to 79, GNOME Web 84 to 88). Measured from the start of the page load it is flat to slightly slower in the two WebKit browsers (WebKitGTK 100 to 105 ms, GNOME Web 110 to 115, about 5 percent; Chromium 303 to 307, Firefox 349 to 342), which is why the merge card for this release names the speed guard. Page +790 bytes. *Tested: ungoogled-chromium 155.0.8059.39-1 (91 of 91), Firefox 158.0 (26 of 26), WebKitGTK 2.52.6 (3 of 3), GNOME Web 46.5 (3 of 3).*

## 2026.10.22.1855 (beta)

### Quick
Opening the game on a later visit is a little quicker in some browsers, and long stretches of picture building no longer hold up the screen.

### Details
**2026.10.22.1855 (beta)** (repo PR 11, merged 2026-10-22): First public release of the speed work done since 2026.10.16.2201, seven changes in one build. (1) Saves and save codes come from the shared save-kit 1.2.1: 17 of 17 save comparisons gave the same result as before, the page policy allows WebAssembly (+19 bytes).

### Deep
**2026.10.22.1855 (beta)** (repo PR 11, merged 2026-10-22): First public release of the speed work done since 2026.10.16.2201, seven changes in one build. (1) Saves and save codes come from the shared save-kit 1.2.1: 17 of 17 save comparisons gave the same result as before, the page policy allows WebAssembly (+19 bytes). (2) The 3D pictures are drawn by the shared sprite-baker (148 of 148 drawing buffers identical in four browsers). (3) Back swipe, screen wake, even frame steps and the quality governor come from four shared modules (25,891 frame times, 0 differences). (4) The 3D fill runs in WebAssembly where allowed, plain JavaScript as fallback (picture building 1.01 times as fast in Chromium, 0.98 in Firefox, 5 to 9 percent less time in the two WebKit browsers). (5) The wasm unpacker for the packed hand-out copy is not part of this page. (6) Banana pictures are built one 3D part at a time: the longest step is about 11 ms instead of 25 ms in Chromium. (7) The title scenery and Fancy's first face are saved in the browser between visits, exact pixels (9.4 million values, none differ): script start to first picture 149 to 122.5 ms in Chromium, 74 to 50 ms in WebKitGTK, 89 to 59 ms in GNOME Web, and 31 ms slower in Firefox, where it turns itself off; about 9.5 MB of browser storage per screen scale. Whole build against the live 2026.10.16.2201, six frames: 100.000% identical in all four browsers. Start-up from the start of the page load, median (lower is better): Chromium 269 to 230 ms (-14%), Firefox 276 to 287 (+4%), GNOME Web 125 to 122 (-2%), WebKitGTK 105 to 111 (+5.7%, over the 5% speed guard, named on the merge card). Page +63,291 bytes (701,716 to 765,007, +9.0%). *Tested: ungoogled-chromium 155.0.8059.39-1 (91 of 91), Firefox 158.0 (26 of 26), WebKitGTK 2.52.6 (3 of 3), GNOME Web 46.5 (3 of 3), picture keeper 4 of 4.*

## 2026.10.16 (beta)

### Quick
The title screen and the page header now credit LFC Foundry, and the game is open source under the MIT license. The share text at the end of a run links to the game's new home.

### Details
**2026.10.16.2201 (beta):** The title screen now reads "Copyright © 2026 LFC Foundry", the page header links to github.com/lfcfoundry, and the repository now carries an MIT license file. No gameplay change.

### Deep
**2026.10.16.2201 (beta):** The title screen now reads "Copyright © 2026 LFC Foundry", the page header links to github.com/lfcfoundry, and the repository now carries an MIT license file. No gameplay change. *Tested: Title screen checked in Chromium 153 before release. After release the full checks ran on ungoogled Chromium 155.0.8059.39 (91 of 91) and Firefox 158.0b5 (26 of 26, on the third run).*

**2026.10.16.1651 (beta):** The bookshelf in the home scene now says "a story written in the Story Editor" again. The previous build had brought the old tool name back. No gameplay change. *Tested: Not run in a browser; rebuilt from source and compared with the live page byte for byte.*

**2026.10.16.1032 (beta):** The share text at the end of a run now links to the game's new home, https://lfcfoundry.github.io/fancy-banana/. No gameplay change. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.16.1000 (beta):** The bookshelf now says "a story written in the Story Editor", with the old tool name removed. No gameplay change. *Tested: No browser check recorded.*

## 2026.10.14 (beta)

### Quick
Every button can now be reached with a keyboard or a screen reader, and a back swipe (or the Back key) closes an open window. The buttons show a yellow ring when pressed, and on a phone held sideways they sit beside the game at a comfortable size. The space around the game takes on the colors of the current stage. The stage times at the top right no longer run off the edge of the screen. Saves are safer: if the game is open in two tabs, the older tab stops saving and tells you, so it cannot overwrite your newer game. While a window (Settings, Help, Save) is open, the game behind it can no longer be tapped by accident. After five tries at the same stage, a small card offers a slower speed or a look at Upgrades. The Save window says when you last saved, and a new "Put my old game back" button undoes a Load or a Start fresh. W A S D steering in the water level works with Caps Lock on and on other keyboard layouts. The run pauses if you switch to another window or unplug a controller. Windows high-contrast colors keep clear button borders.

### Details
**2026.10.14.1352 (beta):** Every button in the game can now be reached with a keyboard or a screen reader, and a back swipe (or the Back key) closes an open window. Pressing any button shows a yellow ring. On a phone held sideways the buttons sit beside the game at a comfortable size and the windows are bigger. The space around the game now takes on the colors of the current stage instead of plain purple.

### Deep
**2026.10.14.1352 (beta):** Every button in the game can now be reached with a keyboard or a screen reader, and a back swipe (or the Back key) closes an open window. Pressing any button shows a yellow ring. On a phone held sideways the buttons sit beside the game at a comfortable size and the windows are bigger. The space around the game now takes on the colors of the current stage instead of plain purple. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.14.1211 (beta):** Fixed the stage times at the top right (under the pause button) running off the edge of the screen. They now sit fully on screen, including on long runs and in the left-handed layout. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.14.0829 (beta):** Safer saves and a little help. While a window (Settings, Help, Save and so on) is open, the game behind it can no longer be tapped or reached with the keyboard. If the game is open in two tabs, the older tab now stops saving and says so, with a Reload button, instead of overwriting the newer game. After five tries at the same stage, a small card offers a slower speed or a look at Upgrades (also in Help, under "Ways to make it easier"). The Save window now says when you last copied your save code or saved a file, and the game asks the browser to keep your saved data. If your device resets the picture, the game pauses and draws again. At fractional browser zoom the picture is now exactly one pixel to one screen pixel. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.14.0004 (beta):** Small comfort fixes. W A S D steering in the water level now works with Caps Lock on and on other keyboard layouts. On a computer, clicking another window or switching with Alt-Tab pauses your run, and unplugging a controller pauses it too. The Save panel has a new "Put my old game back" button that undoes a Load or a Start fresh (the game you replace is kept, so you can swap back). With Windows high-contrast colors, buttons keep clear borders and the selected choice stays visible. *Tested: Chromium (version not recorded) and Firefox 158.*

## 2026.10.12 (beta)

### Quick
Two rounds of bug hunting fixed many small problems, such as text overlapping on result cards, buttons hanging off cards, and an obstacle showing the wrong stage's art after a quick retry. Changes to Settings (large buttons, left-handed, Calm mode) now show at once on a paused screen. The scenery behind an open window no longer slows down. The "perfect" streak label no longer prints over the stage progress text.

### Details
**2026.10.12.1257 (beta):** Rebuilt from source with the JNFoo copyright line. No gameplay change.

### Deep
**2026.10.12.1257 (beta):** Rebuilt from source with the JNFoo copyright line. No gameplay change. *Tested: No browser check recorded.*

**2026.10.12.1236 (beta):** The title-screen copyright line now reads JNFoo. *Tested: No browser check recorded.*

**2026.10.12.1106 (beta):** The Banana Bunch is packed tighter in the rucksack, and the rucksack and bananas now spin with Fancy in his spiral. Scenery behind any open window (Challenges, Settings, Upgrades and the rest) no longer slows to a crawl. *Tested: No browser check recorded.*

**2026.10.12.1017 (beta):** The "x perfect" streak label no longer overprints the stage progress text. *Tested: Chromium (version not recorded); no Firefox check recorded.*

**2026.10.12.0618 (beta):** **Second bug hunt, this time in the drawing code.** Fixed: an obstacle could show another stage's art after a quick retry; the Gorilla Guard arena could go missing after a screen resize; the gorilla's open hand had a wrong shine; cool shades flickered off on every blink; text overlapped on the victory card and the balloon result card; the Cloud and Volcano result buttons hung off their card; settings changes (large buttons, left-handed, Calm) now show at once on a paused screen; the water-level wake no longer pops in at the top of a leap; the controller hint no longer covers the pause list. **Pay to continue** now counts as one attempt in your lifetime stats. *Tested: Chromium (version not recorded); no Firefox check recorded.*

**2026.10.12.0151 (beta):** **A big bug hunt.** Three code reviews and about half a million random taps, keys, purchases and stage jumps in two browsers found and fixed these: *Tested: Chromium (version not recorded) and Firefox 158.*
  - Spending: bananas bought with coins came back after a reload, and "Start brand new" was undone by one. Fixed, and a damaged save can no longer hand out credits or levels.
  - Volcano Run: the lava streams now hurt where the lava is drawn (the gaps were the wrong way round).
  - Winning: after the last gate you can no longer lose the win by bumping something; a golden gate can no longer pull you into a vault in the middle of a boss fight; the one-run spare bounce and spare heart are spent once, not twice, around the balloon gift.
  - Super Potassium: once per stage now means the stage where the blast started, you get a moment of safety when it ends, and moving gates stay smashed.
  - Controls: arrow keys no longer stick when you switch windows, a double tap on a Back button no longer starts a run, a tap beside an open window no longer resumes the game behind it, and a controller can now pause and leave Chimp Airforce, Volcano Run and Fancy's Place.
  - Small things: Help no longer draws blank icons the second time it opens, the Secrets count reads N of 11, the Surprise gift never wastes bananas on a full stock, and a few cards and lists show the right lines in the secret games.

## 2026.10.11 (beta)

### Quick
Fancy's costumes now spin with him in his rolls. New secrets to find for players who keep playing. Backward stages are much smoother in Chrome and similar browsers, and Firefox scrolls more smoothly too. Fixed Firefox freezing on a backward stage. The Space bar always flaps during a run, even after you clicked a button. A trail effect you can earn now announces itself and switches on right away. The win card after Prince Chimp runs much smoother. The game file is about a quarter smaller.

### Details
**2026.10.11.2354 (beta):** **Banana Bunch as a rucksack:** a small brown pack with three banana friends poking out, strapped to Fancy's back. **Crown Duel cookies are fairer:** a pulsing ring now shows where each falling cookie will cross, and the close pairs come further apart. (Test Lab: Helpers are at the top, and Back to title brings the title buttons back.)

### Deep
**2026.10.11.2354 (beta):** **Banana Bunch as a rucksack:** a small brown pack with three banana friends poking out, strapped to Fancy's back. **Crown Duel cookies are fairer:** a pulsing ring now shows where each falling cookie will cross, and the close pairs come further apart. (Test Lab: Helpers are at the top, and Back to title brings the title buttons back.) *Tested: No browser check recorded.*

**2026.10.11.2332 (beta):** **A new look for the Banana Bunch:** instead of six little friends flying in a clump, it is now one bunch of six banana friends on a stem, worn on Fancy's back like a backpack. It swings as he climbs and falls, and it shows in the Costume picker, on the prize shelf and in the mirror in Fancy's Place. *Tested: Chromium (version not recorded); no Firefox check recorded.*

**2026.10.11.2201 (beta):** **Volcano Run:** a new Emporium key (the Volcano key, 400 bananas) adds a Volcano button to the title screen: a secret level inside the volcano. Flap through falling lava streams whose gaps slide down, rock doors that open and close on a beat, and narrow slots, all above a lava lake that burns. Reach the way out for 40 bananas and a Volcano medal on the wall in Fancy's Place. *Tested: No browser check recorded.*

**2026.10.11.2141 (beta):** **Chimp Airforce:** a new Emporium key (the Cloud key, 300 bananas) adds a Clouds button to the title screen: a secret flying game. Tap to flap through open sky, dodge the Chimp biplanes (some hide inside cloud banks), survive the Chimp bomber's coconuts, and reach the volcano for 25 bananas and a Cloud medal on the wall in Fancy's Place. Lime defense shoots planes and coconuts. Fancy's wall has more room for plaques and prizes. *Tested: No browser check recorded.*

**2026.10.11.2059 (beta):** **Super Potassium:** a new Emporium upgrade (250 bananas, needs Potassium Power). Hold the tap for half a second when you are not lined up with a gate: Fancy blasts forward for a few seconds, smashing anything he touches without a scratch. Once per stage, in normal stages. It hangs on the wall at Fancy's Place. Potassium Power itself now works in every stage before the boss fight, even after your second win (it used to switch off for the whole run). *Tested: No browser check recorded.*

**2026.10.11.2040 (beta):** **Boomerang key and Boomerang Chimp:** a second Emporium key (300 bananas) turns the secret boss at the end of Chimp's Navy into Boomerang Chimp. Dodge his boomerangs: any that miss you swing back and hit him, and three hits win 20 bananas, a secret and a medal on the prize shelf in Fancy's Place. You need all your hearts to reach him. *Tested: No browser check recorded.*

**2026.10.11.2028 (beta):** **Night Balloon key:** the Emporium has a new shelf, 'Keys to secret places', and its first key (200 bananas) opens a second Balloon Party at night right after the Fruit Garden: 40% more balloons, a faster sky and a bigger finish bonus. The key shows on the wall in Fancy's Place. *Tested: No browser check recorded.*

**2026.10.11.2018 (beta):** **Fancy's Place:** a little door at the bottom right of the title screen (once the Emporium is open) leads to Fancy's home. His power-ups, costumes and boss prizes hang on the walls, there is a mirror that opens the Costume window, an Apple Press arcade machine that is out of order, and a bookshelf with Lunch Trip, The Keeper's Light, Bolivar's Treasure and Yesterday's Soup. Tap the floor to walk Fancy around, tap anything on the wall to read about it. *Tested: No browser check recorded.*

**2026.10.11.1959 (beta):** **Lime missiles shoot gulls, and a few fixes:** the Lime defense upgrade now also shoots down a seagull that is about to hit you in Chimp's Navy (2 per level per run, shown beside your hearts). The Sky Vault can now be found at the start of a run. The game rests while the Save to file or Load from file window is open, so it no longer crawls behind it. The ticker lost its banana jokes and gained some little known facts. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.11.1815 (beta):** **Mirror launcher and a better gift scene:** on a mirror stage the launcher is now turned round too (after a paid retry it used to shoot Fancy the wrong way and flip him in mid air), and in the balloon gift scene Fancy now hovers in the open instead of sitting on the launcher. The water bonus game also lets go of its big pictures afterward, saving about 9 MB. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.11.1730 (beta):** **No pause after the water bonus game:** the Fruit Garden's backdrop is now built a little each frame while you play the bonus game (and quickly if it ends early), so the flight resumes without the 200 to 300 ms hitch. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.11.1703 (beta):** **Boss fights are part of the main game:** after your second win, the last two gates of the jungle finale now give way to Prince Chimp's fights on their own, in the same order as before. The "Prince Chimp fight" button in Challenges now turns them off (and back on). *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.11.1650 (beta):** **The rainbow trail is announced:** when you land your 10th perfect gate in a row, the game now says "RAINBOW TRAIL unlocked!" and the trail switches on right away (it used to turn on silently after the run). Turn it off in Settings. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.11.1618 (beta):** **Fixed the freeze on the mirror flip in Firefox:** going into a backward stage (like the Ice Cream Parlor after the Jam Jar Pantry) could lock the picture upside-down-backwards. The Firefox sky-and-hills layers now switch off on backward stages, which use the same drawing as before. Test Lab: the hitch report no longer counts a paused game's rests as hitches. *Tested: Chromium (version not recorded) and Firefox 158; Firefox 153 could not reproduce the freeze.*

**2026.10.11.1603 (beta):** **Firefox layers get ready ahead of time:** the next stage's sky and hills are prepared a piece at a time while you play, so a stage change adds no extra pause. Title, pause, death card and every other screen look as before (checked against the old drawing). *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.11.1546 (beta):** **Smoother scrolling in Firefox:** the sky and hills now ride on their own layers that Firefox slides by itself, so the game draws about half as much each frame and Firefox no longer drops frames (Ice Cream Parlor and every other stage). Chrome, Edge and phones draw exactly as before. The Test Lab can switch it back for comparison. *Tested: Chromium (version not recorded) and Firefox 158; Firefox 153 for the timing runs.*

**2026.10.11.1537 (beta):** **Test Lab, for Firefox smoothness:** a new 'Background: slid by the browser' switch makes the sky and hills separate layers that the browser moves by itself, so the game draws about half as much each frame (measured 9 to 4 ms in Firefox). It looks the same. It is off unless you switch it on. Two new rows in the smoothness report compare it. *Tested: Chromium (version not recorded) and Firefox 158; Firefox 153 for the timing runs.*

**2026.10.11.1505 (beta):** **Test Lab:** the 'Drawing sharpness' buttons now include lighter choices (1x and 0.8x, drawn smaller and stretched by the browser, like a phone does), and the smoothness test no longer lets the automatic quality control change things between rows. The game itself is unchanged. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.11.1455 (beta):** **Test Lab:** new 'Drawing sharpness' buttons draw the game at 2x or 2.5x and let the browser shrink it (this is what makes a phone look smooth), so you can judge by eye whether it fixes the laptop. Two new rows in the smoothness report compare it. The game itself is unchanged. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.11.1444 (beta):** **Test Lab:** Fancy now bobs up and down with real flaps during the smoothness test (he used to hang still), and three new switches let the canvas ride on its own browser layer, to see whether that makes forward stages as smooth as backward ones. Two new rows in the smoothness report compare them. The game itself is unchanged. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.11.1428 (beta):** **Backward stages are much smoother in Chrome and other non-Firefox browsers:** the whole picture is now turned over in one step instead of picture by picture (it was dropping to about 30 frames a second). **Test Lab:** an automatic Smoothness test measures every stage setting on your own device and writes a report. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.11.1352 (beta):** **Test Lab:** jumping to a stage no longer carries the launcher's speed boost, so the stage starts calmly with its first gate a couple of seconds away. The game itself is unchanged. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.11.1344 (beta):** **Test Lab:** jumping to a stage now works at once (Stage 1 to 5 buttons), with a switch to make the stage backward always, never or random, and Fancy cannot be hurt while you test. The game itself is unchanged. *Tested: Chromium (version not recorded); no Firefox check recorded.*

**2026.10.11.1333 (beta):** **Costumes spin with Fancy:** the bow tie, crown, top hat and cool shades now roll around with him in his spirals. **Gorilla Guard's hands** now have their thumbs toward his body. **The big crown** after the Crown Duel is drawn crisper, with a golden glow and twinkling stars, and floats up to Fancy's head. **Test Lab:** a new Motion smoothness block lets you switch the stepping mode, pillar movement, how backward stages are flipped and baked pictures, and shows your screen's refresh rate and how evenly the game steps. *Tested: Chromium (version not recorded); no Firefox check recorded.*

**2026.10.11.1317 (beta):** **Space bar flaps during a run no matter what was clicked before:** if a button still had the keyboard, Space used to press it (in the Test Lab, it reopened the menu). Now Space always flaps in a run. *Tested: Chromium (version not recorded); no Firefox check recorded.*

**2026.10.11.1310 (beta):** **Space bar fixed after clicking buttons:** a button you clicked used to keep the keyboard, so Space pressed it again instead of flapping (in the Test Lab it just reopened the test menu). Buttons now let go after a click or tap. *Tested: Chromium (version not recorded); no Firefox check recorded.*

**2026.10.11.1300 (beta):** **A secret shop: the Emporium!** Clear the Balloon Party twice and a door with a gold star appears on the Balloon Party result card (tap it), and an Emporium button joins the title screen. It sells a top hat and cool shades for Fancy, a Mega magnet and a Golden heart (an extra Navy heart), star and heart trails, confetti flaps, and one-run perks (a spare bounce, a spare heart, a surprise gift), all paid with banana credits. **Wafers:** only the chimps on the barrels throw vanilla wafers now, never a submarine. **Test Lab:** a new Pillar movement switch lets you compare smooth and whole-pixel sliding of the obstacles. *Tested: Chromium (version not recorded); no Firefox check recorded.*

**2026.10.11.1234 (beta):** **Victory card after Prince Chimp runs much smoother:** the win card and its table are drawn as one still picture once they settle, the scenery hidden behind the card is not drawn, and background picture building waits until the card finishes. **Prince Chimp's hands:** the hand holding the scepter is now a proper left hand (he no longer has two right hands). **Prince Chimp's throwing arm** is now a proper arm with an elbow and both his fists now have the thumb on the side facing his body (it used to stretch like a noodle off the top of the screen). **The "What now, hero?" window no longer makes the victory card stutter**, and **the Gorilla Guard and other boss fights are smoother** (about a quarter less time per frame) between rounds and when he is beaten (the cheering crowd and the round-cleared word cost less to draw). **Lost banana friends** (found after two wins) now always sit in a gap that a child can reach at that stage's speed, instead of in almost impossible spots along the bottom. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.11.0020 (beta):** **The shareable game file is 25% smaller** (111 KB instead of 148 KB; the Test Lab copy 162 KB instead of 224 KB). The game inside is unchanged. The file must be opened as it is (not re-saved as text); if it was changed, it says so. Starting it takes about 30 ms longer. *Tested: No browser check recorded.*

## 2026.10.10 (alpha, then beta)

### Quick
The game is now in beta. Tap, click or press Space to start after each stage card, so the next stretch never begins before you are ready. Every window has a round Close button that stays in view while you scroll. New upgrade: Potassium Power. Hold to glide through lined-up gates. One stage in each run is now flipped like a card and flies right to left. You can pay 100 banana credits to try a stage again after a bonk. New result cards with kid-friendly words, and a rebuilt Upgrades window that needs much less scrolling. A run timer under the pause button shows split times for each stage. The water level is polished: a lush beach, a heart buoy half way across, red submarines in the back half, and fish drifting under the surface. On a phone, dragging in the water level only steers; a quick tap leaps. Hitting the top pillar with a free bounce no longer fires Fancy into the floor. Smoother scrolling: obstacles, scenery and Fancy glide by fractions of a pixel instead of hopping. A glossier, toy-like look: chunky buttons, shinier Fancy, friends and coins, brighter launch lights, and a real gold banana as the coin. Fixed several stutters in Firefox, including one in the Silverware Drawer. The game now has Challenges and secrets for players who beat Prince Chimp, and more reasons to keep playing.

### Details
**2026.10.10.2346 (beta):** **Title letters sit properly now:** every letter has the same small gap to its neighbors (no more letters fusing into each other), and the cream sticker outline and shadow run around the whole title without notches where letters meet. Also new from the previous build: cheaper rocket glow and result cards, and each stage's paint textures are made only when needed.

### Deep
**2026.10.10.2346 (beta):** **Title letters sit properly now:** every letter has the same small gap to its neighbors (no more letters fusing into each other), and the cream sticker outline and shadow run around the whole title without notches where letters meet. Also new from the previous build: cheaper rocket glow and result cards, and each stage's paint textures are made only when needed. *Tested: Chromium (version not recorded); no Firefox check recorded.*

**2026.10.10.2338 (beta):** **Smoother rocket flames and result cards:** the glow under the Prince's and robot's rocket jets and the result cards (Oh no, Stage cleared, Made it to shore) now cost less to draw, with the same look. Less is built when the game starts: each stage's paint textures are made only when you get near that stage. For testers: the Test Lab has a new **Input lag** panel that shows how long clicks and the spacebar take to reach the game and to the next frame. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.10.2320 (beta):** **Fancy is now in beta!** **Phone water level:** dragging now only steers Fancy; a quick tap still leaps (a leap used to fire the moment your finger touched down). **Free bounce fixed:** hitting the top pillar no longer fires Fancy into the floor. **Backward levels:** the picture no longer flips back in view before the water bonus, and the backward Silverware Drawer is as smooth as the forward one in Firefox. **Prince Chimp** now throws overhand with a real arm, and in reruns of the Crown Duel he **claps and vanilla cookies fall from above**. **Messages** that pop up now stack instead of landing on each other. The **news ticker scrolls more smoothly**. **Faster and lighter:** the game stops redrawing behind open windows, builds the boss pictures only when you reach the last stage, and the title screen costs about half as much in Firefox. The gorilla arena now also appears for players who start the game with that fight waiting. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.10.2158 (alpha):** **Gorilla Guard now fights in a jungle clearing!** The scenery stops scrolling while he squats, and a special still background appears: coconut palms and three rows of log seats packed with gorillas and chimps. They watch, **cheer when Fancy gets hit**, look **sad when Fancy wins a round** and **cry when the gorilla is beaten**. The gorilla's **arm now winds up and throws**, and he **slams with both arms**. **Prince Chimp** throws with a floating glove and flicks his scepter with a glow, and a **big rocket flare** burns under his floating throne. **Mecha-Chimp's rocket flares** are centered under his feet and look hotter, with glowing shock diamonds. **Retrying a backward stage** for 100 credits now keeps it backward. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.10.2117 (alpha):** **Tap to start!** After a stage card, the water level's instructions and a boss's title card, the game now waits for you: tap, click or press Space and Ready, Set, GO begins (a tap a moment into a card skips the rest of it). Every window (Help, Settings, Upgrades and the rest) has a **round Close button that stays in view while you scroll**, and Help is shorter. The **Ice Cream Parlor pillars** no longer have a stripe of shine across the round scoops. **Smoother scenery**: the hills and the garden slide by fractions of a pixel (on plainer screens), and the backward levels are cheaper to draw in every browser but Firefox. The **first boss's cannon smoke** now trails from the cannon for a moment instead of hanging in mid air. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.10.1953 (alpha):** **Water level:** the red submarines now come in the **back half** (with the fiercer red gulls); the first half has the purple ones. Exactly **half way across, a heart buoy** floats by: touch it to win back a heart if you have lost one. The **tiki torches on the beach are alive** now (flickering flames, glow and embers), and **fish and the dark shapes of submarines drift by far under the surface**. **Smoother obstacles:** gates and everything in the water level now glide by fractions of a pixel (like Fancy does) instead of snapping to whole pixels, and so does the floor. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.10.1916 (alpha):** **New upgrade: Potassium Power!** (120 credits). Whenever three or more gates in a row line up, a little hint says "Hold: Potassium Power!". Hold Space, the mouse button or your finger: Fancy charges up (a ring fills around him), glides straight through the gates on his own, and flies up to 25% faster, leaving fading echoes of himself. Let go to take over again. Gates you glide through do not count for PERFECT bonuses. It works in every normal stage and in practice, but not in the water level or the boss fight. With the upgrade, lined-up gates show up more often. In the upgrades list the tile reads "Hold when 3+ gates line up: Fancy glides straight through, a bit faster". *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.10.1900 (alpha):** **A backward level!** In one stage between 1 and the water level (picked by chance each run: Jam Jar Pantry, Ice Cream Parlor or Silverware Drawer) the whole picture flips like a card and Fancy flies right to left. **Keep going!** After a bonk on stage 2 or later you can pay 100 banana credits to start that stage again. **New result cards** for Bonk, Splash, shore, balloons and winning, with kid-friendly words and clear choices; the win choices are now big colorful options. **The Upgrades window is rebuilt**: a close button floating at the top, a grid that needs much less scrolling, and a 'Saving up for...' list. **Red submarines** (longer and faster) in the first half of the water level and a **red gull** (a little fiercer) in the second half. After the water level the **vines dip down** now and then, and in the Jungle Kingdom the **roof and floor pieces move closer together** (with a thinner outline). The **news ticker moved to the top** of the title screen with new headlines. The launch sparks are more chaotic, and scrolling is evened out again. *Tested: No browser check recorded.*

**2026.10.10.1827 (alpha):** **The launch lights are now only small magnesium sparks** racing round the loop and along the run-up (the bulbs are gone). **Smoother scrolling**: obstacles, scenery and Fancy are now drawn where they will be when the picture is shown, so they glide instead of hopping a step or two from picture to picture (in the water game too). **A much better beach in the water game**: a lush jungle wall with flowers, shaded palms, tiki torches, a sandy shore with foam and waves washing in, shells, a starfish, a gate with bunting, and new wooden signs with gold lettering. *Tested: No browser check recorded.*

**2026.10.10.1810 (alpha):** **Launch lights are now burning-magnesium flares**: a blown-out white core, a cool blue glow, long crackling sparks and flicker, with hot sparks flying off the leading bulb. **New run timer** under the pause button (it counts from the end of the 3-2-1 and stops while paused) with split times for each stage clear, the water bonus, boss fights, Balloon Party and the win. **The water bonus game is polished**: a new glossy Fancy with paddling gloves, foam wakes behind Fancy and the subs, ripples when you leap, land or get hit, sunlight patterns and sparkles on the water, rainbow soap bubbles around your friends, shinier subs and a gold progress bar. *Tested: No browser check recorded.*

**2026.10.10.1743 (alpha):** The launch contraption's dark strip is now a **glowing neon tube**, and the bright lights are **white-hot starbursts** with long sparkling rays, like a bulb going off. (No stutter confirmed on the previous build.) *Tested: No browser check recorded; a Firefox 158 profile from a Windows 11 laptop showed no stutter.*

**2026.10.10.1730 (alpha):** A second attempt at the Silverware Drawer stutter: all of the game's behind-the-scenes picture canvases are now kept in ordinary memory instead of on the graphics card, so the card only receives finished pictures when they are really drawn. *Tested: No browser check recorded.*

**2026.10.10.1725 (alpha):** The launch contraption's **dark light strip is thinner and the bulbs are smaller**, with the same bright glow and sparkle. *Tested: No browser check recorded.*

**2026.10.10.1719 (alpha):** **Found the Silverware Drawer stutter** thanks to your Firefox profile: when the next stage's pictures were being prepared, the game sent dozens of pictures to the graphics card in a single frame and the AMD driver froze for about a fifth of a second. Pictures are now sent a few at a time. The **banana coins' glossy shine is back** (a long streak, a bright dot and deeper gold on one side) and it turns with the coin as it spins. *Tested: No browser check recorded; the stutter was found in a Firefox 158 profile from a Windows 11 laptop.*

**2026.10.10.1700 (alpha):** **Forest beach garden:** the leafy roof is now one solid canopy (the leaves and vines grow out of it instead of floating), the poles that hang from it are **thick twisted vines** that end in a fruit bud, and the tree trunks have no more seams. **Prince Chimp's cannon** blows a plume of smoke out of its muzzle every time it fires. The **launch lights** are much brighter, with a glowing halo and a sparkle on the brightest bulbs. Obstacle shadows are gone, the gate count sits higher (level with the pause button), and the banana coin's shine now sweeps across its face. The test copy now has a built-in **hitch recorder** that writes a small report about any slow frames, so we can find the Silverware Drawer stutter on your machine. *Tested: No browser check recorded.*

**2026.10.10.1629 (alpha):** Found and fixed the real cause of the Silverware Drawer stutter: the game's cache of word pictures was emptied completely once it filled up (around the fourth gate of the Drawer), so every word on screen was rebuilt in a single frame. It now only drops pictures that have not been used for a while. The stage-art builder also keeps to a schedule now, so a slow computer finishes the next stage in time. **Launch lights** are bright glass bulbs in a dark strip: a bright head races around the ring, the whole string blinks, and a second row chases along the ramp. **Banana coins** are a little smaller, richer gold, have no shadow, and spin like a coin on the vertical. **Foreground obstacles** look like round glossy toys: tube shading, shiny end pieces, soft shadows on the scenery behind them and a glint of light now and then. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.10.1603 (alpha):** The title letters now touch and their cream borders blend into one shape. The **banana coin is a real gold banana** now, with peel ridges, a stem and tip, and a shine that sweeps along it (no more spinning). The **pennant string is 40% shorter** and still waves in the wind when you fly straight up or down. The **launch contraption** has glass light bulbs that glow, outlines, rim lights and a twinkle running around the ring. **Balloons pop six different ways** (confetti, swirl, snap, ring, limp drop and more), and gold balloons burst into stars. Fixed another Firefox stutter at the start of the Silverware Drawer: the next stage's pictures now start building as soon as a stage begins, and faster once you are halfway through. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.10.1430 (alpha):** A glossier, more toy-like look. **Fancy, his friends and the banana coins** now have a long shine streak with a bright dot, deep golden shading toward the lower right and a white edge light; the coins also twinkle. Gates and other foreground pieces get the same edge light, the floor has a lit top edge, and the sky has a soft vignette. The title letters are spaced so their outlines no longer touch. The title text, the Oops card and the Paused text sit higher on the screen. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.10.1410 (alpha):** **The Gorilla Guard is redrawn**: a rounder, glossier gorilla with proper shoulders, a big open hand holding the coconut, a fist resting on the floor, toes, ears and big shiny eyes. All three-dimensional toys now have deeper shading toward the lower right, a brighter shine and a white edge light, and Fancy and the bosses pop more from the background. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.10.1359 (alpha):** Fixed a stutter on Firefox a few seconds into the Silverware Drawer. The water bonus level's pictures now get built in tiny pieces right after the first gate, and the words for the progress line and the stage card are prepared ahead of time instead of all at once. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.10.1344 (alpha):** A softer, toy-like look inspired by the Apple Press style. Buttons are now **chunky and glossy** with a thick lip that squishes when you press them. The title leans slightly and sits on a soft shadow. Fancy's **blush changes with his mood** (rosy when happy, deep when surprised, pale when gritting his teeth), his eyes have a slightly bolder outline, and a cool white **rim light** and a sharper sparkle make every 3D toy pop off the background. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.10.1232 (alpha):** New upgrade: **Lime defense** (150 credits, then 300). In boss fights, when a coconut is about to hit you, a little rocket-propelled lime shoots out, chases the coconut and pops it (2 limes per fight for each level). It only fires in the last half second, so you still get to dodge first. Shown on the pause screen and as a small L badge while you fly. *Tested: No browser check recorded.*

**2026.10.10.1213 (alpha):** Boss fights feel more like a party. **Close calls** in a fight now get a cheer and sparkles. Each time you survive a round, a big **encouraging word** pops up (Flawless! Great dodging! Banana-tastic!) with confetti, and the boss bar is now **three segments** with a star that lights as you clear each round. The **crown is now a real 3D gold crown** with pearls and jewels, on Fancy, on the crown pieces and on Prince Chimp. Mecha-Chimp's **rocket flames** are bigger and hotter, bosses kick up dust as they arrive and leave a trail of stars when beaten, and Fancy does a victory roll. *Tested: No browser check recorded.*

**2026.10.10.1154 (alpha):** Boss fights get a graphics pass: all four bosses are redrawn with softer 3D lighting and more detail, the wagon hangs from the same glossy balloons as the Balloon Party (they sway and float away when you win), lasers glow, rocket fists trail flame and smoke, shockwaves look like real waves, and bosses cast a shadow on the floor. Balloons everywhere got a richer shine. **Fancy now makes an "oh!" face** (wide eyes, round mouth, a sweat drop) on a long drop, like a rollercoaster; he keeps the gritted teeth for bounces and hits. Secrets such as the sky vault can no longer open during a boss fight, and a fight never begins with the launch spiral. *Tested: No browser check recorded.*

**2026.10.10.1122 (alpha):** Fights now make sense in the game world: Prince Chimp's wafers shoot out of his cannon, Mecha-Chimp hovers on rocket boots and launches its fists and lasers from its own arm and chest, the Gorilla holds a coconut and throws it, and shockwaves come from a stomp. **New: your upgrades are on show.** Pause the game to see everything switched on (upgrades with levels, free bounces left, Second wind ready or used, game speed, victory bonus, your active Challenge and fight), and a tiny row of letter badges under the stage text shows them while you fly. The pennant line is shorter and the flags sit closer together. *Tested: No browser check recorded.*

**2026.10.10.1040 (alpha):** Fixed: "Keep and go to title" on the first victory screen now ends on the title screen (it used to land on the launch pad after Prince Chimp's gift). The pennant trail is smaller and more lifelike: a thin curved string with small flags that stream back and flutter more toward the loose end. *Tested: No browser check recorded.*

**2026.10.10.0934 (alpha):** Fight polish. Bosses land with a thump when they arrive, and a beaten boss spins away crying. The victory card and the Challenges panel now show your three crown pieces (and the whole crown after the Crown Duel). *Tested: Firefox 158; no Chromium check recorded.*

**2026.10.10.0545 (alpha):** **Prince Chimp fights!** Beat the game twice, then turn on **Prince Chimp fight** in Challenges. In your next run the last two gates of the final stage give way to a boss: the **Wafer Cannon** wagon, then **Mecha-Chimp** (lasers and rocket fists), then the **Gorilla Guard** (coconuts and shockwaves), then the **Crown Duel** (everything at once). One fight per playthrough, in that order. Each fight has three 12-second rounds; if you get hit, only that round repeats. Warnings show where each attack will land. Beat the first three for crown pieces; win the Duel to get Prince Chimp's true ending and the **Banana Crown** for Fancy (Costume). The Free bounce upgrade absorbs one hit. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.10.0049 (alpha):** **Challenges!** Once you have beaten Prince Chimp, a Challenges button appears on the title screen. Pick one for your next run: **Night flashlight** (everything is dark except a circle of light round Fancy), **Tiny gaps** (every opening 20% smaller), **Wafer storm** (vanilla wafers float between the gates) or **Mirror** (the world is upside down). Beat the whole game in one to earn its **badge** and a new **scarf color and mask color** for Costume. Normal runs and Practice never change, and the hidden rooms stay shut during a challenge. Help and the title ticker hint at it. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.10.0032 (alpha):** Fixes and comfort. The water level's finish card now names the right next stage (it was naming the wrong one). **Prince Chimp cries** comically on the victory screen ("Boo hoo!") and when he surrenders his balloons. **Controller:** the d-pad or sticks steer in the water level, and now also move around every menu (title buttons, Settings, Help, Save, Costume, Upgrades, Practice, victory choices): A picks, B goes back, Start closes; on a pause screen Y opens Settings. **Help** now has a picture for every tip, a Secrets section with rumors, and the title ticker drops hints about the secrets. *Tested: No browser check recorded.*

**2026.10.10.0011 (alpha):** Secrets! Once you have beaten Prince Chimp, the game starts hiding things (there is a little hint under Help). **Rooms full of bananas:** fly along the very top edge in the quiet stretch after a stage, stay low before the Silverware Drawer, or pass a glowing gold gate after a long perfect streak. **Six lost banana friends** hide between gates from your third playthrough; find all six for the **Banana Bunch** costume. **Five quick taps on Fancy** on the title screen open the **Banana Museum**. **Chimp's Navy:** a clean leap over a thrown wafer now pays a bonus banana (and a bigger one for each clean clear in a run), plus a treasure raft, a secret rock arch, and a giant submarine for a flawless run. Two new upgrades: **Rope cutter** and **Wafer shield**. *Tested: Chromium (version not recorded) and Firefox 158.*

## 2026.10.09 (alpha)

### Quick
Comfort settings: Calm mode, game speeds from 100% down to 60%, left-handed layout, large buttons, a battery saver, full screen, and game controller support. A pause button (or the P key), a 3-2-1 after a pause, and Continue to bring you back to the stage you reached if the tab was closed. A Practice button lets you replay any stage you have reached. New upgrades: a free bounce, an extra heart for the water level, Super Leap, and Practice Chimp's Navy. The water level is a reflex game seen from above: leap over submarines and barrels, dodge seagulls, and watch whirlpools. Beating Prince Chimp the first time now rewards you with a surprise. A "Ready, Set, GO!" after every stage, and a smoother start to each stage, especially on Android phones. Fancy became a glossy 3D toy with big eyes, a hero mask and a flowing scarf, with a loop-de-loop launch, golden banana coins, PERFECT streaks and close calls. A news ticker on the title screen, a new last stage (Chimp's Jungle Kingdom), and a victory ending where you keep your upgrades or start fresh. Obstacles became glossy 3D toys: gumball machines, lollipops, candy canes, ice cream scoops, cookie sandwiches, copper pots and fruit trees. The Fruit Garden starts on a beach and turns into the jungle island.

### Details
**2026.10.09.2349 (alpha):** Lots of comfort, plus new upgrades. **Continue** brings you back to the stage you had reached if the tab was closed mid-run. **Game speed** now has 100, 90, 80, 70 and 60% (each keeps its own best score).

### Deep
**2026.10.09.2349 (alpha):** Lots of comfort, plus new upgrades. **Continue** brings you back to the stage you had reached if the tab was closed mid-run. **Game speed** now has 100, 90, 80, 70 and 60% (each keeps its own best score). **Larger text**, a **Settings** button on the pause screen, **game controller** support, a **Copy my result** button on the victory screen, and **Keep and go to title** so you can rest after a win. A little flag on the progress dots shows where your best run ended. From your **5th win**, the last two stages are 15 gates long. New upgrades: **Banana magnet**, **Sweet spot** (wider PERFECT zone), **Daredevil** (wider close calls), **Golden touch** and **Second wind** (once per run, a crash restarts the stage instead of ending the run). In the Balloon Party, quick **chains** of pops pay extra. A **rainbow trail** unlocks with a perfect streak of 10, and the title screen shows a trophy at +50% and +100% speed. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.2331 (alpha):** Smoother start to every stage, especially on Android phones. The picture-building that used to land in the first seconds of a new stage is now spread out in tiny pieces and waits for a quiet frame, so there should be far fewer hiccups when a stage begins. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.2247 (alpha):** Secrets and a bigger finish. **Beat Prince Chimp the first time** and he surrenders with a white flag and hands over his whole balloon collection: that unlocks the **Balloon Party**, a calm bonus stage between the Ice Cream Parlor and the Silverware Drawer (no obstacles; pop glossy 3D balloons for credits, gold ones are worth 5; the floor is the only thing that can hurt you), and **pennant flags** that fly behind Fancy (Costume panel to turn them on or off). **From your third playthrough**, the submarines and barrel chimps throw vanilla wafers at Fancy in the water level: leap over them or steer around (each wafer has a shadow). **Every time you win and keep your upgrades, the whole game is 10% faster** (up to double); starting fresh resets that. The victory card is now a full celebration with fireworks, a medal, a hopping Fancy and stats that fly in: time, pauses, taps, credits, hits taken, friends freed, balloons popped, records, and your secrets. Also fixed: after a stage clear the first gate could arrive too soon after GO, so it now comes about a second later and opens right where Fancy waits. New tab icon (Fancy's face). The first screen appears about twice as fast, and the stage pictures build with fewer graphics-card stalls. *Tested: Firefox 158; no Chromium check recorded.*

**2026.10.09.2158 (alpha):** Fixed the thin horizontal lines on the candy cane pillars (they showed on screens scaled to 125% or 150%). Settings is now compact and fits on one screen without scrolling at any size. The "GO!" word is much bigger. *Tested: No browser check recorded.*

**2026.10.09.2143 (alpha):** More speed and safety. The game file is about 9% smaller. A **Battery saver** option in Settings draws about 30 pictures a second and keeps the game itself exactly the same. If a screen struggles, the game quietly lightens itself (fewer sparks and drifting decorations, then a slightly softer picture) and recovers when things calm down. Resizing the window or a phone's address bar sliding no longer causes a flurry of rebuilds, and if a device runs out of picture memory the game draws a little softer instead of going black. *Tested: Firefox 158; no Chromium check recorded.*

**2026.10.09.2127 (alpha):** Firefox tuning. The news ticker on the title screen is cheaper to draw, white fades are lighter, and a paused game now rests instead of redrawing itself (less heat and battery). Firefox frames are a little faster; Chromium is unchanged. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.2105 (alpha):** Ten comfort upgrades. **Settings** (gear button): Calm mode (no flashes, shake or zoom; it switches on by itself if your device asks for less motion), Relaxed speed (80% speed with its own best score), left-handed layout, large buttons, the news ticker, and full screen. After a pause there is a 3-2-1 before play carries on. Taps show a little ring, and a tap just before Fancy can respond is remembered. From your 4th run, a tap skips the launch loop. **Practice** now lets you replay any stage you have cleared (and the water level); nothing is earned or saved. A row of ten dots shows how many gates are left in the stage and the best score to beat. The screen stays awake while you play, the game respects phone notches, and Safari users get a one-time tip about saved progress. *Tested: No browser check recorded.*

**2026.10.09.2039 (alpha):** Fancy has no gloves any more, in every picture including the water level. His eyes are a little closer together. The Practice button no longer falls off the screen: when all the title buttons are showing, it drops to a second row. *Tested: No browser check recorded.*

**2026.10.09.2029 (alpha):** Fancy's big eyes are 20% larger. His white gloves now sit at his sides instead of in front (they looked like buck teeth). The launch track is now a glossy 3D chrome tube with shiny highlights and shadows, round pillars with bolted rings and collars, and a chasing ring of glowing bulbs. The launch effects are unchanged. *Tested: Chromium (version not recorded); no Firefox check recorded.*

**2026.10.09.2021 (alpha):** Fancy's eyes are 20% bigger, and his gloves now sit at his sides instead of looking like buck teeth. The launch track is now a glossy chrome-and-enamel loop with a drop shadow, round bolted pillars, metal collars and glowing chasing lights. The launch effects are unchanged. *Tested: No browser check recorded.*

**2026.10.09.2015 (alpha):** The water level is back in its place in the game (after the Silverware Drawer). Two new upgrades: **Super Leap** (75 then 150 credits) makes Fancy leap longer and higher, and lets him sail right over seagulls. **Practice Chimp's Navy** (40 credits) adds a Practice button on the title screen to try the water level any time (no friends or credits earned); when you finish or get hit you can try again or go back to the title screen. *Tested: No browser check recorded.*

**2026.10.09.2003 (alpha):** The beach at the end of the water level has two signs (Prince Chimp’s Tropical Jungle Island, AKA Rhode Island) and a big Prince Chimp above them. The whirlpool is 20% bigger and the gull has a proper shadow. The main game now has a pause button (top right) and the P key. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.1957 (alpha):** The water level has a pause button (top right; the P key works too, and it pauses by itself if you switch tabs). The seagull and whirlpool look much more 3D. Fancy's gloves are now tucked in at his sides. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.1953 (alpha):** In the water level, Fancy's red mask and eyes now peek over the front as he flies. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.1907 (alpha):** In the water level Fancy is now drawn from above: a banana with his red scarf and a big red cape streaming behind, white fists out front, and the whole hero leans into your turns. Barrels and submarines are redrawn as clean 3D-style toys seen from a little above; the new chimp hats stay. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.1855 (alpha):** Fancy has bigger, more cartoony eyes, and he grits his teeth when he falls a long way or gets bumped. He is a slightly different yellow from the banana coins. The title letters are now properly inverted. In the water level the chimps, submarines and barrels look rounder and more 3D, the up arrow no longer makes Fancy leap, and we look down on Fancy from above, so you only see his side on hard turns. Memory use is a little lower on big screens. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.1824 (alpha):** In the water level Fancy can't steer while he is in the air, so time your leaps. Barrels now also come in columns, so a leap that's too early lands on them. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.1816 (alpha):** Fancy keeps his mouth closed while flying. The water level has new chimp submarines and barrels (tied together with a short rope until a whirlpool splits them), and you can steer left and right during a leap. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.1808 (alpha):** The water level is now a no-shooting reflex level: tap to leap over chimp submarines and roped barrels of chimps, dodge the cross seagulls (you can't leap them), and watch whirlpools sink subs and scatter barrels. The sea fades from light teal to deep blue and back as you go. Fancy now flies nose-up in it. After every stage clear he does one celebration roll. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.1748 (alpha):** Smoother play with no stutter when you bump into something. A "Ready, Set, GO!" moment after every stage so you can get your finger or space key ready (Fancy floats by himself until GO). The 3-2-1 is a bit slower and the first obstacle comes sooner. Fancy is smaller, his gloves sit closer and the red cuffs are gone. He no longer opens his mouth when you tap, his scarf flaps more, and the gold bananas spin like real bananas. The jump into the water bonus no longer flashes the beach. "Fancy" on the title has its yellows swapped. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.1711 (alpha):** Obstacles now look like glossy 3D toys like Fancy: gumball machines, swirl lollipops, candy-cane pillars, scoops, cookie sandwiches, copper pots and fruit trees. The Candy Shop backdrop is softer so everything stands out. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.1526 (alpha):** The golden banana coins are now spinning gold bananas (true 3D turn) instead of round coins. *Tested: Firefox 158; no Chromium check recorded.*

**2026.10.09.1514 (alpha):** Fancy is now a real 3D toy in the Apple Press look, and his football roll turns the whole body (mask, scarf and both gloves go round). Both gloves are up front like a flying superhero. Friends, Prince Chimp and the coins match. The title letters swoop in and Fancy zooms in beside them; the Costume and Upgrades buttons moved to the top row; the copyright is under the version. A taps counter sits at the top left. The blast-off speed now eases away smoothly, and the game is smoother (fewer stutters at stage changes, the blast-off and confetti). *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.1406 (alpha):** Fancy is smaller and longer, with white-gloved hands right on his body (no arms). After the launch he spins like a football before you take over. The Fruit Garden now starts on a beach and slowly turns into Prince Chimp's jungle island. Upgrades only show when you can afford one, and there are two new ones: a free bounce off the ground or an obstacle, and an extra heart for the water mini game. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.1334 (alpha):** Fancy now has a little white-gloved fist and eyes that follow the next gap. The launch starts with a 3-2-1 countdown, a swooping camera and a candy-pink track. Coins drift toward Fancy when he is close, and every stage clear pays a coin bonus. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.1319 (alpha):** Smoother on slower devices: Fancy and his friends are cheaper to draw. No look changes. *Tested: Firefox 158; no Chromium check recorded.*

**2026.10.09.1242 (alpha):** A new Fancy: a glossy, plump banana with big expressive eyes, a hero mask and a flowing scarf (the cape is gone). A giant loop-de-loop launch with a glowing trail. Golden banana coins, PERFECT streaks and close-call bonuses. Coins and freed friends are your banana credits for upgrades. Stronger sense of speed. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.1112 (alpha):** A new cape with folds that no longer looks like a tongue. A news ticker with the story and banana jokes on the title screen. After stage 4, a water bonus game: drag Fancy over Chimp's Navy, dodge coconuts, logs and rocks, and free friends in bubbles. A new last stage, Chimp's Jungle Kingdom, and a victory ending where you keep your upgrades and credits or start fresh (never harder). *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.1024 (alpha):** Smaller Fancy with a thin sideways cape. The first two stages are gentler. A much bigger launch: rev-up, sparks, speed lines, a camera punch and a confetti WHOOSH. Backgrounds now move (balloons, bubbles, butterflies, falling leaves and more). Pick a costume on the title screen. Spend the friends you free on upgrades: Roomy gaps, Gentle fall and a Bonk shield. *Tested: Chromium (version not recorded) and Firefox 158.*

**2026.10.09.1005 (alpha):** New look! Fancy is a SuperBanana with a cape. Five illustrated stages including a Candy Shop and a Fruit Garden. Every run starts with a loop-de-loop launch. Stage cards now arrive during a calm stretch with no obstacles. You can pop off the top of the screen for a moment. Five banana friends escape Prince Chimp each stage; Records count them. Reach stage 3 to unlock a bow tie. *Tested: Chromium (version not recorded) and Firefox 158.*

## 2026.10.08 (alpha)

### Quick
First playable version: tap to flap, three themed stages, best score, a save code and a save file.

### Details
**2026.10.08.2351 (alpha):** Stage cards no longer cover the banana.

### Deep
**2026.10.08.2351 (alpha):** Stage cards no longer cover the banana. *Tested: Firefox 158; no Chromium check recorded.*

**2026.10.08.2342 (alpha):** First playable version. Tap to flap, three themed stages, best score, save code and save file. *Tested: Chromium only (version not recorded); Firefox was not yet in use.*
