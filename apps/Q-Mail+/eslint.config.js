import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'e2e',
      // The theme kit is a synced copy of shared/hub-theme (never edited here).
      'src/hub-theme/**',
      // Q-Blog leftovers and other dead code that tsconfig.json excludes from
      // the build (docs/apps/Q-Mail+.md → Audit → Architecture map). They are
      // not shipped, so they are not linted either; delete them, don't fix them.
      'src/assets/svgs/AccountCircleSVG.tsx',
      'src/assets/svgs/CloseSVG.tsx',
      'src/assets/svgs/NewWindowSVG.tsx',
      'src/components/AudioElement.tsx',
      'src/components/DynamicHeightItem.tsx',
      'src/components/DynamicHeightItemMinimal.tsx',
      'src/components/common/AudioPanel.tsx',
      'src/components/common/AudioPlayer.tsx',
      'src/components/common/AudioPublishModal.tsx',
      'src/components/common/Comments/Comment.tsx',
      'src/components/common/Comments/CommentEditor.tsx',
      'src/components/common/Comments/CommentSection.tsx',
      'src/components/common/CustomIcon.tsx',
      'src/components/common/DraggableResizableGrid.tsx',
      'src/components/common/ErrorBoundary.tsx',
      'src/components/common/FilePanel.tsx',
      'src/components/common/GenericPublishModal.tsx',
      'src/components/common/ImageUploader.tsx',
      'src/components/common/Portal.tsx',
      'src/components/common/PostPublishModal.tsx',
      'src/components/common/PublishAudio.tsx',
      'src/components/common/PublishGeneric.tsx',
      'src/components/common/PublishVideo.tsx',
      'src/components/common/TextEditor/quillHtml.test.ts',
      'src/components/common/Tipping/Tipping.tsx',
      'src/components/common/UserNavbar/UserNavbar-styles.ts',
      'src/components/common/UserNavbar/UserNavbar.tsx',
      'src/components/common/VideoContent.tsx',
      'src/components/common/VideoPanel.tsx',
      'src/components/common/VideoPlayer.tsx',
      'src/components/common/VideoPublishModal.tsx',
      'src/components/editor/BlogEditor.tsx',
      'src/components/editor/ReadOnlySlate.test.tsx',
      'src/components/editor/customTypes.ts',
      'src/components/modals/EditBlogModal.tsx',
      'src/components/modals/PublishBlogModal.tsx',
      'src/hooks/useFetchPosts.tsx',
      'src/interfaces/interfaces.ts',
      'src/pages/BlogIndividualPost/BlogIndividualPost.tsx',
      'src/pages/BlogIndividualProfile/BlogIndividualProfile.tsx',
      'src/pages/BlogList/BlogList.tsx',
      'src/pages/BlogList/PostPreview-styles.ts',
      'src/pages/BlogList/PostPreview.tsx',
      'src/pages/CreateEditProfile/CreatEditProfile.tsx',
      'src/pages/CreatePost/CreatePost.tsx',
      'src/pages/CreatePost/CreatePostBuilder.tsx',
      'src/pages/CreatePost/CreatePostMinimal.tsx',
      'src/pages/CreatePost/components/Navbar/NavbarBuilder.tsx',
      'src/pages/CreatePost/components/Toolbar/EditorToolbar.tsx',
      'src/pages/EditPost/EditPost.tsx',
      'src/pages/Home/Home.tsx',
      'src/pages/Mail/Chat.tsx',
      'src/pages/Mail/ChatInput.tsx',
      'src/pages/Mail/FlexLayout.tsx',
      'src/pages/Mail/ShowChatMessage.tsx',
      'src/test/setup.ts',
      'src/utils/checkAndUpdatePost.tsx',
      'src/webworkers/decodeBase64.js',
      'src/webworkers/getBlogWorker.js',
      'src/wrappers/MailDownloadWrapper.tsx',
      // Dead at runtime too (nothing reachable imports them): the pre-redesign
      // reader and its thread views, the Q-Blog fetchers and lazy-load helper.
      'src/pages/Mail/ShowMessage.tsx',
      'src/pages/Mail/MailThread.tsx',
      'src/pages/Mail/MailThreadWithoutCalling.tsx',
      'src/components/common/LazyLoad.tsx',
      'src/components/common/DownloadTaskManager.tsx',
      'src/utils/blogIdformats.ts',
      'src/utils/fetchPosts.ts',
      // Vendored copy of @qortal/qapp-lib (tsconfig paths); upstream's code.
      'src/qapp-lib/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, qortalRequest: 'readonly', qortalRequestWithTimeout: 'readonly' },
    },
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      // Helpers and styled parts live next to their components on purpose; Fast Refresh
      // boundaries are a dev nicety and the warning was pure noise across the app.
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      // eslint-plugin-react-hooks 7 ships the React Compiler's rules in
      // "recommended". Q-Mail+ does not use the compiler, and the upstream code
      // sets state in effects and reads refs during render in 90-odd places;
      // those are rewritten screen by screen in the redesign, not by a lint
      // sweep. Turn them on again when the last upstream screen is gone.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/globals': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  }
);
