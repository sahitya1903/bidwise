const Auction = require('../models/Auction');

// SCHEDULED → ACTIVE once the start time is reached.
async function activateDue(now = new Date()) {
  const res = await Auction.updateMany(
    { status: 'SCHEDULED', startTime: { $lte: now } },
    { $set: { status: 'ACTIVE' } }
  );
  return res.modifiedCount;
}

// FR-08 / BR-08: ACTIVE → SOLD or UNSOLD once the end time is reached.
// Each update filters on status: 'ACTIVE', so running this twice is safe (NFR-07).
async function closeExpired(now = new Date()) {
  const expired = await Auction.find({ status: 'ACTIVE', endTime: { $lte: now } });
  let sold = 0;
  let unsold = 0;
  for (const a of expired) {
    const isSold = a.bidCount > 0 && a.currentBid >= a.reservePrice;
    const res = await Auction.updateOne(
      { _id: a._id, status: 'ACTIVE' },
      isSold
        ? { $set: { status: 'SOLD', winner: a.highestBidder, finalPrice: a.currentBid } }
        : { $set: { status: 'UNSOLD' } }
    );
    if (res.modifiedCount === 1) {
      if (isSold) sold += 1;
      else unsold += 1;
    }
  }
  return { sold, unsold };
}

async function runOnce(now = new Date()) {
  const activated = await activateDue(now);
  const closed = await closeExpired(now);
  return { activated, ...closed };
}

module.exports = { activateDue, closeExpired, runOnce };
