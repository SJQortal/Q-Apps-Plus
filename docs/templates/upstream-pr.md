<!--
Template for an app's PR to its original Qortal repo (docs/RELEASE.md, stage 4).
Fill in the <…> parts, delete what doesn't apply, and keep it short and factual.
Simon reads the finished text before it is posted. No Claude attribution lines.
Title: "<Original> <version>: <the two or three biggest changes> (from <App>+)"
-->
Hi! This is the work I published as **<App>+** (live on QDN since <date>, tested with the community since then), offered back to <Original> as **<version>**. It reads and writes the same QDN data as <Original> <their version>, so nothing needs migrating, and data published with either version works in both.

## What's in it

- **Current stack:** React 19.3, MUI 9.4, <other upgrades>, ESLint 9, <N> vitest tests.
- **Phones and GO:** <bottom bar / sheets / keyboard-safe forms / compact landscape …>.
- **Four themes** (Hub 3.0, <Original> Classic, Black, White). They follow Hub's light/dark switch live, with text contrast of at least 4.5:1.
- **Features:** <the main new features>.
- **Lighter on Qortal:** <searches on first load before → after>, no `limit: 0`, lazy media, polite polling, <bundle size before → after>.
- **Fixes found while testing in Hub:** <the important ones, especially security, money and data>.

`CHANGELOG.md` has the full list, and the README covers develop, test and publish.

## Data compatibility

- **Unchanged:** <services, identifier prefixes and JSON shapes that stay the same>.
- **New, and ignored by older versions:** <additive data with its own prefix>.

## How to review

- **It's a fast-forward of `<branch>` (<short hash>).** <N> commits, one change each. The platform upgrade comes first, then the redesign, then the fixes.
- **The last commit, "Ship as <Original> <version>",** turns the <App>+ build back into <Original>: the name, the `qortal://APP/<Original>` links, the storage keys and the version.
- **`src/hub-theme/`** is the shared theme kit from SJQortal/Q-Apps-Plus, copied in, so it can be edited here like any other source.
- **The full audit and test records** are in [docs/apps/<App>+.md](https://github.com/SJQortal/Q-Apps-Plus/blob/main/docs/apps/<App>%2B.md).

## Testing done

- <N> unit tests, lint, and build pass.
- **Screenshot check** (`node e2e/screens.mjs`): every screen at 360×740, 390×844, 844×390, 700 and 1280 px, in <themes>, with no console errors, sideways overflow, unlabelled buttons or axe violations.
- **Hub Dev Mode check with real network data,** on Hub <version>, at desktop, narrow and phone sizes with touch.
- **Community testing:** live as <App>+ since <date>. <What the community reported, and what was fixed in 1.0.x>.
- **GO on a real phone:** <done / still to check: …>.

## Maintenance

I'd also be glad to take over updates for <Original> from here on, if that helps. New work would follow the same path as this PR:
1. It's built and tested in [SJQortal/Q-Apps-Plus](https://github.com/SJQortal/Q-Apps-Plus).
2. It's published as **<App>+** on QDN, so the community can try it first.
3. Once it has proven itself there, it comes here as a PR like this one.

Happy to adjust anything, split it up differently, or answer questions.

— Simon James
