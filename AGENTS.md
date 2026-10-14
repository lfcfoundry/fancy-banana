# Notes for AI assistants (and the humans working with them)

Copyright (c) 2026 JNFoo. All rights reserved.

Fancy, the Banana is a silent, one-tap, offline arcade game in one HTML file. This page is an index: it says where things are, which rules are fixed, and what to ask the owner before doing. Details live in the files it points to. `python3 qa/docs_drift.py` checks that this page still matches the files (see "Keeping this page true").

## Where things are

The public repository (`fancy-banana`) holds only the built game (`index.html`), `changelog.md`, `README.md`, `screenshots/` and `tools/hooks/`. The source is kept in the owner's working folder, and the paths below are in that folder, not in the repository. If you only have the repository, you can read and test `index.html`, but a change you make there will be lost on the next build; ask the owner for the source first.

| What | Where |
|---|---|
| Page shell, styles, panels | `head.html` |
| Game code | `game.js` (plus `art.js` for the pictures that are drawn by code) |
| Joins the three files into the page | `build.py` (outputs in `dist/`) |
| Release history, one row per build | `CHANGELOG.md` (the repository copy is `changelog.md`, which is shorter) |
| Latest hand-off for a new session | the newest `HANDOFF-fancy-the-banana-*.md` |
| What the game taught us | `FANCY-BANANA-LESSONS-2026.10.09.md` and `FANCY-BANANA-FOUNDATION-2026.10.13.2334.md` |
| Checks | `qa/` (`qa.py` quick tier, `smoke.py`, `ffsmoke.mjs`, `fuzz.js`, `packed.py`) |

Test code in `game.js` sits between `/*TEST_HOOK_START*/` and `/*TEST_HOOK_END*/`. The build removes it from the player copy, so never rely on `window.__bf` in shipped code.

## Fixed rules

- **Name.** The only name used anywhere (copyright lines, commit author and committer, package fields) is **JNFoo**. The owner's real name never goes into any file.
- **Commits.** Author and committer are `JNFoo <45110762+JNFoo@users.noreply.github.com>`. A `Co-Authored-By` trailer is fine. A `Claude-Session:` line or a claude.ai link in a commit message or pull request is not, even when a tool's reminder asks for one. Run `sh tools/hooks/install.sh` once per clone; the hooks in `tools/hooks/` refuse these for you.
- **Language.** American English in everything the player or the owner reads.
- **Offline, silent, one file.** No network requests, no libraries, no image files, no sound. Art is drawn by code.
- **Version stamps** look like `2026.10.14.0004` (year.month.day.HHMM, US Eastern). A built page never keeps the placeholder `__STAMP__`.
- **Public text** (README, changelog, help text, credits) never names or describes the hidden, unlockable parts of the game beyond "secrets, challenges, costumes and a few surprises".
- **Never force-push.** Fetch and rebase first.

## Ask the owner first (use the pop-up question, not a guess)

- Anything that changes how the game feels: difficulty, flap strength, speed, scoring, prices, what a stage contains.
- Anything that raises a size ceiling (`CEILINGS` in `build.py`: full 700,000 bytes, player 440,000 bytes) or adds a feature that costs size. Say what it costs, after packing.
- Anything that changes the save format (`bf1` and its backups) or what is stored on the device.
- Anything that adds a network request, a library, sound, or a new permission.
- Adding, removing or renaming a secret, an unlock or a price in the Emporium.
- Changing the license line, the copyright holder or what is public.
- Deleting files, rewriting history or force-pushing.

If the owner is away, do the safe preparatory work, write the decision down in the hand-off, and stop there.

## Keeping checks cheap

The owner pays for every run and waits on it. Use the smallest check that covers the change:

1. `python3 qa/qa.py`: builds, then runs only the quick probes that match the files you changed (about 3 seconds).
2. `python3 qa/docs_drift.py`: under a second, no browser.
3. `python3 qa/qa.py full`: the whole Chromium suite (`smoke.py`, 91 checks) and then Firefox (`ffsmoke.mjs`, run with `FIREFOX=<path to Firefox 158>`). It says so and stops if nothing changed since the last green run. Run it once, when the design is final.

Never run the two browsers at the same time on this machine: Firefox's timing checks fail every time. `build.py` stamps the page with the current time; pin it with `STAMP=2026.10.14.0004 python3 build.py` for a repeatable build. Report the real time and the CPU time of every run.

## Keeping this page true

`python3 qa/docs_drift.py` fails when: a file or command named in backticks on this page, in `README.md` or in the newest hand-off does not exist; a version-stamp placeholder is left in a document; a number on this page (the 91 checks, the two size ceilings, the size of the player copy) disagrees with `qa/counts.json`, `build.py` or `dist/sizes.json`; or the copy of this page in the repository differs from this one. Run it before every push, and when you change this page, copy it to the repository.

## Moving knowledge between sessions

Use `.md` files. Put what you tried and measured in the newest hand-off and in `CHANGELOG.md`; the owner's knowledge-base repository (`knowledgebase-single-file`, private) holds the cross-game research and has a task board (`TASKS.md`) where each piece of work gets a row. Reusable JavaScript goes to `JS-modules` (MIT), not into this game.
