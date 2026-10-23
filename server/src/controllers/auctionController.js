const auctionService = require('../services/auctionService');

const view = (req) => (auction) => auction.toPublicJSON({ viewerId: req.user?._id });

async function list(req, res) {
  const { q, category, status, sort, page, limit } = req.query;
  const result = await auctionService.list({ q, category, status, sort, page, limit });
  res.json({ ...result, items: result.items.map(view(req)) });
}

async function getById(req, res) {
  const auction = await auctionService.getById(req.params.id);
  res.json({ auction: view(req)(auction) });
}

async function create(req, res) {
  const created = await auctionService.create({ sellerId: req.user._id, data: req.body });
  const auction = await auctionService.getById(created._id);
  res.status(201).json({ auction: view(req)(auction) });
}

async function update(req, res) {
  await auctionService.update({ auctionId: req.params.id, userId: req.user._id, data: req.body });
  const auction = await auctionService.getById(req.params.id);
  res.json({ auction: view(req)(auction) });
}

async function cancel(req, res) {
  await auctionService.cancel({ auctionId: req.params.id, user: req.user });
  const auction = await auctionService.getById(req.params.id);
  res.json({ auction: view(req)(auction) });
}

async function myListings(req, res) {
  const auctions = await auctionService.listBySeller(req.user._id);
  res.json({ items: auctions.map(view(req)) });
}

module.exports = { list, getById, create, update, cancel, myListings };
