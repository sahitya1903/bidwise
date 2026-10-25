const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const AppError = require('../utils/AppError');
const { formatINR } = require('../utils/money');
const { bidSchema, parseOrThrow } = require('../utils/validation');
const { findOrThrow } = require('./auctionService');

// FR-07 / UC-05. Checks BR-03..BR-07, then saves with a compare-and-set update:
// the write only succeeds if bidCount has not changed since we read the auction,
// so two simultaneous bids can never both succeed (NFR-02).
async function placeBid({ auctionId, bidderId, amount, now = new Date() }) {
  ({ amount } = parseOrThrow(bidSchema, { amount }));
  const auction = await findOrThrow(auctionId);

  if (!auction.isOpenAt(now)) throw new AppError(409, 'AUCTION_NOT_ACTIVE', { status: auction.status }); // BR-06
  if (auction.seller.equals(bidderId)) throw new AppError(403, 'OWN_AUCTION'); // BR-05
  if (auction.highestBidder?.equals(bidderId)) throw new AppError(409, 'ALREADY_HIGHEST_BIDDER'); // BR-07

  const minAllowed = auction.minNextBid(); // BR-03 / BR-04
  if (amount < minAllowed) {
    throw new AppError(409, 'BID_TOO_LOW', { minAllowed }, `Minimum bid is ${formatINR(minAllowed)}`);
  }

  const updated = await Auction.findOneAndUpdate(
    { _id: auction._id, status: 'ACTIVE', endTime: { $gt: now }, bidCount: auction.bidCount },
    { $set: { currentBid: amount, highestBidder: bidderId }, $inc: { bidCount: 1 } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    // Someone else's bid (or the closing job) got there first.
    const fresh = await Auction.findById(auction._id);
    if (!fresh.isOpenAt(now)) throw new AppError(409, 'AUCTION_NOT_ACTIVE', { status: fresh.status });
    const newMin = fresh.minNextBid();
    throw new AppError(
      409,
      'OUTBID_RETRY',
      { minAllowed: newMin },
      `You were outbid — new minimum is ${formatINR(newMin)}`
    );
  }

  const bid = await Bid.create({ auction: auction._id, bidder: bidderId, amount }); // BR-10
  return { auction: updated, bid };
}

// FR-04: highest first. Bidder names only, never emails.
async function getBidHistory(auctionId) {
  await findOrThrow(auctionId);
  const bids = await Bid.find({ auction: auctionId })
    .sort({ amount: -1, createdAt: 1 })
    .populate('bidder', 'name');
  return bids.map((b) => ({
    id: b._id.toString(),
    amount: b.amount,
    bidder: b.bidder ? { id: b.bidder._id.toString(), name: b.bidder.name } : null,
    createdAt: b.createdAt,
  }));
}

// FR-09: one row per auction the user bid on, with WINNING / OUTBID / WON / LOST / CANCELLED.
const idOf = (ref) => (ref ? String(ref._id ?? ref) : null);

function bidStatusFor(auction, userId) {
  const uid = String(userId);
  switch (auction.status) {
    case 'SOLD':
      return idOf(auction.winner) === uid ? 'WON' : 'LOST';
    case 'UNSOLD':
      return 'LOST';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return idOf(auction.highestBidder) === uid ? 'WINNING' : 'OUTBID';
  }
}

async function getUserBids(userId) {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const rows = await Bid.aggregate([
    { $match: { bidder: uid } },
    {
      $group: {
        _id: '$auction',
        myHighestBid: { $max: '$amount' },
        myBidCount: { $sum: 1 },
        lastBidAt: { $max: '$createdAt' },
      },
    },
    { $sort: { lastBidAt: -1 } },
  ]);
  const auctions = await Auction.find({ _id: { $in: rows.map((r) => r._id) } }).populate(
    'seller highestBidder winner',
    'name'
  );
  const byId = new Map(auctions.map((a) => [a._id.toString(), a]));
  return rows
    .filter((r) => byId.has(r._id.toString()))
    .map((r) => {
      const auction = byId.get(r._id.toString());
      return {
        auction,
        myHighestBid: r.myHighestBid,
        myBidCount: r.myBidCount,
        lastBidAt: r.lastBidAt,
        bidStatus: bidStatusFor(auction, uid),
      };
    });
}

module.exports = { placeBid, getBidHistory, getUserBids, bidStatusFor };
