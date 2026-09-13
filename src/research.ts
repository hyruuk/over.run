import { BRANCHES, RESEARCH, PERKS, prerequisites, researchAvailable, type Branch } from './content';
import { nodeLevel, nodeCost, levelsIn, branchLevels } from './content';
import type { Profile } from './types';

const disciplines: Record<Branch, { description: string; tracks: string[]; color: string }> = {
  arsenal: {
    description: 'Payload fundamentals, weapon systems and precision.',
    tracks: ['Payload', 'Precision', 'Weapon systems'],
    color: '#b9f578',
  },
  infrastructure: {
    description: 'Power buses, core integrity and pressure containment.',
    tracks: ['Power', 'Core', 'Containment'],
    color: '#e9c877',
  },
  automation: {
    description: 'Faster clocks, cooling and autonomous response.',
    tracks: ['Interrupts', 'Thermal control', 'Protocols'],
    color: '#7bdde9',
  },
  analysis: {
    description: 'Recover fragments and fund your next sector.',
    tracks: ['Recovery', 'Profiling', 'Archives'],
    color: '#c6a0ff',
  },
  ballistics: {
    description: 'Unlock shotguns and shredders; specialize against armor and Daemons.',
    tracks: ['Impact', 'Saturation', 'Penetration'],
    color: '#ffb76b',
  },
  energy: {
    description: 'Unlock EMP and rail weapons; amplify beams and relay networks.',
    tracks: ['Discharge', 'Acceleration', 'Optics'],
    color: '#72aaff',
  },
  resilience: {
    description: 'Contain breaches, survive corruption and manage heat.',
    tracks: ['Hardening', 'Cooling', 'Redundancy'],
    color: '#75d6b6',
  },
  economy: {
    description: 'Fabrication, salvage and research compound across a living run.',
    tracks: ['Foundry', 'Salvage', 'Investment'],
    color: '#f2d78e',
  },
};
export function researchPanel(profile: Profile, branch: Branch): string {
  const nodes = RESEARCH.filter((n) => n.branch === branch),
    info = disciplines[branch];
  const rows = Math.ceil(nodes.length / 3),
    width = 900,
    height = rows * 212 - 40;
  const position = (rank: number) => ({ x: ((rank - 1) % 3) * 310, y: Math.floor((rank - 1) / 3) * 212 });
  const lines = nodes
    .flatMap((node) =>
      prerequisites(node).flatMap((id) => {
        const parent = nodes.find((n) => n.id === id);
        if (!parent) return [];
        const from = position(parent.rank),
          to = position(node.rank);
        const path =
          from.y === to.y
            ? `M ${from.x + 280} ${from.y + 86} H ${to.x}`
            : `M ${from.x + 140} ${from.y + 172} V ${to.y - 20} H ${to.x + 140} V ${to.y}`;
        return [`<path d="${path}" class="${profile.nodes.includes(id) ? 'lit' : ''}"/>`];
      }),
    )
    .join('');
  const external = [...new Set(nodes.flatMap(prerequisites))].filter((id) => !nodes.some((n) => n.id === id));
  return `<div class="modal-intro"><p>Choose a discipline, follow its connections, and bridge into other branches for capstones. Every node is distinct and compiles over several levels, each level costing 35% more; the effect shown applies per level. Weapon licenses are immediate; exploit research adds new choices to future reward drafts. <strong>Everything is lost on core death.</strong>${profile.active ? '<br>Purchase research between sectors or after extracting with a living core.' : ''}</p><span class="research-balance">${profile.research} <small>FRAGMENTS</small></span></div>
    <div class="discipline-tabs" role="tablist" aria-label="Research disciplines">${BRANCHES.map((b) => `<button role="tab" id="discipline-${b}" aria-controls="discipline-panel" tabindex="${b === branch ? 0 : -1}" aria-selected="${b === branch}" data-action="research-branch" data-branch="${b}" style="--discipline:${disciplines[b].color}">${b}<small>${levelsIn(profile.nodes, b)} / ${branchLevels(b)} LV</small></button>`).join('')}</div>
    <section class="discipline-panel" role="tabpanel" id="discipline-panel" aria-labelledby="discipline-${branch}" style="--discipline:${info.color}"><div class="discipline-heading"><div><h3>${branch}</h3><p>${info.description}</p></div><span>● OWNED &nbsp; ◇ AVAILABLE &nbsp; ○ LOCKED</span></div>
    ${
      external.length
        ? `<div class="research-bridges"><span>BRANCH CONNECTIONS</span>${external
            .map((id) => {
              const n = RESEARCH.find((n) => n.id === id)!;
              return `<button class="text-button" data-action="research-branch" data-branch="${n.branch}">${profile.nodes.includes(id) ? '✓' : '○'} ${n.name} · ${n.branch} ↗</button>`;
            })
            .join('')}</div>`
        : ''
    }
    <div class="research-scroll" tabindex="0" aria-label="Scrollable skill graph"><div class="research-track-headings">${info.tracks.map((t) => `<span>${t}</span>`).join('')}</div><div class="skill-graph" style="height:${height}px"><svg viewBox="0 0 ${width} ${height}" aria-hidden="true">${lines}</svg>${nodes
      .map((n) => {
        const level = nodeLevel(profile.nodes, n.id),
          owned = level > 0,
          complete = level >= n.levels,
          ready = researchAvailable(n, profile.nodes),
          cost = nodeCost(n, level + 1),
          pos = position(n.rank);
        const need = prerequisites(n)
          .map((id) => RESEARCH.find((p) => p.id === id)!.name)
          .join(' + ');
        return `<button class="research-node ${complete ? 'owned' : owned ? 'owned partial' : ready ? 'available' : 'locked'}" style="left:${pos.x}px;top:${pos.y}px" data-action="buy-research" data-id="${n.id}" ${complete || !ready || profile.active || BigInt(profile.research) < BigInt(cost) ? 'disabled' : ''} title="${need ? `Requires: ${need}` : 'Entry node'}"><span class="node-rank">${complete ? '✓' : String(n.rank).padStart(2, '0')} · ${(n.category ?? 'passive').toUpperCase()}</span><strong>${n.name}</strong><p>${n.description}</p><span class="node-levels" aria-label="Level ${level} of ${n.levels}">${Array.from({ length: n.levels }, (_, i) => `<i class="${i < level ? 'lit' : ''}"></i>`).join('')}<em>LV ${level} / ${n.levels}</em></span><small>${complete ? 'FULLY COMPILED' : `${owned ? `LEVEL ${level + 1} · ` : ''}${cost} FRAGMENTS`}</small><span class="prerequisite-label">${need ? `← ${need}` : 'ROOT NODE'}</span></button>`;
      })
      .join('')}</div></div></section>
    <details class="perk-catalog"><summary>Exploit library · ${PERKS.filter((p) => !p.unlock || profile.nodes.includes(p.unlock)).length} / ${PERKS.length} unlocked</summary><p>Unlocking an exploit adds it to eligible reward drafts. Weapon-specific exploits appear only when that weapon is installed. Each draft offers three choices; choose one.</p><div>${PERKS.map((p) => `<article class="${!p.unlock || profile.nodes.includes(p.unlock) ? 'unlocked' : 'locked'}"><small>${!p.unlock || profile.nodes.includes(p.unlock) ? 'UNLOCKED' : `RESEARCH · ${p.unlock.split('-')[0]}`}</small><strong>${p.name}</strong><p>${p.description}</p></article>`).join('')}</div></details>`;
}
