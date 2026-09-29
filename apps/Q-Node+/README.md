# Q-Node+

This is the **+ version** of the official Qortal [Q-Node](https://github.com/Qortal/Q-Node)
app, part of [Q-Apps+](https://github.com/SJQortal/Q-Apps-Plus). It manages the same
local node through the same Core API and `ADMIN_ACTION` calls, so nothing here
diverges from the original; it adds:

- the Hub 3.0 look with four themes (Hub 3.0, Q-Node Classic, Black, White) and a Settings page;
- a phone layout with a bottom bar, for GO and narrow Hub windows;
- React 19.3 + MUI 9.4, a smaller download, and a test harness.

Publish name: `Q-Node+`. Build a release zip with `scripts/build-zip.sh Q-Node+` from
the monorepo root.

---

# Q-Node - Vite.js and TypeScript (upstream README)

## How to use

Download the source [or clone the repo](https://github.com/AlphaX-Qortal/Q-Node):

Install it and run development:

```bash
npm install
npm run dev -- --host
```

Install it and build production:

```bash
npm install
npm run build
```