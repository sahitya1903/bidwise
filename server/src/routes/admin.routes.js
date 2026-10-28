const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const admin = require('../controllers/adminController');

const router = Router();

router.use(requireAuth, requireRole('admin'));
router.get('/users', admin.listUsers);
// Admins cancel auctions through POST /api/auctions/:id/cancel (FR-10).

module.exports = router;
