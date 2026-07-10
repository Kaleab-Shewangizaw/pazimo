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

router.post('/',
  authenticateUser,
  restrictTo('admin', 'organizer'),
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

router.get('/organizer/:organizerId/withdrawals',
  authenticateUser,
  restrictTo('admin', 'organizer'),
  getOrganizerWithdrawals
);

module.exports = router; 