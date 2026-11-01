# What's new

A short list of what you will notice in each version, newest first. The version number is shown under the title on the title screen. A developer version with more detail is in [CHANGELOG-DEV.md](CHANGELOG-DEV.md). The full technical changelog (numbers and the browsers each build was tested in) is kept by the maker outside this page.

## 2026.11.01.0300 (beta)

- A small behind-the-scenes cleanup: the game file no longer holds the few special characters that made Chrome store the whole page at double size in memory. Nothing looks different.

## 2026.10.31.1730 (beta)

- On a screen that is struggling to keep up (the game's quality control has already stepped down twice), the far-off hills are no longer drawn, which makes each picture about 17% quicker on a phone we tested. Other screens look exactly the same.

## 2026.10.31.1405 (beta)

- Your progress now survives a browser crash or a force-quit: every save is also written to the browser's strict database, and the game picks up the newer copy when it opens. In our test the old build lost the last change in both Chrome and Firefox; the new one kept it. Nothing looks different.

## 2026.10.31.1326 (beta)

- If the title screen sits untouched for 30 seconds, it now redraws at the Battery saver's gentler pace (about 35 pictures a second), which uses up to half as much of the game's work in Firefox and about a quarter less in Chrome. Touch, a key or the mouse brings full speed back at once.

## 2026.10.31.0846 (beta)

- The game starts a little smoother: its code now loads in four smaller pieces, so the browser never freezes for one long moment while opening. Nothing looks different.

## 2026.10.31 (beta)

- The "You won" title is a darker orange-brown, so it is easier to read. Nothing else in the game changed.

## 2026.10.23.2236 (beta)

- The "Oh no!" card, the launch words and the stage counter no longer cause a small hiccup the first time they appear in a run. Nothing looks different.

## 2026.10.23.0013 (beta)

- If the game is already open in another tab or window, the new one now says so as soon as it opens and does not save over the other game. Its Reload button makes that copy the one in charge.

## 2026.10.22.2251 (beta)

- The game file is about 37% smaller (495 KB instead of 791 KB), so it downloads and opens a little faster. Nothing looks different.

## 2026.10.22.2219 (beta)

- The first time the game opens on a device, Fancy's first face is now drawn in small steps too, so the opening stays smooth.

## 2026.10.22.2131 (beta)

- The first time the game opens on a device, the title is built in small pieces so the page never freezes for one long moment; the title can appear a little later.

## 2026.10.22.2026 (beta)

- On a struggling device the game now lightens its effects only when the frame rate really drops, and it does not flip back and forth.

## 2026.10.22.2025 (beta)

- Smoother play on slower phones (less memory churn while you play), and the Help, Settings and Costume windows now break their lines more evenly.

## 2026.10.22.1905 (beta)

- A few more behind-the-scenes changes; nothing looks different.

## 2026.10.22.1903 (beta)

- Small behind-the-scenes changes to how the game starts; nothing looks different.

## 2026.10.22.1855 (beta)

- Opening the game on a later visit is a little quicker in some browsers, and long stretches of picture building no longer hold up the screen.

## 2026.10.16 (beta)

- The title screen and the page header now credit LFC Foundry, and the game is open source under the MIT license.
- The share text at the end of a run links to the game's new home.

## 2026.10.14 (beta)

- Every button can now be reached with a keyboard or a screen reader, and a back swipe (or the Back key) closes an open window.
- The buttons show a yellow ring when pressed, and on a phone held sideways they sit beside the game at a comfortable size.
- The space around the game takes on the colors of the current stage.
- The stage times at the top right no longer run off the edge of the screen.
- Saves are safer: if the game is open in two tabs, the older tab stops saving and tells you, so it cannot overwrite your newer game.
- While a window (Settings, Help, Save) is open, the game behind it can no longer be tapped by accident.
- After five tries at the same stage, a small card offers a slower speed or a look at Upgrades.
- The Save window says when you last saved, and a new "Put my old game back" button undoes a Load or a Start fresh.
- W A S D steering in the water level works with Caps Lock on and on other keyboard layouts.
- The run pauses if you switch to another window or unplug a controller.
- Windows high-contrast colors keep clear button borders.

## 2026.10.12 (beta)

- Two rounds of bug hunting fixed many small problems, such as text overlapping on result cards, buttons hanging off cards, and an obstacle showing the wrong stage's art after a quick retry.
- Changes to Settings (large buttons, left-handed, Calm mode) now show at once on a paused screen.
- The scenery behind an open window no longer slows down.
- The "perfect" streak label no longer prints over the stage progress text.

## 2026.10.11 (beta)

- Fancy's costumes now spin with him in his rolls.
- New secrets to find for players who keep playing.
- Backward stages are much smoother in Chrome and similar browsers, and Firefox scrolls more smoothly too.
- Fixed Firefox freezing on a backward stage.
- The Space bar always flaps during a run, even after you clicked a button.
- A trail effect you can earn now announces itself and switches on right away.
- The win card after Prince Chimp runs much smoother.
- The game file is about a quarter smaller.

## 2026.10.10 (alpha, then beta)

- The game is now in beta.
- Tap, click or press Space to start after each stage card, so the next stretch never begins before you are ready.
- Every window has a round Close button that stays in view while you scroll.
- New upgrade: Potassium Power. Hold to glide through lined-up gates.
- One stage in each run is now flipped like a card and flies right to left.
- You can pay 100 banana credits to try a stage again after a bonk.
- New result cards with kid-friendly words, and a rebuilt Upgrades window that needs much less scrolling.
- A run timer under the pause button shows split times for each stage.
- The water level is polished: a lush beach, a heart buoy half way across, red submarines in the back half, and fish drifting under the surface.
- On a phone, dragging in the water level only steers; a quick tap leaps.
- Hitting the top pillar with a free bounce no longer fires Fancy into the floor.
- Smoother scrolling: obstacles, scenery and Fancy glide by fractions of a pixel instead of hopping.
- A glossier, toy-like look: chunky buttons, shinier Fancy, friends and coins, brighter launch lights, and a real gold banana as the coin.
- Fixed several stutters in Firefox, including one in the Silverware Drawer.
- The game now has Challenges and secrets for players who beat Prince Chimp, and more reasons to keep playing.

## 2026.10.09 (alpha)

- Comfort settings: Calm mode, game speeds from 100% down to 60%, left-handed layout, large buttons, a battery saver, full screen, and game controller support.
- A pause button (or the P key), a 3-2-1 after a pause, and Continue to bring you back to the stage you reached if the tab was closed.
- A Practice button lets you replay any stage you have reached.
- New upgrades: a free bounce, an extra heart for the water level, Super Leap, and Practice Chimp's Navy.
- The water level is a reflex game seen from above: leap over submarines and barrels, dodge seagulls, and watch whirlpools.
- Beating Prince Chimp the first time now rewards you with a surprise.
- A "Ready, Set, GO!" after every stage, and a smoother start to each stage, especially on Android phones.
- Fancy became a glossy 3D toy with big eyes, a hero mask and a flowing scarf, with a loop-de-loop launch, golden banana coins, PERFECT streaks and close calls.
- A news ticker on the title screen, a new last stage (Chimp's Jungle Kingdom), and a victory ending where you keep your upgrades or start fresh.
- Obstacles became glossy 3D toys: gumball machines, lollipops, candy canes, ice cream scoops, cookie sandwiches, copper pots and fruit trees.
- The Fruit Garden starts on a beach and turns into the jungle island.

## 2026.10.08 (alpha)

- First playable version: tap to flap, three themed stages, best score, a save code and a save file.
