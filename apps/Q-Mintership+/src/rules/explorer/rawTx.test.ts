import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../data/types';
import { NOT_SHOWN, rawForDisplay } from './rawTx';

const A = 'QSeDMkseNfi9b5K5no8aX8jqc3y78vuxr7';
const base = { timestamp: 1, signature: 'sig', txGroupId: 0 };

describe('rawForDisplay', () => {
  it('leaves out what a message says', () => {
    const tx: TxRow = { ...base, type: 'MESSAGE', data: 'hello there', isText: true };
    expect(rawForDisplay(tx)).toMatchObject({ data: NOT_SHOWN, isText: true });
    expect(JSON.stringify(rawForDisplay({ ...tx, type: 'CHAT' }))).not.toContain('hello');
  });

  it('leaves out what identifies an encrypted resource, keeping the rest', () => {
    const tx: TxRow = {
      ...base,
      type: 'ARBITRARY',
      service: 1901,
      name: 'Avery Two',
      identifier: 'qortal_qmail_x',
      data: 'hash',
      secret: 'key',
    };
    const shown = rawForDisplay(tx);
    expect(shown).toMatchObject({
      identifier: NOT_SHOWN,
      data: NOT_SHOWN,
      secret: NOT_SHOWN,
      name: 'Avery Two',
      service: 1901,
    });
    expect(rawForDisplay({ ...tx, service: 1000 })).toMatchObject({ identifier: 'qortal_qmail_x' });
  });

  it('keeps everything else as Core sent it', () => {
    const tx: TxRow = { ...base, type: 'PAYMENT', amount: '1.5', recipient: A };
    expect(rawForDisplay(tx)).toEqual(tx);
  });
});
