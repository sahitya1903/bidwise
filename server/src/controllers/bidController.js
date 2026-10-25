const biddingService = require('../services/biddingService');
const auctionService = require('../services/auctionService');

async function placeBid(req, res) {
  const { bid } = await biddingService.placeBid({
    auctionId: req.params.id,
    bidderId: req.user._id,
    amount: req.body.amount,
  });
  const auction = await auctionService.getById(req.params.id);
  res.status(201).json({
    bid: { id: bid._id.toString(), amount: bid.amount, createdAt: bid.createdAt },
    auction: auction.toPublicJSON({ viewerId: req.user._id }),
  });
}

async function history(req, res) {
  const bids = await biddingService.getBidHistory(req.params.id);
  res.json({ bids });
}

async function myBids(req, res) {
  const rows = await biddingService.getUserBids(req.user._id);
  res.json({
    items: rows.map((r) => ({
      auction: r.auction.toPublicJSON({ viewerId: req.user._id }),
      myHighestBid: r.myHighestBid,
      myBidCount: r.myBidCount,
      lastBidAt: r.lastBidAt,
      bidStatus: r.bidStatus,
    })),
  });
}

module.exports = { placeBid, history, myBids };
