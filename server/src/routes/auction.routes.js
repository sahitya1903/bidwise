const { Router } = require('express');
const auctions = require('../controllers/auctionController');
const bids = require('../controllers/bidController');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { updateAuctionSchema, bidSchema } = require('../utils/validation');

const router = Router();

router.get('/', optionalAuth, auctions.list);
router.post('/', requireAuth, auctions.create); // full validation happens in auctionService.create
router.get('/:id', optionalAuth, auctions.getById);
router.patch('/:id', requireAuth, validate(updateAuctionSchema), auctions.update);
router.post('/:id/cancel', requireAuth, auctions.cancel);
router.get('/:id/bids', bids.history);
router.post('/:id/bids', requireAuth, validate(bidSchema), bids.placeBid);

module.exports = router;
