# Implementation plan

Status: the first playable release implements the gameplay loop across these stages, including procedural sectors, research, routines, saving, and population cohorts. [Implementation notes](implementation-notes.md) record what shipped and what remains unverified. This document retains the original acceptance targets; real-device compatibility, long-duration soak testing, and progression balance are not claimed complete.

## 1. Simulation and browser foundation

Scaffold TypeScript application, worker protocol, fixed-tick simulation, seeded random streams, and a GPU renderer adapter. Add a simple authored circuit with moving basic viruses and developer performance counters. Benchmark candidate rendering dependencies before choosing one.

Acceptance: identical simulation state after equal ticks at all playback speeds; UI remains responsive during worker load; hidden-tab behavior is deliberate; no per-enemy DOM elements; record a baseline performance result and chosen dependencies.

## 2. Complete basic attempt

Implement grid placement, three combat defenses, three enemies, credits, power capacity, core breaches, five attacks, and preparation/attack/result transitions. Add the gate, alternate route, queue pressure, and restoration between attacks.

Acceptance: win and lose an entire attempt; combat input cannot mutate defenses; saved core damage carries between attacks; gates can fail without damaging towers; full closure cannot deadlock the attack; killing a backlog reduces pressure.

## 3. Programming and explanation

Build the shared node editor, typed validator, execution priorities, individual/group references, and three templates. Add heat and automatic special actions. Produce diagnostics tied to the same simulation events.

Acceptance: a player can configure pressure relief without code; a routine changes a measurable outcome; invalid graphs receive actionable errors; conflicting rules resolve consistently; diagnostics explain breaches, idle towers, and failed actions.

## 4. Progression and durable saves

Add seeded one-of-three temporary rewards, approximately 12 permanent research nodes, attempt research settlement, level-selection UI, IndexedDB saves, migrations, export/import, and reset. Save the current preparation checkpoint and restore it after interrupted combat.

Acceptance: defeat earns research for progress; purchases remain active on future attempts; temporary choices expire at attempt end; reload does not reroll offers or double rewards; reset requires confirmation and clears progression; save failures are visible. At this stage the one-board first playable slice is complete.

## 5. Procedural levels and farming

Implement seeded generation with validation and fallback boards, encounter budgets, new-level unlocking, and previous-level revisiting. Preserve generated layouts across reloads and content updates. Add a second visual board variation and more enemy combinations.

Acceptance: winning unlocks a fresh board with fresh defenses; revisiting restores its layout while starting a new attempt; large seed samples pass structural validators; invalid generation terminates through a valid fallback; farming gives useful rewards without being the only practical progression path.

## 6. Swarm scale and endless progression

Add deterministic cohort conversion using the already defined count-one representation. Implement damage/status bands, route splitting, independent sprite budgets, bounded telemetry, and large-number progression rules. Profile adverse status fragmentation and gate backlogs.

Acceptance: conservation and differential checks pass under documented quantized combat rules; playback speed and hardware load do not alter results; record 10,000-individual and million-represented-enemy benchmark outcomes; memory remains bounded in soak tests; progression arithmetic stays finite and serializes correctly. If budgets fail, revise content and representation before increasing population claims.

## 7. Content depth and release preparation

Expand the tree, weapon interactions, enemy families, temporary upgrades, and board motifs using validated data definitions. Develop original visual/audio assets. Add onboarding, settings, keyboard navigation, node-editor alternatives, and reduced motion. Playtest progression pacing and diagnostic usefulness.

Acceptance: every permanent node is reachable and functional; no unavoidable harmful permanent unlocks; multiple viable defense strategies; complete browser compatibility and storage-recovery checks; measured performance settings; production build and deployment configuration; exported saves restore correctly. Choose a hosting target when a deployable build exists.

## First playtest questions

- Does preparation offer meaningful choices without requiring a long tutorial?
- Is a one-minute attack satisfying to watch at normal speed?
- Can a player explain a breach and make a useful adjustment?
- Does programming feel optional at first and rewarding as complexity grows?
- Do temporary choices encourage adaptation without invalidating the current build?
- Does defeat reward progress enough to motivate another attempt?
- Do dense swarms remain readable and behave consistently?

## Deferred decisions

Resolve through prototypes: rendering library, exact economy and refund rates, gate pressure equations, armor/area-damage balance, graph capacity, reward stacking rules, cohort thresholds, numerical tier scaling, final art production workflow, and minimum supported hardware. Full visual replays, cloud saves, mobile-specific controls, and multiplayer are outside the first release plan unless scope changes.
