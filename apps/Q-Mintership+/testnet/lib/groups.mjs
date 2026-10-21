/**
 * The standard MINTER-like groups of the test world (dev-only): setup.mjs
 * makes them once, and scenarios that change a group's members or admins
 * make a fresh copy of theirs for each run (scenario-helpers freshGroup).
 */
export const range = (prefix, from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(2, '0')}`);

/** Display names: mostly plain, a few with spaces and "+" to exercise encoding. */
export const SPECIAL = {
  admin01: 'Ada Admin',
  admin02: 'Ben Admin+',
  nom01: 'Nora Nominator',
  mem09: 'Jonny',
  low01: 'Lou Level4',
};
export const nameFor = (label) => SPECIAL[label] ?? `qmp ${label}`;

export const GROUPS = {
  main: {
    owner: 'admin01',
    admins: range('admin', 1, 8),
    members: [...range('nom', 1, 6), ...range('mem', 1, 4), 'low01', 'low02'],
  },
  ops: {
    owner: 'admin09',
    admins: range('admin', 9, 13),
    members: ['nom07', 'nom08', ...range('mem', 5, 8), 'low03'],
  },
  shift: {
    owner: 'admin14',
    admins: range('admin', 14, 25),
    members: ['mem09', 'mem10'],
  },
  reject: {
    owner: 'admin26',
    admins: [...range('admin', 26, 30), 'low04'],
    members: ['nom09', 'nom10', 'mem11'],
  },
  rules: {
    owner: 'admin02',
    admins: range('admin', 2, 5),
    members: ['nom11', 'nom12', 'mem12', 'low05'],
  },
};

