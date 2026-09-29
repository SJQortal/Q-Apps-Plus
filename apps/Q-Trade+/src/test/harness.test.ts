import { describe, expect, it } from 'vitest';
import {
  fetchCallsFor,
  mockFetchRoute,
  mockQortalRequest,
  openSockets,
  qortalCallsFor,
} from './setup';

describe('test harness', () => {
  it('answers qortalRequest by action and records the call', async () => {
    mockQortalRequest('GET_FOREIGN_FEE', 1000);
    await expect(
      qortalRequest({ action: 'GET_FOREIGN_FEE', coin: 'ltc', type: 'feerequired' })
    ).resolves.toBe(1000);
    expect(qortalCallsFor('GET_FOREIGN_FEE')).toEqual([
      { action: 'GET_FOREIGN_FEE', coin: 'ltc', type: 'feerequired' },
    ]);
  });

  it('routes qortalRequestWithTimeout through the same handlers', async () => {
    mockQortalRequest('GET_FOREIGN_FEE', (req) => `${String(req.coin)}:${String(req.type)}`);
    await expect(
      qortalRequestWithTimeout({ action: 'GET_FOREIGN_FEE', coin: 'doge', type: 'feekb' }, 1800000)
    ).resolves.toBe('doge:feekb');
  });

  it('rejects unregistered actions, so a test can never trade, sign, send or spend', async () => {
    for (const action of [
      'CREATE_TRADE_BUY_ORDER',
      'CREATE_TRADE_SELL_ORDER',
      'CANCEL_TRADE_SELL_ORDER',
      'UPDATE_FOREIGN_FEE',
      'SIGN_FOREIGN_FEES',
      'SEND_COIN',
    ]) {
      await expect(qortalRequestWithTimeout({ action }, 1000)).rejects.toThrow(/no handler/);
    }
  });

  it('serves relative Core fetches from routes', async () => {
    mockFetchRoute('/crosschain/tradeoffers', [{ qortalAtAddress: 'AT1', qortAmount: '5' }]);
    const res = await fetch('/crosschain/tradeoffers?foreignBlockchain=LITECOIN');
    await expect(res.json()).resolves.toEqual([{ qortalAtAddress: 'AT1', qortAmount: '5' }]);
    expect(fetchCallsFor('/crosschain/tradeoffers')).toEqual([
      '/crosschain/tradeoffers?foreignBlockchain=LITECOIN',
    ]);
    const missing = await fetch('/crosschain/nothing');
    expect(missing.status).toBe(404);
  });

  it('stubs WebSockets so nothing connects, and lets a test push messages', () => {
    const socket = new WebSocket('ws://localhost/websockets/crosschain/tradepresence');
    const received: string[] = [];
    socket.onmessage = (event) => received.push(event.data);
    expect(openSockets).toHaveLength(1);
    openSockets[0].emit([{ tradeAddress: 'x', timestamp: 1 }]);
    expect(received).toEqual(['[{"tradeAddress":"x","timestamp":1}]']);
  });

  it('gives every test a fresh IndexedDB', async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('tradeDB', 3);
      req.onupgradeneeded = () => req.result.createObjectStore('transactions', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(Array.from(db.objectStoreNames)).toEqual(['transactions']);
    db.close();
  });
});
