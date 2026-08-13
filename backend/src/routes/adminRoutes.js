const express = require('express');
const router = express.Router();
const { authenticateUser, restrictTo } = require('../middlewares/auth');
const {
  getOrganizerOverview,
} = require('../controllers/organizerOverviewController');
const {
  getCommissionSummary,
  listEventCommissions,
  updateEventCommission,
} = require('../controllers/commissionController');
const {
	getDashboardStats,
	getRevenueChartData,
	getEventRegistrationsChartData,
	getTicketSalesChartData,
} = require('../controllers/adminController');
const {
	getChapaBalances,
	getChapaTransactions,
	getChapaTransactionEvents,
	getChapaSummary,
} = require('../controllers/chapaFinanceController');
const {
	listGiftCards,
	createGiftCard,
	getGiftCard,
	updateGiftCardStatus,
	cancelGiftCard,
	topUpGiftCard,
	getGiftCardPaymentStatus,
	createGiftCardPayout,
	listGiftCardPayouts,
	getGiftCardTransactions,
	getGiftCardFeed,
	getPayoutBanks,
	getGiftCardSummary,
} = require('../controllers/chapaGiftCardController');
const {
	getV2Payments,
	getV2Payouts,
} = require('../controllers/chapaV2Controller');
const {
	getConfig: getPlatformFeeConfig,
	updateConfig: updatePlatformFeeConfig,
	getDaily: getPlatformFeeDaily,
	sendDailyFee,
} = require('../controllers/platformFeeController');

// Admin dashboard stats
router.get('/dashboard/stats', authenticateUser, restrictTo('admin'), getDashboardStats);

// Organizer list with event counts and revenue already joined. Replaces the
// browser assembling this from hundreds of per-organizer / per-event requests.
router.get('/organizers/overview', authenticateUser, restrictTo('admin'), getOrganizerOverview);

// Commission management. Rates are per event; VAT is fixed and charged on top
// of whatever the event's rate is.
router.get('/commission/summary', authenticateUser, restrictTo('admin'), getCommissionSummary);
router.get('/commission/events', authenticateUser, restrictTo('admin'), listEventCommissions);
router.patch('/commission/events/:eventId', authenticateUser, restrictTo('admin'), updateEventCommission);

// Admin dashboard chart data
router.get('/dashboard/charts/revenue', authenticateUser, restrictTo('admin'), getRevenueChartData);
router.get('/dashboard/charts/event-registrations', authenticateUser, restrictTo('admin'), getEventRegistrationsChartData);
router.get('/dashboard/charts/ticket-sales', authenticateUser, restrictTo('admin'), getTicketSalesChartData);

// Chapa finance dashboard
router.get('/finance/chapa/balances', authenticateUser, restrictTo('admin'), getChapaBalances);
router.get('/finance/chapa/transactions', authenticateUser, restrictTo('admin'), getChapaTransactions);
router.get('/finance/chapa/transactions/:ref/events', authenticateUser, restrictTo('admin'), getChapaTransactionEvents);
router.get('/finance/chapa/summary', authenticateUser, restrictTo('admin'), getChapaSummary);

// Chapa API v2 (scoped dashboard keys — payments/payouts created through v2 only)
router.get('/finance/chapa/v2/payments', authenticateUser, restrictTo('admin'), getV2Payments);
router.get('/finance/chapa/v2/payouts', authenticateUser, restrictTo('admin'), getV2Payouts);

// Chapa Link gift cards (static paths before /:cardNumber so they don't get captured)
router.get('/finance/chapa/giftcards/summary', authenticateUser, restrictTo('admin'), getGiftCardSummary);
router.get('/finance/chapa/giftcards/feed', authenticateUser, restrictTo('admin'), getGiftCardFeed);
router.get('/finance/chapa/giftcards/banks', authenticateUser, restrictTo('admin'), getPayoutBanks);
router.get('/finance/chapa/giftcards/payouts', authenticateUser, restrictTo('admin'), listGiftCardPayouts);
router.get('/finance/chapa/giftcards/payments/:reference/status', authenticateUser, restrictTo('admin'), getGiftCardPaymentStatus);
router.get('/finance/chapa/giftcards', authenticateUser, restrictTo('admin'), listGiftCards);
router.post('/finance/chapa/giftcards', authenticateUser, restrictTo('admin'), createGiftCard);
router.get('/finance/chapa/giftcards/:cardNumber', authenticateUser, restrictTo('admin'), getGiftCard);
router.patch('/finance/chapa/giftcards/:cardNumber', authenticateUser, restrictTo('admin'), updateGiftCardStatus);
router.delete('/finance/chapa/giftcards/:cardNumber', authenticateUser, restrictTo('admin'), cancelGiftCard);
router.post('/finance/chapa/giftcards/:cardNumber/topup', authenticateUser, restrictTo('admin'), topUpGiftCard);
router.post('/finance/chapa/giftcards/:cardNumber/payouts', authenticateUser, restrictTo('admin'), createGiftCardPayout);
router.get('/finance/chapa/giftcards/:cardNumber/transactions', authenticateUser, restrictTo('admin'), getGiftCardTransactions);

// Daily 3% platform fee (skimmed off gift-card ticket sales only)
router.get('/finance/platform-fee/config', authenticateUser, restrictTo('admin'), getPlatformFeeConfig);
router.patch('/finance/platform-fee/config', authenticateUser, restrictTo('admin'), updatePlatformFeeConfig);
router.get('/finance/platform-fee/daily', authenticateUser, restrictTo('admin'), getPlatformFeeDaily);
router.post('/finance/platform-fee/send', authenticateUser, restrictTo('admin'), sendDailyFee);

module.exports = router;