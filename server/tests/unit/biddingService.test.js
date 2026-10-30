const { placeBid, getBidHistory, getUserBids, bidStatusFor } = require('../../src/services/biddingService');
const auctionService = require('../../src/services/auctionService');
const Auction = require('../../src/models/Auction');
const Bid = require('../../src/models/Bid');
const { makeAuction } = require('../helpers');

describe('biddingService.placeBid (BR-03 … BR-07)', () => {
  test('TC-19: first bid equal to the starting price (₹1,000) is accepted', async () => {
    const { auction, bob } = await makeAuction({ startingPrice: 100000 });
    const { auction: updated, bid } = await placeBid({
      auctionId: auction.id,
      bidderId: bob._id,
      amount: 100000,
    });
    expect(updated.currentBid).toBe(100000);
    expect(updated.bidCount).toBe(1);
    expect(updated.highestBidder.equals(bob._id)).toBe(true);
    expect(bid.amount).toBe(100000);
  });

  test('TC-20: first bid of ₹999.99 → 409 BID_TOO_LOW, minAllowed ₹1,000', async () => {
    const { auction, bob } = await makeAuction({ startingPrice: 100000 });
    await expect(placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 99999 })).rejects.toMatchObject(
      {
        status: 409,
        code: 'BID_TOO_LOW',
        details: { minAllowed: 100000 },
        message: 'Minimum bid is ₹1,000',
      }
    );
  });

  test('TC-21: current ₹1,000 + increment ₹100 → bid of ₹1,100 is accepted', async () => {
    const { auction, bob, carol } = await makeAuction({ startingPrice: 100000, minIncrement: 10000 });
    await placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 100000 });
    const { auction: updated } = await placeBid({
      auctionId: auction.id,
      bidderId: carol._id,
      amount: 110000,
    });
    expect(updated.currentBid).toBe(110000);
  });

  test('TC-22: bid one paisa below the minimum (₹1,099.99) is rejected', async () => {
    const { auction, bob, carol } = await makeAuction({ startingPrice: 100000, minIncrement: 10000 });
    await placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 100000 });
    await expect(
      placeBid({ auctionId: auction.id, bidderId: carol._id, amount: 109999 })
    ).rejects.toMatchObject({
      code: 'BID_TOO_LOW',
      message: 'Minimum bid is ₹1,100',
    });
  });

  test('TC-23: seller bids on own auction → 403 OWN_AUCTION', async () => {
    const { auction, alice } = await makeAuction();
    await expect(
      placeBid({ auctionId: auction.id, bidderId: alice._id, amount: 100000 })
    ).rejects.toMatchObject({
      status: 403,
      code: 'OWN_AUCTION',
    });
  });

  test('TC-24: highest bidder bids again → 409 ALREADY_HIGHEST_BIDDER', async () => {
    const { auction, bob } = await makeAuction();
    await placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 100000 });
    await expect(
      placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 200000 })
    ).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_HIGHEST_BIDDER',
    });
  });

  test('TC-25: bid 1 second after the end time (before the job runs) → 409 AUCTION_NOT_ACTIVE', async () => {
    const { auction, bob } = await makeAuction({ endsInMs: 60 * 1000 });
    const oneSecondLate = new Date(auction.endTime.getTime() + 1000);
    expect((await Auction.findById(auction.id)).status).toBe('ACTIVE');
    await expect(
      placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 100000, now: oneSecondLate })
    ).rejects.toMatchObject({ status: 409, code: 'AUCTION_NOT_ACTIVE' });
  });

  test('TC-26: bid on a CANCELLED auction → 409 AUCTION_NOT_ACTIVE', async () => {
    const { auction, alice, bob } = await makeAuction();
    await auctionService.cancel({ auctionId: auction.id, user: alice });
    await expect(
      placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 100000 })
    ).rejects.toMatchObject({
      status: 409,
      code: 'AUCTION_NOT_ACTIVE',
    });
  });

  test('bids on SCHEDULED or SOLD auctions are rejected (state transitions)', async () => {
    const scheduled = await makeAuction({ startsInMs: 60 * 60 * 1000 });
    await expect(
      placeBid({ auctionId: scheduled.auction.id, bidderId: scheduled.bob._id, amount: 100000 })
    ).rejects.toMatchObject({ code: 'AUCTION_NOT_ACTIVE' });
    const sold = await makeAuction();
    await Auction.updateOne({ _id: sold.auction._id }, { status: 'SOLD' });
    await expect(
      placeBid({ auctionId: sold.auction.id, bidderId: sold.bob._id, amount: 100000 })
    ).rejects.toMatchObject({
      code: 'AUCTION_NOT_ACTIVE',
    });
  });

  test('invalid amounts and unknown auctions are rejected', async () => {
    const { auction, bob } = await makeAuction();
    await expect(placeBid({ auctionId: auction.id, bidderId: bob._id, amount: -5 })).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      placeBid({ auctionId: auction.id, bidderId: bob._id, amount: '1000' })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 1000.5 })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      placeBid({ auctionId: '64b000000000000000000000', bidderId: bob._id, amount: 100000 })
    ).rejects.toMatchObject({ status: 404 });
  });

  test('TC-29: two users bid the same valid amount at the same moment → exactly one wins', async () => {
    const { auction, bob, carol } = await makeAuction({ startingPrice: 100000 });
    const results = await Promise.allSettled([
      placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 120000 }),
      placeBid({ auctionId: auction.id, bidderId: carol._id, amount: 120000 }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toMatchObject({ status: 409 });
    expect(['OUTBID_RETRY', 'BID_TOO_LOW']).toContain(failed[0].reason.code);
    const after = await Auction.findById(auction.id);
    expect(after.bidCount).toBe(1);
    expect(await Bid.countDocuments({ auction: auction._id })).toBe(1);
  });

  test('TC-29b: ten simultaneous bids → one wins, state stays consistent', async () => {
    const { auction, alice } = await makeAuction({ startingPrice: 100000 });
    const { makeUser } = require('../helpers');
    const bidders = await Promise.all(Array.from({ length: 10 }, () => makeUser()));
    const results = await Promise.allSettled(
      bidders.map((b) => placeBid({ auctionId: auction.id, bidderId: b._id, amount: 150000 }))
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const after = await Auction.findById(auction.id);
    expect(after.bidCount).toBe(1);
    expect(after.seller.equals(alice._id)).toBe(true);
  });

  test('OUTBID_RETRY reports the new minimum when another bid was saved first', async () => {
    const { auction, bob, carol } = await makeAuction({ startingPrice: 100000, minIncrement: 10000 });
    // Simulate a bid landing between our read and our write.
    const realFind = Auction.findById.bind(Auction);
    const spy = jest.spyOn(Auction, 'findById').mockImplementationOnce(async (id) => {
      const snapshot = await realFind(id);
      await Auction.updateOne(
        { _id: id },
        { $set: { currentBid: 100000, highestBidder: carol._id }, $inc: { bidCount: 1 } }
      );
      return snapshot;
    });
    await expect(
      placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 100000 })
    ).rejects.toMatchObject({
      code: 'OUTBID_RETRY',
      details: { minAllowed: 110000 },
      message: 'You were outbid — new minimum is ₹1,100',
    });
    spy.mockRestore();
  });

  test('BR-10: bids cannot be edited or deleted through the model', async () => {
    const { auction, bob } = await makeAuction();
    const { bid } = await placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 100000 });
    await expect(Bid.updateOne({ _id: bid._id }, { amount: 1 })).rejects.toThrow(/immutable/);
    await expect(Bid.deleteOne({ _id: bid._id })).rejects.toThrow(/immutable/);
    await expect(bid.deleteOne()).rejects.toThrow(/immutable/);
    expect((await Bid.findById(bid._id)).amount).toBe(100000);
  });
});

describe('bid history and my bids', () => {
  test('getBidHistory returns bids highest first with names only', async () => {
    const { auction, bob, carol } = await makeAuction({ startingPrice: 100000, minIncrement: 10000 });
    await placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 100000 });
    await placeBid({ auctionId: auction.id, bidderId: carol._id, amount: 120000 });
    const history = await getBidHistory(auction.id);
    expect(history.map((b) => b.amount)).toEqual([120000, 100000]);
    expect(history[0].bidder).toEqual({ id: carol._id.toString(), name: carol.name });
    await expect(getBidHistory('bad-id')).rejects.toMatchObject({ status: 404 });
  });

  test('getUserBids groups by auction and labels WINNING / OUTBID', async () => {
    const { auction, bob, carol } = await makeAuction({ startingPrice: 100000, minIncrement: 10000 });
    await placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 100000 });
    await placeBid({ auctionId: auction.id, bidderId: carol._id, amount: 110000 });
    await placeBid({ auctionId: auction.id, bidderId: bob._id, amount: 130000 });
    const [bobRow] = await getUserBids(bob._id);
    expect(bobRow).toMatchObject({ myHighestBid: 130000, myBidCount: 2, bidStatus: 'WINNING' });
    const [carolRow] = await getUserBids(carol._id);
    expect(carolRow.bidStatus).toBe('OUTBID');
  });

  test('bidStatusFor covers every auction state', () => {
    const me = '64b000000000000000000001';
    const other = '64b000000000000000000002';
    expect(bidStatusFor({ status: 'ACTIVE', highestBidder: me }, me)).toBe('WINNING');
    expect(bidStatusFor({ status: 'ACTIVE', highestBidder: other }, me)).toBe('OUTBID');
    expect(bidStatusFor({ status: 'SOLD', winner: { _id: me } }, me)).toBe('WON');
    expect(bidStatusFor({ status: 'SOLD', winner: other }, me)).toBe('LOST');
    expect(bidStatusFor({ status: 'UNSOLD' }, me)).toBe('LOST');
    expect(bidStatusFor({ status: 'CANCELLED' }, me)).toBe('CANCELLED');
  });
});
