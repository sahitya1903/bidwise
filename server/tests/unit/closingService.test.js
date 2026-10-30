const { activateDue, closeExpired, runOnce } = require('../../src/services/closingService');
const { placeBid } = require('../../src/services/biddingService');
const Auction = require('../../src/models/Auction');
const closer = require('../../src/jobs/auctionCloser');
const { makeAuction } = require('../helpers');

const MIN = 60 * 1000;
const later = (ms) => new Date(Date.now() + ms);

describe('closingService (BR-08 decision table, state transitions)', () => {
  test('TC-31 (R1): expired auction with no bids → UNSOLD, no winner', async () => {
    const { auction } = await makeAuction({ endsInMs: MIN });
    const result = await closeExpired(later(2 * MIN));
    expect(result).toEqual({ sold: 0, unsold: 1 });
    const after = await Auction.findById(auction.id);
    expect(after).toMatchObject({ status: 'UNSOLD', winner: null, finalPrice: null });
  });

  test('TC-32 (R2): top bid ₹2,000 below reserve ₹2,500 → UNSOLD', async () => {
    const { auction, bob } = await makeAuction({
      startingPrice: 100000,
      reservePrice: 250000,
      endsInMs: MIN,
    });
    await placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 200000 });
    await closeExpired(later(2 * MIN));
    const after = await Auction.findById(auction.id);
    expect(after.status).toBe('UNSOLD');
    expect(after.winner).toBeNull();
  });

  test('TC-33 (R3): top bid ₹2,600 meets reserve ₹2,500 → SOLD with winner and final price', async () => {
    const { auction, bob } = await makeAuction({
      startingPrice: 100000,
      reservePrice: 250000,
      endsInMs: MIN,
    });
    await placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 260000 });
    await closeExpired(later(2 * MIN));
    const after = await Auction.findById(auction.id);
    expect(after).toMatchObject({ status: 'SOLD', finalPrice: 260000 });
    expect(after.winner.equals(bob._id)).toBe(true);
  });

  test('no reserve: any bid sells', async () => {
    const { auction, bob } = await makeAuction({ startingPrice: 100, minIncrement: 100, endsInMs: MIN });
    await placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 100 });
    await closeExpired(later(2 * MIN));
    expect((await Auction.findById(auction.id)).status).toBe('SOLD');
  });

  test('TC-34: SCHEDULED auction becomes ACTIVE when its start time passes', async () => {
    const { auction } = await makeAuction({ startsInMs: 10 * MIN });
    expect(auction.status).toBe('SCHEDULED');
    expect(await activateDue(later(5 * MIN))).toBe(0);
    expect(await activateDue(later(11 * MIN))).toBe(1);
    expect((await Auction.findById(auction.id)).status).toBe('ACTIVE');
  });

  test('TC-35: running closeExpired twice changes nothing the second time', async () => {
    const { auction, bob } = await makeAuction({ endsInMs: MIN });
    await placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 100000 });
    const t = later(2 * MIN);
    expect(await closeExpired(t)).toEqual({ sold: 1, unsold: 0 });
    const first = await Auction.findById(auction.id);
    expect(await closeExpired(t)).toEqual({ sold: 0, unsold: 0 });
    const second = await Auction.findById(auction.id);
    expect(second.toObject()).toEqual(first.toObject());
  });

  test('auctions that have not ended and cancelled auctions are left alone', async () => {
    const running = await makeAuction({ endsInMs: 10 * MIN });
    const cancelled = await makeAuction({ endsInMs: MIN });
    await Auction.updateOne({ _id: cancelled.auction._id }, { status: 'CANCELLED' });
    await closeExpired(later(2 * MIN));
    expect((await Auction.findById(running.auction.id)).status).toBe('ACTIVE');
    expect((await Auction.findById(cancelled.auction.id)).status).toBe('CANCELLED');
  });

  test('runOnce activates then closes, and the job tick calls it safely', async () => {
    await makeAuction({ endsInMs: MIN });
    expect(await runOnce(later(2 * MIN))).toEqual({ activated: 0, sold: 0, unsold: 1 });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await makeAuction({ endsInMs: MIN });
    await Auction.updateMany({ status: 'ACTIVE' }, { endTime: new Date(Date.now() - 1000) });
    await closer.tick();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('[closer]'));
    log.mockRestore();
  });
});
