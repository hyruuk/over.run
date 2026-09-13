import type { Profile } from './types';
/** The tutorial is a sequence of goals checked against the live profile; progress persists in settings. */
export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  /** CSS selectors highlighted while the step is active. */
  targets: string[];
  /** True once the operator has done what the step asks. Informational steps never complete themselves. */
  done: (p: Profile) => boolean;
}
export const TUTORIAL_DONE = 99;
const combat = (p: Profile) =>
  p.active?.towers.some((t) => t.kind !== 'gate' && t.kind !== 'reactor') ?? false;
export const TUTORIAL: TutorialStep[] = [
  {
    id: 'cannon',
    title: 'Install a Packet cannon',
    text: 'Select the Packet cannon in the arsenal, then click an empty grid cell beside a circuit trace. The ring shows its range; traces are where viruses travel.',
    targets: ['[data-kind="cannon"]', '#board'],
    done: combat,
  },
  {
    id: 'gate',
    title: 'Seal a trace with a Circuit gate',
    text: 'Gates sit on the traces themselves. A sealed gate queues traffic in front of your weapons until pressure breaks it open. Install one on the trace feeding the core.',
    targets: ['[data-kind="gate"]', '#board'],
    done: (p) => p.active?.towers.some((t) => t.kind === 'gate') ?? false,
  },
  {
    id: 'routine',
    title: 'Program a routine',
    text: 'Open the routine editor and add the Pressure relief template, then compile. It opens gates before they fail. Routines are how your system reacts while you watch.',
    targets: ['[data-action="routines"]'],
    done: (p) => (p.active?.rules.length ?? 0) > 0,
  },
  {
    id: 'run',
    title: 'Run the attack',
    text: 'Press > run. Attacks play out on their own; only playback speed can change. Watch where viruses leak and where weapons idle.',
    targets: ['.launch'],
    done: (p) => (p.active?.wave ?? 1) > 1 || p.active?.phase === 'reward',
  },
  {
    id: 'exploit',
    title: 'Read the diagnostics, choose an exploit',
    text: 'Diagnostics show breaches, damage per weapon and routine activity. Then draft one temporary exploit: it lasts for this board only.',
    targets: ['.launch'],
    done: (p) => (p.active?.perks.length ?? 0) > 0,
  },
  {
    id: 'grid',
    title: 'Power, research, traits, scars',
    text: 'Power capacity limits installations; a Power supply fits only in the dashed PSU socket, radiates heat and is never refunded. Survive five attacks to clear the sector: you earn research to compile the skill tree and draft a permanent trait. A Daemon that reaches the core leaves a permanent scar. Death erases the whole run.',
    targets: ['[data-kind="reactor"]', '.run-profile'],
    done: () => false,
  },
];
export const tutorialStep = (p: Profile) => p.settings.tutorial ?? TUTORIAL_DONE;
export const tutorialActive = (p: Profile) => tutorialStep(p) < TUTORIAL.length;
/** The step the tutorial should advance to: skips every step already satisfied by the profile. */
export function nextTutorialStep(p: Profile): number {
  let step = tutorialStep(p);
  while (step < TUTORIAL.length && TUTORIAL[step].done(p)) step++;
  return step;
}
