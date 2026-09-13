# over.run

**Build your defenses. Program the response. `> run`**

A playable browser tower defense roguelite. You are an anonymous operator defending your computer against an escalating viral adversary. Install defenses on procedural circuit boards, program their reactions with connected nodes, and observe the attack. Survival earns research between sectors and a permanent trait per frontier sector. Core death erases the whole run and returns the player to sector 000.

## Play online

**https://hyruuk.github.io/over.run/** — the `main` branch deploys to GitHub Pages on every push (`.github/workflows/deploy.yml`). Progress is saved in the browser; export a backup from Settings.

## Play locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. The home screen starts a run or the guided tutorial. Choose defenses and click grid cells, or use **Load starter layout**. The **`> run`** command starts an attack. Only playback speed can change during combat.

## Included

- Fully procedural sector layouts from the save seed: random core and ports, wandering lattice routes, cross-links, denser blocked cells and power sockets as sectors rise, on boards that grow from 28 × 18 to a gigantic 168 × 108 by sector 999. Five attacks per board, new-sector unlocking, and farming previous sectors with diminishing rewards. Death or a reset draws a new seed, so every sector is rewired.
- Nine weapons/fields plus circuit gates; nine enemy signatures including a rebalanced final-attack Daemon. Shotgun, EMP, rail driver and shredder have distinct attack patterns.
- Grid placement, upgrades, recycling, targeting, heat, pressure queues, and gates that fail open. Power capacity comes from research and socketed power supplies that radiate heat, trip under load and are never refunded. Credits come from a bounded sector purse.
- A shared visual routine editor: connected sensor → condition → action nodes, named defense groups, templates, priorities, repeat intervals, and execution feedback.
- **34 temporary exploits** (24 unlocked through research), **81 distinct leveled research nodes** across eight disciplines, **112 permanent traits in five tiers** drafted after each frontier sector, and Daemon scars that mark the core for the run. Connected specialization paths, cross-discipline capstones, and licenses for shotgun, shredder, EMP and rail weapons. A run-profile strip shows every choice with hover details.
- A home screen, a six-step guided tutorial, post-attack diagnostics, survival rewards, and a death screen with a fresh sector 000 retry.
- IndexedDB autosaves, deterministic preparation checkpoints, JSON export/import, explicit reset, and protection against conflicting tabs.
- Worker-based combat, WebGL2 enemy sprites with a Canvas fallback, population cohorts, adjustable visual density, keyboard controls, reduced motion, and a procedural soundtrack: 128 internet-sourced, attributed melody excerpts over five rhythm banks with invented style names, a different tune and tuning per sector, arrangements that add a layer with every attack, generated track names, separate music and effects faders, and a reroll that redraws the whole score. Audio begins after interaction; Settings controls mute and volume.

## Build and verify

```sh
npm run build       # Type checking and portable static output in dist/
npm run preview     # Serve the production build locally
npm test            # Simulation, progression, generation, and storage tests
npm run test:e2e    # Browser workflows and rendering benchmarks
npm run bench       # Headless population stress benchmarks
npm run format:check
```

Browser tests use system Chrome when available. Otherwise install Playwright Chromium with `npx playwright install chromium`, or set `CHROME_PATH` to a Chrome executable. The browser suite serves both the development app and production build.

Upload the contents of `dist/` to a static HTTPS host to deploy. Asset URLs are relative, so subdirectory hosting is supported. No backend, account, API key, or external asset service is required. Public hosting has not been configured or published.

## Save behavior

Preparation changes save immediately. Reloading during combat restores the pre-attack checkpoint with the same encounter; it does not grant partial duplicate rewards. Core death clears installations, exploits, routines, research currency, the research tree and sector unlocks. Successful sectors and voluntary extraction with a living core retain research. Export backups from Settings; browser data clearing can remove local saves.

## Design and evidence

- [Game design](docs/game-design.md)
- [Architecture baseline](docs/architecture.md)
- [Implementation and verification notes](docs/implementation-notes.md)
- [Staged implementation plan](docs/implementation-plan.md)
- [Battlefield art prompts](docs/art-prompts.md)
- [Simulation measurements](artifacts/simulation-benchmark.json)
- [Browser rendering measurements](artifacts/browser-benchmark.json)

This is the first playable release. Balance and content depth need player feedback; literal unlimited entities and performance on every device are not claimed. See implementation notes for the exact limits and remaining validation.

Every sector's board background is painted procedurally in `src/substrate.ts` from the sector seed: solder-mask colour, routing density, components, silkscreen and wear scale continuously from sector 000 to 999. AI-generated textures under `public/textures/` (made with the Codex CLI image tool via `scripts/generate-textures.sh`) are tiled, cropped and blended as raw material; any of them can be missing. Enemies, installations, the core, entry ports, and chip packages are hand-drawn SVG sprites in `src/art.ts`, tinted at runtime and packed into a GPU atlas for the enemy layer; effects and traces are drawn procedurally. See [Battlefield art prompts](docs/art-prompts.md) for generating textures. Daemon breaches add 45 heat and slow weapon firing for eight seconds; cache leeches steal up to 15 credits per member. Sector labels are zero-based; save-file level IDs remain one-based for compatibility.

### Melody library

The game bundles 128 distinct four-bar melody excerpts from the [Ceol Rince na hÉireann corpus](https://github.com/polifonia-project/folk_ngram_analysis/tree/9d8ccf9fe40ffdd2a1787e75527062fc1d07c669/cre_corpus), whose README licenses the corpus under CC BY 4.0. Credit: Danny Diamond, Abdul Shahid and James McDermott / Polifonia; ABC transcriptions by Bill Black; original tune collection by Breandán Breathnach. These are Irish traditional tune excerpts adapted into chip-jungle arrangements, not recordings of jungle tracks. Original MIDI files, source checksums, adaptation notes and notices are bundled in `public/music/`; the Settings screen links to the complete music credits.

Run `python scripts/import-melodies.py ARCHIVE TREE_JSON` to reproduce `src/data/melodies.json` from the pinned upstream GitHub archive and recursive tree response. The importer verifies source blob hashes, selects monophonic straight-meter excerpts, retains note contours/rhythms within sixteenth-note quantization, and excludes duplicate phrases. Runtime changes at most one weak-beat passing note per melody and adds small expression/timing variations. Bass, pads and melody use a shared tuning lattice: 12-tone equal, just intervals, Pythagorean fifths, 19/24/31-tone lattices, Chinese gong/yu-inspired pentatonic palettes, Bhupali/Yaman/Bhairav-inspired palettes, and Hirajoshi-inspired pentatonic; reference pitches are A4=432/440/444 Hz.

Music defaults on independently of sound effects, including for legacy saves that predate its own switch. An explicit music mute is saved. Browsers start audio after the first click or keypress. Playback speed stays unchanged when Run is clicked.

Credits now carry across living sector completions and extractions; death starts a new run with the initial grant. Victory offers a research stop before selecting the next sector. Research is also available from the disconnected board.

Board layouts are version 4. Old active boards remain intact; cached boards regenerate when next deployed. Optional textures can be generated automatically with `scripts/generate-textures.sh`, which drives the Codex CLI's image tool.

Build a **Power supply** (125 credits, shortcut R) for +4 W; each upgrade adds +2 W. A supply cannot be recycled while installed defenses need its output. Sustained weapon fire creates heat: at the thermal limit weapons stop until cooled to 45%. In Routines, choose **New routine** to author every node, or **Auto vent** to vent above 65% heat every five seconds. Venting removes 55 heat and cancels overclock.

Enable **Settings → Developer mode**, then use **DEV** for credits, research, full weapon/tree unlocks, repairs, next-sector skips or direct sector jumps (000–999). Stop an attack to restore its preparation checkpoint before editing. Developer changes persist in the current save.

Each deployment seed recreates its musical arrangement, while reloads preserve that arrangement. Cultural names describe pitch-palette adaptations, not complete traditional performance systems: the original 128 authored melodies remain the Irish corpus described above. Pitch references include [Smithsonian Folkways’ Chinese pentatonic lesson](https://folkways-media.si.edu/docs/lesson_plans/FLP10050_east_china.pdf), [Bhupali](https://ragajunglism.org/ragas/bhupali/) and [Darbar’s Bhairav description](https://darbar.org/raga/bhairav/).
