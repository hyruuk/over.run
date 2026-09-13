import './style.css';
import {
  TOWERS,
  ENEMIES,
  RESEARCH,
  BRANCHES,
  PERKS,
  TRAITS,
  TIERS,
  traitTier,
  SCARS,
  maxCore,
  powerCapacity,
  powerUsed,
  powerDraw,
  powerOutput,
  maxLevel,
  nodeLevel,
  levelsIn,
  branchLevels,
  purse,
  farmMultiplier,
  bonus,
  format,
  towerRange,
} from './content';
import {
  freshProfile,
  startAttempt,
  build,
  sell,
  upgrade,
  buyResearch,
  rewardOffers,
  chooseReward,
  chooseTrait,
  grantTrait,
  setSeed,
  parseSeed,
  formatSeed,
  recordAttack,
  profileLoadout,
  settle,
  template,
  validateRules,
} from './model';
import { encounter, neighbors, threat, boardSize } from './generation';
import { SaveStore, validateSave } from './persistence';
import { BoardRenderer } from './rendering';
import { AudioEngine } from './audio';
import { TUNINGS, encodeTrack, decodeTrack, type TrackCode } from './music';
import { GENRES } from './beats';
import { MELODY_LIBRARY } from './melodies';
import { researchPanel } from './research';
import { TUTORIAL, TUTORIAL_DONE, tutorialActive, tutorialStep, nextTutorialStep } from './tutorial';
import { buildCost, upgradeCost, sellValue, type Branch } from './content';
import type { Profile, Snapshot, TowerKind, Rule } from './types';

const root = document.querySelector<HTMLDivElement>('#app')!;
const store = new SaveStore(),
  audio = new AudioEngine();
let profile: Profile,
  renderer: BoardRenderer | null = null,
  worker: Worker | null = null;
let attacking = false,
  busy = false,
  selected = '',
  tool: TowerKind | null = null,
  speed = 1,
  workerRevision = 0,
  snapshot: Snapshot | null = null;
let researchBranch: Branch = 'arsenal';
let modal = '',
  diagnostics: Snapshot | null = null,
  result: { won: boolean; reward: number; level: number } | null = null,
  toastTimer = 0;
/** The home screen greets every session; the console is where a run is played. */
let view: 'home' | 'console' = 'home';
let draft: Rule[] = [],
  saveStatus = 'LOCAL SAVE READY',
  lastBreaches = 0,
  locked = false,
  pendingScars: string[] = [];
/** Rules in force: the active attempt, or the run's permanent state between attempts. */
const loadout = () => profile.active ?? profileLoadout(profile);
const escape = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const icon = (name: string, size = 20) => {
  const paths: Record<string, string> = {
    shield: '<path d="m12 3 8 4v6c0 4-8 8-8 8s-8-4-8-8V7z"/><path d="m8 12 3 3 5-6"/>',
    board:
      '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4"/>',
    graph:
      '<rect x="2" y="8" width="5" height="7"/><rect x="17" y="2" width="5" height="7"/><rect x="17" y="15" width="5" height="7"/><path d="M7 11h5V5h5m-5 6v8h5"/>',
    tree: '<circle cx="12" cy="4" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><circle cx="12" cy="12" r="2"/><path d="M12 6v4m-1 4-5 3m7-3 5 3"/>',
    settings:
      '<circle cx="12" cy="12" r="4"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3"/>',
    play: '<path d="m8 4 12 8-12 8z"/>',
    bolt: '<path d="m14 2-9 12h7l-2 8 9-13h-7z"/>',
    cross: '<path d="m6 6 12 12M6 18 18 6"/>',
    terminal: '<path d="m4 6 6 6-6 6m9 0h7"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    chart: '<path d="M3 3v18h18M7 16v-5m5 5V7m5 9V4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 5m0 3v1"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.board}</svg>`;
};
function toast(message: string) {
  let el = document.querySelector<HTMLDivElement>('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el?.classList.remove('show'), 4200);
}
async function commit(mutator: (next: Profile) => void, redraw = true) {
  if (busy || locked)
    throw new Error(locked ? 'This game is already open in another tab.' : 'Saving. Try again in a moment.');
  busy = true;
  try {
    const next = structuredClone(profile);
    mutator(next);
    next.revision = profile.revision + 1;
    await store.save(next, profile.revision);
    profile = next;
    saveStatus = 'PROGRESS SAVED';
    if (redraw) render();
  } catch (e) {
    saveStatus = 'SAVE FAILED';
    throw e;
  } finally {
    busy = false;
  }
}
function active() {
  if (!profile.active) throw new Error('Start an attempt first.');
  return profile.active;
}
function editable() {
  if (attacking) throw new Error('Defenses are read-only during an attack.');
  return active();
}
function defenseCards() {
  const a = profile.active;
  return Object.entries(TOWERS)
    .map(([kind, t], i) => {
      const l = loadout();
      const unlocked = !t.unlock || l.research.includes(t.unlock);
      const sockets = a ? a.board.tiles.filter((x) => x === 3).length : 0;
      return `<button class="defense-card ${tool === kind ? 'selected' : ''}" data-action="tool" data-kind="${kind}" ${!unlocked || attacking || !a ? 'disabled' : ''}><span class="tower-glyph" style="--tower:${t.color}">${kind === 'gate' ? 'Ⅱ' : t.short}</span><span class="defense-copy"><strong>${t.name}</strong><small>${kind === 'reactor' ? `POWER SUPPLY · ${sockets} SOCKET${sockets === 1 ? '' : 'S'}` : kind === 'gate' ? 'TRAFFIC CONTROL' : kind === 'slow' ? 'AREA SLOW' : ['mortar', 'scatter', 'pulse'].includes(kind) ? 'AREA DAMAGE' : kind === 'arc' ? 'CHAIN DAMAGE' : ['laser', 'rail'].includes(kind) ? 'ARMOR PIERCING' : 'SINGLE TARGET'}</small></span><span class="defense-cost">${unlocked ? `${buildCost(kind as TowerKind, l)}<small>¢ · ${kind === 'reactor' ? `+${powerOutput({ kind: 'reactor', level: 1 }, l)}` : powerDraw(kind as TowerKind, l)}W</small>` : `LOCKED<small>${t.unlock?.split('-')[0]}</small>`}<kbd>${i < 10 ? (i + 1) % 10 : 'R'}</kbd></span></button>`;
    })
    .join('');
}
function inspector() {
  const a = profile.active,
    t = a?.towers.find((t) => t.id === selected);
  if (t) {
    const def = TOWERS[t.kind],
      runtime = snapshot?.towers.find((x) => x.id === t.id);
    const top = maxLevel(t.kind, a!);
    return `<div class="inspector-title"><span class="tower-glyph" style="--tower:${def.color}">${def.short}</span><div><h3>${escape(t.id)}</h3><small>LEVEL ${t.level} / ${top}${runtime && runtime.offline > 0 ? (t.kind === 'reactor' ? ' · TRIPPED' : ' · UNPOWERED') : ''}</small></div></div><p>${def.description}</p><dl><div><dt>Range</dt><dd>${t.kind === 'gate' ? '—' : towerRange(runtime ?? t, a!).toFixed(1)} cells</dd></div><div><dt>${t.kind === 'reactor' ? 'Power supplied' : 'Power draw'}</dt><dd>${t.kind === 'reactor' ? powerOutput(t, a!) : powerDraw(t.kind, a!)} W</dd></div>${runtime ? `<div><dt>Damage dealt</dt><dd>${format(runtime.damage)}</dd></div><div><dt>${t.kind === 'gate' ? 'Pressure' : 'Heat'}</dt><dd>${Math.round(t.kind === 'gate' ? runtime.pressure : runtime.heat)}</dd></div>` : ''}</dl>${t.kind === 'gate' ? `<button class="button full" data-action="gate-toggle" ${attacking ? 'disabled' : ''}>${t.closed ? 'Sealed → Set open' : 'Open → Set sealed'}</button>` : t.kind === 'reactor' ? `<div class="tip">Radiates heat to weapons within ${2} cells. Trips for 3s after 12s above 90% load. Credits spent here stay in this sector: no refund.</div>` : `<label class="field-label">DEFAULT TARGET<select data-change="target" ${attacking ? 'disabled' : ''}>${['first', 'strongest', 'cluster'].map((x) => `<option value="${x}" ${t.target === x ? 'selected' : ''}>${x === 'first' ? 'Nearest core' : x === 'strongest' ? 'Strongest enemy' : 'Densest cluster'}</option>`).join('')}</select></label>`}<button class="button full accent-border" data-action="upgrade" ${attacking || t.level >= top ? 'disabled' : ''}>${t.level >= top ? 'Fully upgraded' : `Upgrade · ${upgradeCost(t, a!)} ¢`}</button><button class="text-button full" data-action="sell" ${attacking ? 'disabled' : ''}>${t.kind === 'reactor' ? 'Remove · no refund' : `Recycle · ${sellValue(t, a!)} ¢`}</button>`;
  }
  if (tool) {
    const def = TOWERS[tool];
    return `<span class="eyebrow">INSTALL MODE</span><h3>${def.name}</h3><p>${def.description}</p><div class="tip">${tool === 'gate' ? 'Select a circuit trace to install a gate.' : tool === 'reactor' ? 'Select a dashed PSU socket. Sockets are the only cells that accept a supply.' : 'Select an empty grid cell beside a circuit. The ring shows weapon range.'}</div><button class="text-button" data-action="cancel-tool">Cancel placement <kbd>ESC</kbd></button>`;
  }
  return `<span class="eyebrow">SYSTEM INSPECTOR</span><div class="empty-inspector">${icon('board', 36)}<h3>No defense selected</h3><p>Select a defense to inspect its targeting, upgrades, and performance.</p></div>`;
}
/** Attribute set for the hover/focus tooltip; the visible chip carries a full aria-label too. */
function tip(title: string, body: string, meta: string) {
  const text = `${title}. ${body} ${meta}`;
  return `data-tip-title="${escape(title)}" data-tip-body="${escape(body)}" data-tip-meta="${escape(meta)}" aria-label="${escape(text)}"`;
}
/**
 * The run profile: every choice the operator has made this run, and every scar the run
 * carries, as chips with hover and focus details. Traits are permanent, exploits live with
 * the board, scars come from Daemons, and research is summarized per discipline.
 */
function runProfile() {
  const a = profile.active,
    l = loadout();
  const traits = profile.traits.map((id) => {
    const t = TRAITS.find((t) => t.id === id)!;
    return `<button class="chip chip-trait" ${tip(t.name, t.description, `Favors: ${t.favors} · Tier ${t.tier} ${TIERS[t.tier - 1].name} · permanent trait.`)}><i>◆</i>${t.name}<b>T${t.tier}</b></button>`;
  });
  const exploits = [...new Set(a?.perks ?? [])].map((id) => {
    const p = PERKS.find((p) => p.id === id)!,
      n = a!.perks.filter((x) => x === id).length;
    return `<button class="chip chip-exploit" ${tip(p.name, p.description, `Temporary exploit · this board only${n > 1 ? ` · ×${n}` : ''}.`)}><i>◇</i>${p.name}${n > 1 ? `<b>×${n}</b>` : ''}</button>`;
  });
  const scars = [...new Set(profile.scars)].map((id) => {
    const sc = SCARS.find((s) => s.id === id)!,
      n = profile.scars.filter((x) => x === id).length;
    return `<button class="chip chip-scar" ${tip(sc.name, sc.description, `Daemon scar · permanent · stack ${n} of 3. Quarantine research removes one.`)}><i>✕</i>${sc.name}${n > 1 ? `<b>×${n}</b>` : ''}</button>`;
  });
  const research = BRANCHES.map((b) => {
    const owned = levelsIn(profile.nodes, b),
      total = branchLevels(b);
    const detail =
      RESEARCH.filter((n) => n.branch === b && nodeLevel(profile.nodes, n.id) > 0)
        .map((n) => `${n.name} ${nodeLevel(profile.nodes, n.id)}/${n.levels}`)
        .join(', ') || 'Nothing compiled yet.';
    return `<button class="chip chip-research" data-action="research" ${tip(`${b} research`, detail, `${owned} of ${total} levels.`)}><i style="width:${Math.round((owned / total) * 100)}%"></i><span>${b}</span><b>${owned}</b></button>`;
  });
  const mods = {
    damage: bonus(l, 'damage'),
    haste: bonus(l, 'haste'),
    power: bonus(l, 'power'),
    gate: bonus(l, 'gate'),
  };
  const summary = `+${Math.round(mods.damage * 100)}% DMG · ${mods.haste >= 0 ? '+' : ''}${Math.round(mods.haste * 100)}% RATE · ${mods.power >= 0 ? '+' : ''}${mods.power} W · ${mods.gate >= 0 ? '+' : ''}${Math.round(mods.gate * 100)}% GATE`;
  return `<section class="run-profile" aria-label="Run profile"><div class="run-profile-heading"><span class="eyebrow">RUN PROFILE <span>/</span> ${profile.traits.length} TRAIT${profile.traits.length === 1 ? '' : 'S'} · ${a?.perks.length ?? 0} EXPLOIT${(a?.perks.length ?? 0) === 1 ? '' : 'S'} · ${profile.scars.length} SCAR${profile.scars.length === 1 ? '' : 'S'}</span><small>${summary}</small></div><div class="chip-rows"><div class="chip-row"><small>TRAITS</small>${traits.join('') || '<span class="chip-empty">Clear a frontier sector to draft your first permanent trait.</span>'}</div><div class="chip-row"><small>EXPLOITS</small>${exploits.join('') || '<span class="chip-empty">Drafted between attacks. They expire with this board.</span>'}</div><div class="chip-row chip-row-scars"><small>SCARS</small>${scars.join('') || '<span class="chip-empty">No Daemon has reached the core. Keep it that way.</span>'}</div><div class="chip-row"><small>RESEARCH</small>${research.join('')}</div></div></section>`;
}
/** The three numbers behind the music playing now: a locked code, or the run's own track. */
function currentTrack(): TrackCode {
  const locked = profile.settings.musicCode ? decodeTrack(profile.settings.musicCode) : null;
  if (locked) return locked;
  return {
    seed: profile.seed,
    sector: (profile.active?.level ?? (result?.won ? result.level : profile.unlocked)) - 1,
    arrangement: ((profile.settings.musicVariant ?? 0) * 7919) >>> 0,
  };
}
/** The music module: what plays now, its layer, and the shareable track code. */
function musicPanel() {
  const score = audio.score,
    code = encodeTrack(currentTrack());
  return `<section class="panel music-panel" aria-label="Music"><div class="panel-heading"><h2>Now playing</h2><span class="violet">♪</span></div><div class="music-now"><strong>${escape(score.name)}</strong><small>${GENRES.find((g) => g.id === score.genre)!.name} · ${score.bpm} BPM · ${audio.mood === 'victory' ? 'calm rendition' : `layer ${audio.intensity} / 5`}${profile.settings.musicCode ? ' · LOCKED' : ''}</small></div><div class="music-layers" aria-label="Arrangement layers">${['kick + bass', 'snare + hats', 'lead', 'percussion', 'rolls + stabs'].map((n, i) => `<i class="${i < audio.intensity ? 'on' : ''}" title="${n}"></i>`).join('')}</div><div class="code-row"><input type="text" readonly value="${code}" spellcheck="false" aria-label="Track code" data-track-code/><button class="button" data-action="copy-track">Copy</button></div><div class="button-row"><button class="text-button" data-action="music-reroll" ${profile.settings.musicCode || attacking ? 'disabled' : ''}>Reroll ↻</button><button class="text-button" data-action="settings">Music settings ${icon('arrow', 13)}</button></div></section>`;
}
function homeScreen() {
  const a = profile.active;
  const frontier = profile.unlocked;
  const score = audio.score;
  const stats = [
    ['SECTORS CLEARED', String(frontier - 1)],
    ['RESEARCH', format(profile.research)],
    ['CREDIT BANK', format(a?.credits ?? profile.bankedCredits ?? 0)],
    ['TRAITS', String(profile.traits.length)],
    ['SCARS', String(profile.scars.length)],
    ['KILLS', format(profile.kills)],
    ['RUN SEED', formatSeed(profile.seed)],
  ];
  return `<main class="home"><section class="home-hero"><div class="home-copy"><span class="eyebrow">INTRUSION COUNTERMEASURES <span>/</span> ${a ? `RUN ACTIVE · SECTOR ${String(a.level - 1).padStart(3, '0')} · ATTACK ${a.wave}` : frontier > 1 ? `RUN ALIVE · FRONTIER ${String(frontier - 1).padStart(3, '0')}` : 'NO RUN'}</span><h1><span class="brand-white">over.</span><span class="brand-run">run</span></h1><p class="home-tagline">Build your defenses. Program the response. Watch it run. Every sector is procedural, every run is one core away from erasure.</p><div class="home-actions">${a ? `<button class="button primary launch" data-action="console">Continue run <kbd>ENTER</kbd></button>` : `<button class="button primary launch" data-action="new-run">${frontier > 1 ? `Connect to sector ${String(frontier - 1).padStart(3, '0')}` : 'New run'} <kbd>ENTER</kbd></button>`}<button class="button" data-action="tutorial-start">${profile.settings.tutorial === undefined ? 'Tutorial' : tutorialActive(profile) ? 'Resume tutorial' : 'Replay tutorial'}</button><button class="button" data-action="sectors">Sector directory</button><button class="button" data-action="research">Skill tree</button><button class="button" data-action="settings">Preferences</button></div>${profile.traitOffers.length ? '<div class="tip">A trait draft is waiting. Choose it before reconnecting.</div>' : ''}</div><div class="home-panel"><div class="panel-heading"><h2>System status</h2><span>${icon('terminal', 17)}</span></div><dl class="home-stats">${stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl><div class="home-music"><small>NOW PLAYING</small><strong>${escape(score.name)}</strong><span>${GENRES.find((g) => g.id === score.genre)!.name} · ${score.bpm} BPM · ${audio.mood === 'victory' ? 'calm rendition' : `layer ${audio.intensity} / 5`}</span><span class="code-row"><input type="text" readonly value="${encodeTrack(currentTrack())}" spellcheck="false" aria-label="Track code" data-track-code/><button class="button" data-action="copy-track">Copy</button></span></div><p class="muted">Progress is saved in this browser. Export a backup from Settings before clearing site data.</p></div></section><section class="home-guide"><div><b>01</b><h3>Prepare</h3><p>Install weapons beside traces, gates on traces, supplies in sockets. Upgrade, recycle, retarget.</p></div><div><b>02</b><h3>Program</h3><p>Chain a sensor, a condition and an action. Routines vent heat, open gates and retarget while you watch.</p></div><div><b>03</b><h3>Run</h3><p>Five attacks per sector, a Daemon on the last. Diagnostics explain every breach.</p></div><div><b>04</b><h3>Grow</h3><p>Research compiles between sectors, exploits last a board, traits last the run, scars too. Death erases everything.</p></div></section><footer><span><i class="status-dot"></i><span id="save-status">${saveStatus}</span></span><span>NO SIGNAL LEAVES THIS MACHINE</span><span>over.run / BUILD 001 · <a href="music/credits.html" target="_blank" rel="noopener">melody credits ↗</a></span></footer></main>`;
}
/** The guided tutorial: a fixed card with the current goal, highlighting the controls it refers to. */
function tutorialPanel() {
  document.querySelector('#tutorial')?.remove();
  document.querySelectorAll('.tutorial-target').forEach((el) => el.classList.remove('tutorial-target'));
  if (!tutorialActive(profile) || !profile.active) return;
  const step = tutorialStep(profile),
    current = TUTORIAL[step];
  const next = nextTutorialStep(profile);
  if (next !== step) {
    // A goal was met: persist the advance once the current save settles.
    window.setTimeout(() => {
      void commit((p) => {
        p.settings.tutorial = next;
      }).catch(() => {});
    }, 0);
    return;
  }
  for (const selector of current.targets)
    document.querySelectorAll(selector).forEach((el) => el.classList.add('tutorial-target'));
  const panel = document.createElement('aside');
  panel.id = 'tutorial';
  panel.className = 'tutorial';
  panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = `<div class="tutorial-heading"><span class="eyebrow">TUTORIAL <span>/</span> STEP ${step + 1} OF ${TUTORIAL.length}</span><button class="text-button" data-action="tutorial-skip">Skip ${icon('cross', 13)}</button></div><h3>${current.title}</h3><p>${current.text}</p><div class="tutorial-dots">${TUTORIAL.map((_, i) => `<i class="${i < step ? 'done' : i === step ? 'current' : ''}"></i>`).join('')}</div>${step === TUTORIAL.length - 1 ? `<button class="button primary" data-action="tutorial-skip">Finish tutorial ${icon('arrow', 15)}</button>` : ''}`;
  root.append(panel);
}
function render() {
  renderer?.destroy();
  renderer = null;
  const a = profile.active;
  const spec = a ? encounter(a.level, a.wave, a.seed) : null;
  const l = loadout();
  const currentCore = snapshot && attacking ? snapshot.core : (a?.core ?? maxCore(l));
  const scale = a ? threat(a.level) : threat(1);
  const forecastLevel = bonus(l, 'forecast');
  const topbar = `<header class="topbar"><a class="brand" href="#" data-action="home">${icon('terminal', 31)}<span class="wordmark"><span class="brand-white">over.</span><span class="brand-run">run</span><small>INTRUSION COUNTERMEASURES</small></span><span class="version">v0.1</span></a><nav aria-label="Main navigation"><button class="nav-button ${view === 'console' ? 'active' : ''}" data-action="console">${icon('board')}<span>Defense</span></button><button class="nav-button" data-action="routines">${icon('graph')}<span>Routines</span><span class="nav-count">${a?.rules.length ?? 0}</span></button><button class="nav-button" data-action="research">${icon('tree')}<span>Research</span></button><button class="nav-button" data-action="sectors">${icon('terminal')}<span>Sectors</span></button></nav><div class="top-right">${profile.settings.devMode ? '<button class="button" data-action="dev">DEV</button>' : ''}<span class="connection"><i></i> LOCAL / OFFLINE</span><button class="icon-button" data-action="help" aria-label="How to play">${icon('help')}</button><button class="icon-button" data-action="settings" aria-label="Settings">${icon('settings')}</button></div></header>`;
  if (view === 'home') {
    root.innerHTML = topbar + homeScreen() + '<div id="modal-root"></div>';
  } else
    root.innerHTML = `${topbar}
  <main><div class="page-heading"><div><div class="eyebrow">OPERATOR CONSOLE <span>/</span> ${a ? `SECTOR ${String(a.level - 1).padStart(3, '0')}` : 'AWAITING CONNECTION'}</div><h1>${a ? ['Perimeter defense', 'Memory fortress', 'Kernel sanctuary', 'Ghost architecture'][(a.level - 1) % 4] : 'The system remembers.'}<span class="phase-pill ${attacking ? 'live' : ''}" id="phase">${attacking ? 'ATTACK IN PROGRESS' : a ? 'PREPARATION' : 'OFFLINE'}</span></h1><p>${attacking ? 'Your routines are in control. Observe. Diagnose. Adapt.' : a ? 'Build your defenses. Program the response. Run it.' : 'Every intrusion leaves knowledge behind. Research, rebuild, and reconnect.'}</p></div><button class="button subtle" data-action="diagnostics" ${diagnostics ? '' : 'disabled'}>${icon('chart')} Last diagnostics</button></div>
  <section class="execution-bar"><div class="execution-message">${icon('terminal', 22)}<div><strong>${attacking ? `> run --sector ${(a?.level ?? 1) - 1} --attack ${a?.wave}` : a?.phase === 'reward' ? 'An exploit is ready to compile.' : a?.towers.length ? 'System armed. Ready to run.' : 'Your core is exposed.'}</strong><small>${attacking ? 'Construction and editing resume after the attack.' : a?.towers.length ? `${a.towers.length} installations · ${a.rules.length} routines · ${a.perks.length} temporary exploits${a.farmed ? ` · farm run, rewards ×${farmMultiplier(a.farmed).toFixed(2)}` : ' · frontier run'}` : 'Install defenses from the arsenal, or load a starter layout.'}</small></div>${a && !a.towers.length && !attacking ? '<button class="text-button starter" data-action="starter">Load starter layout →</button>' : ''}</div><div class="execution-controls"><div class="speed-control" aria-label="Playback speed">${[0.5, 1, 2, 4].map((n) => `<button data-action="speed" data-speed="${n}" class="${speed === n ? 'active' : ''}" aria-label="${n} times speed">${n}×</button>`).join('')}</div><button class="button primary launch" aria-label="${attacking ? 'Attack running' : a?.phase === 'reward' ? 'Choose exploit' : a ? 'Run attack' : 'Select sector'}" data-action="${a?.phase === 'reward' ? 'reward' : a ? 'launch' : 'sectors'}" ${attacking ? 'disabled' : ''}>${attacking ? '<span class="run-command"><span class="prompt">&gt;</span> running<span class="command-cursor" aria-hidden="true">_</span></span>' : a?.phase === 'reward' ? 'Choose exploit' : a ? '<span class="run-command"><span class="prompt">&gt;</span> run<span class="command-cursor" aria-hidden="true">_</span></span>' : 'Select sector'} <kbd>SPACE</kbd></button></div></section>
  <section class="resources" aria-label="System resources"><div class="resource"><span class="resource-icon lime">${icon('shield')}</span><div><small>CORE INTEGRITY</small><strong><span id="core-value">${currentCore}</span><em> / ${maxCore(l)}</em></strong></div><div class="tiny-bars">${Array.from({ length: 12 }, (_, i) => `<i style="opacity:${i < (currentCore / maxCore(l)) * 12 ? 1 : 0.15}"></i>`).join('')}</div></div><div class="resource"><span class="resource-icon gold">¢</span><div><small>AVAILABLE CREDITS</small><strong id="credits-value">${format(a?.credits ?? profile.bankedCredits ?? 0)}</strong></div><span class="resource-caption">${a ? `PURSE ${format(purse(a.level, a))}${a.farmed ? ` · FARM ×${farmMultiplier(a.farmed).toFixed(2)}` : ''}` : 'RUN BALANCE'}</span></div><div class="resource"><span class="resource-icon blue">${icon('bolt')}</span><div><small>POWER CAPACITY</small><strong>${a ? powerUsed(a.towers, a) : 0}<em> / ${powerCapacity(l, a?.towers ?? [])} W</em></strong></div><span class="resource-caption">${a ? powerCapacity(a, a.towers) - powerUsed(a.towers, a) : powerCapacity(l)} FREE</span></div><button class="resource research-resource" data-action="research"><span class="resource-icon violet">${icon('tree')}</span><div><small>RESEARCH FRAGMENTS</small><strong>${format(profile.research)}</strong></div><span class="resource-caption">${icon('arrow')}</span></button></section>
  <div class="workspace"><aside class="panel arsenal"><div class="panel-heading"><h2>Defense arsenal</h2><span>01 — ${Object.keys(TOWERS).length}</span></div><p class="panel-subtitle">${attacking ? 'INSTALLATIONS LOCKED' : 'SELECT TO INSTALL ON GRID'}</p><div class="defense-list">${defenseCards()}</div><div class="sidebar-divider"></div><div class="panel-heading"><h2>Automation</h2>${icon('graph', 17)}</div><p class="muted">${a?.rules.length ? `${a.rules.filter((r) => r.enabled).length} routines armed. Your system reacts automatically.` : 'Sustained fire builds heat. Program venting to prevent shutdown.'}</p><button class="button full" data-action="routines">Open routine editor ${icon('arrow', 16)}</button><div class="sidebar-note"><i class="status-dot"></i><span>Defenses run autonomously.<br>Preparation is your advantage.</span></div></aside>
  <section class="battle-panel panel"><div class="battle-heading"><div><i class="status-dot"></i><span>${a ? `MAINBOARD_${String(a.level - 1).padStart(3, '0')}` : 'DISCONNECTED'}</span><small>${a ? `${a.board.entries.length} PORT${a.board.entries.length === 1 ? '' : 'S'} · ${a.board.seed.toString(16).toUpperCase().slice(0, 6)}` : 'NO LINK'} · ${a?.board.width ?? 28} × ${a?.board.height ?? 18}</small></div><div class="board-legend"><span><i class="legend-path"></i>CIRCUIT</span><span><i class="legend-enemy"></i>INTRUSION</span><span><i class="legend-core"></i>CORE</span></div></div>${a ? `<div id="board" class="board"></div>` : `<div class="offline-board">${icon('shield', 70)}<h2>Your next defense starts here.</h2><p>Spend research to unlock tools before deploying. Credits carry across sectors.</p><button class="button" data-action="research">Improve skill tree</button><button class="button primary" data-action="retry">Connect to sector ${String(result?.won ? result.level - 1 : 0).padStart(3, '0')} ${icon('arrow')}</button></div>`}<div class="board-footer"><span id="board-hint">${tool ? `INSTALLING ${TOWERS[tool].name.toUpperCase()} · ESC TO CANCEL` : attacking ? 'AUTONOMOUS DEFENSE ACTIVE' : 'SELECT A DEFENSE · CLICK A GRID CELL TO INSTALL'}</span><span id="renderer-label">GPU RENDERER</span></div><div class="wave-strip"><div><small>ATTACK SEQUENCE</small><div class="wave-steps">${[1, 2, 3, 4, 5].map((n) => `<span class="wave-step ${a && n < a.wave ? 'complete' : a?.wave === n ? 'current' : ''}">${n < (a?.wave ?? 1) ? '✓' : String(n).padStart(2, '0')}</span>${n < 5 ? '<i></i>' : ''}`).join('')}</div></div><div class="wave-status"><strong id="time-value">${attacking ? `${Math.floor((snapshot?.tick ?? 0) / 30)}s` : 'STANDBY'}</strong><small id="alive-value">${attacking ? `${format(snapshot?.alive ?? 0)} ACTIVE` : 'AWAITING > RUN'}</small></div></div></section>
  <aside class="right-column"><section class="panel forecast"><div class="panel-heading"><h2>Threat forecast</h2><span class="violet">${icon('terminal', 17)}</span></div><div class="forecast-wave">ATTACK <strong>${String(a?.wave ?? 1).padStart(2, '0')}</strong><span>/ 05</span></div><div class="threat-meter">${Array.from({ length: 16 }, (_, i) => `<i class="${i < (a?.wave ?? 1) * 2 + 3 ? 'filled' : ''}"></i>`).join('')}</div><div class="forecast-meta"><span>${a ? ['LOW', 'MODERATE', 'ELEVATED', 'HIGH', 'CRITICAL'][a.wave - 1] : 'UNKNOWN'} INTENSITY</span><span>~60s+</span></div><div class="enemy-list">${(spec?.kinds ?? ['virus']).map((k) => `<div><span class="enemy-dot" style="--enemy:${ENEMIES[k as keyof typeof ENEMIES].color}">◇</span><span>${ENEMIES[k as keyof typeof ENEMIES].name}</span><small>${forecastLevel >= 2 ? `${Math.round(ENEMIES[k as keyof typeof ENEMIES].hp * scale.hp * (1 + ((a?.wave ?? 1) - 1) * 0.08))} HP` : forecastLevel >= 1 ? `~${Math.round(100 / (spec?.kinds.length ?? 1))}%` : 'DETECTED'}</small></div>`).join('')}${spec?.boss ? `<div><span class="enemy-dot danger">◆</span><span>Daemon${(spec?.daemons ?? 1) > 1 ? ` ×${spec?.daemons}` : ''}</span><small>${forecastLevel >= 3 ? `${format(Math.round(ENEMIES.boss.hp * scale.hp * 1.32 * (1 + bonus(l, 'daemonHp'))))} HP` : 'BOSS'}</small></div>` : ''}</div><div class="forecast-total"><span>Expected population</span><strong>${format((spec?.total ?? 0) + (spec?.daemons ?? 0))}</strong></div><div class="forecast-total"><span>Threat scale</span><strong>×${scale.hp >= 1000 ? format(scale.hp) : scale.hp.toFixed(1)} HP${scale.armor ? ` · +${scale.armor} ARMOR` : ''}</strong></div>${forecastLevel >= 4 && a && a.wave < 5 ? `<div class="forecast-total"><span>Next attack</span><strong>${encounter(a.level, a.wave + 1, a.seed).kinds.length} kinds · ${format(encounter(a.level, a.wave + 1, a.seed).total)}</strong></div>` : ''}<p class="forecast-note">A Daemon breach corrupts the clock, trips the nearest supply and leaves a permanent scar. Cache leeches steal credits.</p></section><section class="panel inspector" id="inspector">${inspector()}</section>${musicPanel()}</aside></div>

  ${runProfile()}
  ${!profile.onboarded && !attacking && !tutorialActive(profile) ? `<div class="onboarding"><span class="lime">${icon('help', 18)}</span><p><strong>Welcome, operator.</strong> Install defenses beside the traces. Gates go on traces. You can only observe during attacks. Power supplies fit only in dashed sockets. Survive to earn research; clear a frontier sector to draft a permanent trait. Death erases the entire run.</p><button class="text-button" data-action="onboarded">Understood ${icon('cross', 14)}</button></div>` : ''}<footer><span><i class="status-dot"></i><span id="save-status">${saveStatus}</span></span><span>NO SIGNAL LEAVES THIS MACHINE</span><span>over.run / BUILD 001</span></footer></main><div id="modal-root"></div>`;
  if (a && view === 'console') {
    renderer = new BoardRenderer(document.querySelector('#board')!, a, (cell) => {
      void onCell(cell);
    });
    renderer.tool = tool;
    renderer.selected = selected;
    renderer.reducedMotion = profile.settings.reducedMotion;
    renderer.quality = profile.settings.quality;
    if (snapshot && attacking) renderer.update(snapshot);
    document.querySelector('#renderer-label')!.textContent = renderer.mode.toUpperCase();
  }
  document.documentElement.classList.toggle('reduced-motion', profile.settings.reducedMotion);
  if (view === 'console') tutorialPanel();
  // The score depends only on the run seed, the sector and the reroll count. After a clear the
  // cleared sector's score plays in its calm rendition until the next sector is connected.
  const track = currentTrack();
  audio.setSector(track.seed, track.sector, track.arrangement);
  audio.mood = !a && result?.won ? 'victory' : 'normal';
  audio.intensity = a ? a.wave : 1;
  audio.musicEnabled = profile.settings.music ?? true;
  audio.enabled = profile.settings.sound;
  audio.musicVolume = profile.settings.musicVolume ?? profile.settings.volume;
  audio.effectsVolume = profile.settings.effectsVolume ?? profile.settings.volume;
  if (modal) renderModal();
}
async function onCell(cell: number) {
  try {
    const a = active();
    const t = a.towers.find((t) => t.cell === cell);
    if (t) {
      selected = t.id;
      tool = null;
      if (renderer) {
        renderer.selected = selected;
        renderer.tool = null;
      }
      document.querySelector('#inspector')!.innerHTML = inspector();
      return;
    }
    if (tool && !attacking) {
      const kind = tool;
      await commit((p) => build(p.active!, kind, cell));
      audio.play('click');
    } else {
      selected = '';
      if (renderer) renderer.selected = '';
      document.querySelector('#inspector')!.innerHTML = inspector();
    }
  } catch (e) {
    toast((e as Error).message);
  }
}
function openModal(name: string) {
  if (name === 'routines') draft = structuredClone(profile.active?.rules ?? []);
  modal = name;
  renderModal();
}
function modalFrame(title: string, eyebrow: string, body: string, wide = false) {
  return `<dialog open class="modal ${wide ? 'wide' : ''}" aria-labelledby="modal-title"><div class="modal-heading"><div><span class="eyebrow">${eyebrow}</span><h2 id="modal-title">${title}</h2></div><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('cross', 23)}</button></div>${body}</dialog>`;
}
function renderModal() {
  const host = document.querySelector('#modal-root')!;
  let content = '';
  if (modal === 'research')
    content = modalFrame(
      'Compile your evolution.',
      `RESEARCH / ${RESEARCH.length} NODES / ${BRANCHES.length} DISCIPLINES`,
      researchPanel(profile, researchBranch) +
        (!profile.active
          ? '<div class="modal-bottom"><button class="button primary" data-action="sectors">Continue to sector selection →</button></div>'
          : ''),
      true,
    );
  if (modal === 'dev' && profile.settings.devMode)
    content = modalFrame(
      'Developer tools',
      'CONTENT EXPLORER',
      `<p>Changes are saved. Stop combat to edit the preparation checkpoint.</p><div class="button-row">${attacking ? '<button class="button" data-action="dev-stop">Stop attack</button>' : '<button class="button" data-action="dev-credits">Get 1,000 credits</button><button class="button" data-action="dev-research">Get 1,000 research</button><button class="button" data-action="dev-unlock">Unlock all research & weapons</button><button class="button" data-action="dev-repair">Repair core</button><button class="button primary" data-action="dev-next">Skip to next sector</button><label>Sector (000–999)<input id="dev-sector" type="number" min="0" max="999" value="0"/></label><button class="button" data-action="dev-jump">Go to sector</button>'}</div>${
        attacking
          ? ''
          : `<h3>Traits</h3><p class="muted">${TRAITS.length} traits in ${TIERS.length} tiers. Sector ${profile.active ? profile.active.level - 1 : profile.unlocked - 1} drafts from tier ${traitTier(profile.active?.level ?? profile.unlocked)}.</p><div class="button-row"><label>Trait<select id="dev-trait">${TIERS.map(
              (tier) =>
                `<optgroup label="Tier ${tier.tier} · ${tier.name}">${TRAITS.filter(
                  (t) => t.tier === tier.tier,
                )
                  .map(
                    (t) =>
                      `<option value="${t.id}" ${profile.traits.includes(t.id) ? 'disabled' : ''}>${t.name}${profile.traits.includes(t.id) ? ' (owned)' : ''}</option>`,
                  )
                  .join('')}</optgroup>`,
            ).join(
              '',
            )}</select></label><button class="button" data-action="dev-trait">Grant trait</button><button class="button" data-action="dev-traits-clear">Remove all traits</button><button class="button" data-action="dev-scars-clear">Remove all scars</button></div><p class="muted">${profile.traits.length ? profile.traits.map((id) => TRAITS.find((t) => t.id === id)!.name).join(' · ') : 'No traits yet.'}</p>`
      }`,
    );
  if (modal === 'intermission')
    content = modalFrame(
      'Upgrade before the next breach.',
      'BETWEEN SECTORS',
      `<p>Your ${format(profile.bankedCredits ?? 0)} credits carry forward. Spend ${format(profile.research)} research fragments on new weapons, power and automation before deploying.${profile.scars.length ? ` Your core carries ${profile.scars.length} Daemon scar${profile.scars.length === 1 ? '' : 's'}; Quarantine research removes them.` : ''}</p><div class="button-row"><button class="button primary" data-action="research">Improve skill tree</button><button class="button" data-action="sectors">Choose next sector</button></div>`,
    );
  if (modal === 'routines') {
    const a = profile.active;
    content = modalFrame(
      'Program the response.',
      'SHARED AUTOMATION GRAPH',
      `<div class="modal-intro"><p>Connect a sensor, a condition, and an action. Each row is a connected routine; rows execute top to bottom. The first conflicting command wins. Actions fire when a condition becomes true, or at your repeat interval.</p><span class="pill">${draft.length} / 32 ROUTINES</span></div><div class="template-bar"><button class="button primary" data-action="add-rule" data-template="blank" ${!a || attacking ? 'disabled' : ''}>+ New routine</button><button class="button" data-action="add-rule" data-template="vent" ${!a || attacking ? 'disabled' : ''}>+ Auto vent</button><span>OR USE A TEMPLATE</span><button class="button" data-action="add-rule" data-template="pressure" ${!a || attacking ? 'disabled' : ''}>+ Pressure relief</button><button class="button" data-action="add-rule" data-template="heat" ${!a || attacking ? 'disabled' : ''}>+ Safe overclock</button><button class="button" data-action="add-rule" data-template="nearby" ${!a || attacking ? 'disabled' : ''}>+ Cluster targeting</button></div><div class="graph-canvas">${
        draft.length
          ? draft
              .map(
                (r, i) =>
                  `<div class="routine-row" data-rule="${i}"><div class="routine-index"><span>${String(i + 1).padStart(2, '0')}</span><label><input type="checkbox" data-rule-field="enabled" ${r.enabled ? 'checked' : ''} ${attacking ? 'disabled' : ''}/> Armed</label><output class="routine-feedback">READY</output><button class="text-button" data-action="move-rule" data-index="${i}" ${i === 0 || attacking ? 'disabled' : ''} aria-label="Move routine ${i + 1} up">↑ Priority</button></div><div class="graph-node sensor-node"><span class="node-port out"></span><small>01 / SENSOR</small><label>Read signal<select data-rule-field="sensor" ${attacking ? 'disabled' : ''}>${[
                    ['', 'Choose a sensor…'],
                    ['pressure', 'Gate pressure (%)'],
                    ['heat', 'Maximum heat (%)'],
                    ['nearby', 'Nearby enemies'],
                    ['integrity', 'Core integrity (%)'],
                    ['time', 'Elapsed seconds'],
                  ]
                    .map(([v, n]) => `<option value="${v}" ${r.sensor === v ? 'selected' : ''}>${n}</option>`)
                    .join(
                      '',
                    )}</select></label><label>Scope<select data-rule-field="target" ${attacking ? 'disabled' : ''}><option value="" ${!r.target ? 'selected' : ''}>Choose a scope…</option><option value="all" ${r.target === 'all' ? 'selected' : ''}>All defenses</option>${Object.entries(
                    TOWERS,
                  )
                    .map(
                      ([k, t]) =>
                        `<option value="kind:${k}" ${r.target === `kind:${k}` ? 'selected' : ''}>All ${t.name}s</option>`,
                    )
                    .join(
                      '',
                    )}${a?.towers.map((t) => `<option value="${t.id}" ${r.target === t.id ? 'selected' : ''}>${t.id}</option>`).join('')}</select></label></div><div class="graph-wire">→</div><div class="graph-node condition-node"><span class="node-port in"></span><span class="node-port out"></span><small>02 / CONDITION</small><label>Trigger when<select data-rule-field="compare" ${attacking ? 'disabled' : ''}><option value="above" ${r.compare === 'above' ? 'selected' : ''}>Signal is above</option><option value="below" ${r.compare === 'below' ? 'selected' : ''}>Signal is below</option></select></label><label>Threshold<input type="number" min="0" max="1000000" value="${r.value}" data-rule-field="value" ${attacking ? 'disabled' : ''}/></label></div><div class="graph-wire">→</div><div class="graph-node action-node"><span class="node-port in"></span><small>03 / ACTION</small><label>Execute<select data-rule-field="action" ${attacking ? 'disabled' : ''}>${[
                    ['', 'Choose an action…'],
                    ['vent', 'Vent heat (5s cooldown)'],
                    ['open', 'Open gates'],
                    ['close', 'Seal gates'],
                    ['overclock', 'Overclock weapons'],
                    ['first', 'Target nearest core'],
                    ['strongest', 'Target strongest'],
                    ['cluster', 'Target densest cluster'],
                    ['purge', 'Purge area (research)'],
                  ]
                    .map(([v, n]) => `<option value="${v}" ${r.action === v ? 'selected' : ''}>${n}</option>`)
                    .join(
                      '',
                    )}</select></label><label>Repeat every (seconds; 0 = edge)<input type="number" min="0" max="3600" value="${r.repeat}" data-rule-field="repeat" ${attacking ? 'disabled' : ''}/></label></div><button class="icon-button" data-action="delete-rule" data-index="${i}" ${attacking ? 'disabled' : ''} aria-label="Delete routine ${i + 1}">${icon('cross', 17)}</button></div>`,
              )
              .join('')
          : `<div class="graph-empty">${icon('graph', 52)}<h3>A quiet system. For now.</h3><p>Start a new routine or adapt a template. Sustained fire generates heat.<br>Vent hot weapons to prevent thermal shutdown; manage gates and targeting automatically.</p></div>`
      }</div><div class="modal-bottom"><span class="muted">${attacking ? 'Graph frozen during attack. Inspection only.' : 'Accessible node chains · no code required · up to 32 routines'}</span><button class="button primary" data-action="save-rules" ${!a || attacking ? 'disabled' : ''}>&gt; compile ${icon('arrow')}</button></div>`,
      true,
    );
  }
  if (modal === 'sectors') {
    const total = profile.unlocked;
    const levels = [
      ...new Set([1, ...Array.from({ length: Math.min(total, 30) }, (_, i) => Math.max(1, total - 29) + i)]),
    ];
    content = modalFrame(
      'Choose your perimeter.',
      'SECTOR DIRECTORY',
      `<p class="muted">Each sector brings a new circuit. Later sectors add entry points, flanking routes, shortcuts, and tighter build space. Retry a sector to face the same layout. Death or a reset rewires every sector from a new seed and returns you to sector 000. Complete five attacks to unlock the next sector. Only the frontier pays in full and drafts a trait; every repeat of a cleared sector pays 60% of the previous repeat, without a floor.</p>${profile.active ? '<div class="tip">An attempt is in progress. Finish it or use “End attempt” below to collect earned research before reconnecting.</div>' : ''}<div class="sector-jump"><label for="sector-number">Connect to any unlocked sector</label><input id="sector-number" type="number" min="0" max="${total - 1}" value="${total - 1}" ${profile.active ? 'disabled' : ''}/><button class="button" data-action="jump-sector" ${profile.active ? 'disabled' : ''}>&gt; connect</button></div><div class="sector-grid">${levels.map((n) => `<button class="sector-card" data-action="start-sector" data-level="${n}" ${profile.active ? 'disabled' : ''}><span class="eyebrow">${n === total ? 'FRONTIER · FULL PAY · TRAIT' : `FARM · REWARDS ×${farmMultiplier((profile.farmed[n] ?? 0) + 1).toFixed(2)}`}</span>${icon('board', 34)}<strong>SECTOR ${String(n - 1).padStart(3, '0')}</strong><small>Purse ${format(purse(n, profileLoadout(profile)))} ¢ · ×${threat(n).hp >= 1000 ? format(threat(n).hp) : threat(n).hp.toFixed(1)} HP · ${boardSize(n).width} × ${boardSize(n).height}</small></button>`).join('')}<div class="sector-card locked">${icon('shield', 34)}<strong>SECTOR ${String(total).padStart(3, '0')}</strong><small>Complete sector ${total - 1} to unlock</small></div></div>${profile.active && !attacking ? '<button class="button" data-action="end-attempt">End attempt & collect research</button>' : ''}`,
      true,
    );
  }
  if (modal === 'reward') {
    const a = active();
    content = modalFrame(
      'An opening in the code.',
      'TEMPORARY EXPLOIT / CHOOSE ONE',
      `<p class="muted">Choose an advantage for the remaining attacks. Research survives successful sectors; these exploits last for this board.</p><div class="reward-grid">${a.offers
        .map((id) => {
          const p = PERKS.find((p) => p.id === id)!;
          return `<button class="reward-card" data-action="choose-reward" data-id="${id}"><span class="eyebrow">${p.tag}</span>${icon(id === 'power' ? 'bolt' : id === 'gate' ? 'shield' : 'board', 42)}<h3>${p.name}</h3><p>${p.description}</p><span class="reward-select">COMPILE EXPLOIT ${icon('arrow', 17)}</span></button>`;
        })
        .join('')}</div>`,
      true,
    );
  }
  if (modal === 'diagnostics') {
    const d = diagnostics;
    content = modalFrame(
      result ? (result.won ? 'Intrusion contained.' : 'Connection lost. Run erased.') : 'Read the aftermath.',
      'ATTACK DIAGNOSTICS',
      d
        ? `<div class="diagnostic-summary"><div><small>ELIMINATED</small><strong>${format(d.diagnostics.kills)}</strong></div><div><small>BREACHES</small><strong class="${d.diagnostics.breaches ? 'danger' : ''}">${format(d.diagnostics.breaches)}</strong></div><div><small>ELAPSED</small><strong>${(d.tick / 30).toFixed(1)}s</strong></div><div><small>${result ? 'RESEARCH EARNED' : 'CREDITS EARNED'}</small><strong class="lime">+${format(result?.reward ?? d.diagnostics.earned)}</strong></div></div><h3>Defense performance</h3><div class="table-wrap"><table><thead><tr><th>Defense</th><th>Damage</th><th>Kills</th><th>Shots</th><th>Idle / ready</th></tr></thead><tbody>${d.towers.map((t) => `<tr><td>${t.id}</td><td>${format(t.damage)}</td><td>${format(t.kills)}</td><td>${format(t.shots)}</td><td>${t.kind === 'gate' ? (t.failed ? 'Failed open' : 'Stable') : t.kind === 'slow' ? 'Passive field' : `${(t.idle / 30).toFixed(1)}s · no target`}</td></tr>`).join('') || '<tr><td colspan="5">No defenses installed.</td></tr>'}</tbody></table></div><h3>Routine execution</h3><div class="routine-stats">${
            Object.entries(d.diagnostics.rules)
              .map(
                ([id, s]) =>
                  `<p><strong>${escape(id)}</strong> · ${s.fired} activations · ${s.blocked} blocked (cooldown, ineligible target, or unchanged state)</p>`,
              )
              .join('') || '<p class="muted">No routines activated.</p>'
          }</div><h3>Event trace <small class="muted">Most recent 100 events</small></h3><div class="event-log">${d.diagnostics.events.map((e) => `<div class="${e.type}"><time>${(e.tick / 30).toFixed(1)}s</time><span>${escape(e.text)}</span></div>`).join('') || '<div>No breaches or exceptional events. Clean execution.</div>'}</div><div class="modal-bottom"><span class="muted">${result ? 'Sector progress saved. Keep the core alive to retain your research.' : 'Core damage carries forward. Heat and gate failures reset.'}</span><button class="button primary" data-action="after-diagnostics">${result ? 'Continue' : 'Choose exploit'} ${icon('arrow')}</button></div>`
        : '<p class="muted">Complete an attack to generate diagnostics.</p>',
      true,
    );
  }
  if (modal === 'death')
    content = modalFrame(
      'Core lost. Boot again.',
      'FATAL EXCEPTION / RUN TERMINATED',
      `<div class="death-screen"><div class="death-symbol">⏻</div><p>Your defenses held for <strong>${Math.floor((diagnostics?.tick ?? 0) / 30)} seconds</strong> in sector ${String((result?.level ?? 1) - 1).padStart(3, '0')}.</p><p>${format(diagnostics?.diagnostics.kills ?? 0)} threats removed. One more run could be the one.</p><div class="tip">All upgrades, research, traits, scars, routines and exploits have been erased. Your next run starts fresh at <strong>SECTOR 000</strong>.</div><button class="button primary" data-action="retry" data-level="1">Try again · Sector 000 →</button></div>`,
    );
  if (modal === 'trait')
    content = modalFrame(
      'The sector is yours. Choose what it makes of you.',
      'PERMANENT TRAIT / CHOOSE ONE',
      `<p class="muted">A trait lasts for the rest of this run and never appears twice. Each pushes your build somewhere specific and costs something in return.${profile.traitOffers.length ? ` This draft comes from tier ${TRAITS.find((t) => t.id === profile.traitOffers[0])!.tier} · ${TIERS[TRAITS.find((t) => t.id === profile.traitOffers[0])!.tier - 1].name}: ${TIERS[TRAITS.find((t) => t.id === profile.traitOffers[0])!.tier - 1].blurb}` : ''}</p><div class="reward-grid">${profile.traitOffers
        .map((id) => {
          const t = TRAITS.find((t) => t.id === id)!;
          return `<button class="reward-card trait-card" data-action="choose-trait" data-id="${id}"><span class="eyebrow">${t.tag} · TIER ${t.tier}</span>${icon('shield', 42)}<h3>${t.name}</h3><p>${t.description}</p><small class="trait-favors">FAVORS · ${escape(t.favors)}</small><span class="reward-select">COMPILE TRAIT ${icon('arrow', 17)}</span></button>`;
        })
        .join('')}</div>`,
      true,
    );
  if (modal === 'scar')
    content = modalFrame(
      'The Daemon reached the core.',
      'PERMANENT SCAR / RUN-WIDE MALUS',
      `<div class="scar-screen">${pendingScars
        .map((id) => {
          const sc = SCARS.find((s) => s.id === id)!,
            n = profile.scars.filter((x) => x === id).length;
          return `<article class="scar-card"><span class="eyebrow">DAEMON SCAR · STACK ${n} / 3</span><h3>${sc.name}</h3><p>${sc.description}</p></article>`;
        })
        .join(
          '',
        )}<p class="muted">Scars apply to every future attack of this run and stack up to three times each. They are shown in the run profile on the console. Quarantine research in the Analysis discipline purges the most recent one.</p><button class="button primary" data-action="after-scar">Acknowledge ${icon('arrow')}</button></div>`,
    );
  if (modal === 'settings')
    content = modalFrame(
      'System preferences.',
      'LOCAL CONFIGURATION',
      `<div class="settings-list"><label><span><strong>Developer mode</strong><small>Explore sectors and unlock content in this save.</small></span><input type="checkbox" data-setting="devMode" ${profile.settings.devMode ? 'checked' : ''}/></label>${profile.settings.devMode ? '<button class="button" data-action="dev">Open developer tools</button>' : ''}<label><span><strong>Music</strong><small>Now playing <em>${escape(audio.score.name)}</em> · ${GENRES.find((g) => g.id === audio.score.genre)!.name} · ${audio.score.bpm} BPM · layer ${audio.intensity} / 5<br>Melody after “${escape(audio.score.title)}” · ${TUNINGS.find((t) => t.id === audio.score.tuning)!.name} · A4 ${audio.score.referenceHz} Hz · ${MELODY_LIBRARY.length} melodies</small></span><input type="checkbox" data-setting="music" ${(profile.settings.music ?? true) ? 'checked' : ''}/></label><label><span><strong>Music volume</strong></span><input type="range" min="0" max="1" step=".05" value="${profile.settings.musicVolume ?? profile.settings.volume}" data-setting="musicVolume" aria-label="Music volume"/></label><label><span><strong>Arrangement</strong><small>Variant ${profile.settings.musicVariant ?? 0}. The genre is drawn at random per sector; a reroll draws a new genre, melody, tuning, name and drum, hat and bass patterns. Each attack adds a layer: kick and bass, then snare and hats, lead, percussion and fills, then rolls and stabs.</small></span><span class="button-row"><button class="button" data-action="music-reroll" ${profile.settings.musicCode ? 'disabled' : ''}>Reroll</button><button class="button" data-action="music-reset">Reset music</button></span></label><label><span><strong>Track code</strong><small>${profile.settings.musicCode ? 'Music is locked to a pasted code. Reset music to follow the sectors again.' : 'Share this code: anyone who pastes it hears exactly this track.'}</small></span><span class="button-row code-row"><input id="track-code" type="text" readonly value="${encodeTrack(currentTrack())}" spellcheck="false" aria-label="Current track code" data-track-code/><button class="button" data-action="copy-track">Copy</button></span></label><label><span><strong>Paste a track code</strong><small>Locks the music to that track in every sector until you reset it.</small></span><span class="button-row code-row"><input id="track-paste" type="text" placeholder="OVR-XXXXXXXX-000-XXXXXXXX" spellcheck="false" aria-label="Track code to apply"/><button class="button" data-action="apply-track">Apply</button></span></label><label><span><strong>Sound effects</strong><small>Weapons, alerts and quiet button feedback.</small></span><input type="checkbox" data-setting="sound" ${profile.settings.sound ? 'checked' : ''}/></label><label><span><strong>Effects volume</strong></span><input type="range" min="0" max="1" step=".05" value="${profile.settings.effectsVolume ?? profile.settings.volume}" data-setting="effectsVolume" aria-label="Effects volume"/></label><label><span><strong>Reduced motion</strong><small>Reduce effects and refresh frequency.</small></span><input type="checkbox" data-setting="reducedMotion" ${profile.settings.reducedMotion ? 'checked' : ''}/></label><label><span><strong>Visual density</strong><small>Combat outcomes remain identical.</small></span><select data-setting="quality"><option value="high" ${profile.settings.quality === 'high' ? 'selected' : ''}>High</option><option value="low" ${profile.settings.quality === 'low' ? 'selected' : ''}>Low</option></select></label></div><p class="muted">Music starts with your first click or keypress. <a href="music/credits.html" target="_blank" rel="noopener">Melody sources & credits ↗</a></p><h3>Run seed</h3><p class="muted">Every sector layout, encounter, draft and score derives from this seed; the same seed with the same decisions replays identically. It can be changed between attempts and rewires every sector. Death and reset draw a new one.</p><div class="button-row"><label>Seed<input id="seed-input" type="text" value="${formatSeed(profile.seed)}" spellcheck="false" ${profile.active || attacking ? 'disabled' : ''}/></label><button class="button" data-action="apply-seed" ${profile.active || attacking ? 'disabled' : ''}>Apply seed</button></div>${profile.active ? '<p class="muted">Disconnect from the current attempt to change the seed.</p>' : ''}<h3>Save management</h3><p class="muted">Progress is stored in this browser. Export a backup before clearing browser data. Reloading during combat restores the preparation checkpoint, with the same attack.</p><div class="button-row"><button class="button" data-action="export">Export save</button><button class="button" data-action="import" ${attacking ? 'disabled' : ''}>Import save</button><input type="file" accept="application/json,.json" id="import-file" hidden/></div><div class="danger-zone"><div><h3>Reset all progression</h3><p>Erase research, unlocked sectors, and the active attempt.</p></div><button class="button danger" data-action="reset-dialog" ${attacking ? 'disabled' : ''}>Reset progression</button></div>`,
    );
  if (modal === 'reset')
    content = modalFrame(
      'Erase this system?',
      'FULL RESET',
      '<p>This permanently removes all research, unlocked sectors, and the current attempt from this browser. Export a backup first if you want to restore it later.</p><div class="button-row"><button class="button" data-action="settings">Cancel</button><button class="button danger" data-action="confirm-reset">Erase all progression</button></div>',
    );
  if (modal === 'end-attempt')
    content = modalFrame(
      'Disconnect from this board?',
      'END ATTEMPT',
      '<p>Collect research for completed combat progress. Installed defenses and temporary exploits will be cleared. Research remains while your core survives.</p><div class="button-row"><button class="button" data-action="close-modal">Keep defending</button><button class="button primary" data-action="confirm-end">Collect & disconnect</button></div>',
    );
  if (modal === 'help')
    content = modalFrame(
      'A field guide for the operator.',
      'READ / EXECUTE / ADAPT',
      `<div class="help-steps"><div><b>01</b><section><h3>Build during preparation</h3><p>Choose a defense on the left, then click an empty grid cell near a trace. Gates are placed directly on traces; power supplies fit only in dashed sockets, radiate heat, trip under heavy load and are never refunded. Select an installation to upgrade, retarget, or recycle it for 80% of its cost.</p></section></div><div><b>02</b><section><h3>Program your response</h3><p>Open Routines and load a template. Edit its sensor, threshold, and action. Rules can target the whole board, a weapon group, or one installation. Compile to save the shared graph.</p></section></div><div><b>03</b><section><h3>Run and observe</h3><p>Enter > run to begin. Attacks run automatically. Only playback speed can change. Closed gates accumulate pressure; they fail open until the next preparation phase. Towers cannot be damaged.</p></section></div><div><b>04</b><section><h3>Learn and grow</h3><p>After an attack, inspect diagnostics and choose a temporary exploit. Each sector pays a fixed purse spread over its kills; repeats of a cleared sector pay less every time. Clearing a frontier sector drafts a permanent trait. A Daemon that breaches the core leaves a permanent scar. Research nodes compile over several levels. Death clears everything and returns you to sector 000.</p></section></div></div><div class="tip">Shortcuts: 1–9 / 0 choose defenses · Escape cancels placement · Space executes an attack · Arrow keys navigate a focused board · Enter selects a cell.</div>`,
    );
  host.innerHTML = `<div class="modal-backdrop">${content}</div>`;
  const dialog = host.querySelector<HTMLDialogElement>('dialog')!;
  dialog.setAttribute('aria-modal', 'true');
  dialog.querySelector<HTMLElement>('button')?.focus();
}
function closeModal() {
  modal = '';
  document.querySelector('#modal-root')!.innerHTML = '';
  document.querySelector<HTMLElement>('.launch')?.focus();
}

async function launch() {
  const a = editable();
  if (a.phase === 'reward') return openModal('reward');
  const errors = validateRules(a.rules, a);
  if (errors.length) throw new Error(errors[0]);
  await commit(() => {}, false);
  attacking = true;
  snapshot = null;
  diagnostics = null;
  result = null;
  lastBreaches = 0;
  tool = null;
  workerRevision = profile.revision;
  modal = '';
  await audio.unlock().catch(() => {});
  audio.play('launch');
  worker?.terminate();
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onerror = (e) => {
    attacking = false;
    worker?.terminate();
    render();
    toast(`Simulation stopped: ${e.message}. Preparation checkpoint retained.`);
  };
  worker.onmessage = (event) => {
    const m = event.data;
    if (m.type === 'error') {
      attacking = false;
      render();
      toast(m.text);
      return;
    }
    if (m.version !== 1 || m.id !== profile.active?.id || m.revision !== workerRevision || !attacking) return;
    snapshot = m.snapshot;
    renderer?.update(snapshot!);
    if (snapshot?.shots.length) audio.shot(snapshot.shots[0].kind);
    updateLive();
    worker?.postMessage({ type: 'ack', version: 1, id: m.id, revision: workerRevision });
    if (snapshot!.done) void completeAttack(snapshot!);
  };
  worker.postMessage({
    type: 'start',
    version: 1,
    attempt: structuredClone(profile.active),
    speed,
    revision: workerRevision,
  });
  render();
}
function updateLive() {
  if (!snapshot) return;
  document.querySelectorAll<HTMLElement>('[data-rule]').forEach((row) => {
    const r = draft[Number(row.dataset.rule)],
      stats = snapshot!.diagnostics.rules[r?.id];
    const output = row.querySelector<HTMLOutputElement>('.routine-feedback');
    if (output && stats) {
      const next = `${stats.fired} RUN / ${stats.blocked} BLOCKED`;
      if (output.textContent !== next && stats.fired) {
        row.classList.add('fired');
        window.setTimeout(() => row.classList.remove('fired'), 600);
      }
      output.textContent = next;
    }
  });
  document.querySelectorAll<HTMLElement>('.tiny-bars i').forEach((bar, i) => {
    bar.style.opacity = i < (snapshot!.core / maxCore(active())) * 12 ? '1' : '.15';
  });
  const update = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  update('core-value', String(snapshot.core));
  update('credits-value', format(snapshot.credits));
  update('time-value', `${Math.floor(snapshot.tick / 30)}s`);
  update('alive-value', `${format(snapshot.alive)} ACTIVE · ${format(snapshot.diagnostics.kills)} REMOVED`);
  update(
    'board-hint',
    `${format(snapshot.spawned)} / ${format(snapshot.total)} ARRIVED · ${format(snapshot.records)} SIMULATION RECORDS`,
  );
  if (snapshot.diagnostics.breaches > lastBreaches) {
    audio.play('breach');
    lastBreaches = snapshot.diagnostics.breaches;
  }
  if (selected && Math.floor(snapshot.tick) % 15 === 0)
    document.querySelector('#inspector')!.innerHTML = inspector();
}
async function completeAttack(s: Snapshot) {
  if (!attacking) return;
  attacking = false;
  worker?.terminate();
  worker = null;
  diagnostics = structuredClone(s);
  const level = active().level;
  try {
    await commit((p) => {
      const a = p.active!;
      recordAttack(p, s);
      if (!s.won || a.wave === 5) {
        const reward = settle(p, a.id, s.won);
        result = { won: s.won, reward, level };
      } else {
        a.wave++;
        a.phase = 'reward';
        a.offers = rewardOffers(a);
      }
    }, false);
    snapshot = null;
    selected = '';
    pendingScars = s.won && s.core > 0 ? [...s.diagnostics.scars] : [];
    modal = pendingScars.length ? 'scar' : s.won ? 'diagnostics' : 'death';
    render();
    audio.play(s.won ? 'win' : 'breach');
  } catch (e) {
    snapshot = null;
    result = null;
    render();
    toast(`${(e as Error).message} Preparation checkpoint retained; this attack can be replayed.`);
  }
}

const wakeAudio = () => {
  void audio.unlock().catch(() => {});
};
document.addEventListener('pointerdown', wakeAudio, { once: true, capture: true });
document.addEventListener('keydown', wakeAudio, { once: true, capture: true });

root.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!button || button.hasAttribute('disabled')) return;
  event.preventDefault();
  void audio
    .unlock()
    .then(() => audio.play('click'))
    .catch(() => {});
  void handleAction(button).catch((e) => toast((e as Error).message));
});
async function handleAction(button: HTMLElement) {
  const action = button.dataset.action!;
  if (action.startsWith('dev-')) {
    if (!profile.settings.devMode) throw new Error('Enable developer mode in Settings.');
    if (action === 'dev-stop') {
      worker?.terminate();
      worker = null;
      attacking = false;
      snapshot = null;
      render();
      return;
    }
    if (attacking) throw new Error('Stop the attack first.');
    const jump =
      action === 'dev-jump'
        ? Number(document.querySelector<HTMLInputElement>('#dev-sector')!.value) + 1
        : (profile.active?.level ?? profile.unlocked) + 1;
    const traitId = document.querySelector<HTMLSelectElement>('#dev-trait')?.value ?? '';
    await commit((p) => {
      if (action === 'dev-trait') grantTrait(p, traitId);
      if (action === 'dev-traits-clear') {
        p.traits = [];
        p.traitOffers = [];
        if (p.active) p.active.traits = [];
      }
      if (action === 'dev-scars-clear') {
        p.scars = [];
        if (p.active) p.active.scars = [];
      }
      if (action === 'dev-credits') {
        if (p.active) p.active.credits += 1000;
        else p.bankedCredits = (p.bankedCredits ?? 360) + 1000;
      }
      if (action === 'dev-research') p.research = (BigInt(p.research) + 1000n).toString();
      if (action === 'dev-unlock') {
        p.nodes = RESEARCH.flatMap((n) => Array<string>(n.levels).fill(n.id));
        if (p.active) p.active.research = [...p.nodes];
      }
      if (action === 'dev-repair' && p.active) p.active.core = maxCore(p.active);
      if (action === 'dev-next' || action === 'dev-jump') {
        if (!Number.isInteger(jump) || jump < 1 || jump > 1000) throw new Error('Choose sector 000–999.');
        if (p.active) p.bankedCredits = p.active.credits;
        p.active = null;
        p.traitOffers = [];
        p.unlocked = Math.max(p.unlocked, jump);
        startAttempt(p, jump);
      }
    });
    snapshot = null;
    result = null;
    diagnostics = null;
    selected = '';
    tool = null;
    if (action === 'dev-next' || action === 'dev-jump') view = 'console';
    render();
    if (['dev-trait', 'dev-traits-clear', 'dev-scars-clear'].includes(action)) openModal('dev');
    return;
  }
  if (
    ['routines', 'research', 'sectors', 'settings', 'help', 'diagnostics', 'reward', 'dev', 'trait'].includes(
      action,
    )
  ) {
    if (action === 'reward' && profile.active?.phase !== 'reward') return;
    if (action === 'trait' && !profile.traitOffers.length) return;
    openModal(action);
    return;
  }
  if (action === 'research-branch') {
    researchBranch = button.dataset.branch as Branch;
    renderModal();
    document.querySelector<HTMLElement>(`[role=tab][data-branch="${researchBranch}"]`)?.focus();
    return;
  }
  if (action === 'close-modal') return closeModal();
  if (action === 'home') {
    if (attacking) throw new Error('Wait for the attack to finish before leaving the console.');
    modal = '';
    view = 'home';
    render();
    return;
  }
  if (action === 'console') {
    modal = '';
    view = 'console';
    render();
    return;
  }
  if (action === 'new-run') {
    if (profile.traitOffers.length) return openModal('trait');
    await commit((p) => startAttempt(p, p.unlocked));
    view = 'console';
    result = null;
    diagnostics = null;
    snapshot = null;
    closeModal();
    render();
    return;
  }
  if (action === 'tutorial-start') {
    if (profile.traitOffers.length) return openModal('trait');
    await commit((p) => {
      if (!p.active) startAttempt(p, 1);
      p.settings.tutorial = 0;
      p.onboarded = true;
    });
    view = 'console';
    modal = '';
    render();
    return;
  }
  if (action === 'tutorial-skip') {
    await commit((p) => {
      p.settings.tutorial = TUTORIAL_DONE;
    });
    return;
  }
  if (action === 'tool') {
    editable();
    tool = tool === button.dataset.kind ? null : (button.dataset.kind as TowerKind);
    selected = '';
    render();
  }
  if (action === 'cancel-tool') {
    tool = null;
    render();
  }
  if (action === 'launch') await launch();
  if (action === 'speed') {
    speed = Number(button.dataset.speed);
    if (attacking)
      worker?.postMessage({ type: 'speed', version: 1, id: active().id, revision: workerRevision, speed });
    document
      .querySelectorAll<HTMLElement>('[data-action="speed"]')
      .forEach((e) => e.classList.toggle('active', Number(e.dataset.speed) === speed));
  }
  if (action === 'upgrade') {
    editable();
    await commit((p) => upgrade(p.active!, selected));
  }
  if (action === 'sell') {
    editable();
    const id = selected;
    selected = '';
    await commit((p) => sell(p.active!, id));
  }
  if (action === 'gate-toggle') {
    editable();
    await commit((p) => {
      const t = p.active!.towers.find((t) => t.id === selected)!;
      t.closed = !t.closed;
    });
  }
  if (action === 'starter') {
    editable();
    await commit((p) => {
      const a = p.active!,
        w = a.board.width;
      const candidates = a.board.tiles
        .map((t, i) => ({ t, i }))
        .filter((x) => x.t === 0 && x.i % w > w * 0.25 && x.i % w < w * 0.82);
      const score = (cell: number, kind: TowerKind) =>
        a.board.tiles.reduce(
          (sum, t, i) =>
            sum +
            (t === 1 &&
            Math.hypot((i % w) - (cell % w), Math.floor(i / w) - Math.floor(cell / w)) < TOWERS[kind].range
              ? 1
              : 0),
          0,
        ) -
        a.towers.reduce(
          (s, t) =>
            s +
            (Math.hypot((t.cell % w) - (cell % w), Math.floor(t.cell / w) - Math.floor(cell / w)) < 3
              ? 8
              : 0),
          0,
        );
      for (const kind of ['mortar', 'cannon', 'cannon', 'gate'] as TowerKind[]) {
        if (kind === 'gate') {
          // Seal the trace feeding the core, one cell back from it when possible.
          const { core, width, height, tiles, entries } = a.board;
          const first = neighbors(core, width, height).find((n) => tiles[n] === 1);
          const second =
            first === undefined
              ? undefined
              : neighbors(first, width, height).find(
                  (n) => tiles[n] === 1 && n !== core && !entries.includes(n),
                );
          const cell = second ?? first;
          if (cell !== undefined) build(a, kind, cell);
        } else {
          const cell = candidates
            .filter((c) => !a.towers.some((t) => t.cell === c.i))
            .sort((x, y) => score(y.i, kind) - score(x.i, kind))[0]?.i;
          if (cell !== undefined) build(a, kind, cell);
        }
      }
    });
    toast('Starter layout installed. Inspect and adapt it before executing.');
  }
  if (action === 'buy-research') {
    await commit((p) => buyResearch(p, button.dataset.id!));
    audio.play('click');
  }
  if (action === 'add-rule') {
    editable();
    if (draft.length >= 32) throw new Error('Maximum 32 routines.');
    let i = 1;
    while (draft.some((r) => r.id === `routine-${i}`)) i++;
    const type = button.dataset.template!;
    draft.push(
      type === 'blank'
        ? {
            id: `routine-${i}`,
            sensor: '' as Rule['sensor'],
            action: '' as Rule['action'],
            target: '',
            compare: 'above',
            value: 0,
            repeat: 0,
            enabled: true,
          }
        : type === 'vent'
          ? { ...template('heat', i), compare: 'above', value: 65, action: 'vent' }
          : template(type, i),
    );
    renderModal();
  }
  if (action === 'delete-rule') {
    editable();
    draft.splice(Number(button.dataset.index), 1);
    renderModal();
  }
  if (action === 'move-rule') {
    editable();
    const i = Number(button.dataset.index);
    if (i) [draft[i - 1], draft[i]] = [draft[i], draft[i - 1]];
    renderModal();
  }
  if (action === 'save-rules') {
    const a = editable();
    const errors = validateRules(draft, a);
    if (errors.length) throw new Error(errors[0]);
    await commit((p) => {
      p.active!.rules = structuredClone(draft);
    });
    closeModal();
    toast('Routines compiled. They will execute automatically during the next attack.');
  }
  if (action === 'choose-reward') {
    editable();
    await commit((p) => chooseReward(p.active!, button.dataset.id!));
    closeModal();
  }
  if (action === 'after-scar') {
    pendingScars = [];
    openModal(result && !result.won ? 'death' : 'diagnostics');
  }
  if (action === 'choose-trait') {
    await commit((p) => chooseTrait(p, button.dataset.id!));
    openModal('intermission');
  }
  if (action === 'after-diagnostics') {
    if (result) openModal(profile.traitOffers.length ? 'trait' : 'intermission');
    else if (profile.active?.phase === 'reward') openModal('reward');
    else closeModal();
  }
  if (action === 'start-sector' || action === 'retry' || action === 'jump-sector') {
    if (attacking) return;
    const level = Number(
      action === 'jump-sector'
        ? Number(document.querySelector<HTMLInputElement>('#sector-number')!.value) + 1
        : (button.dataset.level ?? (result?.won ? result.level : 1)),
    );
    if (profile.traitOffers.length) return openModal('trait');
    await commit((p) => startAttempt(p, level));
    view = 'console';
    result = null;
    diagnostics = null;
    snapshot = null;
    closeModal();
    render();
  }
  if (action === 'end-attempt') {
    editable();
    openModal('end-attempt');
  }
  if (action === 'confirm-end') {
    editable();
    let earned = 0;
    await commit((p) => {
      earned = settle(p, p.active!.id, false);
    });
    result = null;
    selected = '';
    tool = null;
    openModal('sectors');
    toast(`Attempt ended. +${earned} research fragments.`);
  }
  if (action === 'apply-seed') {
    const seed = parseSeed(document.querySelector<HTMLInputElement>('#seed-input')!.value);
    await commit((p) => setSeed(p, seed));
    renderModal();
    toast(`Run seed set to ${formatSeed(seed)}. Every sector is rewired.`);
    return;
  }
  if (action === 'music-reroll' || action === 'music-reset') {
    await commit((p) => {
      if (action === 'music-reroll') p.settings.musicVariant = (p.settings.musicVariant ?? 0) + 1;
      else {
        p.settings.musicVariant = 0;
        p.settings.musicGenre = 'auto';
        delete p.settings.musicCode;
      }
    });
    if (modal) renderModal();
  }
  if (action === 'copy-track') {
    const code =
      button.parentElement?.querySelector<HTMLInputElement>('input') ??
      document.querySelector<HTMLInputElement>('[data-track-code]')!;
    code.select();
    try {
      await navigator.clipboard.writeText(code.value);
      toast(`Track code copied: ${code.value}`);
    } catch {
      toast('Select the code and copy it with Ctrl+C.');
    }
    return;
  }
  if (action === 'apply-track') {
    const raw = document.querySelector<HTMLInputElement>('#track-paste')!.value;
    const track = decodeTrack(raw);
    if (!track) throw new Error('That is not a track code. Expected OVR-XXXXXXXX-000-XXXXXXXX.');
    await commit((p) => {
      p.settings.musicCode = encodeTrack(track);
    });
    renderModal();
    toast(`Music locked to ${encodeTrack(track)}.`);
    return;
  }
  if (action === 'onboarded')
    await commit((p) => {
      p.onboarded = true;
    });
  if (action === 'export') {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `over.run-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Save backup exported.');
  }
  if (action === 'import') document.querySelector<HTMLInputElement>('#import-file')!.click();
  if (action === 'reset-dialog') {
    if (!attacking) openModal('reset');
  }
  if (action === 'confirm-reset') {
    if (attacking) return;
    await commit((p) => Object.assign(p, freshProfile()));
    result = null;
    diagnostics = null;
    snapshot = null;
    selected = '';
    tool = null;
    await commit((p) => startAttempt(p, 1));
    view = 'console';
    closeModal();
    render();
    toast('Progression reset. A new system is ready.');
  }
}
root.addEventListener('change', (event) => {
  void (async () => {
    const el = event.target as HTMLInputElement | HTMLSelectElement;
    if (el.dataset.ruleField) {
      editable();
      const i = Number(el.closest<HTMLElement>('[data-rule]')!.dataset.rule);
      const key = el.dataset.ruleField as keyof Rule;
      (draft[i] as unknown as Record<string, unknown>)[key] =
        key === 'enabled'
          ? (el as HTMLInputElement).checked
          : ['value', 'repeat'].includes(key)
            ? Number(el.value)
            : el.value;
    }
    if (el.dataset.change === 'target') {
      editable();
      await commit((p) => {
        p.active!.towers.find((t) => t.id === selected)!.target = el.value as
          'first' | 'strongest' | 'cluster';
      });
    }
    if (el.dataset.setting) {
      const key = el.dataset.setting as keyof Profile['settings'];
      await audio.unlock().catch(() => {});
      await commit((p) => {
        (p.settings as unknown as Record<string, unknown>)[key] = [
          'sound',
          'music',
          'reducedMotion',
          'devMode',
        ].includes(key)
          ? (el as HTMLInputElement).checked
          : ['volume', 'musicVolume', 'effectsVolume'].includes(key)
            ? Number(el.value)
            : el.value;
      });
    }
    if (el.id === 'import-file') {
      if (attacking) return;
      const file = (el as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 4e6) throw new Error('Save file exceeds 4 MB.');
      const imported = validateSave(JSON.parse(await file.text()));
      if (!confirm('Replace current progression with this save? Export a backup first if needed.')) return;
      await commit((p) => Object.assign(p, imported));
      snapshot = null;
      diagnostics = null;
      result = null;
      selected = '';
      tool = null;
      if (imported.active) view = 'console';
      closeModal();
      render();
      toast('Save imported successfully.');
    }
  })().catch((e) => toast((e as Error).message));
});
document.addEventListener('keydown', (event) => {
  if (
    modal === 'research' &&
    (event.target as HTMLElement).getAttribute('role') === 'tab' &&
    ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
  ) {
    event.preventDefault();
    const current = BRANCHES.indexOf(researchBranch);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? BRANCHES.length - 1
          : (current + (event.key === 'ArrowRight' ? 1 : -1) + BRANCHES.length) % BRANCHES.length;
    document.querySelector<HTMLElement>(`[role="tab"][data-branch="${BRANCHES[next]}"]`)?.click();
    return;
  }
  if (event.key === 'Tab' && modal) {
    const items = [
      ...document.querySelectorAll<HTMLElement>(
        'dialog button:not(:disabled):not([tabindex="-1"]), dialog input:not(:disabled), dialog select:not(:disabled), dialog summary, dialog [tabindex="0"]',
      ),
    ];
    const visible = items.filter((el) => el.getClientRects().length > 0);
    const first = visible[0],
      last = visible.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  if (event.key === 'Escape') {
    if (modal) closeModal();
    else {
      tool = null;
      selected = '';
      render();
    }
    return;
  }
  if (
    modal ||
    ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'CANVAS'].includes((event.target as HTMLElement).tagName)
  )
    return;
  if (event.key === 'Enter' && view === 'home' && !modal) {
    event.preventDefault();
    document.querySelector<HTMLElement>('.home-actions .launch')?.click();
    return;
  }
  if (view !== 'console') return;
  if (event.code === 'Space' && !attacking && profile?.active) {
    event.preventDefault();
    void launch().catch((e) => toast(e.message));
  }
  if (event.key.toLowerCase() === 'r' && profile.active && !attacking) {
    tool = 'reactor';
    selected = '';
    render();
    return;
  }
  const n = event.key === '0' ? 10 : Number(event.key);
  if (n >= 1 && n <= 10 && !attacking && profile?.active) {
    const kind = Object.keys(TOWERS)[n - 1] as TowerKind;
    if (!TOWERS[kind].unlock || active().research.includes(TOWERS[kind].unlock!)) {
      tool = kind;
      selected = '';
      render();
    }
  }
});
document.addEventListener('visibilitychange', () => {
  if (attacking)
    worker?.postMessage({
      type: 'visibility',
      version: 1,
      id: active().id,
      revision: workerRevision,
      hidden: document.hidden,
    });
});
// Run-profile tooltips: one shared element, positioned beside the hovered or focused chip.
function showTip(target: HTMLElement | null) {
  let el = document.querySelector<HTMLDivElement>('#tip');
  if (!target) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'tip';
    el.setAttribute('aria-hidden', 'true');
    document.body.append(el);
  }
  el.innerHTML = `<strong>${escape(target.dataset.tipTitle)}</strong><p>${escape(target.dataset.tipBody)}</p><small>${escape(target.dataset.tipMeta)}</small>`;
  const r = target.getBoundingClientRect();
  const width = Math.min(320, window.innerWidth - 24);
  el.style.width = `${width}px`;
  el.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, r.left))}px`;
  el.style.top = `${r.bottom + 8 + window.scrollY}px`;
}
document.addEventListener('mouseover', (e) => {
  const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-tip-title]');
  if (chip) showTip(chip);
});
document.addEventListener('mouseout', (e) => {
  if ((e.target as HTMLElement).closest('[data-tip-title]')) showTip(null);
});
document.addEventListener('focusin', (e) => {
  const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-tip-title]');
  showTip(chip);
});
document.addEventListener('focusout', () => showTip(null));
async function boot() {
  await store.open();
  profile = await store.load();
  view = 'home';
  render();
}
function fatal(error: unknown) {
  root.innerHTML = `<div class="fatal"><h1>System unavailable</h1><p>${escape((error as Error).message)}</p><p>Existing progress has not been overwritten. Close other game tabs or enable browser storage, then reload.</p><button class="button primary" onclick="location.reload()">Retry connection</button></div>`;
}
if (navigator.locks) {
  void navigator.locks.request('0xdefend-session', { ifAvailable: true }, async (lock) => {
    if (!lock) {
      locked = true;
      fatal(new Error('Another tab is already running this game.'));
      return;
    }
    await boot().catch(fatal);
    await new Promise<void>(() => {});
  });
} else void boot().catch(fatal);
