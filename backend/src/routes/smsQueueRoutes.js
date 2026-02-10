/**
 * SMS Queue Admin Routes
 * 
 * Admin endpoints to monitor and manage the SMS queue
 */

const express = require('express');
const router = express.Router();
const { smsQueue } = require('../services/smsQueue');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * GET /api/admin/sms-queue/stats
 * Get SMS queue statistics
 */
router.get('/stats', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const stats = smsQueue.getStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/sms-queue/failed
 * Get failed SMS messages
 */
router.get('/failed', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const failed = smsQueue.getFailedMessages(limit);
    res.json({
      success: true,
      data: failed,
      count: failed.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/sms-queue/retry/:messageId
 * Retry a specific failed message
 */
router.post('/retry/:messageId', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { messageId } = req.params;
    const newId = await smsQueue.retry(messageId);
    res.json({
      success: true,
      message: 'Message re-queued',
      data: { newId },
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/sms-queue/retry-all
 * Retry all failed messages
 */
router.post('/retry-all', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const count = await smsQueue.retryAll();
    res.json({
      success: true,
      message: `${count} messages re-queued`,
      data: { count },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/sms-queue/send-test
 * Send a test SMS (for debugging)
 */
router.post('/send-test', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone and message are required',
      });
    }

    const id = await smsQueue.enqueue(phone, message, {
      priority: 'high',
      metadata: { test: true, adminId: req.user.id },
    });

    res.json({
      success: true,
      message: 'Test SMS queued',
      data: { id },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/admin/sms-queue/clear-old
 * Clear old failed messages
 */
router.delete('/clear-old', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const count = smsQueue.clearOldFailedMessages(days);
    res.json({
      success: true,
      message: `${count} old messages cleared`,
      data: { count },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
