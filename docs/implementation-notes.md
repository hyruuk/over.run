# over.run — implementation notes

September 13, 2026 · first playable release · package version 0.1.0

## Delivered behavior

The application supports the complete attempt loop: install defenses, configure routines, run passive combat, inspect diagnostics, select an exploit, repeat through five attacks, then settle research and unlock the next board. Failure and voluntary disconnection also settle earned research without subtracting permanent resources. Earlier sectors can be revisited with their layout preserved.

The title is **over.run**; the primary action is `> run`. During combat it becomes `> running_`, while a visible command line identifies the sector and attack. `> compile` commits routines. The original working-name IndexedDB database and session-lock identifiers remain internal so the rename does not orphan existing saves. Exports and all player-facing branding use over.run.

## Implementation choices

TypeScript, Vite, semantic HTML, and authored CSS form the application. There are no runtime framework or rendering-library dependencies. The selected renderer uses Canvas2D for the grid, circuit traces, installations, and bounded effects, with a WebGL2 point-sprite layer for enemies. Enemy and installation art is authored as inline SVG in `src/art.ts`; the GPU layer samples a grayscale atlas built from those drawings and multiplies it by the cohort colour, and the Canvas2D path rasterises tinted copies on demand. Until the atlas decodes, enemies draw as plain discs. A Canvas2D enemy fallback exists if WebGL2 cannot initialize. The board background is a procedural substrate (`src/substrate.ts`) painted once per board size into an offscreen canvas from the sector seed, with palette, density and damage ramps over sectors 000 to 999; optional raster textures are tiled and blended as raw material and are never required. This is a simpler implementation than the originally proposed batched sprite-library adapter; browser measurements justify retaining it for the current workload.

The simulation runs at 30 fixed ticks per simulated second in a dedicated worker. Playback requests change tick throughput. Integer positions and stable iteration order determine combat; wall-clock time only schedules work. Incoming messages identify the attempt and revision. Snapshot acknowledgments bound queued messages. Rendering attempts 60 refreshes per second, independent of simulation snapshots.

Files are organized by module responsibility in `src/`, rather than one directory per component. Content is data-driven in `content.ts`; progression mutations are isolated in `model.ts`; persistence validates and atomically replaces a complete versioned profile. The worker freezes the preparation checkpoint at launch.

## Rules that are concrete in this release

- Starting credits: 360, plus research bonuses. Base power: 14, plus research, exploits, traits and scars. Core integrity: 100, plus research, minus Glass core.
- Credits come from a sector purse: 900 × (1 + 0.05 × (sector − 1)), split 12/16/20/24/28% over the five attacks and paid per point of breach value killed (a Daemon pays 10% of the purse). Farm attempts on cleared sectors pay ×0.6 per repeat, credits and research alike, with no floor. Cache leeches still steal.
- All combat installations have five upgrade levels. Recycling refunds 80% of total investment. Power supplies install only on socket tiles (tile value 3; one socket at sector 000, four by 030, then `round(3 × boardScale²)`, about 108 at sector 999; open-grid traits also allow substrate), cost 300 with upgrades at 240 and 384, output 4/6/8 W, radiate 0.12 heat per tick to weapons within two cells, trip for 3 s after 12 s above 90% load (6 s when a Daemon breaches), and refund nothing. Unpowered weapons stand down until the supply recovers.
- Threat scaling: health × (1 + 0.45 log₂ sector) × 1.02^(sector − 1); armor +1 per 40 sectors; speed +0.4% per sector (×2 cap); breach damage +2% per sector; one extra Daemon per 100 sectors. Population growth is no longer capped at sector 100.
- Traits: 112 permanent run choices in five tiers (`TIERS` in `content.ts`), three drafted from one tier after each frontier clear, never repeated; the tier follows the sector with a 20% chance of the tier above, and dry tiers borrow from neighbours. Every trait is a `Bonuses` object; `describeBonuses` generates its text. The simulation and model read only numeric keys (`slots`, `slotDamage`, `unreferenced`, `slowStack`, `slowedDamage`, `tripInterval`, `gateBlast`, `shortCircuit`, `chainBlast`, `breachCharge`, `critDamage`, `daemons`, `coreRegen`, `supplyLevels`, `openGrid`, `draw:<kind>`, `cost:<kind>`), so new traits need no code. Detonated gates are rebuilt with the next preparation phase like any failed gate. Developer tools can grant any trait, clear traits and clear scars.
- Scars: eight permanent maluses, each stacking to three; a Daemon breach draws one from the pool with stack room, announces it, and it lands on the profile at attack completion. `analysis-9` (Quarantine) removes the most recent scar per level bought.
- Simulation bursts (explosion, short-circuit, surge, trip) travel in the snapshot and draw as expanding rings.
- Gates install on trace cells; combat defenses install on empty substrate cells. Gate pressure is cumulative while a queue remains, and decreases as the queue clears. Failure leaves the gate open for that attack. A one-tick pressure-accounting delay is deliberate.
- Damage, targeting, area effects, slowdown, armor piercing, and distinct-member arc chains are implemented. Overclocking accelerates weapons and extends throttle-field range. Thermal limits suspend the boost.
- Routines are connected three-node chains, not a freeform arbitrary graph canvas. Every row has a sensor/scope, comparison/threshold, and action/repeat interval. Rows execute in visible priority order. This provides keyboard-accessible node programming without arbitrary code or cycles.
- Templates cover pressure relief, safe overclocking, and cluster targeting. All installed defenses also have functional defaults without routines. Research unlocks the purge action.
- The research tree has four core disciplines of eight or nine distinct leveled nodes (2–10 levels, level cost × 1.35 per level, effect per level) plus four specialties of twelve nodes (leveled passives, single-level licenses and exploit unlocks). Research is stored as a list of level purchases: a node id appears once per level. Old saves with the former 24-node branches load with unknown ids and orphaned levels dropped.
- Randomized offers are deterministic for the saved attempt and wave. Up to three copies of an eligible exploit can be offered across the four inter-attack choices (one fewer option per Redacted draft scar). Immediate repairs and credit grants apply once, transactionally. Exploits stay with the board; traits and scars are copied into each attempt at start, like research.
- The operator console shows a run profile: traits, exploits, scars and research levels as focusable chips with a shared tooltip.
- Maps are generated from the save seed and sector: a random interior core, ports on the edges, and routes that wander through lattice waypoints (three cells apart) toward the core, plus cross-links, all connected by construction. Ports, waypoints, links and blocked-cell density rise with the sector. Dimensions scale from 28 × 18 by `boardScale`: ×(1 + 0.003·(sector − 1)) through sector 100, then plus 4.7·((sector − 100)/899)^1.5, reaching about 168 × 108 at sector 999. The renderer keeps cells at least 18 css pixels wide and lets the board panel scroll when a board no longer fits; canvas backing stores are capped at 8192 px per side. Tested across 1,000 seeds and 30 sectors. Death and reset draw a new seed. The board cache keeps 64 layouts; evicted layouts regenerate deterministically.

## Scale and limits

Ordinary spawn packets become cohorts when multiple identical enemies arrive on the same tick. Large sets of compatible records merge periodically. Cohorts store per-health-band counts, preserving distinct member health for area and single-target attacks; specials remain individual. Grouping depends on deterministic game state, never measured frame rate. Health-band grouping does not promise equivalence to an arbitrary continuous-collision engine.

The render snapshot includes at most 4,000 simulation records, and visual density is capped independently at 10,000 sprites (2,500 on low). A population indicator reports the actual hostile count. Rendering fewer sprites never deletes simulated enemies. Diagnostic events retain the most recent 100 entries; effect queues are bounded. No full visual replay is stored.

There is no authored final sector. Population growth is bounded at 10^12 per encounter, encounter duration stops scaling linearly after level 100, and enemy health continues to grow logarithmically with level. Sector indices and active combat quantities use finite JavaScript numbers; permanent research uses a serialized bigint. This is practically open-ended progression, not literal infinite arithmetic or unlimited independently simulated entities.

Credit income is normalized by the sector purse, so population never inflates the economy. All represented kills still count for combat and research. Late-game balance is provisional and intended to become impossible: the extreme-population benchmark is not evidence that those sectors are balanced or enjoyable.

## Saving and compatibility

IndexedDB stores a complete validated profile in one transaction, with a revision check preventing stale writers. The Web Locks session guard stops simultaneous active tabs on browsers that support it; revision checks remain the storage safeguard. A settlement receipt and active-attempt clearing occur in the same transaction, preventing duplicate rewards.

Import validates versions, resources, prerequisite chains, board connectivity, tower placement, and routine structure before replacement. Full reset and import replacement require explicit confirmation. Failed writes retain the previous preparation checkpoint and display a message. Schema version 1 is the only supported import version; later schema migration remains future work rather than silently accepting unknown formats.

Modern desktop Chromium is verified. Responsive layout at 390px is checked, but this is a desktop-first game: the small mobile grid is not yet a substitute for dedicated touch controls and zoom. Firefox, Safari, screen-reader workflows, context-loss recovery, real-device GPU behavior, and prolonged save-migration scenarios require further testing.

## Verification evidence

Automated simulation tests cover seed stability/connectivity; placement, power and research constraints; deterministic batching; defeat; five-wave victory and revisiting; gate failure and automation; graph validation; cohort health conservation; mixed damage against a count-one reference; arc member semantics; deterministic offers; idempotent settlement; save validation; and stale-writer rejection.

Browser tests cover installation and routine compilation, attack input locking, interrupted-attack checkpoints, export/reset, imports, all five attacks and next-sector reload, invalid imports, simultaneous tabs, research purchases, responsive overflow, and dense rendering workloads. A separate smoke test exercises the bundled production worker.

Benchmark artifacts include environment metadata and explicit limitations. The reference CPU is an AMD Ryzen AI 9 HX 370. Initial 300-tick simulation measurements were roughly 2.9 ms at the 95th percentile for 10,000 unmerged ordinary records, and below 1 ms for a million represented enemies in compatible cohorts. These population tests initially omit towers and are not full combat performance promises.

The headless Chromium/SwiftShader renderer sustained approximately 60 draw submissions per second with the original procedural point shader, and roughly 27 per second after the move to textured, larger sprites; the software rasteriser pays per fragment, so the drop mostly reflects sprite area and texture sampling and is not expected on hardware GPUs. Both figures cover 10,000 visible sprites and a million-member swarm represented by 1,000 records. Draw-submission timings do not measure GPU completion or establish 60 FPS on arbitrary hardware. The live JSON reports are authoritative for the latest run.

## Home, tutorial and music (September 13, 2026)

The application opens on a home screen (`view` state in `main.ts`); the console is entered by continuing or starting a run, importing a save with an active attempt, or any action that starts an attempt. The tutorial (`src/tutorial.ts`) is a list of goals checked against the profile; the current step is stored in `settings.tutorial` and advances after the save that satisfies it settles. Music: `src/beats.ts` holds five genre banks (10 kicks, 8 snares, 8 hats, 4 open hats, 5 percussion and 8 bass rhythms each) plus 12 fills; `generateScore` draws two patterns per part and `musicNotes` alternates them per bar, adds fills on phrase ends, drops the kick once per 16 bars, swings off-beats for swung genres and layers instruments by attack number (`intensity` on the audio engine). Settings persist `musicVariant`, `musicVolume` and `effectsVolume` (the legacy `volume` remains as a fallback); reroll increments the variant, which changes the genre, melody, tuning, key, tempo, track name and patterns; reset restores variant 0. The genre is drawn at random per sector and variant; `trackName` generates names from seeded word lists. Music and effects buses carry make-up gain into a compressor on the master so the faders reach a useful loudness. The drum-pattern repositories found online carried no license, so the banks are authored in-repo.

## Balance pass (September 13, 2026)

Sector purse, socketed and risky power supplies, farm decay without a floor, distinct leveled research, permanent traits with simulation events, Daemon scars with Quarantine, an uncapped threat curve and the run-profile strip were added in one pass. Unit tests cover each rule and the browser suite, updated for the trait draft, run profile and node counts, passes on headless Chromium. A scripted naive layout clears sector 000 and takes one Daemon scar, and loses sector 001 at attack four without adapting, which is the intended shape; coefficients remain playtest-driven.

## Remaining release work

The current build is playable and produces deployable static files. It has not been published to a hosting account. Further work is primarily player-driven balancing, more varied research and enemy mechanics, broader browser/accessibility verification, hardware profiling, prolonged memory soak tests, richer board generation, and dedicated touch navigation. The initial soundscape consists of original synthesized UI/combat cues rather than a composed soundtrack.
