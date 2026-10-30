const request = require('supertest');
const app = require('../../src/app');
const { makeUser, makeAuction, auth } = require('../helpers');

const HOUR = 60 * 60 * 1000;
const body = (overrides = {}) => ({
  title: 'Vintage Camera',
  description: 'Rangefinder, working',
  category: 'Electronics',
  imageUrl: 'https://example.com/camera.jpg',
  startingPrice: 100000,
  reservePrice: 250000,
  minIncrement: 10000,
  endTime: new Date(Date.now() + HOUR).toISOString(),
  ...overrides,
});

describe('Auctions API', () => {
  test('TC-07: POST /auctions without a token → 401', async () => {
    const res = await request(app).post('/api/auctions').send(body());
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('TC-09: create a valid auction starting now → 201, status ACTIVE', async () => {
    const alice = await makeUser({ name: 'Alice' });
    const res = await request(app).post('/api/auctions').set(auth(alice)).send(body());
    expect(res.status).toBe(201);
    expect(res.body.auction).toMatchObject({
      title: 'Vintage Camera',
      status: 'ACTIVE',
      currentBid: 0,
      minNextBid: 100000,
      reservePrice: 250000, // the seller sees the reserve
      seller: { id: alice._id.toString(), name: 'Alice' },
    });
  });

  test('create with invalid data → 400 with a message for the field', async () => {
    const alice = await makeUser();
    const res = await request(app)
      .post('/api/auctions')
      .set(auth(alice))
      .send(body({ startingPrice: 0, imageUrl: 'not a url' }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.fields).toHaveProperty('startingPrice');
    expect(res.body.error.details.fields).toHaveProperty('imageUrl');
  });

  test('TC-15: GET /auctions?q=camera → only ACTIVE auctions matching "camera"', async () => {
    const { alice } = await makeAuction({ title: 'Vintage Camera' });
    await makeAuction({ seller: alice, title: 'Tea set' });
    await makeAuction({ seller: alice, title: 'Camera bag', startsInMs: HOUR }); // SCHEDULED
    const cancelled = await makeAuction({ seller: alice, title: 'Broken camera' });
    await request(app).post(`/api/auctions/${cancelled.auction.id}/cancel`).set(auth(alice));

    const res = await request(app).get('/api/auctions?q=camera');
    expect(res.status).toBe(200);
    expect(res.body.items.map((a) => a.title)).toEqual(['Vintage Camera']);
    expect(res.body.items.every((a) => a.status === 'ACTIVE')).toBe(true);
    expect(res.body.items[0].reservePrice).toBeUndefined(); // hidden from the public
  });

  test('GET /auctions/:id → details with minNextBid and timeLeft; 404 for unknown id', async () => {
    const { auction } = await makeAuction();
    const res = await request(app).get(`/api/auctions/${auction.id}`);
    expect(res.status).toBe(200);
    expect(res.body.auction).toMatchObject({ id: auction.id, minNextBid: 100000 });
    expect(res.body.auction.timeLeftMs).toBeGreaterThan(0);
    expect((await request(app).get('/api/auctions/64b000000000000000000000')).status).toBe(404);
    expect((await request(app).get('/api/auctions/not-an-id')).status).toBe(404);
  });

  test('TC-16: seller edits the title before any bid → 200, title changed', async () => {
    const { auction, alice, bob } = await makeAuction();
    const res = await request(app)
      .patch(`/api/auctions/${auction.id}`)
      .set(auth(alice))
      .send({ title: 'Mint camera' });
    expect(res.status).toBe(200);
    expect(res.body.auction.title).toBe('Mint camera');

    const other = await request(app)
      .patch(`/api/auctions/${auction.id}`)
      .set(auth(bob))
      .send({ title: 'Nope' });
    expect(other.status).toBe(403);
    const unknownField = await request(app)
      .patch(`/api/auctions/${auction.id}`)
      .set(auth(alice))
      .send({ status: 'SOLD' });
    expect(unknownField.status).toBe(400);
  });

  test('TC-18: admin cancels an active auction → CANCELLED; another user → 403', async () => {
    const { auction, bob, carol } = await makeAuction();
    await request(app).post(`/api/auctions/${auction.id}/bids`).set(auth(bob)).send({ amount: 100000 });
    const admin = await makeUser({ role: 'admin' });

    const denied = await request(app).post(`/api/auctions/${auction.id}/cancel`).set(auth(carol));
    expect(denied.status).toBe(403);
    const ok = await request(app).post(`/api/auctions/${auction.id}/cancel`).set(auth(admin));
    expect(ok.status).toBe(200);
    expect(ok.body.auction.status).toBe('CANCELLED');
    const again = await request(app).post(`/api/auctions/${auction.id}/cancel`).set(auth(admin));
    expect(again.status).toBe(409);
  });

  test('GET /me/auctions lists the seller’s own auctions with every status', async () => {
    const { alice } = await makeAuction();
    await makeAuction({ seller: alice, startsInMs: HOUR });
    const res = await request(app).get('/api/me/auctions').set(auth(alice));
    expect(res.status).toBe(200);
    expect(res.body.items.map((a) => a.status).sort()).toEqual(['ACTIVE', 'SCHEDULED']);
    expect(res.body.items[0].reservePrice).toBeDefined();
  });
});
