import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * The Explorer is read-only: its pages, loaders and rules can't reach the
 * code that signs or publishes. Patterns match the import as written, so
 * they name the folder just above the module (`../decisions/SignDialog`
 * from a page, `../../pages/decisions/SignDialog` from a loader).
 *
 * Two parts act, by design (Simon, 2026-10-17): an account's Minter Profile
 * tab is its MINTER profile, so it shows the profile's own actions and
 * nomination card (pages/person/ProfileActions.tsx); and a group card offers
 * Join (components/groups/JoinGroupButton.tsx). Both come from modules
 * outside the Explorer: its own files still import none of the code that signs.
 */
export const EXPLORER_FILES = [
  'src/pages/explorer/**',
  'src/data/explorer/**',
  'src/rules/explorer/**',
];
export const EXPLORER_BANNED_IMPORTS = [
  // What sends transactions and publishes through Hub.
  '**/writes/runner',
  '**/writes/flows',
  '**/writes/hubActions',
  '**/writes/guards',
  '**/writes/comments',
  '**/writes/considering',
  '**/writes/adminPolls',
  // The dialogs that sign, publish, vote or join (and their lazy wrappers).
  '**/nomination/NomineeAction*',
  '**/nomination/SupportDialog',
  '**/nomination/*JoinDialog',
  '**/common/HubStepDialog',
  '**/comments/CommentDialogs',
  '**/community/*CommunityVoteDialog',
  '**/decision/ConsideringDialog',
  '**/ready/*ReadyToMintDialog',
  '**/decisions/*Dialog',
  '**/decisions/*Dialogs',
  '**/nominations/LazyDeclineDialog',
];

export default tseslint.config(
  { ignores: ['dist', 'legacy', 'src/hub-theme'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: EXPLORER_FILES,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: EXPLORER_BANNED_IMPORTS, message: 'The Explorer is read-only.' }],
        },
      ],
    },
  }
);
