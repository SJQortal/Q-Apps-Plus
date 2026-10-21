/**
 * Home's first paint: the nomination cards show "n Minter Admins are
 * considering" from Considering.tsx, so it must not bring the write code
 * (the flows, the guards, HubStepDialog) along. The dialog that publishes is
 * ConsideringDialog.tsx, loaded with the Decisions pages only.
 */
import { describe, expect, it } from 'vitest';
import considering from './Considering.tsx?raw';
import dialog from './ConsideringDialog.tsx?raw';

const imports = (source: string) =>
  [...source.matchAll(/^import[^;]*?from '([^']+)';/gms)].map((m) => m[1]);

describe('Considering stays light', () => {
  it('imports no write code; the dialog does', () => {
    const light = imports(considering);
    expect(light.some((path) => path.includes('writes/'))).toBe(false);
    expect(light.some((path) => path.includes('HubStepDialog'))).toBe(false);
    expect(imports(dialog)).toEqual(
      expect.arrayContaining(['../../writes/flows', '../common/HubStepDialog'])
    );
  });
});
