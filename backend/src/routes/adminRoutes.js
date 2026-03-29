const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/auth');
const {
	getDashboardStats,
	getRevenueChartData,
	getEventRegistrationsChartData,
	getTicketSalesChartData,
} = require('../controllers/adminController');

// Admin dashboard stats
router.get('/dashboard/stats', authenticateUser, getDashboardStats);

// Admin dashboard chart data
router.get('/dashboard/charts/revenue', authenticateUser, getRevenueChartData);
router.get('/dashboard/charts/event-registrations', authenticateUser, getEventRegistrationsChartData);
router.get('/dashboard/charts/ticket-sales', authenticateUser, getTicketSalesChartData);

module.exports = router; 