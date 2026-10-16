// Every expected failure is thrown as an AppError. The errorHandler middleware
// turns it into { error: { code, message, details } } with the right HTTP status.

const MESSAGES = {
  VALIDATION_ERROR: 'Some fields are invalid',
  UNAUTHORIZED: 'Please log in',
  INVALID_TOKEN: 'Your session has expired. Please log in again',
  INVALID_CREDENTIALS: 'Wrong email or password',
  FORBIDDEN: 'You are not allowed to do this',
  EMAIL_TAKEN: 'An account with this email already exists',
  USER_NOT_FOUND: 'User not found',
  AUCTION_NOT_FOUND: 'Auction not found',
  NOT_OWNER: 'Only the seller can change this auction',
  HAS_BIDS: 'This auction already has bids and can no longer be changed',
  AUCTION_CLOSED: 'This auction is already closed',
  AUCTION_NOT_ACTIVE: 'This auction is not open for bidding',
  OWN_AUCTION: 'You cannot bid on your own auction',
  ALREADY_HIGHEST_BIDDER: 'You are already the highest bidder',
  BID_TOO_LOW: 'Your bid is too low',
  OUTBID_RETRY: 'Someone else bid first. Please try again',
  NOT_FOUND: 'Not found',
};

class AppError extends Error {
  constructor(status, code, details, message) {
    super(message || MESSAGES[code] || code);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = AppError;
module.exports.MESSAGES = MESSAGES;
