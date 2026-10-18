const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// BR-10: bids are never edited or deleted. They are the audit trail.
const bidSchema = new mongoose.Schema(
  {
    auction: { type: ObjectId, ref: 'Auction', required: true },
    bidder: { type: ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

bidSchema.index({ auction: 1, amount: -1 }); // bid history
bidSchema.index({ bidder: 1, createdAt: -1 }); // My bids

function blockChange() {
  throw new Error('Bids are immutable (BR-10)');
}
bidSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], blockChange);
bidSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], { query: true, document: true }, blockChange);

module.exports = mongoose.models.Bid || mongoose.model('Bid', bidSchema);
