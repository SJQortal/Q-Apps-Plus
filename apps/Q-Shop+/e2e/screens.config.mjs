/**
 * Q-Shop+ for the shared screenshot check (scripts/screens.mjs):
 *
 *   scripts/screens.mjs Q-Shop+ [--only home,shop] [--themes hub30] [--mode light]
 *
 * One small marketplace, served from mocks (nothing reaches a node, every
 * write is declined): 14 shops (owners with a space, a "+" and non-ASCII
 * letters; long titles), the signed-in name "Seller Name" owns "my-shop"
 * (12 products in two catalogues, one out of stock, one physical) and has
 * bought from two other shops; buyers' orders to "my-shop" with statuses;
 * reviews; a cart with items from two shops; a paid order still to record.
 * "my-shop" prices four products in USD at the seller's rates; Shop+Plus has
 * arranged its products (Featured) and both have collections, and runs three
 * auctions (live with bids, upcoming, and one "Seller Name" won). Categories
 * are the fixed list's, plus one from before it ("Paper").
 */
const ME = 'Seller Name';
const ME_ADDRESS = 'QSeLLeRNameAddressxxxxxxxxxxxx9f3c2a';
const now = Date.now();
const DAY = 86_400_000;

const OWNERS = [ME, 'Shop+Plus', 'Zoë Ålund', 'Seller 3', 'A very long publisher name that wraps', 'Seller 5', 'Seller 6', 'Seller 7', 'Seller 8', 'Seller 9', 'Seller 10', 'Seller 11', 'Seller 12', 'Seller 13'];
const TITLES = [
  "Seller's Shop",
  'Plus Gadgets',
  'Ålund Ceramics',
  'Pirate Supplies',
  'A shop with an unusually long title that has to wrap on small phones',
  'Digital Art Corner',
  'Books & Zines',
  'Retro Games',
  'Tea House',
  'Bike Parts',
  'Handmade Soap',
  'Vinyl Records',
  'Garden Seeds',
  'Knitting Club',
];
const shops = OWNERS.map((owner, i) => {
  const short = i === 0 ? 'my-shop' : `shop-${i}`;
  return {
    owner,
    short,
    id: `q-store-general-${short}`,
    title: TITLES[i],
    description: i === 4 ? 'A description long enough to need two lines on a phone and a fold on the card, with a few more words.' : `Everything ${TITLES[i]} sells, made with care.`,
    created: now - i * DAY * 3,
    updated: now - i * DAY * 2,
    arrr: i % 3 === 0,
    products: i < 6 ? 12 : 4,
  };
});

// Images are generated in setup() (data URLs, as the shops publish them).
let IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
let IMG2 = IMG;
// A wide logo (5:2, transparent around the lettering), for shop-1: shop pages show logos whole.
let LOGO_WIDE = IMG;
// A product photo with a transparent background (a cut-out), for products 0 and 3: lists show it without a backdrop.
let CUTOUT = IMG;
// A real PDF (made by Chromium in setup), for the description's PDF and its preview with pdf.js.
let PDF = Buffer.from('%PDF-1.4');
let PNG = Buffer.from(IMG.split(',')[1], 'base64');

const productId = (s, p) => `q-store-product-${s.short}-P${String(p).padStart(9, '0')}`;
const catalogueId = (s, c) => `q-store-catalogue-${s.short}-CAT${String(c).padStart(7, '0')}`;
function product(s, p) {
  return {
    title: p === 0 ? 'Hand-thrown mug with a long product title that wraps over two lines' : ['Poster', 'Notebook', 'Scarf', 'Ebook', 'Sticker pack', 'Lamp'][p % 6] + ` ${p}`,
    description: p === 0 ? 'A mug.\nGlazed by hand, so every one is different.\n\nHolds 350 ml.' : `Description of product ${p}.`,
    created: s.created + p * 60_000,
    version: 1,
    images: p === 0 ? [CUTOUT, IMG2, IMG] : p === 3 ? [CUTOUT] : p % 4 === 0 ? [IMG, IMG2, IMG] : [p % 2 ? IMG2 : IMG],
    mainImageIndex: 0,
    type: p % 3 === 0 ? 'physical' : 'digital',
    price: s.arrr && p % 2 === 0 ? [{ currency: 'qort', value: 1.5 + p }, { currency: 'ARRR', value: 0.25 + p / 10 }] : [{ currency: 'qort', value: 1.5 + p }],
    storeId: s.id,
    shortStoreId: s.short,
    category: ['Home & Garden', 'Collectibles & Art', 'Paper'][p % 3],
    id: productId(s, p),
    status: p === 5 ? 'OUT_OF_STOCK' : 'AVAILABLE',
    user: s.owner,
    // The seller's shop prices some products in USD (money/fiatPricing.ts).
    ...(s.short === 'my-shop' && USD_PRICED.includes(p) && { fiatPrice: { currency: 'USD', value: Math.round((1.5 + p) * 18) / 100, qort: 1.5 + p } }),
    // The product page's product: a formatted description with a video, a PDF and a Q-Tube link, and 7 pictures.
    ...(s.short === 'shop-3' && p === 0 && RICH),
    ...(variantOfFixture(s, p) && { title: `Hand-thrown mug — ${VARIANT_COMBOS[p].join(' / ')}`, type: 'physical', price: [{ currency: 'qort', value: 18 + p * 2 }], status: p === 3 ? 'OUT_OF_STOCK' : 'AVAILABLE', variant: variantOfFixture(s, p) }),
    ...(apronOf(s, p) && { title: `Linen apron — ${apronOf(s, p).values.join(' / ')}`, type: 'physical', images: apronPictures(p), variant: apronOf(s, p) }),
    // Auctions (auctions/rules.ts): stored out of stock at the starting bid, for the original app.
    ...(AUCTIONS[s.short]?.[p] && { status: 'OUT_OF_STOCK', price: [{ currency: 'qort', value: AUCTIONS[s.short][p].startingBid }], auction: AUCTIONS[s.short][p] }),
  };
}
const HOUR = 3_600_000;
// Variants (variants/model.ts): Ålund Ceramics' products 0–3 are one mug in four items (a variant's own glazes), bundled, the first the lead.
const VARIANT_OPTIONS = [
  { name: '250 ml', values: [{ name: 'Celadon', color: '#9fc5a8' }, { name: 'Tenmoku', color: '#5b3a29' }] },
  { name: '350 ml', values: [{ name: 'Celadon', color: '#9fc5a8' }, { name: 'Tenmoku', color: '#5b3a29' }] },
];
const VARIANT_COMBOS = [['250 ml', 'Celadon'], ['250 ml', 'Tenmoku'], ['350 ml', 'Celadon'], ['350 ml', 'Tenmoku']];
const variantOfFixture = (s, p) =>
  s.short === 'shop-2' && p < 4
    ? { group: 'MUGGROUP01', title: 'Hand-thrown mug', options: VARIANT_OPTIONS, values: VARIANT_COMBOS[p], display: 'bundle', lead: productId(s, 0) }
    : null;
// The seller's own group, each item listed on its own: products 4 (the lead), 8 and 10, in two catalogues.
const APRON_OPTIONS = [
  { name: 'Small', values: [{ name: 'Natural', color: '#d8cbb3' }, { name: 'Indigo', color: '#3b4a7a' }] },
  { name: 'Large', values: [{ name: 'Natural', color: '#d8cbb3' }] },
];
const APRON_ITEMS = { 4: ['Small', 'Natural'], 8: ['Small', 'Indigo'], 10: ['Large', 'Natural'] };
// Read when served, after setup() makes the pictures: the lead's own and the product's, the others' own.
const apronPictures = (p) => ({ 4: [IMG2, IMG, CUTOUT], 8: [CUTOUT], 10: [IMG] })[p];
const apronOf = (s, p) =>
  s.short === 'my-shop' && APRON_ITEMS[p]
    ? { group: 'APRONGRP01', title: 'Linen apron', options: APRON_OPTIONS, values: APRON_ITEMS[p], display: 'separate', lead: productId(s, 4) }
    : null;
// Delivery prices (delivery/model.ts): the seller's own in USD, with a profile for heavy items; Plus Gadgets' in QORT.
const DELIVERY = {
  'my-shop': {
    v: 1,
    storeId: 'q-store-general-my-shop',
    currency: 'USD',
    general: {
      zones: [
        { id: 'na', name: 'North America', countries: ['US', 'CA'], first: 6, extra: 2, freeOver: 80 },
        { id: 'eu', name: 'Europe', countries: ['DE', 'FR', 'IT', 'ES', 'NL', 'PL', 'PT'], first: 9, extra: 3 },
        { id: 'west', countries: ['US'], states: ['CA', 'OR', 'WA'], first: 4 },
      ],
    },
    profiles: [{ id: 'heavy', name: 'Heavy items', products: [productId({ short: 'my-shop' }, 3), productId({ short: 'my-shop' }, 6)], zones: [{ id: 'world', name: 'Worldwide', countries: ['US', 'CA', 'GB', 'DE', 'FR', 'PL', 'PT', 'JP', 'AU'], first: 25 }] }],
    updated: now - DAY,
  },
  'shop-1': { v: 1, storeId: 'q-store-general-shop-1', currency: 'QORT', general: { zones: [{ id: 'all', countries: ['US', 'CA', 'GB', 'DE', 'FR', 'PL', 'PT'], first: 2, extra: 0.5 }] }, profiles: [], updated: now - DAY },
};
// Favourites (favorites/model.ts): [name, shop index, product or null]. The signed-in seller keeps two shops and
// two products; other names keep some shops, for Most loved and the cards' hearts.
const FAVORITES = [
  [ME, 1, null], [ME, 3, null], [ME, 1, 3], [ME, 3, 0],
  ['Ann Buyer', 3, null], ['bob+builder', 3, null], ['Ann Buyer', 2, null], ['Zoë Ålund', 1, null],
  // The signed-in seller's shop and a product of it, kept by others: the Overview's Recent activity.
  ['Ann Buyer', 0, null], ['Zoë Ålund', 0, 2],
];
const AUCTIONS = {
  'shop-1': {
    4: { v: 1, start: now - DAY, end: now + DAY + 5 * HOUR, startingBid: 12, reserve: 30, buyNow: 80, extendMinutes: 5 },
    6: { v: 1, start: now + 3 * HOUR, end: now + 4 * DAY, startingBid: 5, extendMinutes: 5 },
    8: { v: 1, start: now - 5 * DAY, end: now - DAY, startingBid: 10, extendMinutes: 5 },
  },
  // The signed-in seller's own, ended, with an absurd bid to void.
  'my-shop': { 9: { v: 1, start: now - 5 * DAY, end: now - DAY, startingBid: 10, extendMinutes: 5 } },
};
// Bids (auctions/bids.ts): [shop, product, bidder, amount, created]
const BIDS = [
  ['shop-1', 4, 'Ann Buyer', 12, now - 20 * HOUR],
  ['shop-1', 4, 'bob+builder', 15, now - 10 * HOUR],
  ['shop-1', 4, 'Ann Buyer', 18.5, now - 2 * HOUR],
  ['shop-1', 8, 'Ann Buyer', 10, now - 4 * DAY],
  ['shop-1', 8, 'bob+builder', 12, now - 3 * DAY],
  ['shop-1', 8, ME, 15, now - 2 * DAY],
  ['my-shop', 9, 'Ann Buyer', 12, now - 3 * DAY],
  ['my-shop', 9, 'Troll Account', 9000000, now - 2 * DAY],
];
const RICH = {
  // As Q-Shop+ writes it: the plain description is the formatted one's text (richtext/plainText.ts).
  description: "Hand-thrown, glazed by hand\nEvery mug is one of a kind: the glaze runs its own way in the kiln.\n• Holds 350 ml\n• Food-safe glaze\nSee the rest of the set at our shop (qortal://APP/Q-Shop+/Seller%203/q-store-general-shop-3).\nVideo: Throwing the mug (qortal://VIDEO/Seller%203/q-store-video-MUGVIDEO01)\nPDF: Mug care guide (qortal://APP/Q-Share/share/Seller%203/qshare_file_care_def456_metadata)\nqortal://APP/Q-Tube/video/Video%20Maker/qtube_vid_kiln_xyz",
  htmlDescription:
    '<h2>Hand-thrown, glazed by hand</h2><p>Every mug is <strong>one of a kind</strong>: the glaze runs its own way in the kiln.</p><ul><li>Holds 350 ml</li><li>Food-safe glaze</li></ul>' +
    '<p>See the rest of the set at <a href="qortal://APP/Q-Shop+/Seller%203/q-store-general-shop-3">our shop</a>.</p>' +
    '<div class="qshop-embed" data-kind="video" data-name="Seller 3" data-identifier="q-store-video-MUGVIDEO01" data-title="Throwing the mug" data-thumb-name="Seller 3" data-thumb-identifier="q-store-thumb-MUGTHUMB01">Video: Throwing the mug</div>' +
    '<div class="qshop-embed" data-kind="file" data-name="Seller 3" data-identifier="qshare_file_care_abc123" data-title="Mug care guide" data-filename="mug-care.pdf" data-mimetype="application/pdf" data-size="48211" data-link="qortal://APP/Q-Share/share/Seller%203/qshare_file_care_def456_metadata">PDF: Mug care guide</div>' +
    '<p><a href="qortal://APP/Q-Tube/video/Video%20Maker/qtube_vid_kiln_xyz">qortal://APP/Q-Tube/video/Video%20Maker/qtube_vid_kiln_xyz</a></p>',
  morePictures: { id: 'q-store-pictures-shop-3-P000000000', count: 4, sig: '4-a-b' },
};
const USD_PRICED = [1, 3, 7, 11];
function catalogue(s, c) {
  const products = {};
  for (let p = c * 10; p < Math.min(s.products, c * 10 + 10); p++) products[productId(s, p)] = { ...product(s, p), catalogueId: catalogueId(s, c) };
  return { id: catalogueId(s, c), products };
}
// Collections (qdn/collections.ts) for the signed-in name's shop and Shop+Plus's.
function collectionsOf(s) {
  if (s.short !== 'my-shop' && s.short !== 'shop-1') return null;
  return {
    storeId: s.id,
    collections: [
      { id: 'GIFTSxxxx1', title: 'Gifts for friends', description: 'Small things that travel well.\nWrapped on request.', image: IMG2, products: [productId(s, 1), productId(s, 2), productId(s, 4)], created: now - DAY, updated: now - DAY },
      { id: 'KITCHENxx2', title: 'For the kitchen: a long collection title that wraps', description: '', image: IMG, products: [productId(s, 0), productId(s, 3), productId(s, 6), productId(s, 9)], created: now - 2 * DAY, updated: now - 2 * DAY },
      { id: 'PAPERxxxx3', title: 'Paper', description: 'Notebooks, posters and cards.', products: [productId(s, 2), productId(s, 5), productId(s, 8)], created: now - 3 * DAY, updated: now - 3 * DAY },
    ],
  };
}
function dataContainer(s) {
  const products = {};
  const catalogues = [];
  for (let p = 0; p < s.products; p++) {
    const c = Math.floor(p / 10);
    const pr = product(s, p);
    products[pr.id] = {
      created: pr.created,
      priceQort: pr.price[0].value,
      category: pr.category,
      catalogueId: catalogueId(s, c),
      status: pr.status,
      ...(pr.auction && { auction: { start: pr.auction.start, end: pr.auction.end } }),
      ...(pr.variant && { variant: { group: pr.variant.group, values: pr.variant.values } }),
    };
    if (!catalogues[c]) catalogues[c] = { id: catalogueId(s, c), products: {} };
    catalogues[c].products[pr.id] = true;
  }
  return {
    storeId: s.id,
    shortStoreId: s.short,
    owner: s.owner,
    products,
    catalogues,
    id: `${s.id}-datacontainer`,
    ...(collectionsOf(s) && { collectionsId: `q-store-collections-${s.short}` }),
    ...(s.short === 'shop-1' && { productOrder: [productId(s, 3), productId(s, 0), productId(s, 7)] }),
    ...(s.short === 'shop-2' && { variantGroups: { MUGGROUP01: { title: 'Hand-thrown mug', options: VARIANT_OPTIONS, display: 'bundle', lead: productId(s, 0) } } }),
    ...(s.short === 'my-shop' && { variantGroups: { APRONGRP01: { title: 'Linen apron', options: APRON_OPTIONS, display: 'separate', lead: productId(s, 4) } } }),
    ...(s.short === 'my-shop' && { fiatPricing: { currency: 'USD', rates: { QORT: 0.18, ARRR: 0.25 }, updated: now - DAY } }),
    // The seller arranged a few: the Products tab shows each one's place in the shop order.
    ...(s.short === 'my-shop' && { productOrder: [productId(s, 7), productId(s, 2), productId(s, 10)] }),
  };
}
const storeJson = (s) => ({
  title: s.title,
  description: s.description,
  location: 'Lisbon',
  shipsTo: 'Europe and the UK',
  created: s.created,
  shortStoreId: s.short,
  logo: s.short === 'shop-1' ? LOGO_WIDE : IMG,
  foreignCoins: s.arrr ? { ARRR: 'zs1arrrpayoutaddressxxxxxxxxxxxxxxxxxxxxxxxx' } : { ARRR: '' },
  supportedCoins: s.arrr ? ['QORT', 'ARRR'] : ['QORT'],
  // The seller's shop also takes a Q-Asset: its products, and each variant, can have a price in it.
  ...(s.short === 'my-shop' && { acceptedAssets: [{ id: 81, name: 'Gold Bar' }] }),
});

const reviews = [
  { name: 'Ann Buyer', short: 'my-shop', uid: 'REVIEWAAA1', rating: 5, title: 'Lovely mug', description: 'Arrived well packed. Would buy again.' },
  { name: 'bob+builder', short: 'my-shop', uid: 'REVIEWBBB2', rating: 3.5, title: 'Good, slow shipping', description: 'Nice product but it took three weeks.' },
  { name: 'Zoë Ålund', short: 'my-shop', uid: 'REVIEWCCC3', rating: 4, title: 'Nice', description: 'As described.' },
  { name: ME, short: 'shop-1', uid: 'REVIEWDDD4', rating: 4.5, title: 'Great gadgets', description: 'Quick delivery.' },
  // The buyer's review of the shop they marked delivered: the order offers View review.
  { name: ME, short: 'shop-2', uid: 'REVIEWEEE5', rating: 5, title: 'Beautiful bowls', description: 'Each one a little different, all lovely. Packed in straw.' },
];

const orderJson = (shop, buyer, lines, extra = {}) => {
  const details = { totalPrice: 0 };
  let total = 0;
  for (const [p, qty] of lines) {
    const pr = { ...product(shop, p), catalogueId: catalogueId(shop, Math.floor(p / 10)) };
    const unit = pr.price[0].value;
    details[pr.id] = { product: pr, catalogueId: pr.catalogueId, quantity: qty, pricePerUnit: unit, totalProductPrice: unit * qty };
    total += unit * qty;
  }
  details.totalPrice = total.toFixed(8);
  return {
    created: now - DAY,
    version: 1,
    details,
    storeName: shop.title,
    sellerName: shop.owner,
    delivery: {
      customerName: buyer,
      shippingAddress: { streetAddress: '1 Long Street', city: 'Porto', region: 'Norte', country: 'Portugal', zipCode: '4000-001', deliveryNote: 'Ring twice' },
    },
    payment: { total: total.toFixed(8), currency: 'QORT', transactionSignature: 'SIGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', arrrAddressUsed: '' },
    communicationMethod: ['Q-Mail'],
    ...extra,
  };
};
// Orders: [identifier, buyer (publisher), json, created]
const orders = [
  [`q-store-order-shop-1-ORDERBUY01`, ME, orderJson(shops[1], ME, [[1, 2], [2, 1]]), now - DAY],
  [`q-store-order-shop-2-ORDERBUY02`, ME, orderJson(shops[2], ME, [[0, 1]]), now - 4 * DAY],
  [`q-store-order-my-shop-ORDERSEL01`, 'Ann Buyer', orderJson(shops[0], 'Ann Buyer', [[0, 1], [3, 2]]), now - 2 * 3600_000],
  [`q-store-order-my-shop-ORDERSEL02`, 'bob+builder', orderJson(shops[0], 'bob+builder', [[4, 1]]), now - 2 * DAY],
  [`q-store-order-my-shop-ORDERSEL03`, 'Zoë Ålund', orderJson(shops[0], 'Zoë Ålund', [[6, 3]]), now - 9 * DAY],
];
const statuses = [
  [`q-store-status-order-shop-1-ORDERBUY01`, 'Shop+Plus', { status: 'Shipped', note: 'Tracking number 123 456' }],
  [`q-store-status-order-my-shop-ORDERSEL02`, ME, { status: 'Shipped', note: '' }],
  [`q-store-status-order-my-shop-ORDERSEL03`, ME, { status: 'Refunded', note: 'Out of stock, refunded' }],
  [`q-store-status-order-shop-2-ORDERBUY02`, 'Zoë Ålund', { status: 'Shipped', note: 'Posted with tracking' }],
];
// Buyers' "it arrived" (orders/delivered.ts): [identifier, buyer (publisher), created].
const delivered = [
  [`q-store-delivered-shop-2-ORDERBUY02`, ME, now - 2 * DAY],
  [`q-store-delivered-my-shop-ORDERSEL02`, 'bob+builder', now - DAY],
];

function rows() {
  const out = [];
  for (const s of shops) {
    out.push({ name: s.owner, service: 'STORE', identifier: s.id, created: s.created, updated: s.updated, size: 3000, metadata: { title: s.title, description: `**coins:QORTtrue,ARRR${s.arrr}**${s.description}` } });
    out.push({ name: s.owner, service: 'DOCUMENT', identifier: `${s.id}-datacontainer`, created: s.created, updated: s.updated + 1000, size: 150 + 120 * s.products });
    for (let c = 0; c * 10 < s.products; c++) out.push({ name: s.owner, service: 'DOCUMENT', identifier: catalogueId(s, c), created: s.created, updated: s.updated, size: 40000 });
    if (DELIVERY[s.short]) out.push({ name: s.owner, service: 'DOCUMENT', identifier: `q-store-delivery-${s.short}`, created: now - DAY, updated: now - DAY, size: 600 });
  }
  reviews.forEach((r, i) => out.push({ name: r.name, service: 'DOCUMENT', identifier: `q-store-review-${r.short}-${r.uid}-${r.rating * 10}`, created: now - i * DAY, updated: now - i * DAY, size: 200, metadata: { title: r.title, description: r.description } }));
  for (const [identifier, name, , created] of orders) out.push({ name, service: 'DOCUMENT_PRIVATE', identifier, created, updated: created, size: 900 });
  statuses.forEach(([identifier, name], i) => out.push({ name, service: 'DOCUMENT_PRIVATE', identifier, created: now - i * 3600_000, updated: now - i * 3600_000, size: 300 }));
  for (const [identifier, name, created] of delivered) out.push({ name, service: 'DOCUMENT', identifier, created, updated: created, size: 60, metadata: { title: 'Delivered' } });
  out.push({ name: 'Gold Issuer', service: 'IMAGE', identifier: 'asset81_Gold Bar_aavatar', created: now - DAY, updated: now - DAY, size: 2000 });
  FAVORITES.forEach(([name, i, p], n) => {
    const s = shops[i];
    const owner = `fav:${encodeURIComponent(s.owner)}`;
    const created = now - n * HOUR;
    if (p === null) out.push({ name, service: 'DOCUMENT', identifier: `q-store-favs-${s.short}`, created, updated: created, size: 150, metadata: { title: 'Favourite shop', description: owner } });
    else out.push({ name, service: 'DOCUMENT', identifier: `q-store-favp-${s.short}-P${String(p).padStart(9, '0')}`, created, updated: created, size: 200, metadata: { title: 'Favourite product', description: `${owner};cat:${encodeURIComponent(catalogueId(s, 0))}` } });
  });
  BIDS.forEach(([short, p, name, amount, created], i) => {
    const seller = shops.find((x) => x.short === short).owner;
    out.push({ name, service: 'DOCUMENT', identifier: `q-store-bid-${short}-P${String(p).padStart(9, '0')}-BID${String(i).padStart(3, '0')}`, created, updated: created, size: 150, metadata: { title: 'Bid', description: `bid:${amount};to:${encodeURIComponent(seller)}` } });
  });
  return out;
}

function search(sp) {
  const service = sp.get('service');
  const identifier = sp.get('identifier');
  const query = (sp.get('query') || '').toLowerCase();
  const names = sp.getAll('name');
  const prefix = sp.get('prefix') === 'true';
  const withMeta = sp.get('includemetadata') === 'true';
  let list = rows().filter((r) => !service || r.service === service);
  if (identifier) list = list.filter((r) => (prefix ? r.identifier.startsWith(identifier) : r.identifier === identifier));
  if (query) list = list.filter((r) => [r.identifier, r.name, r.metadata?.title, r.metadata?.description].some((v) => String(v || '').toLowerCase().includes(query)));
  if (names.length) list = list.filter((r) => names.includes(r.name));
  list.sort((a, b) => a.created - b.created);
  if (sp.get('reverse') === 'true') list.reverse();
  const offset = Number(sp.get('offset') || 0);
  const limit = Number(sp.get('limit') || 20) || 20;
  return list.slice(offset, offset + limit).map((r) => (withMeta ? r : { ...r, metadata: undefined }));
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64');
const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

export default {
  name: 'Q-Shop+',
  themeKey: 'qshopplus-ui-theme',
  dismiss: ['I understand'],

  async setup({ browser }) {
    const gen = await browser.newPage({ viewport: { width: 160, height: 160 } });
    await gen.setContent('<div style="width:160px;height:160px;background:linear-gradient(135deg,#f59e0b,#3b82f6)"></div>');
    PNG = await gen.screenshot({ clip: { x: 0, y: 0, width: 160, height: 160 } });
    IMG = `data:image/png;base64,${PNG.toString('base64')}`;
    await gen.setContent('<div style="width:160px;height:160px;background:linear-gradient(45deg,#10b981,#6366f1)"></div>');
    IMG2 = `data:image/png;base64,${(await gen.screenshot({ clip: { x: 0, y: 0, width: 160, height: 160 } })).toString('base64')}`;
    await gen.setContent('<div style="width:160px;height:160px;display:grid;place-items:center"><div style="width:110px;height:120px;border-radius:24px 24px 16px 16px;background:linear-gradient(#cbd5e1 0 22%,#facc15 22%)"></div></div>');
    CUTOUT = `data:image/png;base64,${(await gen.screenshot({ clip: { x: 0, y: 0, width: 160, height: 160 }, omitBackground: true })).toString('base64')}`;
    await gen.setContent('<div style="font:16px sans-serif;padding:24px"><h1 style="font-size:28px">Mug care guide</h1><p>Wash by hand in warm water. The glaze is food safe and dishwasher safe up to 60 °C.</p><ul><li>No microwave for the gold rim</li><li>Dry upside down</li></ul></div>');
    PDF = await gen.pdf({ width: '420px', height: '595px', printBackground: true });
    await gen.setViewportSize({ width: 400, height: 160 });
    await gen.setContent('<div style="width:400px;height:160px;display:flex;align-items:center;gap:16px;font:800 64px sans-serif;color:#f59e0b"><div style="width:120px;height:120px;background:#3b82f6;transform:rotate(45deg) scale(.7)"></div>SHOP 1</div>');
    LOGO_WIDE = `data:image/png;base64,${(await gen.screenshot({ clip: { x: 0, y: 0, width: 400, height: 160 }, omitBackground: true })).toString('base64')}`;
    await gen.close();
  },

  // The welcome notice accepted (localforage db "q-blog-general", key general-consent), a
  // cart with items from two shops, and a paid order still to record.
  initScripts: () => [
    `try {
      ['q-blog-general'].forEach(function (dbName) {
        var req = indexedDB.open(dbName, 2);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains('keyvaluepairs')) db.createObjectStore('keyvaluepairs');
          if (!db.objectStoreNames.contains('local-forage-detect-blob-support')) db.createObjectStore('local-forage-detect-blob-support');
        };
        req.onsuccess = function () {
          var db = req.result;
          try { db.transaction('keyvaluepairs', 'readwrite').objectStore('keyvaluepairs').put(true, 'general-consent'); } catch (e) {}
          db.close();
        };
      });
    } catch (e) {}`,
    `try {
      if (!sessionStorage.getItem('qsp-seeded')) {
        sessionStorage.setItem('qsp-seeded', '1');
        // A shop hidden on this device (discovery/hiddenShops.ts), for Settings' list.
        localStorage.setItem('qshopplus-hidden-shops', JSON.stringify([{ owner: 'Seller 13', shortStoreId: 'shop-13', title: 'Knitting Club', at: ${now} }]));
        localStorage.setItem('qshopplus-cart', JSON.stringify(${JSON.stringify({
          'q-store-general-shop-1': { orders: { [productId(shops[1], 1)]: { productId: productId(shops[1], 1), catalogueId: catalogueId(shops[1], 0), quantity: 2 }, [productId(shops[1], 3)]: { productId: productId(shops[1], 3), catalogueId: catalogueId(shops[1], 0), quantity: 1 } }, lastUpdated: now, storeId: 'q-store-general-shop-1', storeOwner: 'Shop+Plus' },
          'q-store-general-shop-3': { orders: { [productId(shops[3], 2)]: { productId: productId(shops[3], 2), catalogueId: catalogueId(shops[3], 0), quantity: 1 } }, lastUpdated: now - 1000, storeId: 'q-store-general-shop-3', storeOwner: 'Seller 3' },
        })}));
      }
    } catch (e) {}`,
  ],

  // Runs in the page: defines window.__qplusAnswer(request). Every write is declined.
  qortal: () => `
    const catalogues = ${JSON.stringify(Object.fromEntries(shops.flatMap((s) => Array.from({ length: Math.ceil(s.products / 10) }, (_, c) => [`${s.owner}|${catalogueId(s, c)}`, catalogue(s, c)]))))};
    const encrypted = ${JSON.stringify(Object.fromEntries([...orders.map(([id, name, j]) => [`${name}|${id}`, b64(j)]), ...statuses.map(([id, name, j]) => [`${name}|${id}`, b64(j)])]))};
    window.__qplusAnswer = async (p) => {
      switch (p.action) {
        case 'GET_USER_ACCOUNT': return { address: '${ME_ADDRESS}', publicKey: 'SellerPublicKey' };
        case 'GET_ACCOUNT_NAMES': return [{ name: '${ME}', owner: '${ME_ADDRESS}' }, { name: 'Zoë Ålund', owner: '${ME_ADDRESS}' }];
        case 'GET_PRIMARY_NAME': return '${ME}';
        case 'GET_QDN_RESOURCE_URL': return '/arbitrary/' + p.service + '/' + encodeURIComponent(p.name) + '/' + p.identifier;
        case 'FETCH_QDN_RESOURCE': {
          const key = p.name + '|' + p.identifier;
          if (catalogues[key]) return catalogues[key];
          if (encrypted[key]) return 'ENC|' + key;
          throw { error: 1401, message: 'Data unavailable' };
        }
        case 'DECRYPT_DATA': {
          const key = String(p.encryptedData).replace(/^ENC\\|/, '');
          if (encrypted[key]) return encrypted[key];
          throw { error: 'Unable to decrypt' };
        }
        case 'GET_NAME_DATA': return { name: p.name, owner: 'Q' + String(p.name).replace(/[^A-Za-z0-9]/g, '') + 'Address' };
        case 'GET_ACCOUNT_DATA': return { address: p.address, publicKey: String(p.address) + 'PublicKey' };
        case 'GET_LIST_ITEMS': return ['spammer'];
        case 'LIST_QDN_RESOURCES': return { resources: [] };
        case 'GET_USER_WALLET': return { address: 'zs1mywalletaddressxxxxxxxxxxxxxxxxxxxxxxxxxxxx' };
        case 'PUBLISH_QDN_RESOURCE': case 'PUBLISH_MULTIPLE_QDN_RESOURCES': case 'SEND_COIN': case 'TRANSFER_ASSET': case 'ADD_LIST_ITEMS': case 'DELETE_LIST_ITEM':
          throw { error: 'User declined request' };
        default: return null;
      }
    };
  `,

  async route(route, url) {
    const p = decodeURIComponent(url.pathname);
    const sp = url.searchParams;
    if (p.endsWith('/arbitrary/resources/search')) return json(route, search(sp)).then(() => true);
    if (p === '/names/primary/QOwner') return json(route, { name: 'Gold Issuer', owner: 'QOwner' }).then(() => true);
    // A name's address (the auction's chain check, auctions/confirm.ts): as GET_NAME_DATA answers below.
    const named = p.match(/^\/names\/([^/]+)$/);
    if (named) return json(route, { name: named[1], owner: 'Q' + named[1].replace(/[^A-Za-z0-9]/g, '') + 'Address' }).then(() => true);
    if (p.startsWith('/crosschain/price/')) return route.fulfill({ status: 200, contentType: 'text/plain', body: '25000000' }).then(() => true);
    if (p.startsWith('/transactions/')) return json(route, []).then(() => true);
    if (p.startsWith('/assets')) return json(route, p.includes('/info') ? { assetId: 81, name: 'Gold Bar', owner: 'QOwner', quantity: 1000, isDivisible: true, isUnspendable: false } : [{ assetId: 0, name: 'QORT', description: 'QORTAL coin', isDivisible: true }, { assetId: 81, name: 'Gold Bar', description: 'A test asset', isDivisible: true }, { assetId: 82, name: 'Silver', description: '', isDivisible: true }, { assetId: 83, name: 'Gold Seats', description: 'Whole seats only', isDivisible: false }, { assetId: 84, name: 'Golden Locked', description: '', isDivisible: true, isUnspendable: true }]).then(() => true);
    // Videos and files in descriptions: on the node at once.
    if (p.startsWith('/arbitrary/resource/status/')) return json(route, { status: 'READY', percentLoaded: 100 }).then(() => true);
    const m = p.match(/^\/arbitrary\/([A-Z_]+)\/([^/]+)\/([^/]+)$/);
    if (m) {
      const [, service, name, id] = m;
      if (service === 'FILE' && name === 'Seller 3' && id === 'qshare_file_care_abc123') return route.fulfill({ status: 200, contentType: 'application/pdf', body: PDF }).then(() => true);
      if (service === 'DOCUMENT' && name === 'Seller 3' && id === 'q-store-pictures-shop-3-P000000000') return json(route, { productId: 'q-store-product-shop-3-P000000000', images: [IMG, IMG2, IMG, IMG2] }).then(() => true);
      if (service === 'DOCUMENT' && name === 'Video Maker' && id === 'qtube_vid_kiln_xyz') return json(route, { title: 'Inside the kiln', videoReference: { name: 'Video Maker', identifier: 'qtube_vid_kiln_xyz_v', service: 'VIDEO' } }).then(() => true);
      if (service === 'THUMBNAIL') return route.fulfill({ status: 200, contentType: 'image/png', body: PNG }).then(() => true);
      if (service === 'IMAGE' && id === 'asset81_Gold Bar_aavatar' && name === 'Gold Issuer') return route.fulfill({ status: 200, contentType: 'image/png', body: PNG }).then(() => true);
      if (service === 'DOCUMENT' && id.startsWith('q-store-delivery-')) {
        const owned = shops.find((s) => s.owner === name && id === `q-store-delivery-${s.short}`);
        if (owned && DELIVERY[owned.short]) return json(route, DELIVERY[owned.short]).then(() => true);
      }
      if (service === 'DOCUMENT' && id.startsWith('q-store-collections-')) {
        const owned = shops.find((s) => s.owner === name && id === `q-store-collections-${s.short}`);
        const doc = owned && collectionsOf(owned);
        if (doc) return json(route, doc).then(() => true);
      }
      // A shop its owner deleted: the tombstones Q-Shop+ writes (docs/apps/Q-Shop+.md → Data contract).
      if (name === 'Gone Seller' && id === 'q-store-general-gone') return json(route, { deleted: true, title: 'Deleted shop' }).then(() => true);
      if (name === 'Gone Seller' && id === 'q-store-general-gone-datacontainer') return json(route, { storeId: 'q-store-general-gone', shortStoreId: 'gone', owner: 'Gone Seller', products: {}, deleted: true }).then(() => true);
      const shop = shops.find((s) => s.owner === name && (id === s.id || id === `${s.id}-datacontainer` || id.startsWith(`q-store-catalogue-${s.short}-`)));
      if (service === 'STORE' && shop) return json(route, storeJson(shop)).then(() => true);
      if (service === 'DOCUMENT' && shop && id.endsWith('-datacontainer')) return json(route, dataContainer(shop)).then(() => true);
      if (service === 'DOCUMENT' && shop && id.startsWith('q-store-catalogue-')) {
        const c = Number(id.slice(-7));
        return json(route, catalogue(shop, c)).then(() => true);
      }
      const review = reviews.find((r) => r.name === name && id.startsWith(`q-store-review-${r.short}-${r.uid}`));
      if (review) return json(route, { title: review.title, description: review.description, rating: review.rating, created: now }).then(() => true);
      return json(route, { error: 1401, message: 'Data unavailable' }, 404).then(() => true);
    }
    return false;
  },

  // overlay: a sheet, dialog or menu is open, so capture the viewport, not the full page.
  screens: [
    { key: 'home', path: '/', after: async (page) => page.waitForSelector('a[href*="q-store-general-"]', { timeout: 8000 }).catch(() => {}) },
    { key: 'shop-variants', path: `/${encodeURIComponent('Zoë Ålund')}/q-store-general-shop-2`, after: async (page) => { await page.getByText('4 options').waitFor({ timeout: 8000 }); await page.waitForTimeout(500); } },
    { key: 'product-variants', path: `/${encodeURIComponent('Zoë Ålund')}/q-store-general-shop-2/${productId(shops[2], 1)}/${catalogueId(shops[2], 0)}`, after: async (page) => { await page.getByRole('region', { name: 'Variants' }).waitFor({ timeout: 8000 }); await page.waitForTimeout(500); } },
    { key: 'seller-add-variants', path: `/product-manager/q-store-general-my-shop?tab=products`, overlay: true, after: async (page) => {
      await page.getByRole('button', { name: 'Add product' }).click({ timeout: 8000 });
      const d = page.getByRole('dialog', { name: 'Add product' });
      await d.getByRole('textbox', { name: /^Title/ }).fill('Linen apron');
      await d.getByRole('switch', { name: /It comes in variants/ }).click({ timeout: 4000 });
      await d.getByRole('textbox', { name: 'Variant 1', exact: true }).fill('Round');
      const values = d.getByRole('textbox', { name: 'Round: add values' });
      await values.fill('Pale, Orange, Red');
      await values.press('Enter');
      await d.getByRole('button', { name: 'Add another variant' }).click();
      await d.getByRole('textbox', { name: 'Variant 2', exact: true }).fill('Square');
      const sizes = d.getByRole('textbox', { name: 'Square: add values' });
      await sizes.fill('Pale');
      await sizes.press('Enter');
      await d.getByRole('list', { name: 'Items' }).scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    } },
    { key: 'seller-edit-variants', path: `/product-manager/q-store-general-my-shop?tab=products`, overlay: true, after: async (page) => {
      await page.getByRole('searchbox', { name: 'Search your products' }).fill('apron', { timeout: 8000 });
      await page.getByRole('button', { name: /^Edit\b.*Linen apron — Small \/ Indigo\b/ }).click({ timeout: 10000 });
      const d = page.getByRole('dialog', { name: 'Edit product' });
      await d.getByRole('list', { name: 'Items' }).scrollIntoViewIfNeeded({ timeout: 10000 });
      await page.waitForTimeout(400);
    } },
    { key: 'seller-edit-variants-removed', path: `/product-manager/q-store-general-my-shop?tab=products`, overlay: true, after: async (page) => {
      await page.getByRole('searchbox', { name: 'Search your products' }).fill('apron', { timeout: 8000 });
      await page.getByRole('button', { name: /^Edit\b.*Linen apron — Large \/ Natural\b/ }).click({ timeout: 10000 });
      const d = page.getByRole('dialog', { name: 'Edit product' });
      await d.getByRole('button', { name: 'Remove Indigo' }).click({ timeout: 10000 });
      await d.getByRole('switch', { name: 'In stock: Large / Natural' }).click();
      await d.getByText(/^Taken out:/).scrollIntoViewIfNeeded({ timeout: 4000 });
      await page.waitForTimeout(400);
    } },
    { key: 'seller-product-form-wide', path: `/product-manager/q-store-general-my-shop?tab=products`, overlay: true, after: async (page) => { await page.getByRole('button', { name: 'Add product' }).click({ timeout: 8000 }); await page.getByRole('dialog', { name: 'Add product' }).waitFor({ timeout: 4000 }); await page.waitForTimeout(500); } },
    { key: 'favorites', path: '/favorites', after: async (page) => { await page.getByRole('list', { name: 'Favourite shops' }).getByRole('heading').first().waitFor({ timeout: 8000 }); await page.waitForTimeout(600); } },
    { key: 'favorites-products', path: '/favorites?tab=products', after: async (page) => { await page.getByRole('list', { name: 'Favourite products' }).getByRole('link').first().waitFor({ timeout: 8000 }); await page.waitForTimeout(600); } },
    { key: 'home-favorites', path: '/?sort=favorites', after: async (page) => page.waitForTimeout(1200) },
    { key: 'shop-card-menu', path: '/', overlay: true, after: async (page) => { await page.getByRole('button', { name: 'More for Plus Gadgets' }).click({ timeout: 8000 }); await page.waitForTimeout(500); } },
    { key: 'product-favorite', path: `/${encodeURIComponent('Shop+Plus')}/q-store-general-shop-1/${productId(shops[1], 3)}/${catalogueId(shops[1], 0)}`, after: async (page) => { await page.getByRole('button', { name: 'In your favourites' }).waitFor({ timeout: 8000 }); await page.waitForTimeout(400); } },
    { key: 'home-search', path: '/?q=shop', after: async (page) => page.waitForTimeout(800) },
    { key: 'home-filters', path: '/', mobileOnly: true, overlay: true, optional: true, after: async (page) => { await page.getByRole('button', { name: /filter|sort/i }).first().click({ timeout: 2500 }); await page.waitForTimeout(400); } },
    { key: 'products', path: '/products', after: async (page) => page.waitForTimeout(900) },
    { key: 'products-categories', path: '/products', overlay: true, optional: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: /^(Categories|Filters)/ }).first().click({ timeout: 2500 }); await page.getByRole('checkbox').first().waitFor({ timeout: 4000 }); await page.waitForTimeout(600); } },
    { key: 'products-chosen', path: `/products?category=${encodeURIComponent('collectibles & art')}&category=paper&sort=price-asc`, after: async (page) => page.waitForTimeout(900) },
    { key: 'shop', path: `/${encodeURIComponent('Shop+Plus')}/q-store-general-shop-1`, after: async (page) => page.waitForTimeout(900) },
    // The buyer has an order here not marked delivered yet: the reviews ask them to mark it first.
    { key: 'shop-reviews-buyer', path: `/${encodeURIComponent('Shop+Plus')}/q-store-general-shop-1`, overlay: true, after: async (page) => {
      await page.getByRole('button', { name: /Open reviews$/ }).click({ timeout: 8000 });
      await page.getByText(/mark it delivered \(or received\) in My orders/).waitFor({ timeout: 8000 });
      await page.waitForTimeout(400);
    } },
    { key: 'shop-own', path: `/${encodeURIComponent(ME)}/q-store-general-my-shop`, after: async (page) => page.waitForTimeout(900) },
    // Opened from far down the shop page: the product page starts at its top.
    { key: 'product-from-list', path: `/${encodeURIComponent('Shop+Plus')}/q-store-general-shop-1`, after: async (page) => {
      await page.waitForTimeout(900);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      const card = page.locator('ul li a[href*="q-store-product-"]').last();
      await card.click({ timeout: 8000 });
      await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 8000 });
      await page.waitForTimeout(800);
    } },
    { key: 'product', path: `/${encodeURIComponent('Seller 3')}/q-store-general-shop-3/${productId(shops[3], 0)}/${catalogueId(shops[3], 0)}`, after: async (page) => page.waitForTimeout(900) },
    { key: 'product-pdf', path: `/${encodeURIComponent('Seller 3')}/q-store-general-shop-3/${productId(shops[3], 0)}/${catalogueId(shops[3], 0)}`, overlay: true, after: async (page) => { await page.getByRole('button', { name: 'Preview Mug care guide' }).click({ timeout: 8000 }); await page.getByText(/^Page 1 of/).waitFor({ state: 'attached', timeout: 20000 }); await page.waitForTimeout(1000); } },
    { key: 'product-pdf-smart', path: `/${encodeURIComponent('Seller 3')}/q-store-general-shop-3/${productId(shops[3], 0)}/${catalogueId(shops[3], 0)}`, overlay: true, after: async (page) => { await page.getByRole('button', { name: 'Preview Mug care guide' }).click({ timeout: 8000 }); await page.getByText(/^Page 1 of/).waitFor({ state: 'attached', timeout: 20000 }); await page.getByRole('button', { name: 'Smart' }).click({ timeout: 4000 }); await page.waitForTimeout(1200); } },
    { key: 'product-pdf-full', path: `/${encodeURIComponent('Seller 3')}/q-store-general-shop-3/${productId(shops[3], 0)}/${catalogueId(shops[3], 0)}`, overlay: true, after: async (page) => { await page.getByRole('button', { name: 'Preview Mug care guide' }).click({ timeout: 8000 }); await page.getByText(/^Page 1 of/).waitFor({ state: 'attached', timeout: 20000 }); await page.getByRole('button', { name: 'Full screen' }).click({ timeout: 4000 }); await page.waitForTimeout(1200); } },
    { key: 'product-zoom', path: `/${encodeURIComponent('Seller 3')}/q-store-general-shop-3/${productId(shops[3], 0)}/${catalogueId(shops[3], 0)}`, overlay: true, after: async (page) => { await page.getByRole('group', { name: 'Pictures' }).getByRole('button').nth(5).waitFor({ timeout: 8000 }); await page.getByRole('button', { name: /^Open picture 1 of/ }).click({ timeout: 4000 }); const d = page.getByRole('dialog'); await d.getByRole('button', { name: 'Zoom in' }).click(); await d.getByRole('button', { name: 'Zoom in' }).click(); await page.waitForTimeout(500); } },
    { key: 'product-collections', path: `/${encodeURIComponent('Shop+Plus')}/q-store-general-shop-1/${productId(shops[1], 2)}/${catalogueId(shops[1], 0)}`, after: async (page) => { await page.getByRole('navigation', { name: 'Collections' }).waitFor({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(400); } },
    { key: 'cart', path: '/cart', after: async (page) => page.waitForTimeout(900) },
    { key: 'checkout', path: '/cart', overlay: true, optional: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: 'Check out Plus Gadgets', exact: true }).click({ timeout: 2500 }); await page.waitForTimeout(500); } },
    { key: 'checkout-delivery', path: '/cart', overlay: true, after: async (page) => {
      await page.getByRole('button', { name: 'Check out Plus Gadgets', exact: true }).click({ timeout: 8000 });
      const d = page.getByRole('dialog');
      await d.getByRole('button', { name: 'Continue' }).click({ timeout: 6000 });
      await d.getByLabel(/Customer name/).fill('Ann Buyer', { timeout: 6000 });
      await d.getByLabel(/Street address/).fill('1 Rua das Flores');
      await d.getByLabel(/^City/).fill('Porto');
      const country = d.getByRole('combobox', { name: /Country/ });
      await country.fill('Portugal');
      await page.getByRole('option', { name: 'Portugal', exact: true }).click({ timeout: 4000 });
      await d.getByLabel(/Region/).fill('Norte');
      await d.getByLabel(/Zip code/).fill('4000-001');
      await d.getByRole('button', { name: 'Continue' }).click();
      await d.getByText(/^Delivery to Portugal/).waitFor({ timeout: 6000 });
      await page.waitForTimeout(400);
    } },
    { key: 'checkout-all', path: '/cart', overlay: true, after: async (page) => { await page.getByRole('button', { name: 'Check out all 2 shops' }).click({ timeout: 8000 }); await page.getByRole('dialog', { name: 'Check out 2 shops' }).waitFor({ timeout: 4000 }); await page.waitForTimeout(400); } },
    { key: 'product-auction', path: `/${encodeURIComponent('Shop+Plus')}/q-store-general-shop-1/${productId(shops[1], 4)}/${catalogueId(shops[1], 0)}`, after: async (page) => { await page.getByText('3 bids').waitFor({ timeout: 8000 }); await page.waitForTimeout(400); } },
    { key: 'product-auction-won', path: `/${encodeURIComponent('Shop+Plus')}/q-store-general-shop-1/${productId(shops[1], 8)}/${catalogueId(shops[1], 0)}`, after: async (page) => { await page.getByText(/^You won!/).waitFor({ timeout: 8000 }); await page.waitForTimeout(400); } },
    { key: 'shop-auctions', path: `/${encodeURIComponent('Shop+Plus')}/q-store-general-shop-1`, after: async (page) => { await page.getByRole('button', { name: 'Auctions (2)' }).click({ timeout: 8000 }); await page.waitForTimeout(700); } },
    { key: 'seller-auction-edit', path: `/product-manager/q-store-general-my-shop?tab=products`, overlay: true, after: async (page) => { await page.waitForTimeout(700); await page.mouse.wheel(0, 700); await page.waitForTimeout(900); await page.getByRole('button', { name: /^Edit\b.*Ebook 9\b/ }).click({ timeout: 10000 }); const d = page.getByRole('dialog', { name: 'Edit product' }); await d.getByRole('checkbox', { name: /^Void: Troll Account/ }).scrollIntoViewIfNeeded({ timeout: 10000 }); await page.waitForTimeout(400); } },
    { key: 'seller-product-auction', path: `/product-manager/q-store-general-my-shop?tab=products`, overlay: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('searchbox', { name: 'Search your products' }).fill('Lamp 11', { timeout: 8000 }); await page.getByRole('button', { name: /^Edit\b.*Lamp 11\b/ }).click({ timeout: 10000 }); const d = page.getByRole('dialog', { name: 'Edit product' }); await d.getByRole('button', { name: 'Auction', exact: true }).click({ timeout: 10000 }); await d.getByRole('textbox', { name: /^Starting bid/ }).scrollIntoViewIfNeeded({ timeout: 4000 }); await page.waitForTimeout(400); } },
    { key: 'orders', path: '/my-orders', after: async (page) => page.waitForTimeout(900) },
    { key: 'order-mark-delivered', path: '/my-orders', overlay: true, after: async (page) => {
      await page.getByRole('list', { name: 'Your orders' }).getByRole('button', { name: /Arrived\?|Got it\?/ }).click({ timeout: 8000 });
      await page.getByRole('dialog').getByRole('button', { name: /^Mark as (delivered|received)$/ }).scrollIntoViewIfNeeded({ timeout: 8000 });
      await page.waitForTimeout(400);
    } },
    { key: 'order-delivered-review', path: '/my-orders', overlay: true, after: async (page) => {
      await page.getByRole('list', { name: 'Your orders' }).getByRole('button', { name: /Ålund Ceramics/ }).click({ timeout: 8000 });
      await page.getByRole('dialog').getByRole('button', { name: 'View review' }).scrollIntoViewIfNeeded({ timeout: 8000 });
      await page.waitForTimeout(400);
    } },
    { key: 'order-review-view', path: '/my-orders', overlay: true, after: async (page) => {
      await page.getByRole('list', { name: 'Your orders' }).getByRole('button', { name: /Ålund Ceramics/ }).click({ timeout: 8000 });
      await page.getByRole('dialog').getByRole('button', { name: 'View review' }).click({ timeout: 8000 });
      await page.getByRole('dialog', { name: /^Your review of/ }).waitFor({ timeout: 8000 });
      await page.waitForTimeout(400);
    } },
    { key: 'seller', path: `/product-manager/q-store-general-my-shop`, after: async (page) => page.waitForTimeout(900) },
    { key: 'seller-activity', path: `/product-manager/q-store-general-my-shop`, after: async (page) => { await page.getByRole('list', { name: 'Recent activity' }).waitFor({ timeout: 8000 }); await page.getByRole('heading', { name: 'Recent activity' }).scrollIntoViewIfNeeded({ timeout: 4000 }); await page.waitForTimeout(700); } },
    { key: 'seller-order-review', path: `/product-manager/q-store-general-my-shop?tab=orders`, overlay: true, after: async (page) => {
      await page.waitForTimeout(700);
      await page.getByRole('button', { name: /^All · / }).click({ timeout: 8000 });
      await page.getByRole('list', { name: 'Orders received' }).getByRole('button', { name: /bob\+builder/ }).first().click({ timeout: 8000 });
      await page.getByRole('dialog').getByRole('button', { name: 'View review' }).scrollIntoViewIfNeeded({ timeout: 8000 });
      await page.waitForTimeout(400);
    } },
    { key: 'seller-orders', path: `/product-manager/q-store-general-my-shop`, optional: true, after: async (page) => { await page.waitForTimeout(600); await page.getByRole('tab', { name: /orders/i }).first().click({ timeout: 2500 }); await page.waitForTimeout(700); } },
    { key: 'seller-products', path: `/product-manager/q-store-general-my-shop`, optional: true, after: async (page) => { await page.waitForTimeout(600); await page.getByRole('tab', { name: /products/i }).first().click({ timeout: 2500 }); await page.waitForTimeout(700); } },
    { key: 'seller-select', path: `/product-manager/q-store-general-my-shop?tab=products`, optional: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: 'Select', exact: true }).click({ timeout: 2500 }); await page.getByRole('checkbox').first().click({ timeout: 2500 }); await page.waitForTimeout(300); } },
    { key: 'seller-delete-products', path: `/product-manager/q-store-general-my-shop?tab=products`, overlay: true, optional: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: 'Select', exact: true }).click({ timeout: 2500 }); await page.getByRole('button', { name: 'Select all' }).click({ timeout: 2500 }); await page.getByRole('button', { name: 'Delete', exact: true }).click({ timeout: 2500 }); await page.waitForTimeout(500); } },
    { key: 'seller-delete-shop', path: `/product-manager/q-store-general-my-shop?tab=shop`, overlay: true, optional: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: 'Delete shop' }).click({ timeout: 2500 }); await page.waitForTimeout(500); } },
    { key: 'shop-collection', path: `/${encodeURIComponent('Shop+Plus')}/q-store-general-shop-1?collection=GIFTSxxxx1`, after: async (page) => page.waitForTimeout(900) },
    { key: 'shop-grid', path: `/${encodeURIComponent('Shop+Plus')}/q-store-general-shop-1`, optional: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: 'Grid', exact: true }).click({ timeout: 2500 }); await page.waitForTimeout(500); } },
    { key: 'shop-list', path: `/${encodeURIComponent('Shop+Plus')}/q-store-general-shop-1`, optional: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: 'List', exact: true }).click({ timeout: 2500 }); await page.waitForTimeout(500); } },
    { key: 'seller-collections', path: `/product-manager/q-store-general-my-shop?tab=collections`, after: async (page) => page.waitForTimeout(900) },
    { key: 'seller-collection-editor', path: `/product-manager/q-store-general-my-shop?tab=collections`, overlay: true, optional: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: 'Edit: Gifts for friends', exact: true }).click({ timeout: 2500 }); await page.waitForTimeout(700); } },
    { key: 'seller-collection-arrange', path: `/product-manager/q-store-general-my-shop?tab=collections`, overlay: true, optional: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: 'Edit: Gifts for friends', exact: true }).click({ timeout: 2500 }); await page.getByRole('dialog', { name: 'Edit collection' }).getByRole('button', { name: 'Arrange' }).click({ timeout: 4000 }); await page.getByRole('dialog', { name: 'Arrange this collection' }).waitFor({ timeout: 4000 }); await page.waitForTimeout(700); } },
    { key: 'seller-arrange', path: `/product-manager/q-store-general-my-shop?tab=products`, overlay: true, optional: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: 'Arrange', exact: true }).click({ timeout: 2500 }); await page.getByRole('dialog', { name: 'Arrange your shop' }).waitFor({ timeout: 4000 }); await page.waitForTimeout(900); } },
    { key: 'seller-pricing', path: `/product-manager/q-store-general-my-shop?tab=shop`, overlay: true, optional: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: 'Change rates and prices' }).click({ timeout: 2500 }); await page.getByRole('dialog', { name: 'Prices in USD' }).waitFor({ timeout: 4000 }); await page.waitForTimeout(1200); } },
    { key: 'seller-category-search', path: `/product-manager/q-store-general-my-shop?tab=products`, overlay: true, optional: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: 'Add product' }).click({ timeout: 2500 }); const dialog = page.getByRole('dialog', { name: 'Add product' }); await dialog.getByRole('textbox', { name: /^Title/ }).fill('Blue Light Blocking Glasses | Night'); const box = dialog.getByRole('combobox', { name: /^Category/ }); await box.scrollIntoViewIfNeeded({ timeout: 4000 }); await box.click(); await box.fill('glasses'); await page.getByRole('listbox').waitFor({ timeout: 4000 }); await page.waitForTimeout(500); } },
    { key: 'shop-sort-menu', path: `/${encodeURIComponent('Shop+Plus')}/q-store-general-shop-1`, overlay: true, optional: true, after: async (page) => { await page.waitForTimeout(800); await page.getByRole('combobox', { name: /^Sort/ }).click({ timeout: 2500 }); await page.getByRole('listbox').waitFor({ timeout: 3000 }); await page.waitForTimeout(400); } },
    { key: 'seller-currency-menu', path: `/product-manager/q-store-general-my-shop?tab=shop`, overlay: true, optional: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: 'Change rates and prices' }).click({ timeout: 2500 }); await page.getByRole('dialog', { name: 'Prices in USD' }).getByRole('combobox', { name: /^Currency/ }).click({ timeout: 4000 }); await page.getByRole('listbox').waitFor({ timeout: 3000 }); await page.waitForTimeout(400); } },
    { key: 'seller-reviews', path: `/product-manager/q-store-general-my-shop?tab=reviews`, after: async (page) => page.waitForTimeout(900) },
    { key: 'seller-shop', path: `/product-manager/q-store-general-my-shop?tab=shop`, after: async (page) => page.waitForTimeout(900) },
    { key: 'quick-rate', path: `/product-manager/q-store-general-my-shop`, overlay: true, after: async (page) => { await page.getByRole('button', { name: /^QORT rate:/ }).click({ timeout: 8000 }); const d = page.getByRole('dialog', { name: 'QORT rate' }); await d.getByText(/products? (is|are) priced in USD/).waitFor({ timeout: 8000 }); await d.getByLabel(/1 QORT is worth/).fill('0.2'); await page.waitForTimeout(400); } },
    { key: 'seller-delivery', path: `/product-manager/q-store-general-my-shop?tab=delivery`, after: async (page) => { await page.getByRole('region', { name: 'Shipping profile: Heavy items' }).waitFor({ timeout: 8000 }); await page.waitForTimeout(400); } },
    { key: 'seller-delivery-zone', path: `/product-manager/q-store-general-my-shop?tab=delivery`, overlay: true, after: async (page) => { await page.getByRole('button', { name: 'Edit zone: North America' }).click({ timeout: 8000 }); await page.getByRole('dialog', { name: 'Edit delivery zone' }).waitFor({ timeout: 4000 }); await page.waitForTimeout(400); } },
    { key: 'seller-delivery-new-zone', path: `/product-manager/q-store-general-my-shop?tab=delivery`, overlay: true, after: async (page) => { await page.getByRole('region', { name: 'Shipping profile: General' }).getByRole('button', { name: 'Add a zone' }).click({ timeout: 8000 }); const d = page.getByRole('dialog', { name: 'New delivery zone' }); await d.getByRole('button', { name: 'USA: the United States, every state' }).click({ timeout: 4000 }); await d.getByLabel(/^First item/).fill('12'); await d.getByLabel(/^Free delivery from/).fill('120'); await d.getByLabel(/^Each extra item/).scrollIntoViewIfNeeded(); await page.waitForTimeout(400); } },
    { key: 'seller-delivery-products', path: `/product-manager/q-store-general-my-shop?tab=delivery`, overlay: true, after: async (page) => { await page.getByRole('region', { name: 'Shipping profile: Heavy items' }).getByRole('button', { name: 'Choose products' }).click({ timeout: 8000 }); await page.getByRole('dialog', { name: 'Products in Heavy items' }).getByRole('checkbox').first().waitFor({ timeout: 6000 }); await page.waitForTimeout(700); } },
    // Assets 82–84 have no picture on the mock node: each falls back to another (a 404 is how Core says so).
    { key: 'seller-asset-suggest', path: `/product-manager/q-store-general-my-shop?tab=shop`, overlay: true, optional: true, expectErrors: /404|Failed to load resource/, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: 'Edit payments' }).click({ timeout: 2500 }); const box = page.getByRole('combobox', { name: /Asset name or id/ }); await box.scrollIntoViewIfNeeded({ timeout: 4000 }); await box.fill('gold'); await page.getByRole('listbox').waitFor({ timeout: 4000 }); await page.waitForTimeout(500); } },
    { key: 'shop-deleted', path: `/${encodeURIComponent('Gone Seller')}/q-store-general-gone`, after: async (page) => page.waitForTimeout(900) },
    { key: 'seller-product-form', path: `/product-manager/q-store-general-my-shop?tab=products`, overlay: true, optional: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: /^Edit\b.*Lamp 11\b/ }).click({ timeout: 2500 }); await page.getByRole('dialog', { name: 'Edit product' }).getByRole('button', { name: 'Delete' }).waitFor({ timeout: 4000 }); await page.waitForTimeout(500); } },
    { key: 'seller-add-video', path: `/product-manager/q-store-general-my-shop?tab=products`, overlay: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: /^Edit\b.*Lamp 11\b/ }).click({ timeout: 10000 }); await page.getByRole('dialog', { name: 'Edit product' }).getByRole('button', { name: 'Add a video' }).click({ timeout: 10000 }); await page.getByRole('dialog', { name: 'Add a video' }).waitFor({ timeout: 4000 }); await page.waitForTimeout(400); } },
    { key: 'seller-add-file', path: `/product-manager/q-store-general-my-shop?tab=products`, overlay: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: /^Edit\b.*Lamp 11\b/ }).click({ timeout: 10000 }); await page.getByRole('dialog', { name: 'Edit product' }).getByRole('button', { name: 'Add a file or PDF' }).click({ timeout: 10000 }); const d = page.getByRole('dialog', { name: 'Add a file' }); await d.getByRole('tab', { name: 'Upload a PDF' }).click({ timeout: 4000 }); await page.waitForTimeout(400); } },
    { key: 'seller-edit-shop', path: `/product-manager/q-store-general-my-shop?tab=shop`, overlay: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: 'Edit shop' }).first().click({ timeout: 4000 }); const box = page.getByRole('dialog', { name: 'Edit shop' }).getByRole('textbox', { name: /^Meta description/ }); await box.scrollIntoViewIfNeeded({ timeout: 4000 }); await box.fill('Hand-thrown mugs and plates from Lisbon.'); await page.waitForTimeout(400); } },
    { key: 'seller-ships-to-us', path: `/product-manager/q-store-general-my-shop?tab=shop`, overlay: true, after: async (page) => { await page.waitForTimeout(700); await page.getByRole('button', { name: 'Edit shop' }).first().click({ timeout: 4000 }); const d = page.getByRole('dialog', { name: 'Edit shop' }); await d.getByRole('button', { name: 'USA: the United States, every state' }).click({ timeout: 6000 }); const us = d.getByRole('region', { name: 'Within the United States' }); await us.getByRole('button', { name: 'Lower 48 and DC' }).click(); await us.getByRole('button', { name: 'Choose states' }).click(); await us.getByRole('checkbox', { name: 'Texas' }).click(); await us.evaluate((el) => el.scrollIntoView({ block: 'start' })); await page.waitForTimeout(400); } },
    { key: 'settings', path: '/settings' },
    { key: 'account-menu', path: '/', overlay: true, optional: true, after: async (page) => { await page.getByRole('button', { name: /account/i }).first().click({ timeout: 2500 }); await page.waitForTimeout(400); } },
    { key: 'not-found', path: `/${encodeURIComponent('Nobody')}/q-store-general-missing`, after: async (page) => page.waitForTimeout(900), expectErrors: /404|Failed to load resource/ },
  ],
};
