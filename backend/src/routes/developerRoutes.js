const express = require('express');
const router = express.Router();
const { authenticateUser, restrictTo } = require('../middlewares/auth');
const { collectStats } = require('../utils/serverStats');
const { getRecentLogs } = require('../utils/requestLog');

// Snapshot endpoint so the dashboard has data immediately on load instead of
// waiting for the first socket push. Gated to 'developer' only - admins do
// not get infra access through this route by default.
router.get('/stats', authenticateUser, restrictTo('developer'), async (req, res) => {
  try {
    const stats = await collectStats();
    res.status(200).json({ status: 'success', data: stats });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Same snapshot-on-load rationale as /stats: recent request history isn't
// worth waiting up to PUSH_INTERVAL_MS for.
router.get('/logs', authenticateUser, restrictTo('developer'), (req, res) => {
  res.status(200).json({ status: 'success', data: getRecentLogs(100) });
});

module.exports = router;
