#!/usr/bin/env node
/**
 * Builds the standard test world on the private testnet (dev-only):
 * registered names, and five MINTER-like groups, each closed, PCT40, delays
 * 5 and 60 blocks, owner handed to the null account:
 *
 *   main   9 admin rows (8 + the null owner), 4 signatures needed: nominations,
 *          signatures, joins, guards, bulk sign, Hub timeouts and declines
 *   ops    6 rows, 3 needed: kicks, bans, lifting bans, admin changes, invites
 *   shift  13 rows, 6 needed: the admin-count trap (a removal lowers it to 5)
 *   reject 7 rows, 3 needed: Reject, Withdraw, Considering
 *   rules  5 rows, 2 needed: who may propose admin changes
 *
 *   node testnet/setup.mjs
 */
import { height } from './lib/node.mjs';
import { makeGroup, readWorld, registerNames } from './lib/world.mjs';

import { GROUPS, nameFor, range } from './lib/groups.mjs';

const labels = [
  ...range('admin', 1, 30),
  ...range('low', 1, 6),
  ...range('nom', 1, 16),
  ...range('mem', 1, 16),
];

console.log(`Height ${await height()}: registering names…`);
await registerNames(labels.map((label) => ({ label, name: nameFor(label) })));
console.log(`Height ${await height()}: making groups (each takes about four blocks; they run side by side)…`);
await Promise.all(Object.entries(GROUPS).map(([key, spec]) => makeGroup(key, spec)));
const world = readWorld();
for (const [key, g] of Object.entries(world.groups)) console.log(`${key}: group ${g.groupId} (${g.name}), owner ${g.owner}`);
console.log(`Done at height ${await height()}.`);
