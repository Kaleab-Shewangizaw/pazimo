const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const upload = require('../middlewares/upload');
const { authenticateUser } = require('../middlewares/auth');

// Public routes
router.get('/public-events', eventController.getPublicEvents);
router.get('/', eventController.getAllEvents);
router.get('/details/:id', eventController.getEventDetails);

// Protected routes
router.use(authenticateUser);
router.post('/', upload.array('coverImages', 5), eventController.createEvent);
router.get('/organizer/:id', eventController.getOrganizerEvents);
router.get('/:id', eventController.getEvent);
router.patch('/:id', upload.single('coverImage'), eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);
router.patch('/:id/publish', eventController.publishEvent);
router.patch('/:id/cancel', eventController.cancelEvent);
router.patch('/:id/tickets', eventController.updateTicketTypes);

// 🎟️ New routes for tickets
router.post('/:id/buy', eventController.buyTicket); // Buy ticket
router.get('/user/:userId/tickets', eventController.getUserTickets); // Get user's tickets

// Wishlist routes
router.get("/:userId/wishlist", eventController.getWishlist)
router.post("/:userId/wishlist", eventController.updateWishlist)

router.patch('/:id/banner', eventController.toggleBannerStatus);

// Manual ticket availability update route
router.post('/update-ticket-availability', eventController.updateTicketAvailability);

module.exports = router; 


