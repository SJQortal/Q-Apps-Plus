/**
 * The static manifest: what the launcher knows about every + app without a
 * network call. Live QDN details (updated, size, publish metadata) come from
 * src/qortal/appResources.ts on top of this.
 *
 * Names are the Qortal names the apps are published under. They contain `+`,
 * so links always go through appLink() in src/qortal/openApp.ts.
 */
export type AppCategoryId = 'communication' | 'media' | 'commerce' | 'network';

export interface AppCategory {
  id: AppCategoryId;
  label: string;
  blurb: string;
}

export const APP_CATEGORIES: readonly AppCategory[] = [
  { id: 'communication', label: 'Communication', blurb: 'Mail and support' },
  { id: 'media', label: 'Media & files', blurb: 'Video, files and documents' },
  { id: 'commerce', label: 'Commerce', blurb: 'Shops, trading and funding' },
  { id: 'network', label: 'Names & node', blurb: 'Your name, your node, the minters' },
];

export type AppIconId =
  | 'mail'
  | 'shop'
  | 'share'
  | 'support'
  | 'tube'
  | 'trade'
  | 'fund'
  | 'names'
  | 'node'
  | 'mintership'
  | 'apps';

export type AppStack = 'qapp-core' | 'redux' | 'rewrite' | 'new';

export interface OriginalApp {
  /** The Qortal name the original app is published under. */
  name: string;
  /** Upstream source repository. */
  repo: string;
}

export interface AppEntry {
  /** Qortal name of the + app, e.g. "Q-Mail+". */
  name: string;
  /** URL-safe id for routes and storage, e.g. "q-mail-plus". */
  slug: string;
  tagline: string;
  description: string;
  category: AppCategoryId;
  icon: AppIconId;
  original: OriginalApp;
  /** QDN services the app reads and writes; the same ones as the original. */
  services: string[];
  /** What the + version adds on top of the original. */
  adds: string[];
  stack: AppStack;
  /** Words that help search find the app. */
  keywords: string[];
}

export const SOURCE_REPO = 'https://github.com/SJQortal/Q-Apps-Plus';

/** Improvements every + app gets from the shared pass. */
export const SHARED_IMPROVEMENTS: readonly string[] = [
  'Hub 3.0 look with four themes: Hub 3.0, Hub 2.0, Black and White',
  'A real Settings page, with the theme picker and an About section with the changelog',
  'Fewer and smaller QDN calls: paged lists, merged searches and a session cache',
  'Faster first paint: smaller bundles and code-split screens',
  'Loading, empty and error states on every screen',
  'A phone layout that works in Qortal GO and in narrow Hub windows',
  'Same data as the original app: your existing mail, videos, shops and names show up unchanged',
];

export const APPS: readonly AppEntry[] = [
  {
    name: 'Q-Mail+',
    slug: 'q-mail-plus',
    tagline: 'Encrypted mail between Qortal names',
    description:
      'Private, end-to-end encrypted mail between Qortal names, with threads, attachments and group mail. Reads and writes the same mail as Q-Mail.',
    category: 'communication',
    icon: 'mail',
    original: { name: 'Q-Mail', repo: 'https://github.com/Qortal/q-mail' },
    services: ['MAIL_PRIVATE', 'BLOG_POST', 'BLOG_COMMENT', 'THUMBNAIL', 'FILE'],
    adds: [
      'Search across your mail',
      'Unread counts per name and thread',
      'Drafts that survive a reload',
      'Recent recipients when you compose',
      'Keyboard shortcuts on desktop',
    ],
    stack: 'redux',
    keywords: ['mail', 'email', 'message', 'inbox', 'encrypted', 'thread'],
  },
  {
    name: 'Q-Shop+',
    slug: 'q-shop-plus',
    tagline: 'Decentralised shops and orders',
    description:
      'Sellers publish a store and products on QDN; buyers order and pay in QORT or other coins. Uses the same stores, products and orders as Q-Shop.',
    category: 'commerce',
    icon: 'shop',
    original: { name: 'Q-Shop', repo: 'https://github.com/Qortal/q-shop' },
    services: ['STORE', 'PRODUCT', 'DOCUMENT', 'DOCUMENT_PRIVATE', 'THUMBNAIL'],
    adds: [
      'Product search and filters',
      'A cart that survives a reload',
      'Clear order status for buyers and sellers',
      'Seller dashboard',
      'Prices shown in several coins',
    ],
    stack: 'redux',
    keywords: ['shop', 'store', 'buy', 'sell', 'product', 'order', 'market'],
  },
  {
    name: 'Q-Share+',
    slug: 'q-share-plus',
    tagline: 'Share files and documents on QDN',
    description:
      'Publish files and documents to QDN with categories, comments and lists. Shows the same files as Q-Share.',
    category: 'media',
    icon: 'share',
    original: { name: 'Q-Share', repo: 'https://github.com/Qortal/q-share' },
    services: ['DOCUMENT', 'FILE', 'THUMBNAIL', 'BLOG_COMMENT'],
    adds: [
      'Drag-and-drop multi-file upload with progress',
      'File previews for images, PDF, text, audio and video',
      'Sort by newest or popular',
      'Copy a share link in one tap',
    ],
    stack: 'redux',
    keywords: ['share', 'file', 'document', 'upload', 'download', 'pdf'],
  },
  {
    name: 'Q-Support+',
    slug: 'q-support-plus',
    tagline: 'Issues and bounties for Qortal',
    description:
      'A support and issue board for Qortal, with bounties paid in QORT and other coins. Same issues and replies as Q-Support.',
    category: 'communication',
    icon: 'support',
    original: { name: 'Q-Support', repo: 'https://github.com/Qortal/q-support' },
    services: ['DOCUMENT', 'FILE', 'THUMBNAIL', 'PLAYLIST', 'BLOG_COMMENT'],
    adds: [
      'Issue status workflow: open, in progress, solved',
      'Filter by status, category and bounty',
      'Mark a reply as the solution',
      'Proper icons in the Hub 3.0 style',
    ],
    stack: 'redux',
    keywords: ['support', 'issue', 'bug', 'bounty', 'help', 'ticket'],
  },
  {
    name: 'Q-Tube+',
    slug: 'q-tube-plus',
    tagline: 'Video on QDN',
    description:
      'Watch and publish video: playlists, comments, super likes and subscriptions. Same videos, playlists and channels as Q-Tube.',
    category: 'media',
    icon: 'tube',
    original: { name: 'Q-Tube', repo: 'https://github.com/Qortal/q-tube' },
    services: ['VIDEO', 'PLAYLIST', 'DOCUMENT', 'BLOG_COMMENT', 'CHAIN_COMMENT'],
    adds: [
      'Continue watching and watch later',
      'A faster home feed: cached and paged',
      'Better channel pages',
      'Chapter and timestamp links',
      'A much smaller first download',
    ],
    stack: 'qapp-core',
    keywords: ['video', 'tube', 'watch', 'playlist', 'channel', 'stream'],
  },
  {
    name: 'Q-Trade+',
    slug: 'q-trade-plus',
    tagline: 'Trade QORT for other coins',
    description:
      'Buy and sell QORT for LTC, BTC, DOGE, DGB, RVN and ARRR through Qortal trade bots. The same orders and fees as Q-Trade.',
    category: 'commerce',
    icon: 'trade',
    original: { name: 'Q-Trade', repo: 'https://github.com/Qortal/q-trade' },
    services: ['JSON'],
    adds: [
      'A clearer order book: depth, best price and spread',
      'Trade history with filters',
      'Order status explained in plain words',
      'A price chart from recent trades',
      'Warnings before risky actions',
    ],
    stack: 'qapp-core',
    keywords: ['trade', 'exchange', 'swap', 'btc', 'ltc', 'doge', 'crosschain', 'order'],
  },
  {
    name: 'Q-Fund+',
    slug: 'q-fund-plus',
    tagline: 'Crowdfunding in QORT',
    description:
      'Campaigns funded in QORT, with updates and comments. Shows the same campaigns as Q-Fund.',
    category: 'commerce',
    icon: 'fund',
    original: { name: 'Q-Fund', repo: 'https://github.com/Qortal/q-fund-v2' },
    services: ['DOCUMENT', 'AUDIO', 'VIDEO', 'THUMBNAIL', 'FILE', 'BLOG_COMMENT'],
    adds: [
      'Progress bar with backers and time left',
      'A timeline of campaign updates',
      'Filter by active, ending soon or funded',
      'Share link for a campaign',
    ],
    stack: 'redux',
    keywords: ['fund', 'crowdfund', 'campaign', 'donate', 'raise'],
  },
  {
    name: 'Names+',
    slug: 'names-plus',
    tagline: 'Register, buy and sell names',
    description:
      'Register, update, buy and sell Qortal names, and manage your avatar and primary name. Same names and marketplace as the Names app.',
    category: 'network',
    icon: 'names',
    original: { name: 'names', repo: 'https://github.com/Qortal/names' },
    services: ['THUMBNAIL'],
    adds: [
      'Availability check as you type',
      'Marketplace sort and filter: price, length, newest',
      'The fee shown before you confirm',
      'A My names dashboard with avatar and primary-name controls',
    ],
    stack: 'qapp-core',
    keywords: ['name', 'register', 'avatar', 'identity', 'marketplace', 'primary'],
  },
  {
    name: 'Q-Node+',
    slug: 'q-node-plus',
    tagline: 'Manage your Qortal node',
    description:
      'Status, peers, minting accounts and admin actions for your local Qortal node. Same node API as Q-Node.',
    category: 'network',
    icon: 'node',
    original: { name: 'Q-Node', repo: 'https://github.com/Qortal/Q-Node' },
    services: [],
    adds: [
      'Live status that polls only while visible',
      'Peer list with sort and filter',
      'Sync progress explained',
      'Minting account health',
      'Confirm dialogs before restart or stop',
    ],
    stack: 'qapp-core',
    keywords: ['node', 'core', 'peers', 'minting', 'sync', 'admin', 'status'],
  },
  {
    name: 'Q-Mintership+',
    slug: 'q-mintership-plus',
    tagline: 'The minting group, forum and boards',
    description:
      'Forum and admin boards for the Qortal minting group: minter cards, nominations, polls and admin approvals. Same messages and cards as Q-Mintership, rebuilt in React.',
    category: 'network',
    icon: 'mintership',
    original: { name: 'Q-Mintership', repo: 'https://github.com/Qortal/Q-Mintership-Alpha' },
    services: ['BLOG_POST', 'MAIL_PRIVATE', 'FILE_PRIVATE', 'DOCUMENT'],
    adds: [
      'Paged boards with no unlimited loads',
      'Card status at a glance',
      'Nomination and vote progress',
      'Search within boards',
    ],
    stack: 'rewrite',
    keywords: ['minter', 'minting', 'group', 'forum', 'nomination', 'poll', 'admin'],
  },
];

/** The launcher itself, shown in About. */
export const SELF: AppEntry = {
  name: 'Q-Apps+',
  slug: 'q-apps-plus',
  tagline: 'One place to find and open every + app',
  description: 'Discover and open the + versions of the Qortal Q-Apps.',
  category: 'network',
  icon: 'apps',
  original: { name: '', repo: SOURCE_REPO },
  services: ['APP', 'THUMBNAIL'],
  adds: [],
  stack: 'new',
  keywords: ['launcher', 'apps'],
};

export const STACK_LABELS: Record<AppStack, string> = {
  'qapp-core': 'React 19 · MUI 9 · qapp-core',
  redux: 'React 19 · MUI 9 · Redux',
  rewrite: 'React 19 · MUI 9 · rewritten from plain JS',
  new: 'React 19 · MUI 9',
};

export function categoryLabel(id: AppCategoryId): string {
  return APP_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function findApp(nameOrSlug: string | undefined): AppEntry | undefined {
  if (!nameOrSlug) return undefined;
  const wanted = nameOrSlug.toLowerCase();
  return APPS.find((app) => app.name.toLowerCase() === wanted || app.slug === wanted);
}

/** Every Qortal name the launcher looks up on QDN: the + apps and their originals. */
export function allQdnNames(): string[] {
  const names = new Set<string>();
  for (const app of APPS) {
    names.add(app.name);
    if (app.original.name) names.add(app.original.name);
  }
  return [...names];
}

/** Case-insensitive search across name, tagline, description and keywords. */
export function matchesQuery(app: AppEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [app.name, app.tagline, app.description, app.original.name, ...app.keywords, categoryLabel(app.category)]
    .join(' ')
    .toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}
