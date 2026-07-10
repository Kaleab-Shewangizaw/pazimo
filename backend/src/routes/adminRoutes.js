const express = require('express');
const router = express.Router();
const { authenticateUser, restrictTo } = require('../middlewares/auth');
const {
	getDashboardStats,
	getRevenueChartData,
	getEventRegistrationsChartData,
	getTicketSalesChartData,
} = require('../controllers/adminController');

// Admin dashboard stats
router.get('/dashboard/stats', authenticateUser, restrictTo('admin'), getDashboardStats);

// Admin dashboard chart data
router.get('/dashboard/charts/revenue', authenticateUser, restrictTo('admin'), getRevenueChartData);
router.get('/dashboard/charts/event-registrations', authenticateUser, restrictTo('admin'), getEventRegistrationsChartData);
router.get('/dashboard/charts/ticket-sales', authenticateUser, restrictTo('admin'), getTicketSalesChartData);

module.exports = router; 