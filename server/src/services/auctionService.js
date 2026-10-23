const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const AppError = require('../utils/AppError');
const { createAuctionSchema, updateAuctionSchema, parseOrThrow } = require('../utils/validation');

const { STATUSES } = Auction;
const OPEN_STATUSES = ['SCHEDULED', 'ACTIVE'];
const PAGE_SIZE = 12;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function endTimeInFuture(endTime, now) {
  if (endTime <= now) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      { fields: { endTime: 'End time must be in the future' } },
      'End time must be in the future'
    );
  }
}

// FR-05. A start time in the past (or missing) means "start now".
async function create({ sellerId, data, now = new Date() }) {
  const input = { ...data };
  if (!input.startTime || new Date(input.startTime) < now) input.startTime = now;
  const parsed = parseOrThrow(createAuctionSchema, input);
  endTimeInFuture(parsed.endTime, now);
  const status = parsed.startTime <= now ? 'ACTIVE' : 'SCHEDULED';
  return Auction.create({ ...parsed, seller: sellerId, status });
}

async function findOrThrow(auctionId) {
  if (!mongoose.isValidObjectId(auctionId)) throw new AppError(404, 'AUCTION_NOT_FOUND');
  const auction = await Auction.findById(auctionId);
  if (!auction) throw new AppError(404, 'AUCTION_NOT_FOUND');
  return auction;
}

// FR-06 / BR-09: only the seller, only before the first bid, only while open.
async function update({ auctionId, userId, data, now = new Date() }) {
  const changes = parseOrThrow(updateAuctionSchema, data);
  const auction = await findOrThrow(auctionId);
  if (!auction.seller.equals(userId)) throw new AppError(403, 'NOT_OWNER');
  if (auction.isClosed()) throw new AppError(409, 'AUCTION_CLOSED');
  if (auction.bidCount > 0) throw new AppError(409, 'HAS_BIDS');

  // Once an auction is running its start time is fixed.
  if (auction.status === 'ACTIVE') delete changes.startTime;
  else if (changes.startTime && changes.startTime < now) changes.startTime = now;

  const merged = {
    title: auction.title,
    description: auction.description,
    category: auction.category,
    imageUrl: auction.imageUrl,
    startingPrice: auction.startingPrice,
    reservePrice: auction.reservePrice,
    minIncrement: auction.minIncrement,
    startTime: auction.startTime,
    endTime: auction.endTime,
    ...changes,
  };
  const valid = parseOrThrow(createAuctionSchema, merged);
  if (changes.endTime) endTimeInFuture(valid.endTime, now);
  if (auction.status === 'SCHEDULED') valid.status = valid.startTime <= now ? 'ACTIVE' : 'SCHEDULED';

  // Compare-and-set: fails if a bid arrived or the status changed since we read it.
  const updated = await Auction.findOneAndUpdate(
    { _id: auction._id, bidCount: 0, status: auction.status },
    { $set: valid },
    { returnDocument: 'after' }
  );
  if (!updated) throw new AppError(409, 'HAS_BIDS');
  return updated;
}

// FR-06 / FR-10 / BR-09
async function cancel({ auctionId, user }) {
  const auction = await findOrThrow(auctionId);
  const isAdmin = user.role === 'admin';
  const isSeller = auction.seller.equals(user._id);
  if (!isAdmin && !isSeller) throw new AppError(403, 'NOT_OWNER');
  if (auction.isClosed()) throw new AppError(409, 'AUCTION_CLOSED');
  if (!isAdmin && auction.bidCount > 0) throw new AppError(409, 'HAS_BIDS');

  const filter = { _id: auction._id, status: { $in: OPEN_STATUSES } };
  if (!isAdmin) filter.bidCount = 0;
  const updated = await Auction.findOneAndUpdate(
    filter,
    { $set: { status: 'CANCELLED' } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    const fresh = await Auction.findById(auction._id);
    throw new AppError(409, fresh.isClosed() ? 'AUCTION_CLOSED' : 'HAS_BIDS');
  }
  return updated;
}

// FR-03: browse, search by keyword, filter by category. Defaults to ACTIVE auctions.
async function list({ q, category, status, sort, page = 1, limit = PAGE_SIZE } = {}) {
  const filter = {};
  if (status === 'ENDED') filter.status = { $in: ['SOLD', 'UNSOLD'] };
  else if (status === 'ALL') filter.status = { $ne: 'CANCELLED' };
  else filter.status = STATUSES.includes(status) ? status : 'ACTIVE';
  if (category) filter.category = category;
  if (q && q.trim()) {
    const re = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ title: re }, { description: re }];
  }

  const sorts = {
    ending: { endTime: 1 },
    newest: { createdAt: -1 },
    price_asc: { currentBid: 1, startingPrice: 1 },
    price_desc: { currentBid: -1, startingPrice: -1 },
  };
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const size = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || PAGE_SIZE));

  const [items, total] = await Promise.all([
    Auction.find(filter)
      .sort({ ...(sorts[sort] || sorts.ending), _id: 1 })
      .skip((pageNum - 1) * size)
      .limit(size)
      .populate('seller highestBidder winner', 'name'),
    Auction.countDocuments(filter),
  ]);
  return { items, total, page: pageNum, pages: Math.max(1, Math.ceil(total / size)) };
}

// FR-04
async function getById(auctionId) {
  if (!mongoose.isValidObjectId(auctionId)) throw new AppError(404, 'AUCTION_NOT_FOUND');
  const auction = await Auction.findById(auctionId).populate('seller highestBidder winner', 'name');
  if (!auction) throw new AppError(404, 'AUCTION_NOT_FOUND');
  return auction;
}

// FR-09: the seller's own listings, every status, newest first.
async function listBySeller(sellerId) {
  return Auction.find({ seller: sellerId })
    .sort({ createdAt: -1 })
    .populate('seller highestBidder winner', 'name');
}

module.exports = { create, update, cancel, list, getById, listBySeller, findOrThrow };
