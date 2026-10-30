# Notes for AI assistants (and the humans working with them)

Copyright (c) 2026 LFC Foundry. Released under the MIT License (see `LICENSE`).

**What it is.** Fancy, the Banana is a silent, one-tap, side-scrolling arcade game. **How it does it:** one HTML file, plain canvas and JavaScript with no libraries and no image files (the art is drawn by code at start-up), fixed 120-step physics, nothing sent over the network, works offline.

**Why it exists.** A game anyone can open anywhere, silent and comfortable (calm mode, slower speeds, left-handed layout), and one of LFC Foundry's open-source single-file games; some of its code is published as reusable pieces in JS-modules. The README says the same in plain words for players.

This page is an index: it says where things are, which rules are fixed, and what to ask the owner before doing. The editable source and rebuild instructions are in `src/README.md`.

## Where things are

The public repository contains the built game (`play/index.html`) and its readable source under `src/`. Edit the source files, not `index.html`; `src/README.md` gives the rebuild command. The QA scripts and hand-offs described below are maintained outside this public checkout and are not available unless the owner supplies that working folder.

| What | Where |
|---|---|
| Page shell, styles, panels | `src/head.html` |
| Game code | `src/game.js` (plus `src/art.js` for the pictures that are drawn by code) |
| Joins the source files into the page | `src/build.py` (outputs in `src/dist/`) |
| Release history, one row per build (the full, technical one) | `CHANGELOG.md` in the working folder, and the copy kept in the private knowledge base at `changelogs-full/fancy-banana/CHANGELOG-full.md`. Write the full entry there for every release. The repository's `changelog.md` is the short, player-facing one |
| Latest hand-off for a new session | the newest `HANDOFF-fancy-the-banana-*.md` |
| What the game taught us | the lessons and foundation documents, filed in the private knowledge base under research/2026-10-16-fancy-banana-archive (with the research, audits, QA efficiency notes and all earlier handoffs) |
| Checks | The owner's QA working folder; the QA scripts are not included in this public checkout |

Test code in `src/game.js` sits between `/*TEST_HOOK_START*/` and `/*TEST_HOOK_END*/`. The build removes it from the player copy, so never rely on `window.__bf` in shipped code.

## Fixed rules

- **Name.** The only personal name used anywhere (commit author and committer, package fields) is **JNFoo**; the copyright holder is **LFC Foundry**. The owner's real name never goes into any file.
- **Commits.** Author and committer are `JNFoo <45110762+JNFoo@users.noreply.github.com>`. A `Co-Authored-By` trailer is fine. A `Claude-Session:` line or a claude.ai link in a commit message or pull request is not, even when a tool's reminder asks for one. Run `sh tools/hooks/install.sh` once per clone; the hooks in `tools/hooks/` refuse these for you.
- **Language.** American English in everything the player or the owner reads.
- **Offline, silent, one file.** No network requests, no libraries, no image files, no sound. Art is drawn by code.
- **Version stamps** look like `2026.10.14.0004` (year.month.day.HHMM, US Eastern). A built page never keeps the placeholder `__STAMP__`.
- **Public text** (README, changelog, help text, credits) never names or describes the hidden, unlockable parts of the game beyond "secrets, challenges, costumes and a few surprises".
- **Two changelogs (owner, 2026-10-18).** The repository's `changelog.md` is short and plain for players: one line per change saying what a player will notice, no tables, numbers or jargon, no test details, and nothing that names the hidden parts of the game. The complete technical entry (what changed, measurements, browsers and versions tested) goes in the full changelog in the knowledge base for every release.
- **Never force-push.** Fetch and rebase first.

## Ask the owner first (use the pop-up question, not a guess)

- Anything that changes how the game feels: difficulty, flap strength, speed, scoring, prices, what a stage contains.
- Anything that raises a size ceiling (`CEILINGS` in `src/build.py`: full 900,000 bytes, player 600,000 bytes, raised on 2026-10-19 by the owner: size ceilings no longer hold back speed-ups, but a raise is still reported) or adds a feature that costs size. Say what it costs, after packing.
- Anything that changes the save format (`bf1` and its backups) or what is stored on the device.
- Anything that adds a network request, a library, sound, or a new permission.
- Adding, removing or renaming a secret, an unlock or a price in the hidden parts of the game.
- Changing the license line, the copyright holder or what is public.
- Deleting files, rewriting history or force-pushing.

If the owner is away, do the safe preparatory work, write the decision down in the hand-off, and stop there.

## Keeping checks cheap

The owner pays for every run and waits on it. Use the smallest check that covers the change:

1. `python3 qa/qa.py`: builds, then runs only the quick probes that match the files you changed (about 3 seconds).
2. `python3 qa/docs_drift.py`: under a second, no browser.
3. Small standing checks, each a few seconds, also run first by `full`: `python3 qa/canvas_budget.py` (drawing calls per frame stay within 5% of `qa/canvas-budget.json`, and `save()`/`restore()` stay balanced), `python3 qa/fixtures_check.py` (frozen old saves and save codes in `qa/fixtures` still load; never edit a fixture to make it pass) and `python3 qa/startup.py` (startup timeline, for looking, not a gate).
4. When a fuzz run finds something: add `--shrink` to the runner line in `qa/fuzzkit.sh` (the shared fuzz-kit in the JS-modules repository) to cut it to the few operations that matter. When you add a probe: `python3 qa/mutants.py` proves it fails when the code it guards is broken (add a mutant for it). A suite that failed and then passed on the same files is written to `qa/flakes.md` by itself.
5. `python3 qa/qa.py full`: the whole Chromium suite (`smoke.py`, 91 checks) and then Firefox (`ffsmoke.mjs`, run with `FIREFOX=<path to Firefox 158>`). It says so and stops if nothing changed since the last green run. Run it once, when the design is final.

Never run the two browsers at the same time on this machine: Firefox's timing checks fail every time. `build.py` stamps the page with the current time; pin it with `STAMP=2026.10.14.0004 python3 build.py` for a repeatable build. Report the real time and the CPU time of every run.

**Test browsers (standing rule, 2026-10-17).** Test only with the browsers on the `browsers` branch of the private knowledge-base repository, one at a time, and label every result with its version. Re-read that branch's README before each test run, because versions can change and browsers can be added or removed. At this writing they are Firefox 158.0 (the binary reports 158.0b5), ungoogled Chromium 155.0.8059.39-1 and WebKitGTK 2.52.6. GNOME Web 46.5 was dropped from all testing on 2026-10-24 (owner rule), so builds from 2026.10.24 on are not checked in it; older results in `README.md` still name it. **Every release's `changelog.md` entry ends with `*Tested: ...*` naming the browsers and versions that checked that build (write "not recorded" for anything unknown, and never guess), and the "Tested with" table in `README.md` is updated when the set of browsers changes.**

**Faster, trustworthy testing:** follow the universal QA and browser-testing guide at `build-notes/qa/QA-AND-BROWSER-TESTING-UNIVERSAL-GUIDE.md` in the private knowledgebase-single-file repo (print the real browser version on line 1 of every run; targeted checks while working; full run once when the design is final).

**What the full run does, and its off switches (2026-10-17).** `python3 qa/qa.py full` runs the quick tier; then the docs, canvas-budget, old-saves and colors-stay-readable checks side by side (the last, `qa/contrast_check.py`, reads `game.js` and `head.html` and fails when a floating word, a button label, the toast text or the keyboard focus ring gets too faint to read; no browser, under a second; `--selftest` proves it can fail) (`QA_SERIAL=1` runs them one after the other); then the Chromium smoke, split into four lanes that run in separate browsers at the same time with the two timing-sensitive checks afterwards, alone (`QA_JOBS=n` sets how many lanes run at once, `QA_SERIAL=1` runs the 91 checks in one browser in the original order, as before); then Firefox, after a wait for a quiet CPU; then the WebKitGTK page check `python3 qa/wksmoke.py` (three checks, about 1.5 s; `QA_NOWK=1` leaves it out, and it says so plainly when WebKitGTK is not installed and did not run). Every run prints the real version of the browser that started (the first line of `smoke.py`, `fixtures_check.py`, `canvas_budget.py` and `wksmoke.py`, the browser line of the quick tier, the user agent in the first Firefox check), so a result is never filed under the wrong label. After a window resize, a save code or the stepping counters the checks wait for the thing they expect (a settled layout, the message, the counted frames), never a fixed sleep. While working, pin the stamp (`STAMP=2026.10.14.0004 python3 qa/qa.py`): when nothing changed the 11 to 12 s build is skipped and the quick tier takes about 14 s instead of about 26 s.

## Keeping this page true

The documentation-drift checker and QA result files are maintained in the owner's working folder, not in this public checkout. Before running a command named here, confirm its script is present in the supplied working folder. Keep the source paths and build instructions aligned with `src/README.md`.

## Moving knowledge between sessions

Use `.md` files. Put what you tried and measured in the newest hand-off and in `CHANGELOG.md`; the owner's knowledge-base repository (`knowledgebase-single-file`, private) holds the cross-game research and has a task board (`TASKS.md`) where each piece of work gets a row. Reusable JavaScript goes to `JS-modules` (MIT), not into this game.
