/**
 * The Explorer Quiz's questions (Simon, 2026-10-16: unique, interesting,
 * sometimes tricky, harder and funny questions that make people dig
 * through the Explorer). About 60 kinds in this folder, by theme: people,
 * money, names, minting, groups, blocks, polls and chain history; each
 * reads a little of the chain and asks about something picked at random,
 * or answers null when what it found doesn't make a fair question.
 *
 * makeQuestion picks a level and a kind (rules/explorer/quiz/pick.ts: the
 * odds follow the streak, no kind among the last 3 asked, themes spread
 * out) and tries kinds until one makes a question: at most 12 tries and 20
 * seconds. A viewer who doesn't see the Explorer's detailed parts gets no
 * kind answered only there (sponsees counted, who was paid most), and the
 * others tell them where to look in the tabs they have (shared.ts `where`).
 * Nothing here writes.
 */
import { getTip } from '../../chain';
import {
  levelWeights,
  pickLevel,
  pickTemplate,
  type PickHistory,
} from '../../../rules/explorer/quiz/pick';
import type { QuizAnswer, QuizLevel, QuizQuestion } from '../../../rules/explorer/quiz/types';
import { KICKERS } from '../../../rules/explorer/quiz/words';
import { BLOCK_TEMPLATES } from './blocks';
import { GROUP_TEMPLATES } from './groups';
import { HISTORY_TEMPLATES } from './history';
import { MINTING_TEMPLATES } from './minting';
import { MONEY_TEMPLATES } from './money';
import { NAME_TEMPLATES } from './names';
import { PEOPLE_TEMPLATES } from './people';
import { POLL_TEMPLATES } from './polls';
import type { Made, QuizContext, QuizTemplate, Rng } from './shared';

export type { QuizContext, QuizTemplate, Rng } from './shared';

export const QUIZ_TEMPLATES: readonly QuizTemplate[] = [
  ...PEOPLE_TEMPLATES,
  ...MONEY_TEMPLATES,
  ...NAME_TEMPLATES,
  ...MINTING_TEMPLATES,
  ...GROUP_TEMPLATES,
  ...BLOCK_TEMPLATES,
  ...POLL_TEMPLATES,
  ...HISTORY_TEMPLATES,
];

export interface MakeOptions {
  rng?: Rng;
  /** Only this level; picked by the odds otherwise. */
  level?: QuizLevel | null;
  /** Asked before on this device. */
  seen?: (key: string) => boolean;
  /** Not in a question lately. */
  fresh?: (subject: string) => boolean;
  /** The kinds asked lately, the streak and how the last one went. */
  history?: PickHistory;
  attempts?: number;
  budgetMs?: number;
  templates?: readonly QuizTemplate[];
  /**
   * The viewer sees the Explorer's detailed parts: false leaves out the
   * questions found only there, and the rest say where everyone can look.
   */
  full?: boolean;
  now?: () => number;
}

const NO_HISTORY: PickHistory = { templates: [], streak: 0, lastOutcome: null, asked: 0 };

function finish(template: QuizTemplate, made: Made, tip: number): QuizQuestion {
  return {
    v: 1,
    template: template.id,
    level: template.level,
    theme: template.theme,
    tip,
    ...made,
    kicker: made.kicker ?? KICKERS[template.theme],
    ...(template.full ? { full: true as const } : {}),
  };
}

/** A new question, or null when none could be made (the node is busy or offline). */
export async function makeQuestion(options: MakeOptions = {}): Promise<QuizQuestion | null> {
  const rng = options.rng ?? Math.random;
  const all = options.templates ?? QUIZ_TEMPLATES;
  const full = options.full !== false;
  const templates = full ? all : all.filter((t) => !t.full);
  const history = options.history ?? NO_HISTORY;
  const now = options.now ?? (() => Date.now());
  const deadline = now() + (options.budgetMs ?? 20_000);
  const tip = (await getTip()).height;
  const ctx: QuizContext = {
    rng,
    tip,
    seen: options.seen ?? (() => false),
    fresh: options.fresh ?? (() => true),
    full,
  };
  const tried = new Map<string, number>();
  const attempts = options.attempts ?? 12;
  for (let i = 0; i < attempts && now() < deadline; i += 1) {
    const level = options.level ?? pickLevel(rng, levelWeights(history));
    const template =
      pickTemplate(rng, templates, level, history.templates, tried) ??
      // Every kind of that level was asked just now: any of them will do.
      pickTemplate(rng, templates, level, [], tried);
    if (!template) continue;
    tried.set(template.id, (tried.get(template.id) ?? 0) + 1);
    try {
      const made = await template.make(ctx);
      if (made) return finish(template, made, tip);
    } catch {
      // A read failed: try another kind.
    }
  }
  return null;
}

/** A live question's answer read again now, or null (not live, or the read failed). */
export async function recheckAnswer(question: QuizQuestion): Promise<QuizAnswer | null> {
  const template = QUIZ_TEMPLATES.find((t) => t.id === question.template);
  if (!question.live || !question.args || !template?.recheck) return null;
  try {
    return await template.recheck(question.args);
  } catch {
    return null;
  }
}
