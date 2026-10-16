# Names+

Simon's "+" version of the official Qortal **Names** app ([Qortal/names](https://github.com/Qortal/names)), part of [Q-Apps+](https://github.com/SJQortal/Q-Apps-Plus). It reads and writes the same names, sales and avatars, so anything done here shows up in the original app and the other way round.

What it adds:

- the Hub 3.0 look with four themes (Hub 3.0, Names Classic, Black, White) and a Settings page;
- a phone layout that works in GO: bottom navigation, list rows with an actions menu;
- fewer node requests: paged lists, one batched avatar lookup, cached fees, polling only while visible;
- market sorting (name, price, length, newest) with seller and registration date;
- a buy confirmation showing price, fee, total and balance, and a clearer sell dialog;
- loading, empty and error states everywhere, and a set of upstream bug fixes.

Build and test from this folder: `npm ci && npm run build`, `npm test`, `npm run lint`. The publish zip comes from `scripts/build-zip.sh Names+` at the repo root. The brief with the audit, plan and follow-ups is `docs/apps/Names+.md`.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```
