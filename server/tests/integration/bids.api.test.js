const request = require('supertest');
const app = require('../../src/app');
const { makeAuction, auth } = require('../helpers');

describe('Bids API', () => {
  test('TC-07b: placing a bid without a token → 401', async () => {
    const { auction } = await makeAuction();
    const res = await request(app).post(`/api/auctions/${auction.id}/bids`).send({ amount: 100000 });
    expect(res.status).toBe(401);
  });

  test('a valid bid → 201 with the updated auction', async () => {
    const { auction, bob } = await makeAuction({ startingPrice: 100000, minIncrement: 10000 });
    const res = await request(app)
      .post(`/api/auctions/${auction.id}/bids`)
      .set(auth(bob))
      .send({ amount: 100000 });
    expect(res.status).toBe(201);
    expect(res.body.bid.amount).toBe(100000);
    expect(res.body.auction).toMatchObject({ currentBid: 100000, bidCount: 1, minNextBid: 110000 });
    expect(res.body.auction.highestBidder.name).toBe(bob.name);
  });

  test('a bid below the minimum → 409 with the readable message and minAllowed', async () => {
    const { auction, bob, carol } = await makeAuction({ startingPrice: 100000, minIncrement: 10000 });
    await request(app).post(`/api/auctions/${auction.id}/bids`).set(auth(bob)).send({ amount: 100000 });
    const res = await request(app)
      .post(`/api/auctions/${auction.id}/bids`)
      .set(auth(carol))
      .send({ amount: 105000 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'BID_TOO_LOW', message: 'Minimum bid is ₹1,100', details: { minAllowed: 110000 } },
    });
  });

  test('seller bidding on own auction over HTTP → 403', async () => {
    const { auction, alice } = await makeAuction();
    const res = await request(app)
      .post(`/api/auctions/${auction.id}/bids`)
      .set(auth(alice))
      .send({ amount: 100000 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('OWN_AUCTION');
  });

  test('TC-27: bid on a non-existent auction id → 404', async () => {
    const { bob } = await makeAuction();
    const res = await request(app)
      .post('/api/auctions/64b000000000000000000000/bids')
      .set(auth(bob))
      .send({ amount: 100000 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('AUCTION_NOT_FOUND');
  });

  test.each([
    ['negative', { amount: -100 }],
    ['text', { amount: 'abc' }],
    ['missing', {}],
    ['a fraction of a paisa', { amount: 100.5 }],
  ])('TC-28: amount %s → 400', async (_label, payload) => {
    const { auction, bob } = await makeAuction();
    const res = await request(app).post(`/api/auctions/${auction.id}/bids`).set(auth(bob)).send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('TC-30: GET /auctions/:id/bids after 3 bids → highest first, names but no emails', async () => {
    const { auction, bob, carol } = await makeAuction({ startingPrice: 100000, minIncrement: 10000 });
    const bid = (user, amount) =>
      request(app).post(`/api/auctions/${auction.id}/bids`).set(auth(user)).send({ amount });
    await bid(bob, 100000);
    await bid(carol, 110000);
    await bid(bob, 125000);
    const res = await request(app).get(`/api/auctions/${auction.id}/bids`);
    expect(res.status).toBe(200);
    expect(res.body.bids.map((b) => b.amount)).toEqual([125000, 110000, 100000]);
    expect(res.body.bids.map((b) => b.bidder.name)).toEqual([bob.name, carol.name, bob.name]);
    expect(JSON.stringify(res.body)).not.toMatch(/@|email/);
    expect((await request(app).get('/api/auctions/64b000000000000000000000/bids')).status).toBe(404);
  });
});
