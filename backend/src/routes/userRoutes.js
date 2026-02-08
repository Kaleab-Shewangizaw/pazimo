const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Optimized route for fetching organizers with stats (must be before /:id)
router.get('/organizers-stats', userController.getOrganizersWithStats);

// User routes without middleware protection
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUser);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router; 


