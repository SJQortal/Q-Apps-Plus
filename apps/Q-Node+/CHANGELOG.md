# Changelog

All notable changes to Q-Node+ will be documented in this file. The same
entries are shown in the app under Settings → About (src/constants/changelog.ts).

## [1.0.3-plus.1] - 2026-09-29

### Added

- Hub 3.0 layout: a navigation rail on desktop and a bottom bar on phones
- Settings page with four themes (Hub 3.0, Q-Node Classic, Black, White), account details and About
- Test harness (vitest + jsdom) with a mocked `qortalRequest`

### Changed

- Upgraded to React 19.3, MUI 9.4, Vite 8 and TypeScript 5.9
- Inter is bundled as woff2 instead of four TTF files
- The changelog dialog moved to Settings → About and no longer needs a Markdown renderer

## [1.0.3] - 2026-02-14

### Added

- Sort widgets alphabetically
- Widget "connected QDN data peers"
- Add CHANGELOG.md file
- Display changelog in a dialog

## [1.0.2] - 2026-02-07

### Added

- Direction column for peers
- Persistent row selection for tables
- Manager data peers widget

### Fixed

- Get minting accounts API call

## [1.0.1] - 2026-01-30

### Added

- Initial release of Q-Node
- Node status dashboard with real-time data
- Connected peers management
- Minting accounts overview
- Admin actions (restart, stop, force sync)
- Internationalization (i18n) support
- Responsive design with Material-UI
- Widget-based layout with sortable cards
