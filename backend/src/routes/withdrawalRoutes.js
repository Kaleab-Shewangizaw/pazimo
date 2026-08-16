const express = require('express');
const router = express.Router();
const {
  getOrganizerBalance,
  createWithdrawal,
  updateWithdrawalStatus,
  getAllWithdrawals,
  getOrganizerWithdrawals
} = require('../controllers/withdrawalController');
const { authenticateUser, restrictTo } = require('../middlewares/auth');

// Admin routes
router.get('/',
  authenticateUser,
  restrictTo('admin'),
  getAllWithdrawals
);

// 'venue' and 'cinema' are admitted explicitly rather than by widening the role
// list without thought: createWithdrawal routes each into its own creator, which
// validates against that business's own pool. Every other route in this file
// stays organizer-only — neither has a ticket balance an organizer query can
// read, nor a Capital position.
router.post('/',
  authenticateUser,
  restrictTo('admin', 'organizer', 'venue', 'cinema'),
  createWithdrawal
);

router.patch('/:withdrawalId',
  authenticateUser,
  restrictTo('admin'),
  updateWithdrawalStatus
);

// Organizer routes (also usable by admin, scoped to the requested organizer)
router.get('/organizer/:organizerId/balance',
  authenticateUser,
  restrictTo('admin', 'organizer'),
  getOrganizerBalance
);

// Venues and cinemas read their own payout history here too — the controller
// forces the scope to the caller's own account, so the :organizerId segment
// cannot be used to reach another account's rows.
router.get('/organizer/:organizerId/withdrawals',
  authenticateUser,
  restrictTo('admin', 'organizer', 'venue', 'cinema'),
  getOrganizerWithdrawals
);

module.exports = router; 