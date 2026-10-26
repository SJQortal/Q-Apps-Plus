/**
 * Q-Shop+ against REAL data, read-only: the shared screenshot runner with
 * every Core GET answered by the local node (QSP_NODE, default
 * http://127.0.0.1:12391) and Hub's read requests emulated over the same
 * GETs. Every write (publish, payment, list change, decrypt) is refused, and
 * nothing but GET reaches the node. A stand-in for the Hub check when no
 * signed-in test Hub is available (docs/HUB-TESTING.md).
 *
 *   QSP_CONFIG=e2e/screens.realnode.config.mjs scripts/screens.mjs Q-Shop+ …
 *   (or copy over e2e/screens.config.mjs for the run)
 *
 * Signed out by default; QSP_AS=<name> shows the app as that name (read
 * only: orders can't be decrypted without Hub, so they show as unreadable).
 */
const NODE = process.env.QSP_NODE || 'http://127.0.0.1:12391';
const AS = process.env.QSP_AS || '';

export default {
  name: 'Q-Shop+',
  themeKey: 'qshopplus-ui-theme',
  dismiss: ['I understand'],

  qortal: () => `
    const AS = ${JSON.stringify(AS)};
    const get = async (path) => {
      const r = await fetch(path);
      const t = await r.text();
      let body = t;
      try { body = JSON.parse(t); } catch (e) {}
      if (!r.ok || (body && typeof body === 'object' && !Array.isArray(body) && 'error' in body)) throw body || { error: r.status };
      return body;
    };
    const enc = encodeURIComponent;
    let me = null;
    window.__qplusAnswer = async (p) => {
      switch (p.action) {
        case 'GET_USER_ACCOUNT': {
          if (!AS) throw { error: 'Unable to get user account' };
          const name = await get('/names/' + enc(AS));
          me = { address: name.owner, publicKey: 'read-only' };
          return me;
        }
        case 'GET_ACCOUNT_NAMES': return AS ? [{ name: AS, owner: me && me.address }] : [];
        case 'GET_PRIMARY_NAME': return AS;
        case 'GET_NAME_DATA': return get('/names/' + enc(p.name));
        case 'GET_ACCOUNT_DATA': return get('/addresses/' + enc(p.address));
        case 'GET_QDN_RESOURCE_URL': return '/arbitrary/' + p.service + '/' + enc(p.name) + '/' + enc(p.identifier);
        case 'SEARCH_QDN_RESOURCES': {
          const sp = new URLSearchParams();
          for (const [k, v] of Object.entries(p)) {
            if (k === 'action' || v === undefined) continue;
            sp.set(k === 'exactMatchNames' ? 'exactmatchnames' : k === 'includeMetadata' ? 'includemetadata' : k, String(v));
          }
          if (!sp.get('limit') || sp.get('limit') === '0') sp.set('limit', '20');
          return get('/arbitrary/resources/search?' + sp.toString());
        }
        case 'FETCH_QDN_RESOURCE':
          return get('/arbitrary/' + p.service + '/' + enc(p.name) + '/' + enc(p.identifier) + (p.encoding ? '?encoding=' + p.encoding : ''));
        case 'GET_LIST_ITEMS': return [];
        case 'LIST_QDN_RESOURCES': return { resources: [] };
        default:
          // Writes, payments, decryption, wallet: refused.
          throw { error: 'User declined request' };
      }
    };
  `,

  // The first-run walkthrough and seller guide (onboarding/Walkthrough.tsx) have been seen.
  initScripts: () => [
    `try { localStorage.setItem('qshopplus-walkthrough', '1'); localStorage.setItem('qshopplus-seller-guide', '1'); } catch (e) {}`,
  ],

  async route(route, url) {
    if (route.request().method() !== 'GET') return false;
    const res = await fetch(NODE + url.pathname + url.search, { method: 'GET' }).catch(() => null);
    if (!res) return false;
    const body = Buffer.from(await res.arrayBuffer());
    await route.fulfill({ status: res.status, contentType: res.headers.get('content-type') || 'application/json', body });
    return true;
  },

  screens: [
    { key: 'real-home', path: '/', after: async (page) => page.waitForTimeout(4000) },
    { key: 'real-search', path: '/?q=gold', after: async (page) => page.waitForTimeout(3000) },
    { key: 'real-rated', path: '/?sort=rated', after: async (page) => page.waitForTimeout(3000) },
    { key: 'real-shop', path: '/2r0y/q-store-general-qortal-goldback-store', after: async (page) => page.waitForTimeout(5000) },
    { key: 'real-shop-space', path: `/${encodeURIComponent('Mindscape Dispensary')}/q-store-general-store`, after: async (page) => page.waitForTimeout(5000) },
    { key: 'real-product', path: '/2r0y/q-store-general-qortal-goldback-store/q-store-product-qortal-goldback-store-VOleukZkOY/q-store-catalogue-qortal-goldback-store-IR6VGvcT3x', after: async (page) => page.waitForTimeout(5000) },
    { key: 'real-reviews', path: '/2r0y/q-store-general-qortal-goldback-store', overlay: true, optional: true, after: async (page) => { await page.waitForTimeout(4000); await page.getByRole('button', { name: /review/i }).first().click({ timeout: 3000 }); await page.waitForTimeout(2500); } },
    { key: 'real-products', path: '/products', after: async (page) => page.waitForTimeout(6000) },
    { key: 'real-products-categories', path: '/products', overlay: true, optional: true, after: async (page) => { await page.waitForTimeout(3000); await page.getByRole('button', { name: /^(Categories|Filters)/ }).first().click({ timeout: 3000 }); await page.getByRole('checkbox').first().waitFor({ timeout: 15000 }); await page.waitForTimeout(800); },
      // Categories read every shop's product list; the node lists TanteEmma's (shop "1") but can't serve it (404), and the page leaves it out.
      expectErrors: /404|Failed to load resource/ },
    { key: 'real-cart', path: '/cart', after: async (page) => page.waitForTimeout(2000) },
    { key: 'real-bhc', path: `/${encodeURIComponent('Biohackers Corner')}/q-store-general-bhc`, after: async (page) => page.waitForTimeout(6000) },
    { key: 'real-bhc-product', path: `/${encodeURIComponent('Biohackers Corner')}/q-store-general-bhc/q-store-product-bhc-wqazMQpHaL/q-store-catalogue-bhc-H9X2iZOp9B`, after: async (page) => page.waitForTimeout(6000) },
    { key: 'real-names', path: '/names', after: async (page) => page.waitForTimeout(8000) },
    // As a seller (QSP_AS="Biohackers Corner"): the seller page, read only.
    { key: 'real-seller', path: '/product-manager/q-store-general-bhc', optional: true, after: async (page) => page.waitForTimeout(6000) },
    { key: 'real-seller-delivery', path: '/product-manager/q-store-general-bhc?tab=delivery', optional: true, after: async (page) => page.waitForTimeout(6000) },
    { key: 'real-seller-products', path: '/product-manager/q-store-general-bhc?tab=products', optional: true, after: async (page) => page.waitForTimeout(6000) },
    { key: 'real-settings', path: '/settings' },
  ],
};
