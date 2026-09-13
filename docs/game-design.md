# Game design

## Identity

Title: **over.run**. The word `run` is an executable command throughout the interface: `> run` launches an attack, `> running_` signals execution, and `> compile` saves the automation graph. The terminal motif represents actual player actions.

The player is an anonymous operator defending their own computer against an escalating adversary. Circuit traces carry viruses toward a central core. The player places defenses on a grid, controls traffic through gates, and programs a shared node graph before launching each attack.

The fantasy is authorship: build a system, watch it execute, understand its failures, and improve it. Decisions should be decisive, while repeated attempts can earn stronger permanent tools.

Visual direction: Neuromancer, goth cyberpunk, hexcore, old programming terminals. Dark electronic substrates, sharp circuit geometry, phosphor text, restrained violet and green, and ominous system messages. Color is supported by shape and labels. Decorative terminal effects must preserve readability.

## Confirmed decisions

| Area                          | Decision                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Platform                      | Browser first, with resource use designed for very large populations                                                       |
| Placement                     | Grid-based defenses on computer-chip maps                                                                                  |
| Combat input                  | Passive observation and playback-speed control only                                                                        |
| Automation                    | Accessible node programming; one shared graph referencing defenses or groups; editable templates                           |
| Routing                       | Players can seal paths; pressure can eventually break the seal                                                             |
| Persistence within an attempt | Defenses, upgrades, routines, temporary upgrades, and core damage persist between attacks                                  |
| Defense damage                | Enemies do not damage or destroy defenses                                                                                  |
| Short-lived state             | Heat and temporary ability state reset between attacks                                                                     |
| Attempt                       | One board until failure or completion; advancing means building fresh defenses                                             |
| Farming                       | Earlier levels remain available; defeat grants resources without removing permanent progression                            |
| Map identity                  | Stable board layout per campaign level; procedurally generated levels                                                      |
| Attack information            | Reliable threat forecast with uncertainty clearly marked                                                                   |
| Early duration                | Approximately one minute per attack at normal speed; no mandatory upper duration bound                                     |
| Permanent progression         | Connected arsenal, infrastructure, automation, and analysis tree; all nodes eventually unlockable and permanently active   |
| Run variation                 | Randomized temporary upgrade choices between attacks                                                                       |
| Economy                       | Attempt credits paid from a bounded sector purse, socketed power supplies, permanent research; local heat for overclocking |
| Run-wide choices              | One permanent trait per frontier sector cleared; Daemon breaches leave permanent scars; exploits stay with the board       |
| Farming                       | Repeats of a cleared sector pay less every time, without a floor; only the frontier drafts a trait                         |
| Difficulty                    | Uncapped: sectors past 100 should read as seemingly impossible, sectors past 900 as virtually impossible                   |
| Enemy scale                   | Individuals initially; ordinary enemies aggregate into swarms at scale; special enemies remain individual                  |
| Saving                        | Save progression and preparation state, with an explicit reset option                                                      |

The following sections turn these decisions into proposed initial rules. Exact costs, counts, thresholds, and reward formulas remain tuning decisions.

## Player loop and screens

0. **Home:** every session opens on a home screen: continue or start a run, launch the guided tutorial, reach sectors, research and settings, and read the run's status and the music now playing.
1. **Level selection:** choose an unlocked board or revisit a previous one. Access permanent research here.
2. **Preparation:** inspect forecast, build or upgrade, configure gates and routines, and select earned temporary upgrades. Display range, power use, and routing before committing.
3. **Attack:** execute the prepared defense. Controls change playback speed; inspection is read-only. No construction, purchases, graph editing, or manual ability activation.
4. **Diagnostics:** show damage sources, leaks, gate failures, idle defenses, and routine activations. Continue to preparation if the core survives.
5. **Attempt result:** on failure or final-attack completion, award research and return to progression. Completion unlocks the next level.

Prototype playback speeds: 0.5×, 1×, 2×, and 4×. Faster playback advances the same simulation. Early attacks target about 60 seconds; later ones can run longer. Avoid extending duration as the sole difficulty lever.

## Board and traffic

Cells distinguish buildable substrate, circuit traces, blocked components, gate locations, entry points, and core. Ordinary towers occupy buildable cells and do not themselves erase circuit paths. Gates control trace connections. Placement previews expose valid cells and range.

The first board has two entrances, one core, and a junction with an alternate route. Later boards can add routes and optional protected components; secondary component rules are outside the initial slice.

Viruses follow circuit routes. Closing a gate can force a detour or create a queue. Queued enemies contribute pressure according to their represented population and pressure weight. Defenses can reduce pressure by eliminating the backlog; routines can open a bypass or release a gate.

Proposed failure rule: a gate that reaches its pressure limit fails open for the rest of the attack and is restored during preparation. This is a temporary loss of sealing function, not tower damage. Pressure cannot be erased by rapidly toggling a gate; it dissipates as the backlog clears. The HUD shows the pressure source, current value, and limit.

A fully blocked route must produce pressure at a reachable blocking gate. The simulation must never leave enemies in a permanent pathfinding stall. Loops need deterministic route selection and a bounded route policy.

## Defenses and enemies

Initial defense names are working names.

| Defense        | Role                                                                 | Useful routine                                |
| -------------- | -------------------------------------------------------------------- | --------------------------------------------- |
| Packet Cannon  | Fast single-target attacks; reliable cleanup                         | Prioritize enemies nearest the core           |
| Packet Mortar  | Area damage against concentrated traffic                             | Attack the densest cluster near a sealed gate |
| Throttle Field | Slow enemies within a local area; effects do not stack without limit | Prioritize a threatened route                 |
| Circuit Gate   | Seal or release traffic; consumes infrastructure capacity            | Open a bypass before pressure reaches failure |

Towers run useful defaults without programming. Weapons have explicit power costs and upgrade paths. Overclocking temporarily improves eligible defenses and generates local heat; exceeding a limit suspends the boost until cooled. Exact multipliers and cooldowns require tuning.

Initial enemies: basic virus, fast virus, and armored virus. All can breach the core; armor should have a legible response in the arsenal. Future candidates include splitting worms, concealed rootkits, support viruses, and boss threats. Mechanics that damage towers are excluded.

## Automation

The graph uses plain-language sensors, conditions, and actions. Wire animation and inspector explanations reveal execution. Players can start from editable templates.

Example: `Gate pressure above 70% → Open bypass gate → Overclock nearby mortar`.

Initial actions control gate state, targeting policy, overclocking, and weapon abilities. Purchases and placement remain preparation actions. Graph references may target an individual defense or a named group. Missing targets display a warning and safely do nothing.

Proposed execution model: evaluate rules at fixed simulation intervals, fire on a condition becoming true, and allow explicit repeat intervals. Define visible priority when two rules issue conflicting commands. Start with acyclic graphs; any future feedback loops require an explicit delay or state node. Show invalid connections before launch and explain the fix.

Templates: pressure relief, heat-safe overclocking, and breach-priority targeting. Advanced unlocks expand available sensors and actions without requiring every player to write a complex graph.

## Economy and progression

**Credits** fund construction and upgrades and carry forward while the core lives. Each sector pays a bounded **purse** spread over its five attacks (12/16/20/24/28%), paid per point of breach value removed, so a sector pays roughly the same whether it holds a hundred enemies or a trillion. The purse grows slowly and linearly with the sector; costs stay fixed. Scaling therefore has to come from research, exploits and traits, not from farming. Daemons carry their own bounty. Selling refunds 80% of investment, except power supplies, which refund nothing.

**Farming**: the frontier (highest unlocked sector) pays in full and is the only place a trait is drafted. Every attempt on an already cleared sector is a farm and pays 60% of what the previous farm of that sector paid, in credits and research alike, with no floor. Farming stays possible, never efficient.

**Power capacity** constrains installed equipment. Base capacity is 14 W, raised mainly by Auxiliary bus research. **Power supplies** are the only in-attempt source and are deliberately scarce and risky: they fit only in power sockets (one per board early, four by sector 030, then growing with board area to about a hundred on the gigantic late boards so a real power grid can exist), cost 300 credits with steep three-level upgrades, radiate heat to weapons within two cells, trip for a few seconds after twelve seconds above 90% load or whenever a Daemon breaches, and are never refunded. Credits sunk into a supply stay in that sector.

**Research** is awarded at attempt settlement for meaningful combat progress, including failed attempts. A completion bonus is proposed, not yet balanced. An immediate zero-progress failure need not award research. Earned persistent resources are never subtracted as a defeat penalty.

Defeat clears the current attempt's installations and temporary choices; it preserves research and all permanent unlocks. A new attempt begins stronger if the player purchases research. Permanent upgrades purchased between attempts apply when the next attempt is created, keeping combat rules stable within an attempt.

The tree has four connected branches:

- **Arsenal:** new defenses, weapon interactions, targeting options, modest stat gains.
- **Infrastructure:** gate options, cooling, power capacity, circuit control.
- **Automation:** sensors, conditions, actions, and expanded programming capabilities.
- **Analysis:** richer forecasts, enemy weakness tools, and research improvements.

Every node is distinct, never repeated, and compiles over several levels (2 to 10 depending on the node); each level costs 35% more than the last and grants the node's effect again. Nodes give a build a direction: critical chance, arc chain length, blast radius, routine capacity, supply output, scar removal. All nodes are eventually purchasable; there are no mutually exclusive permanent commitments. Avoid permanently harmful tradeoffs in research; those belong to traits and exploits.

**Exploits** are temporary: between surviving nonfinal attacks, offer one of three seeded upgrades applicable to owned or accessible tools, at most three copies of each. Choices expire with the attempt. Farming a lower sector still drafts exploits, since they never leave the board.

**Traits** are permanent for the run. Clearing a frontier sector drafts one of three seeded traits from a single tier, never one already owned. The catalogue holds over a hundred traits in five tiers: Patch (sectors 000–008, small adjustments with a mild cost), Firmware (009–028, real tradeoffs and new mechanics), Kernel (029–098, build-defining commitments), Architecture (099–298, large numbers with heavy downsides) and Singularity (299 and beyond, run-warping). The tier follows the sector cleared, with a one-in-five chance of drafting from the tier above; a tier that runs dry borrows from its neighbours. Every trait is pure data: a set of numeric bonuses whose description is generated from the numbers, so text and mechanics cannot drift. Mechanics traits can express include short-circuits on thermal shutdown, secondary explosions on area hits, per-weapon power draw and cost shifts, stacking throttle fields, scheduled supply trips, gate detonations, installation limits with per-slot damage, breach charge, routine penalties for unreferenced weapons, extra Daemons, core regeneration, extra supply levels and an open grid that lets supplies install on any empty cell without limit (they still cost credits and radiate heat). Explosions, short-circuits and power trips are visible bursts on the board.

**Scars** are permanent maluses. When a Daemon breaches the core it imprints a seeded scar on top of the temporary clock corruption: a slower clock, a leaky bus, memory rot, pressure fatigue, hot silicon, hungrier Daemons, a redacted draft or a brittle core. Each stacks up to three times. The scar is announced with its exact numbers, shown in the run profile, and can be purged one at a time by Quarantine research in the Analysis discipline.

**Run profile**: the operator console shows every choice of the run as chips (traits, exploits with copy counts, scars, research levels per discipline) with hover and focus details, so a build can be read at a glance.

## Procedural progression

A campaign seed and level index determine a stable board. Store the generated layout so generator updates do not silently replace a familiar level. Attacks and upgrade offers can vary across attempts using separate seeds; forecasts remain truthful about known threats.

Board dimensions grow with the sector: barely through sector 100 (about ×1.3 on each side), then steeply, so sector 999 is gigantic (about ×6, 168 × 108 cells). Cells keep a minimum on-screen size and the board scrolls inside its panel, so installations and viruses stay legible at every size. Gates that fail or detonate are rebuilt before the next attack, like heat and every other short-lived state.

Difficulty grows through population (×1.28 per sector, capped at 10^12 per attack), health (a logarithmic term times 1.02 per sector, uncapped), armor (+1 per 40 sectors), speed, breach damage and Daemon count (one more per 100 sectors). Map dimensions and live simulation structures have practical caps. The intent is a curve where sectors past 100 look seemingly impossible and sectors past 900 virtually impossible; the exact coefficients are tuning decisions.

Previous boards remain selectable. Higher levels award more research for comparable progress; repeats of a cleared sector decay without a floor, so farming is a valid stopgap and never the main path.

## Music

Each sector has a procedural score with a generated hacker-flavoured track name: an authored, attributed folk melody over a rhythm section assembled from genre banks (drum & bass, dubstep, UK bass, house, UK garage), with the genre drawn at random per sector. Every drum and bass part is drawn from large sets of one-bar patterns, two per part, alternated and varied per bar with fills, drop-outs and swing, so arrangements never repeat exactly. The arrangement layers up with the attack number: kick and bass alone, then snare and hats, then the lead, then percussion, open hats and fills, then rolls, stabs and an echo. Settings offer separate music and effects faders, a reroll that redraws everything (genre, melody, tuning, key, tempo, name and patterns), and a reset.

## Onboarding

A six-step tutorial runs on the console with a fixed card and highlighted controls: install a cannon, seal a trace, program a routine, run an attack, read diagnostics and draft an exploit, then a briefing on power, research, traits and scars. Progress persists; it can be skipped or replayed from the home screen.

## Diagnostics, accessibility, and saving

Initial diagnostics include breach locations and times, damage by defense, reasons for idle time, peak gate pressure, and routine activation/failure counts. Attribute a failed action to a concrete reason such as cooldown or a missing target. A full visual replay is a later option, not part of initial scope.

Use readable labels, keyboard-accessible controls, reduced-motion settings, separate music/effect volumes, and distinct silhouettes. Keep decorative effects below combat information. Node editing needs a form/list alternative for essential operations.

Autosave preparation edits, choices, research purchases, and settled results. Proposed interrupted-attack behavior: resume at the saved pre-attack checkpoint using the same seed. Say this clearly in the interface. Local save export/import provides a backup; browser storage can be cleared or unavailable.

Full reset requires explicit confirmation describing the permanent data removed. It creates a fresh campaign and clears the active attempt. Discarding an attempt is separate from resetting all progression.

## First playable scope

One authored board; five attacks; three combat defenses plus a gate; three enemy types; shared graph and templates; one-of-three temporary rewards; approximately 12 permanent nodes spanning all branches; diagnostics; local saving and reset; win and loss settlement; level-selection scaffolding.

The authored board is a test fixture for the later generator. The next milestone must add a generated next level and revisiting, rather than presenting the single board as the finished game.

Success means players can explain a failure, make a deliberate change, and observe its effect. Performance, numerical balance, art direction, and automation discoverability must be validated in a playable build.
