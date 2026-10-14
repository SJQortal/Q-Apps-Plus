# Q-Shop+

**Q-Shop+ is Simon's "+" version of [Qortal/q-shop](https://github.com/Qortal/q-shop).** It reads and writes exactly the same QDN resources as Q-Shop (stores, products, orders, reviews), so a shop set up in either app shows in both. What it adds:

- the Hub 3.0 look with four themes (Hub 3.0, Q-Shop Classic, Black, White) and a real Settings page;
- React 19.3 and MUI 9.4, a vitest harness with a `qortalRequest` mock, and a smaller download (unused fonts and the old blog editor removed);
- your preferred coin remembered between visits;
- see `src/constants/changelog.ts` and Settings → About → What's new for the full list.

Part of the [Q-Apps+](https://github.com/SJQortal/Q-Apps-Plus) monorepo; the brief with the audit, plan and follow-ups is in `docs/apps/Q-Shop+.md` there.

```bash
npm ci
npm run dev      # Vite dev server (Qortal calls need Hub)
npm run build    # typecheck + production build
npm test         # vitest
```

Publishing to QDN is done by Simon from `release/Q-Shop+.zip` (`scripts/build-zip.sh Q-Shop+`).
