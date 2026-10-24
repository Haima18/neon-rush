# NEON RUSH

**SURVIVE THE GRID.**

NEON RUSH is a browser-playable cyberpunk arcade survival game. Fly the last light
through five escalating breach zones, dodge magenta hazard geometry, harvest
volatile energy, chain orbs for score multipliers, and carve your name into the
record. A charged **Nova Pulse** clears breathing room when the grid closes in,
and an adaptive synthwave score follows the action.

Built with plain HTML, CSS, vanilla JavaScript, Canvas 2D, and the Web Audio API.
No frameworks, no build step, no dependencies, no network requests, and no
external assets — everything you hear and see is generated at runtime.

---

## Play it

### Run locally

From the project directory:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173/>.

Any static file server works. For example:

```bash
npx serve .
# or
php -S localhost:4173
```

The game also opens directly from `index.html` because the scripts are loaded as
classic scripts rather than ES modules. A local server is still recommended, as
some browsers apply stricter rules to `file://` pages.

### Requirements

- A modern evergreen browser with Canvas 2D, Pointer Events, Web Audio, and
  `localStorage`.
- No internet connection is required after the files are on disk.
- Audio starts only after your first interaction, per browser autoplay rules.

### Deploy to GitHub Pages

1. Create a repository and push this project to its default branch (`main`).
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and the `/ (root)` folder, then save.
5. GitHub Pages will publish at `https://<your-username>.github.io/<repo>/`.

The project is entirely static, so no Actions workflow or build command is needed.

**Exact commands to publish (not run for you):**

```bash
git init
git add .
git commit -m "Add NEON RUSH arcade survival game"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

Replace `<your-username>` and `<your-repo>` with your own values. This project
was **not** initialized as a Git repository, committed, pushed, or published as
part of development. Those steps are yours to run when you are ready.

---

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Fly | `WASD` or arrow keys | Drag the virtual flight pad |
| Dash | `Space` | Tap **DASH** |
| Nova Pulse | `E` or `Shift` | Tap **PULSE** |
| Pause / resume | `P` or `Esc` | Pause button in the HUD |
| Continue from zone clear | `Enter` or `Space` | **CONTINUE** |
| Retry after game over / victory | `Enter` | **RETRY** / **PLAY AGAIN** |
| Back from a menu | `Esc` | **BACK** |
| Confirm a focused control | `Tab` to focus, then `Enter` | Tap |

Dash is a short burst, not a permanent shield. It grants a 0.25 second phase
window and has a 1.8 second cooldown shown in the HUD. The phase window also
shreds any hazard you pass through for bonus points, but it is too brief to use
as a permanent safe zone.

Nova Pulse unlocks after six charges. Orbs add one charge and power-ups add two;
the charge carries between zones during a run. When the six HUD pips are lit,
press `E` or `Shift` (or tap **PULSE**) to destroy nearby hazards for points.

---

## The five zones

| # | Zone | Duration | Threat | What changes |
| --- | --- | --- | --- | --- |
| 1 | FIRST CONTACT | 30s | Low | Shards and mines; learn the flight model |
| 2 | OVERDRIVE | 35s | Moderate | Faster spawns; drifting weavers and homing seekers join |
| 3 | GRID COLLAPSE | 40s | High | Rotating barriers; sweep and pair events |
| 4 | NEON STORM | 45s | Severe | Dense formations, barrages, tighter gaps |
| 5 | FINAL BREACH | 50s | Critical | Maximum density and speed; survive the collapse |

You have **3 lives**. Clearing a zone repairs one life (up to the maximum of 3)
and automatically advances you after a short countdown. Losing all lives ends
the run. Clearing all five zones triggers the victory sequence and a completion
bonus.

### Hazards

- **Shards** — fast angular debris.
- **Mines** — slower, pulsing hazards.
- **Weavers** — drift laterally as they descend; read the curve early.
- **Seekers** — angular homing craft introduced in Zone 2. They steer toward your
  current position, so keep moving sideways instead of flying straight down.
- **Barriers** — rotating structures with a deliberate gap. Dash through if the
  gap closes before you can fly through it.

Damage destroys the hazard that hit you and grants a 2.2 second invulnerability
window, so one mistake cannot chain into a second hit.

---

## Scoring and pickups

- **Survival:** 15 points per second, multiplied by any active score surge.
- **Energy orbs:** 30 points each plus energy, multiplied by the orb chain and
  any active score surge.
- **Power-up pickup:** 40 points (80 during a score surge).
- **Phase shred:** 35 points per hazard destroyed during a dash.
- **Nova Pulse:** 45 points per hazard cleared inside the pulse radius.
- **Zone clear:** 250 × zone number, plus 10 per orb collected that zone.
- **Victory:** an additional 1,000 points.

Energy is a run-long tally shown in the HUD and results. Your best score and
unlocked zones are saved locally in your browser.

### Orb chain

Collect orbs within **3.4 seconds** of each other to build a chain. Every orb
after the first adds one link; the HUD shows the current multiplier and a timer
bar. The multiplier rises by 0.1 per link, up to ×2.5. Taking damage, breaking
your shield, starting a new zone, or letting the timer expire resets the chain to
zero. Power-up pickups, phase shreds, and Nova Pulse hits also add a link and
refresh the timer, so aggressive play can keep a chain alive between orb
clusters.

### Nova Pulse

Nova Pulse is a charged area attack. Each orb adds one charge and each power-up
adds two, up to six cells. When all six pips are lit, press `E` or `Shift`, or tap
the touch **PULSE** button, to purge every hazard within the cyan radius. The
pulse itself does not grant invulnerability, so move immediately afterward. The
charge carries between zones during a run and is shown on both the HUD and the
touch control.

### Power-ups

Only one power-up can be active at a time; picking up a new one replaces the old.

| Pickup | Effect | Duration |
| --- | --- | --- |
| **Shield** | Absorbs one collision, then breaks | Up to 7s |
| **Time Dilation** | Hazards move at 55% speed | 6s |
| **Score Surge** | Doubles survival and pickup score | 8s |
| **Magnet** | Pulls nearby orbs toward your hull | 8s |

Power-ups that are not collected expire after 12 seconds.

---

## Menus and progress

- **Main menu** — play, level select, how to play, settings, sound toggle, and an
  adaptive-score strip. Click or tap the strip to turn the score on or off
  without opening Settings; the equalizer and ON/OFF label follow the state.
- **Level select** — deploy into any zone you have cleared. A deployment starts a
  fresh run with 3 lives and a clean score.
- **How to play** — controls, objectives, chains, Nova Pulse, power-up reference,
  and flight notes.
- **Settings** — master sound, adaptive music, master volume, reduced screen
  shake, reduced visual effects, and a two-step progress reset.
- **Pause** — resume, restart the run from Zone 01, or return to the main menu.
- **Zone complete** — score, zone time, energy, remaining lives, and a countdown
  that auto-advances (or continue immediately).
- **Game over / victory** — full run telemetry and a personal-best badge when
  applicable.

### Saved data

Progress and preferences are stored under the `neonRush.save.v1` key in
`localStorage`:

- personal best score and per-zone bests,
- highest unlocked zone,
- sound on/off, adaptive music on/off, master volume,
- reduced screen shake and reduced visual effects.

Invalid or corrupt saved values are clamped and ignored rather than crashing the
game. Saves written before the music setting existed load with adaptive music
enabled. **RESET PROGRESS** clears the score and unlocked zones but deliberately
keeps your preferences. Blocking storage still lets the game run for the current
session; it just will not remember anything.

On a first visit with no saved data, the operating system's
`prefers-reduced-motion` preference is used as the default for reduced effects
and reduced shake. After that, the in-game settings are authoritative.

---

## Accessibility

- Every menu action is a real `<button>`; the touch dash and Nova Pulse controls
  are buttons too, with `aria-keyshortcuts` for `Space`, `E`, and `Shift`.
- Inactive screens use `inert` and `aria-hidden`, so focus and screen readers do
  not wander into hidden panels.
- Visible focus rings are provided for keyboard navigation, plus `Esc` to go back
  and `Enter` to activate a focused control.
- Status text (banner, toast, pause and result readouts) is announced through
  polite live regions.
- The Nova Pulse pips, orb chain chip, and power-up chip expose live labels that
  describe their current state, and the level meter keeps `role="progressbar"`.
  The adaptive-score strip is a real button with `aria-pressed` and a state
  label, so its on/off status is available to screen readers and keyboard users.
- Reduced screen shake and reduced visual effects are available in Settings and
  are honored by the renderer. The adaptive score can be turned off separately
  from sound effects.
- HUD icon buttons are sized for touch (44px targets on mobile), and the touch
  flight pad uses pointer capture so a drag survives leaving the pad.
- The game supports portrait and landscape phones, tablets, and desktop layouts.
  The arena is measured against the touch controls so it does not sit underneath
  the Pulse and Dash buttons on short screens.

If you use a keyboard, `Tab` moves through the active screen's controls; hidden
screens are skipped because they are inert.

---

## Project structure

```text
.
├── index.html          # All screens, HUD, overlays, touch controls
├── style.css           # Visual system, neon styling, responsive layouts
├── favicon.svg         # Inline neon ship favicon
├── .gitignore
├── README.md
└── js/
    ├── config.js       # Palette, tuning, zone data, utilities, SaveStore
    ├── audio.js        # Adaptive synthwave score, ambience, and sound effects
    ├── environment.js  # Pre-rendered parallax skyline, sun, grid, dust
    └── game.js         # Main controller: loop, input, physics, rendering, UI
```

Scripts load in that order and share a single `window.NR` namespace. The main
class is exposed as `window.NEON_RUSH` for inspection or debugging.

Stylesheet and script URLs carry a version query (`?v=2`) so a normal reload
picks up a new score or interface instead of a stale browser cache. Bump the
query when shipping further changes.

### How it fits together

- `config.js` owns all balance values and the validated persistence layer.
- `audio.js` synthesizes every sound with oscillators and noise; the audio
  context is created only after a real user gesture. Its four-bar score is
  scheduled ahead on a 16th-note grid from the main loop: the menu carries pads,
  a slow bass, arpeggio, and the lead motif; gameplay doubles the lead and adds
  drums; pause ducks the whole music bus behind a low-pass filter.
- `environment.js` renders the skyline and background layers once to offscreen
  canvases from a seeded RNG, then scrolls them for parallax instead of redrawing
  the city every frame.
- `game.js` owns one `requestAnimationFrame` loop with clamped delta time, the
  fixed logical play area, DPR-aware canvas sizing (capped at 2), input,
  collisions, particles, HUD updates, and screen state.

The play area is a full-viewport canvas using CSS-pixel logical coordinates.
The renderer scales for device pixel ratio while keeping gameplay consistent
across screens. Particles are capped and reduced further when reduced effects are
enabled; entity counts are bounded per zone. The loop pauses when the page is
hidden and there is a single set of input listeners for the lifetime of the game.

---

## Testing disclosure

This game was built and exercised in a real browser, but it has not been through
a formal QA pass, automated test suite, or playtest on physical mobile hardware.

What was actually checked during development:

- Main menu, level select, how to play, settings, pause, zone-clear, game-over,
  and victory screens render without horizontal overflow at 320×568, 390×844,
  768×1024, 1024×768, 1440×900, 844×390, and 568×320. The gameplay arena was
  measured against the Pulse and Dash controls at each touch size; the longest
  how-to and settings panels scroll vertically where they cannot fit.
- Gameplay starts, the score and timer advance, keyboard flight and dash work,
  and pause/resume stops and restarts the simulation.
- Orb chains build the multiplier, show the HUD chip and countdown, and reset on
  timeout or damage. Power-up and shred pickups extend the chain timer.
- Nova Pulse charges from orbs and power-ups, lights all six pips, fires from
  `E`, `Shift`, and the touch button, clears nearby hazards, and does nothing
  when uncharged.
- Dash phase-shredding destroys hazards for bonus score, and the 2.2 second
  damage invulnerability window still prevents chained hits.
- Homing seekers steer toward the player and collide correctly; the magnet
  power-up pulls orbs and draws its tether and field.
- Zone-clear repairs a life, opens the results panel, and continues into the next
  zone. Game over and victory still finalize the run.
- Best score, unlocked zones, per-zone bests, volume, sound, adaptive music, and
  reduced-effects settings survive a reload. A save without a `music` field
  loads with music enabled; out-of-range and non-numeric values are clamped.
  Reset progress clears records while preserving preferences.
- Reduced screen shake (4 instead of 14 strength on a hit) and reduced effects
  are honored.
- Audio levels were measured from the master bus with an analyser: menu roughly
  0.11 peak, gameplay roughly 0.14, pause roughly 0.027, and exactly 0 with the
  score toggled off or master sound disabled. Menu, game, and pause arrangements
  switch as the state changes, and the score carries a four-bar lead motif.
- The menu score strip toggles music, updates its ON/OFF label and
  `aria-pressed`, and mutes only the music bus while effects keep working.
- No JavaScript console errors were observed during these sessions.

During one regression pass the desktop automation window was occluded, so Chrome
throttled `requestAnimationFrame`; those checks advanced simulation steps and the
audio scheduler directly while measuring DOM, canvas, and analyser state. Later
sessions used the normal animation loop, and final menu, gameplay, and mobile
screenshots were captured successfully.

What was **not** verified:

- Listening tests. Audio nodes produced a measurable signal without exceptions,
  but the score and effects were not audibly reviewed through speakers.
- Physical iOS/Android devices, Safari, Firefox, or older browsers.
- Long-duration soak testing or every possible spawn/event combination.
- Screen-reader behavior with specific assistive technology.
- Performance on low-end hardware under full particle and music load.

Treat the above as an honest account of the smoke testing performed, not a
guarantee of bug-free behavior.

---

## Known limitations

- The game relies on `localStorage`; private browsing modes or restrictive
  browser settings may prevent progress from persisting.
- Web Audio is unavailable in some embedded or restricted browser contexts. The
  game continues silently when audio cannot start.
- Rendering quality and performance depend on the device. Reduced effects can
  help on low-powered hardware.
- There is no online leaderboard, account system, or cloud sync; all records are
  local to the browser profile.
- The procedural soundtrack and effects are intentionally simple and may vary
  slightly in character between browsers.
- Touch controls are hidden on fine-pointer devices; a keyboard is required on
  desktop.

---

## Credits

Design, code, and procedural audio: built for this project.

No third-party libraries, fonts, images, or audio files are used. The favicon is
an inline SVG. The game does not contact any external service at runtime.

**SURVIVE. COLLECT. BREACH.**
