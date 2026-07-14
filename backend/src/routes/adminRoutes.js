const express = require('express');
const router = express.Router();
const { authenticateUser, restrictTo } = require('../middlewares/auth');
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

// Admin dashboard stats
router.get('/dashboard/stats', authenticateUser, restrictTo('admin'), getDashboardStats);

// Admin dashboard chart data
router.get('/dashboard/charts/revenue', authenticateUser, restrictTo('admin'), getRevenueChartData);
router.get('/dashboard/charts/event-registrations', authenticateUser, restrictTo('admin'), getEventRegistrationsChartData);
router.get('/dashboard/charts/ticket-sales', authenticateUser, restrictTo('admin'), getTicketSalesChartData);

// Chapa finance dashboard
router.get('/finance/chapa/balances', authenticateUser, restrictTo('admin'), getChapaBalances);
router.get('/finance/chapa/transactions', authenticateUser, restrictTo('admin'), getChapaTransactions);
router.get('/finance/chapa/transactions/:ref/events', authenticateUser, restrictTo('admin'), getChapaTransactionEvents);
router.get('/finance/chapa/summary', authenticateUser, restrictTo('admin'), getChapaSummary);

module.exports = router;