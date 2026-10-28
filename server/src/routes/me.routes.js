const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const bids = require('../controllers/bidController');
const auctions = require('../controllers/auctionController');

const router = Router();

router.use(requireAuth);
router.get('/bids', bids.myBids);
router.get('/auctions', auctions.myListings);

module.exports = router;
