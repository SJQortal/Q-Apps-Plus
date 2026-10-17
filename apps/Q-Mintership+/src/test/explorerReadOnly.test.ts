/**
 * The Explorer is read-only, enforced by lint (eslint.config.js): its
 * pages, loaders and rules can't import what signs or publishes.
 */
import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

/** The app folder (this file is src/test/explorerReadOnly.test.ts). */
const APP_DIR = decodeURIComponent(
  import.meta.url.replace(/^file:\/\//, '').replace(/src\/test\/[^/]+$/, '')
);
const eslint = new ESLint({ cwd: APP_DIR });

/** The restricted-import messages for `code` as if it lived at `file` (relative to the app). */
async function restricted(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: `${APP_DIR}${file}` });
  return result.messages
    .filter((message) => message.ruleId === 'no-restricted-imports')
    .map((message) => message.message);
}

describe('the Explorer is read-only', () => {
  it('stops Explorer pages from importing writes and write dialogs', async () => {
    const messages = await restricted(
      'src/pages/explorer/Probe.tsx',
      [
        "import { runSteps } from '../../writes/runner';",
        "import { proposeFlow } from '../../writes/flows';",
        "import { hubAction } from '../../writes/hubActions';",
        "import { guard } from '../../writes/guards';",
        "import { publishComment } from '../../writes/comments';",
        "import SignDialog from '../decisions/SignDialog';",
        "import { PollWriteDialogs } from '../decisions/PollWriteDialogs';",
        "import { NomineeAction } from '../../components/nomination/NomineeAction';",
        "import { SupportDialog } from '../../components/nomination/SupportDialog';",
        "import { LazyJoinDialog } from '../../components/nomination/LazyJoinDialog';",
        "import { HubStepDialog } from '../../components/common/HubStepDialog';",
        "import { ConsideringDialog } from '../../components/decision/ConsideringDialog';",
        "import { LazyCommunityVoteDialog } from '../../components/community/LazyCommunityVoteDialog';",
        "import { ReadyToMintDialog } from '../../components/ready/ReadyToMintDialog';",
        "import { CommentDialogs } from '../../components/comments/CommentDialogs';",
        "import { LazyDeclineDialog } from '../nominations/LazyDeclineDialog';",
        'export const used = [runSteps, proposeFlow, hubAction, guard, publishComment, SignDialog,',
        '  PollWriteDialogs, NomineeAction, SupportDialog, LazyJoinDialog, HubStepDialog,',
        '  ConsideringDialog, LazyCommunityVoteDialog, ReadyToMintDialog, CommentDialogs,',
        '  LazyDeclineDialog];',
      ].join('\n')
    );
    expect(messages).toHaveLength(16);
    for (const message of messages) expect(message).toContain('The Explorer is read-only.');
  });

  it('covers the Explorer loaders and rules too, type imports included', async () => {
    expect(
      await restricted(
        'src/data/explorer/probe.ts',
        "import type { ProposeDialogProps } from '../../pages/decisions/ProposeDialog';\n" +
          "import { flows } from '../../writes/flows';\n" +
          'export type P = ProposeDialogProps;\nexport const f = flows;\n'
      )
    ).toHaveLength(2);
    expect(
      await restricted(
        'src/rules/explorer/probe.ts',
        "import { guard } from '../../writes/guards';\nexport const g = guard;\n"
      )
    ).toHaveLength(1);
  });

  it('lets the Minter Profile tab and a group card act, from modules of their own', async () => {
    expect(
      await restricted(
        'src/pages/explorer/account/MintershipTab.tsx',
        "import { ProfileActions } from '../../person/ProfileActions';\n" +
          'export const used = ProfileActions;\n'
      )
    ).toEqual([]);
    // And a group card's Join, from its own module.
    expect(
      await restricted(
        'src/pages/explorer/account/overview/GroupsSection.tsx',
        "import { JoinGroupButton } from '../../../../components/groups/JoinGroupButton';\n" +
          'export const used = JoinGroupButton;\n'
      )
    ).toEqual([]);
    // Still not the dialogs themselves.
    expect(
      await restricted(
        'src/pages/explorer/account/MintershipTab.tsx',
        "import { NomineeAction } from '../../../components/nomination/NomineeAction';\n" +
          'export const used = NomineeAction;\n'
      )
    ).toHaveLength(1);
  });

  it('lets the Explorer read, and leaves the rest of the app alone', async () => {
    expect(
      await restricted(
        'src/pages/explorer/Probe.tsx',
        [
          "import { ResponsiveDialog } from '../../components/common/ResponsiveDialog';",
          "import { getNamesOf } from '../../data/explorer/account';",
          "import { describeTx } from '../../rules/explorer/txWords';",
          "import { ChangelogDialog } from '../../components/Settings/ChangelogDialog';",
          'export const used = [ResponsiveDialog, getNamesOf, describeTx, ChangelogDialog];',
        ].join('\n')
      )
    ).toEqual([]);
    expect(
      await restricted(
        'src/pages/decisions/Probe.tsx',
        "import { runSteps } from '../../writes/runner';\nexport const r = runSteps;\n"
      )
    ).toEqual([]);
  });
});
