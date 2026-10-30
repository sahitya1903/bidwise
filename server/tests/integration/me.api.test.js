const request = require('supertest');
const app = require('../../src/app');
const { closeExpired } = require('../../src/services/closingService');
const { makeUser, makeAuction, auth } = require('../helpers');

const MIN = 60 * 1000;

describe('My bids API', () => {
  test('TC-36: outbid on A, leading on B, won C, lost D → OUTBID, WINNING, WON, LOST', async () => {
    const seller = await makeUser({ name: 'Alice' });
    const me = await makeUser({ name: 'Me' });
    const rival = await makeUser({ name: 'Rival' });
    const bid = (user, auction, amount) =>
      request(app).post(`/api/auctions/${auction.id}/bids`).set(auth(user)).send({ amount });

    const A = (await makeAuction({ seller, title: 'Item A', endsInMs: 60 * MIN })).auction;
    const B = (await makeAuction({ seller, title: 'Item B', endsInMs: 60 * MIN })).auction;
    const C = (await makeAuction({ seller, title: 'Item C', endsInMs: MIN })).auction;
    const D = (await makeAuction({ seller, title: 'Item D', endsInMs: MIN })).auction;

    await bid(me, A, 100000);
    await bid(rival, A, 110000); // I am outbid on A
    await bid(me, B, 100000); // I lead on B
    await bid(me, C, 100000); // I will win C
    await bid(me, D, 100000);
    await bid(rival, D, 110000); // I will lose D
    await closeExpired(new Date(Date.now() + 2 * MIN)); // C and D end

    const res = await request(app).get('/api/me/bids').set(auth(me));
    expect(res.status).toBe(200);
    const byTitle = Object.fromEntries(res.body.items.map((r) => [r.auction.title, r.bidStatus]));
    expect(byTitle).toEqual({ 'Item A': 'OUTBID', 'Item B': 'WINNING', 'Item C': 'WON', 'Item D': 'LOST' });
    const rowA = res.body.items.find((r) => r.auction.title === 'Item A');
    expect(rowA).toMatchObject({ myHighestBid: 100000, myBidCount: 1 });
  });

  test('GET /me/bids without a token → 401', async () => {
    expect((await request(app).get('/api/me/bids')).status).toBe(401);
  });
});
