const mongoose = require('mongoose');

const STATUSES = ['SCHEDULED', 'ACTIVE', 'SOLD', 'UNSOLD', 'CANCELLED'];
const CLOSED_STATUSES = ['SOLD', 'UNSOLD', 'CANCELLED'];
const CATEGORIES = [
  'Electronics',
  'Collectibles',
  'Fashion',
  'Home',
  'Art',
  'Books',
  'Sports',
  'Vehicles',
  'Other',
];

const { ObjectId } = mongoose.Schema.Types;

// All prices are integers in paise.
const auctionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    category: { type: String, enum: CATEGORIES, default: 'Other' },
    imageUrl: { type: String, default: '' },
    seller: { type: ObjectId, ref: 'User', required: true },
    startingPrice: { type: Number, required: true, min: 100 },
    reservePrice: { type: Number, default: 0, min: 0 },
    minIncrement: { type: Number, required: true, min: 100 },
    currentBid: { type: Number, default: 0 },
    highestBidder: { type: ObjectId, ref: 'User', default: null },
    bidCount: { type: Number, default: 0 },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, enum: STATUSES, default: 'SCHEDULED' },
    winner: { type: ObjectId, ref: 'User', default: null },
    finalPrice: { type: Number, default: null },
  },
  { timestamps: true }
);

auctionSchema.index({ status: 1, endTime: 1 }); // closing job
auctionSchema.index({ status: 1, startTime: 1 }); // activation job
auctionSchema.index({ seller: 1, createdAt: -1 }); // My listings
// Keyword search uses a case-insensitive match on title/description (partial words work).

// BR-03 / BR-04: the smallest bid the auction will accept next.
auctionSchema.methods.minNextBid = function minNextBid() {
  return this.bidCount === 0 ? this.startingPrice : this.currentBid + this.minIncrement;
};

// BR-06: bids are accepted only while ACTIVE and before the end time.
auctionSchema.methods.isOpenAt = function isOpenAt(now = new Date()) {
  return this.status === 'ACTIVE' && now < this.endTime;
};

auctionSchema.methods.isClosed = function isClosed() {
  return CLOSED_STATUSES.includes(this.status);
};

// The reserve price is hidden from everyone except the seller.
auctionSchema.methods.toPublicJSON = function toPublicJSON({ viewerId, now = new Date() } = {}) {
  const obj = this.toObject({ virtuals: false });
  const id = obj._id.toString();
  const sellerId = obj.seller?._id ? obj.seller._id.toString() : obj.seller?.toString();
  const isSeller = viewerId && sellerId === viewerId.toString();
  const result = {
    id,
    title: obj.title,
    description: obj.description,
    category: obj.category,
    imageUrl: obj.imageUrl,
    seller: publicUser(obj.seller),
    startingPrice: obj.startingPrice,
    minIncrement: obj.minIncrement,
    currentBid: obj.currentBid,
    highestBidder: publicUser(obj.highestBidder),
    bidCount: obj.bidCount,
    startTime: obj.startTime,
    endTime: obj.endTime,
    status: obj.status,
    winner: publicUser(obj.winner),
    finalPrice: obj.finalPrice,
    hasReserve: obj.reservePrice > 0,
    reserveMet: obj.reservePrice === 0 || (obj.bidCount > 0 && obj.currentBid >= obj.reservePrice),
    minNextBid: this.minNextBid(),
    timeLeftMs: Math.max(0, new Date(obj.endTime).getTime() - now.getTime()),
    createdAt: obj.createdAt,
  };
  if (isSeller) result.reservePrice = obj.reservePrice;
  return result;
};

function publicUser(u) {
  if (!u) return null;
  if (u._id && u.name) return { id: u._id.toString(), name: u.name };
  return { id: u.toString() };
}

const Auction = mongoose.models.Auction || mongoose.model('Auction', auctionSchema);

module.exports = Auction;
module.exports.STATUSES = STATUSES;
module.exports.CLOSED_STATUSES = CLOSED_STATUSES;
module.exports.CATEGORIES = CATEGORIES;
