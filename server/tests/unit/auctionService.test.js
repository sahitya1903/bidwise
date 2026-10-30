const auctionService = require('../../src/services/auctionService');
const { placeBid } = require('../../src/services/biddingService');
const Auction = require('../../src/models/Auction');
const { makeUser, makeAuction } = require('../helpers');

const HOUR = 60 * 60 * 1000;

function data(overrides = {}) {
  const now = Date.now();
  return {
    title: 'Vintage Camera',
    startingPrice: 100000,
    reservePrice: 0,
    minIncrement: 10000,
    startTime: new Date(now),
    endTime: new Date(now + HOUR),
    ...overrides,
  };
}

describe('auctionService.create (BR-01, BR-02)', () => {
  let seller;
  beforeEach(async () => {
    seller = await makeUser({ name: 'Alice' });
  });

  test('TC-10: starting price ₹0 is rejected (400)', async () => {
    await expect(
      auctionService.create({ sellerId: seller._id, data: data({ startingPrice: 0 }) })
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  test('TC-11: starting price ₹1 (100 paise) is the smallest valid price', async () => {
    const a = await auctionService.create({
      sellerId: seller._id,
      data: data({ startingPrice: 100, minIncrement: 100 }),
    });
    expect(a.startingPrice).toBe(100);
    expect(a.status).toBe('ACTIVE');
  });

  test('TC-12: reserve price lower than starting price is rejected (400)', async () => {
    await expect(
      auctionService.create({ sellerId: seller._id, data: data({ reservePrice: 99999 }) })
    ).rejects.toMatchObject({ status: 400, details: { fields: { reservePrice: expect.any(String) } } });
  });

  test('reserve equal to starting price is accepted', async () => {
    const a = await auctionService.create({ sellerId: seller._id, data: data({ reservePrice: 100000 }) });
    expect(a.reservePrice).toBe(100000);
  });

  test('TC-13: end time equal to or before start time is rejected (400)', async () => {
    const now = new Date();
    const start = new Date(now.getTime() + HOUR);
    for (const end of [start, new Date(start.getTime() - 1000)]) {
      await expect(
        auctionService.create({ sellerId: seller._id, now, data: data({ startTime: start, endTime: end }) })
      ).rejects.toMatchObject({
        status: 400,
        details: { fields: { endTime: 'End time must be after the start time' } },
      });
    }
  });

  test('BR-02: duration must be between 1 minute and 30 days', async () => {
    const now = new Date();
    const at = (ms) => new Date(now.getTime() + ms);
    await expect(
      auctionService.create({
        sellerId: seller._id,
        now,
        data: data({ startTime: now, endTime: at(59 * 1000) }),
      })
    ).rejects.toMatchObject({ status: 400 });
    const ok = await auctionService.create({
      sellerId: seller._id,
      now,
      data: data({ startTime: now, endTime: at(60 * 1000) }),
    });
    expect(ok.status).toBe('ACTIVE');
    await expect(
      auctionService.create({
        sellerId: seller._id,
        now,
        data: data({ startTime: now, endTime: at(30 * 24 * HOUR + 1) }),
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('TC-14: start time in the future → status SCHEDULED', async () => {
    const now = new Date();
    const a = await auctionService.create({
      sellerId: seller._id,
      now,
      data: data({ startTime: new Date(now.getTime() + HOUR), endTime: new Date(now.getTime() + 2 * HOUR) }),
    });
    expect(a.status).toBe('SCHEDULED');
  });

  test('missing start time means "start now"', async () => {
    const { startTime, ...rest } = data();
    const a = await auctionService.create({ sellerId: seller._id, data: rest });
    expect(a.status).toBe('ACTIVE');
    expect(startTime).toBeDefined();
  });

  test('non-integer prices are rejected', async () => {
    await expect(
      auctionService.create({ sellerId: seller._id, data: data({ startingPrice: 1000.5 }) })
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('auctionService.update / cancel (BR-09)', () => {
  test('TC-17: seller edits after one bid → 409 HAS_BIDS', async () => {
    const { auction, alice, bob } = await makeAuction();
    await placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 100000 });
    await expect(
      auctionService.update({ auctionId: auction.id, userId: alice._id, data: { title: 'New title' } })
    ).rejects.toMatchObject({ status: 409, code: 'HAS_BIDS' });
  });

  test('seller can edit before any bid; other users cannot', async () => {
    const { auction, alice, bob } = await makeAuction();
    const updated = await auctionService.update({
      auctionId: auction.id,
      userId: alice._id,
      data: { title: 'Better title', minIncrement: 5000 },
    });
    expect(updated).toMatchObject({ title: 'Better title', minIncrement: 5000 });
    await expect(
      auctionService.update({ auctionId: auction.id, userId: bob._id, data: { title: 'Hack' } })
    ).rejects.toMatchObject({ status: 403, code: 'NOT_OWNER' });
  });

  test('editing re-checks the business rules on the merged result', async () => {
    const { auction, alice } = await makeAuction({ startingPrice: 100000 });
    await expect(
      auctionService.update({ auctionId: auction.id, userId: alice._id, data: { reservePrice: 50000 } })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      auctionService.update({
        auctionId: auction.id,
        userId: alice._id,
        data: { endTime: new Date(Date.now() - 1000) },
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('moving a SCHEDULED auction start time to now makes it ACTIVE', async () => {
    const { auction, alice, now } = await makeAuction({ startsInMs: HOUR });
    expect(auction.status).toBe('SCHEDULED');
    const updated = await auctionService.update({
      auctionId: auction.id,
      userId: alice._id,
      now,
      data: { startTime: now },
    });
    expect(updated.status).toBe('ACTIVE');
  });

  test('a closed auction cannot be edited or cancelled', async () => {
    const { auction, alice } = await makeAuction();
    await Auction.updateOne({ _id: auction._id }, { status: 'UNSOLD' });
    await expect(
      auctionService.update({ auctionId: auction.id, userId: alice._id, data: { title: 'x y z' } })
    ).rejects.toMatchObject({ status: 409, code: 'AUCTION_CLOSED' });
    await expect(auctionService.cancel({ auctionId: auction.id, user: alice })).rejects.toMatchObject({
      status: 409,
      code: 'AUCTION_CLOSED',
    });
  });

  test('seller can cancel before bids, not after; admin can cancel after bids', async () => {
    const first = await makeAuction();
    const cancelled = await auctionService.cancel({ auctionId: first.auction.id, user: first.alice });
    expect(cancelled.status).toBe('CANCELLED');

    const second = await makeAuction();
    await placeBid({ auctionId: second.auction.id, bidderId: second.bob._id, amount: 100000 });
    await expect(
      auctionService.cancel({ auctionId: second.auction.id, user: second.alice })
    ).rejects.toMatchObject({
      status: 409,
      code: 'HAS_BIDS',
    });
    await expect(
      auctionService.cancel({ auctionId: second.auction.id, user: second.carol })
    ).rejects.toMatchObject({
      status: 403,
    });
    const admin = await makeUser({ role: 'admin' });
    const byAdmin = await auctionService.cancel({ auctionId: second.auction.id, user: admin });
    expect(byAdmin.status).toBe('CANCELLED');
  });

  test('unknown or malformed ids give 404', async () => {
    const user = await makeUser();
    await expect(auctionService.getById('nope')).rejects.toMatchObject({ status: 404 });
    await expect(auctionService.getById('64b000000000000000000000')).rejects.toMatchObject({ status: 404 });
    await expect(auctionService.cancel({ auctionId: 'nope', user })).rejects.toMatchObject({ status: 404 });
  });
});

describe('auctionService.list (FR-03)', () => {
  test('filters by keyword, category and status; paginates', async () => {
    const { alice } = await makeAuction({ title: 'Vintage Camera', category: 'Electronics' });
    await makeAuction({ seller: alice, title: 'Camera Lens', category: 'Electronics' });
    await makeAuction({ seller: alice, title: 'Oil painting', category: 'Art', description: 'not a camera' });
    await makeAuction({ seller: alice, title: 'Future camera', startsInMs: HOUR });

    const all = await auctionService.list({ q: 'camera' });
    expect(all.total).toBe(3); // matches title or description, ACTIVE only
    const elec = await auctionService.list({ q: 'camera', category: 'Electronics' });
    expect(elec.total).toBe(2);
    const scheduled = await auctionService.list({ status: 'SCHEDULED' });
    expect(scheduled.items.map((a) => a.title)).toEqual(['Future camera']);
    const paged = await auctionService.list({ limit: 2, page: 2 });
    expect(paged).toMatchObject({ page: 2, pages: 2, total: 3 });
    expect(paged.items).toHaveLength(1);
    const withSpecialChars = await auctionService.list({ q: '(.*' });
    expect(withSpecialChars.total).toBe(0);
  });

  test('ENDED shows sold and unsold; listBySeller shows every status', async () => {
    const { auction, alice } = await makeAuction();
    await makeAuction({ seller: alice });
    await Auction.updateOne({ _id: auction._id }, { status: 'SOLD' });
    expect((await auctionService.list({ status: 'ENDED' })).total).toBe(1);
    expect((await auctionService.list({ status: 'ALL', sort: 'newest' })).total).toBe(2);
    expect(await auctionService.listBySeller(alice._id)).toHaveLength(2);
  });
});

describe('Auction model helpers', () => {
  test('toPublicJSON hides the reserve price from everyone except the seller', async () => {
    const { auction, alice, bob } = await makeAuction({ reservePrice: 200000 });
    expect(auction.toPublicJSON({ viewerId: bob._id }).reservePrice).toBeUndefined();
    expect(auction.toPublicJSON({ viewerId: alice._id }).reservePrice).toBe(200000);
    expect(auction.toPublicJSON()).toMatchObject({ hasReserve: true, reserveMet: false, minNextBid: 100000 });
  });
});
