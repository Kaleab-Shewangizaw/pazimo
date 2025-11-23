const express = require('express');
const router = express.Router();
const {
  getOrganizerBalance,
  createWithdrawal,
  updateWithdrawalStatus,
  getAllWithdrawals,
  getOrganizerWithdrawals
} = require('../controllers/withdrawalController');
const { authenticateUser } = require('../middlewares/auth');

// Admin routes
router.get('/', 
  authenticateUser, 
  getAllWithdrawals
);

router.post('/', 
  authenticateUser, 
  createWithdrawal
);

router.patch('/:withdrawalId', 
  authenticateUser, 
  updateWithdrawalStatus
);

// Organizer routes
router.get('/organizer/:organizerId/balance', 
  authenticateUser, 
  getOrganizerBalance
);

router.get('/organizer/:organizerId/withdrawals', 
  authenticateUser, 
  getOrganizerWithdrawals
);

module.exports = router; 