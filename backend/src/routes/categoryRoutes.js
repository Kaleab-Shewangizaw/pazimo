const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const upload = require('../middlewares/upload');
const { authenticateUser, restrictTo } = require('../middlewares/auth');
const { adminWriteLimiter } = require('../middlewares/rateLimiters');

// Categories are shared platform taxonomy: every event on the platform hangs
// off them, so a delete here is not a local edit but a change to everyone's
// listing. Reads stay public — the browse and filter UI needs them with no
// account — but every write is admin-only.
//
// Until 2026-08-20 these four writes referenced no credential at all and
// answered 201/200 to an anonymous caller.
const adminOnly = [adminWriteLimiter, authenticateUser, restrictTo('admin')];

router.post('/', adminOnly, upload.single('image'), categoryController.createCategory);
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategory);
router.patch('/:id', adminOnly, upload.single('image'), categoryController.updateCategory);
router.put('/:id', adminOnly, upload.single('image'), categoryController.updateCategory);
router.delete('/:id', adminOnly, categoryController.deleteCategory);

module.exports = router;
