const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

router.get('/status', healthController.getHealthStatus);

module.exports = router; 